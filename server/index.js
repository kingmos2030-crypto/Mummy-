'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { db, defaultUser } = require('./db');
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
 * Single-owner mode. Everything is scoped to one user row so that adding real
 * authentication later only means replacing this middleware.
 */
app.use((req, res, next) => {
  req.user = { id: defaultUser.id, username: defaultUser.username };
  next();
});

app.use('/api/discover', discoverRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api', metaRoutes);

// ---------------------------------------------------------------- SEO
app.get('/robots.txt', (req, res) => {
  const base = config.siteUrl || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  const base = config.siteUrl || `${req.protocol}://${req.get('host')}`;
  const staticPaths = ['/', '/search', '/library', '/watchlist', '/stats', '/profile', '/history', '/tags'];
  const media = db.prepare('SELECT id, updated_at FROM media ORDER BY updated_at DESC LIMIT 1000').all();
  const urls = [
    ...staticPaths.map((p) => `  <url><loc>${base}${p}</loc><changefreq>weekly</changefreq></url>`),
    ...media.map(
      (m) =>
        `  <url><loc>${base}/title/${m.id}</loc><lastmod>${new Date(m.updated_at).toISOString()}</lastmod></url>`
    ),
  ];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
});

// ---------------------------------------------------------------- static SPA (production)
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

// periodic cache housekeeping
setInterval(() => {
  try {
    cache.purgeExpired();
  } catch {
    /* noop */
  }
}, 60 * 60 * 1000).unref();

if (require.main === module) {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`Mummy شافت API on http://0.0.0.0:${config.port}`);
    console.log(`TMDB: ${config.tmdb.enabled ? 'enabled' : 'DISABLED (set TMDB_API_KEY)'} | offline fallback: ${config.allowOffline}`);
  });
}

module.exports = app;
