/**
 * shared/hintAlignment.mjs
 *
 * Fase 3 do sistema de dicas - ALINHAMENTO posição a posição entre o script
 * do professor (gravado na dica como when.expected.script) e o script do
 * aluno (manifesto detalhado: scenes[].characters[].scripts[].tokens, ver
 * shared/detailedManifest.mjs#tokenizeScript). 100% puro: sem I/O, sem DOM,
 * sem Supabase - roda igual no navegador (HintEngine) e no Node (gerador,
 * que valida a dica contra o PRÓPRIO projeto do professor).
 *
 * Por que existe: o caminho legado (HintEngine.js#blockMatch/mistakeInfo/
 * orderInfo) só sabe "existe um bloco desse tipo com esse valor em algum
 * lugar sob esse gatilho" (conjuntos de tipos/valores). Isso não resolve:
 *  - F3: valor certo + valor errado do mesmo tipo contava como feito;
 *  - F4: a 2ª ocorrência (minCounts) nunca tinha o valor DELA conferido;
 *  - F5: professor usa o mesmo bloco com valores diferentes -> nenhum valor
 *    era conferido;
 *  - F6: ordem dentro do script não era conferida;
 *  - F7: dentro/fora do repeat era indistinguível.
 * Aqui cada POSIÇÃO do script do professor é pareada com no máximo uma do
 * aluno, respeitando ordem e aninhamento, e cada dica avalia só as posições
 * que ela ensina (when.expected.covered).
 *
 * Contrato do formato da dica: ver shared/hintSchema.mjs (when.expected).
 */

import {REPEAT_CLOSE} from './detailedManifest.mjs';

/** Estados por dica (ver evaluateExpectedHints). */
export const ALIGN_STATES = Object.freeze(['done', 'pending', 'wrong_value', 'wrong_order', 'extra_block']);

/**
 * Prioridade quando uma dica tem mais de um problema - o MAIOR vence:
 * pending > wrong_order > wrong_value > extra_block.
 *  - pending primeiro: um passo que o aluno ainda não fez não é erro - a dica
 *    proativa ("agora coloque...") é o que ajuda; acusar o erro de um outro
 *    pedaço da mesma dica antes disso confunde.
 *  - wrong_order antes de wrong_value: se o bloco está no lugar errado, o
 *    valor dele nem foi pareado com a posição certa - mandar "corrigir o
 *    número" de um bloco que vai mudar de lugar é conselho errado.
 *  - extra_block por último: só faz sentido falar de sobra quando o que
 *    foi pedido está todo lá (ver a regra em evaluateGroup).
 */
const RANK = {extra_block: 1, wrong_value: 2, wrong_order: 3, pending: 4};

// --------------------------------------------------------------------------
// Pontuação. Par = [primário, exatos], comparado lexicograficamente:
// primário = 2 por par tipo+valor (ou say, ou professor sem valor exigido),
// 1 por par só de tipo (valor diferente, ou aluno pending/unset); exatos =
// quantos pares do 1º tipo. O 2º critério desempata casos como professor
// [F3, F5] x aluno [F5, F3]: {F3-F3} e {F3-F5, F5-F3} somam 2 no primário,
// mas o primeiro pareia um valor certo e aponta o outro como fora do lugar
// (decisão do usuário: a ordem importa), em vez de dois "valor errado".
// --------------------------------------------------------------------------

const ZERO = [0, 0];
const EXACT = [2, 1];
const LOOSE = [1, 0];

function add (a, b) {
    return [a[0] + b[0], a[1] + b[1]];
}

/** a > b ? */
function better (a, b) {
    return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1];
}

/** Aluno ainda não escolheu o valor (pending/unset) - nunca é "valor errado". */
function isOpen (s) {
    return (s.pending !== null && s.pending !== undefined) || s.unset === true;
}

function numOf (t) {
    return t.num === undefined ? null : t.num;
}

/**
 * Peso de parear o token do professor `t` com o do aluno `s`; null se não
 * podem parear (tipos diferentes).
 */
function tokenWeight (t, s) {
    if (t.type !== s.type) return null;
    if (isOpen(s)) return LOOSE;
    if (t.type === 'say' || numOf(t) === null) return EXACT; // texto do say não importa; professor sem valor = qualquer um
    return numOf(s) === numOf(t) ? EXACT : LOOSE;
}

