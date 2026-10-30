import {describe, expect, it} from 'vitest';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {
    hintConditionHolds,
    mistakeInfo,
    orderInfo,
    decideHintAction,
    nextProactiveHint,
    expectedResultsFor,
    alignmentInfo,
    legacyShadowedByExpected,
    freshAlignmentTarget,
    resolveLiveBlock,
    alertText,
    blockLabel,
    ALERT_IDLE_MS,
} from './HintEngine.js';
import {computeDetailedManifest, scriptTokens, tokenizeScript, REPEAT_CLOSE} from '../../../../../shared/detailedManifest.mjs';
import {simulateHints} from '../../../../../shared/testing/hintSimulator.mjs';
import {project, b, repeat, onflag, onclick, onmessage, script} from '../../../../../shared/testing/projectFixtures.mjs';

/**
 * Fase 3 (E6c) - o CLIENTE usando o alinhamento (dicas com when.expected).
 * Invariantes I4/I5 no nível de AÇÃO (decideHintAction), R3 (estados
 * pendente/zerado herdados, missão mista sem alerta duplicado, orderInfo só
 * entre legadas), R8 (alvo do pisca recalculado + mapeamento pro bloco vivo),
 * textos dos alertas e o simulador exato (I3).
 *
 * As dicas com expected são montadas por expectedHintsFor (helper DE TESTE,
 * abaixo) a partir do projeto do professor com scriptTokens - o mesmo
 * tokenizador que o gerador usa. As fixtures reais (shared/testing/
 * fixtures/*.json) trazem dicas LEGADAS; aqui só o projectJson delas é usado.
 */

const SCENE = 'Woods.svg';
const RUBY = 'HY-Ruby.svg';
const CAT = 'HY-Onca.svg';
const LONG_IDLE = 1e9;

const TRIGGERS = new Set(['onflag', 'onclick', 'ontouch', 'onmessage']);
const CARETS = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);

const clone = (x) => JSON.parse(JSON.stringify(x));

function headOf (s) {
    return s.find((blk) => Array.isArray(blk) && blk.length > 0 && !CARETS.has(blk[0])) || null;
}

/**
 * Helper de TESTE: uma dica com when.expected por posição de cada script com
 * gatilho do professor ("uma ação por dica"), covered [i]; script sem blocos
 * vira uma dica covered []. characterOccurrence só com cópias repetidas na
 * cena; occurrence só com 2+ scripts idênticos no mesmo personagem. Mesmo
 * formato que o gerador grava (shared/hintSchema.mjs).
 */
function expectedHintsFor (projectJson) {
    const hints = [];
    const sceneSeen = new Map();
    let n = 0;
    (projectJson.pages || []).forEach((pageId) => {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') return;
        const sceneMd5 = page.md5 || null;
        if (!sceneMd5) return;
        const sceneOccurrence = (sceneSeen.get(sceneMd5) || 0) + 1;
        sceneSeen.set(sceneMd5, sceneOccurrence);
        const sprites = (page.sprites || []).map((id) => page[id]).filter((s) => s && s.type === 'sprite' && s.md5);
        const charSeen = new Map();
        sprites.forEach((sprite) => {
            const characterOccurrence = (charSeen.get(sprite.md5) || 0) + 1;
            charSeen.set(sprite.md5, characterOccurrence);
            const copies = sprites.filter((s) => s.md5 === sprite.md5).length;
            const keys = [];
            (sprite.scripts || []).forEach((s) => {
                if (!Array.isArray(s)) return;
                const head = headOf(s);
                if (!head || !TRIGGERS.has(head[0])) return;
                const tokens = scriptTokens(s);
                const triggerArg = head[0] === 'onmessage' && head[1] !== null && head[1] !== 'null' ? head[1] : null;
                const key = JSON.stringify([head[0], triggerArg, tokens]);
                keys.push(key);
                const same = (sprite.scripts || []).filter((o) => {
                    if (!Array.isArray(o)) return false;
                    const h = headOf(o);
                    if (!h || !TRIGGERS.has(h[0])) return false;
                    const a = h[0] === 'onmessage' && h[1] !== null && h[1] !== 'null' ? h[1] : null;
                    return JSON.stringify([h[0], a, scriptTokens(o)]) === key;
                }).length;
                const occ = keys.filter((k) => k === key).length;
                const expectedBase = {trigger: head[0], triggerArg, script: tokens};
                if (same >= 2) expectedBase.occurrence = occ;
                const positions = tokens.map((t, i) => i).filter((i) => tokens[i].type !== REPEAT_CLOSE);
                (positions.length ? positions.map((i) => [i]) : [[]]).forEach((covered) => {
                    n++;
                    const when = {
                        type: 'character_missing_block_type',
                        sceneMd5, sceneOccurrence,
                        characterMd5: sprite.md5,
                        blockTypes: covered.map((i) => tokens[i].type),
                        trigger: head[0],
                        expected: Object.assign({}, expectedBase, {covered}),
                    };
                    if (copies > 1) when.characterOccurrence = characterOccurrence;
                    hints.push({id: 'x' + n, text: 'Dica x' + n, when});
                });
            });
        });
    });
    return hints;
}

