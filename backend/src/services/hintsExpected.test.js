'use strict';

/**
 * hintsExpected.test.js - Fase 3 (E6b): o GERADOR emite when.expected.
 *
 * Cobre buildExpectedForHints (pura, também usada pela migração) e o
 * pipeline inteiro generateHints com a LLM mockada (mesmo mock de `openai`
 * de hintsGeneration.test.js - nunca bate na rede). Projetos sintéticos de
 * shared/testing/projectFixtures.mjs.
 *
 * I6 (determinismo): __fixtures__/hintsE6b.llm.json é uma resposta de LLM
 * GRAVADA (formato real: {intro, hints:[{text, when}]} com scriptRef/
 * blockIndices) e __fixtures__/hintsE6b.expected.json é a saída esperada do
 * gerador pra ela. Se uma mudança INTENCIONAL de regra alterar a saída,
 * regrave o .expected.json conferindo o diff à mão.
 */

const fs = require('fs');
const path = require('path');

const mockCreate = jest.fn();
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
})));

const { generateHints, buildExpectedForHints, buildTranscript } = require('./hintsGeneration');
const { computeDetailedManifest, scriptTokens } = require('./detailedManifest');
const { evaluateExpectedHints } = require('./hintAlignment');
const fx = require('../../../shared/testing/projectFixtures.mjs');

const SCENE = 'Woods.svg';
const RUBY = 'HY-Ruby.svg';
const ALLAN = 'HY-Allan.svg';

/**
 * Ruby (personagem do professor):
 *   S1 onflag:  say "Oi", hop 2, hop 4, repeat 3 { forward 1 }, forward 5
 *     tokens:   #1 say  #2 hop[2]  #3 hop[4]  #4 repeat[3] { #5 forward[1] #6 }  #7 forward[5]
 *   S2 onmessage azul:  grow 2
 *   S3 onmessage verde: grow 4
 * Allan: S1 onclick: message azul
 * hop com dois valores (F5), dois hops seguidos (F4), repeat, duas mensagens (R2).
 */
function rubyScripts() {
    return [
        [fx.onflag(), fx.b('say', 'Oi'), fx.b('hop', 2), fx.b('hop', 4), fx.repeat(3, [fx.b('forward', 1)]), fx.b('forward', 5)],
        [fx.onmessage('azul'), fx.b('grow', 2)],
        [fx.onmessage('verde'), fx.b('grow', 4)],
    ];
}

function teacherProject() {
    return fx.project([{ md5: SCENE, sprites: [
        { md5: RUBY, name: 'Ruby', scripts: rubyScripts() },
        { md5: ALLAN, name: 'Allan', scripts: [[fx.onclick(), fx.b('message', 'azul')]] },
    ] }]);
}

const blockHint = (blockTypes, extra, characterMd5) => ({
    text: 't',
    when: { type: 'character_missing_block_type', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: characterMd5 || RUBY, blockTypes, ...extra },
});

function mockLlmResponse(content) {
    mockCreate.mockResolvedValue({ choices: [{ message: { content } }] });
}

const blockHintsOf = (hints) => hints.filter((h) => h.when.type === 'character_missing_block_type');

