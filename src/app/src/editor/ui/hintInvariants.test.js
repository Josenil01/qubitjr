import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {hintConditionHolds, mistakeInfo, orderInfo, decideHintAction} from './HintEngine.js';
import {computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';
import {simulateHints, isTaskHint} from '../../../../../shared/testing/hintSimulator.mjs';
import {project, b, repeat, onflag, onclick, onmessage, script} from '../../../../../shared/testing/projectFixtures.mjs';

/**
 * Invariantes do sistema de dicas rodados contra projetos REAIS (fixtures
 * ANONIMIZADOS em shared/testing/fixtures/*.json, gerados por
 * backend/scripts/exportHintFixture.js) e contra projetos sintéticos.
 *
 *  I1: no próprio projeto do professor toda dica de TAREFA está resolvida
 *      (hintConditionHolds false) e não há nenhum alerta (mistakeInfo,
 *      orderInfo, decideHintAction).
 *  I3: um aluno simulado que segue as dicas na ordem (shared/testing/
 *      hintSimulator.mjs, heurísticas documentadas lá) nunca fica sem dica
 *      proativa enquanto há tarefa pendente, cumpre cada dica, e nunca leva
 *      alerta de erro falso.
 *
 * Convenção (igual a hintRegressions.test.js): `it.fails` = falha conhecida
 * do motor, documentada; quando corrigida o teste passa a falhar e deve virar
 * `it` normal. Falhas citadas pelo número do plano de correção das dicas.
 */

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../shared/testing/fixtures');
const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    return JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
});

// Casos reais que HOJE violam um invariante (NÃO mascarados: viram it.fails
// com o motivo; quando o conserto entrar o teste passa a falhar e a entrada
// deve ser removida daqui):
// { [nome da fixture]: { [invariante]: 'motivo' } }.
const STALE = 'dica inconsistente com o projeto do professor (character_missing_block_type pedindo say no Tamandua, que o professor nao tem: dica obsoleta/gerada contra versao anterior do projeto)';
const KNOWN = {
    'anda-repete': {
        I1: 'default_character_present (h3) ainda pendente no PROPRIO projeto do professor, que mantem o HY-Ruby padrao na cena: a geracao emite a dica mesmo com o personagem presente',
        I3: 'falhas 4/5: duas dicas "hop" (h6, h8) sem minCounts -> a 2a ja nasce cumprida e orderInfo acusa "fora de ordem" falso (h7|order|h8)',
    },
    mensagens: {I1: STALE, I3: STALE},
};

function check (name, inv, body) {
    const reason = KNOWN[name] && KNOWN[name][inv];
    (reason ? it.fails : it)(`${inv}${reason ? ' [falha conhecida: ' + reason + ']' : ''}`, body);
}

