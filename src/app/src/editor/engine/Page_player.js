/**
 * Page_player.js — patches exclusivos do player, sem efeitos colaterais.
 * Chamar applyPagePlayerPatches() explicitamente em player.js.
 */

import Page from './Page.js';

export function applyPagePlayerPatches () {
    // ── setBackgroundImage: onerror evita deadlock quando imagem falha ─────────
    const _origSetBgImg = Page.prototype.setBackgroundImage;
    Page.prototype.setBackgroundImage = function (url, fcn) {
        _origSetBgImg.call(this, url, fcn);
        if (this.bkg.img && !this.bkg.img.complete && !this.bkg.img.onerror) {
            this.bkg.img.onerror = function () {
                if (fcn) { fcn(); }
            };
        }
    };

    // ── setPageThumb: silencia DOMException se imagem de fundo estiver quebrada ─
    const _origSetPageThumb = Page.prototype.setPageThumb;
    Page.prototype.setPageThumb = function (c) {
        try {
            _origSetPageThumb.call(this, c);
        } catch (_) { /* silencia drawImage com img quebrada — miniaturas não usadas no player */ }
    };
}
