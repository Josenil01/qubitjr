/**
 * backend/src/apiPreload.test.js
 *
 * Guarda R1. Em produção (runtime serverless da Vercel) `require()` síncrono
 * de .mjs QUEBRA (ERR_REQUIRE_ESM, mata a função no cold start - toda rota
 * /api/* cai), mesmo funcionando liso em dev local com Node 22.12+. Por isso
 * api/index.js pré-carrega via import() dinâmico uma lista FIXA
 * (SHARED_ESM_SPECIFIERS) e injeta no require.cache. Esta lista é manual: se
 * alguém adicionar `require('.../shared/novo.mjs')` (ou um shared/*.mjs passar
 * a importar outro) e esquecer de listar, tudo passa em dev e testes e só
 * explode em produção. Este teste fecha essa porta:
 *
 *  1. todo shared/*.mjs alcançável por require() de produção (backend/src
 *     não-teste e api/), seguindo imports entre shared/*.mjs, precisa estar em
 *     SHARED_ESM_SPECIFIERS;
 *  2. nenhum arquivo de produção pode importar shared/testing/ (fixtures só
 *     de teste - não vão no bundle da função e o preload não os cobre).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

const isTest = (f) => /\.test\.[cm]?js$/.test(f);
const isCode = (f) => /\.[cm]?js$/.test(f);
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

/** Arquivos de produção do backend e da função serverless. */
function backendProdFiles() {
    return [
        ...walk(path.join(ROOT, 'backend', 'src'), []).filter((f) => isCode(f) && !isTest(f)),
        path.join(ROOT, 'api', 'index.js'),
    ];
}

/** Remove comentários (docblocks citam `require('...shared/x.mjs')` como exemplo). */
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Resolve um specifier relativo de `from` e devolve o caminho absoluto. */
function resolveFrom(from, spec) {
    return path.resolve(path.dirname(from), spec);
}

/** Lista parseada (como texto) de SHARED_ESM_SPECIFIERS em api/index.js. */
function preloadedSharedFiles() {
    const src = fs.readFileSync(path.join(ROOT, 'api', 'index.js'), 'utf8');
    const match = /SHARED_ESM_SPECIFIERS\s*=\s*\[([\s\S]*?)\]/.exec(src);
    if (!match) throw new Error('SHARED_ESM_SPECIFIERS não encontrado em api/index.js');
    const specs = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    return new Set(specs.map((s) => resolveFrom(path.join(ROOT, 'api', 'index.js'), s)));
}

/** require('...shared/X.mjs') direto em arquivos de produção. */
function directlyRequiredSharedMjs() {
    const found = new Set();
    for (const file of backendProdFiles()) {
        const src = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of src.matchAll(/require\(\s*['"]([^'"]*shared\/[^'"]+\.mjs)['"]\s*\)/g)) {
            found.add(resolveFrom(file, m[1]));
        }
    }
    return found;
}

/** Fecho transitivo via `import ... from './Y.mjs'` / `import './Y.mjs'`. */
function transitiveClosure(entries) {
    const seen = new Set();
    const queue = [...entries];
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        if (!fs.existsSync(file)) continue;
        const src = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of src.matchAll(/(?:from|import)\s*['"](\.{1,2}\/[^'"]+\.mjs)['"]/g)) {
            queue.push(resolveFrom(file, m[1]));
        }
    }
    return seen;
}

describe('R1: pré-carregamento de shared/*.mjs em api/index.js', () => {
    test('todo shared/*.mjs alcançável por require() de produção está em SHARED_ESM_SPECIFIERS', () => {
        const preloaded = preloadedSharedFiles();
        const reachable = transitiveClosure(directlyRequiredSharedMjs());
        const missing = [...reachable].filter((f) => !preloaded.has(f)).map(rel);
        if (missing.length) {
            throw new Error(
                'Armadilha de produção (Vercel): require() síncrono de .mjs quebra o cold start ' +
                '(ERR_REQUIRE_ESM) mesmo funcionando em dev local. Adicione em api/index.js, ' +
                'SHARED_ESM_SPECIFIERS, o(s) arquivo(s): ' + missing.join(', ')
            );
        }
    });

    test('a lista aponta só para arquivos que existem', () => {
        const ghosts = [...preloadedSharedFiles()].filter((f) => !fs.existsSync(f)).map(rel);
        expect(ghosts).toEqual([]);
    });

    test('código de produção nunca importa shared/testing/', () => {
        const prod = [
            ...backendProdFiles(),
            ...walk(path.join(ROOT, 'src', 'app', 'src'), []).filter((f) => isCode(f) && !isTest(f)),
            ...walk(path.join(ROOT, 'shared'), []).filter(
                (f) => /\.mjs$/.test(f) && !rel(f).startsWith('shared/testing/')
            ),
        ];
        const offenders = prod.filter((f) => /shared\/testing\/|\.\/testing\//.test(fs.readFileSync(f, 'utf8')))
            .map(rel);
        if (offenders.length) {
            throw new Error(
                'Fixtures de shared/testing/ são SÓ DE TESTE e não vão no bundle/preload de produção. ' +
                'Importadas indevidamente por: ' + offenders.join(', ')
            );
        }
    });
});
