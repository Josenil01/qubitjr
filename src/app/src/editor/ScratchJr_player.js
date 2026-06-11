/**
 * ScratchJr_player.js — patches exclusivos do player, sem efeitos colaterais.
 * Chamar applyScratchJrPlayerPatches() explicitamente em player.js.
 */

import ScratchJr from './ScratchJr.js';

export function applyScratchJrPlayerPatches () {
    // ── numEditKey: evita TypeError quando activeFocus é null no player ──────
    const _origNumEditKey = ScratchJr.numEditKey;
    ScratchJr.numEditKey = function (e) {
        if (!ScratchJr.activeFocus) { return; }
        return _origNumEditKey.call(ScratchJr, e);
    };
}