/** Todos os alertas do alinhamento (um por dica, sem filtro de sig). */
function alignAlerts (hints, detailed) {
    const results = expectedResultsFor(hints, detailed);
    return hints.map((h) => alignmentInfo(h, results.get(h.id))).filter(Boolean);
}

function decide (hints, detailed, extra) {
    return decideHintAction(Object.assign({
        hints, detailed, dismissed: new Set(), alerted: new Set(), idleMs: LONG_IDLE, modalOpen: false, panelOpen: false,
    }, extra));
}

/** Tupla do bloco em `path` dentro de um script (mesmo endereçamento de tokenizeScript). */
function tupleAt (s, path) {
    let strip = s;
    let blk = null;
    path.forEach((i, level) => {
        blk = strip[i];
        if (level < path.length - 1) strip = blk[4];
    });
    return blk;
}

/** Todos os scripts com gatilho de um projeto: [{pageId, spriteId, scriptIndex, tuples}]. */
function allScripts (projectJson) {
    const out = [];
    (projectJson.pages || []).forEach((pageId) => {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object' || !page.md5) return;
        (page.sprites || []).forEach((spriteId) => {
            const sprite = page[spriteId];
            if (!sprite || sprite.type !== 'sprite' || !sprite.md5) return;
            (sprite.scripts || []).forEach((s, scriptIndex) => {
                if (!Array.isArray(s)) return;
                const head = headOf(s);
                if (head && TRIGGERS.has(head[0])) out.push({pageId, spriteId, scriptIndex, tuples: s});
            });
        });
    });
    return out;
}

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../../shared/testing/fixtures');
const fixtures = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    return JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
});

const SYNTHETIC = {
    name: 'sintetico',
    projectJson: project([
        {md5: SCENE, sprites: [
            {md5: RUBY, name: 'Ruby', scripts: [
                script(onflag(), b('say', 'Oi'), b('forward', 3), repeat(4, [b('hop', 2), b('wait', 10), b('right', 3)]), b('setspeed', 1), b('back', 2)),
                script(onclick(), b('grow', 2), b('message', 'azul')),
            ]},
            {md5: CAT, name: 'Onca', scripts: [script(onmessage('azul'), b('up', 1), repeat(2, [b('down', 1), repeat(3, [b('left', 6)])]))]},
            {md5: CAT, name: 'Onca 2', scripts: [script(onflag(), b('shrink', 5))]},
        ]},
        {md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('wait', 5), b('forward', 1))]}]},
    ]),
};
const ALL_PROJECTS = [SYNTHETIC].concat(fixtures);

// ---------------------------------------------------------------------------
// I1 / I4 / I5 / I3 sobre o projeto do professor (sintético + fixtures reais)
// ---------------------------------------------------------------------------

