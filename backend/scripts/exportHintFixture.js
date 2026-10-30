#!/usr/bin/env node
/**
 * backend/scripts/exportHintFixture.js - exporta o projeto de REFERÊNCIA do
 * PROFESSOR de uma missão (+ as dicas aprovadas dela) como fixture de teste
 * ANONIMIZADO, pra shared/testing/fixtures/*.json.
 *
 * Por que existe: os invariantes do sistema de dicas (hintInvariants.test.js)
 * precisam rodar contra projetos/dicas REAIS - os sintéticos só cobrem o que
 * a gente já imaginou. Mas o repositório é PÚBLICO: nada que identifique uma
 * pessoa pode sair daqui. Por isso a anonimização é uma função PURA
 * (anonymizeFixture, testada em exportHintFixture.test.js) que reconstrói o
 * projeto por ALLOWLIST de campos (nunca "copia e apaga o que parece
 * pessoal") e troca TODA string livre (falas, nomes de personagem, textos de
 * dica, nomes de mensagem) por placeholders estáveis. Só sobram strings
 * estruturais: tipos de bloco, ids sintéticos (page1, sprite1_1, h1), md5 de
 * ASSET DE BIBLIOTECA (fundos/personagens da biblioteca do app) e nomes de
 * mensagem que são só cores.
 *
 * md5 de asset DESENHADO/ENVIADO pelo usuário (hash hex de 32 chars + ext)
 * pode ser identificável (um desenho de uma criança, por exemplo): é trocado
 * por um placeholder estável 'custom-<n>.svg' (mesmo valor -> mesmo
 * placeholder, então a estrutura "personagem repetido"/"fundo reusado"
 * sobrevive).
 *
 * SOMENTE LEITURA: só SELECT via supabase-js, com a SERVICE ROLE KEY do
 * backend/.env (ou --env) => roda SÓ LOCAL. Só exporta o projeto do DONO DO
 * TEMPLATE da missão (projects.assignment_id = id AND owner = dono da missão
 * ... ver pickTeacherProject) - NUNCA projeto de aluno. O arquivo de saída
 * não leva nenhum id da missão, owner, data ou e-mail.
 *
 * Uso:
 *   node backend/scripts/exportHintFixture.js --list [--env <caminho>]
 *       lista missões-molde com dicas (id, nº de dicas, tipos de when) - só
 *       contagens, sem nomes.
 *   node backend/scripts/exportHintFixture.js --assignment <id> --name <nome> \
 *       --out shared/testing/fixtures/<nome>.json [--env <caminho>]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PAGE_SIZE = 1000;

// Mensagens que são só nomes de cor da paleta do ScratchJr: neutras, ficam.
const NEUTRAL_MESSAGE_NAMES = new Set([
    'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey',
    'vermelho', 'laranja', 'amarelo', 'verde', 'azul', 'roxo', 'rosa', 'marrom', 'preto', 'branco', 'cinza',
]);

// Blocos cujo argumento é texto livre digitado pelo usuário.
const FREE_TEXT_BLOCKS = new Set(['say']);
const MESSAGE_BLOCKS = new Set(['message', 'onmessage']);

// md5 gerado por upload/pintura: 32 hex + extensão. Asset de biblioteca tem
// nome legível (Spring.svg, HY-Ruby.svg).
const CUSTOM_MD5_RE = /^[0-9a-f]{32}\.[a-z]{3,4}$/i;

// Campos de `when` que carregam texto livre/identificador e portanto são
// tratados à parte; os demais campos de when são estruturais (tipos,
// contagens, números, md5 de biblioteca).
const WHEN_ALLOWED_KEYS = new Set([
    'type', 'sceneMd5', 'sceneOccurrence', 'characterMd5', 'characterOccurrence', 'blockTypes', 'blockArgs',
    'minCounts', 'trigger', 'triggerExclusive', 'messageName', 'triggerArg', 'expected',
]);

// ---------------------------------------------------------------------------
// Funções puras (testadas em exportHintFixture.test.js)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
    const opts = { assignment: null, out: null, name: null, env: null, list: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--list') opts.list = true;
        else if (a === '--assignment') opts.assignment = parseInt(argv[++i], 10);
        else if (a === '--out') opts.out = argv[++i];
        else if (a === '--name') opts.name = argv[++i];
        else if (a === '--env') opts.env = argv[++i];
        else throw new Error('Argumento desconhecido: ' + a);
    }
    if (!opts.list) {
        if (!Number.isFinite(opts.assignment)) throw new Error('--assignment <id> é obrigatório');
        if (!opts.out) throw new Error('--out <arquivo.json> é obrigatório');
    }
    return opts;
}

/** Tabela de placeholders estáveis: o mesmo valor original -> o mesmo placeholder. */
function makeAliaser(prefix, suffix) {
    const seen = new Map();
    return function (value) {
        if (!seen.has(value)) seen.set(value, prefix + (seen.size + 1) + (suffix || ''));
        return seen.get(value);
    };
}

