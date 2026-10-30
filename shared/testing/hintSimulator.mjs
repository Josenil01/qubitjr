/**
 * shared/testing/hintSimulator.mjs
 *
 * Simulador do invariante I3 do sistema de dicas: "um aluno que segue as
 * dicas NA ORDEM, construindo exatamente o que cada uma pede a partir do
 * projeto do professor, nunca fica sem próxima dica e nunca leva um alerta
 * de erro falso".
 *
 * REGRA R1: SÓ DE TESTE. Nunca importe de código de produção (backend/src
 * não-teste, api/, src/app/src não-teste, outros shared/*.mjs).
 *
 * Como funciona (passo a passo, para cada dica de TAREFA, na ordem do array):
 *  1. ANTES de cumprir a dica i, confere (a): se ainda há alguma tarefa
 *     pendente (hintConditionHolds), nextProactiveHint (com a intro e as
 *     dicas manuais já dispensadas) não pode ser null - é a "morte do motor
 *     depois da intro" que a telemetria de produção mostrou.
 *  2. Aplica ao projeto do ALUNO simulado as partes do professor que a dica
 *     pede (applyHint).
 *  3. Confere (c): a dica recém-cumprida tem que estar RESOLVIDA
 *     (hintConditionHolds false) - se não, ou o simulador não soube cumpri-la
 *     (heurística curta, ver abaixo) ou a dica é impossível de cumprir por
 *     construção (ex.: personagem repetido sem characterOccurrence).
 *  4. Confere (b): decideHintAction com ociosidade enorme NÃO produz action
 *     kind 'alert' - o aluno está seguindo o professor à risca, qualquer
 *     alerta ("Quase!", fora de ordem) seria falso.
 * Depois do último passo, confere (d): nenhuma tarefa pendente.
 *
 * HEURÍSTICAS (o simulador é aproximado de propósito, a Fase 3 o torna exato):
 *  - O projeto do aluno começa com UMA página em branco (sem md5), sem
 *    personagens - como um projeto novo. scene_missing preenche a página em
 *    branco (se ainda existir) ou acrescenta uma; o fundo vai para a cena da
 *    ocorrência pedida.
 *  - Uma cena nova ganha o personagem padrão (HY-Ruby.svg) se existe uma dica
 *    default_character_present para ela (é o que Page.js#createCat faz); a
 *    dica default_character_present é cumprida REMOVENDO esse personagem.
 *  - Qual sprite do professor um character_missing/bloco refere, quando o
 *    personagem se repete na cena: o N-ésimo sprite com aquele md5, onde N =
 *    when.characterOccurrence (se a dica já o traz) ou 1 (sem esse
 *    campo o motor não distingue repetidos - falha 9 do plano de correção).
 *  - Blocos: para uma dica character_missing_block_type, vão para o script do
 *    aluno com o gatilho when.trigger (ou, sem trigger, com o gatilho do
 *    script do professor onde o bloco mora). Pega, na ORDEM do professor, os
 *    blocos dos tipos de when.blockTypes até minCounts (padrão 1) por tipo,
 *    pulando os que o aluno já tem; valor = when.blockArgs[tipo] se houver,
 *    senão o do bloco do professor. Os blocos são ANEXADOS ao fim do script
 *    do aluno (as dicas já vêm na ordem do professor, então o resultado
 *    acompanha a ordem dele). Blocos dentro de um repeat do professor vão
 *    para um repeat criado sob demanda no script do aluno.
 *  - Não há "alunos errados": o simulador só cumpre dicas, nunca erra. Os
 *    alertas de erro verdadeiros (valor errado, gatilho errado) são testados
 *    em decideHintAction.test.js / hintRegressions.test.js.
 *  - LIMITAÇÃO: a Fase 3 (when.expected, com os índices `covered` dos blocos
 *    do professor em cada dica) vai dizer EXATAMENTE quais blocos do professor
 *    cada dica cobre, e o simulador passará a aplicar esses blocos em vez de
 *    inferi-los de blockTypes/minCounts/trigger - tornando I3 exato.
 */

import {project, b} from './projectFixtures.mjs';
import {computeDetailedManifest} from '../detailedManifest.mjs';
import {hintConditionHolds, nextProactiveHint, decideHintAction} from '../../src/app/src/editor/ui/HintEngine.js';