describe.each(ALL_PROJECTS.map((f) => [f.name, f]))('projeto %s com dicas when.expected', (name, f) => {
    const hints = expectedHintsFor(f.projectJson);
    const teacher = computeDetailedManifest(f.projectJson);

    it('tem dicas com expected', () => {
        expect(hints.length).toBeGreaterThan(0);
    });

    it('I1: no projeto do professor toda dica está done e não há alerta nenhum', () => {
        const results = expectedResultsFor(hints, teacher);
        expect(hints.filter((h) => results.get(h.id).state !== 'done').map((h) => h.id)).toEqual([]);
        expect(hints.filter((h) => hintConditionHolds(h, teacher, results))).toEqual([]);
        expect(alignAlerts(hints, teacher)).toEqual([]);
        expect(decide(hints, teacher)).toEqual({buttonDot: false, action: null});
    });

    it('I4: mutar UM número => exatamente UM alerta de valor, apontando aquele bloco', () => {
        let mutations = 0;
        allScripts(f.projectJson).forEach((sc) => {
            tokenizeScript(sc.tuples).forEach((tok) => {
                if (tok.num === null || tok.type === REPEAT_CLOSE) return;
                const mutated = clone(f.projectJson);
                const tuples = mutated[sc.pageId][sc.spriteId].scripts[sc.scriptIndex];
                const tuple = tupleAt(tuples, tok.path);
                const wrong = tok.type === 'setspeed' ? (tok.num + 1) % 3 : tok.num + 1;
                tuple[1] = wrong;
                const detailed = computeDetailedManifest(mutated);
                const alerts = alignAlerts(hints, detailed);
                const where = `${name} ${sc.spriteId}#${sc.scriptIndex} ${tok.type}@${tok.path}`;
                expect(alerts.map((a) => a.kind), where).toEqual(['value']);
                expect(alerts[0].position, where).toEqual({scriptIndex: sc.scriptIndex, path: tok.path});
                expect(alerts[0].expected, where).toBe(tok.num);
                expect(alerts[0].got, where).toBe(wrong);
                const d = decide(hints, detailed);
                expect(d.action && d.action.kind, where).toBe('alert');
                expect(d.action.info, where).toEqual(alerts[0]);
                expect(d.action.spokenHint, where).toBe(d.action.hint);
                mutations++;
            });
        });
        // A fixture 'mensagens' não tem nenhum bloco numérico (só say/message/show...).
        const numeric = allScripts(f.projectJson).some((sc) => tokenizeScript(sc.tuples).some((t) => t.num !== null));
        expect(mutations > 0).toBe(numeric);
        if (name === 'sintetico') expect(mutations).toBeGreaterThan(10);
    });

    it('I5: trocar dois blocos vizinhos de tipos diferentes => aviso de ordem', () => {
        let swaps = 0;
        allScripts(f.projectJson).forEach((sc) => {
            const tuples = sc.tuples;
            for (let i = 1; i + 1 < tuples.length; i++) {
                const a = tuples[i];
                const c = tuples[i + 1];
                if (!Array.isArray(a) || !Array.isArray(c) || a[0] === c[0] || CARETS.has(a[0]) || CARETS.has(c[0])) continue;
                const mutated = clone(f.projectJson);
                const mt = mutated[sc.pageId][sc.spriteId].scripts[sc.scriptIndex];
                [mt[i], mt[i + 1]] = [mt[i + 1], mt[i]];
                const alerts = alignAlerts(hints, computeDetailedManifest(mutated));
                expect(alerts.map((x) => x.kind), `${name} ${sc.spriteId}#${sc.scriptIndex} troca ${i}`).toContain('order');
                expect(alerts.every((x) => x.kind === 'order')).toBe(true);
                swaps++;
            }
        });
        if (name === 'sintetico') expect(swaps).toBeGreaterThan(3);
    });

    it('I3 exato: o aluno simulado cumpre todas as dicas, sem lacuna nem alerta, e termina igual ao professor', () => {
        const {failures, student} = simulateHints(f.projectJson, hints);
        expect(failures).toEqual([]);
        // Cada personagem do aluno tem exatamente os scripts (tokens) do professor.
        const sig = (pj) => allScripts(pj).map((sc) => {
            const sprite = pj[sc.pageId][sc.spriteId];
            return JSON.stringify([pj[sc.pageId].md5, sprite.md5, headOf(sc.tuples)[0], scriptTokens(sc.tuples)]);
        }).sort();
        expect(sig(student)).toEqual(sig(f.projectJson));
    });
});

describe('I3 exato - missão mista (cena/personagem/no_script legados + blocos com expected)', () => {
    const teacher = project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'Ruby', scripts: [script(onflag(), repeat(2, [b('hop', 1)]), b('say', 'oi'))]},
        {md5: CAT, name: 'Onca', scripts: [script(onclick(), b('grow', 3)), script(onclick(), b('grow', 3))]},
    ]}]);
    const blockHints = expectedHintsFor(teacher);
    const w = (extra) => Object.assign({sceneMd5: SCENE, sceneOccurrence: 1}, extra);
    const hints = [
        {id: 'h1', text: 'intro', when: {type: 'mission_intro'}},
        {id: 'h2', text: 'cena', when: w({type: 'scene_missing'})},
        {id: 'h3', text: 'script', when: w({type: 'character_no_script', characterMd5: RUBY})},
    ].concat(blockHints.filter((h) => h.when.characterMd5 === RUBY))
        .concat([{id: 'h4', text: 'onca', when: w({type: 'character_missing', characterMd5: CAT})}])
        .concat(blockHints.filter((h) => h.when.characterMd5 === CAT));

    it('scripts idênticos ganham occurrence e o simulador monta os dois', () => {
        const cat = blockHints.filter((h) => h.when.characterMd5 === CAT);
        expect(cat.map((h) => h.when.expected.occurrence)).toEqual([1, 2]);
        const {failures, student} = simulateHints(teacher, hints);
        expect(failures).toEqual([]);
        // O script do character_no_script (só o gatilho) foi reaproveitado, não duplicado.
        expect(student.page1.sprite1_1.scripts.length).toBe(1);
        expect(student.page1.sprite1_1.scripts[0]).toEqual(teacher.page1.sprite1_1.scripts[0]);
        expect(student.page1.sprite1_2.scripts.length).toBe(2);
    });
});

