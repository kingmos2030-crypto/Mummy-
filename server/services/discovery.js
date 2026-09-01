'use strict';

const { db } = require('../db');
const config = require('../config');
const tmdb = require('../providers/tmdb');
const jikan = require('../providers/jikan');
const tvmaze = require('../providers/tvmaze');
const offline = require('../providers/offline');
const { toCard, editDistance, fuzzySimilarity } = require('../lib/normalize');

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
  // typo tolerance: reward near-matches so "interstelar" ranks Interstellar first
  const sim = Math.max(
    fuzzySimilarity(q, title),
    fuzzySimilarity(q, original),
    ...alts.map((a) => fuzzySimilarity(q, a))
  );
  if (sim >= 0.995) score += 0; // exact already handled above
  else if (sim >= 0.8) score += 40;
  else if (sim >= 0.65) score += 20;
  else if (sim >= 0.5) score += 8;
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

  // always fold local catalog matches in: cheap, and typo-tolerant for famous
  // titles even when a provider mangled or missed the query
  if (!degraded && config.allowOffline) {
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

/** Enrich TMDB TV with TVmaze episode data when useful. */
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
  } catch {
    /* enrichment is best-effort only */
  }
  return media;
}

/** Fetch normalized details, using an already-persisted mirror when fresh. */
async function details(source, sourceType, sourceId, { refresh = false } = {}) {
  if (!SOURCES.includes(source)) throw Object.assign(new Error('مصدر غير معروف'), { status: 400 });

  if (!refresh) {
    const local = await readMirror(source, sourceType, sourceId);
    if (local && isFresh(local.fetched_at, config.cache.detailsTtlMs)) {
      return { media: await hydrate(local), cached: true, degraded: source === 'offline' };
    }
  }

  try {
    const media = await enrich(await fetchFromProvider(source, sourceType, sourceId));
    const stored = await persist(media);
    return { media: await hydrate(stored), cached: false, degraded: source === 'offline' };
  } catch (error) {
    const local = await readMirror(source, sourceType, sourceId);
    if (local) return { media: await hydrate(local), cached: true, stale: true, degraded: true };
    if (config.allowOffline) {
      const fallback = offline.byId(sourceId);
      if (fallback) return { media: await hydrate(await persist(fallback)), cached: false, degraded: true };
    }
    throw Object.assign(new Error(describeError(error)), { status: 502 });
  }
}

// -------------------------------------------------- mirror persistence

const isFresh = (iso, ttl) => iso && Date.now() - new Date(iso).getTime() < ttl;

async function readMirror(source, sourceType, sourceId) {
  return db.get(
    `SELECT m.* FROM media m
     JOIN media_sources s ON s.media_id = m.id
     WHERE s.source = ? AND s.source_type = ? AND s.source_id = ?`,
    [source, sourceType, String(sourceId)]
  );
}

async function findMediaIdByExternalIds(externalIds = {}) {
  const map = {
    tmdbId: 'tmdb',
    malId: 'jikan',
    tvmazeId: 'tvmaze',
    imdbId: 'imdb',
  };
  for (const [field, source] of Object.entries(map)) {
    const value = externalIds[field];
    if (!value) continue;
    // eslint-disable-next-line no-await-in-loop
    const row = await db.get('SELECT media_id FROM media_sources WHERE source = ? AND source_id = ?', [
      source,
      String(value),
    ]);
    if (row) return row.media_id;
  }
  return null;
}

const J = (v) => JSON.stringify(v ?? []);

/** Upsert episodes inside an open transaction `t`. */
async function saveEpisodesImpl(t, mediaId, episodes) {
  const stmt = `INSERT INTO episodes (media_id, season_number, episode_number, absolute_number, title, overview, air_date, runtime, image_url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(media_id, season_number, episode_number) DO UPDATE SET
       title=excluded.title,
       overview=CASE WHEN excluded.overview <> '' THEN excluded.overview ELSE overview END,
       air_date=COALESCE(excluded.air_date, air_date),
       runtime=COALESCE(excluded.runtime, runtime),
       image_url=COALESCE(excluded.image_url, image_url)`;
  for (const e of episodes) {
    if (e.episodeNumber == null) continue;
    // eslint-disable-next-line no-await-in-loop
    await t.run(stmt, [
      mediaId,
      e.seasonNumber ?? 1,
      e.episodeNumber,
      e.absoluteNumber ?? null,
      e.title || `الحلقة ${e.episodeNumber}`,
      e.overview || '',
      e.airDate || null,
      e.runtime || null,
      e.imageUrl || null,
      e.source || '',
    ]);
  }
  const count = await t.get('SELECT COUNT(*) c FROM episodes WHERE media_id = ?', [mediaId]);
  const seasonCount = await t.get('SELECT COUNT(DISTINCT season_number) c FROM episodes WHERE media_id = ?', [
    mediaId,
  ]);
  await t.run('UPDATE media SET total_episodes = ?, total_seasons = MAX(total_seasons, ?) WHERE id = ?', [
    count.c,
    seasonCount.c,
    mediaId,
  ]);
}

