'use strict';

const { db } = require('../db');
const config = require('../config');
const tmdb = require('../providers/tmdb');
const jikan = require('../providers/jikan');
const tvmaze = require('../providers/tvmaze');
const offline = require('../providers/offline');
const { toCard, normalize: _n } = require('../lib/normalize');

const SOURCES = ['tmdb', 'jikan', 'tvmaze', 'offline'];

// ---------------------------------------------------------------- search

function titleKey(media) {
  return `${offline.normalize(media.title || media.originalTitle)}|${media.releaseYear || ''}`;
}

/**
 * Merge results from several providers.
 * Dedupe rules (in order):
 *   1. same provider + same id
 *   2. shared external id (tmdb/mal/tvmaze/imdb)
 *   3. same normalized title + same release year
 * A merged item keeps the richest field values and accumulates externalIds.
 */
function mergeResults(groups) {
  const out = [];
  const byExternal = new Map();
  const byTitle = new Map();

  const externalKeys = (m) =>
    Object.entries(m.externalIds || {})
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}:${v}`);

  for (const group of groups) {
    for (const media of group) {
      let target = null;
      for (const ek of externalKeys(media)) {
        if (byExternal.has(ek)) {
          target = byExternal.get(ek);
          break;
        }
      }
      if (!target) target = byTitle.get(titleKey(media)) || null;

      if (target) {
        target.externalIds = { ...media.externalIds, ...target.externalIds };
        target.matchedSources = [...new Set([...(target.matchedSources || [target.source]), media.source])];
        target.posterUrl = target.posterUrl || media.posterUrl;
        target.backdropUrl = target.backdropUrl || media.backdropUrl;
        target.overview = target.overview || media.overview;
        target.genres = [...new Set([...(target.genres || []), ...(media.genres || [])])];
        target.externalRating = target.externalRating ?? media.externalRating;
        if (media.mediaType === 'anime') target.mediaType = 'anime';
        continue;
      }

      media.matchedSources = [media.source];
      out.push(media);
      byTitle.set(titleKey(media), media);
      for (const ek of externalKeys(media)) byExternal.set(ek, media);
    }
  }
  return out;
}

function scoreResult(media, query) {
  const q = offline.normalize(query);
  const title = offline.normalize(media.title);
  const original = offline.normalize(media.originalTitle);
  const alts = (media.alternativeTitles || []).map(offline.normalize);
  let score = 0;
  if (title === q || original === q || alts.includes(q)) score += 100;
  if (title.startsWith(q)) score += 45;
  if (title.includes(q)) score += 25;
  if (original.includes(q) || alts.some((a) => a.includes(q))) score += 18;
  if (media.posterUrl) score += 5;
  score += Math.min(15, (media.externalRating || 0) * 1.5);
  score += (media.matchedSources || []).length * 4;
  return score;
}

/**
 * Multi-source search.
 * @param {string} query
 * @param {{type?: string}} options
 */
async function search(query, { type = 'all' } = {}) {
  const trimmed = String(query || '').trim();
  if (trimmed.length < 2) return { results: [], sources: [], degraded: false, notices: [] };

  const jobs = [];
  const notices = [];
  const usedSources = new Set();

  const wantsGeneral = type === 'all' || ['movie', 'tv', 'cartoon', 'documentary', 'other'].includes(type);
  const wantsAnime = type === 'all' || type === 'anime';
  const wantsTv = type === 'all' || type === 'tv' || type === 'cartoon' || type === 'documentary';

  if (wantsGeneral) {
    jobs.push(
      tmdb
        .search(trimmed)
        .then((r) => {
          usedSources.add('tmdb');
          return r.results;
        })
        .catch((e) => {
          notices.push({ source: 'tmdb', message: describeError(e) });
          return [];
        })
    );
  }
  if (wantsAnime) {
    jobs.push(
      jikan
        .search(trimmed)
        .then((r) => {
          usedSources.add('jikan');
          return r.results;
        })
        .catch((e) => {
          notices.push({ source: 'jikan', message: describeError(e) });
          return [];
        })
    );
  }
  if (wantsTv) {
    jobs.push(
      tvmaze
        .search(trimmed)
        .then((r) => {
          usedSources.add('tvmaze');
          return r.results;
        })
        .catch((e) => {
          notices.push({ source: 'tvmaze', message: describeError(e) });
          return [];
        })
    );
  }

  const groups = await Promise.all(jobs);
  let merged = mergeResults(groups);

  let degraded = false;
  if (merged.length === 0 && config.allowOffline) {
    const local = offline.search(trimmed, { type: type === 'all' ? undefined : type });
    if (local.length) {
      usedSources.add('offline');
      degraded = true;
      merged = mergeResults([local]);
    }
  }

  // also fold in local matches when live sources returned very little
  if (!degraded && merged.length < 3 && config.allowOffline) {
    const local = offline.search(trimmed, { type: type === 'all' ? undefined : type });
    if (local.length) {
      usedSources.add('offline');
      merged = mergeResults([merged, local]);
    }
  }

  if (type !== 'all') merged = merged.filter((m) => m.mediaType === type);

  merged.sort((a, b) => scoreResult(b, trimmed) - scoreResult(a, trimmed));

  return {
    results: merged.slice(0, 40).map((m) => ({ ...toCard(m), matchedSources: m.matchedSources })),
    sources: [...usedSources],
    degraded,
    notices,
  };
}

function describeError(error) {
  const msg = String(error?.message || error);
  if (msg.includes('TMDB_DISABLED')) return 'مفتاح TMDB غير مُعرّف على الخادم.';
  if (msg.includes('abort') || msg.includes('fetch failed')) return 'تعذّر الوصول للمزوّد (شبكة/مهلة).';
  if (msg.includes('429')) return 'تم تجاوز حد الطلبات مؤقتًا.';
  return 'تعذّر جلب النتائج من هذا المزوّد.';
}

// ---------------------------------------------------------------- details

async function fetchFromProvider(source, sourceType, sourceId) {
  if (source === 'tmdb') return tmdb.details(sourceType === 'movie' ? 'movie' : 'tv', sourceId);
  if (source === 'jikan') return jikan.details(sourceId);
  if (source === 'tvmaze') return tvmaze.details(sourceId);
  if (source === 'offline') {
    const item = offline.byId(sourceId);
    if (!item) throw new Error('OFFLINE_NOT_FOUND');
    return item;
  }
  throw new Error('UNKNOWN_SOURCE');
}

/** Enrich TMDB TV with TVmaze episode data / anime with Jikan score when useful. */
async function enrich(media) {
  try {
    if (media.source === 'tmdb' && media.sourceType === 'tv' && media.externalIds?.imdbId) {
      if (!media.episodes?.length) {
        const alt = await tvmaze.findByImdb(media.externalIds.imdbId);
        if (alt) {
          media.externalIds.tvmazeId = alt.externalIds.tvmazeId;
          if (!media.totalEpisodes) media.totalEpisodes = alt.totalEpisodes;
          media.extra = { ...media.extra, tvmazeRating: alt.externalRating };
        }
      }
    }
    if (media.source === 'jikan' && !media.backdropUrl) {
      // nothing else to do; Jikan has no backdrops
    }
  } catch {
    /* enrichment is best-effort only */
  }
  return media;
}

/** Fetch normalized details, using an already-persisted mirror when fresh. */
async function details(source, sourceType, sourceId, { refresh = false } = {}) {
  if (!SOURCES.includes(source)) throw Object.assign(new Error('مصدر غير معروف'), { status: 400 });

  if (!refresh) {
    const local = readMirror(source, sourceType, sourceId);
    if (local && isFresh(local.fetched_at, config.cache.detailsTtlMs)) {
      return { media: hydrate(local), cached: true, degraded: source === 'offline' };
    }
  }

  try {
    const media = await enrich(await fetchFromProvider(source, sourceType, sourceId));
    const stored = persist(media);
    return { media: hydrate(stored), cached: false, degraded: source === 'offline' };
  } catch (error) {
    const local = readMirror(source, sourceType, sourceId);
    if (local) return { media: hydrate(local), cached: true, stale: true, degraded: true };
    if (config.allowOffline) {
      const fallback = offline.byId(sourceId);
      if (fallback) return { media: hydrate(persist(fallback)), cached: false, degraded: true };
    }
    throw Object.assign(new Error(describeError(error)), { status: 502 });
  }
}

// -------------------------------------------------- mirror persistence

const isFresh = (iso, ttl) => iso && Date.now() - new Date(iso).getTime() < ttl;

function readMirror(source, sourceType, sourceId) {
  return db
    .prepare(
      `SELECT m.* FROM media m
       JOIN media_sources s ON s.media_id = m.id
       WHERE s.source = ? AND s.source_type = ? AND s.source_id = ?`
    )
    .get(source, sourceType, String(sourceId));
}

function findMediaIdByExternalIds(externalIds = {}) {
  const map = {
    tmdbId: 'tmdb',
    malId: 'jikan',
    tvmazeId: 'tvmaze',
    imdbId: 'imdb',
  };
  for (const [field, source] of Object.entries(map)) {
    const value = externalIds[field];
    if (!value) continue;
    const row = db
      .prepare('SELECT media_id FROM media_sources WHERE source = ? AND source_id = ?')
      .get(source, String(value));
    if (row) return row.media_id;
  }
  return null;
}

const J = (v) => JSON.stringify(v ?? []);

/**
 * Upsert the normalized media + its sources + seasons/episodes.
 * Duplicate prevention: an existing row is reused when ANY external id matches.
 */
const persist = db.transaction((media) => {
  let mediaId = null;
  const direct = db
    .prepare('SELECT media_id FROM media_sources WHERE source = ? AND source_type = ? AND source_id = ?')
    .get(media.source, media.sourceType, String(media.sourceId));
  mediaId = direct?.media_id || findMediaIdByExternalIds(media.externalIds);

  const payload = {
    media_type: media.mediaType,
    title: media.title,
    original_title: media.originalTitle,
    release_date: media.releaseDate,
    release_year: media.releaseYear,
    end_year: media.endYear,
    overview: media.overview,
    tagline: media.tagline,
    poster_url: media.posterUrl,
    backdrop_url: media.backdropUrl,
    runtime: media.runtime,
    status: media.status,
    genres: J(media.genres),
    languages: J(media.languages),
    countries: J(media.countries),
    companies: J(media.companies),
    cast_json: J(media.cast),
    crew_json: J(media.crew),
    trailers: J(media.trailers),
    external_rating: media.externalRating,
    external_votes: media.externalVotes,
    total_seasons: media.totalSeasons,
    total_episodes: media.totalEpisodes || (media.episodes?.length ?? 0),
    homepage: media.homepage,
    primary_source: media.source,
    raw_extra: JSON.stringify({ ...media.extra, alternativeTitles: media.alternativeTitles || [] }),
  };

  if (mediaId) {
    db.prepare(
      `UPDATE media SET
        media_type=@media_type, title=@title, original_title=@original_title,
        release_date=@release_date, release_year=@release_year, end_year=@end_year,
        overview=CASE WHEN @overview <> '' THEN @overview ELSE overview END,
        tagline=@tagline,
        poster_url=COALESCE(@poster_url, poster_url),
        backdrop_url=COALESCE(@backdrop_url, backdrop_url),
        runtime=COALESCE(@runtime, runtime), status=@status,
        genres=@genres, languages=@languages, countries=@countries, companies=@companies,
        cast_json=@cast_json, crew_json=@crew_json, trailers=@trailers,
        external_rating=@external_rating, external_votes=@external_votes,
        total_seasons=@total_seasons, total_episodes=@total_episodes,
        homepage=@homepage, primary_source=@primary_source, raw_extra=@raw_extra,
        fetched_at=datetime('now'), updated_at=datetime('now')
       WHERE id=@id`
    ).run({ ...payload, id: mediaId });
  } else {
    const info = db
      .prepare(
        `INSERT INTO media (
          media_type, title, original_title, release_date, release_year, end_year, overview,
          tagline, poster_url, backdrop_url, runtime, status, genres, languages, countries,
          companies, cast_json, crew_json, trailers, external_rating, external_votes,
          total_seasons, total_episodes, homepage, primary_source, raw_extra
        ) VALUES (
          @media_type, @title, @original_title, @release_date, @release_year, @end_year, @overview,
          @tagline, @poster_url, @backdrop_url, @runtime, @status, @genres, @languages, @countries,
          @companies, @cast_json, @crew_json, @trailers, @external_rating, @external_votes,
          @total_seasons, @total_episodes, @homepage, @primary_source, @raw_extra
        )`
      )
      .run(payload);
    mediaId = info.lastInsertRowid;
  }

  // sources
  const upsertSource = db.prepare(
    `INSERT INTO media_sources (media_id, source, source_type, source_id, url, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(source, source_type, source_id) DO UPDATE SET media_id=excluded.media_id, is_primary=excluded.is_primary`
  );
  upsertSource.run(mediaId, media.source, media.sourceType, String(media.sourceId), media.homepage || '', 1);
  const idMap = [
    ['tmdb', media.externalIds?.tmdbId, media.sourceType === 'movie' ? 'movie' : 'tv'],
    ['jikan', media.externalIds?.malId, 'anime'],
    ['tvmaze', media.externalIds?.tvmazeId, 'tv'],
    ['imdb', media.externalIds?.imdbId, ''],
  ];
  for (const [source, id, sType] of idMap) {
    if (!id) continue;
    if (source === media.source && String(id) === String(media.sourceId)) continue;
    upsertSource.run(mediaId, source, sType, String(id), '', 0);
  }

  // seasons
  if (media.seasons?.length) {
    const upsertSeason = db.prepare(
      `INSERT INTO seasons (media_id, season_number, name, overview, air_date, episode_count, poster_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(media_id, season_number) DO UPDATE SET
         name=excluded.name, overview=excluded.overview, air_date=excluded.air_date,
         episode_count=excluded.episode_count, poster_url=COALESCE(excluded.poster_url, poster_url)`
    );
    for (const s of media.seasons) {
      upsertSeason.run(
        mediaId,
        s.seasonNumber,
        s.name || `الموسم ${s.seasonNumber}`,
        s.overview || '',
        s.airDate || null,
        s.episodeCount || 0,
        s.posterUrl || null
      );
    }
  }

  if (media.episodes?.length) saveEpisodes(mediaId, media.episodes);

  return db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
});

const saveEpisodesTx = db.transaction((mediaId, episodes) => {
  const stmt = db.prepare(
    `INSERT INTO episodes (media_id, season_number, episode_number, absolute_number, title, overview, air_date, runtime, image_url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(media_id, season_number, episode_number) DO UPDATE SET
       title=excluded.title,
       overview=CASE WHEN excluded.overview <> '' THEN excluded.overview ELSE overview END,
       air_date=COALESCE(excluded.air_date, air_date),
       runtime=COALESCE(excluded.runtime, runtime),
       image_url=COALESCE(excluded.image_url, image_url)`
  );
  for (const e of episodes) {
    if (e.episodeNumber == null) continue;
    stmt.run(
      mediaId,
      e.seasonNumber ?? 1,
      e.episodeNumber,
      e.absoluteNumber ?? null,
      e.title || `الحلقة ${e.episodeNumber}`,
      e.overview || '',
      e.airDate || null,
      e.runtime || null,
      e.imageUrl || null,
      e.source || ''
    );
  }
  const count = db.prepare('SELECT COUNT(*) c FROM episodes WHERE media_id = ?').get(mediaId).c;
  const seasonCount = db
    .prepare('SELECT COUNT(DISTINCT season_number) c FROM episodes WHERE media_id = ?')
    .get(mediaId).c;
  db.prepare('UPDATE media SET total_episodes = ?, total_seasons = MAX(total_seasons, ?) WHERE id = ?').run(
    count,
    seasonCount,
    mediaId
  );
});

function saveEpisodes(mediaId, episodes) {
  saveEpisodesTx(mediaId, episodes);
}

const P = (v, fallback = []) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/** Turn a DB row back into the normalized API shape. */
function hydrate(row) {
  if (!row) return null;
  const sources = db.prepare('SELECT source, source_type, source_id FROM media_sources WHERE media_id = ?').all(row.id);
  const externalIds = {};
  for (const s of sources) {
    if (s.source === 'tmdb') externalIds.tmdbId = Number(s.source_id) || s.source_id;
    if (s.source === 'jikan') externalIds.malId = Number(s.source_id) || s.source_id;
    if (s.source === 'tvmaze') externalIds.tvmazeId = Number(s.source_id) || s.source_id;
    if (s.source === 'imdb') externalIds.imdbId = s.source_id;
    if (s.source === 'offline') externalIds.offlineId = s.source_id;
  }
  const primary = sources.find((s) => s.source === row.primary_source) || sources[0];
  const seasons = db
    .prepare('SELECT * FROM seasons WHERE media_id = ? ORDER BY season_number')
    .all(row.id)
    .map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      overview: s.overview,
      airDate: s.air_date,
      episodeCount: s.episode_count,
      posterUrl: s.poster_url,
    }));
  const extra = P(row.raw_extra, {});
  return {
    id: row.id,
    internalId: row.id,
    mediaType: row.media_type,
    title: row.title,
    originalTitle: row.original_title,
    alternativeTitles: extra.alternativeTitles || [],
    releaseDate: row.release_date,
    releaseYear: row.release_year,
    endYear: row.end_year,
    overview: row.overview,
    tagline: row.tagline,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    runtime: row.runtime,
    status: row.status,
    genres: P(row.genres),
    languages: P(row.languages),
    countries: P(row.countries),
    companies: P(row.companies),
    cast: P(row.cast_json),
    crew: P(row.crew_json),
    trailers: P(row.trailers),
    externalRating: row.external_rating,
    externalVotes: row.external_votes,
    totalSeasons: row.total_seasons,
    totalEpisodes: row.total_episodes,
    homepage: row.homepage,
    source: row.primary_source,
    sourceType: primary?.source_type || '',
    sourceId: primary?.source_id || '',
    externalIds,
    seasons,
    extra,
    fetchedAt: row.fetched_at,
  };
}

/** Ensure a media row exists for a provider reference and return it. */
async function ensureMedia({ source, sourceType, sourceId, internalId }) {
  if (internalId) {
    const row = db.prepare('SELECT * FROM media WHERE id = ?').get(internalId);
    if (row) return hydrate(row);
    throw Object.assign(new Error('لم يتم العثور على العمل'), { status: 404 });
  }
  const { media } = await details(source, sourceType, sourceId);
  return media;
}

/** Load (and lazily fetch) episodes for a media row. */
async function getEpisodes(mediaId, { season } = {}) {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
  if (!row) throw Object.assign(new Error('لم يتم العثور على العمل'), { status: 404 });
  let existing = db.prepare('SELECT COUNT(*) c FROM episodes WHERE media_id = ?').get(mediaId).c;

  if (existing === 0 && row.media_type !== 'movie') {
    const media = hydrate(row);
    const fetched = await fetchEpisodesFromProviders(media);
    if (fetched.length) {
      saveEpisodes(mediaId, fetched);
      existing = fetched.length;
    }
  }

  const rows = season
    ? db
        .prepare('SELECT * FROM episodes WHERE media_id = ? AND season_number = ? ORDER BY episode_number')
        .all(mediaId, season)
    : db.prepare('SELECT * FROM episodes WHERE media_id = ? ORDER BY season_number, episode_number').all(mediaId);

  return rows.map((e) => ({
    id: e.id,
    seasonNumber: e.season_number,
    episodeNumber: e.episode_number,
    absoluteNumber: e.absolute_number,
    title: e.title,
    overview: e.overview,
    airDate: e.air_date,
    runtime: e.runtime,
    imageUrl: e.image_url,
    source: e.source,
  }));
}

async function fetchEpisodesFromProviders(media) {
  const attempts = [];
  if (media.externalIds?.tmdbId && media.source === 'tmdb') {
    attempts.push(async () => {
      const seasons = media.seasons?.length ? media.seasons : [{ seasonNumber: 1 }];
      const all = [];
      for (const s of seasons) {
        if (s.seasonNumber === 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const eps = await tmdb.seasonEpisodes(media.externalIds.tmdbId, s.seasonNumber);
        all.push(...eps);
      }
      return all;
    });
  }
  if (media.externalIds?.malId) attempts.push(() => jikan.episodes(media.externalIds.malId));
  if (media.externalIds?.tvmazeId) attempts.push(() => tvmaze.episodesForShow(media.externalIds.tvmazeId));
  if (media.source === 'offline') {
    attempts.push(async () => offline.byId(media.sourceId)?.episodes || []);
  }

  for (const attempt of attempts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const eps = await attempt();
      if (eps?.length) return eps;
    } catch {
      /* try the next provider */
    }
  }
  return [];
}

/** Homepage discovery rows (trending) with graceful degradation. */
async function trending() {
  const out = { trending: [], anime: [], degraded: false };
  const [t, a] = await Promise.allSettled([tmdb.trending(), jikan.topAnime()]);
  if (t.status === 'fulfilled') out.trending = t.value.map(toCard);
  if (a.status === 'fulfilled') out.anime = a.value.map(toCard);
  if (!out.trending.length && !out.anime.length && config.allowOffline) {
    out.trending = offline.trending().map(toCard);
    out.degraded = true;
  }
  return out;
}

module.exports = {
  search,
  details,
  ensureMedia,
  getEpisodes,
  hydrate,
  persist,
  saveEpisodes,
  trending,
  findMediaIdByExternalIds,
};
