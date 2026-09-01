'use strict';

const express = require('express');
const discovery = require('../services/discovery');
const library = require('../services/library');
const {
  validate,
  addToLibrarySchema,
  entryPatchSchema,
  episodeStatusSchema,
} = require('../lib/validation');

const router = express.Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const boolQuery = (v) => (v === 'true' || v === '1' ? true : undefined);

router.get('/', wrap(async (req, res) => {
  const entries = await library.listEntries(req.user.id, {
    status: req.query.status,
    type: req.query.type,
    favorite: boolQuery(req.query.favorite),
    quality: req.query.quality,
    genre: req.query.genre,
    year: req.query.year,
    tagId: req.query.tagId,
    minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
    q: req.query.q,
    sort: req.query.sort,
    limit: req.query.limit,
  });
  res.json({ entries, count: entries.length });
}));

/** Add (or update) a title in my library — accepts an external reference. */
router.post('/', wrap(async (req, res) => {
  const payload = validate(addToLibrarySchema, req.body || {});
  const { internalId, source, sourceType, sourceId, ...patch } = payload;
  if (!internalId && !(source && sourceId)) {
    const err = new Error('يجب تحديد العمل عبر internalId أو (source + sourceId)');
    err.status = 400;
    throw err;
  }
  const media = await discovery.ensureMedia({
    internalId,
    source,
    sourceType: sourceType || (source === 'jikan' ? 'anime' : 'tv'),
    sourceId,
  });
  const existed = !!(await library.getEntryByMedia(req.user.id, media.id));
  const entry = await library.upsertEntry(req.user.id, media.id, patch);
  res.status(existed ? 200 : 201).json({ entry, created: !existed, media });
}));

router.get('/:id', wrap(async (req, res) => {
  const entry = await library.getEntry(req.user.id, Number(req.params.id));
  if (!entry) return res.status(404).json({ error: 'السجل غير موجود' });
  res.json({ entry });
}));

router.patch('/:id', wrap(async (req, res) => {
  const patch = validate(entryPatchSchema, req.body || {});
  const existing = await library.getEntry(req.user.id, Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'السجل غير موجود' });
  const entry = await library.upsertEntry(req.user.id, existing.mediaId, patch);
  res.json({ entry });
}));

router.delete('/:id', wrap(async (req, res) => {
  const ok = await library.deleteEntry(req.user.id, Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'السجل غير موجود' });
  res.json({ ok: true });
}));

router.post('/:id/rewatch', wrap(async (req, res) => {
  const delta = Number(req.body?.delta ?? 1);
  const entry = await library.incrementRewatch(
    req.user.id,
    Number(req.params.id),
    Number.isFinite(delta) ? delta : 1
  );
  if (!entry) return res.status(404).json({ error: 'السجل غير موجود' });
  res.json({ entry });
}));

// ---- episode tracking ----
router.post('/:id/episodes/:episodeId', wrap(async (req, res) => {
  const { status } = validate(episodeStatusSchema, req.body || {});
  const entry = await library.setEpisodeStatus(
    req.user.id,
    Number(req.params.id),
    Number(req.params.episodeId),
    status
  );
  res.json({ entry });
}));

router.post('/:id/episodes/:episodeId/up-to', wrap(async (req, res) => {
  const entry = await library.markUpTo(req.user.id, Number(req.params.id), Number(req.params.episodeId));
  res.json({ entry });
}));

router.post('/:id/seasons/:season', wrap(async (req, res) => {
  const watched = req.body?.watched !== false;
  const entry = await library.setSeasonWatched(
    req.user.id,
    Number(req.params.id),
    Number(req.params.season),
    watched
  );
  res.json({ entry });
}));

module.exports = router;
