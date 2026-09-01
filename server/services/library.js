'use strict';

const { db } = require('../db');
const discovery = require('./discovery');

const nowIso = () => new Date().toISOString();

async function logHistory(userId, mediaId, entryId, action, details = {}) {
  await db.run(
    'INSERT INTO viewing_history (user_id, media_id, entry_id, action, details) VALUES (?, ?, ?, ?, ?)',
    [userId, mediaId, entryId, action, JSON.stringify(details)]
  );
}

// ------------------------------------------------------------- shaping

const marks = (arr) => arr.map(() => '?').join(',');

async function progressFor(entryId, mediaId) {
  const [total, watched, next] = await Promise.all([
    db.get('SELECT COUNT(*) c FROM episodes WHERE media_id = ?', [mediaId]),
    db.get(
      `SELECT COUNT(*) c FROM watch_progress wp
       JOIN episodes e ON e.id = wp.episode_id
       WHERE wp.entry_id = ? AND wp.status = 'watched'`,
      [entryId]
    ),
    db.get(
      `SELECT e.* FROM episodes e
       LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = ?
       WHERE e.media_id = ? AND (wp.status IS NULL OR wp.status <> 'watched')
       ORDER BY e.season_number, e.episode_number
       LIMIT 1`,
      [entryId, mediaId]
    ),
  ]);
  return shapeProgress(watched.c, total.c, next);
}

function shapeProgress(watchedCount, totalCount, next) {
  return {
    watchedEpisodes: watchedCount,
    totalEpisodes: totalCount,
    percent: totalCount ? Math.round((watchedCount / totalCount) * 1000) / 10 : 0,
    nextEpisode: next
      ? {
          id: next.id,
          seasonNumber: next.season_number,
          episodeNumber: next.episode_number,
          title: next.title,
          airDate: next.air_date,
        }
      : null,
  };
}

/**
 * Batched progress for many personal entries (single round trips instead of
 * 3 queries per entry — matters a lot against a remote database).
 */
async function progressForMany(entryRows) {
  if (!entryRows.length) return new Map();
  const entryIds = entryRows.map((r) => r.id);
  const mediaIds = [...new Set(entryRows.map((r) => r.media_id))];
  const [watchedRows, totalRows, nextRows] = await Promise.all([
    db.all(
      `SELECT wp.entry_id, COUNT(*) c FROM watch_progress wp
       WHERE wp.entry_id IN (${marks(entryIds)}) AND wp.status = 'watched'
       GROUP BY wp.entry_id`,
      entryIds
    ),
    db.all(`SELECT media_id, COUNT(*) c FROM episodes WHERE media_id IN (${marks(mediaIds)}) GROUP BY media_id`, mediaIds),
    db.all(
      `SELECT pe.id AS entry_id, e.id, e.season_number, e.episode_number, e.title, e.air_date
       FROM personal_entries pe
       JOIN episodes e ON e.media_id = pe.media_id
       LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = pe.id
       WHERE pe.id IN (${marks(entryIds)})
         AND (wp.status IS NULL OR wp.status <> 'watched')
       ORDER BY pe.id, e.season_number, e.episode_number`,
      entryIds
    ),
  ]);
  const watchedBy = new Map(watchedRows.map((r) => [r.entry_id, r.c]));
  const totalBy = new Map(totalRows.map((r) => [r.media_id, r.c]));
  const nextBy = new Map();
  for (const r of nextRows) {
    if (!nextBy.has(r.entry_id)) {
      nextBy.set(r.entry_id, {
        id: r.id,
        season_number: r.season_number,
        episode_number: r.episode_number,
        title: r.title,
        air_date: r.air_date,
      });
    }
  }
  const map = new Map();
  for (const row of entryRows) {
    map.set(
      row.id,
      shapeProgress(watchedBy.get(row.id) || 0, totalBy.get(row.media_id) || 0, nextBy.get(row.id) || null)
    );
  }
  return map;
}

async function tagsForMany(entryIds) {
  if (!entryIds.length) return new Map();
  const rows = await db.all(
    `SELECT et.entry_id, t.id, t.name, t.color FROM entry_tags et
     JOIN tags t ON t.id = et.tag_id
     WHERE et.entry_id IN (${marks(entryIds)}) ORDER BY t.name`,
    entryIds
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.entry_id)) map.set(r.entry_id, []);
    map.get(r.entry_id).push({ id: r.id, name: r.name, color: r.color });
  }
  return map;
}

