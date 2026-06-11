/**
 * Stage_player.js — patches exclusivos do player sobre Stage, sem efeitos colaterais.
 * Chamar applyStagePlayerPatches() explicitamente em player.js.
 */

import Stage from './Stage.js';

export function applyStagePlayerPatches () {
    // ── whoIsIt: substituição do hit-test baseado em canvas+stamp ────────────
    // O método original usa stamp() que tem um offset Y hardcoded de -80 calibrado
    // para scaleMultiplier=0.5 (legado). Com scaleMultiplier=1 e CSS scale variável
    // no player, as coordenadas ficam descalibradas e sprites nunca são encontrados.
    // Esta versão usa getBoundingClientRect() para hit-test retangular preciso.
    Stage.prototype.whoIsIt = function (ctx, pt) {
        var page = this.currentPage.div;
        var stageDivRect = this.div.getBoundingClientRect();
        if (!stageDivRect.width || !stageDivRect.height) {
            return undefined;
        }
        var scaleX = 480 / stageDivRect.width;
        var scaleY = 360 / stageDivRect.height;

        for (var i = page.childElementCount - 1; i > -1; i--) {
            var spr = page.childNodes[i].owner;
            if (!spr || !spr.shown) { continue; }
            var rect = spr.div.getBoundingClientRect();
            var localLeft   = (rect.left   - stageDivRect.left) * scaleX;
            var localTop    = (rect.top    - stageDivRect.top)  * scaleY;
            var localRight  = (rect.right  - stageDivRect.left) * scaleX;
            var localBottom = (rect.bottom - stageDivRect.top)  * scaleY;
            console.log('[whoIsIt] spr=' + (spr.name || spr.id) +
                ' pt=(' + pt.x.toFixed(0) + ',' + pt.y.toFixed(0) + ')' +
                ' box=(' + localLeft.toFixed(0) + ',' + localTop.toFixed(0) +
                ')-(' + localRight.toFixed(0) + ',' + localBottom.toFixed(0) + ')' +
                ' stageTop=' + stageDivRect.top.toFixed(0) +
                ' rectTop=' + rect.top.toFixed(0));
            if (pt.x >= localLeft && pt.x <= localRight &&
                pt.y >= localTop  && pt.y <= localBottom) {
                return spr;
            }
        }
        return undefined;
    };
}
