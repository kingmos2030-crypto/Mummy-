'use strict';

/**
 * Vercel serverless entry — the entire Express app runs as one function.
 * All /api/* requests land here (see api/[...all].js and vercel.json).
 *
 * DATABASE_URL (+ DATABASE_AUTH_TOKEN) must point to a remote
 * SQLite-compatible database (Turso) — hosting SQLite on the local
 * filesystem is ephemeral and unsuitable for serverless.
 */

const app = require('../server/index');

module.exports = app;
