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
