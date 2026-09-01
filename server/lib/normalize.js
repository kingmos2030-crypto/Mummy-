'use strict';

/** Shared helpers to build the normalized internal media shape. */

const MEDIA_TYPES = ['movie', 'tv', 'anime', 'cartoon', 'documentary', 'other'];

const PERSONAL_STATUSES = [
  'watched',
  'watching',
  'want_to_watch',
  'paused',
  'dropped',
  'rewatching',
];

const QUALITIES = [
  'CAM',
  'SD',
  '480p',
  '720p',
  '1080p',
  '1080p WEB-DL',
  '1080p Blu-ray',
  '4K',
  '4K HDR',
  'Blu-ray',
];

const yearOf = (date) => {
  if (!date) return null;
  const m = String(date).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
};

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());

const uniq = (arr) => [...new Set((arr || []).filter(Boolean))];

/** Documentary/animation aware media typing for TMDB payloads. */
function refineType(baseType, genres = [], originCountries = []) {
  const g = genres.map((x) => String(x).toLowerCase());
  if (g.includes('documentary') || g.includes('وثائقي')) return 'documentary';
  if (g.includes('animation') || g.includes('رسوم متحركة') || g.includes('anime')) {
    const jp = originCountries.map((c) => String(c).toUpperCase());
    if (jp.includes('JP') || jp.includes('JAPAN')) return 'anime';
    return 'cartoon';
  }
  return baseType;
}

function mediaKey(source, sourceType, sourceId) {
  return `${source}:${sourceType}:${sourceId}`;
}

/** Build a normalized media object with safe defaults. */
function normalizedMedia(partial = {}) {
  return {
    key: partial.key || null,
    source: partial.source || 'unknown',
    sourceType: partial.sourceType || '',
    sourceId: partial.sourceId != null ? String(partial.sourceId) : '',
    mediaType: MEDIA_TYPES.includes(partial.mediaType) ? partial.mediaType : 'other',
    title: clean(partial.title) || 'بدون عنوان',
    originalTitle: clean(partial.originalTitle),
    alternativeTitles: uniq(partial.alternativeTitles || []),
    releaseDate: partial.releaseDate || null,
    releaseYear: partial.releaseYear ?? yearOf(partial.releaseDate),
    endYear: partial.endYear ?? null,
    overview: clean(partial.overview),
    tagline: clean(partial.tagline),
    posterUrl: partial.posterUrl || null,
    backdropUrl: partial.backdropUrl || null,
    runtime: partial.runtime ?? null,
    status: clean(partial.status),
    genres: uniq(partial.genres || []),
    languages: uniq(partial.languages || []),
    countries: uniq(partial.countries || []),
    companies: uniq(partial.companies || []),
    cast: partial.cast || [],
    crew: partial.crew || [],
    trailers: partial.trailers || [],
    externalRating: partial.externalRating ?? null,
    externalVotes: partial.externalVotes ?? null,
    totalSeasons: partial.totalSeasons ?? 0,
    totalEpisodes: partial.totalEpisodes ?? 0,
    homepage: clean(partial.homepage),
    externalIds: partial.externalIds || {},
    seasons: partial.seasons || [],
    episodes: partial.episodes || [],
    extra: partial.extra || {},
  };
}

/** Lightweight card used in search results / rows. */
function toCard(media) {
  return {
    key: media.key,
    source: media.source,
    sourceType: media.sourceType,
    sourceId: media.sourceId,
    mediaType: media.mediaType,
    title: media.title,
    originalTitle: media.originalTitle,
    releaseYear: media.releaseYear,
    posterUrl: media.posterUrl,
    backdropUrl: media.backdropUrl,
    genres: media.genres.slice(0, 3),
    externalRating: media.externalRating,
    overview: media.overview ? media.overview.slice(0, 240) : '',
  };
}

module.exports = {
  MEDIA_TYPES,
  PERSONAL_STATUSES,
  QUALITIES,
  yearOf,
  clean,
  uniq,
  refineType,
  mediaKey,
  normalizedMedia,
  toCard,
};
