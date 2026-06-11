/**
 * Page_player.js
 *
 * Monkey-patches aplicados à classe Page apenas no contexto do player.
 * Importar este arquivo em playerEntry-vite.js ou player.js — NUNCA no editor.
 *
 * Patches:
 *  1. setBackgroundImage — adiciona img.onerror para evitar deadlock quando
 *     a imagem de fundo falha a carregar (404/CORS no Supabase Storage).
 *  2. setPageThumb — guarda img nula/incompleta antes de ctx.drawImage para
 *     evitar exceção DOMException no player (miniaturas não são usadas, mas
 *     o método é chamado pelo engine após cada alteração de página).
 */

import Page from './Page.js';

const _origSetBackgroundImage = Page.prototype.setBackgroundImage;
Page.prototype.setBackgroundImage = function (url, fcn) {
    // Chama o original para criar a img e registrar o onload normalmente
    _origSetBackgroundImage.call(this, url, fcn);
    // Adiciona onerror na img recém-criada para evitar mediaCount preso
    if (this.bkg.img && !this.bkg.img.complete) {
        const img = this.bkg.img;
        const origOnload = img.onload;
        if (!img.onerror) {
            img.onerror = function () {
                if (fcn) { fcn(); }
            };
        }
    }
};

const _origSetPageThumb = Page.prototype.setPageThumb;
Page.prototype.setPageThumb = function (c) {
    // No player as miniaturas de página não são exibidas; executar versão
    // segura que não trava em img.naturalWidth === 0.
    // Reutiliza o original mas guarda o drawImage do fundo.
    try {
        _origSetPageThumb.call(this, c);
    } catch (_) {
        // silencia DOMException: drawImage com imagem quebrada
    }
};