function baseEntryShape(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    status: row.status,
    rating: row.rating,
    quality: row.quality,
    isFavorite: !!row.is_favorite,
    notes: row.notes || '',
    dateStarted: row.date_started,
    dateFinished: row.date_finished,
    lastWatchedAt: row.last_watched_at,
    rewatchCount: row.rewatch_count,
    currentSeason: row.current_season,
    currentEpisode: row.current_episode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Shape many entries with a constant number of DB round trips. */
async function shapeEntries(rows, { withMedia = true } = {}) {
  if (!rows.length) return [];
  const entryIds = rows.map((r) => r.id);
  const [progressMap, tagsMap] = await Promise.all([progressForMany(rows), tagsForMany(entryIds)]);
  let mediaMap = new Map();
  if (withMedia) {
    const mediaIds = [...new Set(rows.map((r) => r.media_id))];
    const mediaRows = await db.all(`SELECT * FROM media WHERE id IN (${marks(mediaIds)})`, mediaIds);
    const hydrated = await discovery.hydrateMany(mediaRows);
    mediaMap = new Map(hydrated.map((m) => [m.id, m]));
  }
  return rows.map((row) => {
    const entry = baseEntryShape(row);
    entry.tags = tagsMap.get(row.id) || [];
    entry.progress = progressMap.get(row.id);
    if (withMedia) entry.media = mediaMap.get(row.media_id) || null;
    return entry;
  });
}

async function shapeEntry(row, options = {}) {
  if (!row) return null;
  const [entry] = await shapeEntries([row], options);
  return entry;
}

async function getEntryByMedia(userId, mediaId) {
  const row = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND media_id = ?', [userId, mediaId]);
  return row ? shapeEntry(row) : null;
}

async function getEntry(userId, entryId) {
  const row = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  return row ? shapeEntry(row) : null;
}

// ------------------------------------------------------------- mutations

/**
 * Create or update the personal entry for a media item.
 * Duplicate prevention is guaranteed by UNIQUE(user_id, media_id) plus the
 * external-id based media dedupe in the discovery layer.
 */
async function upsertEntry(userId, mediaId, patch = {}) {
  const existing = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND media_id = ?', [
    userId,
    mediaId,
  ]);

  const fields = {
    status: patch.status ?? existing?.status ?? 'want_to_watch',
    rating: patch.rating !== undefined ? patch.rating : existing?.rating ?? null,
    quality: patch.quality !== undefined ? patch.quality : existing?.quality ?? null,
    is_favorite:
      patch.isFavorite !== undefined ? (patch.isFavorite ? 1 : 0) : existing?.is_favorite ?? 0,
    notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? '',
    date_started: patch.dateStarted !== undefined ? patch.dateStarted : existing?.date_started ?? null,
    date_finished: patch.dateFinished !== undefined ? patch.dateFinished : existing?.date_finished ?? null,
    last_watched_at: patch.lastWatchedAt !== undefined ? patch.lastWatchedAt : existing?.last_watched_at ?? null,
    rewatch_count: patch.rewatchCount !== undefined ? patch.rewatchCount : existing?.rewatch_count ?? 0,
    current_season: patch.currentSeason !== undefined ? patch.currentSeason : existing?.current_season ?? 1,
    current_episode: patch.currentEpisode !== undefined ? patch.currentEpisode : existing?.current_episode ?? 0,
  };

  // sensible automatic dates
  const today = nowIso().slice(0, 10);
  if (['watching', 'rewatching'].includes(fields.status) && !fields.date_started) fields.date_started = today;
  if (fields.status === 'watched') {
    if (!fields.date_started) fields.date_started = today;
    if (!fields.date_finished) fields.date_finished = today;
    fields.last_watched_at = fields.last_watched_at || nowIso();
  }
  if (existing && existing.status !== 'watched' && fields.status === 'watched') {
    fields.last_watched_at = nowIso();
  }
  if (existing && existing.status === 'watched' && fields.status === 'rewatching') {
    fields.rewatch_count = (existing.rewatch_count || 0) + (patch.rewatchCount === undefined ? 1 : 0);
  }

  let entryId;
  if (existing) {
    await db.run(
      `UPDATE personal_entries SET
        status=@status, rating=@rating, quality=@quality, is_favorite=@is_favorite, notes=@notes,
        date_started=@date_started, date_finished=@date_finished, last_watched_at=@last_watched_at,
        rewatch_count=@rewatch_count, current_season=@current_season, current_episode=@current_episode,
        updated_at=datetime('now')
       WHERE id=@id`,
      { ...fields, id: existing.id }
    );
    entryId = existing.id;
    await logHistory(userId, mediaId, entryId, 'updated', {
      from: existing.status,
      to: fields.status,
      rating: fields.rating,
    });
  } else {
    const info = await db.run(
      `INSERT INTO personal_entries
       (user_id, media_id, status, rating, quality, is_favorite, notes, date_started, date_finished,
        last_watched_at, rewatch_count, current_season, current_episode)
       VALUES (@user_id, @media_id, @status, @rating, @quality, @is_favorite, @notes, @date_started,
               @date_finished, @last_watched_at, @rewatch_count, @current_season, @current_episode)`,
      { ...fields, user_id: userId, media_id: mediaId }
    );
    entryId = info.lastInsertRowid;
    await logHistory(userId, mediaId, entryId, 'added', { status: fields.status });
  }

  if (Array.isArray(patch.tagIds)) await setEntryTags(userId, entryId, patch.tagIds);

  return getEntry(userId, entryId);
}

