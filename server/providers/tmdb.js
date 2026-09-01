'use strict';

const config = require('../config');
const cache = require('../lib/cache');
const { fetchJson } = require('../lib/http');
const {
  normalizedMedia,
  refineType,
  mediaKey,
  yearOf,
} = require('../lib/normalize');

const TMDB = config.tmdb;

const img = (path, size = 'w500') => (path ? `${TMDB.imageBase}/${size}${path}` : null);

function buildUrl(pathname, params = {}) {
  const url = new URL(`${TMDB.baseUrl}${pathname}`);
  url.searchParams.set('language', params.language || TMDB.language);
  for (const [k, v] of Object.entries(params)) {
    if (k === 'language' || v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }
  if (!TMDB.accessToken && TMDB.apiKey) url.searchParams.set('api_key', TMDB.apiKey);
  return url.toString();
}

function headers() {
  return TMDB.accessToken ? { Authorization: `Bearer ${TMDB.accessToken}` } : {};
}

async function call(pathname, params = {}, ttlMs = config.cache.detailsTtlMs) {
  if (!TMDB.enabled) throw new Error('TMDB_DISABLED');
  const key = `tmdb:${pathname}:${JSON.stringify(params)}`;
  const { value } = await cache.remember(
    key,
    'tmdb',
    ttlMs,
    () => fetchJson(buildUrl(pathname, params), { headers: headers() }),
    { negativeTtlMs: config.cache.negativeTtlMs }
  );
  return value;
}

// ---------------------------------------------------------------- mapping

function mapSearchItem(item) {
  const type = item.media_type === 'movie' ? 'movie' : 'tv';
  const genres = []; // search endpoint returns genre_ids only; resolved lazily on details
  return normalizedMedia({
    key: mediaKey('tmdb', type, item.id),
    source: 'tmdb',
    sourceType: type,
    sourceId: item.id,
    mediaType: type,
    title: item.title || item.name || item.original_title || item.original_name,
    originalTitle: item.original_title || item.original_name || '',
    releaseDate: item.release_date || item.first_air_date || null,
    overview: item.overview,
    posterUrl: img(item.poster_path),
    backdropUrl: img(item.backdrop_path, 'w780'),
    genres,
    externalRating: item.vote_average || null,
    externalVotes: item.vote_count || null,
    externalIds: { tmdbId: item.id },
  });
}

function mapDetails(data, type) {
  const genres = (data.genres || []).map((g) => g.name);
  const countries = (data.production_countries || []).map((c) => c.name);
  const originCountries = (data.origin_country || []).concat(
    (data.production_countries || []).map((c) => c.iso_3166_1)
  );
  const credits = data.credits || data.aggregate_credits || {};
  const castList = (credits.cast || []).slice(0, 30).map((p) => ({
    name: p.name,
    character: p.character || (p.roles && p.roles[0] && p.roles[0].character) || '',
    image: img(p.profile_path, 'w185'),
    order: p.order ?? 999,
  }));
  const crewList = (credits.crew || [])
    .filter((p) =>
      ['Director', 'Writer', 'Screenplay', 'Producer', 'Executive Producer', 'Story', 'Creator',
        'Original Music Composer', 'Director of Photography'].includes(p.job)
    )
    .slice(0, 30)
    .map((p) => ({
      name: p.name,
      job: p.job,
      department: p.department,
      image: img(p.profile_path, 'w185'),
    }));
  if (Array.isArray(data.created_by)) {
    for (const c of data.created_by) {
      crewList.unshift({ name: c.name, job: 'Creator', department: 'Creation', image: img(c.profile_path, 'w185') });
    }
  }
  const trailers = (data.videos?.results || [])
    .filter((v) => ['Trailer', 'Teaser'].includes(v.type) && v.site === 'YouTube')
    .slice(0, 6)
    .map((v) => ({ name: v.name, site: v.site, key: v.key, url: `https://www.youtube.com/watch?v=${v.key}` }));

  const seasons = (data.seasons || [])
    .filter((s) => s.season_number !== undefined)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      overview: s.overview || '',
      airDate: s.air_date || null,
      episodeCount: s.episode_count || 0,
      posterUrl: img(s.poster_path),
    }));

  const altTitles = (data.alternative_titles?.titles || data.alternative_titles?.results || [])
    .map((t) => t.title || t.name)
    .filter(Boolean)
    .slice(0, 20);

  return normalizedMedia({
    key: mediaKey('tmdb', type, data.id),
    source: 'tmdb',
    sourceType: type,
    sourceId: data.id,
    mediaType: refineType(type, genres, originCountries),
    title: data.title || data.name,
    originalTitle: data.original_title || data.original_name || '',
    alternativeTitles: altTitles,
    releaseDate: data.release_date || data.first_air_date || null,
    endYear: yearOf(data.last_air_date),
    overview: data.overview,
    tagline: data.tagline,
    posterUrl: img(data.poster_path),
    backdropUrl: img(data.backdrop_path, 'w1280'),
    runtime: data.runtime || (data.episode_run_time && data.episode_run_time[0]) || null,
    status: data.status || '',
    genres,
    languages: (data.spoken_languages || []).map((l) => l.english_name || l.name),
    countries,
    companies: (data.production_companies || []).map((c) => c.name),
    cast: castList,
    crew: crewList,
    trailers,
    externalRating: data.vote_average || null,
    externalVotes: data.vote_count || null,
    totalSeasons: data.number_of_seasons || 0,
    totalEpisodes: data.number_of_episodes || 0,
    homepage: data.homepage || '',
    externalIds: {
      tmdbId: data.id,
      imdbId: data.external_ids?.imdb_id || data.imdb_id || null,
      tvdbId: data.external_ids?.tvdb_id || null,
    },
    seasons,
    extra: { popularity: data.popularity, adult: data.adult },
  });
}

