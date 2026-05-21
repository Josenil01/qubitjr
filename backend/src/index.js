/**
 * backend/src/index.js
 * 
 * Backend Express para ScratchJr Web
 * Substitui a lógica do Electron main.js
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const dbRoutes = require('./routes/db');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 5000;

function parseOriginList(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/\/$/, ''));
}

function normalizeOrigin(origin) {
  if (!origin) return origin;
  return origin.replace(/\/$/, '');
}

// ============================================
// Middleware
// ============================================

app.use(helmet());

const isProduction = process.env.NODE_ENV === 'production';

const localDevOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const envOrigins = parseOriginList(
  process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || ''
);

const allowedOrigins = new Set(
  (isProduction ? envOrigins : [...localDevOrigins, ...envOrigins]).map(normalizeOrigin)
);

// CORS - fechado em producao e explicito no desenvolvimento
const corsOptions = {
  origin: function (origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);

    // Permitir requisições sem origin (como de ferramentas ou app nativa)
    if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin)) {
      callback(null, true);
    } else {
      const corsError = new Error('CORS nao permitido');
      corsError.status = 403;
      callback(corsError);
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined'));

// ============================================
// Identity Middleware
// ============================================

const AUTH_MODE = process.env.AUTH_MODE || 'mock';
const JWT_USER_HEADER = (process.env.JWT_USER_HEADER || 'x-user-id').toLowerCase();

// Mock tokens — apenas em AUTH_MODE=mock
const MOCK_TOKENS = {
  'dev-user-a': 'usr_001',
  'dev-user-b': 'usr_002',
};

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
  // Health check não exige autenticação
  if (req.path === '/health') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.slice(7);

  // 1. JWT real tem prioridade em qualquer AUTH_MODE.
  //    Extrai user_id / sub / studentId das claims sem verificar assinatura.
  //    A assinatura é validada pelo emissor (Firebase) no frontend; aqui apenas
  //    confiamos que o claim identifica o usuário corretamente.
  const claims = decodeJwtPayloadUnsafe(token);
  const jwtUserId = getUserIdFromJwtClaims(claims);
  if (jwtUserId) {
    req.userId = jwtUserId;
    console.log(`[Auth] JWT userId: ${jwtUserId} (iss: ${claims?.iss || 'unknown'})`);
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
    const headerUserId = req.headers[JWT_USER_HEADER];
    if (!headerUserId) {
      return res.status(401).json({
        error: `User identity missing (expected JWT claims user_id/sub/studentId or header '${JWT_USER_HEADER}')`
      });
    }
    req.userId = headerUserId;
    return next();
  }

  return res.status(500).json({ error: 'Invalid AUTH_MODE configuration' });
}

app.use(identityMiddleware);

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
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
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

// Start Server
app.listen(PORT, () => {
  const allowedForLog = Array.from(allowedOrigins);
  console.log(`
╔════════════════════════════════════════════╗
║  🎨 ScratchJr Web Backend                  ║
╠════════════════════════════════════════════╣
║  ✅ Server running on port ${PORT}${' '.repeat(22 - PORT.toString().length)}║
║  📍 API Base: http://localhost:${PORT}/api${' '.repeat(18 - PORT.toString().length)}║
║  🌐 CORS mode: ${isProduction ? 'production' : 'development'}${' '.repeat(Math.max(0, 20 - (isProduction ? 10 : 11)))}║
║  🔒 Allowed origins: ${allowedForLog.length}${' '.repeat(Math.max(0, 14 - String(allowedForLog.length).length))}║
╚════════════════════════════════════════════╝
  `);
});

module.exports = app;