async function setEntryTags(userId, entryId, tagIds) {
  if (!tagIds.length) {
    await db.run('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
    return;
  }
  const valid = (
    await db.all(`SELECT id FROM tags WHERE user_id = ? AND id IN (${tagIds.map(() => '?').join(',')})`, [
      userId,
      ...tagIds,
    ])
  ).map((r) => r.id);
  await db.tx(async (t) => {
    await t.run('DELETE FROM entry_tags WHERE entry_id = ?', [entryId]);
    for (const id of valid) {
      // eslint-disable-next-line no-await-in-loop
      await t.run('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [entryId, id]);
    }
  });
}

async function deleteEntry(userId, entryId) {
  const entry = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  if (!entry) return false;
  await db.run('DELETE FROM personal_entries WHERE id = ?', [entryId]);
  await logHistory(userId, entry.media_id, null, 'removed', {});
  return true;
}

async function incrementRewatch(userId, entryId, delta = 1) {
  const entry = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  if (!entry) return null;
  const count = Math.max(0, (entry.rewatch_count || 0) + delta);
  await db.run(
    "UPDATE personal_entries SET rewatch_count = ?, last_watched_at = ?, updated_at = datetime('now') WHERE id = ?",
    [count, nowIso(), entryId]
  );
  await logHistory(userId, entry.media_id, entryId, 'rewatch', { count });
  return getEntry(userId, entryId);
}

// ------------------------------------------------------------- episodes

async function setEpisodeStatus(userId, entryId, episodeId, status) {
  const entry = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const episode = await db.get('SELECT * FROM episodes WHERE id = ? AND media_id = ?', [episodeId, entry.media_id]);
  if (!episode) throw Object.assign(new Error('الحلقة غير موجودة'), { status: 404 });

  if (status === 'not_watched') {
    await db.run('DELETE FROM watch_progress WHERE entry_id = ? AND episode_id = ?', [entryId, episodeId]);
  } else {
    await db.run(
      `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entry_id, episode_id) DO UPDATE SET status=excluded.status, watched_at=excluded.watched_at`,
      [entryId, episodeId, status, status === 'watched' ? nowIso() : null]
    );
  }
  await syncEntryProgress(userId, entry, episode, status);
  await logHistory(userId, entry.media_id, entryId, 'episode', {
    season: episode.season_number,
    episode: episode.episode_number,
    status,
  });
  return getEntry(userId, entryId);
}

/** Mark every episode up to (and including) the given one as watched. */
async function markUpTo(userId, entryId, episodeId) {
  const entry = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const target = await db.get('SELECT * FROM episodes WHERE id = ? AND media_id = ?', [episodeId, entry.media_id]);
  if (!target) throw Object.assign(new Error('الحلقة غير موجودة'), { status: 404 });

  const eps = await db.all(
    `SELECT id FROM episodes WHERE media_id = ?
     AND (season_number < ? OR (season_number = ? AND episode_number <= ?))`,
    [entry.media_id, target.season_number, target.season_number, target.episode_number]
  );

  const stmt = `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
     VALUES (?, ?, 'watched', ?)
     ON CONFLICT(entry_id, episode_id) DO UPDATE SET status='watched', watched_at=excluded.watched_at`;
  const stamp = nowIso();
  await db.tx(async (t) => {
    for (const e of eps) {
      // eslint-disable-next-line no-await-in-loop
      await t.run(stmt, [entryId, e.id, stamp]);
    }
  });
  await syncEntryProgress(userId, entry, target, 'watched');
  await logHistory(userId, entry.media_id, entryId, 'episode_bulk', {
    upTo: `S${target.season_number}E${target.episode_number}`,
    count: eps.length,
  });
  return getEntry(userId, entryId);
}

async function setSeasonWatched(userId, entryId, seasonNumber, watched) {
  const entry = await db.get('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?', [userId, entryId]);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const eps = await db.all('SELECT id FROM episodes WHERE media_id = ? AND season_number = ?', [
    entry.media_id,
    seasonNumber,
  ]);
  const stamp = nowIso();
  await db.tx(async (t) => {
    for (const e of eps) {
      if (watched) {
        // eslint-disable-next-line no-await-in-loop
        await t.run(
          `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
           VALUES (?, ?, 'watched', ?)
           ON CONFLICT(entry_id, episode_id) DO UPDATE SET status='watched', watched_at=excluded.watched_at`,
          [entryId, e.id, stamp]
        );
      } else {
        // eslint-disable-next-line no-await-in-loop
        await t.run('DELETE FROM watch_progress WHERE entry_id = ? AND episode_id = ?', [entryId, e.id]);
      }
    }
  });
  await syncEntryProgress(
    userId,
    entry,
    { season_number: seasonNumber, episode_number: 0 },
    watched ? 'watched' : 'not_watched'
  );
  return getEntry(userId, entryId);
}

/** Keep entry.status / current episode / dates consistent with episode progress. */
async function syncEntryProgress(userId, entry, episode, status) {
  const p = await progressFor(entry.id, entry.media_id);
  const patch = {};
  if (status === 'watched') {
    patch.last_watched_at = nowIso();
    patch.current_season = episode.season_number;
    patch.current_episode = episode.episode_number;
  }
  let nextStatus = entry.status;
  if (p.totalEpisodes > 0) {
    if (p.watchedEpisodes === 0 && ['watching', 'watched'].includes(entry.status)) {
      nextStatus = 'want_to_watch';
    } else if (p.watchedEpisodes > 0 && p.watchedEpisodes < p.totalEpisodes) {
      if (['want_to_watch', 'watched'].includes(entry.status)) nextStatus = 'watching';
    } else if (p.watchedEpisodes === p.totalEpisodes) {
      if (entry.status !== 'rewatching') nextStatus = 'watched';
    }
  }
  patch.status = nextStatus;
  if (nextStatus === 'watched' && !entry.date_finished) patch.date_finished = nowIso().slice(0, 10);
  if (['watching', 'rewatching'].includes(nextStatus) && !entry.date_started) {
    patch.date_started = nowIso().slice(0, 10);
  }

  const sets = Object.keys(patch).map((k) => `${k} = @${k}`);
  await db.run(`UPDATE personal_entries SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`, {
    ...patch,
    id: entry.id,
  });
}

async function episodesWithProgress(entryId, mediaId, season) {
  const base = `SELECT e.*, wp.status AS personal_status, wp.watched_at
     FROM episodes e LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = ?
     WHERE e.media_id = ?`;
  const rows = season
    ? await db.all(`${base} AND e.season_number = ? ORDER BY e.episode_number`, [entryId || 0, mediaId, season])
    : await db.all(`${base} ORDER BY e.season_number, e.episode_number`, [entryId || 0, mediaId]);
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
    personalStatus: e.personal_status || 'not_watched',
    watchedAt: e.watched_at,
  }));
}

