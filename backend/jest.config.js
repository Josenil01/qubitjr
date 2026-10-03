/**
 * backend/jest.config.js
 *
 * Única razão de existir: o default do Jest só manda pro transform (babel-
 * jest, ver babel.config.js) arquivos que casam com /\.[jt]sx?$/ - que NÃO
 * inclui .mjs (o ponto ali precisa vir seguido de "j" ou "t" direto; em
 * ".mjs" vem "m"). Sem isso, shared/*.mjs passa direto sem transformação e
 * o Jest quebra em "Unexpected token 'export'" assim que algum require()
 * do backend alcança o shim de detailedManifest.js/assignmentScoring.js
 * (ver docblock desses dois arquivos).
 */
module.exports = {
    transform: {
        '^.+\\.m?js$': 'babel-jest',
    },
};