describe('buildTranscript - scripts numerados (E6b)', () => {
    it('numera os blocos de cada script com o índice+1 dos tokens, incluindo o fechamento do repeat', () => {
        const project = teacherProject();
        const transcript = buildTranscript(computeDetailedManifest(project), project);
        expect(transcript).toContain('      S1 (onflag): #1 say["Oi"] #2 hop[2] #3 hop[4] #4 repeat[3] { #5 forward[1] #6 } #7 forward[5]');
        expect(transcript).toContain('      S2 (onmessage["azul"]): #1 grow[2]');
        expect(transcript).toContain('      S3 (onmessage["verde"]): #1 grow[4]');
        expect(transcript).toContain('      S1 (onclick): #1 message["azul"]');
        // A "sequência" achatada continua lá (mesmo formato de antes).
        expect(transcript).toContain('sequência: onflag → say["Oi"] → hop[2]');
    });

    it('"#N" é exatamente a posição N-1 de scriptTokens() do script cru', () => {
        const toks = scriptTokens(rubyScripts()[0]);
        expect(toks.map((t) => t.type)).toEqual(['say', 'hop', 'hop', 'repeat', 'forward', '/repeat', 'forward']);
        expect(toks[4]).toEqual({ type: 'forward', num: 1 }); // "#5 forward[1]"
    });

    it('sem projectJson cai pro rótulo tipo[valor] (sem texto do say), sem quebrar', () => {
        const transcript = buildTranscript(computeDetailedManifest(teacherProject()));
        expect(transcript).toContain('S1 (onflag): #1 say[(texto padrão)] #2 hop[2]');
    });

    it('o prompt manda a LLM devolver scriptRef/blockIndices pelo transcript', async () => {
        process.env.DEEPSEEK_API_KEY = 'fake-test-key';
        mockCreate.mockReset();
        mockLlmResponse(JSON.stringify({ hints: [] }));
        await generateHints(teacherProject());
        const call = mockCreate.mock.calls[0][0];
        expect(call.messages[0].content).toContain('REGRA DE SCRIPTS NUMERADOS');
        expect(call.messages[1].content).toContain('S1 (onflag): #1 say["Oi"]');
    });
});

