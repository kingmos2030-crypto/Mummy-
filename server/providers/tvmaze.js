'use strict';

const config = require('../config');
const cache = require('../lib/cache');
const { fetchJson } = require('../lib/http');
const { normalizedMedia, mediaKey, yearOf } = require('../lib/normalize');

async function call(pathname, params = {}, ttlMs = config.cache.detailsTtlMs) {
  const url = new URL(`${config.tvmaze.baseUrl}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const key = `tvmaze:${pathname}:${JSON.stringify(params)}`;
  const { value } = await cache.remember(key, 'tvmaze', ttlMs, () => fetchJson(url.toString()), {
    negativeTtlMs: config.cache.negativeTtlMs,
  });
  return value;
}

const strip = (html) => (html ? String(html).replace(/<[^>]*>/g, '').trim() : '');

function mapShow(show) {
  const embedded = show._embedded || {};
  const genres = show.genres || [];
  const isAnime = genres.includes('Anime');
  return normalizedMedia({
    key: mediaKey('tvmaze', 'tv', show.id),
    source: 'tvmaze',
    sourceType: 'tv',
    sourceId: show.id,
    mediaType: isAnime ? 'anime' : 'tv',
    title: show.name,
    originalTitle: show.name,
    releaseDate: show.premiered || null,
    releaseYear: yearOf(show.premiered),
    endYear: yearOf(show.ended),
    overview: strip(show.summary),
    posterUrl: show.image?.original || show.image?.medium || null,
    backdropUrl: show.image?.original || null,
    runtime: show.averageRuntime || show.runtime || null,
    status: show.status || '',
    genres,
    languages: show.language ? [show.language] : [],
    countries: show.network?.country?.name ? [show.network.country.name] : [],
    companies: [show.network?.name, show.webChannel?.name].filter(Boolean),
    cast: (embedded.cast || []).slice(0, 30).map((c) => ({
      name: c.person?.name,
      character: c.character?.name || '',
      image: c.person?.image?.medium || null,
      order: 0,
    })),
    crew: (embedded.crew || []).slice(0, 20).map((c) => ({
      name: c.person?.name,
      job: c.type,
      department: c.type,
      image: c.person?.image?.medium || null,
    })),
    externalRating: show.rating?.average || null,
    totalSeasons: (embedded.seasons || []).length,
    totalEpisodes: (embedded.episodes || []).length,
    homepage: show.officialSite || show.url || '',
    externalIds: {
      tvmazeId: show.id,
      imdbId: show.externals?.imdb || null,
      tvdbId: show.externals?.thetvdb || null,
    },
    seasons: (embedded.seasons || []).map((s) => ({
      seasonNumber: s.number,
      name: s.name || `الموسم ${s.number}`,
      overview: strip(s.summary),
      airDate: s.premiereDate || null,
      episodeCount: s.episodeOrder || 0,
      posterUrl: s.image?.medium || null,
    })),
    episodes: (embedded.episodes || []).map(mapEpisode),
  });
}

function mapEpisode(e) {
  return {
    seasonNumber: e.season ?? 1,
    episodeNumber: e.number ?? 0,
    title: e.name || `Episode ${e.number}`,
    overview: strip(e.summary),
    airDate: e.airdate || null,
    runtime: e.runtime || null,
    imageUrl: e.image?.medium || e.image?.original || null,
    source: 'tvmaze',
  };
}

async function search(query) {
  const data = await call('/search/shows', { q: query }, config.cache.searchTtlMs);
  return { results: (data || []).map((r) => mapShow(r.show)) };
}

async function details(id) {
  const data = await call(`/shows/${id}`, { embed: ['episodes', 'seasons', 'cast', 'crew'] });
  if (!data) throw new Error('TVMAZE_NOT_FOUND');
  return mapShow(data);
}

/** Used as a metadata fallback when TMDB has no episode data. */
async function findByImdb(imdbId) {
  const data = await call('/lookup/shows', { imdb: imdbId });
  return data ? mapShow(data) : null;
}

async function episodesForShow(id) {
  const data = await call(`/shows/${id}/episodes`);
  return (data || []).map(mapEpisode);
}

module.exports = { search, details, findByImdb, episodesForShow };
