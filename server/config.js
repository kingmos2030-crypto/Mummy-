'use strict';

require('dotenv').config();

const path = require('path');

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),

  /**
   * Database.
   *  - Local dev: an embedded libSQL file (DATABASE_PATH / DATABASE_URL=file:…).
   *  - Vercel/serverless: a remote SQLite-compatible URL over HTTP
   *    (DATABASE_URL=libsql://…|https://… with DATABASE_AUTH_TOKEN).
   *    Turso's free tier is the intended zero-config pairing.
   */
  db: {
    url:
      process.env.DATABASE_URL ||
      process.env.TURSO_DATABASE_URL ||
      '',
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || '',
    path: process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite'),
  },

  // --- external APIs (server side only, never shipped to the browser) ---
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
    accessToken: process.env.TMDB_ACCESS_TOKEN || '',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBase: process.env.TMDB_IMAGE_BASE || 'https://image.tmdb.org/t/p',
    language: process.env.TMDB_LANGUAGE || 'ar-SA',
    fallbackLanguage: 'en-US',
  },
  jikan: {
    baseUrl: process.env.JIKAN_BASE_URL || 'https://api.jikan.moe/v4',
    // Jikan asks for ~3 req/sec, 60/min. We stay well below.
    minIntervalMs: num(process.env.JIKAN_MIN_INTERVAL_MS, 400),
  },
  tvmaze: {
    baseUrl: process.env.TVMAZE_BASE_URL || 'https://api.tvmaze.com',
  },

  http: {
    timeoutMs: num(process.env.EXTERNAL_TIMEOUT_MS, 8000),
    retries: num(process.env.EXTERNAL_RETRIES, 1),
  },

  cache: {
    searchTtlMs: num(process.env.CACHE_SEARCH_TTL_MS, 1000 * 60 * 60 * 6), // 6h
    detailsTtlMs: num(process.env.CACHE_DETAILS_TTL_MS, 1000 * 60 * 60 * 24), // 24h
    trendingTtlMs: num(process.env.CACHE_TRENDING_TTL_MS, 1000 * 60 * 60 * 12), // 12h
    negativeTtlMs: num(process.env.CACHE_NEGATIVE_TTL_MS, 1000 * 60 * 2), // 2m for failures
  },

  // Single-owner mode: everything belongs to this local profile until auth ships.
  defaultUser: {
    username: process.env.OWNER_USERNAME || 'mummy',
    displayName: process.env.OWNER_DISPLAY_NAME || 'Mummy',
  },

  siteUrl: process.env.SITE_URL || '',
  allowOffline: process.env.ALLOW_OFFLINE_CATALOG !== 'false',
};

config.tmdb.enabled = Boolean(config.tmdb.apiKey || config.tmdb.accessToken);

module.exports = config;