describe('buildExpectedForHints', () => {
    const project = teacherProject();
    const S1 = scriptTokens(rubyScripts()[0]);

    it('blockIndices válidos -> covered = índices-1, script do projeto, legado coerente', () => {
        const { hints, report } = buildExpectedForHints(
            [blockHint(['repeat', 'forward'], { scriptRef: 'S1', blockIndices: [4, 5] })], project);
        const when = hints[0].when;
        expect(when.expected).toEqual({ trigger: 'onflag', triggerArg: null, script: S1, covered: [3, 4] });
        expect(report).toEqual([{ index: 0, status: 'expected', source: 'llm' }]);
        expect(when.trigger).toBe('onflag');
        expect(when.blockTypes).toEqual(['repeat', 'forward']);
        // Ponteiros da LLM nunca ficam gravados.
        expect('scriptRef' in when).toBe(false);
        expect('blockIndices' in when).toBe(false);
    });

    it('aceita scriptRef numérico ou "s2" minúsculo', () => {
        const { hints } = buildExpectedForHints([
            blockHint(['grow'], { scriptRef: 3, blockIndices: [1] }),
            blockHint(['grow'], { scriptRef: 's2', blockIndices: [1] }),
        ], project);
        expect(hints[0].when.expected).toMatchObject({ trigger: 'onmessage', triggerArg: 'verde', covered: [0] });
        expect(hints[1].when.expected).toMatchObject({ trigger: 'onmessage', triggerArg: 'azul', covered: [0] });
    });

    it('índices inválidos (fora do intervalo, não-inteiro, tipo fora de blockTypes, fechamento do repeat) -> fallback por tipos', () => {
        const { hints, report } = buildExpectedForHints(
            [blockHint(['hop'], { scriptRef: 'S1', blockIndices: [99, 0, 2.5, 'x', 1, 6] })], project);
        // Sem dica posterior pedindo hop: absorve os dois hops (regra 4).
        expect(hints[0].when.expected.covered).toEqual([1, 2]);
        expect(report[0]).toMatchObject({ status: 'expected', source: 'fallback' });
    });

    it('scriptRef inválido -> fallback', () => {
        const { hints, report } = buildExpectedForHints([blockHint(['grow'], { scriptRef: 'S9', blockIndices: [1] })], project);
        expect(hints[0].when.expected).toMatchObject({ triggerArg: 'azul', covered: [0] });
        expect(report[0].source).toBe('fallback');
    });

    it('índice válido só de PARTE dos tipos: o tipo que faltou ganha a posição pelo fallback no mesmo script', () => {
        const { hints } = buildExpectedForHints([blockHint(['repeat', 'forward'], { scriptRef: 'S1', blockIndices: [4] })], project);
        // forward livre no S1: #5 (dentro do repeat) e #7 - sem dica posterior, os dois.
        expect(hints[0].when.expected.covered).toEqual([3, 4, 6]);
    });

    it('F4: duas dicas "hop" seguidas sem índices -> a 1ª cobre o 1º hop e a 2ª o 2º', () => {
        const { hints } = buildExpectedForHints([blockHint(['hop']), blockHint(['hop'])], project);
        expect(hints[0].when.expected.covered).toEqual([1]);
        expect(hints[1].when.expected.covered).toEqual([2]);
        // Legado coerente: a 2ª é a 2ª ocorrência de hop sob a bandeira.
        expect(hints[0].when.minCounts).toBeUndefined();
        expect(hints[1].when.minCounts).toEqual({ hop: 2 });
    });

    it('F4: a LLM aponta o MESMO bloco nas duas dicas -> a posterior perde a posição e fica com o hop livre', () => {
        const { hints } = buildExpectedForHints([
            blockHint(['hop'], { scriptRef: 'S1', blockIndices: [2] }),
            blockHint(['hop'], { scriptRef: 'S1', blockIndices: [2] }),
        ], project);
        expect(hints[0].when.expected.covered).toEqual([1]);
        expect(hints[1].when.expected.covered).toEqual([2]);
    });

    it('F5: mesmo bloco com valores diferentes -> cada dica cobre a SUA posição e o valor vai em script', () => {
        const { hints } = buildExpectedForHints([
            blockHint(['hop'], { scriptRef: 'S1', blockIndices: [2] }),
            blockHint(['hop'], { scriptRef: 'S1', blockIndices: [3] }),
        ], project);
        const [a, b] = hints.map((h) => h.when.expected);
        expect(a.script[a.covered[0]]).toEqual({ type: 'hop', num: 2 });
        expect(b.script[b.covered[0]]).toEqual({ type: 'hop', num: 4 });
        // blockArgs legado continua só pra valor inequívoco (F5 = ambíguo).
        expect(hints[0].when.blockArgs).toBeUndefined();
    });

    it('R2: onmessage com duas mensagens - o fallback ancora no script certo e o legado concorda', () => {
        const { hints } = buildExpectedForHints([blockHint(['grow']), blockHint(['grow'])], project);
        expect(hints[0].when.expected).toMatchObject({ trigger: 'onmessage', triggerArg: 'azul', covered: [0], script: [{ type: 'grow', num: 2 }] });
        expect(hints[1].when.expected).toMatchObject({ trigger: 'onmessage', triggerArg: 'verde', covered: [0], script: [{ type: 'grow', num: 4 }] });
        expect(hints[0].when).toMatchObject({ trigger: 'onmessage', triggerArg: 'azul' });
        expect(hints[1].when).toMatchObject({ trigger: 'onmessage', triggerArg: 'verde' });
        // grow existe sob as DUAS mensagens -> não é exclusivo de nenhuma.
        expect(hints[0].when.triggerExclusive).toBeUndefined();
        // Cada uma é a 1ª grow do SEU escopo (gatilho+mensagem) - sem minCounts.
        expect(hints[1].when.minCounts).toBeUndefined();
    });

    it('repeat: cobre abertura e corpo; aluno com o forward FORA do repeat não resolve a dica', () => {
        const { hints } = buildExpectedForHints([
            blockHint(['say']), blockHint(['hop']), blockHint(['hop']),
            blockHint(['repeat', 'forward'], { scriptRef: 'S1', blockIndices: [4, 5] }),
            blockHint(['forward'], { scriptRef: 'S1', blockIndices: [7] }),
        ], project);
        hints.forEach((h, i) => { h.id = 'h' + i; });
        expect(hints[3].when.expected.covered).toEqual([3, 4]);
        expect(hints[4].when.expected.covered).toEqual([6]);
        const student = fx.project([{ md5: SCENE, sprites: [{ md5: RUBY, scripts: [
            [fx.onflag(), fx.b('say', 'Oi'), fx.b('hop', 2), fx.b('hop', 4), fx.repeat(3, []), fx.b('forward', 1), fx.b('forward', 5)],
        ] }] }]);
        const results = evaluateExpectedHints(hints, computeDetailedManifest(student));
        expect(results.get('h3').state).not.toBe('done');
        expect(results.get('h0').state).toBe('done');
    });

    it('regra 4b: a absorção para antes do bloco de uma dica posterior', () => {
        const p = fx.project([{ md5: SCENE, sprites: [{ md5: RUBY, name: 'Ruby', scripts: [
            [fx.onflag(), fx.b('say', 'a'), fx.b('say', 'b'), fx.b('message', 'x'), fx.b('say', 'c')],
        ] }] }]);
        const { hints } = buildExpectedForHints([blockHint(['say']), blockHint(['message'])], p);
        // 1ª dica: os dois says ANTES do message (o 'c' depois dele fica sem dica).
        expect(hints[0].when.expected.covered).toEqual([0, 1]);
        expect(hints[1].when.expected.covered).toEqual([2]);
    });

    it('blockTypes só com o gatilho -> covered [] ("crie o script")', () => {
        const { hints } = buildExpectedForHints([blockHint(['onmessage'], { scriptRef: 'S3' })], project);
        expect(hints[0].when.expected).toMatchObject({ trigger: 'onmessage', triggerArg: 'verde', covered: [] });
        expect(hints[0].when.blockTypes).toEqual(['onmessage']);
    });

    it('tipos em scripts diferentes (nenhum script tem todos) -> dica legada intacta', () => {
        const input = [blockHint(['hop', 'grow'], { trigger: 'x', minCounts: { hop: 9 } })];
        const { hints, report } = buildExpectedForHints(input, project);
        expect(hints[0].when.expected).toBeUndefined();
        expect(hints[0].when.minCounts).toEqual({ hop: 9 }); // não mexe no legado
        expect(report[0]).toEqual({ index: 0, status: 'legacy', reason: 'no_script' });
    });

    it('occurrence só com 2+ scripts idênticos (mesmo gatilho/mensagem/tokens)', () => {
        const p = fx.project([{ md5: SCENE, sprites: [{ md5: RUBY, name: 'Ruby', scripts: [
            [fx.onflag(), fx.b('forward', 3)],
            [fx.onflag(), fx.b('forward', 3)],
            [fx.onclick(), fx.b('forward', 3)],
        ] }] }]);
        const { hints, report } = buildExpectedForHints([blockHint(['forward']), blockHint(['forward']), blockHint(['forward'])], p);
        expect(hints.map((h) => h.when.expected.occurrence)).toEqual([1, 2, undefined]);
        expect(report.every((r) => r.status === 'expected')).toBe(true);
    });

    it('validação (I1): dica que não dá done no projeto do professor perde o expected e volta ao legado exato', () => {
        // S1 onflag [hop 1, forward 2], S2 onflag [forward 2]. A 1ª dica
        // aponta o forward do S2; no alinhamento guloso o grupo dela é
        // avaliado primeiro e empata S1/S2 -> fica com S1, e o grupo do S1
        // (dica de hop) recebe o S2 do professor: hop "pending". O gerador
        // detecta e devolve a dica do hop ao caminho legado.
        const p = fx.project([{ md5: SCENE, sprites: [{ md5: RUBY, name: 'Ruby', scripts: [
            [fx.onflag(), fx.b('hop', 1), fx.b('forward', 2)],
            [fx.onflag(), fx.b('forward', 2)],
        ] }] }]);
        const legacyWhen = { ...blockHint(['hop']).when, trigger: 'onflag', triggerExclusive: true };
        const { hints, report } = buildExpectedForHints([
            blockHint(['forward'], { scriptRef: 'S2', blockIndices: [1] }),
            { text: 't', when: legacyWhen },
        ], p);
        expect(report[0]).toMatchObject({ status: 'expected' });
        expect(report[1]).toMatchObject({ status: 'legacy', reason: 'not_done' });
        expect(hints[1].when).toEqual(legacyWhen);
        // O que sobrou com expected dá done.
        hints.forEach((h, i) => { h.id = 'h' + i; });
        const results = evaluateExpectedHints(hints, computeDetailedManifest(p));
        expect([...results.values()].map((r) => r.state)).toEqual(['done']);
    });

    it('a LLM nunca injeta valor: expected/blockArgs inventados são ignorados, num vem do projeto', () => {
        const fake = { trigger: 'onclick', triggerArg: null, script: [{ type: 'hop', num: 99 }], covered: [0] };
        const { hints } = buildExpectedForHints([
            blockHint(['hop'], { scriptRef: 'S1', blockIndices: [2], expected: fake, blockArgs: { hop: 99 } }),
            { text: 'cena', when: { type: 'scene_missing', sceneMd5: SCENE, expected: fake, blockIndices: [1] } },
        ], project);
        expect(hints[0].when.expected.script).toEqual(S1);
        expect(hints[0].when.expected.script[1]).toEqual({ type: 'hop', num: 2 });
        expect(hints[0].when.blockArgs).toEqual({}); // 99 não bate com a posição coberta
        expect(hints[1].when).toEqual({ type: 'scene_missing', sceneMd5: SCENE });
    });

    it('não muta a entrada e é determinística', () => {
        const input = [blockHint(['hop'], { scriptRef: 'S1', blockIndices: [2] }), blockHint(['grow'])];
        const snapshot = JSON.parse(JSON.stringify(input));
        const a = buildExpectedForHints(input, project);
        const b = buildExpectedForHints(input, project);
        expect(input).toEqual(snapshot);
        expect(a).toEqual(b);
    });

    it('reconcileLegacy:false preserva os campos legados', () => {
        const { hints } = buildExpectedForHints([blockHint(['hop'], { minCounts: { hop: 7 } })], project, { reconcileLegacy: false });
        expect(hints[0].when.minCounts).toEqual({ hop: 7 });
        expect(hints[0].when.expected.covered).toEqual([1, 2]);
    });

    it('migração (fixtures anonimizados, sem ponteiros): toda dica com expected dá done no projeto do professor', () => {
        const dir = path.join(__dirname, '../../../shared/testing/fixtures');
        for (const file of fs.readdirSync(dir)) {
            const fixture = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
            const { hints, report } = buildExpectedForHints(fixture.hints, fixture.projectJson);
            expect(report.some((r) => r.status === 'expected')).toBe(true);
            expect(report.filter((r) => r.reason === 'not_done')).toEqual([]);
            const results = evaluateExpectedHints(hints, computeDetailedManifest(fixture.projectJson));
            for (const r of results.values()) expect(r.state).toBe('done');
        }
    });
});