/**
 * Lista de tokens -> árvore: folhas {idx, children: null} e grupos de repeat
 * {idx (abertura), close (índice do REPEAT_CLOSE, -1 se faltar), children}.
 * Defensivo: fechamento órfão é ignorado (nunca pareia); repeat sem
 * fechamento fecha no fim.
 */
function buildTree (tokens) {
    const root = [];
    const levels = [root];
    const open = [];
    tokens.forEach(function (t, idx) {
        if (t.type === REPEAT_CLOSE) {
            if (open.length) {
                open.pop().close = idx;
                levels.pop();
            }
            return;
        }
        if (t.type === 'repeat') {
            const node = {idx, close: -1, children: []};
            levels[levels.length - 1].push(node);
            levels.push(node.children);
            open.push(node);
            return;
        }
        levels[levels.length - 1].push({idx, children: null});
    });
    return root;
}

/**
 * LCS ponderado entre dois NÍVEIS (irmãos) das árvores. Um grupo de repeat
 * só pareia com outro grupo de repeat, e o conteúdo deles é alinhado
 * recursivamente - então um bloco de fora do repeat NUNCA pareia com um de
 * dentro (falha F7), o que um LCS sobre a lista achatada com marcadores não
 * garante sozinho (professor [F, R, H, /R] x aluno [R, F, H, /R] empataria
 * F-F com R-R).
 *
 * Desempate (determinismo): em empate exato, prefere parear > pular o token
 * do ALUNO > pular o do PROFESSOR. Efeito: as posições mais cedo do
 * professor ficam pareadas e as posteriores é que aparecem como faltando/
 * fora do lugar; entre blocos iguais do aluno, o mais cedo é o pareado.
 */
function alignLevel (tNodes, sNodes, T, S, memo) {
    const n = tNodes.length;
    const m = sNodes.length;
    const dp = [];
    const pick = [];
    for (let i = 0; i <= n; i++) {
        dp.push(new Array(m + 1).fill(ZERO));
        pick.push(new Array(m + 1).fill(null));
    }
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            let best = dp[i + 1][j];
            let choice = 't';
            if (!better(best, dp[i][j + 1])) {
                best = dp[i][j + 1];
                choice = 's';
            }
            const pair = pairNodes(tNodes[i], sNodes[j], T, S, memo);
            if (pair) {
                const cand = add(pair.score, dp[i + 1][j + 1]);
                if (!better(best, cand)) {
                    best = cand;
                    choice = pair;
                }
            }
            dp[i][j] = best;
            pick[i][j] = choice;
        }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        const choice = pick[i][j];
        if (choice === 't') {
            i++;
        } else if (choice === 's') {
            j++;
        } else {
            choice.pairs.forEach(function (p) {
                pairs.push(p);
            });
            i++;
            j++;
        }
    }
    return {score: dp[0][0], pairs};
}

function pairNodes (t, s, T, S, memo) {
    if ((t.children === null) !== (s.children === null)) return null;
    const w = tokenWeight(T[t.idx], S[s.idx]);
    if (!w) return null;
    if (t.children === null) {
        return {score: w, pairs: [[t.idx, s.idx]]};
    }
    const key = t.idx + ',' + s.idx;
    if (!memo.has(key)) {
        const inner = alignLevel(t.children, s.children, T, S, memo);
        let score = add(w, inner.score);
        const pairs = [[t.idx, s.idx]].concat(inner.pairs);
        if (t.close >= 0 && s.close >= 0) {
            score = add(score, EXACT);
            pairs.push([t.close, s.close]);
        }
        memo.set(key, {score, pairs});
    }
    return memo.get(key);
}

/**
 * Alinha os tokens do professor (when.expected.script, {type, num}) com os
 * do aluno (manifesto scripts[].tokens, {type, num, pending, unset, path}).
 * Puro e determinístico. Retorna:
 *   {teacherToStudent: number[]  - por índice do professor, o índice do
 *                                  token do aluno pareado ou -1;
 *    studentToTeacher: number[]  - o inverso;
 *    score: number               - primário (2 por par exato, 1 por par só
 *                                  de tipo - ver tokenWeight);
 *    exact: number}              - quantos pares exatos.
 * Marcadores REPEAT_CLOSE pareiam junto com a abertura do seu repeat.
 */