/**
 * Upsert the normalized media + its sources + seasons/episodes (one write TX).
 * Duplicate prevention: an existing row is reused when ANY external id matches.
 */
async function persist(media) {
  return db.tx(async (t) => {
    let mediaId = null;
    const direct = await t.get(
      'SELECT media_id FROM media_sources WHERE source = ? AND source_type = ? AND source_id = ?',
      [media.source, media.sourceType, String(media.sourceId)]
    );
    if (direct) {
      mediaId = direct.media_id;
    } else {
      const map = { tmdbId: 'tmdb', malId: 'jikan', tvmazeId: 'tvmaze', imdbId: 'imdb' };
      for (const [field, src] of Object.entries(map)) {
        const value = media.externalIds?.[field];
        if (!value) continue;
        // eslint-disable-next-line no-await-in-loop
        const row = await t.get('SELECT media_id FROM media_sources WHERE source = ? AND source_id = ?', [
          src,
          String(value),
        ]);
        if (row) {
          mediaId = row.media_id;
          break;
        }
      }
    }

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
      await t.run(
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
         WHERE id=@id`,
        { ...payload, id: mediaId }
      );
    } else {
      const info = await t.run(
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
        )`,
        payload
      );
      mediaId = info.lastInsertRowid;
    }

    // sources
    const upsertSourceSql = `INSERT INTO media_sources (media_id, source, source_type, source_id, url, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source, source_type, source_id) DO UPDATE SET media_id=excluded.media_id, is_primary=excluded.is_primary`;
    await t.run(upsertSourceSql, [
      mediaId,
      media.source,
      media.sourceType,
      String(media.sourceId),
      media.homepage || '',
      1,
    ]);
    const idMap = [
      ['tmdb', media.externalIds?.tmdbId, media.sourceType === 'movie' ? 'movie' : 'tv'],
      ['jikan', media.externalIds?.malId, 'anime'],
      ['tvmaze', media.externalIds?.tvmazeId, 'tv'],
      ['imdb', media.externalIds?.imdbId, ''],
    ];
    for (const [source, id, sType] of idMap) {
      if (!id) continue;
      if (source === media.source && String(id) === String(media.sourceId)) continue;
      // eslint-disable-next-line no-await-in-loop
      await t.run(upsertSourceSql, [mediaId, source, sType, String(id), '', 0]);
    }

    // seasons
    if (media.seasons?.length) {
      const upsertSeasonSql = `INSERT INTO seasons (media_id, season_number, name, overview, air_date, episode_count, poster_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(media_id, season_number) DO UPDATE SET
           name=excluded.name, overview=excluded.overview, air_date=excluded.air_date,
           episode_count=excluded.episode_count, poster_url=COALESCE(excluded.poster_url, poster_url)`;
      for (const s of media.seasons) {
        // eslint-disable-next-line no-await-in-loop
        await t.run(upsertSeasonSql, [
          mediaId,
          s.seasonNumber,
          s.name || `الموسم ${s.seasonNumber}`,
          s.overview || '',
          s.airDate || null,
          s.episodeCount || 0,
          s.posterUrl || null,
        ]);
      }
    }

    if (media.episodes?.length) await saveEpisodesImpl(t, mediaId, media.episodes);

    return t.get('SELECT * FROM media WHERE id = ?', [mediaId]);
  });
}

/** Standalone episode upsert (lazy episode fetching outside persist). */
async function saveEpisodes(mediaId, episodes) {
  await db.tx((t) => saveEpisodesImpl(t, mediaId, episodes));
}

const P = (v, fallback = []) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/**
 * Turn DB rows back into the normalized API shape.
 * Batched: one query for all source rows, one for all seasons.
 */
