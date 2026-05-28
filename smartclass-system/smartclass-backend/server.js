// server.js — SmartClass QR API entrypoint
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { ping } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ─── Security & infrastructure ───────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // SPA frontend handles its own CSP
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Tighter rate-limit on auth specifically
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Global, looser limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Health check ────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await ping();
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: 'database unreachable' });
  }
});

// ─── API routes ──────────────────────────────────────────────────────────
const v1 = express.Router();

v1.use('/auth',          authLimiter, require('./routes/auth'));
v1.use(apiLimiter);
v1.use('/users',         require('./routes/users'));
v1.use('/sections',      require('./routes/sections'));
v1.use('/qr',            require('./routes/qr'));
v1.use('/attendance',    require('./routes/attendance'));
v1.use('/grades',        require('./routes/grades'));
v1.use('/excuse-letters',require('./routes/excuse'));
v1.use('/notifications', require('./routes/notifications'));
v1.use('/analytics',     require('./routes/analytics'));
v1.use('/reports',       require('./routes/reports'));

app.use('/api/v1', v1);

// API discovery root
app.get('/api', (req, res) => {
  res.json({
    name: 'SmartClass QR API',
    version: '1.0.0',
    docs: '/api/v1',
    endpoints: [
      'POST   /api/v1/auth/login',
      'GET    /api/v1/auth/me',
      'GET    /api/v1/users',
      'POST   /api/v1/users',
      'GET    /api/v1/sections',
      'GET    /api/v1/sections/:id',
      'POST   /api/v1/sections',
      'POST   /api/v1/qr/issue',
      'POST   /api/v1/qr/issue-batch',
      'GET    /api/v1/qr/me',
      'POST   /api/v1/qr/resolve',
      'POST   /api/v1/attendance/sessions',
      'POST   /api/v1/attendance/scan',
      'GET    /api/v1/attendance/me',
      'GET    /api/v1/grades/me',
      'POST   /api/v1/grades',
      'POST   /api/v1/excuse-letters',
      'PATCH  /api/v1/excuse-letters/:id/review',
      'GET    /api/v1/notifications',
      'GET    /api/v1/analytics/institution',
      'GET    /api/v1/analytics/sections/:sectionId',
      'GET    /api/v1/reports/attendance/sections/:sectionId.pdf',
      'GET    /api/v1/reports/performance/me.pdf',
    ],
  });
});

// ─── Error handling ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Boot ────────────────────────────────────────────────────────────────
(async () => {
  try {
    await ping();
    console.log('✓ Database connected');
  } catch (err) {
    console.warn('⚠ Database unreachable on boot:', err.message);
    console.warn('  The server will start anyway. Fix DB and the API will recover.');
  }
  app.listen(PORT, () => {
    console.log(`\n  SmartClass QR API`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Listening:   http://localhost:${PORT}`);
    console.log(`  API docs:    http://localhost:${PORT}/api`);
    console.log(`  Health:      http://localhost:${PORT}/health\n`);
  });
})();

module.exports = app;
