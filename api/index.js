const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const dbRoutes = require('../backend/src/routes/db');
const mediaRoutes = require('../backend/src/routes/media');

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get(['/health', '/api/health'], (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: supabaseUrl ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? 'set' : 'MISSING'
    }
  });
});

app.use('/api/db', dbRoutes);
app.use('/api/media', mediaRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
