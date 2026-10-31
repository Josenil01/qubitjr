/**
 * src/app/src/editor/ui/StagePlacementGhost.js
 *
 * Sombra de posicionamento no palco (lado do ALUNO): uma silhueta escura e
 * semi-transparente de cada personagem no lugar onde o PROFESSOR o deixou no
 * projeto de referência da missão (assignment.stagePlacements, calculado no
 * servidor por shared/detailedManifest.mjs#buildStagePlacements). A sombra
 * NUNCA move nada sozinha - só mostra o alvo; a criança arrasta o próprio
 * personagem até lá. Quando ele chega perto o bastante (isNearTarget), a
 * sombra some. Não é avaliada nem persistida: um F5 pode trazê-la de volta
 * se o personagem ainda não estiver no lugar.
 *
 * Fronteira de dependências (mesmo princípio de GalleryRestriction.js): este
 * arquivo só é importado por AssignmentBadge.js, que só o editor do aluno
 * carrega - nunca por Stage.js/Sprite.js/Page.js (que também rodam em
 * entry/player.js, o viewer público) e nunca importa HintEngine.js. Quem
 * mexe no palco avisa via GalleryRestriction.js#refreshStagePlacementGhosts
 * (um no-op onde este módulo não foi carregado), e o estado da missão chega
 * por GalleryRestriction.js#getStagePlacements (provider registrado por
 * AssignmentBadge.js). Nada aqui lê ScratchJr direto.
 *
 * Elemento da sombra (ver _buildGhost):
 *  - <img> clonado de sprite.originalImg do personagem VIVO do aluno (mesmo
 *    md5, já carregado), com o w/h/cx/cy reais dele - não depende de o
 *    servidor ter cx/cy salvos nem de baixar a imagem de novo. Personagem
 *    que o aluno ainda não pôs na cena = sem sprite pra clonar = sem sombra
 *    (ela aparece assim que ele adicionar o personagem).
 *  - SEM .owner: Stage.whoIsIt/setPageThumb/resetPage/etc. só olham filhos
 *    de page.div com .owner, então a sombra fica fora do clique/arrasto e da
 *    miniatura. pointer-events:none (assignment.css) é defesa redundante.
 *  - SEM id: Page.encodePage grava como "layer" todo filho de page.div com
 *    id - sem id, a sombra nunca entra no projeto salvo.
 *  - Inserida logo DEPOIS de page.bkg (1º filho de page.div, o fundo opaco):
 *    antes dele ficaria escondida atrás do cenário; logo depois fica abaixo
 *    de todos os personagens.
 *  - Visual (decisão de design): filtro brightness(0) + opacity 0.35 em
 *    assignment.css - uma silhueta preta translúcida lê como "sombra/lugar
 *    marcado", não como um segundo personagem de verdade (que é o que um
 *    clone só com opacidade parecia).
 *  - Escondida em tela cheia por CSS (#stage ganha a classe 'fullscreen' em
 *    UI.enterFullScreen) e removida enquanto o professor pilota o editor do
 *    aluno pelo LiveWatch (state.hidden - vidro de LiveMirror.showLockOverlay).
 */

import {registerStagePlacementGhostRenderer, getStagePlacements} from './GalleryRestriction.js';
import {nextCharacterOccurrence} from '../../../../../shared/detailedManifest.mjs';

/** Raio (px do palco 480x360) dentro do qual o personagem "chegou" na sombra. */
export const STAGE_PLACEMENT_TOLERANCE_PX = 30;

/**
 * O personagem do aluno (actual.xcoor/ycoor) está a até `tolerance` px (ver
 * STAGE_PLACEMENT_TOLERANCE_PX) da casa do professor (target.homex/homey)?
 * Distância euclidiana, só X/Y - sem ângulo (goHome zera o ângulo sempre,
 * não existe "ângulo de casa") e sem escala. Pura, sem DOM. target ausente
 * = não há sombra pra conferir: devolve false (o chamador nunca pergunta
 * sem uma sombra de verdade).
 */
