/**
 * backend/src/routes/db.js
 * 
 * API routes para acesso ao PostgreSQL via Supabase
 * Substitui o SQLite anterior
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Inicializar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
}

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;
console.log('✅ Supabase conectado:', supabaseUrl);

// ============================================
// Funções auxiliares
// ============================================

/**
 * Converter resultados Supabase para formato similar ao SQLite
 */
function formatResult(data, rowCount) {
  return {
    data: data || [],
    rowCount: rowCount || (data ? data.length : 0)
  };
}

// ============================================
// ROTAS
// ============================================

/**
 * POST /api/db/query
 * Executar SELECT query via PostgreSQL
 */
router.post('/query', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });
  try {
    const { table, filters = {} } = req.body;

    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    console.log(`[DB Query] SELECT from ${table}`, filters);

    // Construir query com filtros
    let query = supabase.from(table).select('*');

    // Aplicar filtros dinâmicos
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return res.status(500).json({
        error: 'Database query failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.json(formatResult(data, count || (data ? data.length : 0)));
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/db/stmt
 * Executar INSERT, UPDATE, DELETE
 * Body: { action: 'insert'|'update'|'delete', table, data, id }
 */
router.post('/stmt', async (req, res) => {
  try {
    const { action, table, data, id } = req.body;

    if (!action || !table) {
      return res.status(400).json({ error: 'Action and table are required' });
    }

    console.log(`[DB Statement] ${action.toUpperCase()} on ${table}`);

    let result;

    switch (action.toLowerCase()) {
      case 'insert':
        result = await supabase.from(table).insert(data).select();
        break;

      case 'update':
        if (!id) {
          return res.status(400).json({ error: 'ID required for update' });
        }
        result = await supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select();
        break;

      case 'delete':
        if (!id) {
          return res.status(400).json({ error: 'ID required for delete' });
        }
        result = await supabase.from(table).delete().eq('id', id);
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: resultData, error } = result;

    if (error) {
      console.error('Statement error:', error);
      return res.status(500).json({
        error: 'Database statement failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.json({
      success: true,
      changes: resultData ? resultData.length : 0,
      data: resultData
    });
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/db/transaction
 * Executar múltiplas statements em transação
 */
router.post('/transaction', async (req, res) => {
  try {
    const { statements } = req.body;

    if (!Array.isArray(statements)) {
      return res.status(400).json({ error: 'statements must be an array' });
    }

    console.log(`[DB Transaction] Executing ${statements.length} statements`);

    // Executar sequencialmente
    const results = [];
    for (const stmt of statements) {
      const { action, table, data, id } = stmt;
      let result;

      switch (action.toLowerCase()) {
        case 'insert':
          result = await supabase.from(table).insert(data).select();
          break;
        case 'update':
          result = await supabase
            .from(table)
            .update(data)
            .eq('id', id)
            .select();
          break;
        case 'delete':
          result = await supabase.from(table).delete().eq('id', id);
          break;
      }

      if (result.error) {
        throw new Error(`Statement failed: ${result.error.message}`);
      }

      results.push({
        action,
        table,
        success: true,
        changes: result.data ? result.data.length : 0
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/db/schema
 * Obter informações do schema
 */
router.get('/schema', async (req, res) => {
  try {
    // Retornar lista de tabelas conhecidas
    res.json({
      tables: {
        projects: 'exists',
        usershapes: 'exists',
        userbkgs: 'exists',
        projectfiles: 'exists',
        media: 'exists'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/db/backup
 * Nota: Supabase handles backups automatically
 */
router.post('/backup', (req, res) => {
  res.json({
    message: 'Supabase handles backups automatically',
    info: 'Check your Supabase dashboard for backup settings'
  });
});

module.exports = router;