export function alignScript (teacherTokens, studentTokens) {
    const T = Array.isArray(teacherTokens) ? teacherTokens : [];
    const S = Array.isArray(studentTokens) ? studentTokens : [];
    const result = alignLevel(buildTree(T), buildTree(S), T, S, new Map());
    const teacherToStudent = new Array(T.length).fill(-1);
    const studentToTeacher = new Array(S.length).fill(-1);
    result.pairs.forEach(function (p) {
        teacherToStudent[p[0]] = p[1];
        studentToTeacher[p[1]] = p[0];
    });
    return {teacherToStudent, studentToTeacher, score: result.score[0], exact: result.score[1]};
}

// --------------------------------------------------------------------------
// Avaliação das dicas
// --------------------------------------------------------------------------

/** A dica usa o caminho da Fase 3 (tem when.expected bem formado)? */
export function hasExpected (hint) {
    const when = hint && hint.when;
    return !!(when && when.type === 'character_missing_block_type' &&
        when.expected && typeof when.expected === 'object' &&
        typeof when.expected.trigger === 'string' && Array.isArray(when.expected.script));
}

/** Mesmo lookup de HintEngine.js#findSceneAndCharacter (sem importar o cliente). */
function charactersFor (scenes, when) {
    const scene = scenes.filter(function (s) {
        return s.sceneMd5 === when.sceneMd5;
    })[(when.sceneOccurrence || 1) - 1];
    if (!scene || !Array.isArray(scene.characters)) return [];
    const copies = scene.characters.filter(function (c) {
        return c.characterMd5 === when.characterMd5;
    }).map(function (character, i) {
        return {character, occurrence: i + 1};
    });
    if (when.characterOccurrence) {
        return copies.filter(function (c) {
            return c.occurrence === when.characterOccurrence;
        });
    }
    return copies;
}

function expectedTriggerArg (expected) {
    return expected.trigger === 'onmessage' && typeof expected.triggerArg === 'string' ? expected.triggerArg : null;
}

/**
 * Chave do "script do professor" de uma dica: dicas com o mesmo gatilho,
 * mensagem, ocorrência e lista de tokens descrevem o MESMO script e são
 * avaliadas juntas (precisam da visão cruzada pra extra_block).
 */
function scriptKey (expected) {
    return JSON.stringify([
        expected.trigger,
        expectedTriggerArg(expected),
        expected.occurrence || 1,
        expected.script.map(function (t) {
            return [t && t.type, t ? numOf(t) : null];
        }),
    ]);
}

/** Posições cobertas válidas, sem fechamento de repeat, ordenadas e únicas. */
function coveredOf (expected) {
    const covered = Array.isArray(expected.covered) ? expected.covered : [];
    const out = [];
    covered.forEach(function (c) {
        if (Number.isInteger(c) && c >= 0 && c < expected.script.length &&
            expected.script[c] && expected.script[c].type !== REPEAT_CLOSE && !out.includes(c)) {
            out.push(c);
        }
    });
    return out.sort(function (a, b) {
        return a - b;
    });
}

function positionOf (script, token) {
    return {scriptIndex: script.scriptIndex, path: token.path};
}

/**
 * Avalia um grupo de dicas (mesmo script do professor) contra UM script do
 * aluno (ou null = o aluno não tem script com esse gatilho/mensagem).
 * Devolve Map(hint.id -> resultado sem characterOccurrence).
 */
