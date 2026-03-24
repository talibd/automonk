require('./config/env'); // validate env vars first
const path = require('path');
const express = require('express');
const env = require('./config/env');
const logger = require('./utils/logger');
const { ensureBucket, getObject, statObject } = require('./storage/minioClient');

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// ─── CORS (allow dashboard dev server) ───────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = ['http://localhost:5173', env.app_url];
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/clients',   require('./routes/clients'));
app.use('/api/posts',     require('./routes/posts'));
app.use('/api/pipeline',  require('./routes/pipeline'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/nango',     require('./routes/nango'));
app.use('/api/webhooks',  require('./routes/googleSheetWebhook'));
app.use('/auth',          require('./routes/oauth'));
app.use('/connect/token', require('./routes/tokenConnect'));
app.use('/',              require('./routes/publicPages'));

app.get('/media/*path', async (req, res, next) => {
  const objectName = req.params.path;

  try {
    const meta = await statObject(objectName);
    res.setHeader('Content-Type', meta.metaData?.['content-type'] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const stream = await getObject(objectName);
    stream.on('error', next);
    stream.pipe(res);
  } catch (err) {
    if (err.code === 'NoSuchKey' || err.code === 'NotFound') {
      return res.status(404).json({ error: 'Media not found', code: 'MEDIA_NOT_FOUND' });
    }
    return next(err);
  }
});

// ─── Dashboard static files ───────────────────────────────────────────────────
const dashboardDist = path.join(__dirname, '..', 'dashboard', 'dist');
app.use(express.static(dashboardDist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(dashboardDist, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Dashboard not built', code: 'DASHBOARD_NOT_BUILT' });
  });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── 404 / Error handlers ────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  await ensureBucket();
  app.listen(env.port, () => {
    logger.info(`AutoMonk API running on port ${env.port}`, { env: env.node_env });
  });
}

start().catch(err => {
  logger.error('Failed to start app', { error: err.message });
  process.exit(1);
});
