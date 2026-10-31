/**
 * shared/testing/projectFixtures.mjs
 *
 * Montador SINTÉTICO de projectJson (o objeto JÁ parseado que
 * computeProjectManifest/computeDetailedManifest esperam - ver docblocks de
 * shared/assignmentScoring.mjs e shared/detailedManifest.mjs). Puro, sem I/O,
 * ESM: o vitest do frontend importa direto e o jest do backend também (o
 * jest.config.js do backend transforma .mjs via babel).
 *
 * REGRA R1: este arquivo é SÓ DE TESTE. NUNCA importe de código de produção
 * (backend/src não-teste, api/, src/app/src não-teste, outros shared/*.mjs).
 * Em produção (Vercel) o `require()` de .mjs só funciona para o que api/index.js
 * pré-carrega em SHARED_ESM_SPECIFIERS; um import daqui derrubaria a função no
 * cold start. backend/src/apiPreload.test.js falha se alguém violar isso.
 *
 * Formato do projeto (conferido nos walkers reais):
 *   { pages: [pageId], [pageId]: { sprites: [spriteId], md5, [spriteId]:
 *     { type: 'sprite', md5, name, scripts: [ [bloco, ...] ] } } }
 * Bloco = tupla [tipo, argumento, x, y, subScript?]. script[0] é o gatilho
 * (onflag/onclick/ontouch/onmessage) ou, num script "solto", um bloco comum.
 * O sub-script de um `repeat` mora no índice 4 da própria tupla.
 */

/**
 * Tupla de bloco no formato real: [tipo, arg, 0, 0]. `arg` pode ser número,
 * texto (say), nome de mensagem (message/onmessage), 'null' ou
 * 'unconfirmed:<n>' (valor padrão ainda não confirmado, ver Project.js).
 * `nested` (opcional) é o sub-script, só usado por repeat.
 */
export function b (type, arg, nested) {
    const tuple = [type, arg === undefined ? null : arg, 0, 0];
    if (nested !== undefined) tuple.push(nested);
    return tuple;
}

/** repeat(n, [blocos]) - tupla de repeat com o sub-script no índice 4. */
export function repeat (n, inner) {
    return b('repeat', n, inner || []);
}

/** Gatilhos prontos: onflag(), onclick(), ontouch(), onmessage('nome'). */
export const onflag = () => b('onflag');
export const onclick = () => b('onclick');
export const ontouch = () => b('ontouch');
export const onmessage = (name) => b('onmessage', name);

/** Script completo: gatilho + blocos. script(onflag(), b('forward', 3)). */
export function script (...blocks) {
    return blocks;
}

/**
 * Monta o projectJson. pages: [{md5, sprites:[{md5, name, scripts, type?,
 * homex?, homey?, homescale?, homeshown?}]}].
 * Ids de página/sprite são determinísticos (page1.., sprite<pagina>_<n>).
 * Cada `scripts` é um array de scripts (cada script um array de blocos).
 * homex/homey/homescale/homeshown (opcionais - casa do personagem, ver
 * detailedManifest.mjs#buildStagePlacements): omitidos, valem o mesmo que
 * Page.js#addSprite grava num personagem recém-adicionado (240, 180, a
 * escala do sprite, visível). xcoor/ycoor acompanham a casa (é onde o
 * personagem está depois de goHome).
 */
export function project (pages) {
    const out = {pages: [], currentPage: null};
    (pages || []).forEach(function (p, pi) {
        const pageId = 'page' + (pi + 1);
        out.pages.push(pageId);
        if (pi === 0) out.currentPage = pageId;
        const sprites = p.sprites || [];
        const page = {textstartat: 0, sprites: [], num: 1, lastSprite: null};
        if (p.md5) page.md5 = p.md5;
        sprites.forEach(function (s, si) {
            const spriteId = 'sprite' + (pi + 1) + '_' + (si + 1);
            page.sprites.push(spriteId);
            if (si === 0) page.lastSprite = spriteId;
            const homex = s.homex === undefined ? 240 : s.homex;
            const homey = s.homey === undefined ? 180 : s.homey;
            const data = {
                shown: true,
                type: s.type || 'sprite',
                id: spriteId,
                flip: false,
                name: s.name || spriteId,
                angle: 0,
                scale: 1,
                speed: 1,
                homex: homex,
                homey: homey,
                homescale: s.homescale === undefined ? 1 : s.homescale,
                homeshown: s.homeshown === undefined ? true : s.homeshown,
                xcoor: homex,
                ycoor: homey,
                scripts: s.scripts || [],
            };
            if (s.md5) data.md5 = s.md5;
            page[spriteId] = data;
        });
        out[pageId] = page;
    });
    return out;
}