function evaluateGroup (group, script) {
    const out = new Map();
    const T = group.teacher;
    if (!script) {
        group.items.forEach(function (item) {
            out.set(item.hint.id, {state: 'pending', reason: 'no_script', scriptIndex: null});
        });
        return out;
    }
    const S = Array.isArray(script.tokens) ? script.tokens : [];
    const al = alignScript(T, S);

    // Posições do professor sem par: casa com blocos do aluno do MESMO tipo
    // também sem par (fora do lugar / dentro-fora do repeat errado). Cada
    // bloco do aluno é reivindicado por no máximo UMA posição, na ordem do
    // professor, preferindo o de valor igual - assim duas posições faltando
    // não apontam pro mesmo bloco, e a que sobra fica "pending" de verdade.
    const claimedBy = new Map(); // índice do professor -> índice do aluno
    const claimed = new Set();
    T.forEach(function (t, ti) {
        if (t.type === REPEAT_CLOSE || al.teacherToStudent[ti] >= 0) return;
        let found = -1;
        for (let si = 0; si < S.length; si++) {
            if (al.studentToTeacher[si] >= 0 || claimed.has(si) || S[si].type !== t.type) continue;
            if (found < 0) found = si;
            if (tokenWeight(t, S[si]) === EXACT) {
                found = si;
                break;
            }
        }
        if (found >= 0) {
            claimed.add(found);
            claimedBy.set(ti, found);
        }
    });

    // extra_block: só quando TODAS as posições do professor neste script
    // estão pareadas (antes disso, um bloco sobrando é mais provavelmente o
    // que falta, fora do lugar). Só tipos que o professor usa NESTE script
    // (um bloco de outro tipo é invenção do aluno, não sobra de um passo);
    // nunca say (fala é livre). Scripts do aluno com gatilho/mensagem que o
    // professor não tem nunca chegam aqui, nem os que sobraram na
    // atribuição gulosa (ver evaluateCopy) - conservador: só acusa sobra
    // dentro do script que corresponde ao do professor. Cada sobra vai pra
    // 1ª dica (ordem do array) cujo covered tem um token daquele tipo.
    const allPaired = T.every(function (t, ti) {
        return t.type === REPEAT_CLOSE || al.teacherToStudent[ti] >= 0;
    });
    const extras = new Map(); // hint.id -> [índices do aluno]
    if (allPaired) {
        const teacherTypes = new Set(T.map(function (t) {
            return t.type;
        }));
        S.forEach(function (s, si) {
            if (al.studentToTeacher[si] >= 0 || s.type === REPEAT_CLOSE || s.type === 'say' || !teacherTypes.has(s.type)) return;
            const owner = group.items.find(function (item) {
                return item.covered.some(function (c) {
                    return T[c].type === s.type;
                });
            });
            if (owner) {
                const list = extras.get(owner.hint.id) || [];
                list.push(si);
                extras.set(owner.hint.id, list);
            }
        });
    }

    group.items.forEach(function (item) {
        let top = null;
        item.covered.forEach(function (c) {
            const t = T[c];
            const si = al.teacherToStudent[c];
            let issue = null;
            if (si < 0) {
                const other = claimedBy.get(c);
                issue = other === undefined ?
                    {state: 'pending', reason: 'missing', blockType: t.type, teacherIndex: c} :
                    {state: 'wrong_order', blockType: t.type, teacherIndex: c, position: positionOf(script, S[other])};
            } else {
                const s = S[si];
                if (s.pending !== null && s.pending !== undefined) {
                    issue = {state: 'pending', reason: 'unconfirmed', blockType: t.type, teacherIndex: c,
                        position: positionOf(script, s), expected: numOf(t), got: s.pending};
                } else if (s.unset === true) {
                    issue = {state: 'pending', reason: 'unset', blockType: t.type, teacherIndex: c,
                        position: positionOf(script, s), expected: numOf(t), got: null};
                } else if (tokenWeight(t, s) !== EXACT) {
                    issue = {state: 'wrong_value', blockType: t.type, teacherIndex: c,
                        position: positionOf(script, s), expected: numOf(t), got: numOf(s)};
                }
            }
            // Empate de prioridade: fica a 1ª posição (ordem do professor).
            if (issue && (!top || RANK[issue.state] > RANK[top.state])) top = issue;
        });
        let result = top;
        if (!result && extras.has(item.hint.id)) {
            const list = extras.get(item.hint.id);
            result = {state: 'extra_block', blockType: S[list[0]].type,
                position: positionOf(script, S[list[0]]), extraCount: list.length};
        }
        result = result || {state: 'done'};
        result.scriptIndex = script.scriptIndex;
        out.set(item.hint.id, result);
    });
    return out;
}

/**
 * Avalia todos os grupos de um personagem contra UMA cópia dele no projeto
 * do aluno. Atribuição GULOSA de scripts: grupos na ordem em que a 1ª dica
 * de cada um aparece no array; cada grupo pega, entre os scripts do aluno
 * ainda não usados com o mesmo gatilho (e mesma mensagem, se o professor
 * tem uma), o de maior pontuação de alinhamento (empate: o que vem antes em
 * character.scripts). Assim, se o professor tem dois scripts "ao tocar na
 * bandeira", cada um é comparado com um script DIFERENTE do aluno.
 */
