/**
 * src/app/src/utils/ZoomGuard.js
 *
 * Mitigação de zoom acidental da página inteira (desktop + mobile).
 *
 * ScratchJr é um app de layout fixo (ver `min-width: 1020px` em
 * src/app/css/base.css) desenhado para crianças em tablets/navegadores:
 * zoom acidental (pinch, Ctrl+scroll, Ctrl+/Ctrl-) quebra o layout do
 * palco/paleta porque eles não são responsivos a escalas arbitrárias.
 *
 * O que ISTO cobre (mitigação parcial no desktop, via JS):
 *   - Ctrl/Cmd + scroll do mouse ou pinch de trackpad (dispara `wheel`
 *     com `ctrlKey: true` em Chrome/Firefox/Edge) -> preventDefault().
 *   - Ctrl/Cmd + "+"/"-"/"="/"0" (inclusive teclado numérico) -> preventDefault().
 *
 * O que NÃO é tocado aqui (de propósito, para não quebrar o app):
 *   - Eventos de touch (`touchstart`/`touchmove`) não são interceptados.
 *     O painteditor (`Paint.js`/`PaintAction.js`/`Scroll.js`/`UI.js` etc.)
 *     já lê `e.touches.length` para implementar sua PRÓPRIA feature de
 *     pinch-to-zoom *dentro* do canvas de desenho (zoom da arte, não da
 *     página) e distinguir gestos de 1 vs. múltiplos dedos. Interceptar
 *     touch globalmente aqui quebraria esse fluxo.
 *   - Eventos nativos `gesturestart`/`gesturechange` (Safari) não são usados
 *     pelo app (a implementação de pinch do Paint.js é baseada em
 *     `touches`, não nesses eventos), então não há necessidade de tocá-los.
 *
 * Limitações conhecidas (não existe bloqueio 100% via JS em navegador
 * moderno, por razões de acessibilidade):
 *   - Pinch-to-zoom em touch já é mitigado pela meta viewport
 *     (`user-scalable=no, maximum-scale=1.0`) nos HTMLs de entrada, mas
 *     Safari/iOS recente IGNORA essa meta tag de propósito (WebKit mudou
 *     esse comportamento por acessibilidade) — não há contorno via JS.
 *   - Firefox desktop não decide zoom de página via `wheel`+`ctrlKey` do
 *     mesmo jeito que Chrome/Edge em todos os casos de trackpad; o
 *     preventDefault aqui cobre o caso comum (Ctrl+scroll de mouse/trackpad
 *     que gera `wheel`), mas não todo gesto de zoom do SO/navegador.
 *   - Zoom pelo menu do navegador (Ctrl+clique no menu "Zoom") não é
 *     interceptável via JS.
 */

const ZOOM_KEYS = new Set(['+', '-', '=', '_', '0']);

function onWheel (e) {
    if (e.ctrlKey) {
        e.preventDefault();
    }
}

function onKeydown (e) {
    if (!(e.ctrlKey || e.metaKey)) {
        return;
    }
    if (ZOOM_KEYS.has(e.key) || e.code === 'NumpadAdd' || e.code === 'NumpadSubtract') {
        e.preventDefault();
    }
}

let installed = false;

/**
 * Liga os listeners globais de bloqueio de zoom. Idempotente: chamar mais
 * de uma vez (ex.: em páginas diferentes que compartilham este módulo via
 * bundler) não duplica listeners.
 */
export function installZoomGuard () {
    if (installed) {
        return;
    }
    installed = true;
    // passive:false é obrigatório para que preventDefault() em 'wheel' tenha efeito.
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeydown);
}

export default installZoomGuard;