describe('I5 - dentro/fora do repeat', () => {
    const teacher = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [
        script(onflag(), b('forward', 3), repeat(4, [b('hop', 2), b('wait', 10)]), b('back', 2)),
    ]}]}]);
    const hints = expectedHintsFor(teacher);
    const studentWith = (s) => computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [s]}]}]));

    it('tirar um bloco de dentro do repeat => order, apontando o bloco de fora', () => {
        const detailed = studentWith(script(onflag(), b('forward', 3), repeat(4, [b('hop', 2)]), b('wait', 10), b('back', 2)));
        const alerts = alignAlerts(hints, detailed);
        expect(alerts.map((a) => [a.kind, a.blockType, a.position.path])).toEqual([['order', 'wait', [3]]]);
        const d = decide(hints, detailed);
        expect(d.action.info.kind).toBe('order');
        expect(d.action.spokenHint).toBe(d.action.hint); // o texto é o da dica do bloco fora do lugar
    });

    it('pôr pra dentro do repeat um bloco que é de fora => order', () => {
        const detailed = studentWith(script(onflag(), repeat(4, [b('forward', 3), b('hop', 2), b('wait', 10)]), b('back', 2)));
        expect(alignAlerts(hints, detailed).map((a) => [a.kind, a.blockType, a.position.path])).toEqual([['order', 'forward', [1, 0]]]);
    });
});

// ---------------------------------------------------------------------------
// R3 - pendente/zerado herdados, sem alerta de valor indevido, sem duplicata
// ---------------------------------------------------------------------------

describe('R3 - estados pendentes e zerados (nunca "valor errado")', () => {
    const teacher = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [
        script(onflag(), b('forward', 3), b('setspeed', 2), b('say', 'Oi')),
    ]}]}]);
    const hints = expectedHintsFor(teacher); // x1 forward, x2 setspeed, x3 say
    const studentWith = (...blocks) => computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), ...blocks)]}]}]));

    it('recém-arrastado com o valor pedido (unconfirmed:3) => confirm, não value', () => {
        const detailed = studentWith(b('forward', 'unconfirmed:3'));
        const alerts = alignAlerts(hints, detailed);
        expect(alerts.map((a) => a.kind)).toEqual(['confirm']);
        expect(alerts[0]).toMatchObject({source: 'expected', reason: 'unconfirmed', expected: 3, got: 3, position: {scriptIndex: 0, path: [1]}});
        expect(alerts[0].idleMs).toBeUndefined();
        expect(hintConditionHolds(hints[0], detailed)).toBe(true);
    });

    it('recém-arrastado com outro valor (unconfirmed:1) => fill com a espera própria, não value', () => {
        const detailed = studentWith(b('forward', 'unconfirmed:1'));
        const alerts = alignAlerts(hints, detailed);
        expect(alerts.map((a) => [a.kind, a.idleMs])).toEqual([['fill', 2000]]);
        expect(decide(hints, detailed, {idleMs: ALERT_IDLE_MS}).action).toBe(null);
        expect(decide(hints, detailed, {idleMs: 2000}).action.info.kind).toBe('fill');
    });

    it('numérico sem valor e velocidade "nenhuma" (3) => fill', () => {
        const alerts = alignAlerts(hints, studentWith(b('forward', 'null'), b('setspeed', 3)));
        expect(alerts.map((a) => [a.kind, a.blockType, a.reason])).toEqual([['fill', 'forward', 'unset'], ['fill', 'setspeed', 'unset']]);
    });

    it('say com texto padrão: nenhum alerta (vale a proativa), dica pendente', () => {
        const detailed = studentWith(b('forward', 3), b('setspeed', 2), b('say', 'olá'));
        expect(alignAlerts(hints, detailed)).toEqual([]);
        expect(hintConditionHolds(hints[2], detailed)).toBe(true);
        expect(decide(hints, detailed).action).toEqual({kind: 'hint', hint: hints[2]});
    });

    it('nenhum desses estados produz alerta de valor no decideHintAction', () => {
        [b('forward', 'unconfirmed:3'), b('forward', 'unconfirmed:9'), b('forward', 'null'), b('setspeed', 3), b('say', 'olá'), b('say', '')]
            .forEach((blk) => {
                const d = decide(hints, studentWith(blk));
                if (d.action && d.action.kind === 'alert') expect(d.action.info.kind).not.toBe('value');
            });
    });

    it('bloco a mais => extra, só quando o resto está todo pareado', () => {
        const alerts = alignAlerts(hints, studentWith(b('forward', 3), b('setspeed', 2), b('say', 'Oi'), b('forward', 4)));
        expect(alerts.map((a) => [a.kind, a.blockType, a.extraCount, a.position.path])).toEqual([['extra', 'forward', 1, [4]]]);
        // Faltando o say: a sobra não é acusada (pode ser o que falta, fora do lugar).
        expect(alignAlerts(hints, studentWith(b('forward', 3), b('setspeed', 2), b('forward', 4)))).toEqual([]);
    });

    it('personagem inexistente: dica com expected fica pendente (não "resolvida" como no legado)', () => {
        const empty = computeDetailedManifest(project([{md5: SCENE, sprites: []}]));
        expect(hintConditionHolds(hints[0], empty)).toBe(true);
        expect(alignAlerts(hints, empty)).toEqual([]);
    });
});