const TRIGGERS = new Set(['onflag', 'onclick', 'ontouch', 'onmessage']);
const NON_TASK = new Set(['mission_intro', 'manual']);
const DEFAULT_CHARACTER = 'HY-Ruby.svg';

export const isTaskHint = (hint) => !!(hint && hint.when && !NON_TASK.has(hint.when.type));

/** Cenas do professor: [{md5, occurrence, sprites:[sprite cru]}] na ordem das páginas. */
function teacherScenesOf (projectJson) {
    const seen = new Map();
    return (projectJson.pages || []).map(function (pageId) {
        const page = projectJson[pageId] || {};
        const md5 = page.md5 || null;
        const occurrence = md5 ? (seen.get(md5) || 0) + 1 : null;
        if (md5) seen.set(md5, occurrence);
        const sprites = (page.sprites || []).map((id) => page[id]).filter((s) => s && s.type === 'sprite');
        return {md5, occurrence, sprites};
    });
}

/** Script cru do professor -> {trigger, triggerArg, entries:[{type,arg,rep}]} (aninhados achatados). */
function flattenScript (script) {
    const first = Array.isArray(script[0]) ? script[0] : null;
    const hasTrigger = !!first && TRIGGERS.has(first[0]);
    const entries = [];
    (hasTrigger ? script.slice(1) : script).forEach(function (block, idx) {
        if (!Array.isArray(block)) return;
        entries.push({type: block[0], arg: block[1], rep: null, idx});
        if (Array.isArray(block[4])) {
            block[4].forEach(function (inner) {
                if (Array.isArray(inner)) entries.push({type: inner[0], arg: inner[1], rep: idx, idx: -1});
            });
        }
    });
    return {
        trigger: hasTrigger ? first[0] : null,
        triggerArg: hasTrigger ? first[1] : null,
        entries,
    };
}

export class HintSimulator {
    /**
     * @param {object} teacherProject projectJson (parseado) do professor
     * @param {object[]} hints dicas na ordem
     */
    constructor (teacherProject, hints) {
        this.hints = hints;
        this.teacherScenes = teacherScenesOf(teacherProject);
        // Aluno: páginas {md5, sprites:[{md5,name,scripts}]}. Começa com 1 em branco.
        this.pages = [{md5: null, sprites: []}];
        // Chave de repeat do professor -> tupla de repeat criada no aluno.
        this.repeats = new Map();
        this.dismissed = new Set(hints.filter((h) => h && h.when && NON_TASK.has(h.when.type)).map((h) => h.id));
    }

    /** projectJson do aluno no estado atual (formato real, via projectFixtures). */
    studentProject () {
        return project(this.pages.map((p) => ({
            md5: p.md5 || undefined,
            sprites: p.sprites.map((s) => ({md5: s.md5, name: s.name, scripts: s.scripts})),
        })));
    }

    detailed () {
        return computeDetailedManifest(this.studentProject());
    }

    // --- cenas ------------------------------------------------------------

    studentSceneIndexes (md5) {
        const out = [];
        this.pages.forEach((p, i) => { if (p.md5 === md5) out.push(i); });
        return out;
    }

    /** Garante que existam >= occ cenas com esse fundo; devolve a de ocorrência occ. */
    ensureScene (md5, occ) {
        occ = occ || 1;
        while (this.studentSceneIndexes(md5).length < occ) {
            let page = this.pages.find((p) => p.md5 === null && !p.sprites.length);
            if (!page) {
                page = {md5: null, sprites: []};
                this.pages.push(page);
            }
            page.md5 = md5;
            const n = this.studentSceneIndexes(md5).length;
            const wantsDefault = this.hints.some((h) => h && h.when && h.when.type === 'default_character_present' &&
                h.when.sceneMd5 === md5 && (h.when.sceneOccurrence || 1) === n);
            if (wantsDefault) page.sprites.push({md5: DEFAULT_CHARACTER, name: 'padrao', scripts: []});
        }
        return this.pages[this.studentSceneIndexes(md5)[occ - 1]];
    }

    teacherScene (md5, occ) {
        return this.teacherScenes.find((s) => s.md5 === md5 && s.occurrence === (occ || 1)) || null;
    }

    // --- personagens ------------------------------------------------------

    /** Sprite do professor referido: o N-ésimo com esse md5 na cena. */
    teacherSprite (when, n) {
        const scene = this.teacherScene(when.sceneMd5, when.sceneOccurrence);
        if (!scene) return null;
        return scene.sprites.filter((s) => s.md5 === when.characterMd5)[(n || 1) - 1] || null;
    }

