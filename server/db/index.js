'use strict';

const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/**
 * Schema.
 *
 * Hard separation between:
 *   - EXTERNAL data (media, media_sources, seasons, episodes, api_cache)
 *     => a cached, normalized mirror of TMDB / Jikan / TVmaze. Disposable.
 *   - PERSONAL data (personal_entries, watch_progress, viewing_history,
 *     tags, entry_tags, users) => the only data that is truly mine.
 *
 * No video/stream/download columns exist anywhere by design.
 */
db.exec(`
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
  media_type        TEXT NOT NULL,            -- movie | tv | anime | cartoon | documentary | other
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
  status            TEXT DEFAULT '',          -- Released / Returning Series / Airing ...
  genres            TEXT DEFAULT '[]',        -- JSON string[]
  languages         TEXT DEFAULT '[]',        -- JSON string[]
  countries         TEXT DEFAULT '[]',        -- JSON string[]
  companies         TEXT DEFAULT '[]',        -- JSON string[] (studios / production companies)
  cast_json         TEXT DEFAULT '[]',        -- JSON [{name, character, image, order}]
  crew_json         TEXT DEFAULT '[]',        -- JSON [{name, job, department, image}]
  trailers          TEXT DEFAULT '[]',        -- JSON [{name, site, key, url}] -- official trailer links only
  external_rating   REAL,
  external_votes    INTEGER,
  total_seasons     INTEGER DEFAULT 0,
  total_episodes    INTEGER DEFAULT 0,
  homepage          TEXT DEFAULT '',
  primary_source    TEXT DEFAULT '',          -- tmdb | jikan | tvmaze | offline
  raw_extra         TEXT DEFAULT '{}',        -- JSON, provider specific leftovers
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
  source      TEXT NOT NULL,      -- tmdb | jikan | tvmaze | imdb | offline
  source_type TEXT NOT NULL DEFAULT '',  -- movie | tv | anime
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
       -- watched | watching | want_to_watch | paused | dropped | rewatching
  rating          REAL,             -- 0..10 step 0.25
  quality         TEXT,             -- CAM | SD | 480p | ... | 4K HDR
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
  status      TEXT NOT NULL DEFAULT 'watched', -- watched | watching | not_watched
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
`);

// ---- seed the single local owner profile -------------------------------
function ensureDefaultUser() {
  const existing = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(config.defaultUser.username);
  if (existing) return existing;
  db.prepare(
    `INSERT INTO users (username, display_name, bio, avatar_url)
     VALUES (?, ?, ?, ?)`
  ).run(
    config.defaultUser.username,
    config.defaultUser.displayName,
    'كل ما شاهدته، وكل ما أشاهده، وكل ما أنوي مشاهدته.',
    ''
  );
  return db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(config.defaultUser.username);
}

const defaultUser = ensureDefaultUser();

// default starter tags (customisable / deletable)
const seedTags = [
  ['تحفة فنية', '#c9a227'],
  ['يستحق إعادة المشاهدة', '#8b5cf6'],
  ['طفولة', '#38bdf8'],
  ['مريح', '#34d399'],
  ['مبخوس حقه', '#f472b6'],
];
const insertTag = db.prepare(
  'INSERT OR IGNORE INTO tags (user_id, name, color) VALUES (?, ?, ?)'
);
const tagCount = db
  .prepare('SELECT COUNT(*) AS c FROM tags WHERE user_id = ?')
  .get(defaultUser.id).c;
if (tagCount === 0) {
  for (const [name, color] of seedTags) insertTag.run(defaultUser.id, name, color);
}

module.exports = { db, defaultUser, ensureDefaultUser };