/**
 * Devolve md5 seguro: asset de biblioteca passa; hash de upload/pintura vira
 * 'custom-<n>.<ext>'. null/'' passam como null.
 */
function makeMd5Sanitizer() {
    const alias = new Map();
    return function (md5) {
        if (typeof md5 !== 'string' || !md5) return null;
        if (!CUSTOM_MD5_RE.test(md5)) return md5;
        if (!alias.has(md5)) {
            alias.set(md5, 'custom-' + (alias.size + 1) + '.' + md5.split('.').pop().toLowerCase());
        }
        return alias.get(md5);
    };
}

/** Argumento de bloco -> versão anonimizada (texto livre vira placeholder). */
function sanitizeBlockArg(type, arg, ctx) {
    if (arg === null || arg === undefined) return arg === undefined ? null : arg;
    if (typeof arg === 'number') return arg;
    if (typeof arg !== 'string') return null; // objeto/array inesperado: descarta
    if (arg === 'null' || arg === '') return arg;
    if (/^unconfirmed:-?\d+(\.\d+)?$/.test(arg)) return arg; // valor padrão não confirmado
    if (FREE_TEXT_BLOCKS.has(type)) return ctx.say(arg);
    if (MESSAGE_BLOCKS.has(type)) return sanitizeMessageName(arg, ctx);
    if (/^-?\d+(\.\d+)?$/.test(arg)) return arg; // número em string (blocos numéricos)
    return ctx.text(arg); // qualquer outra string livre: nunca sobra
}

function sanitizeScript(script, ctx) {
    if (!Array.isArray(script)) return [];
    return script.filter(Array.isArray).map(function (block) {
        const out = [block[0], sanitizeBlockArg(block[0], block[1], ctx), 0, 0];
        if (Array.isArray(block[4])) out.push(sanitizeScript(block[4], ctx));
        return out;
    });
}

function sanitizeMessageName(name, ctx) {
    if (typeof name !== 'string') return name;
    if (NEUTRAL_MESSAGE_NAMES.has(name.trim().toLowerCase())) return name;
    return ctx.message(name);
}

/**
 * Projeto -> projeto anonimizado, por ALLOWLIST (só reconstrói o que os
 * walkers de shared/*.mjs leem). Caixas de texto (type 'text') viram sprites
 * descartados do fixture: o conteúdo é 100% livre e não importa pras dicas
 * (computeDetailedManifest ignora type != 'sprite').
 */
function anonymizeProject(projectJson, ctx) {
    const out = { pages: [], currentPage: null };
    if (!projectJson || !Array.isArray(projectJson.pages)) return out;
    projectJson.pages.forEach(function (pageId, pi) {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') return;
        const newPageId = 'page' + (out.pages.length + 1);
        const newPage = { sprites: [] };
        if (page.md5) newPage.md5 = ctx.md5(page.md5);
        const spriteIds = Array.isArray(page.sprites) ? page.sprites : [];
        spriteIds.forEach(function (spriteId) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object' || sprite.type !== 'sprite') return;
            const newSpriteId = 'sprite' + (out.pages.length + 1) + '_' + (newPage.sprites.length + 1);
            const data = {
                type: 'sprite',
                id: newSpriteId,
                name: ctx.character(sprite.name || newSpriteId),
                scripts: (Array.isArray(sprite.scripts) ? sprite.scripts : []).map(function (s) {
                    return sanitizeScript(s, ctx);
                }),
            };
            if (sprite.md5) data.md5 = ctx.md5(sprite.md5);
            newPage.sprites.push(newSpriteId);
            newPage[newSpriteId] = data;
        });
        out.pages.push(newPageId);
        out[newPageId] = newPage;
        if (out.currentPage === null) out.currentPage = newPageId;
    });
    return out;
}

/**
 * Dicas -> dicas anonimizadas. id vira h<n> (pela posição), texto vira
 * 'Dica <n>' (mission_intro e manual também); `when` é filtrado por allowlist
 * e seus textos (messageName, trigger) passam pelo mesmo aliaser do projeto
 * pra continuarem casando com o script anonimizado.
 */
function anonymizeHints(hints, ctx) {
    return (Array.isArray(hints) ? hints : []).map(function (hint, i) {
        const when = {};
        const srcWhen = (hint && hint.when) || {};
        Object.keys(srcWhen).forEach(function (key) {
            if (!WHEN_ALLOWED_KEYS.has(key)) return;
            const value = srcWhen[key];
            if (key === 'sceneMd5' || key === 'characterMd5') when[key] = ctx.md5(value);
            else if (key === 'messageName') when[key] = sanitizeMessageName(value, ctx);
            else when[key] = ctx.cloneStructural(value);
        });
        return { id: 'h' + (i + 1), text: 'Dica ' + (i + 1), when };
    });
}

