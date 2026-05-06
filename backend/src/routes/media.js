/**
 * backend/src/routes/media.js
 * 
 * API routes para gerenciar mídia (imagens, sons, etc)
 * Usando Supabase Storage
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Inicializar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_ANON_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const BUCKET_NAME = 'media';

/**
 * GET /api/media/:filename
 * Baixar/obter URL do arquivo de mídia
 */
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    // Validação de segurança: não permitir path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`[Media] GET ${filename}`);

    // Obter URL pública do arquivo
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

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
  try {
    const { filename, data } = req.body;

    if (!filename || !data) {
      return res.status(400).json({ error: 'filename and data are required' });
    }

    // Validação de segurança
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`[Media] POST ${filename}`);

    // Converter base64 para buffer
    const buffer = Buffer.from(data, 'base64');

    // Upload para Supabase Storage
    const { data: uploadData, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        cacheControl: '3600',
        upsert: true // Sobrescrever se existir
      });

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
  try {
    const { filename } = req.params;

    // Validação de segurança
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`[Media] DELETE ${filename}`);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filename]);

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
  try {
    const { limit = 100 } = req.body;

    console.log('[Media] LIST');

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', { limit });

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
