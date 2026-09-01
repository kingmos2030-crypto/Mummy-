'use strict';

const { db } = require('../db');

const now = () => Date.now();
const toIso = (ms) => new Date(ms).toISOString();

const getStmt = db.prepare('SELECT * FROM api_cache WHERE cache_key = ?');
const setStmt = db.prepare(`
  INSERT INTO api_cache (cache_key, source, payload, ok, created_at, expires_at)
  VALUES (@key, @source, @payload, @ok, @created_at, @expires_at)
  ON CONFLICT(cache_key) DO UPDATE SET
    payload = excluded.payload,
    ok = excluded.ok,
    source = excluded.source,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at
`);

/** Read a cache row even if expired (used for stale-if-error). */
function readRaw(key) {
  const row = getStmt.get(key);
  if (!row) return null;
  let payload;
  try {
    payload = JSON.parse(row.payload);
  } catch {
    return null;
  }
  return {
    payload,
    ok: !!row.ok,
    expired: new Date(row.expires_at).getTime() <= now(),
    createdAt: row.created_at,
  };
}

function write(key, source, payload, ttlMs, ok = true) {
  setStmt.run({
    key,
    source,
    payload: JSON.stringify(payload ?? null),
    ok: ok ? 1 : 0,
    created_at: toIso(now()),
    expires_at: toIso(now() + Math.max(1000, ttlMs)),
  });
}

/**
 * Cache-aside helper with stale-if-error semantics:
 *  - fresh hit  -> return cached value
 *  - miss/stale -> call loader, cache result
 *  - loader throws & stale copy exists -> serve the stale copy (degraded)
 */
async function remember(key, source, ttlMs, loader, { negativeTtlMs = 60_000 } = {}) {
  const cached = readRaw(key);
  if (cached && cached.ok && !cached.expired) {
    return { value: cached.payload, cached: true, stale: false };
  }
  try {
    const value = await loader();
    write(key, source, value, ttlMs, true);
    return { value, cached: false, stale: false };
  } catch (error) {
    if (cached && cached.ok) {
      return { value: cached.payload, cached: true, stale: true, error };
    }
    // remember the failure briefly so we don't hammer a dead endpoint
    write(key, source, null, negativeTtlMs, false);
    throw error;
  }
}

function purgeExpired() {
  db.prepare("DELETE FROM api_cache WHERE expires_at < datetime('now', '-7 days')").run();
}

function stats() {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN expires_at > datetime('now') THEN 1 ELSE 0 END) AS fresh
       FROM api_cache`
    )
    .get();
  return { total: row.total || 0, fresh: row.fresh || 0 };
}

module.exports = { remember, readRaw, write, purgeExpired, stats };
