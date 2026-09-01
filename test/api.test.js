'use strict';

/**
 * End-to-end API tests against a temporary SQLite file.
 * Run: npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const tmpDb = path.join(os.tmpdir(), `mummy-test-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = tmpDb;
process.env.ALLOW_OFFLINE_CATALOG = 'true';
process.env.TMDB_API_KEY = '';

const app = require('../server/index');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server?.close();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tmpDb + suffix);
    } catch {
      /* ignore */
    }
  }
});

const call = async (path, options = {}) => {
  const res = await fetch(base + path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
};

test('health endpoint reports ok', async () => {
  const { status, json } = await call('/api/health');
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test('search returns normalized cards and degrades gracefully', async () => {
  const { status, json } = await call('/api/discover/search?q=interstellar');
  assert.equal(status, 200);
  assert.ok(json.results.length > 0);
  const first = json.results[0];
  for (const field of ['key', 'source', 'sourceId', 'mediaType', 'title']) {
    assert.ok(field in first, `missing ${field}`);
  }
});

test('very short queries return no results instead of erroring, empty queries are rejected', async () => {
  const short = await call('/api/discover/search?q=a');
  assert.equal(short.status, 200);
  assert.deepEqual(short.json.results, []);

  const empty = await call('/api/discover/search?q=');
  assert.equal(empty.status, 400);
});

test('details + add to library + duplicate prevention', async () => {
  const search = await call('/api/discover/search?q=interstellar');
  const item = search.json.results[0];
  const details = await call(`/api/discover/media/${item.source}/${item.sourceType}/${item.sourceId}`);
  assert.equal(details.status, 200);
  const mediaId = details.json.media.id;
  assert.ok(details.json.media.cast.length > 0);

  const add = await call('/api/library', {
    method: 'POST',
    body: { internalId: mediaId, status: 'watched', rating: 9.5, quality: '4K HDR', isFavorite: true, notes: 'رائع' },
  });
  assert.equal(add.status, 201);
  assert.equal(add.json.entry.rating, 9.5);

  // adding the same title again updates instead of duplicating
  const again = await call('/api/library', {
    method: 'POST',
    body: { source: item.source, sourceType: item.sourceType, sourceId: String(item.sourceId), rating: 8.75 },
  });
  assert.equal(again.status, 200);
  assert.equal(again.json.created, false);

  const list = await call('/api/library');
  const matching = list.json.entries.filter((e) => e.mediaId === mediaId);
  assert.equal(matching.length, 1, 'no duplicate personal entries');
  assert.equal(matching[0].rating, 8.75);
  assert.equal(matching[0].quality, '4K HDR', 'unspecified fields are preserved');
});

test('personal rating must use 0.25 increments and stay within 0..10', async () => {
  const list = await call('/api/library');
  const entryId = list.json.entries[0].id;

  const bad = await call(`/api/library/${entryId}`, { method: 'PATCH', body: { rating: 9.3 } });
  assert.equal(bad.status, 400);

  const tooHigh = await call(`/api/library/${entryId}`, { method: 'PATCH', body: { rating: 11 } });
  assert.equal(tooHigh.status, 400);

  const good = await call(`/api/library/${entryId}`, { method: 'PATCH', body: { rating: 7.25 } });
  assert.equal(good.status, 200);
  assert.equal(good.json.entry.rating, 7.25);
});

test('notes are sanitized (no HTML injection stored)', async () => {
  const list = await call('/api/library');
  const entryId = list.json.entries[0].id;
  const res = await call(`/api/library/${entryId}`, {
    method: 'PATCH',
    body: { notes: '<script>alert(1)</script>ملاحظة' },
  });
  assert.equal(res.status, 200);
  assert.ok(!res.json.entry.notes.includes('<script>'));
});

test('invalid status is rejected', async () => {
  const list = await call('/api/library');
  const entryId = list.json.entries[0].id;
  const res = await call(`/api/library/${entryId}`, { method: 'PATCH', body: { status: 'pirated' } });
  assert.equal(res.status, 400);
});

test('episode tracking computes progress and next episode', async () => {
  const search = await call('/api/discover/search?q=breaking bad');
  const item = search.json.results[0];
  const details = await call(`/api/discover/media/${item.source}/${item.sourceType}/${item.sourceId}`);
  const mediaId = details.json.media.id;

  const added = await call('/api/library', { method: 'POST', body: { internalId: mediaId, status: 'want_to_watch' } });
  const entryId = added.json.entry.id;

  const eps = await call(`/api/discover/internal/${mediaId}/episodes`);
  assert.ok(eps.json.episodes.length > 0);
  const target = eps.json.episodes[4];

  const marked = await call(`/api/library/${entryId}/episodes/${target.id}/up-to`, { method: 'POST' });
  assert.equal(marked.status, 200);
  assert.equal(marked.json.entry.progress.watchedEpisodes, 5);
  assert.equal(marked.json.entry.status, 'watching', 'status auto-advances to watching');
  assert.equal(marked.json.entry.progress.nextEpisode.episodeNumber, 6);

  const single = await call(`/api/library/${entryId}/episodes/${target.id}`, {
    method: 'POST',
    body: { status: 'not_watched' },
  });
  assert.equal(single.json.entry.progress.watchedEpisodes, 4);

  const season = await call(`/api/library/${entryId}/seasons/1`, { method: 'POST', body: { watched: true } });
  assert.ok(season.json.entry.progress.watchedEpisodes >= 7);
});

test('stats reflect the library', async () => {
  const { json } = await call('/api/stats');
  assert.ok(json.totals.total >= 2);
  assert.ok(json.totals.episodesWatched > 0);
  assert.ok(Array.isArray(json.byGenre));
});

test('home rows and profile respond', async () => {
  const home = await call('/api/home');
  assert.ok(home.json.rows.recentlyAdded.length >= 2);
  const profile = await call('/api/profile');
  assert.equal(profile.status, 200);
  assert.ok(profile.json.profile.displayName);
});

test('tags can be created, used and deleted', async () => {
  const created = await call('/api/tags', { method: 'POST', body: { name: 'اختبار', color: '#ff0000' } });
  assert.equal(created.status, 201);
  const tagId = created.json.tag.id;

  const list = await call('/api/library');
  const entryId = list.json.entries[0].id;
  const patched = await call(`/api/library/${entryId}`, { method: 'PATCH', body: { tagIds: [tagId] } });
  assert.equal(patched.json.entry.tags.length, 1);

  const removed = await call(`/api/tags/${tagId}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
});

test('viewing history is recorded', async () => {
  const { json } = await call('/api/history');
  assert.ok(json.history.length > 0);
  assert.ok(json.history.every((h) => typeof h.action === 'string'));
});

test('deleting an entry removes only personal data, media mirror stays', async () => {
  const before = await call('/api/health');
  const list = await call('/api/library');
  const entry = list.json.entries[0];
  const del = await call(`/api/library/${entry.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  const after = await call('/api/health');
  assert.equal(after.json.counts.media, before.json.counts.media);
  assert.equal(after.json.counts.entries, before.json.counts.entries - 1);
});

test('unknown routes return a JSON 404', async () => {
  const { status, json } = await call('/api/nope');
  assert.equal(status, 404);
  assert.ok(json.error);
});

test('no video/stream/download surface exists in the API', async () => {
  const forbidden = ['/api/stream', '/api/watch', '/api/download', '/api/upload'];
  for (const route of forbidden) {
    const res = await call(route);
    assert.equal(res.status, 404, `${route} must not exist`);
  }
});
