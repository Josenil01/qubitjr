/**
 * ScratchJr_player.js
 *
 * Monkey-patches aplicados à classe ScratchJr apenas no contexto do player.
 * Importar este arquivo em playerEntry-vite.js ou player.js — NUNCA no editor.
 *
 * Patches:
 *  1. numEditKey — retorna cedo quando activeFocus é nulo, evitando
 *     TypeError em contexto onde não há área de texto ativa (player não usa
 *     edição de texto, mas o listener de teclado global continua registrado).
 */

import ScratchJr from './ScratchJr.js';

const _origNumEditKey = ScratchJr.numEditKey;
ScratchJr.numEditKey = function (e) {
    if (!ScratchJr.activeFocus) { return; }
    return _origNumEditKey.call(ScratchJr, e);
};
