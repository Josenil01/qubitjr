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
const { shareRouter, publicRouter } = require('./routes/share');
const teacherRoutes = require('./routes/teacher');
const realtimeRoutes = require('./routes/realtime');
const {
  verifyAndDecode,
  getUserIdFromClaims,
  getTurmaIdFromClaims,
  getPresenceStatusFromClaims,
} = require('./services/identity');

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
  'dev-teacher-a': 'prof_001',
};

// Contexto extra (turma_id, status) que um JWT real traria nas claims —
// simulado aqui pra dev poder testar o fluxo de presença sem a HelloYotta.
// turma-mock-001 bate com o roster mockado em services/helloyotta.js.
const MOCK_CONTEXT = {
  usr_001: { turmaId: 'turma-mock-001', presenceStatus: 'presente' },
  usr_002: { turmaId: 'turma-mock-001', presenceStatus: 'presente' },
  prof_001: { turmaId: 'turma-mock-001', presenceStatus: null },
};

async function identityMiddleware(req, res, next) {
  // Health check não exige autenticação
  if (req.path === '/health') return next();

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.slice(7);
  req.rawToken = token; // repassado como Bearer pra HelloYotta em chamadas server-to-server (ver routes/teacher.js)

  // 1. JWT real tem prioridade em qualquer AUTH_MODE.
  //    Professor: verificado localmente (HMAC). Aluno: verificado remotamente
  //    junto à HelloYotta (chamada de rede — por isso o try/catch: falha de
  //    rede não pode travar/derrubar o processo). Ver services/identity.js.
  let claims;
  try {
    claims = await verifyAndDecode(token);
  } catch (err) {
    return next(err);
  }
  const jwtUserId = getUserIdFromClaims(claims);
  if (jwtUserId) {
    req.userId = jwtUserId;
    req.turmaId = getTurmaIdFromClaims(claims);
    req.presenceStatus = getPresenceStatusFromClaims(claims);
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
    const mockContext = MOCK_CONTEXT[userId] || {};
    req.turmaId = mockContext.turmaId || null;
    req.presenceStatus = mockContext.presenceStatus || null;
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

// Rotas públicas registradas ANTES do identity middleware (sem auth)
app.use('/api/public', publicRouter);

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
app.use('/api/share', shareRouter);
app.use('/api/teacher', teacherRoutes);
app.use('/api/realtime', realtimeRoutes);

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
