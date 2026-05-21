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

// Decodifica payload do JWT sem verificar assinatura
// Suficiente para extrair user_id / sub / studentId de tokens Firebase
function decodeJwtPayloadUnsafe(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4 || 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (_) {
    return null;
  }
}

function getUserIdFromJwtClaims(claims) {
  if (!claims || typeof claims !== 'object') return null;
  return claims.user_id || claims.sub || claims.studentId || null;
}

function identityMiddleware(req, res, next) {
  if (req.path === '/health' || req.path === '/api/health') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.slice(7);

  // 1. JWT real tem prioridade em qualquer AUTH_MODE.
  //    Extrai user_id / sub / studentId das claims sem verificar assinatura.
  const claims = decodeJwtPayloadUnsafe(token);
  const jwtUserId = getUserIdFromJwtClaims(claims);
  if (jwtUserId) {
    req.userId = jwtUserId;
    console.log(`[Auth] JWT userId: ${jwtUserId} (iss: ${claims && claims.iss || 'unknown'})`);
    return next();
  }

  // 2. Fallback: mock tokens para desenvolvimento local
  if (AUTH_MODE === 'mock') {
    const userId = MOCK_TOKENS[token];
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token. Expected a JWT or a mock token (dev-user-a / dev-user-b).' });
    }
    req.userId = userId;
    console.log(`[Auth] Mock userId: ${userId}`);
    return next();
  }

  // 3. Fallback production: header injetado por gateway/proxy
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
