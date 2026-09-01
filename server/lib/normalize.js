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

/**
 * Damerau–Levenshtein-ish edit distance (small, allocation-friendly).
 * Used to make ranking tolerant of typos like "interstelar".
 */
function editDistance(a, b, max = 3) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (!la) return lb;
  if (!lb) return la;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j += 1) prev[j] = j;
  for (let i = 1; i <= la; i += 1) {
    const cur = [i];
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (j > 1 && i > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prev[j - 2] + cost); // transposition
      }
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1; // early exit
    prev = cur;
  }
  return prev[lb];
}

/** Token-aware similarity in 0..1 between the query and a candidate title. */
function fuzzySimilarity(query, candidate) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  const dist = editDistance(query, candidate, 4);
  const maxLen = Math.max(query.length, candidate.length);
  const whole = 1 - dist / maxLen;
  // also try token-level matching (different word order / partial titles)
  const qTokens = query.split(' ').filter((t) => t.length > 1);
  const cTokens = candidate.split(' ').filter((t) => t.length > 1);
  let tokenHits = 0;
  for (const qt of qTokens) {
    if (cTokens.some((ct) => ct === qt || (qt.length > 3 && editDistance(qt, ct, 1) <= 1))) tokenHits += 1;
  }
  const tokenScore = qTokens.length ? tokenHits / qTokens.length : 0;
  return Math.max(whole, tokenScore * 0.9);
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
  editDistance,
  fuzzySimilarity,
  toCard,
};
