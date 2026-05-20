/**
 * backend/src/routes/media.js
 * 
 * API routes para gerenciar mídia (imagens, sons, etc)
 * Usando Supabase Storage
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Lazy Supabase client — reads env vars at request time to work in Vercel serverless
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('❌ Supabase env not set. Need SUPABASE_URL and one key (SUPABASE_SERVICE_ROLE_KEY preferred). Available SUPABASE keys:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE')));
    return null;
  }
  _supabase = createClient(url, key);
  return _supabase;
}

const BUCKET_NAME = process.env.SUPABASE_MEDIA_BUCKET || 'media';

async function ensureBucketExists(supabase) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    return { ok: false, error: listError };
  }

  const exists = Array.isArray(buckets) && buckets.some((bucket) => bucket && bucket.name === BUCKET_NAME);
  if (exists) {
    return { ok: true, created: false };
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: 52428800
  });

  if (createError) {
    return { ok: false, error: createError };
  }

  return { ok: true, created: true };
}

/**
 * GET /api/media/:filename
 * Baixar/obter URL do arquivo de mídia
 */
router.get('/:filename', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { filename } = req.params;

    // Validação de segurança: não permitir path traversal
    if (filename.includes('..')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storagePath = `${req.userId}/${filename}`;
    console.log(`[Media] GET ${storagePath}`);

    // Obter URL pública do arquivo
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    if (!data.publicUrl) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      filename,
      url: data.publicUrl
    });
  } catch (err) {
    console.error('Get media error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/media
 * Fazer upload de arquivo de mídia
 * Body: { filename: string, data: base64 }
 */
router.post('/', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { filename, data } = req.body;

    if (!filename || !data) {
      return res.status(400).json({ error: 'filename and data are required' });
    }

    // Validação de segurança: não permitir path traversal
    if (filename.includes('..')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storagePath = `${req.userId}/${filename}`;
    console.log(`[Media] POST ${storagePath}`);

    // Converter base64 para buffer
    const buffer = Buffer.from(data, 'base64');

    // Upload para Supabase Storage (prefixado por userId)
    let { data: uploadData, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        cacheControl: '3600',
        upsert: true
      });

    // If bucket is missing, create it and retry once.
    if (error && /bucket.*not found/i.test(error.message || '')) {
      const ensureResult = await ensureBucketExists(supabase);
      if (!ensureResult.ok) {
        console.error('Bucket ensure error:', ensureResult.error);
        return res.status(500).json({
          error: 'Failed to prepare media bucket',
          message: process.env.NODE_ENV === 'development' ? ensureResult.error.message : undefined
        });
      }

      ({ data: uploadData, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
          cacheControl: '3600',
          upsert: true
        }));
    }

    if (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        error: 'Failed to save file',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    res.json({
      success: true,
      filename,
      size: buffer.length,
      path: uploadData.path,
      url: urlData.publicUrl
    });
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/media/:filename
 * Deletar arquivo de mídia
 */
router.delete('/:filename', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { filename } = req.params;

    // Validação de segurança: não permitir path traversal
    if (filename.includes('..')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const storagePath = `${req.userId}/${filename}`;
    console.log(`[Media] DELETE ${storagePath}`);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.error('Delete error:', error);
      return res.status(500).json({
        error: 'Failed to delete file',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.json({ success: true, filename });
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/media/list
 * Listar arquivos de mídia
 */
router.post('/list', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { limit = 100 } = req.body;

    console.log('[Media] LIST');

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(req.userId, { limit });

    if (error) {
      console.error('List error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({
      success: true,
      files: data || []
    });
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
