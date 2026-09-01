'use strict';

/**
 * Database layer.
 *
 * Hard separation between:
 *   - EXTERNAL data (media, media_sources, seasons, episodes, api_cache)
 *     => a cached, normalized mirror of TMDB / Jikan / TVmaze. Disposable.
 *   - PERSONAL data (personal_entries, watch_progress, viewing_history,
 *     tags, entry_tags, users) => the only data that is truly mine.
 *
 * No video/stream/download columns exist anywhere by design.
 *
 * Transport: @libsql/client — embedded `file:` locally, remote HTTPS (Turso)
 * on Vercel/serverless. Everything is async; the rest of the app awaits it.
 */

const config = require('../config');
const db = require('./client');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  bio           TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  is_public     INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- EXTERNAL METADATA MIRROR ----------
CREATE TABLE IF NOT EXISTS media (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type        TEXT NOT NULL,
  title             TEXT NOT NULL,
  original_title    TEXT DEFAULT '',
  release_date      TEXT,
  release_year      INTEGER,
  end_year          INTEGER,
  overview          TEXT DEFAULT '',
  tagline           TEXT DEFAULT '',
  poster_url        TEXT,
  backdrop_url      TEXT,
  runtime           INTEGER,
  status            TEXT DEFAULT '',
  genres            TEXT DEFAULT '[]',
  languages         TEXT DEFAULT '[]',
  countries         TEXT DEFAULT '[]',
  companies         TEXT DEFAULT '[]',
  cast_json         TEXT DEFAULT '[]',
  crew_json         TEXT DEFAULT '[]',
  trailers          TEXT DEFAULT '[]',
  external_rating   REAL,
  external_votes    INTEGER,
  total_seasons     INTEGER DEFAULT 0,
  total_episodes    INTEGER DEFAULT 0,
  homepage          TEXT DEFAULT '',
  primary_source    TEXT DEFAULT '',
  raw_extra         TEXT DEFAULT '{}',
  fetched_at        TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_title ON media(title);

-- one media row can be known by several providers -> duplicate prevention
CREATE TABLE IF NOT EXISTS media_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_id   TEXT NOT NULL,
  url         TEXT DEFAULT '',
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_media_sources_media ON media_sources(media_id);

CREATE TABLE IF NOT EXISTS seasons (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id       INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  season_number  INTEGER NOT NULL,
  name           TEXT DEFAULT '',
  overview       TEXT DEFAULT '',
  air_date       TEXT,
  episode_count  INTEGER DEFAULT 0,
  poster_url     TEXT,
  UNIQUE(media_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id         INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  season_number    INTEGER NOT NULL DEFAULT 1,
  episode_number   INTEGER NOT NULL,
  absolute_number  INTEGER,
  title            TEXT DEFAULT '',
  overview         TEXT DEFAULT '',
  air_date         TEXT,
  runtime          INTEGER,
  image_url        TEXT,
  source           TEXT DEFAULT '',
  UNIQUE(media_id, season_number, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_episodes_media ON episodes(media_id);

-- ---------- PERSONAL DATA ----------
CREATE TABLE IF NOT EXISTS personal_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id        INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'want_to_watch',
  rating          REAL,
  quality         TEXT,
  is_favorite     INTEGER NOT NULL DEFAULT 0,
  notes           TEXT DEFAULT '',
  date_started    TEXT,
  date_finished   TEXT,
  last_watched_at TEXT,
  rewatch_count   INTEGER NOT NULL DEFAULT 0,
  current_season  INTEGER DEFAULT 1,
  current_episode INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_user_status ON personal_entries(user_id, status);

CREATE TABLE IF NOT EXISTS watch_progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id    INTEGER NOT NULL REFERENCES personal_entries(id) ON DELETE CASCADE,
  episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'watched',
  watched_at  TEXT,
  UNIQUE(entry_id, episode_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_entry ON watch_progress(entry_id);

CREATE TABLE IF NOT EXISTS viewing_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id   INTEGER REFERENCES media(id) ON DELETE CASCADE,
  entry_id   INTEGER REFERENCES personal_entries(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  details    TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_history_user ON viewing_history(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#c9a227',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id INTEGER NOT NULL REFERENCES personal_entries(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- ---------- EXTERNAL API RESPONSE CACHE ----------
CREATE TABLE IF NOT EXISTS api_cache (
  cache_key  TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  ok         INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON api_cache(expires_at);

PRAGMA foreign_keys = ON;
`;

// default starter tags (customisable / deletable)
const SEED_TAGS = [
  ['تحفة فنية', '#c9a227'],
  ['يستحق إعادة المشاهدة', '#8b5cf6'],
  ['طفولة', '#38bdf8'],
  ['مريح', '#34d399'],
  ['مبخوس حقه', '#f472b6'],
];

let cachedUser = null;

async function seedOwner() {
  const existing = await db.raw.get('SELECT * FROM users WHERE username = ?', [config.defaultUser.username]);
  if (existing) return existing;
  await db.raw.run(`INSERT INTO users (username, display_name, bio, avatar_url) VALUES (?, ?, ?, ?)`, [
    config.defaultUser.username,
    config.defaultUser.displayName,
    'كل ما شاهدته، وكل ما أشاهده، وكل ما أنوي مشاهدته.',
    '',
  ]);
  const user = await db.raw.get('SELECT * FROM users WHERE username = ?', [config.defaultUser.username]);
  const count = await db.raw.get('SELECT COUNT(*) AS c FROM tags WHERE user_id = ?', [user.id]);
  if ((count?.c || 0) === 0) {
    for (const [name, color] of SEED_TAGS) {
      // eslint-disable-next-line no-await-in-loop
      await db.raw.run('INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)', [
        user.id,
        name,
        color,
      ]);
    }
  }
  return user;
}

// Bootstrap: schema + owner user, once per process. Every facade call awaits it.
db.ready = (async () => {
  try {
    await db.exec(SCHEMA);
    cachedUser = await seedOwner();
    return true;
  } catch (error) {
    console.error('[db] bootstrap failed:', error.message);
    throw error;
  }
})();
// Attach a no-op handler so a misconfigured database surfaces as a controlled
// per-request JSON error (via the Express error handler) instead of an
// unhandled-rejection process crash — which on serverless would produce an
// opaque HTML error page for every route.
db.ready.catch(() => {});

/** The single local owner profile (single-user mode until auth ships). */
async function ensureDefaultUser() {
  await db.ready;
  if (cachedUser) return cachedUser;
  cachedUser = await db.get('SELECT * FROM users WHERE username = ?', [config.defaultUser.username]);
  if (!cachedUser) {
    // extremely defensive: recreate if the row vanished
    cachedUser = await seedOwner();
  }
  return cachedUser;
}

/** Drop the cached owner row (after profile edits). */
async function reloadDefaultUser() {
  cachedUser = null;
  return ensureDefaultUser();
}

module.exports = { db, ensureDefaultUser, reloadDefaultUser };