    /** Garante o personagem do `when` na cena do aluno (cria cena/personagem se faltar). */
    ensureCharacter (when) {
        const page = this.ensureScene(when.sceneMd5, when.sceneOccurrence);
        const have = page.sprites.filter((s) => s.md5 === when.characterMd5);
        const wanted = when.characterOccurrence || 1;
        const tsprite = this.teacherSprite(when, wanted);
        if (have.length < wanted) {
            const sprite = {md5: when.characterMd5, name: tsprite ? tsprite.name : 'p', scripts: []};
            page.sprites.push(sprite);
            return sprite;
        }
        return have[wanted - 1];
    }

    // --- aplicação de cada tipo de dica ------------------------------------

    applyHint (hint) {
        const when = hint.when;
        switch (when.type) {
        case 'scene_missing':
            this.ensureScene(when.sceneMd5, when.sceneOccurrence);
            break;
        case 'character_missing':
            this.ensureCharacter(when);
            break;
        case 'character_no_script': {
            const sprite = this.ensureCharacter(when);
            if (!sprite.scripts.length) {
                const tsprite = this.teacherSprite(when, when.characterOccurrence || 1);
                const first = tsprite && (tsprite.scripts || []).find((s) => Array.isArray(s) && s.length);
                sprite.scripts.push(first ? [b(first[0][0], first[0][1])] : [b('onflag')]);
            }
            break;
        }
        case 'default_character_present': {
            const page = this.ensureScene(when.sceneMd5, when.sceneOccurrence);
            const i = page.sprites.findIndex((s) => s.md5 === when.characterMd5);
            if (i >= 0) page.sprites.splice(i, 1);
            break;
        }
        case 'message_not_received':
            this.applyMessageReceiver(when.messageName);
            break;
        case 'character_missing_block_type':
            this.applyBlocks(when);
            break;
        default:
            break;
        }
    }

    /** Cumpre message_not_received: o personagem do professor que recebe a mensagem ganha o onmessage. */
    applyMessageReceiver (name) {
        for (const scene of this.teacherScenes) {
            for (const sprite of scene.sprites) {
                const has = (sprite.scripts || []).some((s) => Array.isArray(s) && s[0] && s[0][0] === 'onmessage' && s[0][1] === name);
                if (!has) continue;
                const n = scene.sprites.filter((x) => x.md5 === sprite.md5).indexOf(sprite) + 1;
                const sc = this.ensureCharacter({
                    sceneMd5: scene.md5, sceneOccurrence: scene.occurrence, characterMd5: sprite.md5, characterOccurrence: n,
                });
                if (!sc.scripts.some((s) => s[0] && s[0][0] === 'onmessage' && s[0][1] === name)) {
                    sc.scripts.push([b('onmessage', name)]);
                }
                return;
            }
        }
    }