describe('R3 - assinatura estável, sem repetir o mesmo alerta', () => {
    const teacher = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', 3))]}]}]);
    const hints = expectedHintsFor(teacher);
    const studentWith = (v) => computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', v))]}]}]));

    it('sig = dica + estado + posição + valor; mesma situação não repete, outro valor avisa de novo', () => {
        const first = decide(hints, studentWith(5)).action;
        expect(first.info.sig).toBe('x1|align|value|0:1|forward|5');
        // Recalculado (outro objeto detailed): mesma sig.
        expect(decide(hints, studentWith(5)).action.info.sig).toBe(first.info.sig);
        const after = decide(hints, studentWith(5), {alerted: new Set([first.info.sig]), dismissed: new Set(['x1'])});
        expect(after.action).toBe(null);
        const again = decide(hints, studentWith(7), {alerted: new Set([first.info.sig]), dismissed: new Set(['x1'])});
        expect(again.action.info.sig).toBe('x1|align|value|0:1|forward|7');
    });

    it('cópia 2+ entra na sig (@N) e no characterOccurrence', () => {
        const twins = project([{md5: SCENE, sprites: [
            {md5: CAT, name: 'A', scripts: [script(onflag(), b('up', 1))]},
            {md5: CAT, name: 'B', scripts: [script(onflag(), b('up', 2))]},
        ]}]);
        const th = expectedHintsFor(twins);
        const student = clone(twins);
        student.page1.sprite1_2.scripts[0][1][1] = 9;
        const alerts = alignAlerts(th, computeDetailedManifest(student));
        expect(alerts.map((a) => [a.sig, a.characterOccurrence])).toEqual([['x2|align|value|0:1|up|9@2', 2]]);
    });
});