async function hydrateMany(rows) {
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.id);
  const marks = ids.map(() => '?').join(',');
  const [sourceRows, seasonRows] = await Promise.all([
    db.all(`SELECT media_id, source, source_type, source_id FROM media_sources WHERE media_id IN (${marks})`, ids),
    db.all(`SELECT * FROM seasons WHERE media_id IN (${marks}) ORDER BY season_number`, ids),
  ]);
  const sourcesByMedia = new Map();
  for (const s of sourceRows) {
    if (!sourcesByMedia.has(s.media_id)) sourcesByMedia.set(s.media_id, []);
    sourcesByMedia.get(s.media_id).push(s);
  }
  const seasonsByMedia = new Map();
  for (const s of seasonRows) {
    if (!seasonsByMedia.has(s.media_id)) seasonsByMedia.set(s.media_id, []);
    seasonsByMedia.get(s.media_id).push(s);
  }

  return rows.map((row) => {
    const sources = sourcesByMedia.get(row.id) || [];
    const externalIds = {};
    for (const s of sources) {
      if (s.source === 'tmdb') externalIds.tmdbId = Number(s.source_id) || s.source_id;
      if (s.source === 'jikan') externalIds.malId = Number(s.source_id) || s.source_id;
      if (s.source === 'tvmaze') externalIds.tvmazeId = Number(s.source_id) || s.source_id;
      if (s.source === 'imdb') externalIds.imdbId = s.source_id;
      if (s.source === 'offline') externalIds.offlineId = s.source_id;
    }
    const primary = sources.find((s) => s.source === row.primary_source) || sources[0];
    const seasons = (seasonsByMedia.get(row.id) || []).map((s) => ({
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
  });
}

/** Turn one DB row back into the normalized API shape. */
async function hydrate(row) {
  if (!row) return null;
  const [media] = await hydrateMany([row]);
  return media || null;
}

/** Ensure a media row exists for a provider reference and return it. */
async function ensureMedia({ source, sourceType, sourceId, internalId }) {
  if (internalId) {
    const row = await db.get('SELECT * FROM media WHERE id = ?', [internalId]);
    if (row) return hydrate(row);
    throw Object.assign(new Error('لم يتم العثور على العمل'), { status: 404 });
  }
  const { media } = await details(source, sourceType, sourceId);
  return media;
}

/** Load (and lazily fetch) episodes for a media row. */
async function getEpisodes(mediaId, { season } = {}) {
  const row = await db.get('SELECT * FROM media WHERE id = ?', [mediaId]);
  if (!row) throw Object.assign(new Error('لم يتم العثور على العمل'), { status: 404 });
  let existing = (await db.get('SELECT COUNT(*) c FROM episodes WHERE media_id = ?', [mediaId])).c;

  if (existing === 0 && row.media_type !== 'movie') {
    const media = await hydrate(row);
    const fetched = await fetchEpisodesFromProviders(media);
    if (fetched.length) {
      await saveEpisodes(mediaId, fetched);
      existing = fetched.length;
    }
  }

  const rows = season
    ? await db.all('SELECT * FROM episodes WHERE media_id = ? AND season_number = ? ORDER BY episode_number', [
        mediaId,
        season,
      ])
    : await db.all('SELECT * FROM episodes WHERE media_id = ? ORDER BY season_number, episode_number', [mediaId]);

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

/** IMDb-style "more like this" shelf for the details page. */
async function similar(media) {
  try {
    if (media.source === 'tmdb' && media.externalIds?.tmdbId) {
      const list = await tmdb.similar(media.sourceType === 'movie' ? 'movie' : 'tv', media.externalIds.tmdbId);
      return list.map(toCard);
    }
    if (media.source === 'jikan' && media.externalIds?.malId) {
      const list = await jikan.recommendations(media.externalIds.malId);
      return list.map(toCard);
    }
    if (media.externalIds?.malId) {
      const list = await jikan.recommendations(media.externalIds.malId);
      return list.map(toCard);
    }
  } catch {
    /* similar titles are optional */
  }
  return [];
}

/** Homepage discovery rows with graceful degradation. */
async function trending() {
  const out = { trending: [], anime: [], popularMovies: [], popularTV: [], degraded: false };
  const [t, a, pm, pt] = await Promise.allSettled([
    tmdb.trending(),
    jikan.topAnime(),
    tmdb.popular('movie'),
    tmdb.popular('tv'),
  ]);
  if (t.status === 'fulfilled') out.trending = t.value.map(toCard);
  if (a.status === 'fulfilled') out.anime = a.value.map(toCard);
  if (pm.status === 'fulfilled') out.popularMovies = pm.value.map(toCard);
  if (pt.status === 'fulfilled') out.popularTV = pt.value.map(toCard);
  const anyLive = out.trending.length || out.anime.length || out.popularMovies.length || out.popularTV.length;
  if (!anyLive && config.allowOffline) {
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
  hydrateMany,
  persist,
  saveEpisodes,
  similar,
  trending,
  findMediaIdByExternalIds,
  fuzzySimilarity,
  editDistance,
};
