'use strict';

const express = require('express');
const { db } = require('../db');
const library = require('../services/library');
const stats = require('../services/stats');
const { validate, profileSchema, tagSchema } = require('../lib/validation');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const STATUS_FALLBACK = {
  watched: 'watched',
  watching: 'watching',
  want_to_watch: 'want_to_watch',
  paused: 'paused',
  dropped: 'dropped',
  rewatching: 'rewatching',
};

// ------------------------------------------------------------ home rows
router.get('/home', wrap(async (req, res) => {
  const userId = req.user.id;
  const [
    currentlyWatching,
    rewatching,
    wantToWatch,
    recentlyWatched,
    favorites,
    highestRatedAll,
    recentlyAdded,
    summaryAll,
  ] = await Promise.all([
    library.listEntries(userId, { status: 'watching', sort: 'recently_watched', limit: 20 }),
    library.listEntries(userId, { status: 'rewatching', sort: 'recently_watched', limit: 20 }),
    library.listEntries(userId, { status: 'want_to_watch', sort: 'recently_added', limit: 20 }),
    library.listEntries(userId, { status: 'watched', sort: 'recently_watched', limit: 20 }),
    library.listEntries(userId, { favorite: true, sort: 'rating_desc', limit: 20 }),
    library.listEntries(userId, { sort: 'rating_desc', limit: 20 }),
    library.listEntries(userId, { sort: 'recently_added', limit: 20 }),
    stats.overview(userId),
  ]);
  const rows = {
    currentlyWatching,
    rewatching,
    wantToWatch,
    recentlyWatched,
    favorites,
    highestRated: highestRatedAll.filter((e) => e.rating != null),
    recentlyAdded,
  };
  rows.continueWatching = [...rows.currentlyWatching, ...rows.rewatching]
    .filter((e) => e.progress.totalEpisodes > 0 && e.progress.watchedEpisodes < e.progress.totalEpisodes)
    .sort((a, b) => (b.lastWatchedAt || '').localeCompare(a.lastWatchedAt || ''));
  res.json({ rows, summary: summaryAll.totals });
}));

// ------------------------------------------------------------ statistics
router.get('/stats', wrap(async (req, res) => {
  res.json(await stats.overview(req.user.id));
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
  const [user, s, recentlyWatched, favorites] = await Promise.all([
    db.get('SELECT * FROM users WHERE id = ?', [req.user.id]),
    stats.overview(req.user.id),
    library.listEntries(req.user.id, { status: 'watched', sort: 'recently_watched', limit: 12 }),
    library.listEntries(req.user.id, { favorite: true, sort: 'rating_desc', limit: 12 }),
  ]);
  res.json({
    profile: shapeUser(user),
    stats: s.totals,
    byType: s.byType,
    topGenres: s.byGenre.slice(0, 8),
    recentlyWatched,
    highestRated: s.topRated.slice(0, 12),
    favorites,
  });
}));

router.patch('/profile', wrap(async (req, res) => {
  const patch = validate(profileSchema, req.body || {});
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  await db.run(`UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, updated_at = datetime('now') WHERE id = ?`, [
    patch.displayName ?? user.display_name,
    patch.bio ?? user.bio,
    patch.avatarUrl ?? user.avatar_url,
    req.user.id,
  ]);
  res.json({ profile: shapeUser(await db.get('SELECT * FROM users WHERE id = ?', [req.user.id])) });
}));

// ------------------------------------------------------------ history
router.get('/history', wrap(async (req, res) => {
  res.json({ history: await library.history(req.user.id, Math.min(Number(req.query.limit) || 60, 200)) });
}));

// ------------------------------------------------------------ tags
router.get('/tags', wrap(async (req, res) => {
  res.json({ tags: await library.listTags(req.user.id) });
}));

router.post('/tags', wrap(async (req, res) => {
  const { name, color } = validate(tagSchema, req.body || {});
  const tag = await library.createTag(req.user.id, name, color);
  res.status(201).json({ tag: { id: tag.id, name: tag.name, color: tag.color, usageCount: 0 } });
}));

router.delete('/tags/:id', wrap(async (req, res) => {
  const ok = await library.deleteTag(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'الوسم غير موجود' });
  res.json({ ok: true });
}));

// ------------------------------------------------------------ export (JSON / CSV)
function exportRows(entries) {
  return entries.map((e) => ({
    title: e.media?.title || '',
    originalTitle: e.media?.originalTitle || '',
    type: e.media?.mediaType || '',
    year: e.media?.releaseYear ?? '',
    status: e.status,
    myRating: e.rating ?? '',
    quality: e.quality || '',
    favorite: e.isFavorite ? 1 : 0,
    rewatchCount: e.rewatchCount,
    dateStarted: e.dateStarted || '',
    dateFinished: e.dateFinished || '',
    notes: e.notes || '',
    tags: e.tags.map((t) => t.name).join(' | '),
    tmdbId: e.media?.externalIds?.tmdbId ?? '',
    malId: e.media?.externalIds?.malId ?? '',
    tvmazeId: e.media?.externalIds?.tvmazeId ?? '',
    imdbId: e.media?.externalIds?.imdbId ?? '',
  }));
}

const CSV_HEADERS = [
  'title',
  'originalTitle',
  'type',
  'year',
  'status',
  'myRating',
  'quality',
  'favorite',
  'rewatchCount',
  'dateStarted',
  'dateFinished',
  'notes',
  'tags',
  'tmdbId',
  'malId',
  'tvmazeId',
  'imdbId',
];

function toCsv(rows) {
  const esc = (value) => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) lines.push(CSV_HEADERS.map((h) => esc(row[h])).join(','));
  // BOM keeps Excel from mangling Arabic UTF-8 text
  return `﻿${lines.join('\r\n')}`;
}

router.get('/export', wrap(async (req, res) => {
  const entries = await library.listEntries(req.user.id, { limit: 500 });
  const rows = exportRows(entries);
  if ((req.query.format || '').toLowerCase() === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mummy-shaft-library.csv"');
    res.send(toCsv(rows));
    return;
  }
  res.setHeader('Content-Disposition', 'attachment; filename="mummy-shaft-library.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    version: 1,
    entries: entries.map((e) => ({
      status: STATUS_FALLBACK[e.status] || e.status,
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
    })),
  });
}));

// ------------------------------------------------------------ health
// (the real /api/health handler lives in server/index.js, registered before
// the user middleware so it still answers when the database is down)

// ------------------------------------------------------------ SEO helpers
router.get('/sitemap-data', wrap(async (req, res) => {
  const rows = await db.all('SELECT id, title, updated_at FROM media ORDER BY updated_at DESC LIMIT 500');
  res.json({ media: rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updated_at })) });
}));

module.exports = router;
