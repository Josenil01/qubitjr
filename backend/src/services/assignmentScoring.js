'use strict';

/**
 * backend/src/services/assignmentScoring.js
 *
 * Shim (refatoração Fase 1) - a lógica real mora em shared/assignmentScoring.mjs
 * (fonte única, consumida também pelo frontend via Vite). Ver docblock de
 * detailedManifest.js (mesma pasta) pro racional completo do `require()`
 * síncrono de ESM.
 */
module.exports = require('../../../shared/assignmentScoring.mjs');
