'use strict';

/**
 * Low-level libSQL client facade.
 *
 * One code path, two transports (both via @libsql/client):
 *   - PRODUCTION (Vercel/serverless): a remote SQLite-compatible database
 *     over HTTP — e.g. Turso. Set DATABASE_URL (libsql://… or https://…)
 *     and DATABASE_AUTH_TOKEN.
 *   - LOCAL: an embedded libSQL file (file:./database.sqlite by default).
 *
 * Async surface used by the whole app:
 *   get/all/run(sql, args) — awaiting `ready` (schema + seed) first
 *   tx(fn)                 — serialized write transaction, rollback on throw
 *   exec(sql)              — raw multi-statement, does NOT await `ready`
 *                            (used by the bootstrap itself)
 *   raw.{get,all,run}      — like the above but without awaiting `ready`
 *                            (bootstrap/seed use only)
 */

const path = require('node:path');
const { createClient } = require('@libsql/client');
const config = require('../config');

function resolveUrl() {
  // Explicit remote URL wins (Vercel: DATABASE_URL / TURSO_DATABASE_URL).
  const remote = (config.db.url || '').trim();
  if (remote && !remote.startsWith('file:')) {
    // libsql:// hosts are converted to https:// so the client uses the
    // WebSocket-free HTTP transport (the most serverless-friendly option).
    return remote.replace(/^libsql:\/\//, 'https://');
  }
  const filePath = remote.startsWith('file:') ? remote.slice('file:'.length) : config.db.path;
  // Resolve relative file paths against the repo root (not the cwd), so the
  // database location is deterministic for dev, tests and `npm start`.
  const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '..', '..', filePath);
  return `file:${absolute}`;
}

const url = resolveUrl();
const remote = !url.startsWith('file:');

/**
 * Deferred initialization: never crash at module load time.
 * On serverless (Vercel) a module-load crash happens BEFORE Express exists,
 * so the platform returns an HTML error page instead of JSON. By capturing
 * the failure here and throwing it on first use, the Express error handler
 * gets a chance to answer with a clear JSON error instead.
 */
let client = null;
let initError = null;

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

if (isServerless && !remote) {
  // A file: database on serverless means DATABASE_URL/DATABASE_AUTH_TOKEN are
  // missing/misconfigured — the local filesystem there is read-only/ephemeral.
  initError = new Error(
    'قاعدة البيانات غير مهيأة للنشر: اضبط DATABASE_URL و DATABASE_AUTH_TOKEN (مثال: قاعدة Turso مجانية) ثم أعد النشر. ' +
      'ملف SQLite محلي لا يعمل على استضافة serverless.'
  );
  initError.status = 503;
} else {
  try {
    client = createClient({ url, authToken: remote ? config.db.authToken || undefined : undefined });
  } catch (error) {
    initError = new Error(`تعذر تهيئة الاتصال بقاعدة البيانات: ${error.message}`);
    initError.status = 503;
    initError.cause = error;
  }
}

/** Throws the captured init error (as a controlled 503) or returns the client. */
function requireClient() {
  if (initError) {
    const err = new Error(initError.message);
    err.status = initError.status || 503;
    err.cause = initError.cause;
    throw err;
  }
  return client;
}

function normalizeArgs(args) {
  if (args === undefined || args === null) return [];
  if (Array.isArray(args)) return args;
  if (typeof args === 'object') return args; // named parameters {@key: value}
  return [args];
}

const pick = (args) => normalizeArgs(args.length === 1 ? args[0] : args);
const shapeRun = (result) => ({
  changes: Number(result.rowsAffected ?? 0),
  lastInsertRowid: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
});

// --------------------------------------------------------------- raw

const raw = {
  async all(sql, ...args) {
    const r = await requireClient().execute({ sql, args: pick(args) });
    return r.rows || [];
  },
  async get(sql, ...args) {
    const rows = await raw.all(sql, ...args);
    return rows[0];
  },
  async run(sql, ...args) {
    const r = await requireClient().execute({ sql, args: pick(args) });
    return shapeRun(r);
  },
  async exec(sql) {
    return requireClient().executeMultiple(sql);
  },
};

// ------------------------------------------------------ ready-gated API

const self = {
  // assigned by index.js once the schema + owner user are ensured
  ready: Promise.resolve(true),
  driver: remote ? 'remote' : 'local',
  isRemote: remote,
  url: remote ? url.replace(/\/\/(.*)@/, '//***@') : url,
  /** Non-null when the client could not even be constructed (bad config). */
  initError,

  async all(sql, ...args) {
    await self.ready;
    return raw.all(sql, ...args);
  },
  async get(sql, ...args) {
    await self.ready;
    return raw.get(sql, ...args);
  },
  async run(sql, ...args) {
    await self.ready;
    return raw.run(sql, ...args);
  },
  exec: raw.exec, // schema bootstrap runs before `ready` exists

  /**
   * Serialized write transaction. `fn` receives { get, all, run } bound to a
   * single write transaction; any throw rolls it back. Transactions are
   * chained so the single-user workload stays consistent.
   */
  tx(fn) {
    return enqueueTx(fn);
  },

  async close() {
    try {
      if (client) client.close();
    } catch {
      /* noop */
    }
  },

  raw,
  normalizeArgs,
};

let txChain = Promise.resolve();

function enqueueTx(fn) {
  const job = txChain.then(async () => {
    await self.ready;
    const t = await requireClient().transaction('write');
    const bound = {
      run: async (sql, ...args) => shapeRun(await t.execute({ sql, args: pick(args) })),
      get: async (sql, ...args) => ((await t.execute({ sql, args: pick(args) })).rows || [])[0],
      all: async (sql, ...args) => (await t.execute({ sql, args: pick(args) })).rows || [],
    };
    try {
      const value = await fn(bound);
      await t.commit();
      return value;
    } catch (error) {
      try {
        await t.rollback();
      } catch {
        /* already rolled back */
      }
      throw error;
    }
  });
  txChain = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

module.exports = self;
