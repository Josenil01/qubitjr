/**
 * backend/babel.config.js
 *
 * Só existe pra uma coisa: deixar o Jest (que tem seu próprio carregador de
 * módulos, nunca o `require()` nativo do Node - por isso não ganha de
 * graça o `require()` síncrono de ESM que o Node >= 22.12 já suporta,
 * ver backend/src/services/detailedManifest.js) entender a sintaxe
 * import/export de shared/*.mjs durante os testes. Nenhum outro código do
 * backend precisa disso - tudo aqui já é CommonJS e já roda nativo no Node
 * de produção (Vercel). Sem presets largos (preset-env etc.) de propósito:
 * só o plugin que troca import/export por require/module.exports, nada mais.
 */
module.exports = {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
};
