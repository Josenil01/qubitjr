'use strict';

/**
 * backend/src/services/hintAlignment.js
 *
 * Shim (mesmo padrão de ./detailedManifest.js) - a lógica real mora em
 * shared/hintAlignment.mjs (alinhamento professor x aluno da Fase 3, puro,
 * consumido também pelo frontend via Vite). Existe pro gerador
 * (hintsGeneration.js) poder validar uma dica com when.expected contra o
 * PRÓPRIO projeto do professor (tudo tem que dar 'done').
 *
 * R1: shared/hintAlignment.mjs está em SHARED_ESM_SPECIFIERS de api/index.js
 * (o require() síncrono de .mjs abaixo quebra o cold start na Vercel se o
 * módulo não estiver pré-carregado - ver CLAUDE.md, armadilhas de backend).
 */
module.exports = require('../../../shared/hintAlignment.mjs');