export function isNearTarget (actual, target, toleranceOpts) {
    if (!actual || !target) {
        return false;
    }
    var tolerance = (toleranceOpts && Number.isFinite(toleranceOpts.tolerance)) ?
        toleranceOpts.tolerance : STAGE_PLACEMENT_TOLERANCE_PX;
    var dx = Number(actual.xcoor) - Number(target.homex);
    var dy = Number(actual.ycoor) - Number(target.homey);
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
        return false;
    }
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
}

/**
 * Casa cada sombra da cena (placements: [{characterMd5, characterOccurrence,
 * homex, homey, homescale}]) com o sprite VIVO correspondente do aluno -
 * mesmo md5 e mesma cópia (characterOccurrence), numerada com a MESMA função
 * do servidor (nextCharacterOccurrence) sobre os sprites na ordem de
 * page.sprites, só os de personagem (type 'sprite'). Pura: `sprites` é uma
 * lista ordenada de objetos com {type, md5} (os Sprite vivos, nos testes
 * objetos simples). Sombra sem cópia correspondente no aluno fica de fora.
 * Devolve [{sprite, placement}].
 */
export function matchStagePlacements (sprites, placements) {
    if (!Array.isArray(sprites) || !Array.isArray(placements) || !placements.length) {
        return [];
    }
    var seenByMd5 = new Map();
    var byKey = new Map();
    for (var i = 0; i < sprites.length; i++) {
        var spr = sprites[i];
        if (!spr || spr.type !== 'sprite') {
            continue;
        }
        var occurrence = nextCharacterOccurrence(seenByMd5, spr.md5 || null);
        if (occurrence !== null) {
            byKey.set(spr.md5 + '#' + occurrence, spr);
        }
    }
    var pairs = [];
    placements.forEach(function (placement) {
        if (!placement || !placement.characterMd5) {
            return;
        }
        var sprite = byKey.get(placement.characterMd5 + '#' + (placement.characterOccurrence || 1));
        if (sprite) {
            pairs.push({sprite: sprite, placement: placement});
        }
    });
    return pairs;
}

/**
 * Identidade de uma sombra: cena + personagem + cópia + o PRÓPRIO alvo - se
 * o professor reautorar a missão e mudar a casa do personagem, é outra
 * sombra (e uma já dispensada nesta sessão volta a aparecer no lugar novo).
 */
export function stagePlacementKey (sceneIndex, placement) {
    return [sceneIndex, placement.characterMd5, placement.characterOccurrence || 1,
        placement.homex, placement.homey].join('|');
}

/**
 * Transform da sombra - o MESMO ramo web (não-Android: isAndroid é falso no
 * navegador, lib.js) de Sprite.js#render, com ângulo 0 e sem espelhar (o que
 * goHome deixa): translate3d(x - cx, y - cy) + scale(s, s), aplicado numa
 * caixa do tamanho natural da imagem (w x h, como displaySprite dimensiona a
 * div do sprite) com transform-origin no centro (padrão do CSS). O ramo
 * Android (que redimensiona div/img e desloca por cx*scale) NÃO vale aqui.
 */
export function ghostTransform (placement, cx, cy) {
    var dx = placement.homex - cx;
    var dy = placement.homey - cy;
    var s = placement.homescale || 1;
    return 'translate3d(' + dx + 'px,' + dy + 'px, 0px) scale(' + s + ', ' + s + ')';
}

// key -> {el, page} das sombras no DOM agora (só da cena atual).
var ghosts = new Map();
// Sombras já alcançadas nesta sessão de aba - não voltam (até um F5).
var reached = new Set();
var scheduled = false;
var pendingDropped = [];

function removeGhostEl (el) {
    if (el && el.parentNode) {
        el.parentNode.removeChild(el);
    }
}

function removeAllGhosts () {
    ghosts.forEach(function (entry) {
        removeGhostEl(entry.el);
    });
    ghosts.clear();
}

/** Sprites vivos da página, na ordem de page.sprites (= ordem salva). */
function liveSpritesOf (page) {
    var ids;
    try {
        ids = JSON.parse(page.sprites);
    } catch (err) {
        return [];
    }
    var out = [];
    for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el && el.owner) {
            out.push(el.owner);
        }
    }
    return out;
}

