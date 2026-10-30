/**
 * api/index.js
 *
 * Entry point serverless da Vercel — monta o app Express de produção.
 *
 * Antes, este arquivo mantinha uma cópia própria (desatualizada) do
 * identityMiddleware e das rotas, sem verificação HMAC nem a integração da
 * HelloYotta, e sem registrar /api/teacher nem /api/realtime — ou seja,
 * tudo isso nunca chegou a rodar em produção, só localmente. Corrigido
 * reaproveitando o app real de backend/src/index.js (mesma fonte usada por
 * `npm run backend`/`npm run dev`), que só evita subir servidor HTTP próprio
 * (`app.listen`) quando importado como módulo — ver o guard `require.main
 * === module` lá.
 *
 * [2026-10] TODA rota /api/* caiu em produção (FUNCTION_INVOCATION_FAILED)
 * assim que a refatoração "Fase 1" moveu assignmentScoring/detailedManifest/
 * hintSchema pra shared/*.mjs (fonte única também consumida pelo frontend
 * via Vite) e passou a fazer `require('...shared/x.mjs')` SÍNCRONO direto de
 * dentro de backend/src/services/{assignmentScoring,detailedManifest}.js e
 * backend/src/services/hintsGeneration.js. O docblock daquela refatoração
 * assumia que isso funcionava porque o Node 22.12+ dá suporte nativo a
 * `require()` de ESM — e de fato dá, e roda liso em dev local (Node 24.x
 * aqui) — só que o runtime serverless da Vercel (visto no stack trace real:
 * /opt/rust/nodejs.js, não um Node "puro") lança `ERR_REQUIRE_ESM` nesse
 * mesmo código, mesmo com "Node.js Version: 24.x" configurado no projeto.
 * Resultado: a função morria no `require()` em cold start, ANTES do Express
 * sequer montar as rotas — por isso até /api/health, que não toca em nenhum
 * desses módulos, caía junto.
 *
 * Em vez de reverter a Fase 1 (duplicar a lógica de volta em CJS, que é
 * exatamente o que a refatoração existia pra eliminar) ou espalhar
 * async/await por ~10 call sites em routes/assignments.js e routes/share.js
 * (um deles dentro de um `.map()` síncrono — virar async ali quebraria
 * silenciosamente, devolvendo Promises no JSON em vez dos manifests), a
 * correção fica isolada aqui: `import()` dinâmico (sempre suportado em CJS,
 * sem a limitação do `require()` síncrono de ESM) carrega os três módulos
 * ESM uma vez por cold start e injeta o resultado direto no cache de
 * `require` do Node (`require.cache`/`Module._cache`, API pública e
 * documentada) ANTES de exigir backend/src/index.js. Quando a cadeia de
 * requires síncronos de lá embaixo (assignmentScoring.js, detailedManifest.js,
 * hintsGeneration.js) pedir `require('...shared/x.mjs')`, o Node encontra o
 * módulo já no cache e devolve `.exports` direto — nunca tenta
 * carregar/compilar o .mjs de novo, então o `ERR_REQUIRE_ESM` nunca
 * acontece. Nenhum arquivo de lógica (backend/src/** ou shared/**) precisou
 * mudar; o shim continua sendo `module.exports = require('...mjs')`, só que
 * agora sempre bate no cache pré-populado. Dev local (`npm run backend`,
 * que roda backend/src/index.js direto, sem passar por este arquivo)
 * continua intocado — já funcionava via o require(esm) nativo do Node local.
 */

const path = require('path');
const Module = require('module');
const { pathToFileURL } = require('url');

// Literal, um por arquivo (não computado em runtime) — @vercel/nft traceia
// estes caminhos na hora do build e garante que shared/*.mjs vá pro bundle
// da função, exatamente como já acontecia pros `require('...shared/x.mjs')`
// síncronos existentes em backend/src/services/*.js.
const SHARED_ESM_SPECIFIERS = [
  '../shared/assignmentScoring.mjs',
  '../shared/detailedManifest.mjs',
  '../shared/hintSchema.mjs',
  '../shared/hintAlignment.mjs',
];

let preloadPromise = null;

function preloadSharedEsmIntoRequireCache() {
  if (!preloadPromise) {
    preloadPromise = Promise.all(
      SHARED_ESM_SPECIFIERS.map(async (specifier) => {
        // require.resolve() só resolve o caminho (não executa/compila o
        // arquivo), então funciona mesmo pra um .mjs que o require() normal
        // não conseguiria carregar — devolve o MESMO caminho absoluto
        // canônico que backend/src/services/*.js vai usar como chave de
        // cache quando, mais abaixo na cadeia, fizerem o próprio
        // `require('...shared/x.mjs')`.
        const absPath = require.resolve(specifier);
        if (Module._cache[absPath]) return; // já preenchido (warm start)

        const namespace = await import(pathToFileURL(absPath).href);

        const fakeModule = new Module(absPath, module);
        fakeModule.filename = absPath;
        fakeModule.paths = Module._nodeModulePaths(path.dirname(absPath));
        fakeModule.loaded = true;
        fakeModule.exports = namespace;
        Module._cache[absPath] = fakeModule;
      })
    );
  }
  return preloadPromise;
}

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = preloadSharedEsmIntoRequireCache().then(() => require('../backend/src/index.js'));
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  return app(req, res);
};
