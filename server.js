const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    source TEXT DEFAULT 'custom',
    title TEXT NOT NULL,
    original_title TEXT,
    media_type TEXT DEFAULT 'Movie',
    status TEXT DEFAULT 'Plan to Watch',
    poster_path TEXT,
    backdrop_path TEXT,
    overview TEXT,
    release_date TEXT,
    vote_average REAL DEFAULT 0,
    genres TEXT,
    rating REAL DEFAULT 0,
    quality TEXT DEFAULT '1080p',
    notes TEXT,
    is_favorite INTEGER DEFAULT 0,
    total_episodes INTEGER DEFAULT 0,
    current_episode INTEGER DEFAULT 0,
    total_seasons INTEGER DEFAULT 1,
    current_season INTEGER DEFAULT 1,
    rewatch_count INTEGER DEFAULT 0,
    date_added TEXT,
    date_started TEXT,
    date_finished TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS history_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id INTEGER,
    action TEXT,
    details TEXT,
    timestamp TEXT,
    FOREIGN KEY(media_id) REFERENCES media_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profile (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Insert default profile if not exists
const checkProfile = db.prepare('SELECT * FROM profile WHERE key = ?');
const insertProfile = db.prepare('INSERT OR IGNORE INTO profile (key, value) VALUES (?, ?)');
insertProfile.run('name', 'Mummy');
insertProfile.run('tagline', 'Everything I watched, everything I’m watching, and everything I want to watch.');
insertProfile.run('avatar', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80');

// API Keys provided
const TMDB_API_KEY = '578620c37e4efabd104ea9aa3d509f28';
const TVMAZE_API_KEY = 'O4dfRGuhWTCAdDaEY3dhk1LyKEJCpCY4'; // Not strictly needed for tvmaze public API, but stored

// Helper for logging history
function logHistory(mediaId, action, details) {
  const stmt = db.prepare('INSERT INTO history_log (media_id, action, details, timestamp) VALUES (?, ?, ?, ?)');
  stmt.run(mediaId, action, details, new Date().toISOString());
}

// Routes

// 1. Get all media items
app.get('/api/media', (req, res) => {
  try {
    const { status, media_type, search, favorite } = req.query;
    let query = 'SELECT * FROM media_items WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (media_type && media_type !== 'All') {
      query += ' AND media_type = ?';
      params.push(media_type);
    }
    if (favorite === 'true') {
      query += ' AND is_favorite = 1';
    }
    if (search) {
      query += ' AND (title LIKE ? OR overview LIKE ? OR genres LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY updated_at DESC, id DESC';
    const items = db.prepare(query).all(...params);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get single media item
app.get('/api/media/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM media_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Media not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Add media item
app.post('/api/media', (req, res) => {
  try {
    const {
      external_id, source, title, original_title, media_type, status,
      poster_path, backdrop_path, overview, release_date, vote_average,
      genres, rating, quality, notes, is_favorite, total_episodes,
      current_episode, total_seasons, current_season, rewatch_count
    } = req.body;

    const now = new Date().toISOString();
    let dateStarted = req.body.date_started || null;
    let dateFinished = req.body.date_finished || null;

    if (status === 'Watching' && !dateStarted) dateStarted = now;
    if (status === 'Completed' && !dateFinished) dateFinished = now;

    const stmt = db.prepare(`
      INSERT INTO media_items (
        external_id, source, title, original_title, media_type, status,
        poster_path, backdrop_path, overview, release_date, vote_average,
        genres, rating, quality, notes, is_favorite, total_episodes,
        current_episode, total_seasons, current_season, rewatch_count,
        date_added, date_started, date_finished, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      external_id || null,
      source || 'custom',
      title || 'Untitled',
      original_title || '',
      media_type || 'Movie',
      status || 'Plan to Watch',
      poster_path || '',
      backdrop_path || '',
      overview || '',
      release_date || '',
      vote_average || 0,
      typeof genres === 'object' ? JSON.stringify(genres) : (genres || ''),
      rating || 0,
      quality || '1080p',
      notes || '',
      is_favorite ? 1 : 0,
      total_episodes || 0,
      current_episode || 0,
      total_seasons || 1,
      current_season || 1,
      rewatch_count || 0,
      now,
      dateStarted,
      dateFinished,
      now
    );

    const newId = result.lastInsertRowid;
    logHistory(newId, 'added', `Added "${title}" to ${status}`);

    const newItem = db.prepare('SELECT * FROM media_items WHERE id = ?').get(newId);
    res.status(201).json(newItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Update media item
app.put('/api/media/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM media_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Media not found' });

    const {
      title, original_title, media_type, status, poster_path, backdrop_path,
      overview, release_date, vote_average, genres, rating, quality, notes,
      is_favorite, total_episodes, current_episode, total_seasons, current_season,
      rewatch_count, date_started, date_finished
    } = req.body;

    const now = new Date().toISOString();
    let newStatus = status !== undefined ? status : existing.status;
    let newStarted = date_started !== undefined ? date_started : existing.date_started;
    let newFinished = date_finished !== undefined ? date_finished : existing.date_finished;

    if (existing.status !== 'Watching' && newStatus === 'Watching' && !newStarted) {
      newStarted = now;
    }
    if (existing.status !== 'Completed' && newStatus === 'Completed' && !newFinished) {
      newFinished = now;
    }

    const stmt = db.prepare(`
      UPDATE media_items SET
        title = COALESCE(?, title),
        original_title = COALESCE(?, original_title),
        media_type = COALESCE(?, media_type),
        status = COALESCE(?, status),
        poster_path = COALESCE(?, poster_path),
        backdrop_path = COALESCE(?, backdrop_path),
        overview = COALESCE(?, overview),
        release_date = COALESCE(?, release_date),
        vote_average = COALESCE(?, vote_average),
        genres = COALESCE(?, genres),
        rating = COALESCE(?, rating),
        quality = COALESCE(?, quality),
        notes = COALESCE(?, notes),
        is_favorite = COALESCE(?, is_favorite),
        total_episodes = COALESCE(?, total_episodes),
        current_episode = COALESCE(?, current_episode),
        total_seasons = COALESCE(?, total_seasons),
        current_season = COALESCE(?, current_season),
        rewatch_count = COALESCE(?, rewatch_count),
        date_started = ?,
        date_finished = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      title, original_title, media_type, newStatus, poster_path, backdrop_path,
      overview, release_date, vote_average,
      typeof genres === 'object' ? JSON.stringify(genres) : genres,
      rating, quality, notes,
      is_favorite !== undefined ? (is_favorite ? 1 : 0) : undefined,
      total_episodes, current_episode, total_seasons, current_season,
      rewatch_count, newStarted, newFinished, now, id
    );

    if (newStatus !== existing.status) {
      logHistory(id, 'status_changed', `Changed status from ${existing.status} to ${newStatus}`);
    } else if (rating !== undefined && rating !== existing.rating) {
      logHistory(id, 'rated', `Rated ${rating}/10`);
    } else if (current_episode !== undefined && current_episode !== existing.current_episode) {
      logHistory(id, 'progress_updated', `Progress updated to S${current_season}E${current_episode}`);
    } else {
      logHistory(id, 'updated', `Updated details for "${title || existing.title}"`);
    }

    const updated = db.prepare('SELECT * FROM media_items WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete media item
app.delete('/api/media/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM media_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Media not found' });

    db.prepare('DELETE FROM history_log WHERE media_id = ?').run(id);
    db.prepare('DELETE FROM media_items WHERE id = ?').run(id);

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. External Search API (TMDB + TVMaze)
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ results: [] });

  try {
    // Search TMDB (Movies & TV)
    const tmdbPromise = axios.get(`https://api.themoviedb.org/3/search/multi`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query
      }
    }).catch(err => ({ data: { results: [] } }));

    // Search TVMaze (TV Shows / Anime / Web Series)
    const tvmazePromise = axios.get(`https://api.tvmaze.com/search/shows`, {
      params: { q: query }
    }).catch(err => ({ data: [] }));

    const [tmdbRes, tvmazeRes] = await Promise.all([tmdbPromise, tvmazePromise]);

    const tmdbResults = (tmdbRes.data.results || []).map(item => ({
      external_id: String(item.id),
      source: 'tmdb',
      title: item.title || item.name || 'Untitled',
      original_title: item.original_title || item.original_name || '',
      media_type: item.media_type === 'movie' ? 'Movie' : (item.media_type === 'tv' ? 'TV Show' : 'Other'),
      poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
      backdrop_path: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : '',
      overview: item.overview || '',
      release_date: item.release_date || item.first_air_date || '',
      vote_average: item.vote_average || 0,
      genres: [] // TMDB multi search returns genre_ids, can map or fetch details if needed
    }));

    const tvmazeResults = (tvmazeRes.data || []).map(entry => {
      const show = entry.show || {};
      let mediaType = 'TV Show';
      const genres = show.genres || [];
      const typeStr = (show.type || '').toLowerCase();
      const summaryGenres = genres.join(' ').toLowerCase();

      if (typeStr.includes('animation') || summaryGenres.includes('anime') || summaryGenres.includes('animation')) {
        mediaType = 'Anime';
      } else if (typeStr.includes('documentary')) {
        mediaType = 'Documentary';
      } else if (typeStr.includes('web')) {
        mediaType = 'Web Series';
      }

      return {
        external_id: String(show.id),
        source: 'tvmaze',
        title: show.name || 'Untitled',
        original_title: show.name || '',
        media_type: mediaType,
        poster_path: show.image ? (show.image.original || show.image.medium) : '',
        backdrop_path: show.image ? (show.image.original || show.image.medium) : '',
        overview: show.summary ? show.summary.replace(/<[^>]*>?/gm, '') : '',
        release_date: show.premiered || '',
        vote_average: show.rating && show.rating.average ? show.rating.average : 0,
        genres: genres,
        total_episodes: show.averageRuntime ? 0 : 0 // can fetch episodes if needed
      };
    });

    // Combine results (avoiding exact title duplicates)
    const combined = [...tmdbResults, ...tvmazeResults];
    res.json({ results: combined });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'External search failed', details: err.message });
  }
});

// 7. Statistics Endpoint
app.get('/api/stats', (req, res) => {
  try {
    const totalItems = db.prepare('SELECT COUNT(*) as count FROM media_items').get().count;
    const completedItems = db.prepare('SELECT COUNT(*) as count FROM media_items WHERE status = ?').get('Completed').count;
    const watchingItems = db.prepare('SELECT COUNT(*) as count FROM media_items WHERE status = ?').get('Watching').count;
    const planItems = db.prepare('SELECT COUNT(*) as count FROM media_items WHERE status = ?').get('Plan to Watch').count;
    const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM media_items WHERE is_favorite = 1').get().count;

    const byType = db.prepare('SELECT media_type, COUNT(*) as count FROM media_items GROUP BY media_type').all();
    const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM media_items GROUP BY status').all();
    const byQuality = db.prepare('SELECT quality, COUNT(*) as count FROM media_items GROUP BY quality').all();
    
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM media_items WHERE rating > 0').get().avg || 0;
    
    // History log
    const recentActivity = db.prepare('SELECT h.*, m.title, m.poster_path FROM history_log h LEFT JOIN media_items m ON h.media_id = m.id ORDER BY h.id DESC LIMIT 20').all();

    res.json({
      totalItems,
      completedItems,
      watchingItems,
      planItems,
      favoriteCount,
      avgRating: Number(avgRating.toFixed(1)),
      byType,
      byStatus,
      byQuality,
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Profile endpoints
app.get('/api/profile', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM profile').all();
    const profile = {};
    rows.forEach(r => profile[r.key] = r.value);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', (req, res) => {
  try {
    const { name, tagline, avatar } = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO profile (key, value) VALUES (?, ?)');
    if (name !== undefined) stmt.run('name', name);
    if (tagline !== undefined) stmt.run('tagline', tagline);
    if (avatar !== undefined) stmt.run('avatar', avatar);

    const rows = db.prepare('SELECT * FROM profile').all();
    const profile = {};
    rows.forEach(r => profile[r.key] = r.value);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Export / Import backup
app.get('/api/backup', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM media_items').all();
    const history = db.prepare('SELECT * FROM history_log').all();
    const profileRows = db.prepare('SELECT * FROM profile').all();
    const profile = {};
    profileRows.forEach(r => profile[r.key] = r.value);

    res.json({
      version: '1.0',
      exported_at: new Date().toISOString(),
      profile,
      media_items: items,
      history_log: history
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/restore', (req, res) => {
  try {
    const { profile, media_items, history_log } = req.body;
    
    db.transaction(() => {
      db.prepare('DELETE FROM history_log').run();
      db.prepare('DELETE FROM media_items').run();
      
      if (profile) {
        const stmt = db.prepare('INSERT OR REPLACE INTO profile (key, value) VALUES (?, ?)');
        for (const [k, v] of Object.entries(profile)) {
          stmt.run(k, v);
        }
      }

      if (media_items && Array.isArray(media_items)) {
        const insertMedia = db.prepare(`
          INSERT INTO media_items (
            id, external_id, source, title, original_title, media_type, status,
            poster_path, backdrop_path, overview, release_date, vote_average,
            genres, rating, quality, notes, is_favorite, total_episodes,
            current_episode, total_seasons, current_season, rewatch_count,
            date_added, date_started, date_finished, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of media_items) {
          insertMedia.run(
            m.id, m.external_id, m.source, m.title, m.original_title, m.media_type, m.status,
            m.poster_path, m.backdrop_path, m.overview, m.release_date, m.vote_average,
            m.genres, m.rating, m.quality, m.notes, m.is_favorite, m.total_episodes,
            m.current_episode, m.total_seasons, m.current_season, m.rewatch_count,
            m.date_added, m.date_started, m.date_finished, m.updated_at
          );
        }
      }

      if (history_log && Array.isArray(history_log)) {
        const insertHistory = db.prepare(`
          INSERT INTO history_log (id, media_id, action, details, timestamp) VALUES (?, ?, ?, ?, ?)
        `);
        for (const h of history_log) {
          insertHistory.run(h.id, h.media_id, h.action, h.details, h.timestamp);
        }
      }
    })();

    res.json({ success: true, message: 'Database restored successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mummy شافت backend running on http://0.0.0.0:${PORT}`);
});