/** O sprite já carregou imagem e geometria (displaySprite já rodou)? */
function spriteReady (spr) {
    return !!(spr.originalImg && spr.w && spr.h && Number.isFinite(spr.cx) && Number.isFinite(spr.cy));
}

function buildGhost (sprite, placement, page) {
    var el = sprite.originalImg.cloneNode(false);
    el.removeAttribute('id');
    el.className = 'stagePlacementGhost';
    el.setAttribute('aria-hidden', 'true');
    el.draggable = false;
    el.style.position = 'absolute';
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = sprite.w + 'px';
    el.style.height = sprite.h + 'px';
    el.style.transform = ghostTransform(placement, sprite.cx, sprite.cy);
    page.div.insertBefore(el, page.bkg ? page.bkg.nextSibling : page.div.firstChild);
    return el;
}

/**
 * Reconcilia as sombras do DOM com o estado atual (idempotente - pode rodar
 * a cada tick): cria as que faltam (inclusive depois de Undo/LiveMirror/
 * recarga recriarem page.div do zero), remove as que não valem mais (outra
 * cena, personagem apagado, missão concluída, LiveWatch) e confere a
 * proximidade em dois momentos: quando a sombra é desenhada pela primeira
 * vez (cobre quem já chegou no lugar sem arrastar - Undo, LiveMirror, ou o
 * personagem já nasceu ali) e quando o aluno solta um arrasto (dropped).
 * Fora isso não confere de propósito: um script onclick passando pelo alvo
 * no meio da animação não conta como "posicionou".
 */
function reconcile (dropped) {
    var state = getStagePlacements();
    if (!state || state.hidden || !state.page || !state.page.div) {
        removeAllGhosts();
        return;
    }
    var page = state.page;
    // Em tela cheia o arrasto não muda a casa (Stage.moveElementBy) - soltar
    // o personagem ali não conta como posicionar.
    var canCheck = !state.inFullscreen;
    var wanted = new Set();
    matchStagePlacements(liveSpritesOf(page), state.placements).forEach(function (pair) {
        var sprite = pair.sprite;
        var placement = pair.placement;
        var key = stagePlacementKey(state.sceneIndex, placement);
        if (reached.has(key) || !spriteReady(sprite)) {
            return;
        }
        var entry = ghosts.get(key);
        var isNew = !entry || entry.page !== page || entry.el.parentNode !== page.div;
        var justDropped = dropped.indexOf(sprite) > -1;
        if ((isNew || justDropped) && canCheck && isNearTarget(sprite, placement)) {
            reached.add(key);
            return;
        }
        if (isNew) {
            if (entry) {
                removeGhostEl(entry.el);
            }
            entry = {el: buildGhost(sprite, placement, page), page: page};
            ghosts.set(key, entry);
        }
        wanted.add(key);
    });
    ghosts.forEach(function (entry, key) {
        if (!wanted.has(key)) {
            removeGhostEl(entry.el);
            ghosts.delete(key);
        }
    });
}

/**
 * Renderer registrado em GalleryRestriction.js. Agrupa as chamadas de um
 * mesmo instante (ex.: Stage.mouseUp chama Thumbs.updatePages e depois avisa
 * o drop) numa reconciliação só, no próximo ciclo do event loop - depois
 * que quem chamou terminou de mexer no DOM.
 */
function requestRefresh (opts) {
    if (opts && opts.droppedSprite) {
        pendingDropped.push(opts.droppedSprite);
    }
    if (scheduled) {
        return;
    }
    scheduled = true;
    setTimeout(function () {
        scheduled = false;
        var dropped = pendingDropped;
        pendingDropped = [];
        try {
            reconcile(dropped);
        } catch (err) {
            // Só um guia visual - nunca deixa um erro aqui quebrar o editor.
            console.warn('[StagePlacementGhost] reconcile falhou (não-fatal):', err && err.message);
        }
    }, 0);
}

registerStagePlacementGhostRenderer(requestRefresh);
