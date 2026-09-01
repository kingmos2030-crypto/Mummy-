'use strict';

const express = require('express');
const discovery = require('../services/discovery');
const library = require('../services/library');
const { validate, searchQuerySchema } = require('../lib/validation');
const { QUALITIES, PERSONAL_STATUSES, MEDIA_TYPES } = require('../lib/normalize');
const config = require('../config');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Static option lists so the client never hardcodes divergent values. */
router.get('/options', (req, res) => {
  res.json({
    qualities: QUALITIES,
    statuses: PERSONAL_STATUSES,
    mediaTypes: MEDIA_TYPES,
    providers: {
      tmdb: config.tmdb.enabled,
      jikan: true,
      tvmaze: true,
      offlineFallback: config.allowOffline,
    },
  });
});

router.get('/search', wrap(async (req, res) => {
  const { q, type } = validate(searchQuerySchema, { q: req.query.q ?? '', type: req.query.type || 'all' });
  const result = await discovery.search(q, { type });
  res.set('Cache-Control', 'private, max-age=60');
  res.json({ query: q, type, ...result });
}));

router.get('/trending', wrap(async (req, res) => {
  const data = await discovery.trending();
  res.set('Cache-Control', 'private, max-age=600');
  res.json(data);
}));

/** Full details for an external reference; also returns my personal entry if any. */
router.get('/media/:source/:type/:id', wrap(async (req, res) => {
  const { source, type, id } = req.params;
  const refresh = req.query.refresh === '1';
  const { media, cached, degraded, stale } = await discovery.details(source, type, id, { refresh });
  const entry = library.getEntryByMedia(req.user.id, media.id);
  res.json({ media, entry, meta: { cached, degraded: !!degraded, stale: !!stale } });
}));

/** Internal media id lookup (used after the item is mirrored locally). */
router.get('/internal/:mediaId', wrap(async (req, res) => {
  const media = await discovery.ensureMedia({ internalId: Number(req.params.mediaId) });
  const entry = library.getEntryByMedia(req.user.id, media.id);
  res.json({ media, entry, meta: { cached: true, degraded: false } });
}));

/** Episodes for a mirrored media item, with my personal watch status merged in. */
router.get('/internal/:mediaId/episodes', wrap(async (req, res) => {
  const mediaId = Number(req.params.mediaId);
  const season = req.query.season ? Number(req.query.season) : null;
  await discovery.getEpisodes(mediaId, { season: season || undefined });
  const entry = library.getEntryByMedia(req.user.id, mediaId);
  const episodes = library.episodesWithProgress(entry?.id || 0, mediaId, season || undefined);
  const seasons = [...new Set(episodes.map((e) => e.seasonNumber))].sort((a, b) => a - b);
  res.json({ episodes, seasons, entryId: entry?.id || null });
}));

module.exports = router;
