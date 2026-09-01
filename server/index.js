'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { db, ensureDefaultUser, reloadDefaultUser } = require('./db');
const cache = require('./lib/cache');
const discoverRoutes = require('./routes/discover');
const libraryRoutes = require('./routes/library');
const metaRoutes = require('./routes/meta');

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // the SPA is served by Vite in dev; CSP handled at the host in prod
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '256kb' }));

app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'طلبات كثيرة جدًا، حاول بعد قليل.' },
  })
);

/**
 * Health check — registered BEFORE the user middleware on purpose so it can
 * answer with useful JSON even when the database is unreachable, instead of
 * failing alongside every other route.
 */
app.get('/api/health', async (req, res) => {
  const base = {
    db: db.driver,
    tmdb: config.tmdb.enabled ? 'enabled' : 'disabled',
    time: new Date().toISOString(),
  };
  try {
    await db.ready;
    const counts = await db.get(
      `SELECT (SELECT COUNT(*) FROM media) AS media,
              (SELECT COUNT(*) FROM personal_entries) AS entries,
              (SELECT COUNT(*) FROM episodes) AS episodes`
    );
    res.json({ ok: true, counts, cache: await cache.stats(), ...base });
  } catch (error) {
    res.status(503).json({
      ok: false,
      ...base,
      error: 'قاعدة البيانات غير متاحة',
      details: error.message,
      hint: db.isRemote
        ? 'تحقق من صحة DATABASE_URL و DATABASE_AUTH_TOKEN ثم أعد النشر (Redeploy).'
        : 'على الاستضافة serverless يجب ضبط DATABASE_URL و DATABASE_AUTH_TOKEN (قاعدة Turso مثلًا) — ملف SQLite محلي لا يعمل هناك.',
    });
  }
});

/**
 * Single-owner mode. Everything is scoped to one user row so that adding real
 * authentication later only means replacing this middleware.
 */
app.use(async (req, res, next) => {
  try {
    await db.ready;
    const user = await ensureDefaultUser();
    req.user = { id: user.id, username: user.username };
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/discover', discoverRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api', (req, res, next) => {
  // refresh the cached owner row right after profile edits
  if (req.method === 'PATCH' && req.path === '/profile') {
    res.on('finish', () => {
      if (res.statusCode < 300) reloadDefaultUser().catch(() => {});
    });
  }
  next();
});
app.use('/api', metaRoutes);

// ---------------------------------------------------------------- SEO
function robotsBody(req) {
  const base = config.siteUrl || `${req.protocol}://${req.get('host')}`;
  return `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`;
}

async function sitemapBody(req) {
  const base = config.siteUrl || `${req.protocol}://${req.get('host')}`;
  const staticPaths = ['/', '/search', '/library', '/watchlist', '/stats', '/profile', '/history', '/tags'];
  const media = await db.all('SELECT id, updated_at FROM media ORDER BY updated_at DESC LIMIT 1000');
  const urls = [
    ...staticPaths.map((p) => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`),
    ...media.map(
      (m) => `  <url><loc>${base}/title/${m.id}</loc><lastmod>${new Date(m.updated_at).toISOString()}</lastmod></url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// canonical URLs for self-hosting
app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsBody(req)));
app.get('/sitemap.xml', wrap(async (req, res) => res.type('application/xml').send(await sitemapBody(req))));

// /api aliases used by vercel.json rewrites (the SPA fallback would otherwise
// swallow /robots.txt and /sitemap.xml when deployed as static hosting)
app.get('/api/seo/robots', (req, res) => res.type('text/plain').send(robotsBody(req)));
app.get('/api/seo/sitemap', wrap(async (req, res) => res.type('application/xml').send(await sitemapBody(req))));

// ---------------------------------------------------------------- static SPA (production self-hosting)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: '1h', index: false }));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------------------------------------------------------------- errors
app.use((req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err.message);
  res.status(status).json({
    error: err.message || 'خطأ غير متوقع في الخادم',
    details: err.details || undefined,
  });
});

// periodic cache housekeeping (skipped in serverless where no timer survives)
if (require.main === module) {
  setInterval(() => {
    cache.purgeExpired().catch(() => {});
  }, 60 * 60 * 1000).unref();

  db.ready
    .then(() => {
      app.listen(config.port, '0.0.0.0', () => {
        console.log(`Mummy شافت API on http://0.0.0.0:${config.port}`);
        console.log(
          `DB: ${db.driver === 'remote' ? 'remote (libSQL HTTP)' : `local file (${db.url})`} | ` +
            `TMDB: ${config.tmdb.enabled ? 'enabled' : 'DISABLED (set TMDB_API_KEY)'} | offline fallback: ${config.allowOffline}`
        );
      });
    })
    .catch((error) => {
      console.error('Startup failed: database is not reachable —', error.message);
      process.exit(1);
    });
}

module.exports = app;
