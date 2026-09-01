'use strict';

const express = require('express');
const { db } = require('../db');
const library = require('../services/library');
const stats = require('../services/stats');
const discovery = require('../services/discovery');
const cache = require('../lib/cache');
const { validate, profileSchema, tagSchema } = require('../lib/validation');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ------------------------------------------------------------ home rows
router.get('/home', wrap(async (req, res) => {
  const userId = req.user.id;
  const rows = {
    currentlyWatching: library.listEntries(userId, { status: 'watching', sort: 'recently_watched', limit: 20 }),
    rewatching: library.listEntries(userId, { status: 'rewatching', sort: 'recently_watched', limit: 20 }),
    wantToWatch: library.listEntries(userId, { status: 'want_to_watch', sort: 'recently_added', limit: 20 }),
    recentlyWatched: library.listEntries(userId, { status: 'watched', sort: 'recently_watched', limit: 20 }),
    favorites: library.listEntries(userId, { favorite: true, sort: 'rating_desc', limit: 20 }),
    highestRated: library
      .listEntries(userId, { sort: 'rating_desc', limit: 20 })
      .filter((e) => e.rating != null),
    recentlyAdded: library.listEntries(userId, { sort: 'recently_added', limit: 20 }),
  };
  rows.continueWatching = [...rows.currentlyWatching, ...rows.rewatching]
    .filter((e) => e.progress.totalEpisodes > 0 && e.progress.watchedEpisodes < e.progress.totalEpisodes)
    .sort((a, b) => (b.lastWatchedAt || '').localeCompare(a.lastWatchedAt || ''));
  const summary = stats.overview(userId).totals;
  res.json({ rows, summary });
}));

// ------------------------------------------------------------ statistics
router.get('/stats', wrap(async (req, res) => {
  res.json(stats.overview(req.user.id));
}));

// ------------------------------------------------------------ profile
function shapeUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

router.get('/profile', wrap(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const s = stats.overview(req.user.id);
  res.json({
    profile: shapeUser(user),
    stats: s.totals,
    byType: s.byType,
    topGenres: s.byGenre.slice(0, 8),
    recentlyWatched: library.listEntries(req.user.id, { status: 'watched', sort: 'recently_watched', limit: 12 }),
    highestRated: s.topRated.slice(0, 12),
    favorites: library.listEntries(req.user.id, { favorite: true, sort: 'rating_desc', limit: 12 }),
  });
}));

router.patch('/profile', wrap(async (req, res) => {
  const patch = validate(profileSchema, req.body || {});
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  db.prepare(
    `UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    patch.displayName ?? user.display_name,
    patch.bio ?? user.bio,
    patch.avatarUrl ?? user.avatar_url,
    req.user.id
  );
  res.json({ profile: shapeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

// ------------------------------------------------------------ history
router.get('/history', wrap(async (req, res) => {
  res.json({ history: library.history(req.user.id, Math.min(Number(req.query.limit) || 60, 200)) });
}));

// ------------------------------------------------------------ tags
router.get('/tags', wrap(async (req, res) => {
  res.json({ tags: library.listTags(req.user.id) });
}));

router.post('/tags', wrap(async (req, res) => {
  const { name, color } = validate(tagSchema, req.body || {});
  const tag = library.createTag(req.user.id, name, color);
  res.status(201).json({ tag: { id: tag.id, name: tag.name, color: tag.color, usageCount: 0 } });
}));

router.delete('/tags/:id', wrap(async (req, res) => {
  const ok = library.deleteTag(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'الوسم غير موجود' });
  res.json({ ok: true });
}));

// ------------------------------------------------------------ export / import
router.get('/export', wrap(async (req, res) => {
  const entries = library.listEntries(req.user.id, { limit: 500 }).map((e) => ({
    status: e.status,
    rating: e.rating,
    quality: e.quality,
    isFavorite: e.isFavorite,
    notes: e.notes,
    dateStarted: e.dateStarted,
    dateFinished: e.dateFinished,
    rewatchCount: e.rewatchCount,
    tags: e.tags.map((t) => t.name),
    media: {
      title: e.media?.title,
      type: e.media?.mediaType,
      year: e.media?.releaseYear,
      externalIds: e.media?.externalIds,
    },
  }));
  res.setHeader('Content-Disposition', 'attachment; filename="mummy-shaft-library.json"');
  res.json({ exportedAt: new Date().toISOString(), version: 1, entries });
}));

// ------------------------------------------------------------ health
router.get('/health', wrap(async (req, res) => {
  const counts = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM media) AS media,
              (SELECT COUNT(*) FROM personal_entries) AS entries,
              (SELECT COUNT(*) FROM episodes) AS episodes`
    )
    .get();
  res.json({ ok: true, counts, cache: cache.stats(), time: new Date().toISOString() });
}));

// ------------------------------------------------------------ SEO helpers
router.get('/sitemap-data', wrap(async (req, res) => {
  const rows = db.prepare('SELECT id, title, updated_at FROM media ORDER BY updated_at DESC LIMIT 500').all();
  res.json({ media: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at })) });
}));

module.exports = router;
