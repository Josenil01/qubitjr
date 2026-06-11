/**
 * Sprite_player.js — patches exclusivos do player, sem efeitos colaterais.
 * Chamar applySpritePlayerPatches() explicitamente em player.js.
 */

import Sprite from './Sprite.js';

export function applySpritePlayerPatches () {
    // ── loadMyImage: onerror para sprite com 404/CORS ────────────────────────
    const _origLoadMyImage = Sprite.prototype.loadMyImage;
    Sprite.prototype.loadMyImage = function (dataurl, fcn) {
        _origLoadMyImage.call(this, dataurl, fcn);
        if (this.img && !this.img.complete && !this.img.onerror) {
            const sprite = this;
            this.img.onerror = function () {
                sprite.w  = sprite.w  || 1;
                sprite.h  = sprite.h  || 1;
                sprite.cx = sprite.cx || 0;
                sprite.cy = sprite.cy || 0;
                if (fcn) { fcn(sprite); }
            };
        }
    };

    // ── drawMyImage: border pode ser null quando imagem falhou ───────────────
    const _origDrawMyImage = Sprite.prototype.drawMyImage;
    Sprite.prototype.drawMyImage = function (...args) {
        if (!this.border) { return; }
        return _origDrawMyImage.apply(this, args);
    };

    // ── getSVGimage: svg pode ser null/parseerror ────────────────────────────
    const _origGetSVGimage = Sprite.prototype.getSVGimage;
    Sprite.prototype.getSVGimage = function (svg) {
        if (!svg || typeof svg.tagName === 'undefined') {
            return document.createElement('img');
        }
        return _origGetSVGimage.call(this, svg);
    };
}
