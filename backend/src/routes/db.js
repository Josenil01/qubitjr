/**
 * backend/src/routes/db.js
 *
 * API routes para acesso ao PostgreSQL via Supabase.
 * Aceita o formato legado { sql/stmt, values } enviado pelo frontend ScratchJr
 * e traduz para chamadas Supabase.
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Lazy Supabase client
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Found:', Object.keys(process.env).filter(k => k.startsWith('SUPABASE')));
    return null;
  }
  _supabase = createClient(url, key);
  console.log('✅ Supabase client ready for:', url);
  return _supabase;
}

// ============================================
// Tabelas multi-tenant: owner é obrigatório
// ============================================

const OWNER_TABLES = new Set(['projects', 'usershapes', 'userbkgs']);

// ============================================
// SQL → Supabase translators
// ============================================

/**
 * Translate a SQL SELECT statement into a Supabase query.
 * Handles: WHERE col = ?, WHERE col IS NULL, ORDER BY col [desc]
 * userId: quando fornecido, injeta owner = userId para tabelas multi-tenant.
 */
function buildSelectQuery(supabase, sql, values = [], userId = null) {
  const match = sql.match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+where\s+(.+?))?(?:\s+order\s+by\s+(.+?))?$/i);
  if (!match) throw new Error('Cannot parse SELECT: ' + sql);
  const [, fields, table, whereClause, orderClause] = match;

  let query = supabase.from(table).select(fields.trim() === '*' ? '*' : fields.trim());
  let valIdx = 0;

  if (whereClause) {
    const conditions = whereClause.split(/\s+and\s+/i);
    for (const rawCond of conditions) {
      const cond = rawCond.trim();

      // IS NULL
      const isNullMatch = cond.match(/^(\w+)\s+is\s+null$/i);
      if (isNullMatch) { query = query.is(isNullMatch[1], null); continue; }

      // col = ? | col = 'literal' | col = number
      const eqMatch = cond.match(/^(\w+)\s*=\s*(.+)$/);
      if (eqMatch) {
        const col = eqMatch[1];
        const valExpr = eqMatch[2].trim();
        let val;
        if (valExpr === '?') {
          val = values[valIdx++];
        } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
          val = valExpr.slice(1, -1);
        } else {
          val = valExpr;
        }
        query = query.eq(col, val);
        continue;
      }
    }
  }

  if (orderClause) {
    const parts = orderClause.trim().split(/\s+/);
    query = query.order(parts[0], { ascending: !(parts[1] && parts[1].toLowerCase() === 'desc') });
  }

  // Filtro de owner para tabelas multi-tenant
  if (userId && OWNER_TABLES.has(table)) {
    query = query.eq('owner', userId);
  }

  return query;
}

/**
 * Convert a millisecond-epoch timestamp string to ISO-8601 for Postgres.
 * ScratchJr stores mtime/ctime as 13-digit ms strings; Postgres TIMESTAMP rejects them.
 */
function sanitizeValue(val) {
  if (typeof val === 'string' && /^\d{13}$/.test(val)) {
    return new Date(parseInt(val, 10)).toISOString();
  }
  return val;
}

/**
 * Translate INSERT / UPDATE / DELETE SQL into a Supabase mutation.
 * userId: quando fornecido, injeta/verifica owner para tabelas multi-tenant.
 */
