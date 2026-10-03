'use strict';

/**
 * backend/src/services/detailedManifest.js
 *
 * Shim (refatoração Fase 1) - a lógica real mora em shared/detailedManifest.mjs
 * (fonte única, consumida também pelo frontend via Vite). Reexporta via
 * `require()` síncrono de um módulo ESM, suportado nativamente a partir do
 * Node 22.12 (confirmado: Vercel deste projeto está configurado pra Node
 * >= 22.x) - nenhum outro arquivo deste backend precisa saber que a
 * implementação é ESM por baixo; todo `require('./detailedManifest')/
 * require('../services/detailedManifest')` existente continua funcionando
 * sem mudança nenhuma.
 */
module.exports = require('../../../shared/detailedManifest.mjs');