    applyBlocks (when) {
        const sprite = this.ensureCharacter(when);
        const tsprite = this.teacherSprite(when, when.characterOccurrence || 1);
        const tscripts = ((tsprite && tsprite.scripts) || []).filter((s) => Array.isArray(s) && s.length).map(flattenScript);
        const wantedArgs = when.blockArgs || {};
        const minCounts = when.minCounts || {};
        const key = (when.sceneMd5 || '') + '|' + (when.sceneOccurrence || 1) + '|' + when.characterMd5;

        const scriptFor = (trigger, triggerArg) => {
            let s = sprite.scripts.find((x) => (x[0] && TRIGGERS.has(x[0][0]) ? x[0][0] : null) === trigger);
            if (!s) {
                s = trigger ? [b(trigger, triggerArg === undefined ? null : triggerArg)] : [];
                sprite.scripts.push(s);
            }
            return s;
        };
        const countIn = (script, type) => {
            let n = 0;
            const walk = (list) => (list || []).forEach((blk) => {
                if (blk[0] === type) n++;
                if (Array.isArray(blk[4])) walk(blk[4]);
            });
            walk(script.slice(TRIGGERS.has((script[0] || [])[0]) ? 1 : 0));
            return n;
        };

        (when.blockTypes || []).forEach((type) => {
            const needed = minCounts[type] || 1;
            if (TRIGGERS.has(type)) {
                // O próprio gatilho conta como "tipo presente" (blockMatch).
                const pool = tscripts.filter((s) => s.trigger === type);
                const haveN = sprite.scripts.filter((x) => x[0] && x[0][0] === type).length;
                for (let k = haveN; k < needed; k++) {
                    const t = pool[k] || pool[0];
                    sprite.scripts.push([b(type, when.triggerArg !== undefined ? when.triggerArg : (t ? t.triggerArg : null))]);
                }
                return;
            }
            const scoped = tscripts.filter((s) => !when.trigger || s.trigger === when.trigger);
            const entries = [];
            scoped.forEach((s) => s.entries.forEach((e) => {
                if (e.type === type) entries.push({e, s});
            }));
            if (!entries.length) return;
            const target = when.trigger
                ? scriptFor(when.trigger, entries[0].s.triggerArg)
                : scriptFor(entries[0].s.trigger, entries[0].s.triggerArg);
            const haveN = countIn(target, type);
            entries.slice(haveN, needed).forEach(({e, s}) => {
                const value = wantedArgs[type] !== undefined ? wantedArgs[type] : e.arg;
                if (e.rep === null) {
                    if (type === 'repeat') {
                        const rkey = key + '|' + s.trigger + '|' + e.idx;
                        const existing = this.repeats.get(rkey);
                        if (existing && target.includes(existing)) return;
                        const tuple = b('repeat', value, []);
                        this.repeats.set(rkey, tuple);
                        target.push(tuple);
                    } else {
                        target.push(b(type, value));
                    }
                } else {
                    const rkey = key + '|' + s.trigger + '|' + e.rep;
                    let rep = this.repeats.get(rkey);
                    if (!rep || !target.includes(rep)) {
                        const trep = s.entries.find((x) => x.idx === e.rep);
                        rep = b('repeat', trep ? trep.arg : 1, []);
                        this.repeats.set(rkey, rep);
                        target.push(rep);
                    }
                    rep[4].push(b(type, value));
                }
            });
        });
    }

    // --- execução -----------------------------------------------------------

    /** Chamada de decideHintAction no estado atual (aluno parado há muito tempo). */
    decide (detailed) {
        return decideHintAction({
            hints: this.hints, detailed, dismissed: this.dismissed, alerted: new Set(),
            idleMs: 1e9, modalOpen: false, panelOpen: false,
        });
    }

    /**
     * Roda a simulação inteira. Devolve {trace, failures}: failures vazio =
     * I3 vale. Cada falha: {step, hintId, rule: 'a'|'b'|'c'|'d', detail}.
     */
    run () {
        const trace = [];
        const failures = [];
        const pendingTasks = (detailed) => this.hints.filter((h) => isTaskHint(h) && hintConditionHolds(h, detailed));
        this.hints.forEach((hint, step) => {
            if (!isTaskHint(hint)) return;
            const before = this.detailed();
            const pending = pendingTasks(before);
            const proactive = nextProactiveHint(this.hints, before, this.dismissed);
            if (pending.length && !proactive) {
                failures.push({step, hintId: hint.id, rule: 'a', detail: 'tarefas pendentes ' + pending.map((h) => h.id) + ' mas nextProactiveHint=null'});
            }
            this.applyHint(hint);
            const after = this.detailed();
            if (hintConditionHolds(hint, after)) {
                failures.push({step, hintId: hint.id, rule: 'c', detail: 'dica ainda pendente depois de cumprida pelo simulador (' + hint.when.type + ')'});
            }
            const decision = this.decide(after);
            if (decision.action && decision.action.kind === 'alert') {
                failures.push({step, hintId: hint.id, rule: 'b', detail: 'alerta falso: ' + decision.action.info.kind + ' sig=' + decision.action.info.sig});
            }
            trace.push({step, hintId: hint.id, type: hint.when.type, pending: pending.map((h) => h.id), proactive: proactive && proactive.id});
        });
        const last = pendingTasks(this.detailed());
        if (last.length) {
            failures.push({step: this.hints.length, hintId: last[0].id, rule: 'd', detail: 'sobraram pendentes: ' + last.map((h) => h.id)});
        }
        return {trace, failures};
    }
}

/** Atalho: simula e devolve {trace, failures, student}. */
export function simulateHints (teacherProject, hints) {
    const sim = new HintSimulator(teacherProject, hints);
    const result = sim.run();
    return Object.assign(result, {student: sim.studentProject()});
}