describe('R3 - missão mista (legada + expected)', () => {
    const teacher = project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', 3))]},
        {md5: CAT, name: 'Onca', scripts: [script(onflag(), b('up', 2))]},
    ]}]);
    const expectedRuby = expectedHintsFor(teacher).filter((h) => h.when.characterMd5 === RUBY);
    const legacyRuby = {id: 'L1', text: 'ande 3', when: {type: 'character_missing_block_type', sceneMd5: SCENE, characterMd5: RUBY,
        blockTypes: ['forward'], blockArgs: {forward: 3}, trigger: 'onflag'}};
    const legacyCat = {id: 'L2', text: 'suba 2', when: {type: 'character_missing_block_type', sceneMd5: SCENE, characterMd5: CAT,
        blockTypes: ['up'], blockArgs: {up: 2}, trigger: 'onflag'}};
    const studentWith = (fwd, up) => computeDetailedManifest(project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', fwd))]},
        {md5: CAT, name: 'Onca', scripts: [script(onflag(), b('up', up))]},
    ]}]));

    it('o mesmo bloco não alerta pelos dois caminhos', () => {
        const hints = [legacyRuby].concat(expectedRuby);
        expect(legacyShadowedByExpected(legacyRuby, hints)).toBe(true);
        const detailed = studentWith(5, 2);
        // mistakeInfo direto ainda vê o erro (caminho legado intacto)...
        expect(mistakeInfo(legacyRuby, detailed).kind).toBe('value');
        // ...mas o ciclo só alerta pelo alinhamento, e depois de avisado, nada.
        const first = decide(hints, detailed).action;
        expect(first.info.source).toBe('expected');
        expect(first.hint).toBe(expectedRuby[0]);
        const second = decide(hints, detailed, {alerted: new Set([first.info.sig]), dismissed: new Set(['L1', expectedRuby[0].id])});
        expect(second.action).toBe(null);
    });

    it('legada de OUTRO personagem continua alertando normalmente, na ordem das dicas', () => {
        const hints = [legacyCat].concat(expectedRuby);
        expect(legacyShadowedByExpected(legacyCat, hints)).toBe(false);
        const d = decide(hints, studentWith(5, 9));
        expect(d.action.info).toEqual({kind: 'value', sig: 'L2|value|up=9'}); // legada vem primeiro no array
        const next = decide(hints, studentWith(5, 9), {alerted: new Set(['L2|value|up=9'])});
        expect(next.action.info.source).toBe('expected');
        expect(alertText(d.action.info, d.action.spokenHint)).toBe('Quase! O valor do bloco ainda não está certo. suba 2');
    });

    it('sombra respeita gatilho e cópia', () => {
        const hints = expectedRuby;
        expect(legacyShadowedByExpected({...legacyRuby, when: {...legacyRuby.when, trigger: 'onclick'}}, hints)).toBe(false);
        expect(legacyShadowedByExpected({...legacyRuby, when: {...legacyRuby.when, blockTypes: ['up']}}, hints)).toBe(false);
        expect(legacyShadowedByExpected({...legacyRuby, when: {...legacyRuby.when, trigger: undefined}}, hints)).toBe(true);
        const copy2 = {...legacyRuby, when: {...legacyRuby.when, characterOccurrence: 2}};
        const exp1 = hints.map((h) => ({...h, when: {...h.when, characterOccurrence: 1}}));
        expect(legacyShadowedByExpected(copy2, exp1)).toBe(false);
        expect(legacyShadowedByExpected(expectedRuby[0], hints)).toBe(false); // dica com expected nunca é "sombra"
        expect(legacyShadowedByExpected({id: 'm', when: {type: 'manual'}}, hints)).toBe(false);
    });

    it('orderInfo só considera as legadas entre si', () => {
        const pendingExpected = expectedRuby[0];
        const doneLegacyLater = {...legacyCat, id: 'L3', when: {...legacyCat.when, characterMd5: RUBY, blockTypes: ['up'], blockArgs: {}}};
        const detailed = computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('up', 1))]}]}]));
        // A dica com expected (anterior, pendente) não é "pulada" pela legada cumprida.
        expect(orderInfo([pendingExpected, doneLegacyLater], detailed)).toBeNull();
        // Sanidade: com a anterior LEGADA, o fora-de-ordem legado continua.
        expect(orderInfo([legacyRuby, doneLegacyLater], detailed).sig).toBe('L1|order|L3');
        // mistakeInfo nunca olha dica com expected.
        expect(mistakeInfo(pendingExpected, studentWith(5, 2))).toBeNull();
    });
});

describe('cache / contexto do alinhamento', () => {
    const teacher = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', 3), b('forward', 4))]}]}]);
    const hints = expectedHintsFor(teacher);

    it('expectedResultsFor devolve o MESMO Map pro mesmo (detailed, hints)', () => {
        const detailed = computeDetailedManifest(teacher);
        expect(expectedResultsFor(hints, detailed)).toBe(expectedResultsFor(hints, detailed));
        expect(expectedResultsFor(hints, computeDetailedManifest(teacher))).not.toBe(expectedResultsFor(hints, detailed));
        // detailed inválido: sem cache, sem lançar.
        expect(expectedResultsFor(hints, null).get('x1').state).toBe('pending');
        expect(expectedResultsFor(undefined, detailed).size).toBe(0);
    });

    it('hintConditionHolds sem contexto avalia a dica sozinha; com contexto usa o Map', () => {
        const detailed = computeDetailedManifest(teacher);
        expect(hintConditionHolds(hints[0], detailed)).toBe(false);
        const fake = new Map([[hints[0].id, {state: 'wrong_value'}]]);
        expect(hintConditionHolds(hints[0], detailed, fake)).toBe(true);
        // Map sem a dica: cai na avaliação sozinha.
        expect(hintConditionHolds(hints[0], detailed, new Map())).toBe(false);
        expect(nextProactiveHint(hints, detailed, new Set(), fake)).toBe(hints[0]);
    });
});

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