// ------------------------------------------------------------- queries

const SORTS = {
  recently_added: 'pe.created_at DESC',
  recently_watched: "COALESCE(pe.last_watched_at, pe.date_finished, pe.updated_at) DESC",
  updated: 'pe.updated_at DESC',
  rating_desc: 'pe.rating DESC NULLS LAST',
  rating_asc: 'pe.rating ASC NULLS LAST',
  year_desc: 'm.release_year DESC NULLS LAST',
  year_asc: 'm.release_year ASC NULLS LAST',
  title: 'm.title COLLATE NOCASE ASC',
};

async function listEntries(userId, filters = {}) {
  const where = ['pe.user_id = @userId'];
  const params = { userId };

  if (filters.status && filters.status !== 'all') {
    where.push('pe.status = @status');
    params.status = filters.status;
  }
  if (filters.type && filters.type !== 'all') {
    where.push('m.media_type = @type');
    params.type = filters.type;
  }
  if (filters.favorite === true) where.push('pe.is_favorite = 1');
  if (filters.quality) {
    where.push('pe.quality = @quality');
    params.quality = filters.quality;
  }
  if (filters.year) {
    where.push('m.release_year = @year');
    params.year = Number(filters.year);
  }
  if (filters.minRating != null) {
    where.push('pe.rating >= @minRating');
    params.minRating = filters.minRating;
  }
  if (filters.genre) {
    where.push("m.genres LIKE '%' || @genre || '%'");
    params.genre = filters.genre;
  }
  if (filters.tagId) {
    where.push('EXISTS (SELECT 1 FROM entry_tags et WHERE et.entry_id = pe.id AND et.tag_id = @tagId)');
    params.tagId = Number(filters.tagId);
  }
  if (filters.q) {
    where.push('(m.title LIKE @like OR m.original_title LIKE @like OR pe.notes LIKE @like)');
    params.like = `%${filters.q}%`;
  }

  const order = SORTS[filters.sort] || SORTS.recently_added;
  const limit = Math.min(Number(filters.limit) || 200, 500);

  const rows = await db.all(
    `SELECT pe.* FROM personal_entries pe
     JOIN media m ON m.id = pe.media_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}
     LIMIT ${limit}`,
    params
  );
  return shapeEntries(rows);
}

