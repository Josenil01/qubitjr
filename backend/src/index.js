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

// ============================================
// Middleware
// ============================================

app.use(helmet());

// CORS - Permitir múltiplas origens de desenvolvimento
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5000',
      'http://127.0.0.1:5000',
    ];
    
    // Permitir requisições sem origin (como de ferramentas ou app nativa)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS não permitido'));
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
  console.log(`
╔════════════════════════════════════════════╗
║  🎨 ScratchJr Web Backend                  ║
╠════════════════════════════════════════════╣
║  ✅ Server running on port ${PORT}${' '.repeat(22 - PORT.toString().length)}║
║  📍 API Base: http://localhost:${PORT}/api${' '.repeat(18 - PORT.toString().length)}║
║  🌐 CORS enabled for local development     ║
╚════════════════════════════════════════════╝
  `);
});

module.exports = app;
