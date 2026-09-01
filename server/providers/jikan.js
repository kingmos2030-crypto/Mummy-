'use strict';

const config = require('../config');
const cache = require('../lib/cache');
const { fetchJson, createThrottle } = require('../lib/http');
const { normalizedMedia, mediaKey, yearOf } = require('../lib/normalize');

const throttle = createThrottle(config.jikan.minIntervalMs);

async function call(pathname, params = {}, ttlMs = config.cache.detailsTtlMs) {
  const url = new URL(`${config.jikan.baseUrl}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  const key = `jikan:${pathname}:${JSON.stringify(params)}`;
  const { value } = await cache.remember(
    key,
    'jikan',
    ttlMs,
    () => throttle(() => fetchJson(url.toString())),
    { negativeTtlMs: config.cache.negativeTtlMs }
  );
  return value;
}

function mapAnime(a) {
  const titles = (a.titles || []).map((t) => t.title).filter(Boolean);
  const genres = [
    ...(a.genres || []),
    ...(a.themes || []),
    ...(a.demographics || []),
  ].map((g) => g.name);
  return normalizedMedia({
    key: mediaKey('jikan', 'anime', a.mal_id),
    source: 'jikan',
    sourceType: 'anime',
    sourceId: a.mal_id,
    mediaType: 'anime',
    title: a.title_english || a.title || a.title_japanese,
    originalTitle: a.title_japanese || a.title || '',
    alternativeTitles: titles,
    releaseDate: a.aired?.from || null,
    releaseYear: a.year || yearOf(a.aired?.from),
    endYear: yearOf(a.aired?.to),
    overview: a.synopsis || '',
    tagline: a.background || '',
    posterUrl: a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || null,
    backdropUrl: a.trailer?.images?.maximum_image_url || null,
    runtime: parseRuntime(a.duration),
    status: a.status || '',
    genres,
    languages: ['Japanese'],
    countries: ['Japan'],
    companies: (a.studios || []).map((s) => s.name),
    trailers: a.trailer?.url
      ? [{ name: 'Trailer', site: 'YouTube', key: a.trailer.youtube_id, url: a.trailer.url }]
      : [],
    externalRating: a.score || null,
    externalVotes: a.scored_by || null,
    totalEpisodes: a.episodes || 0,
    totalSeasons: 1,
    homepage: a.url || '',
    externalIds: { malId: a.mal_id },
    extra: {
      rank: a.rank,
      popularity: a.popularity,
      season: a.season,
      source: a.source,
      rating: a.rating,
      producers: (a.producers || []).map((p) => p.name),
      licensors: (a.licensors || []).map((p) => p.name),
    },
  });
}

function parseRuntime(duration) {
  if (!duration) return null;
  const hr = /(\d+)\s*hr/.exec(duration);
  const min = /(\d+)\s*min/.exec(duration);
  const total = (hr ? Number(hr[1]) * 60 : 0) + (min ? Number(min[1]) : 0);
  return total || null;
}

async function search(query, { limit = 20 } = {}) {
  const data = await call('/anime', { q: query, limit, sfw: true, order_by: 'members', sort: 'desc' }, config.cache.searchTtlMs);
  return { results: (data?.data || []).map(mapAnime) };
}

async function details(malId) {
  const data = await call(`/anime/${malId}/full`);
  if (!data?.data) throw new Error('JIKAN_NOT_FOUND');
  const media = mapAnime(data.data);
  try {
    const chars = await call(`/anime/${malId}/characters`);
    media.cast = (chars?.data || []).slice(0, 30).map((c) => ({
      name: c.voice_actors?.find((v) => v.language === 'Japanese')?.person?.name || c.character?.name,
      character: c.character?.name || '',
      image: c.character?.images?.jpg?.image_url || null,
      order: 0,
    }));
  } catch {
    /* characters are optional */
  }
  try {
    const staff = await call(`/anime/${malId}/staff`);
    media.crew = (staff?.data || []).slice(0, 20).map((s) => ({
      name: s.person?.name,
      job: (s.positions || []).join(', '),
      department: 'Staff',
      image: s.person?.images?.jpg?.image_url || null,
    }));
  } catch {
    /* staff is optional */
  }
  return media;
}

async function episodes(malId, { maxPages = 10 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const data = await call(`/anime/${malId}/episodes`, { page });
    const items = data?.data || [];
    for (const e of items) {
      all.push({
        seasonNumber: 1,
        episodeNumber: e.mal_id,
        absoluteNumber: e.mal_id,
        title: e.title || e.title_romanji || `Episode ${e.mal_id}`,
        overview: e.synopsis || '',
        airDate: e.aired || null,
        runtime: null,
        imageUrl: null,
        source: 'jikan',
      });
    }
    if (!data?.pagination?.has_next_page) break;
  }
  return all;
}

async function topAnime() {
  const data = await call('/top/anime', { limit: 20, filter: 'bypopularity' }, config.cache.trendingTtlMs);
  return (data?.data || []).map(mapAnime);
}

/** Lightweight mapper for recommendation entries (slim MAL payloads). */
function mapEntry(e) {
  return normalizedMedia({
    key: mediaKey('jikan', 'anime', e.mal_id),
    source: 'jikan',
    sourceType: 'anime',
    sourceId: e.mal_id,
    mediaType: 'anime',
    title: e.title,
    originalTitle: '',
    posterUrl: e.images?.jpg?.image_url || null,
    externalIds: { malId: e.mal_id },
  });
}

/** Community "users also like" recommendations for an anime. */
async function recommendations(malId) {
  const data = await call(`/anime/${malId}/recommendations`, {}, config.cache.detailsTtlMs);
  return (data?.data || [])
    .slice(0, 14)
    .map((r) => r.entry)
    .filter(Boolean)
    .map(mapEntry);
}

module.exports = { search, details, episodes, topAnime, recommendations };