describe('fixtures reais anonimizadas', () => {
    it('existem e são anonimizadas', () => {
        expect(fixtures.length).toBeGreaterThanOrEqual(3);
        fixtures.forEach((f) => {
            expect(f.source).toBe('anonimizado');
            expect(Object.keys(f).sort()).toEqual(['hints', 'name', 'projectJson', 'source']);
            expect(f.hints.every((h) => /^h\d+$/.test(h.id) && /^Dica \d+$/.test(h.text))).toBe(true);
        });
    });

    fixtures.forEach((f) => {
        describe(f.name, () => {
            const detailed = computeDetailedManifest(f.projectJson);
            const tasks = f.hints.filter(isTaskHint);

            check(f.name, 'I1', () => {
                const unresolved = tasks.filter((h) => hintConditionHolds(h, detailed)).map((h) => h.id);
                expect(unresolved).toEqual([]);
            });

            it('I1 (alertas): nenhum alerta no projeto do professor', () => {
                f.hints.forEach((h) => expect(mistakeInfo(h, detailed)).toBeNull());
                expect(orderInfo(f.hints, detailed)).toBeNull();
                const dismissed = new Set(f.hints.filter((h) => !isTaskHint(h)).map((h) => h.id));
                const decision = decideHintAction({
                    hints: f.hints, detailed, dismissed, alerted: new Set(), idleMs: 1e9, modalOpen: false, panelOpen: false,
                });
                // Sem alerta; (dica proativa so aparece se ainda houver tarefa pendente, coberto pelo I1 acima)
                expect(decision.action && decision.action.kind).not.toBe('alert');
            });

            check(f.name, 'I3', () => {
                const {failures} = simulateHints(f.projectJson, f.hints);
                expect(failures).toEqual([]);
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Projetos sintéticos: testes do próprio simulador (e de I1/I3 em casos que
// as fixtures reais não cobrem: repeat aninhado, onmessage, personagem repetido).
// ---------------------------------------------------------------------------

const SCENE = 'Woods.svg';
const RUBY = 'HY-Ruby.svg';
const CAT = 'HY-Onca.svg';

const taskWhen = (extra) => Object.assign({sceneMd5: SCENE, sceneOccurrence: 1}, extra);
const hint = (id, when) => ({id, text: 'Dica ' + id, when});

describe('simulador - projeto sintético com repeat aninhado', () => {
    const teacher = project([{md5: SCENE, sprites: [{
        md5: RUBY, name: 'A',
        scripts: [script(onflag(), b('say', 'x'), repeat(3, [b('forward', 2), b('say', 'y')]), b('wait', 5))],
    }]}]);
    const hints = [
        hint('h1', {type: 'mission_intro'}),
        hint('h2', taskWhen({type: 'scene_missing'})),
        hint('h3', taskWhen({type: 'character_missing', characterMd5: RUBY})),
        hint('h4', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['say'], trigger: 'onflag'})),
        hint('h5', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['repeat'], blockArgs: {repeat: 3}, trigger: 'onflag'})),
        hint('h6', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['forward'], blockArgs: {forward: 2}, trigger: 'onflag'})),
        hint('h7', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['wait'], blockArgs: {wait: 5}, trigger: 'onflag'})),
    ];

    it('I1 no projeto do professor', () => {
        const detailed = computeDetailedManifest(teacher);
        expect(hints.filter(isTaskHint).filter((h) => hintConditionHolds(h, detailed))).toEqual([]);
    });

    it('I3: o aluno simulado cumpre tudo, sem lacuna nem alerta falso', () => {
        const {failures, trace, student} = simulateHints(teacher, hints);
        expect(failures).toEqual([]);
        expect(trace.map((t) => t.hintId)).toEqual(['h2', 'h3', 'h4', 'h5', 'h6', 'h7']);
        // o repeat foi criado e o forward foi para DENTRO dele
        const sprite = student.page1.sprite1_1;
        const rep = sprite.scripts[0].find((blk) => blk[0] === 'repeat');
        expect(rep[1]).toBe(3);
        expect(rep[4].map((blk) => blk[0])).toContain('forward');
    });

    it('a cada passo a próxima dica proativa é a tarefa em andamento', () => {
        const {trace} = simulateHints(teacher, hints);
        trace.forEach((t) => expect(t.proactive).toBe(t.hintId));
    });

    it('controle negativo: dica impossível de cumprir é detectada (regra c)', () => {
        const bad = hints.concat([hint('h8', taskWhen({type: 'character_missing_block_type', characterMd5: CAT, blockTypes: ['grow']}))]);
        const {failures} = simulateHints(teacher, bad);
        expect(failures.map((f) => [f.hintId, f.rule])).toContainEqual(['h8', 'c']);
    });
});

describe('simulador - projeto sintético com onmessage', () => {
    const teacher = project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'A', scripts: [script(onflag(), b('say', 'x'), b('message', 'verde'))]},
        {md5: CAT, name: 'B', scripts: [script(onmessage('verde'), b('show'))]},
    ]}]);
    const hints = [
        hint('h1', {type: 'mission_intro'}),
        hint('h2', taskWhen({type: 'scene_missing'})),
        hint('h3', taskWhen({type: 'character_missing', characterMd5: RUBY})),
        hint('h4', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['message'], trigger: 'onflag'})),
        hint('h5', {type: 'message_not_received', messageName: 'verde'}),
        hint('h6', taskWhen({type: 'character_missing', characterMd5: CAT})),
        hint('h7', taskWhen({type: 'character_missing_block_type', characterMd5: CAT, blockTypes: ['show'], trigger: 'onmessage'})),
    ];

    it('I1 no projeto do professor', () => {
        const detailed = computeDetailedManifest(teacher);
        expect(hints.filter(isTaskHint).filter((h) => hintConditionHolds(h, detailed))).toEqual([]);
    });

    // Falha 8: a dica h7 pede blockTypes ['show'] com trigger 'onmessage' mas o
    // `when` não diz QUAL mensagem (when.triggerArg). O simulador cria o
    // onmessage sem mensagem ('null') e o motor aceita como cumprido - ou, com
    // o conserto da falha 8, exigirá triggerArg. Ambos resultados são
    // documentados: aqui basta não haver lacuna nem alerta falso.
    it('I3: sem lacuna nem alerta falso', () => {
        const {failures} = simulateHints(teacher, hints);
        expect(failures).toEqual([]);
    });
});

describe('simulador - personagem repetido na cena', () => {
    const teacher = project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'A', scripts: [script(onflag(), b('say', 'x'))]},
        {md5: RUBY, name: 'B', scripts: [script(onclick(), b('grow', 2))]},
    ]}]);
    const hints = [
        hint('h1', taskWhen({type: 'scene_missing'})),
        hint('h2', taskWhen({type: 'character_missing', characterMd5: RUBY})),
        hint('h3', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['say'], trigger: 'onflag'})),
        hint('h4', taskWhen({type: 'character_missing', characterMd5: RUBY})),
        hint('h5', taskWhen({type: 'character_missing_block_type', characterMd5: RUBY, blockTypes: ['grow'], blockArgs: {grow: 2}, trigger: 'onclick'})),
    ];

    // Falha 9: sem when.characterOccurrence a 2ª dica character_missing já
    // nasce resolvida (o 1º Ruby satisfaz) e o simulador nunca adiciona o 2º
    // personagem; as dicas de bloco do 2º Ruby ficam sem alvo.
    it.fails('I3 (falha 9: personagem repetido sem characterOccurrence)', () => {
        const {failures} = simulateHints(teacher, hints);
        expect(failures).toEqual([]);
    });

    it('com characterOccurrence (conserto da falha 9) o simulador monta os dois', () => {
        const fixed = hints.map((h, i) => (i >= 3 ? {...h, when: {...h.when, characterOccurrence: 2}} : h))
            .map((h) => (h.id === 'h2' || h.id === 'h3' ? {...h, when: {...h.when, characterOccurrence: 1}} : h));
        const sim = simulateHints(teacher, fixed);
        const sprites = sim.student.page1.sprites;
        expect(sprites.length).toBe(2);
    });
});
