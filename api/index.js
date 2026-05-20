const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const dbRoutes = require('../backend/src/routes/db');
const mediaRoutes = require('../backend/src/routes/media');

const app = express();

// ============================================
// CORS
// ============================================

function parseOriginList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
}

const allowedOrigins = new Set(
  parseOriginList(process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
);

app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    // Sem origin (curl, apps nativas) ou origin explicitamente permitida
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    const err = new Error('CORS nao permitido');
    err.status = 403;
    callback(err);
  },
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================
// Identity Middleware
// ============================================

const AUTH_MODE = process.env.AUTH_MODE || 'mock';
const JWT_USER_HEADER = (process.env.JWT_USER_HEADER || 'x-user-id').toLowerCase();

const MOCK_TOKENS = {
  'dev-user-a': 'usr_001',
  'dev-user-b': 'usr_002',
};

function identityMiddleware(req, res, next) {
  if (req.path === '/health' || req.path === '/api/health') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.slice(7);

  if (AUTH_MODE === 'mock') {
    const userId = MOCK_TOKENS[token];
    if (!userId) {
      return res.status(401).json({ error: 'Invalid mock token. Use dev-user-a or dev-user-b' });
    }
    req.userId = userId;
    return next();
  }

  if (AUTH_MODE === 'production') {
    const userId = req.headers[JWT_USER_HEADER];
    if (!userId) {
      return res.status(401).json({ error: `User identity header '${JWT_USER_HEADER}' missing` });
    }
    req.userId = userId;
    return next();
  }

  return res.status(500).json({ error: 'Invalid AUTH_MODE configuration' });
}

app.use(identityMiddleware);

// ============================================
// Health Check
// ============================================

app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    authMode: AUTH_MODE,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
    },
  });
});

// ============================================
// Routes
// ============================================

app.use('/api/db', dbRoutes);
app.use('/api/media', mediaRoutes);

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
