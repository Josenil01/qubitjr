import {describe, expect, it} from 'vitest';
import {
    decideHintAction,
    nextProactiveHint,
    IDLE_BEFORE_HINT_MS,
    ALERT_IDLE_MS,
} from './HintEngine.js';
import {project, b, onflag, onclick} from '../../../../../shared/testing/projectFixtures.mjs';
import {computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';

/**
 * Testes de CARACTERIZAÇÃO de HintEngine.js#decideHintAction (Fase 1, R4):
 * fixam o comportamento que AssignmentBadge.js#_evaluateHints tinha antes da
 * extração - prioridade alerta > dica, esperas de ociosidade, guardas de
 * modal/painel, pontinho do botão. Projetos sintéticos via
 * shared/testing/projectFixtures.mjs + computeDetailedManifest (o mesmo
 * caminho que o editor usa em produção).
 */

const SCENE = 'Woods.svg';
const CHAR = 'HY-Ruby.svg';
const LONG_IDLE = 60000;

function detailedFor (scripts) {
    return computeDetailedManifest(project([
        {md5: SCENE, sprites: [{md5: CHAR, name: 'Ruby', scripts}]},
    ]));
}

function blockHint (id, extra) {
    return {
        id: id,
        text: 'texto ' + id,
        when: Object.assign({
            type: 'character_missing_block_type',
            sceneMd5: SCENE,
            characterMd5: CHAR,
            blockTypes: ['forward'],
        }, extra),
    };
}

const intro = {id: 'h1', text: 'Bem-vindo', when: {type: 'mission_intro'}};

/** Chamada com defaults "tudo livre" - cada teste sobrescreve o que importa. */
function decide (overrides) {
    return decideHintAction(Object.assign({
        hints: [],
        detailed: detailedFor([[onflag()]]),
        dismissed: new Set(),
        alerted: new Set(),
        idleMs: LONG_IDLE,
        modalOpen: false,
        panelOpen: false,
    }, overrides));
}

describe('decideHintAction - caracterização do _evaluateHints antigo', () => {
    it('missão sem dicas: não mexe no pontinho nem mostra nada', () => {
        expect(decide({hints: []})).toEqual({buttonDot: null, action: null});
        expect(decide({hints: undefined})).toEqual({buttonDot: null, action: null});
    });

    it('dica pronta e aluno ocioso: mostra a dica proativa e liga o pontinho', () => {
        const d = decide({hints: [intro, blockHint('h2')]});
        expect(d.buttonDot).toBe(true);
        expect(d.action).toEqual({kind: 'hint', hint: intro});
    });

    it('ociosidade insuficiente: pontinho ligado, nada mostrado ainda', () => {
        const d = decide({hints: [intro], idleMs: IDLE_BEFORE_HINT_MS - 1});
        expect(d).toEqual({buttonDot: true, action: null});
        // Exatamente no limite já mostra (comparação era `<`).
        expect(decide({hints: [intro], idleMs: IDLE_BEFORE_HINT_MS}).action.kind).toBe('hint');
    });

    it('modal aberto: pontinho ligado, nada mostrado', () => {
        expect(decide({hints: [intro], modalOpen: true})).toEqual({buttonDot: true, action: null});
    });

    it('painel aberto: pontinho ligado, nada mostrado', () => {
        expect(decide({hints: [intro], panelOpen: true})).toEqual({buttonDot: true, action: null});
    });

    it('tarefa já cumprida não é proativa; sem nada pendente o pontinho apaga', () => {
        const detailed = detailedFor([[onflag(), b('forward', 3)]]);
        expect(decide({hints: [blockHint('h2')], detailed})).toEqual({buttonDot: false, action: null});
    });

    it('a dica proativa é a 1ª pendente na ordem, mesmo com uma posterior pendente', () => {
        const hints = [blockHint('h2'), blockHint('h3', {blockTypes: ['up']})];
        expect(decide({hints}).action.hint.id).toBe('h2');
    });

    it('alerta de valor errado: kind alert, spokenHint = a própria dica', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        const d = decide({hints: [hint], detailed, idleMs: ALERT_IDLE_MS});
        expect(d.action.kind).toBe('alert');
        expect(d.action.hint).toBe(hint);
        expect(d.action.spokenHint).toBe(hint);
        expect(d.action.info).toEqual({kind: 'value', sig: 'h2|value|forward=5'});
        // h2 está pendente (valor errado) e não dispensada: pontinho ligado.
        expect(d.buttonDot).toBe(true);
    });

    it('alerta tem prioridade sobre a dica proativa, e espera só ALERT_IDLE_MS', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        // Intro pronta, mas o alerta passa na frente.
        expect(decide({hints: [intro, hint], detailed}).action.kind).toBe('alert');
        // Alerta pendente mas ainda sem a ociosidade dele: NADA aparece (a
        // proativa não "passa na frente" do alerta).
        expect(decide({hints: [intro, hint], detailed, idleMs: ALERT_IDLE_MS - 1}))
            .toEqual({buttonDot: true, action: null});
    });

    it('alerta de bloco zerado (fill) usa o idleMs próprio do info', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 'unconfirmed:0')]]);
        const early = decide({hints: [hint], detailed, idleMs: ALERT_IDLE_MS});
        expect(early.action).toBe(null);
        const d = decide({hints: [hint], detailed, idleMs: 2000});
        expect(d.action.kind).toBe('alert');
        expect(d.action.info.kind).toBe('fill');
    });

    it('alerta já avisado (sig em alerted) não repete; cai pra dica proativa', () => {
        const hint = blockHint('h2', {blockArgs: {forward: 3}});
        const detailed = detailedFor([[onflag(), b('forward', 5)]]);
        const d = decide({hints: [hint], detailed, alerted: new Set(['h2|value|forward=5'])});
        expect(d.action).toEqual({kind: 'hint', hint});
        // Já avisado E dispensado: nada.
        const none = decide({
            hints: [hint], detailed,
            alerted: new Set(['h2|value|forward=5']),
            dismissed: new Set(['h2']),
        });
        expect(none).toEqual({buttonDot: false, action: null});
    });

    it('alerta de fora de ordem: hint = a posterior montada, spokenHint = a pendente pulada', () => {
        const first = blockHint('h2', {blockTypes: ['forward'], trigger: 'onflag'});
        const later = blockHint('h3', {blockTypes: ['up'], trigger: 'onclick'});
        const detailed = detailedFor([[onflag()], [onclick(), b('up', 2)]]);
        const d = decide({hints: [first, later], detailed, dismissed: new Set(['h2'])});
        expect(d.action.kind).toBe('alert');
        expect(d.action.info.kind).toBe('order');
        expect(d.action.info.sig).toBe('h2|order|h3');
        expect(d.action.hint).toBe(later);
        expect(d.action.spokenHint).toBe(first);
        // Ordem já avisada: nada (h2 dispensada trava a proativa).
        const none = decide({
            hints: [first, later], detailed,
            dismissed: new Set(['h2']),
            alerted: new Set(['h2|order|h3']),
        });
        expect(none).toEqual({buttonDot: false, action: null});
    });

    it('não modifica os Sets recebidos', () => {
        const dismissed = new Set(['x']);
        const alerted = new Set(['y']);
        decide({hints: [intro, blockHint('h2')], dismissed, alerted});
        expect([...dismissed]).toEqual(['x']);
        expect([...alerted]).toEqual(['y']);
    });

    // Bug P1 (telemetria: 88 de 93 pares fecharam a intro, só 2 receberam
    // qualquer dica proativa depois). muda no commit 2.
    it('CARACTERIZA O BUG P1: intro dispensada + tarefa pendente => nenhuma proativa', () => {
        const hints = [intro, blockHint('h2')];
        const dismissed = new Set(['h1']);
        expect(nextProactiveHint(hints, detailedFor([[onflag()]]), dismissed)).toBe(null);
        expect(decide({hints, dismissed})).toEqual({buttonDot: false, action: null});
    });
});