describe('alertText', () => {
    const hint = {id: 'h', text: 'Faça a Ruby pular.'};
    const info = (kind, extra) => Object.assign({source: 'expected', kind}, extra);

    it('valor: só o número do professor, sem unidade', () => {
        expect(alertText(info('value', {blockType: 'forward', expected: 3, got: 5}), hint)).toBe('Ops! Acho que o número do bloco de andar pra frente era 3');
        expect(alertText(info('value', {blockType: 'wait', expected: 10, got: 5}), hint)).toBe('Ops! Acho que o número do bloco de espere era 10');
        expect(alertText(info('value', {blockType: 'right', expected: 3, got: 5}), hint)).toBe('Ops! Acho que o número do bloco de girar pra direita era 3');
    });

    it('velocidade: lenta/normal/rápida no lugar do número', () => {
        expect(alertText(info('value', {blockType: 'setspeed', expected: 0, got: 2}), hint)).toBe('Ops! Acho que o bloco de velocidade era lenta');
        expect(alertText(info('value', {blockType: 'setspeed', expected: 2, got: 0}), hint)).toBe('Ops! Acho que o bloco de velocidade era rápida');
        expect(alertText(info('value', {blockType: 'setspeed', expected: 7, got: 0}), hint)).toBe('Ops! Acho que o bloco de velocidade era 7');
    });

    it('extra, ordem, confirm/fill do alinhamento', () => {
        expect(alertText(info('extra', {blockType: 'hop'}), hint)).toBe('Ops! Acho que tem um bloco de pular a mais');
        expect(alertText(info('order', {blockType: 'hop'}), hint)).toBe('Opa, esse bloco está fora do lugar! Faça a Ruby pular.');
        expect(alertText(info('confirm'), hint)).toBe('Quase! Toque no número do bloco para confirmar o valor. Faça a Ruby pular.');
        expect(alertText(info('fill'), hint)).toBe('Falta escolher o valor do bloco - toque nele para definir. Faça a Ruby pular.');
    });

    it('legado: mesmos textos de antes (prefixo + dica dita)', () => {
        expect(alertText({kind: 'order', sig: 's'}, hint)).toBe('Opa, esse bloco vem depois! Primeiro faça: Faça a Ruby pular.');
        expect(alertText({kind: 'trigger'}, hint)).toMatch(/^Quase! O bloco está no lugar errado/);
        expect(alertText({kind: 'desconhecido'}, null)).toBe('Quase! O valor do bloco ainda não está certo. ');
    });

    it('blockLabel cai no tipo cru fora da tabela', () => {
        expect(blockLabel('repeat')).toBe('repita');
        expect(blockLabel('xyz')).toBe('xyz');
    });
});

// ---------------------------------------------------------------------------
// R8 - alvo fresco + bloco vivo
// ---------------------------------------------------------------------------

describe('R8 - freshAlignmentTarget', () => {
    const teacher = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: [script(onflag(), b('forward', 3), b('up', 2))]}]}]);
    const hints = expectedHintsFor(teacher);
    const studentWith = (scripts) => computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts}]}]));
    const decided = alignmentInfo(hints[0], expectedResultsFor(hints, studentWith([script(onflag(), b('forward', 5), b('up', 2))])).get('x1'));

    it('mesmo estado, bloco em outro lugar agora: devolve a posição FRESCA', () => {
        expect(decided.position).toEqual({scriptIndex: 0, path: [1]});
        // O aluno criou um script vazio antes e o forward errado foi pro índice 1.
        const now = studentWith([[], script(onflag(), b('forward', 7), b('up', 2))]);
        expect(freshAlignmentTarget(hints, hints[0], decided, now)).toEqual({position: {scriptIndex: 1, path: [1]}, characterOccurrence: 1});
    });

    it('estado mudou (corrigiu o valor) ou sumiu: null, não pisca nada', () => {
        expect(freshAlignmentTarget(hints, hints[0], decided, studentWith([script(onflag(), b('forward', 3), b('up', 2))]))).toBeNull();
        expect(freshAlignmentTarget(hints, hints[0], decided, studentWith([]))).toBeNull();
        // Virou outro kind (agora é sobra, não valor): também null.
        expect(freshAlignmentTarget(hints, hints[0], {...decided, kind: 'order'}, studentWith([script(onflag(), b('forward', 5), b('up', 2))]))).toBeNull();
    });

    it('info legado ou dica sem expected: null', () => {
        expect(freshAlignmentTarget(hints, hints[0], {kind: 'value', sig: 'x'}, studentWith([]))).toBeNull();
        expect(freshAlignmentTarget(hints, {id: 'L', when: {type: 'manual'}}, decided, studentWith([]))).toBeNull();
        expect(alignmentInfo(hints[0], null)).toBeNull();
        expect(alignmentInfo(hints[0], {state: 'wrong_value'})).toBeNull(); // sem posição
    });
});