describe('generateHints - when.expected no pipeline (E6b)', () => {
    const ORIGINAL_KEY = process.env.DEEPSEEK_API_KEY;
    const FIXTURE_DIR = path.join(__dirname, '__fixtures__');
    const recordedLlm = fs.readFileSync(path.join(FIXTURE_DIR, 'hintsE6b.llm.json'), 'utf8');
    const recordedOutput = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'hintsE6b.expected.json'), 'utf8'));

    beforeEach(() => {
        mockCreate.mockReset();
        process.env.DEEPSEEK_API_KEY = 'fake-test-key';
    });

    afterAll(() => {
        if (ORIGINAL_KEY === undefined) delete process.env.DEEPSEEK_API_KEY;
        else process.env.DEEPSEEK_API_KEY = ORIGINAL_KEY;
    });

    it('I1: toda dica gerada com expected dá done no projeto do professor', async () => {
        mockLlmResponse(recordedLlm);
        const project = teacherProject();
        const { hints } = await generateHints(project, '', 'Ruby e Allan');
        const withExpected = blockHintsOf(hints).filter((h) => h.when.expected);
        expect(withExpected.length).toBeGreaterThan(0);
        const results = evaluateExpectedHints(hints, computeDetailedManifest(project));
        expect(results.size).toBe(withExpected.length);
        for (const r of results.values()) expect(r.state).toBe('done');
        // Nenhum ponteiro da LLM sobra gravado.
        for (const h of hints) {
            expect('scriptRef' in h.when).toBe(false);
            expect('blockIndices' in h.when).toBe(false);
        }
    });

    it('I6: regenerar com a resposta de LLM gravada é determinístico e bate com a saída gravada', async () => {
        mockLlmResponse(recordedLlm);
        const first = await generateHints(teacherProject(), '', 'Ruby e Allan');
        mockLlmResponse(recordedLlm);
        const second = await generateHints(teacherProject(), '', 'Ruby e Allan');
        expect(second).toEqual(first);
        expect(first).toEqual(recordedOutput);
    });
});