// ---------------------------------------------------------------- public

async function search(query, { page = 1 } = {}) {
  const data = await call('/search/multi', { query, page, include_adult: false }, config.cache.searchTtlMs);
  const results = (data?.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map(mapSearchItem);
  // Arabic-language fallback: TMDB ar-SA results can be sparse -> also try en-US
  if (results.length < 5) {
    try {
      const en = await call(
        '/search/multi',
        { query, page, include_adult: false, language: TMDB.fallbackLanguage },
        config.cache.searchTtlMs
      );
      const extra = (en?.results || [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map(mapSearchItem);
      const seen = new Set(results.map((r) => r.key));
      for (const item of extra) if (!seen.has(item.key)) results.push(item);
    } catch {
      /* ignore fallback failure */
    }
  }
  return { results, totalPages: data?.total_pages || 1, totalResults: data?.total_results || results.length };
}

async function details(type, id) {
  const append =
    type === 'movie'
      ? 'credits,videos,external_ids,alternative_titles'
      : 'aggregate_credits,credits,videos,external_ids,alternative_titles';
  const data = await call(`/${type}/${id}`, { append_to_response: append });
  if (!data || data.success === false) throw new Error('TMDB_NOT_FOUND');
  const media = mapDetails(data, type);
  // fill an empty (Arabic) overview from English
  if (!media.overview) {
    try {
      const en = await call(`/${type}/${id}`, { language: TMDB.fallbackLanguage });
      media.overview = en?.overview || '';
      if (!media.title) media.title = en?.title || en?.name || media.title;
    } catch {
      /* noop */
    }
  }
  return media;
}

async function seasonEpisodes(tvId, seasonNumber) {
  const data = await call(`/tv/${tvId}/season/${seasonNumber}`);
  return (data?.episodes || []).map((e) => ({
    seasonNumber: e.season_number ?? seasonNumber,
    episodeNumber: e.episode_number,
    title: e.name || `الحلقة ${e.episode_number}`,
    overview: e.overview || '',
    airDate: e.air_date || null,
    runtime: e.runtime || null,
    imageUrl: img(e.still_path, 'w300'),
    source: 'tmdb',
  }));
}

async function trending(window = 'week') {
  const data = await call(`/trending/all/${window}`, {}, config.cache.trendingTtlMs);
  return (data?.results || [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map(mapSearchItem);
}

module.exports = { search, details, seasonEpisodes, trending, enabled: () => TMDB.enabled, img };