function evaluateCopy (groups, character) {
    const scripts = Array.isArray(character.scripts) ? character.scripts : [];
    const used = new Set();
    const results = new Map();
    let score = 0;
    let exact = 0;
    groups.forEach(function (group) {
        let best = null;
        let bestAl = null;
        scripts.forEach(function (script, k) {
            if (used.has(k) || script.trigger !== group.trigger) return;
            if (group.triggerArg !== null && script.triggerArg !== group.triggerArg) return;
            const al = alignScript(group.teacher, script.tokens);
            if (!bestAl || better([al.score, al.exact], [bestAl.score, bestAl.exact])) {
                best = k;
                bestAl = al;
            }
        });
        if (best !== null) {
            used.add(best);
            score += bestAl.score;
            exact += bestAl.exact;
        }
        evaluateGroup(group, best === null ? null : scripts[best]).forEach(function (r, id) {
            results.set(id, r);
        });
    });
    let done = 0;
    let notPending = 0;
    results.forEach(function (r) {
        if (r.state === 'done') done++;
        if (r.state !== 'pending') notPending++;
    });
    return {results, rank: [done, notPending, score, exact]};
}

function rankBetter (a, b) {
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
}

/**
 * Avalia de uma vez TODAS as dicas com when.expected (as demais são
 * ignoradas - não entram no Map, o chamador usa o caminho legado nelas).
 * Precisa ser em lote: extra_block depende de saber se TODAS as posições do
 * script do professor estão pareadas, e de qual dica é a "dona" de cada
 * tipo (visão cruzada entre dicas).
 *
 * Agrupamento: (cena md5+ocorrência, personagem md5+characterOccurrence ou
 * "qualquer cópia") -> (script do professor: gatilho+mensagem+ocorrência+
 * tokens). Sem characterOccurrence, cada cópia do personagem é avaliada e
 * fica a MELHOR: mais dicas done, depois mais dicas não-pendentes, depois
 * maior pontuação de alinhamento (score, exact); empate = a 1ª cópia. A
 * escolha é por personagem (todas as dicas dele saem da mesma cópia), pra
 * que a criança não veja uma dica resolvida numa Ruby e a seguinte
 * reclamando da outra.
 *
 * Retorna Map(hint.id -> resultado):
 *   {state: 'done'|'pending'|'wrong_value'|'wrong_order'|'extra_block',
 *    characterOccurrence: number|null, // cópia do aluno avaliada (null = nenhuma)
 *    scriptIndex: number|null,        // script do aluno escolhido (sprite.scripts original)
 *    // conforme o estado:
 *    reason?: 'no_character'|'no_script'|'missing'|'unconfirmed'|'unset', // só pending
 *    blockType?: string, teacherIndex?: number,  // posição decisiva em expected.script
 *    position?: {scriptIndex, path},             // bloco do ALUNO (vivo) a destacar
 *    expected?: number|null, got?: number|null,  // wrong_value / unconfirmed / unset
 *    extraCount?: number}                        // extra_block: quantas sobras dessa dica
 */
export function evaluateExpectedHints (hints, detailed) {
    const results = new Map();
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const byCharacter = new Map();
    (Array.isArray(hints) ? hints : []).forEach(function (hint) {
        if (!hasExpected(hint)) return;
        const when = hint.when;
        const charKey = JSON.stringify([when.sceneMd5, when.sceneOccurrence || 1, when.characterMd5, when.characterOccurrence || 0]);
        if (!byCharacter.has(charKey)) byCharacter.set(charKey, {when, groups: new Map()});
        const groups = byCharacter.get(charKey).groups;
        const key = scriptKey(when.expected);
        if (!groups.has(key)) {
            groups.set(key, {
                trigger: when.expected.trigger,
                triggerArg: expectedTriggerArg(when.expected),
                teacher: when.expected.script.map(function (t) {
                    return {type: t && t.type, num: t ? numOf(t) : null};
                }),
                items: [],
            });
        }
        groups.get(key).items.push({hint, covered: coveredOf(when.expected)});
    });

    byCharacter.forEach(function (entry) {
        const groups = Array.from(entry.groups.values());
        const copies = charactersFor(scenes, entry.when);
        let best = null;
        copies.forEach(function (copy) {
            const evaluated = evaluateCopy(groups, copy.character);
            if (!best || rankBetter(evaluated.rank, best.rank)) {
                best = {rank: evaluated.rank, results: evaluated.results, occurrence: copy.occurrence};
            }
        });
        groups.forEach(function (group) {
            group.items.forEach(function (item) {
                const r = best ? best.results.get(item.hint.id) :
                    {state: 'pending', reason: 'no_character', scriptIndex: null};
                r.characterOccurrence = best ? best.occurrence : null;
                results.set(item.hint.id, r);
            });
        });
    });
    return results;
}