describe('R8 - resolveLiveBlock (posição do alinhamento -> Block vivo)', () => {
    /** Cadeia `next` de blocos falsos (duck typing do Block do editor). */
    function chain (...blocks) {
        blocks.forEach((blk, i) => {
            blk.next = blocks[i + 1] || null;
        });
        return blocks[0] || null;
    }
    const blk = (blocktype, inside) => ({blocktype, inside: inside || null, div: {id: blocktype}});

    it('mapeia scriptIndex/path pulando os carets que encodeStrip pula', () => {
        const inner2 = blk('left');
        const innerRepeat = blk('repeat', chain(blk('caretcmd'), inner2));
        const hop = blk('hop');
        const rep = blk('repeat', chain(hop, innerRepeat, blk('caretend')));
        const fwd = blk('forward');
        const top0 = chain(blk('caretstart'));          // caret solto = script vazio [] (scriptIndex 0)
        const top1 = chain(blk('onflag'), blk('caretcmd'), fwd, rep, blk('say'));
        const tops = [top0, top1];
        expect(resolveLiveBlock(tops, {scriptIndex: 1, path: [1]})).toBe(fwd);
        expect(resolveLiveBlock(tops, {scriptIndex: 1, path: [2, 0]})).toBe(hop);
        expect(resolveLiveBlock(tops, {scriptIndex: 1, path: [2, 1, 0]})).toBe(inner2);
        expect(resolveLiveBlock(tops, {scriptIndex: 1, path: [0]}).blocktype).toBe('onflag');
        expect(resolveLiveBlock(tops, {scriptIndex: 1, path: [3]}).blocktype).toBe('say');
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: [0]})).toBeNull();
    });

    it('caretrepeat conta como repeat (encodeStrip o grava como repeat)', () => {
        const inside = blk('wait');
        const cr = blk('caretrepeat', chain(inside));
        const tops = [chain(blk('onflag'), cr)];
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: [1]})).toBe(cr);
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: [1, 0]})).toBe(inside);
    });

    it('caminho inexistente / entrada inválida: null', () => {
        const tops = [chain(blk('onflag'), blk('forward'))];
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: [5]})).toBeNull();
        expect(resolveLiveBlock(tops, {scriptIndex: 3, path: [1]})).toBeNull();
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: [1, 0]})).toBeNull(); // forward não tem inside
        expect(resolveLiveBlock(tops, {scriptIndex: 0, path: []})).toBeNull();
        expect(resolveLiveBlock(tops, null)).toBeNull();
        expect(resolveLiveBlock(null, {scriptIndex: 0, path: [0]})).toBeNull();
    });

    it('ponta a ponta: tuplas salvas por encodeStrip <-> tokens do manifesto <-> bloco vivo', () => {
        // Espelho de Project.js#encodeStrip sobre a cadeia falsa (carets pulados,
        // caretrepeat -> repeat, inside recursivo) - confere que o path dos
        // tokens do manifesto aponta, no live, o bloco que gerou aquela tupla.
        const encode = (first) => {
            const out = [];
            for (let x = first; x; x = x.next) {
                if (['caretcmd', 'caretend', 'caretstart'].includes(x.blocktype)) continue;
                const type = x.blocktype === 'caretrepeat' ? 'repeat' : x.blocktype;
                const tuple = [type, x.arg === undefined ? 'null' : x.arg, 0, 0];
                if (type === 'repeat') tuple.push(encode(x.inside));
                out.push(tuple);
            }
            return out;
        };
        const mk = (blocktype, arg, inside) => Object.assign(blk(blocktype, inside), {arg});
        const tops = [
            chain(mk('caretstart')),
            chain(mk('onflag'), mk('caretcmd'), mk('forward', 3), mk('repeat', 2, chain(mk('hop', 1), mk('caretcmd'), mk('repeat', 3, chain(mk('wait', 5))))), mk('say', 'oi')),
        ];
        const saved = project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: tops.map(encode)}]}]);
        const s = computeDetailedManifest(saved).scenes[0].characters[0].scripts[0];
        expect(s.scriptIndex).toBe(1);
        s.tokens.filter((t) => t.type !== REPEAT_CLOSE).forEach((t) => {
            const live = resolveLiveBlock(tops, {scriptIndex: s.scriptIndex, path: t.path});
            expect(live && live.blocktype, String(t.path)).toBe(t.type);
            expect(live.arg).toBe(t.type === 'say' ? 'oi' : t.num);
        });
    });
});