function buildMutationQuery(supabase, sql, values = [], userId = null) {
  const sqlLower = sql.toLowerCase().trim();
  let valIdx = 0;
  const nextVal = () => sanitizeValue(values[valIdx++]);

  // INSERT INTO table (col1,col2,...) VALUES (?,?,...)
  if (sqlLower.startsWith('insert')) {
    const match = sql.match(/^insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (!match) throw new Error('Cannot parse INSERT: ' + sql);
    const [, table, colsStr] = match;
    const data = {};
    colsStr.split(',').map(c => c.trim()).forEach(col => { data[col] = nextVal(); });
    // Forçar owner em tabelas multi-tenant
    if (userId && OWNER_TABLES.has(table)) {
      data.owner = userId;
    }
    return supabase.from(table).insert(data).select();
  }

  // UPDATE table SET col1 = ?, col2 = ? WHERE id = {?|literal}
  if (sqlLower.startsWith('update')) {
    const match = sql.match(/^update\s+(\w+)\s+set\s+(.+?)\s+where\s+id\s*=\s*(\?|\d+)$/i);
    if (!match) throw new Error('Cannot parse UPDATE: ' + sql);
    const [, table, setClause, idExpr] = match;
    const data = {};
    setClause.split(',').forEach(part => {
      const m = part.trim().match(/^(\w+)\s*=\s*\?$/);
      if (m) data[m[1]] = nextVal();
    });
    const id = idExpr === '?' ? nextVal() : parseInt(idExpr);
    // Log UPDATE details for debugging
    const logData = {};
    for (const k of Object.keys(data)) {
      logData[k] = (typeof data[k] === 'string' && data[k].length > 80)
        ? data[k].substring(0, 80) + '...[' + data[k].length + ' chars]'
        : data[k];
    }
    console.log(`[DB UPDATE] table=${table} id=${id} data:`, JSON.stringify(logData));
    // Filtro de owner previne atualização cruzada entre usuários
    let q = supabase.from(table).update(data).eq('id', id);
    if (userId && OWNER_TABLES.has(table)) {
      q = q.eq('owner', userId);
    }
    const result = q.select();
    result.then(({ data: d, error: e }) => {
      if (e) console.error('[DB UPDATE] Supabase error:', e);
      else console.log('[DB UPDATE] Supabase ok, rows updated:', d ? d.length : 0, d && d[0] ? { json: d[0].json ? d[0].json.substring(0,40)+'...' : 'NULL', thumbnail: d[0].thumbnail } : '');
    }).catch(err => console.error('[DB UPDATE] Promise error:', err));
    return result;
  }

  // DELETE FROM table WHERE id = ?
  if (sqlLower.startsWith('delete')) {
    const match = sql.match(/^delete\s+from\s+(\w+)\s+where\s+id\s*=\s*\?/i);
    if (!match) throw new Error('Cannot parse DELETE: ' + sql);
    const table = match[1];
    let q = supabase.from(table).delete().eq('id', nextVal());
    if (userId && OWNER_TABLES.has(table)) {
      q = q.eq('owner', userId);
    }
    return q;
  }

  throw new Error('Unsupported SQL operation: ' + sql);
}

// ============================================
// ROTAS
// ============================================

/**
 * POST /api/db/query
 * SELECT — aceita { sql, values } ou { table, filters }
 */
router.post('/query', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured', hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const { sql, stmt, values = [], table, filters = {} } = req.body;
    const sqlStr = sql || stmt;

    if (sqlStr) {
      console.log(`[DB Query] SQL: ${sqlStr.substring(0, 120)}`, values);
      const { data, error } = await buildSelectQuery(supabase, sqlStr, values, req.userId);
      if (error) { console.error('Query error:', error); return res.status(500).json({ error: 'Query failed', message: error.message }); }
      return res.json({ data: data || [], rowCount: data ? data.length : 0 });
    }

    if (!table) return res.status(400).json({ error: 'Provide sql or table' });

    let query = supabase.from(table).select('*');
    Object.entries(filters).forEach(([k, v]) => { if (v != null) query = query.eq(k, v); });
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Query failed', message: error.message });
    res.json({ data: data || [], rowCount: data ? data.length : 0 });

  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/db/stmt
 * INSERT / UPDATE / DELETE — aceita { sql, values } ou { action, table, data, id }
 */
router.post('/stmt', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured', hint: 'Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' });

  try {
    const { sql, stmt, values = [], action, table, data: reqData, id } = req.body;
    const sqlStr = sql || stmt;

    if (sqlStr) {
      console.log(`[DB Stmt] SQL: ${sqlStr.substring(0, 120)}`);
      const { data, error } = await buildMutationQuery(supabase, sqlStr, values, req.userId);
      if (error) { console.error('Stmt error:', error); return res.status(500).json({ error: 'Statement failed', message: error.message }); }
      return res.json({ success: true, changes: data ? data.length : 1, data });
    }

    if (!action || !table) return res.status(400).json({ error: 'Provide sql, or action+table' });

    let result;
    switch (action.toLowerCase()) {
      case 'insert': {
        const insertData = OWNER_TABLES.has(table) && req.userId
          ? { ...reqData, owner: req.userId }
          : reqData;
        result = await supabase.from(table).insert(insertData).select();
        break;
      }
      case 'update':
        if (!id) return res.status(400).json({ error: 'ID required for update' });
        result = await (OWNER_TABLES.has(table) && req.userId
          ? supabase.from(table).update(reqData).eq('id', id).eq('owner', req.userId)
          : supabase.from(table).update(reqData).eq('id', id)
        ).select();
        break;
      case 'delete':
        if (!id) return res.status(400).json({ error: 'ID required for delete' });
        result = OWNER_TABLES.has(table) && req.userId
          ? await supabase.from(table).delete().eq('id', id).eq('owner', req.userId)
          : await supabase.from(table).delete().eq('id', id);
        break;
      default: return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: resultData, error } = result;
    if (error) return res.status(500).json({ error: 'Statement failed', message: error.message });
    res.json({ success: true, changes: resultData ? resultData.length : 0, data: resultData });

  } catch (err) {
    console.error('Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/db/transaction
 */
router.post('/transaction', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  try {
    const { statements } = req.body;
    if (!Array.isArray(statements)) return res.status(400).json({ error: 'statements must be an array' });

    const results = [];
    for (const s of statements) {
      const sqlStr = s.sql || s.stmt;
      let result;
      if (sqlStr) {
        result = await buildMutationQuery(supabase, sqlStr, s.values || [], req.userId);
      } else {
        const { action, table, data, id } = s;
        switch (action.toLowerCase()) {
          case 'insert': result = await supabase.from(table).insert(data).select(); break;
          case 'update': result = await supabase.from(table).update(data).eq('id', id).select(); break;
          case 'delete': result = await supabase.from(table).delete().eq('id', id); break;
        }
      }
      if (result.error) throw new Error(`Statement failed: ${result.error.message}`);
      results.push({ success: true, changes: result.data ? result.data.length : 0 });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/db/schema
 */
router.get('/schema', (req, res) => {
  res.json({ tables: { projects: 'exists', usershapes: 'exists', userbkgs: 'exists', projectfiles: 'exists', media: 'exists' } });
});

/**
 * POST /api/db/backup
 */
router.post('/backup', (req, res) => {
  res.json({ message: 'Supabase handles backups automatically' });
});

module.exports = router;

