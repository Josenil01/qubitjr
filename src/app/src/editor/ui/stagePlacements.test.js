/**
 * Sombra de posicionamento no palco:
 *  - shared/detailedManifest.mjs#buildStagePlacements (o dado, calculado no
 *    servidor a partir do projeto do professor);
 *  - StagePlacementGhost.js: funções puras (isNearTarget,
 *    matchStagePlacements, ghostTransform) - sem DOM.
 */
import {describe, it, expect} from 'vitest';
import {project, script, onflag, b} from '../../../../../shared/testing/projectFixtures.mjs';
import {buildStagePlacements, computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';
import {
    isNearTarget,
    matchStagePlacements,
    ghostTransform,
    stagePlacementKey,
    STAGE_PLACEMENT_TOLERANCE_PX,
} from './StagePlacementGhost.js';

describe('buildStagePlacements', () => {
    it('usa homex/homey/homescale (não xcoor/ycoor) e devolve um array por cena', () => {
        const p = project([{md5: 'Woods.svg', sprites: [{md5: 'Ruby.svg', homex: 100, homey: 300, homescale: 1.5}]}]);
        // Fim de uma animação testada antes de salvar - não é onde ele posicionou.
        p.page1.sprite1_1.xcoor = 400;
        p.page1.sprite1_1.ycoor = 20;
        expect(buildStagePlacements(p)).toEqual([
            [{characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 100, homey: 300, homescale: 1.5}],
        ]);
    });

    it('personagem na casa padrão (240, 180) fica de fora', () => {
        const p = project([{sprites: [{md5: 'Cat.svg'}, {md5: 'Ruby.svg', homex: 240, homey: 180}]}]);
        expect(buildStagePlacements(p)).toEqual([[]]);
    });

    it('homeshown: false fica de fora (revelaria o bloco "mostrar")', () => {
        const p = project([{sprites: [{md5: 'Ruby.svg', homex: 50, homey: 60, homeshown: false}]}]);
        expect(buildStagePlacements(p)).toEqual([[]]);
    });

    it('cópias do mesmo personagem: occurrence 1-based na ordem de page.sprites, contando também as puladas', () => {
        const p = project([{sprites: [
            {md5: 'Ruby.svg'}, // 1ª Ruby - casa padrão, pulada mas CONTA
            {md5: 'Cat.svg', homex: 10, homey: 20},
            {md5: 'Ruby.svg', homex: 300, homey: 100}, // 2ª Ruby
            {md5: 'Ruby.svg', homex: 400, homey: 200, homeshown: false}, // 3ª - escondida, pulada
            {md5: 'Ruby.svg', homex: 420, homey: 210}, // 4ª
        ]}]);
        expect(buildStagePlacements(p)[0]).toEqual([
            {characterMd5: 'Cat.svg', characterOccurrence: 1, homex: 10, homey: 20, homescale: 1},
            {characterMd5: 'Ruby.svg', characterOccurrence: 2, homex: 300, homey: 100, homescale: 1},
            {characterMd5: 'Ruby.svg', characterOccurrence: 4, homex: 420, homey: 210, homescale: 1},
        ]);
        // Mesma numeração do manifesto detalhado (fonte única: nextCharacterOccurrence).
        const rubies = computeDetailedManifest(p).scenes[0].characters.filter((c) => c.characterMd5 === 'Ruby.svg');
        expect(rubies.map((c) => c.characterOccurrence)).toEqual([1, 2, 3, 4]);
    });

    it('cenas sem fundo (sceneMd5 null) não colidem: cada uma no seu índice', () => {
        const p = project([
            {sprites: [{md5: 'Ruby.svg', homex: 10, homey: 10}]},
            {md5: 'Woods.svg', sprites: []},
            {sprites: [{md5: 'Ruby.svg', homex: 30, homey: 30}]},
        ]);
        const placements = buildStagePlacements(p);
        expect(placements).toHaveLength(3);
        expect(placements[0][0].homex).toBe(10);
        expect(placements[1]).toEqual([]);
        expect(placements[2][0].homex).toBe(30);
        // Índice alinhado ao do manifesto detalhado (que tem sceneMd5 null nas duas).
        expect(computeDetailedManifest(p).scenes.map((s) => s.sceneMd5)).toEqual([null, 'Woods.svg', null]);
    });

    it('página fantasma não indexa (mesma regra de computeDetailedManifest) e caixa de texto nunca conta', () => {
        const p = project([
            {sprites: [{md5: 'Ruby.svg', homex: 10, homey: 10}, {type: 'text'}]},
            {sprites: [{md5: 'Ruby.svg', homex: 30, homey: 30}]},
        ]);
        p.pages.splice(1, 0, 'pageFantasma');
        const placements = buildStagePlacements(p);
        expect(placements).toHaveLength(computeDetailedManifest(p).scenes.length);
        expect(placements.map((s) => s.map((x) => x.homex))).toEqual([[10], [30]]);
    });

    it('entrada inválida / casa sem coordenadas não quebra', () => {
        expect(buildStagePlacements(null)).toEqual([]);
        expect(buildStagePlacements({})).toEqual([]);
        const p = project([{sprites: [{md5: 'Ruby.svg', homex: null, homey: 50}]}]);
        expect(buildStagePlacements(p)).toEqual([[]]);
    });

    it('não altera o manifesto detalhado (characters[] sem campos de posição)', () => {
        const p = project([{sprites: [{md5: 'Ruby.svg', homex: 100, homey: 300, scripts: [script(onflag(), b('forward', 3))]}]}]);
        const character = computeDetailedManifest(p).scenes[0].characters[0];
        expect(character).not.toHaveProperty('homex');
        expect(character).not.toHaveProperty('homey');
    });
});

describe('isNearTarget', () => {
    const target = {homex: 100, homey: 100};

    it('dentro da tolerância (padrão 30px, distância euclidiana) = perto', () => {
        expect(STAGE_PLACEMENT_TOLERANCE_PX).toBe(30);
        expect(isNearTarget({xcoor: 100, ycoor: 100}, target)).toBe(true);
        expect(isNearTarget({xcoor: 118, ycoor: 124}, target)).toBe(true); // 30px exatos (18-24-30)
        expect(isNearTarget({xcoor: 122, ycoor: 122}, target)).toBe(false); // ~31.1px
    });

    it('só X/Y: ângulo, espelhamento e escala não importam', () => {
        expect(isNearTarget({xcoor: 105, ycoor: 95, angle: 90, flip: true, scale: 3}, target)).toBe(true);
    });

    it('tolerância configurável', () => {
        expect(isNearTarget({xcoor: 140, ycoor: 100}, target, {tolerance: 50})).toBe(true);
        expect(isNearTarget({xcoor: 140, ycoor: 100}, target, {tolerance: 10})).toBe(false);
    });

    it('sem alvo (ou dados inválidos) = nada a conferir', () => {
        expect(isNearTarget({xcoor: 100, ycoor: 100}, null)).toBe(false);
        expect(isNearTarget(null, target)).toBe(false);
        expect(isNearTarget({xcoor: 'x', ycoor: 100}, target)).toBe(false);
    });
});

describe('matchStagePlacements', () => {
    const ruby1 = {type: 'sprite', md5: 'Ruby.svg', id: 'r1'};
    const text = {type: 'text', id: 't'};
    const cat = {type: 'sprite', md5: 'Cat.svg', id: 'c'};
    const ruby2 = {type: 'sprite', md5: 'Ruby.svg', id: 'r2'};

    it('casa por md5 + cópia, numerando só personagens na ordem da página', () => {
        const placements = [
            {characterMd5: 'Ruby.svg', characterOccurrence: 2, homex: 1, homey: 2},
            {characterMd5: 'Cat.svg', characterOccurrence: 1, homex: 3, homey: 4},
        ];
        const pairs = matchStagePlacements([ruby1, text, cat, ruby2], placements);
        expect(pairs.map((p) => p.sprite.id)).toEqual(['r2', 'c']);
        expect(pairs[0].placement).toBe(placements[0]);
    });

    it('sombra sem cópia correspondente no aluno (ainda não adicionou) fica de fora', () => {
        const placements = [{characterMd5: 'Ruby.svg', characterOccurrence: 2, homex: 1, homey: 2}];
        expect(matchStagePlacements([ruby1], placements)).toEqual([]);
        expect(matchStagePlacements([ruby1], [])).toEqual([]);
        expect(matchStagePlacements([], null)).toEqual([]);
    });
});

describe('ghostTransform / stagePlacementKey', () => {
    it('mesmo ramo web de Sprite.render (ângulo 0, sem espelhar): translate(home - c) + scale(homescale)', () => {
        expect(ghostTransform({homex: 100, homey: 300, homescale: 1.5}, 40, 50))
            .toBe('translate3d(60px,250px, 0px) scale(1.5, 1.5)');
        expect(ghostTransform({homex: 10, homey: 20}, 5, 5)).toBe('translate3d(5px,15px, 0px) scale(1, 1)');
    });

    it('a chave muda quando o professor move o alvo (sombra dispensada volta no lugar novo)', () => {
        const a = stagePlacementKey(0, {characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 1, homey: 2});
        const b2 = stagePlacementKey(0, {characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 9, homey: 2});
        const c = stagePlacementKey(1, {characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 1, homey: 2});
        expect(new Set([a, b2, c]).size).toBe(3);
    });
});