/** Contexto de aliasing compartilhado entre projeto e dicas de UMA fixture. */
function makeContext() {
    const say = makeAliaser('Fala ');
    const character = makeAliaser('Personagem ');
    const message = makeAliaser('mensagem-');
    const text = makeAliaser('Texto ');
    return {
        say, character, message, text,
        md5: makeMd5Sanitizer(),
        // blockArgs/minCounts/expected são números e tipos de bloco; strings
        // soltas ali (valores desconhecidos) viram placeholder genérico.
        cloneStructural: function clone(v) {
            if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
            if (typeof v === 'string') return v;
            if (Array.isArray(v)) return v.map(clone);
            if (v && typeof v === 'object') {
                const o = {};
                Object.keys(v).forEach(function (k) { o[k] = clone(v[k]); });
                return o;
            }
            return null;
        },
    };
}

/**
 * Entrada: {name, projectJson (parseado), hints}. Saída: o JSON da fixture,
 * sem NENHUM id/owner/data. `name` é o apelido escolhido por quem exporta
 * (--name), nunca o título da missão.
 */
function anonymizeFixture({ name, projectJson, hints }) {
    const ctx = makeContext();
    // O projeto primeiro: o aliaser de mensagens/md5 é preenchido na ordem
    // do projeto, e as dicas reusam as mesmas tabelas.
    const anonProject = anonymizeProject(projectJson, ctx);
    const anonHints = anonymizeHints(hints, ctx);
    return { name: String(name), source: 'anonimizado', projectJson: anonProject, hints: anonHints };
}

/** Escolhe o projeto do PROFESSOR (dono da linha do template), nunca de aluno. */
function pickTeacherProject(projects) {
    return (projects || []).find(function (p) { return p && p.deleted !== 'YES'; }) || null;
}

// ---------------------------------------------------------------------------
// I/O (só leitura)
// ---------------------------------------------------------------------------

function connect(opts) {
    const envPath = opts.env ? path.resolve(opts.env) : path.join(__dirname, '..', '.env');
    require('dotenv').config({ path: envPath });
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em ' + envPath);
    return require('@supabase/supabase-js').createClient(url, key);
}

async function listTemplates(supabase) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase.from('assignments').select('id, template_id, hints')
            .is('template_id', null).range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
    }
    return rows.filter(function (r) { return Array.isArray(r.hints) && r.hints.length; });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const supabase = connect(opts);
    if (opts.list) {
        const rows = await listTemplates(supabase);
        rows.forEach(function (r) {
            const types = {};
            r.hints.forEach(function (h) {
                const t = (h.when && h.when.type) || '?';
                types[t] = (types[t] || 0) + 1;
            });
            console.log(r.id + '\t' + r.hints.length + ' dicas\t' + JSON.stringify(types));
        });
        return;
    }
    const { data: assignment, error: aErr } = await supabase.from('assignments')
        .select('id, template_id, hints').eq('id', opts.assignment).maybeSingle();
    if (aErr) throw aErr;
    if (!assignment) throw new Error('Missão não encontrada');
    if (assignment.template_id) throw new Error('Use o id do MOLDE (template), não de uma referência');
    // Mesmo critério de routes/assignments.js#findOwnedTemplateProject, sem o
    // filtro de owner (não temos o userId do professor aqui): o projeto-exemplo
    // vinculado ao molde. Alunos trabalham em linhas de REFERÊNCIA (outro
    // assignment_id), então o molde só tem o projeto do professor.
    const { data: projects, error: pErr } = await supabase.from('projects').select('id, json, deleted')
        .eq('assignment_id', opts.assignment).eq('deleted', 'NO').limit(1);
    if (pErr) throw pErr;
    const project = pickTeacherProject(projects);
    if (!project) throw new Error('Projeto-exemplo do professor não encontrado');
    const fixture = anonymizeFixture({
        name: opts.name || path.basename(opts.out, '.json'),
        projectJson: JSON.parse(project.json),
        hints: assignment.hints,
    });
    fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
    fs.writeFileSync(opts.out, JSON.stringify(fixture, null, 2) + '\n');
    console.log('Fixture gravada em ' + opts.out + ' (' + fixture.hints.length + ' dicas)');
}

if (require.main === module) {
    main().catch((err) => {
        console.error('exportHintFixture falhou:', err.message);
        process.exitCode = 1;
    });
}

module.exports = { parseArgs, anonymizeFixture, anonymizeProject, anonymizeHints, pickTeacherProject, makeContext };
