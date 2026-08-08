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
 */

module.exports = require('../backend/src/index.js');
