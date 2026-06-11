/**
 * Sprite_player.js
 *
 * Monkey-patches aplicados à classe Sprite apenas no contexto do player.
 * Importar este arquivo em playerEntry-vite.js ou player.js — NUNCA no editor.
 *
 * Patches:
 *  1. loadMyImage — adiciona img.onerror para que sprites com imagem ausente
 *     (404/CORS) não travam o carregamento do projeto.
 *  2. drawMyImage — guarda this.border nulo para não lançar exceção quando a
 *     imagem do sprite falhou e border nunca foi calculado.
 *  3. getSVGimage — guarda svg nulo/inválido para não crashar o XMLSerializer.
 */

import Sprite from './Sprite.js';

// ── 1. loadMyImage ───────────────────────────────────────────────────────────
const _origLoadMyImage = Sprite.prototype.loadMyImage;
Sprite.prototype.loadMyImage = function (dataurl, fcn) {
    _origLoadMyImage.call(this, dataurl, fcn);
    // Adiciona onerror na img recém-criada (se ainda não tem)
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

// ── 2. drawMyImage ───────────────────────────────────────────────────────────
const _origDrawMyImage = Sprite.prototype.drawMyImage;
Sprite.prototype.drawMyImage = function (...args) {
    if (!this.border) { return; }
    return _origDrawMyImage.apply(this, args);
};

// ── 3. getSVGimage ───────────────────────────────────────────────────────────
const _origGetSVGimage = Sprite.prototype.getSVGimage;
Sprite.prototype.getSVGimage = function (svg) {
    if (!svg || typeof svg.tagName === 'undefined') {
        return document.createElement('img');
    }
    return _origGetSVGimage.call(this, svg);
};
