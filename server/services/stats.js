'use strict';

const { db } = require('../db');
const library = require('./library');

const round = (n, d = 2) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

function overview(userId) {
  const base = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pe.status = 'watched' THEN 1 ELSE 0 END) AS watched,
        SUM(CASE WHEN pe.status IN ('watching','rewatching') THEN 1 ELSE 0 END) AS watching,
        SUM(CASE WHEN pe.status = 'want_to_watch' THEN 1 ELSE 0 END) AS want,
        SUM(CASE WHEN pe.status = 'paused' THEN 1 ELSE 0 END) AS paused,
        SUM(CASE WHEN pe.status = 'dropped' THEN 1 ELSE 0 END) AS dropped,
        SUM(CASE WHEN pe.is_favorite = 1 THEN 1 ELSE 0 END) AS favorites,
        AVG(pe.rating) AS avg_rating,
        SUM(pe.rewatch_count) AS rewatches
       FROM personal_entries pe WHERE pe.user_id = ?`
    )
    .get(userId);

  const byType = db
    .prepare(
      `SELECT m.media_type AS type, COUNT(*) AS count,
              SUM(CASE WHEN pe.status = 'watched' THEN 1 ELSE 0 END) AS watched
       FROM personal_entries pe JOIN media m ON m.id = pe.media_id
       WHERE pe.user_id = ? GROUP BY m.media_type ORDER BY count DESC`
    )
    .all(userId);

  const byStatus = db
    .prepare(
      `SELECT pe.status, COUNT(*) AS count FROM personal_entries pe
       WHERE pe.user_id = ? GROUP BY pe.status ORDER BY count DESC`
    )
    .all(userId);

  const byQuality = db
    .prepare(
      `SELECT COALESCE(NULLIF(pe.quality,''),'غير محدد') AS quality, COUNT(*) AS count
       FROM personal_entries pe WHERE pe.user_id = ? GROUP BY quality ORDER BY count DESC`
    )
    .all(userId);

  const byYear = db
    .prepare(
      `SELECT m.release_year AS year, COUNT(*) AS count
       FROM personal_entries pe JOIN media m ON m.id = pe.media_id
       WHERE pe.user_id = ? AND m.release_year IS NOT NULL
       GROUP BY m.release_year ORDER BY m.release_year`
    )
    .all(userId);

  const ratingBuckets = db
    .prepare(
      `SELECT CAST(pe.rating AS INTEGER) AS bucket, COUNT(*) AS count
       FROM personal_entries pe WHERE pe.user_id = ? AND pe.rating IS NOT NULL
       GROUP BY bucket ORDER BY bucket`
    )
    .all(userId);

  const episodesWatched = db
    .prepare(
      `SELECT COUNT(*) c FROM watch_progress wp
       JOIN personal_entries pe ON pe.id = wp.entry_id
       WHERE pe.user_id = ? AND wp.status = 'watched'`
    )
    .get(userId).c;

  const minutes = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN m.media_type = 'movie' AND pe.status = 'watched'
                     THEN COALESCE(m.runtime,0) * (1 + pe.rewatch_count) ELSE 0 END), 0) AS movie_minutes
       FROM personal_entries pe JOIN media m ON m.id = pe.media_id WHERE pe.user_id = ?`
    )
    .get(userId).movie_minutes;

  const episodeMinutes = db
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(e.runtime, m.runtime, 24)), 0) AS mins
       FROM watch_progress wp
       JOIN personal_entries pe ON pe.id = wp.entry_id
       JOIN episodes e ON e.id = wp.episode_id
       JOIN media m ON m.id = e.media_id
       WHERE pe.user_id = ? AND wp.status = 'watched'`
    )
    .get(userId).mins;

  // genres (JSON arrays exploded in JS — small dataset, keeps SQL portable)
  const genreRows = db
    .prepare(
      `SELECT m.genres, pe.rating FROM personal_entries pe JOIN media m ON m.id = pe.media_id
       WHERE pe.user_id = ?`
    )
    .all(userId);
  const genreMap = new Map();
  for (const row of genreRows) {
    let list = [];
    try {
      list = JSON.parse(row.genres || '[]');
    } catch {
      list = [];
    }
    for (const g of list) {
      const cur = genreMap.get(g) || { genre: g, count: 0, ratingSum: 0, rated: 0 };
      cur.count += 1;
      if (row.rating != null) {
        cur.ratingSum += row.rating;
        cur.rated += 1;
      }
      genreMap.set(g, cur);
    }
  }
  const byGenre = [...genreMap.values()]
    .map((g) => ({ genre: g.genre, count: g.count, avgRating: g.rated ? round(g.ratingSum / g.rated) : null }))
    .sort((a, b) => b.count - a.count);

  const topRated = library.listEntries(userId, { sort: 'rating_desc', limit: 10 }).filter((e) => e.rating != null);
  const lowestRated = library.listEntries(userId, { sort: 'rating_asc', limit: 10 }).filter((e) => e.rating != null);

  const monthly = db
    .prepare(
      `SELECT substr(COALESCE(pe.date_finished, pe.last_watched_at, pe.updated_at), 1, 7) AS month,
              COUNT(*) AS count
       FROM personal_entries pe
       WHERE pe.user_id = ? AND pe.status = 'watched'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    )
    .all(userId)
    .reverse()
    .filter((r) => r.month);

  return {
    totals: {
      total: base.total || 0,
      watched: base.watched || 0,
      watching: base.watching || 0,
      wantToWatch: base.want || 0,
      paused: base.paused || 0,
      dropped: base.dropped || 0,
      favorites: base.favorites || 0,
      rewatches: base.rewatches || 0,
      episodesWatched,
      averageRating: round(base.avg_rating),
      minutesWatched: Math.round((minutes || 0) + (episodeMinutes || 0)),
    },
    byType,
    byStatus,
    byQuality,
    byYear,
    byGenre,
    ratingBuckets,
    monthly,
    topRated,
    lowestRated,
  };
}

module.exports = { overview };