async function history(userId, limit = 60) {
  const rows = await db.all(
    `SELECT h.*, m.title, m.poster_url, m.media_type
     FROM viewing_history h LEFT JOIN media m ON m.id = h.media_id
     WHERE h.user_id = ? ORDER BY h.created_at DESC, h.id DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    details: JSON.parse(r.details || '{}'),
    createdAt: r.created_at,
    mediaId: r.media_id,
    mediaTitle: r.title,
    posterUrl: r.poster_url,
    mediaType: r.media_type,
  }));
}

// ------------------------------------------------------------- tags

async function listTags(userId) {
  const rows = await db.all(
    `SELECT t.*, (SELECT COUNT(*) FROM entry_tags et WHERE et.tag_id = t.id) AS usage_count
     FROM tags t WHERE t.user_id = ? ORDER BY usage_count DESC, t.name`,
    [userId]
  );
  return rows.map((t) => ({ id: t.id, name: t.name, color: t.color, usageCount: t.usage_count }));
}

async function createTag(userId, name, color) {
  const info = await db.run('INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)', [
    userId,
    name,
    color || '#c9a227',
  ]);
  if (!info.changes) {
    return db.get('SELECT * FROM tags WHERE user_id = ? AND name = ?', [userId, name]);
  }
  return db.get('SELECT * FROM tags WHERE id = ?', [info.lastInsertRowid]);
}

async function deleteTag(userId, tagId) {
  const res = await db.run('DELETE FROM tags WHERE user_id = ? AND id = ?', [userId, tagId]);
  return res.changes > 0;
}

module.exports = {
  shapeEntry,
  shapeEntries,
  getEntry,
  getEntryByMedia,
  upsertEntry,
  deleteEntry,
  incrementRewatch,
  setEpisodeStatus,
  markUpTo,
  setSeasonWatched,
  episodesWithProgress,
  listEntries,
  history,
  listTags,
  createTag,
  deleteTag,
  setEntryTags,
  progressFor,
  logHistory,
};
