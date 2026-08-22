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

function requireOwnerIdentity(table, userId) {
  if (OWNER_TABLES.has(table) && !userId) {
    const err = new Error(`Missing user identity for table '${table}'`);
    err.status = 401;
    throw err;
  }
}

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
  if (OWNER_TABLES.has(table)) {
    requireOwnerIdentity(table, userId);
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
 * role: 'professor' | null (ver identityMiddleware em index.js) - isenta o
 * professor/ADM do limite diário de criação de projetos abaixo.
 */
async function buildMutationQuery(supabase, sql, values = [], userId = null, role = null) {
  const sqlLower = sql.toLowerCase().trim();
  let valIdx = 0;
  const nextVal = () => sanitizeValue(values[valIdx++]);

  // INSERT INTO table (col1,col2,...) VALUES (?,?,...)
  if (sqlLower.startsWith('insert')) {
    const match = sql.match(/^insert\s+into\s+(\w+)\s*\(([^)]+)\)\s*values\s*\(([^)]+)\)/i);
    if (!match) throw new Error('Cannot parse INSERT: ' + sql);
    const [, table, colsStr] = match;
    requireOwnerIdentity(table, userId);
    const data = {};
    colsStr.split(',').map(c => c.trim()).forEach(col => { data[col] = nextVal(); });
    // Forçar owner em tabelas multi-tenant
    if (userId && OWNER_TABLES.has(table)) {
      data.owner = userId;
    }
    // Dedup de projeto de missão: IO.createProject({..., assignmentId}) →
    // addValue('assignment_id', obj.assignmentId) (src/app/src/iPad/IO.js)
    // roda tanto quando um professor autora um exemplo (AssignmentAuthorBar.js)
    // quanto quando um aluno inicia uma missão atribuída (AssignmentBadge.js).
    // Nada nesses chamadores impede um double-click/race de disparar dois
    // INSERTs pro mesmo assignment_id, e um aluno nunca pode acabar com duas
    // missões (mesmo assignment_id) simultâneas. Então, antes de qualquer
    // outra coisa (inclusive antes do limite diário abaixo), procuramos um
    // projeto não deletado já existente deste usuário para este assignment_id
    // exato; se achar, devolvemos ele em vez de inserir de novo - no mesmo
    // formato que o insert normal retorna ({ data: [...], error: null }),
    // já que o caller em /stmt lê result.data[0].id etc.
    if (table === 'projects' && userId && data.assignment_id) {
      const { data: existingRows, error: existingErr } = await supabase
        .from('projects')
        .select('*')
        .eq('owner', userId)
        .eq('assignment_id', data.assignment_id)
        .eq('deleted', 'NO')
        .limit(1);
      if (!existingErr && existingRows && existingRows.length > 0) {
        console.log(
          `[DB INSERT] Mission project reused (not duplicated): userId=${userId} assignment_id=${data.assignment_id} existingProjectId=${existingRows[0].id}`
        );
        return { data: existingRows, error: null };
      }
    }
    // Daily project limit: max 1 new project per user per UTC day.
    // Pensado pra alunos (evitar spam de projetos vazios) - não se aplica a
    // professor/ADM, que legitimamente pode precisar criar/autorar vários
    // exemplos de missão no mesmo dia (ver AssignmentAuthorBar.js). Sem essa
    // isenção, a segunda tentativa de autoria do dia batia 429
    // DAILY_LIMIT_EXCEEDED - confirmado em produção (player-runtime, que é
    // onde esse trecho de código compartilhado acabou sendo empacotado pelo
    // Vite, não porque o professor estivesse no player de verdade).
    // Segunda isenção: qualquer projeto de missão (data.assignment_id truthy)
    // também nunca deve contar pra/ser bloqueado por esse limite, independente
    // do role - é trabalho escolar atribuído (aluno iniciando via
    // AssignmentBadge.js, ou professor autorando via AssignmentAuthorBar.js),
    // não conteúdo discricionário, que é o que o cap diário foi desenhado pra
    // conter. As duas isenções são independentes: só rodamos a checagem de
    // limite diário quando NENHUMA das duas se aplica.
    if (table === 'projects' && userId && role !== 'professor' && !data.assignment_id) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
      const { count, error: countErr } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner', userId)
        .eq('deleted', 'NO')
        .gte('created_at', todayStart.toISOString())
        .lt('created_at', tomorrowStart.toISOString());
      if (!countErr && count >= 1) {
        const limitErr = new Error('DAILY_LIMIT_EXCEEDED');
        limitErr.status = 429;
        throw limitErr;
      }
    }
    return supabase.from(table).insert(data).select();
  }

  // UPDATE table SET col1 = ?, col2 = ? WHERE id = {?|literal}
  if (sqlLower.startsWith('update')) {
    const match = sql.match(/^update\s+(\w+)\s+set\s+(.+?)\s+where\s+id\s*=\s*(\?|\d+)$/i);
    if (!match) throw new Error('Cannot parse UPDATE: ' + sql);
    const [, table, setClause, idExpr] = match;
    requireOwnerIdentity(table, userId);
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
    requireOwnerIdentity(table, userId);
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

    requireOwnerIdentity(table, req.userId);
    let query = supabase.from(table).select('*');
    Object.entries(filters).forEach(([k, v]) => { if (v != null) query = query.eq(k, v); });
    if (OWNER_TABLES.has(table)) {
      query = query.eq('owner', req.userId);
    }
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
      const { data, error } = await buildMutationQuery(supabase, sqlStr, values, req.userId, req.role);
      if (error) { console.error('Stmt error:', error); return res.status(500).json({ error: 'Statement failed', message: error.message }); }
      return res.json({ success: true, changes: data ? data.length : 1, data });
    }

    if (!action || !table) return res.status(400).json({ error: 'Provide sql, or action+table' });

    let result;
    switch (action.toLowerCase()) {
      case 'insert': {
        requireOwnerIdentity(table, req.userId);
        const insertData = OWNER_TABLES.has(table) && req.userId
          ? { ...reqData, owner: req.userId }
          : reqData;
        result = await supabase.from(table).insert(insertData).select();
        break;
      }
      case 'update':
        requireOwnerIdentity(table, req.userId);
        if (!id) return res.status(400).json({ error: 'ID required for update' });
        result = await (OWNER_TABLES.has(table) && req.userId
          ? supabase.from(table).update(reqData).eq('id', id).eq('owner', req.userId)
          : supabase.from(table).update(reqData).eq('id', id)
        ).select();
        break;
      case 'delete':
        requireOwnerIdentity(table, req.userId);
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
    res.status(err.status || 500).json({ error: err.message });
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
        result = await buildMutationQuery(supabase, sqlStr, s.values || [], req.userId, req.role);
      } else {
        const { action, table, data, id } = s;
        requireOwnerIdentity(table, req.userId);
        switch (action.toLowerCase()) {
          case 'insert': {
            const insertData = OWNER_TABLES.has(table) ? { ...data, owner: req.userId } : data;
            result = await supabase.from(table).insert(insertData).select();
            break;
          }
          case 'update': {
            result = OWNER_TABLES.has(table)
              ? await supabase.from(table).update(data).eq('id', id).eq('owner', req.userId).select()
              : await supabase.from(table).update(data).eq('id', id).select();
            break;
          }
          case 'delete': {
            result = OWNER_TABLES.has(table)
              ? await supabase.from(table).delete().eq('id', id).eq('owner', req.userId)
              : await supabase.from(table).delete().eq('id', id);
            break;
          }
        }
      }
      if (result.error) throw new Error(`Statement failed: ${result.error.message}`);
      results.push({ success: true, changes: result.data ? result.data.length : 0 });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/db/project/:id/heartbeat
 * Body: { deltaSeconds }
 *
 * Called periodically (~60s) by the editor while a student is actively
 * working on a project, to accumulate time_spent_seconds. The increment
 * happens atomically in Postgres (increment_project_time RPC, see
 * supabase-setup.sql) - including the owner check, since an RPC call
 * bypasses the .eq('owner', ...) filter buildSelectQuery/buildMutationQuery
 * apply to normal queries above. Delta is clamped server-side too (see the
 * SQL function), so a stale/malicious client can't inflate the total.
 */
router.post('/project/:id/heartbeat', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(503).json({ error: 'Database not configured' });

  try {
    if (!req.userId) return res.status(401).json({ error: 'Missing user identity' });

    const projectId = parseInt(req.params.id, 10);
    const deltaSeconds = Number(req.body.deltaSeconds);
    if (!Number.isFinite(projectId)) return res.status(400).json({ error: 'Invalid project id' });
    if (!Number.isFinite(deltaSeconds)) return res.status(400).json({ error: 'Invalid deltaSeconds' });

    const { data, error } = await supabase.rpc('increment_project_time', {
      p_project_id: projectId,
      p_owner: req.userId,
      p_delta_seconds: Math.round(deltaSeconds),
    });

    if (error) {
      console.error('[db] heartbeat RPC error:', error);
      return res.status(500).json({ error: 'Failed to record time' });
    }
    // NULL = project doesn't exist, isn't owned by this user, or was deleted.
    if (data == null) return res.status(404).json({ error: 'Project not found' });

    res.json({ success: true, timeSpentSeconds: data });
  } catch (err) {
    console.error('[db] heartbeat route error:', err);
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

