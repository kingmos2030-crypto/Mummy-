'use strict';

const { db } = require('../db');
const discovery = require('./discovery');

const nowIso = () => new Date().toISOString();

function logHistory(userId, mediaId, entryId, action, details = {}) {
  db.prepare(
    'INSERT INTO viewing_history (user_id, media_id, entry_id, action, details) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, mediaId, entryId, action, JSON.stringify(details));
}

// ------------------------------------------------------------- shaping

function progressFor(entryId, mediaId) {
  const total = db.prepare('SELECT COUNT(*) c FROM episodes WHERE media_id = ?').get(mediaId).c;
  const watched = db
    .prepare(
      `SELECT COUNT(*) c FROM watch_progress wp
       JOIN episodes e ON e.id = wp.episode_id
       WHERE wp.entry_id = ? AND wp.status = 'watched'`
    )
    .get(entryId).c;
  const next = db
    .prepare(
      `SELECT e.* FROM episodes e
       LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = ?
       WHERE e.media_id = ? AND (wp.status IS NULL OR wp.status <> 'watched')
       ORDER BY e.season_number, e.episode_number
       LIMIT 1`
    )
    .get(entryId, mediaId);
  return {
    watchedEpisodes: watched,
    totalEpisodes: total,
    percent: total ? Math.round((watched / total) * 1000) / 10 : 0,
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

function tagsFor(entryId) {
  return db
    .prepare(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN entry_tags et ON et.tag_id = t.id
       WHERE et.entry_id = ? ORDER BY t.name`
    )
    .all(entryId);
}

function shapeEntry(row, { withMedia = true } = {}) {
  if (!row) return null;
  const entry = {
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
    tags: tagsFor(row.id),
    progress: progressFor(row.id, row.media_id),
  };
  if (withMedia) {
    const mediaRow = db.prepare('SELECT * FROM media WHERE id = ?').get(row.media_id);
    entry.media = discovery.hydrate(mediaRow);
  }
  return entry;
}

function getEntryByMedia(userId, mediaId) {
  const row = db
    .prepare('SELECT * FROM personal_entries WHERE user_id = ? AND media_id = ?')
    .get(userId, mediaId);
  return row ? shapeEntry(row) : null;
}

function getEntry(userId, entryId) {
  const row = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  return row ? shapeEntry(row) : null;
}

// ------------------------------------------------------------- mutations

/**
 * Create or update the personal entry for a media item.
 * Duplicate prevention is guaranteed by UNIQUE(user_id, media_id) plus the
 * external-id based media dedupe in the discovery layer.
 */
function upsertEntry(userId, mediaId, patch = {}) {
  const existing = db
    .prepare('SELECT * FROM personal_entries WHERE user_id = ? AND media_id = ?')
    .get(userId, mediaId);

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
    db.prepare(
      `UPDATE personal_entries SET
        status=@status, rating=@rating, quality=@quality, is_favorite=@is_favorite, notes=@notes,
        date_started=@date_started, date_finished=@date_finished, last_watched_at=@last_watched_at,
        rewatch_count=@rewatch_count, current_season=@current_season, current_episode=@current_episode,
        updated_at=datetime('now')
       WHERE id=@id`
    ).run({ ...fields, id: existing.id });
    entryId = existing.id;
    logHistory(userId, mediaId, entryId, 'updated', {
      from: existing.status,
      to: fields.status,
      rating: fields.rating,
    });
  } else {
    const info = db
      .prepare(
        `INSERT INTO personal_entries
         (user_id, media_id, status, rating, quality, is_favorite, notes, date_started, date_finished,
          last_watched_at, rewatch_count, current_season, current_episode)
         VALUES (@user_id, @media_id, @status, @rating, @quality, @is_favorite, @notes, @date_started,
                 @date_finished, @last_watched_at, @rewatch_count, @current_season, @current_episode)`
      )
      .run({ ...fields, user_id: userId, media_id: mediaId });
    entryId = info.lastInsertRowid;
    logHistory(userId, mediaId, entryId, 'added', { status: fields.status });
  }

  if (Array.isArray(patch.tagIds)) setEntryTags(userId, entryId, patch.tagIds);

  return getEntry(userId, entryId);
}

function setEntryTags(userId, entryId, tagIds) {
  const valid = db
    .prepare(`SELECT id FROM tags WHERE user_id = ? AND id IN (${tagIds.map(() => '?').join(',') || 'NULL'})`)
    .all(userId, ...tagIds)
    .map((r) => r.id);
  db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(entryId);
  const stmt = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)');
  for (const id of valid) stmt.run(entryId, id);
}

function deleteEntry(userId, entryId) {
  const entry = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  if (!entry) return false;
  db.prepare('DELETE FROM personal_entries WHERE id = ?').run(entryId);
  logHistory(userId, entry.media_id, null, 'removed', {});
  return true;
}

function incrementRewatch(userId, entryId, delta = 1) {
  const entry = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  if (!entry) return null;
  const count = Math.max(0, (entry.rewatch_count || 0) + delta);
  db.prepare(
    "UPDATE personal_entries SET rewatch_count = ?, last_watched_at = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(count, nowIso(), entryId);
  logHistory(userId, entry.media_id, entryId, 'rewatch', { count });
  return getEntry(userId, entryId);
}

// ------------------------------------------------------------- episodes

function setEpisodeStatus(userId, entryId, episodeId, status) {
  const entry = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const episode = db.prepare('SELECT * FROM episodes WHERE id = ? AND media_id = ?').get(episodeId, entry.media_id);
  if (!episode) throw Object.assign(new Error('الحلقة غير موجودة'), { status: 404 });

  if (status === 'not_watched') {
    db.prepare('DELETE FROM watch_progress WHERE entry_id = ? AND episode_id = ?').run(entryId, episodeId);
  } else {
    db.prepare(
      `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entry_id, episode_id) DO UPDATE SET status=excluded.status, watched_at=excluded.watched_at`
    ).run(entryId, episodeId, status, status === 'watched' ? nowIso() : null);
  }
  syncEntryProgress(userId, entry, episode, status);
  logHistory(userId, entry.media_id, entryId, 'episode', {
    season: episode.season_number,
    episode: episode.episode_number,
    status,
  });
  return getEntry(userId, entryId);
}

/** Mark every episode up to (and including) the given one as watched. */
function markUpTo(userId, entryId, episodeId) {
  const entry = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const target = db.prepare('SELECT * FROM episodes WHERE id = ? AND media_id = ?').get(episodeId, entry.media_id);
  if (!target) throw Object.assign(new Error('الحلقة غير موجودة'), { status: 404 });

  const eps = db
    .prepare(
      `SELECT id FROM episodes WHERE media_id = ?
       AND (season_number < ? OR (season_number = ? AND episode_number <= ?))`
    )
    .all(entry.media_id, target.season_number, target.season_number, target.episode_number);

  const stmt = db.prepare(
    `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
     VALUES (?, ?, 'watched', ?)
     ON CONFLICT(entry_id, episode_id) DO UPDATE SET status='watched', watched_at=excluded.watched_at`
  );
  const tx = db.transaction(() => {
    for (const e of eps) stmt.run(entryId, e.id, nowIso());
  });
  tx();
  syncEntryProgress(userId, entry, target, 'watched');
  logHistory(userId, entry.media_id, entryId, 'episode_bulk', {
    upTo: `S${target.season_number}E${target.episode_number}`,
    count: eps.length,
  });
  return getEntry(userId, entryId);
}

function setSeasonWatched(userId, entryId, seasonNumber, watched) {
  const entry = db.prepare('SELECT * FROM personal_entries WHERE user_id = ? AND id = ?').get(userId, entryId);
  if (!entry) throw Object.assign(new Error('لا يوجد سجل شخصي لهذا العمل'), { status: 404 });
  const eps = db
    .prepare('SELECT id FROM episodes WHERE media_id = ? AND season_number = ?')
    .all(entry.media_id, seasonNumber);
  const tx = db.transaction(() => {
    for (const e of eps) {
      if (watched) {
        db.prepare(
          `INSERT INTO watch_progress (entry_id, episode_id, status, watched_at)
           VALUES (?, ?, 'watched', ?)
           ON CONFLICT(entry_id, episode_id) DO UPDATE SET status='watched', watched_at=excluded.watched_at`
        ).run(entryId, e.id, nowIso());
      } else {
        db.prepare('DELETE FROM watch_progress WHERE entry_id = ? AND episode_id = ?').run(entryId, e.id);
      }
    }
  });
  tx();
  syncEntryProgress(userId, entry, { season_number: seasonNumber, episode_number: 0 }, watched ? 'watched' : 'not_watched');
  return getEntry(userId, entryId);
}

/** Keep entry.status / current episode / dates consistent with episode progress. */
function syncEntryProgress(userId, entry, episode, status) {
  const p = progressFor(entry.id, entry.media_id);
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
  db.prepare(
    `UPDATE personal_entries SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = @id`
  ).run({ ...patch, id: entry.id });
}

function episodesWithProgress(entryId, mediaId, season) {
  const rows = season
    ? db
        .prepare(
          `SELECT e.*, wp.status AS personal_status, wp.watched_at
           FROM episodes e LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = ?
           WHERE e.media_id = ? AND e.season_number = ?
           ORDER BY e.episode_number`
        )
        .all(entryId || 0, mediaId, season)
    : db
        .prepare(
          `SELECT e.*, wp.status AS personal_status, wp.watched_at
           FROM episodes e LEFT JOIN watch_progress wp ON wp.episode_id = e.id AND wp.entry_id = ?
           WHERE e.media_id = ?
           ORDER BY e.season_number, e.episode_number`
        )
        .all(entryId || 0, mediaId);
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

function listEntries(userId, filters = {}) {
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

  const rows = db
    .prepare(
      `SELECT pe.* FROM personal_entries pe
       JOIN media m ON m.id = pe.media_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${order}
       LIMIT ${limit}`
    )
    .all(params);
  return rows.map((r) => shapeEntry(r));
}

function history(userId, limit = 60) {
  return db
    .prepare(
      `SELECT h.*, m.title, m.poster_url, m.media_type
       FROM viewing_history h LEFT JOIN media m ON m.id = h.media_id
       WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT ?`
    )
    .all(userId, limit)
    .map((r) => ({
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

function listTags(userId) {
  return db
    .prepare(
      `SELECT t.*, (SELECT COUNT(*) FROM entry_tags et WHERE et.tag_id = t.id) AS usage_count
       FROM tags t WHERE t.user_id = ? ORDER BY usage_count DESC, t.name`
    )
    .all(userId)
    .map((t) => ({ id: t.id, name: t.name, color: t.color, usageCount: t.usage_count }));
}

function createTag(userId, name, color) {
  const info = db
    .prepare('INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)')
    .run(userId, name, color || '#c9a227');
  if (!info.changes) {
    return db.prepare('SELECT * FROM tags WHERE user_id = ? AND name = ?').get(userId, name);
  }
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid);
}

function deleteTag(userId, tagId) {
  return db.prepare('DELETE FROM tags WHERE user_id = ? AND id = ?').run(userId, tagId).changes > 0;
}

module.exports = {
  shapeEntry,
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
