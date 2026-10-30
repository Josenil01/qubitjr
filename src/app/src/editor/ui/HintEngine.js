/**
 * src/app/src/editor/ui/HintEngine.js
 *
 * Lógica PURA de avaliação de dica (lado do aluno) - extraída de
 * AssignmentBadge.js (refatoração Fase 0: isolar o que já era puro antes de
 * reorganizar o resto) pra poder ser testada sem DOM/ScratchJr/Project.js.
 * Nenhuma função aqui lê o palco, faz fetch ou toca em `document` - tudo
 * recebe o `detailed` (computeDetailedManifest(), ver detailedManifest.js) e
 * a(s) dica(s) (`assignment.hints`, formato de hintsGeneration.js no backend)
 * como argumento e devolve um valor; nada de estado de módulo.
 *
 * Consumido por AssignmentBadge.js em dois pontos independentes:
 *  - _evaluateHints() (poll automático, decide a dica/alerta a mostrar);
 *  - _openHintsPanel()/_renderHintsPanel() (painel navegável manual).
 * Os dois precisam da MESMA resposta pra "esta dica já foi resolvida?" -
 * daí valer a pena ter um módulo só, em vez de duas cópias.
 *
 * Mesmo contrato de `when.type` que o backend valida em
 * backend/src/services/hintsGeneration.js#isHintValid - ver aquele arquivo
 * pra entender por que cada campo existe (sceneOccurrence, trigger,
 * minCounts, blockArgs, triggerExclusive). A ENUMERAÇÃO dos tipos válidos
 * (refatoração Fase 4) mora em shared/hintSchema.mjs, importada pelos dois
 * lados - ver aquele arquivo pro racional completo de LLM_WHEN_TYPES vs
 * ALL_WHEN_TYPES. Os CAMPOS de cada tipo (o resto do contrato) continuam só
 * documentados, não impostos em runtime por um schema formal.
 */

import {ALL_WHEN_TYPES, MANUAL_WHEN_TYPE} from '../../../../../shared/hintSchema.mjs';
import {hasExpected, evaluateExpectedHints} from '../../../../../shared/hintAlignment.mjs';

// ---------------------------------------------------------------------------
// Fase 3 (E6c) - dicas com when.expected usam SÓ o alinhamento
// (shared/hintAlignment.mjs#evaluateExpectedHints). As funções legadas
// (blockMatch/mistakeInfo/orderInfo) continuam valendo, intactas, para as
// dicas SEM expected (salvas antes da Fase 3, ou que o gerador não conseguiu
// mapear) - numa missão MISTA cada dica vai pelo seu caminho, e
// legacyShadowedByExpected impede o mesmo bloco de alertar pelos dois.
// ---------------------------------------------------------------------------

/**
 * Cache do alinhamento: detailed (objeto) -> Map(array de dicas -> resultados).
 * evaluateExpectedHints precisa ver TODAS as dicas de uma vez (extra_block é
 * uma visão cruzada do grupo), e um ciclo de decideHintAction/painel consulta
 * o estado de várias dicas várias vezes (proativa, alertas, status) - sem o
 * cache o alinhamento rodaria uma vez por consulta. WeakMap: o manifesto de um
 * ciclo vira lixo junto com o cache dele (cada tick recalcula o detailed).
 */
const expectedCache = new WeakMap();

/**
 * Resultados do alinhamento (Map hint.id -> resultado, ver
 * hintAlignment.mjs#evaluateExpectedHints) das dicas COM when.expected de
 * `hints`, contra `detailed`. Calculado UMA vez por par (detailed, hints) -
 * chamadas repetidas no mesmo ciclo devolvem o mesmo Map. Dicas sem expected
 * não entram (caminho legado).
 */
export function expectedResultsFor (hints, detailed) {
    const list = Array.isArray(hints) ? hints : [];
    if (!detailed || typeof detailed !== 'object') {
        return evaluateExpectedHints(list, detailed);
    }
    let byHints = expectedCache.get(detailed);
    if (!byHints) {
        byHints = new Map();
        expectedCache.set(detailed, byHints);
    }
    if (!byHints.has(list)) {
        byHints.set(list, evaluateExpectedHints(list, detailed));
    }
    return byHints.get(list);
}

/**
 * Resultado do alinhamento de UMA dica com expected. Com `expectedResults`
 * (o Map de expectedResultsFor do ciclo) usa o que já foi calculado; sem ele
 * (chamador antigo de hintConditionHolds(hint, detailed)), avalia a dica
 * sozinha - aproximação: sem as irmãs do mesmo script, a sobra (extra_block)
 * é atribuída só a ela. Os chamadores do motor (decideHintAction, painel,
 * simulador) sempre passam o Map.
 */
function expectedResultOf (hint, detailed, expectedResults) {
    const cached = expectedResults && typeof expectedResults.get === 'function' ? expectedResults.get(hint.id) : null;
    return cached || expectedResultsFor([hint], detailed).get(hint.id);
}

/**
 * Rótulo PT-BR curto de cada tipo de bloco, como a criança o chama - usado
 * nos textos dos alertas do alinhamento ("o número do bloco de andar pra
 * frente era 3"). Não havia uma tabela dessas no projeto: localizations/pt.json
 * é pt-PT e só tem DESCRIÇÕES longas ("Move o actor..."), e o gerador
 * (backend/src/services/hintsGeneration.js, SYSTEM_PROMPT) só dá à LLM o jeito
 * de mencionar cada bloco em prosa ("bloco de espere", "bloco de repita",
 * "andar N passos pra frente") - os rótulos abaixo seguem essas mesmas
 * palavras. Tipo fora da tabela cai no próprio nome do tipo.
 */
export const BLOCK_LABELS = Object.freeze({
    forward: 'andar pra frente',
    back: 'andar pra trás',
    up: 'subir',
    down: 'descer',
    right: 'girar pra direita',
    left: 'girar pra esquerda',
    hop: 'pular',
    home: 'voltar pro início',
    wait: 'espere',
    repeat: 'repita',
    forever: 'repetir pra sempre',
    setspeed: 'velocidade',
    stopmine: 'parar',
    grow: 'crescer',
    shrink: 'encolher',
    same: 'tamanho normal',
    show: 'aparecer',
    hide: 'sumir',
    say: 'falar',
    playsnd: 'som',
    playusersnd: 'som gravado',
    message: 'enviar mensagem',
    gotopage: 'ir pra cena',
    endstack: 'fim',
});

export function blockLabel (type) {
    return BLOCK_LABELS[type] || String(type);
}

/**
 * Mesmas palavras de shared/detailedManifest.mjs#SPEED_LABELS (não exportada
 * lá) - o setspeed guarda 0/1/2, mas a criança vê os ícones lenta/normal/
 * rápida, então o alerta fala a palavra, nunca o número.
 */
const SPEED_WORDS = ['lenta', 'normal', 'rápida'];

/**
 * Encontra, dentro do detailedManifest, a cena com o sceneMd5 dado e
 * (se characterMd5 também for passado) o personagem com esse
 * characterMd5 dentro dela. Retorna null se a cena (ou o personagem
 * dentro dela) simplesmente não existir ainda no projeto do aluno -
 * chamado só sabe decidir o que fazer com esse "não existe" (ver cada
 * ramo de hintConditionHolds).
 *
 * sceneOccurrence (1-based, default 1) escolhe QUAL cena entre as que
 * usam o mesmo fundo - um projeto pode reusar o mesmo sceneMd5 em mais
 * de uma página (ex.: a história volta pro "Bosque" mais adiante), e sem
 * distinguir a ocorrência, uma dica sobre a 2ª vez sempre acabava
 * batendo (errado) na 1ª cena que usa aquele fundo, já que essa lista é
 * filtrada e indexada na ORDEM em que as cenas aparecem no projeto do
 * aluno (não precisa bater com a posição/página exata do professor -
 * só com "qual em ordem, entre as que têm esse fundo"). Ausente/1 se
 * comporta como antes (sempre a primeira ocorrência) - hints salvos
 * antes deste campo existir (sem sceneOccurrence no `when`) continuam
 * funcionando sem mudança.
 *
 * characterOccurrence (Fase 2, falha F9) é a mesma ideia um nível abaixo:
 * a cena pode ter DUAS cópias do mesmo personagem (mesmo md5). Com ele
 * (1-based), `character` é a N-ésima cópia na ordem da cena (null se o
 * aluno ainda não tem N cópias); sem ele, `character` continua sendo a 1ª
 * (comportamento antigo). `characters` traz SEMPRE todas as cópias - é o
 * que candidatesFor() usa pra regra "qualquer cópia" das dicas legadas.
 */
export function findSceneAndCharacter (scenes, sceneMd5, characterMd5, sceneOccurrence, characterOccurrence) {
    const matches = scenes.filter(function (s) {
        return s.sceneMd5 === sceneMd5;
    });
    const scene = matches[(sceneOccurrence || 1) - 1] || null;
    if (!scene) {
        return {scene: null, character: null, characters: []};
    }
    const characters = scene.characters.filter(function (c) {
        return c.characterMd5 === characterMd5;
    });
    const character = characters[(characterOccurrence || 1) - 1] || null;
    return {scene, character, characters};
}

/**
 * Cópias do personagem de uma dica que podem satisfazê-la, cada uma com a
 * sua ocorrência (1-based, posição entre as cópias do mesmo md5 na cena):
 *  - when.characterOccurrence presente (o gerador só grava quando o
 *    professor TEM cópias repetidas - ver hintsGeneration.js
 *    #fillCharacterOccurrence): só aquela cópia;
 *  - ausente (dica legada, ou personagem sem cópias no projeto do
 *    professor): TODAS as cópias - a dica conta como feita se QUALQUER uma
 *    satisfaz, e só fica pendente se nenhuma satisfaz. Antes só a 1ª cópia
 *    era olhada: um aluno que montava o script na 2ª Ruby nunca via a dica
 *    resolvida (regressão P9a).
 * [] se a cena ou o personagem ainda não existem.
 */
export function candidatesFor (scenes, when) {
    const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence, when.characterOccurrence);
    if (when.characterOccurrence) {
        return found.character ? [{character: found.character, occurrence: when.characterOccurrence}] : [];
    }
    return found.characters.map(function (character, i) {
        return {character: character, occurrence: i + 1};
    });
}

/**
 * Confere os blocos de UM personagem contra o `when` de uma dica
 * character_missing_block_type. Usa os scripts do manifesto (ver
 * detailedManifest.js#buildScriptDetail), não só a lista achatada de
 * tipos, pra respeitar dois campos que o gerador grava (ver
 * hintsGeneration.js#fillBlockContext):
 *  - when.trigger: o bloco só conta dentro de scripts com ESSE gatilho
 *    (onflag/onclick/...) - "quando clicar no Cofrinho, cresça" não fica
 *    resolvida com o `grow` sob a bandeira verde;
 *  - when.minCounts: a dica descreve a N-ésima ocorrência de um tipo
 *    (2º `say`) - N blocos daquele tipo precisam existir (dentro do
 *    gatilho, se houver).
 *  - when.triggerArg: com when.trigger 'onmessage', o nome da mensagem
 *    (ver comentário no corpo).
 * Dica sem esses campos (salva antes deles existirem) se comporta como
 * sempre: qualquer script, pelo menos 1 de cada tipo. Blocos soltos (script
 * sem gatilho) nunca chegam aqui - o manifesto já os descarta (falha F10).
 * Retorna {typesOk, argsOk, values, wrongTrigger}: wrongTrigger = os
 * blocos existem (contando todos os scripts) mas não no gatilho pedido.
 */
export function blockMatch (character, when) {
    // when.triggerArg (Fase 2, falha F8): o NOME da mensagem de um gatilho
    // onmessage - o bloco só conta sob "quando receber ESSA mensagem", não
    // sob qualquer onmessage. Só o gerador grava (e só com
    // when.trigger === 'onmessage'); dica sem ele = comportamento antigo
    // (qualquer onmessage serve). triggerExclusive/wrongTrigger passam a
    // valer por (gatilho, mensagem) também: o mesmo bloco sob a mensagem
    // errada é "lugar errado".
    const wantedTriggerArg = when.trigger === 'onmessage' && typeof when.triggerArg === 'string' ? when.triggerArg : null;
    const wantedTypes = Array.isArray(when.blockTypes) ? when.blockTypes : [];
    const wantedArgs = when.blockArgs && typeof when.blockArgs === 'object' ? when.blockArgs : {};
    const minCounts = when.minCounts && typeof when.minCounts === 'object' ? when.minCounts : {};
    const allScripts = Array.isArray(character.scripts) ? character.scripts : [];
    const evaluate = function (pool) {
        const counts = {};
        const values = {};
        const pendings = {};
        pool.forEach(function (script) {
            // O bloco de início também conta como "tipo presente" (uma
            // dica pode listar onflag/onmessage em blockTypes).
            if (script.trigger) {
                counts[script.trigger] = (counts[script.trigger] || 0) + 1;
            }
            script.blocks.forEach(function (b) {
                counts[b.type] = (counts[b.type] || 0) + 1;
                if (b.num !== null && b.num !== undefined) {
                    (values[b.type] = values[b.type] || []).push(b.num);
                }
                if (b.pending !== null && b.pending !== undefined) {
                    (pendings[b.type] = pendings[b.type] || []).push(b.pending);
                }
            });
        });
        return {
            values: values,
            pendings: pendings,
            typesOk: wantedTypes.every(function (bt) {
                return (counts[bt] || 0) >= (minCounts[bt] || 1);
            }),
            argsOk: Object.keys(wantedArgs).every(function (bt) {
                return (values[bt] || []).includes(wantedArgs[bt]);
            }),
        };
    };
    const scoped = when.trigger ? allScripts.filter(function (script) {
        return script.trigger === when.trigger &&
            (wantedTriggerArg === null || script.triggerArg === wantedTriggerArg);
    }) : allScripts;
    const result = evaluate(scoped);
    // wrongTrigger só quando o professor usa esse bloco APENAS naquele
    // gatilho (when.triggerExclusive) - senão um bloco fora dele pode ser
    // o de outra dica, não um erro (ver fillBlockContext).
    result.wrongTrigger = !!when.trigger && when.triggerExclusive === true &&
        !result.typesOk && evaluate(allScripts).typesOk;
    return result;
}

/** Tipos+valores da dica de bloco batem nesta cópia do personagem. */
function isBlockHintDoneFor (character, when) {
    const match = blockMatch(character, when);
    return match.typesOk && match.argsOk;
}

/**
 * Regras de cada when.type - ver o docblock do Part 2 desta feature
 * (mesma nomenclatura/contrato que AssignmentAuthorBar.js usa pra
 * rotular as dicas na tela do professor). Nunca lança - when.type
 * desconhecido/malformado simplesmente não bate (retorna false).
 *
 * Fase 3: dica character_missing_block_type COM when.expected (hasExpected)
 * vai SÓ pelo alinhamento - pendente = estado !== 'done' (pending, mas também
 * wrong_value/wrong_order/extra_block: a tarefa não está cumprida enquanto o
 * bloco estiver errado/fora do lugar/sobrando). Diferente do legado, o
 * personagem inexistente conta como pendente (reason 'no_character'), não
 * "resolvida". `expectedResults` (opcional) é o Map de expectedResultsFor do
 * ciclo - ver expectedResultOf.
 */
export function hintConditionHolds (hint, detailed, expectedResults) {
    const when = hint && hint.when;
    // ALL_WHEN_TYPES (shared/hintSchema.mjs) é a fonte única - um when.type
    // que não está nela nunca bate, e o switch abaixo não precisa de um
    // `default` adivinhando a mesma coisa (continua lá por exaustividade,
    // mas este guard já cobre o caso comum sem percorrer os outros ramos).
    if (!when || !ALL_WHEN_TYPES.includes(when.type)) {
        return false;
    }
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];

    switch (when.type) {
    case 'scene_missing': {
        // "Faltando" agora é relativo à OCORRÊNCIA pedida, não só "existe
        // uma cena qualquer com esse fundo" - senão, assim que a 1ª cena
        // de um fundo reusado existisse, uma dica sobre trazer aquele
        // fundo DE VOLTA numa cena posterior (sceneOccurrence >= 2) já
        // apareceria como resolvida sem o aluno ter feito nada (bug real
        // encontrado: duas dicas com o mesmo sceneMd5 e sem essa
        // distinção nunca conseguiam representar "adicione mais uma
        // cena" como uma tarefa própria).
        const occurrencesSoFar = scenes.filter(function (s) {
            return s.sceneMd5 === when.sceneMd5;
        }).length;
        return occurrencesSoFar < (when.sceneOccurrence || 1);
    }

    case 'character_missing': {
        // Com characterOccurrence N (falha F9): faltando enquanto o aluno
        // não tem N cópias desse personagem na cena ("coloque a 2ª Ruby").
        const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence, when.characterOccurrence);
        // Cena em si nem existindo ainda não conta como "personagem
        // faltando" - esse caso é coberto por um hint scene_missing
        // separado (ver comentário no topo do arquivo/spec).
        return !!found.scene && !found.character;
    }

    case 'character_no_script': {
        // Pendente se a cópia pedida (ou, sem characterOccurrence, ALGUMA
        // cópia) existe e nenhuma das candidatas tem script - ver
        // candidatesFor.
        const candidates = candidatesFor(scenes, when);
        return candidates.length > 0 && candidates.every(function (c) {
            return !c.character.hasScript;
        });
    }

    case 'character_missing_block_type': {
        // Achado em teste real (1) - "!hasScript => false" (por baixo,
        // "resolvida") tratava "o personagem ainda nem tem NENHUM
        // script" como se já tivesse feito o que a dica pede, mostrando
        // "✅ já resolvida" pra um personagem com o script totalmente
        // vazio. A ideia original parece ter sido "deixa o
        // character_no_script cobrir esse caso primeiro" - mas como o
        // personagem no projeto do professor TEM script (é por isso que
        // esta dica de blockTypes existe pra ele), o pipeline nunca gera
        // uma character_no_script companheira pra esse mesmo personagem,
        // e a condição nunca tinha chance de bater "ainda precisa" nesse
        // meio-tempo. Sem o atalho: blockTypes de um personagem sem
        // nenhum script ainda é sempre [] (ver detailedManifest.js), então
        // já dá "ainda precisa" corretamente, sem precisar de um caso
        // especial.
        if (hasExpected(hint)) {
            return expectedResultOf(hint, detailed, expectedResults).state !== 'done';
        }
        //
        // Achado em teste real (2) - `wanted.some(...)` (OU) considerava
        // a dica resolvida assim que QUALQUER UM dos blockTypes pedidos
        // aparecesse, mesmo quando a dica descreve uma COMBINAÇÃO (ex.:
        // blockTypes ["wait","say"] pra "espere um pouco e depois diga
        // X") - bastava o aluno colocar só o "wait" (ou só o "say") pra a
        // dica já sumir e a próxima aparecer, sem o comportamento
        // completo ter sido montado. Trocado pra `wanted.every(...)` (E):
        // só conta como feito quando TODOS os tipos pedidos já estão no
        // personagem. isHintValid() no backend garante que todo tipo
        // listado é um tipo que o personagem do professor de fato usa
        // ali - então exigir todos nunca deixa a dica impossível.
        const candidates = candidatesFor(scenes, when);
        if (!candidates.length) {
            return false; // personagem nem existe ainda - character_missing cobre esse caso
        }
        // Tipos (com contagem/gatilho - ver blockMatch) e valores
        // exigidos: ainda precisa enquanto algum não bater. Valor:
        // achado em teste real (3), decisão explícita do usuário - "say"
        // é o ÚNICO bloco cujo argumento pode divergir do professor
        // (por isso nunca aparece em blockArgs), todos os outros exigem
        // o valor exato. Cópias repetidas: pendente só se NENHUMA
        // candidata satisfaz (ver candidatesFor).
        return !candidates.some(function (c) {
            return isBlockHintDoneFor(c.character, when);
        });
    }

    case 'message_not_received': {
        let sent = false;
        let received = false;
        scenes.forEach(function (s) {
            s.characters.forEach(function (c) {
                if (c.messagesSent.includes(when.messageName)) sent = true;
                if (c.messagesReceived.includes(when.messageName)) received = true;
            });
        });
        return sent && !received;
    }

    case 'default_character_present': {
        // Toda página em branco no ScratchJr cria automaticamente um
        // personagem com o asset default (ver Page.js#createCat/
        // UI.js#mascotData) - inclusive toda vez que o aluno clica em
        // "+ nova cena", não só na primeira. A dica bate ENQUANTO esse
        // personagem ainda estiver na cena (quer dizer que o aluno ainda
        // não removeu o que sobrou) - some sozinha assim que ele apagar.
        const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        return !!found.character;
    }

    case 'mission_intro':
        // Dica de apresentação (ver hintsGeneration.js#buildIntroHint) -
        // não referencia cena/personagem nenhum, sempre "bate" - é sempre
        // a primeira dica da missão (índice 0 no array assignment.hints)
        // e some pra sempre nesta sessão assim que o aluno fechar, mesma
        // regra de dismissedHintIds de qualquer outra dica.
        return true;

    case MANUAL_WHEN_TYPE:
        // Dica escrita à mão pelo professor na tela de revisão (ver
        // AssignmentAuthorBar.js#_showHintReview addBtn) - não referencia
        // nenhuma cena/personagem/bloco do projeto, então não tem como
        // checar automaticamente se "já foi feita". Sempre bate (igual
        // mission_intro) - fica disponível no painel até o aluno mesmo
        // fechar, nunca marcada "✅ já resolvida" sozinha. Sem este caso
        // explícito, cairia no `default: return false` abaixo e apareceria
        // como resolvida na hora, antes mesmo do aluno ler.
        return true;

    default:
        return false;
    }
}

// Bloco zerado (missão) largado sem o aluno escolher o valor: lembra
// depois desse tempo parado - ver mistakeInfo kind 'fill' abaixo. Só usado
// aqui dentro (consumido pelo chamador via info.idleMs, nunca importado
// diretamente de AssignmentBadge.js).
const FILL_IDLE_MS = 2000;

/**
 * Erro do aluno numa dica de bloco, distinto de "ainda não fez": o bloco
 * do tipo certo EXISTE mas com VALOR errado (kind 'value') ou no
 * GATILHO errado (kind 'trigger'). Retorna {kind, sig} - sig identifica
 * o estado atual do erro (dica + valores/gatilhos que o aluno tem
 * agora), então trocar de um erro pra OUTRO gera assinatura nova (novo
 * alerta) e ficar parado no mesmo não repete - ver wrongValueAlerted em
 * AssignmentBadge.js.
 * null se a dica não é desse tipo, o personagem/blocos ainda não existem
 * (vale a dica proativa) ou nada está errado.
 *
 * Cópias repetidas do personagem (falha F9): se ALGUMA candidata (ver
 * candidatesFor) já cumpre a dica, não há erro a apontar; senão, o erro é
 * o da 1ª candidata que tem um. O retorno ganha `characterOccurrence` (a
 * cópia onde o erro está - só quando a dica tem characterOccurrence ou o
 * aluno tem 2+ cópias; sem isso o retorno é idêntico ao de antes) - é o
 * que AssignmentBadge.js#_highlightMistake
 * usa pra piscar os blocos da cópia CERTA. A sig ganha '@N' só pra N > 1,
 * mantendo iguais as sigs de projetos sem cópias.
 *
 * Só CAMINHO LEGADO: dica com when.expected devolve null aqui - os erros dela
 * vêm do alinhamento (alignmentInfo), nunca daqui.
 */
export function mistakeInfo (hint, detailed) {
    const when = hint && hint.when;
    if (!when || when.type !== 'character_missing_block_type' || hasExpected(hint)) {
        return null;
    }
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const candidates = candidatesFor(scenes, when);
    if (candidates.some(function (c) {
        return isBlockHintDoneFor(c.character, when);
    })) {
        return null;
    }
    for (let i = 0; i < candidates.length; i++) {
        const info = mistakeInfoFor(hint, candidates[i].character);
        if (info) {
            if (candidates[i].occurrence > 1) {
                info.sig += '@' + candidates[i].occurrence;
            }
            if (when.characterOccurrence || candidates.length > 1) {
                info.characterOccurrence = candidates[i].occurrence;
            }
            return info;
        }
    }
    return null;
}

/** mistakeInfo de UMA cópia do personagem (o miolo antigo de mistakeInfo). */
function mistakeInfoFor (hint, character) {
    const when = hint.when;
    const match = blockMatch(character, when);
    if (match.typesOk && !match.argsOk) {
        const wantedArgs = when.blockArgs || {};
        const wrong = Object.keys(wantedArgs).filter(function (bt) {
            return !(match.values[bt] || []).includes(wantedArgs[bt]);
        });
        // O valor que o aluno tem AGORA já é o pedido, mas é o padrão do
        // bloco recém-arrastado, ainda não confirmado: não é erro de
        // valor, é "toque no número pra confirmar".
        if (wrong.every(function (bt) {
            return (match.pendings[bt] || []).includes(wantedArgs[bt]);
        })) {
            return {kind: 'confirm', sig: hint.id + '|confirm|' + wrong.join(',')};
        }
        // Bloco recém-arrastado e AINDA não editado (só valor pendente, sem
        // nenhum valor real do aluno naquele tipo): o aluno está no meio do
        // caminho, não errou - não interrompe. Só alerta valor que ele
        // JÁ escolheu e está errado.
        const chosenWrong = wrong.filter(function (bt) {
            return (match.values[bt] || []).length > 0;
        });
        if (!chosenWrong.length) {
            // Nenhum valor escolhido ainda naqueles blocos (zerados/velocidade
            // "nenhuma" de missão): não é erro, mas se o aluno largar assim,
            // lembra de escolher o valor - depois de FILL_IDLE_MS parado, pra
            // não interromper quem está prestes a digitar. Uma vez por
            // conjunto de blocos ainda sem valor (wrongValueAlerted).
            return {
                kind: 'fill',
                idleMs: FILL_IDLE_MS,
                sig: hint.id + '|fill|' + wrong.map(function (bt) {
                    return bt + ':' + (match.pendings[bt] || []).length;
                }).join(';'),
            };
        }
        return {
            kind: 'value',
            sig: hint.id + '|value|' + chosenWrong.map(function (bt) {
                return bt + '=' + (match.values[bt] || []).join(',');
            }).join(';'),
        };
    }
    if (match.wrongTrigger) {
        const wantedTypes = Array.isArray(when.blockTypes) ? when.blockTypes : [];
        const where = (character.scripts || []).filter(function (script) {
            return script.blocks.some(function (b) {
                return wantedTypes.includes(b.type);
            });
        }).map(function (script) {
            // triggerArg na sig: mover o bloco de "receber azul" pra
            // "receber verde" (ainda errado) é um erro NOVO, avisa de novo.
            return script.trigger + (script.triggerArg ? ':' + script.triggerArg : '');
        });
        return {kind: 'trigger', sig: hint.id + '|trigger|' + where.join(',')};
    }
    return null;
}

/**
 * Detecta trabalho FORA DE ORDEM: uma dica de bloco posterior (doneHint)
 * que o aluno já cumpriu de verdade enquanto uma anterior do MESMO
 * personagem/cena (pendingHint) ainda não foi cumprida - independe de a
 * pendente já ter sido fechada (dismissedHintIds, ver AssignmentBadge.js).
 * Só olha dicas character_missing_block_type e exige que o personagem
 * exista e que tipos+valores da posterior batam (senão "personagem ainda
 * nem existe" contaria como "cumprida"). Retorna
 * {kind:'order', sig, doneHint, pendingHint, characterOccurrence} ou null.
 *
 * Cópias repetidas (falha F9): "mesmo personagem" inclui a MESMA cópia
 * (when.characterOccurrence) - dicas da 1ª e da 2ª Ruby são atores
 * diferentes, uma não está "fora de ordem" em relação à outra. Dicas sem
 * characterOccurrence formam o seu próprio grupo (legado / personagem sem
 * cópias) e são cumpridas em QUALQUER cópia (ver candidatesFor).
 * characterOccurrence no retorno é a cópia onde a dica posterior foi
 * montada - é ali que _highlightMistake pisca (mesma regra de mistakeInfo:
 * só presente com when.characterOccurrence ou 2+ cópias no aluno).
 *
 * Fase 3: só dicas LEGADAS (sem when.expected) entram - numa missão mista,
 * uma dica com expected nem é a "posterior cumprida" nem a "anterior
 * pendente" daqui (a ordem dela é conferida posição a posição pelo
 * alinhamento, ver alignmentInfo kind 'order'). Sem isso, uma dica com
 * expected ainda pendente seria acusada de "pulada" por uma legada cumprida -
 * dois mecanismos falando da mesma ordem.
 */
export function orderInfo (hints, detailed) {
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const blockHints = hints.filter(function (hint) {
        return hint && hint.when && hint.when.type === 'character_missing_block_type' && !hasExpected(hint);
    });
    const sameActor = function (a, b) {
        return a.when.characterMd5 === b.when.characterMd5 && a.when.sceneMd5 === b.when.sceneMd5 &&
            (a.when.sceneOccurrence || 1) === (b.when.sceneOccurrence || 1) &&
            (a.when.characterOccurrence || 0) === (b.when.characterOccurrence || 0);
    };
    // Cópia (1-based) onde a dica está cumprida, ou 0 se em nenhuma.
    const doneIn = function (hint) {
        const done = candidatesFor(scenes, hint.when).find(function (c) {
            return isBlockHintDoneFor(c.character, hint.when);
        });
        return done ? done.occurrence : 0;
    };
    const isDone = function (hint) {
        return doneIn(hint) > 0;
    };
    for (let j = 1; j < blockHints.length; j++) {
        const later = blockHints[j];
        const laterOccurrence = doneIn(later);
        if (!laterOccurrence) {
            continue;
        }
        const pending = blockHints.slice(0, j).find(function (earlier) {
            return sameActor(earlier, later) && !isDone(earlier) &&
                hintConditionHolds(earlier, detailed);
        });
        if (pending) {
            const order = {kind: 'order', sig: pending.id + '|order|' + later.id, doneHint: later, pendingHint: pending};
            if (later.when.characterOccurrence || candidatesFor(scenes, later.when).length > 1) {
                order.characterOccurrence = laterOccurrence;
            }
            return order;
        }
    }
    return null;
}

/**
 * Alerta de UMA dica com when.expected, a partir do resultado do alinhamento
 * dela (expectedResultsFor(...).get(hint.id)), ou null (nada a alertar: done,
 * ou pendente "de verdade" - falta fazer, vale a dica proativa).
 *
 * Formato do info (source 'expected' distingue do caminho legado - mesmos
 * nomes de kind onde o significado é o mesmo, pra telemetria 'wrong_' + kind
 * continuar valendo):
 *   {source: 'expected',
 *    kind: 'value'   (wrong_value: bloco certo, número errado - evento wrong_value)
 *        | 'order'   (wrong_order: bloco fora do lugar / dentro-fora do repeat - wrong_order)
 *        | 'extra'   (extra_block: bloco a mais no script - evento NOVO wrong_extra)
 *        | 'confirm' (pending 'unconfirmed' com o valor pedido - wrong_confirm)
 *        | 'fill',   (pending 'unset', ou 'unconfirmed' com outro valor - wrong_fill)
 *    sig, state, reason?, blockType, teacherIndex?,
 *    position: {scriptIndex, path},   // bloco do ALUNO no momento da decisão
 *    characterOccurrence,             // cópia do aluno avaliada (sempre presente)
 *    expected?, got?, extraCount?, idleMs? (só 'fill')}
 *
 * Herança dos estados pendente/zerado do caminho legado (R3): 'unconfirmed'
 * (bloco recém-arrastado, padrão não tocado) com got === expected ≈ antigo
 * kind 'confirm' ("toque no número para confirmar"); com outro valor, ou
 * 'unset' (numérico sem valor / velocidade "nenhuma"), ≈ antigo 'fill'
 * (mesmo FILL_IDLE_MS). Professor sem valor exigido (expected null) +
 * unconfirmed = 'confirm' (qualquer número serve, só falta tocar). say com
 * texto padrão (unset) NÃO alerta - o legado também não (o say padrão nem
 * entrava no manifesto): é "ainda não fez", vale a proativa. O alinhamento
 * nunca transforma pending/unset em wrong_value, então bloco recém-arrastado
 * nunca vira "valor errado".
 *
 * sig = id da dica + 'align' + kind + posição (scriptIndex:path) + tipo +
 * valor do aluno (got; extraCount pra 'extra') + '@N' da cópia (N > 1).
 * Estável: a mesma situação gera a mesma sig (não repete o alerta); trocar o
 * valor errado por OUTRO valor errado, ou o bloco de lugar, gera sig nova.
 */
export function alignmentInfo (hint, result) {
    if (!hint || !result || !result.position || !Array.isArray(result.position.path)) {
        return null;
    }
    let kind = null;
    if (result.state === 'wrong_value') {
        kind = 'value';
    } else if (result.state === 'wrong_order') {
        kind = 'order';
    } else if (result.state === 'extra_block') {
        kind = 'extra';
    } else if (result.state === 'pending' && result.reason === 'unconfirmed') {
        kind = (result.expected === null || result.expected === undefined || result.got === result.expected) ? 'confirm' : 'fill';
    } else if (result.state === 'pending' && result.reason === 'unset' && result.blockType !== 'say') {
        kind = 'fill';
    }
    if (!kind) {
        return null;
    }
    const occurrence = result.characterOccurrence;
    const where = result.position.scriptIndex + ':' + result.position.path.join('.');
    const detail = kind === 'extra' ? result.extraCount : result.got;
    const info = {
        source: 'expected',
        kind: kind,
        sig: [hint.id, 'align', kind, where, result.blockType, detail === undefined ? '' : detail].join('|') +
            (occurrence > 1 ? '@' + occurrence : ''),
        state: result.state,
        blockType: result.blockType,
        position: {scriptIndex: result.position.scriptIndex, path: result.position.path.slice()},
        characterOccurrence: occurrence,
    };
    ['reason', 'teacherIndex', 'expected', 'got', 'extraCount'].forEach(function (key) {
        if (result[key] !== undefined) {
            info[key] = result[key];
        }
    });
    if (kind === 'fill') {
        info.idleMs = FILL_IDLE_MS;
    }
    return info;
}

/** Mesmo ator (cena+ocorrência, personagem, cópia) - cópia ausente casa com qualquer uma. */
function sameActorLoose (a, b) {
    return a.sceneMd5 === b.sceneMd5 && (a.sceneOccurrence || 1) === (b.sceneOccurrence || 1) &&
        a.characterMd5 === b.characterMd5 &&
        (!a.characterOccurrence || !b.characterOccurrence || a.characterOccurrence === b.characterOccurrence);
}

/**
 * Missão MISTA (R3, "o mesmo bloco não gera alerta pelos dois caminhos"): a
 * dica LEGADA `hint` está "à sombra" de uma dica com expected quando alguma
 * dica com expected do MESMO personagem (cópia ausente em qualquer lado =
 * mesma) ensina (covered) um bloco de um tipo de hint.when.blockTypes, no
 * mesmo gatilho (se a legada tem when.trigger). Nesse caso os erros daquele
 * bloco já são apontados, com posição exata, pelo alinhamento - mistakeInfo
 * da legada (que só sabe "existe um bloco desse tipo com valor errado em
 * algum lugar") é ignorado em decideHintAction, senão o aluno levaria dois
 * alertas (sigs diferentes) pelo MESMO bloco. Conservador de propósito: na
 * dúvida, cala o legado (o alinhamento é o mais preciso dos dois). A
 * hintConditionHolds da legada NÃO muda (pendente/resolvida continua igual).
 */
export function legacyShadowedByExpected (hint, hints) {
    const when = hint && hint.when;
    if (!when || when.type !== 'character_missing_block_type' || hasExpected(hint)) {
        return false;
    }
    const types = Array.isArray(when.blockTypes) ? when.blockTypes : [];
    return (Array.isArray(hints) ? hints : []).some(function (other) {
        if (!hasExpected(other) || !sameActorLoose(when, other.when)) {
            return false;
        }
        const expected = other.when.expected;
        if (when.trigger && when.trigger !== expected.trigger) {
            return false;
        }
        const covered = Array.isArray(expected.covered) ? expected.covered : [];
        return covered.some(function (c) {
            const token = expected.script[c];
            return !!token && types.includes(token.type);
        });
    });
}

/**
 * R8 - alvo FRESCO de um alerta do alinhamento, recalculado na hora de piscar
 * (o aluno pode ter mexido no projeto com o modal aberto): reavalia as dicas
 * contra o `detailed` do projeto ATUAL e devolve {position, characterOccurrence}
 * da MESMA dica se ela continua no mesmo kind de alerta (a posição pode ter
 * mudado - o bloco certo é o de agora); null se o estado mudou/sumiu (aí não
 * pisca nada - o bloco que o alerta descrevia não existe mais). Puro.
 */
export function freshAlignmentTarget (hints, hint, info, detailed) {
    if (!hint || !info || info.source !== 'expected' || !hasExpected(hint)) {
        return null;
    }
    const fresh = alignmentInfo(hint, expectedResultsFor(hints, detailed).get(hint.id));
    if (!fresh || fresh.kind !== info.kind) {
        return null;
    }
    return {position: fresh.position, characterOccurrence: fresh.characterOccurrence};
}

/**
 * Carets que Project.js#encodeStrip PULA ao salvar (caretrepeat não: vira
 * 'repeat' e ocupa posição).
 */
const ENCODE_SKIPPED_TYPES = ['caretcmd', 'caretend', 'caretstart'];

/** N-ésimo bloco (0-based) de uma cadeia `next`, contando como encodeStrip conta. */
function nthEncodedBlock (first, n) {
    let block = first;
    let index = 0;
    for (let guard = 0; block && guard < 10000; guard++) {
        if (!ENCODE_SKIPPED_TYPES.includes(block.blocktype)) {
            if (index === n) {
                return block;
            }
            index++;
        }
        block = block.next;
    }
    return null;
}

/**
 * R8 - bloco VIVO do editor numa posição do alinhamento ({scriptIndex, path},
 * ver shared/detailedManifest.mjs#tokenizeScript). Puro (duck typing sobre
 * os Block do editor: blocktype, next, inside), testável sem DOM.
 *
 * Correspondência (conferida em Sprite.js#getData e Project.js#encodeStrip):
 *  - sprite.scripts[k] do projeto salvo = encodeStrip(topBlocks[k]), onde
 *    topBlocks = Scripts#getEncodableBlocks() da área de scripts do sprite
 *    (TODO bloco com prev null, na ordem do DOM - inclusive um caret solto,
 *    que vira um script vazio []; por isso scriptIndex conta vazios). Então
 *    position.scriptIndex indexa topBlocks direto;
 *  - dentro de um script, a tupla salva é a cadeia `next` a partir do bloco
 *    de topo, PULANDO caretcmd/caretend/caretstart (caretrepeat vira repeat e
 *    conta). path[0] é o índice nessa cadeia (o gatilho é 0);
 *  - path [i, j, ...]: j é o índice, contado do mesmo jeito, na cadeia
 *    `inside` do repeat em i (encodeStrip(b.inside) grava a tupla aninhada).
 * Só vale se topBlocks é lido no MESMO instante do projectJson que gerou a
 * posição (_highlightMistake faz os dois na hora, em sequência). null se o
 * caminho não existe (projeto mudou entre um e outro).
 */
export function resolveLiveBlock (topBlocks, position) {
    if (!position || !Array.isArray(position.path) || !position.path.length || !Array.isArray(topBlocks)) {
        return null;
    }
    let chain = topBlocks[position.scriptIndex] || null;
    let found = null;
    for (let level = 0; level < position.path.length; level++) {
        found = nthEncodedBlock(chain, position.path[level]);
        if (!found) {
            return null;
        }
        chain = found.inside || null;
    }
    return found;
}

/** Valor como a criança lê no bloco: setspeed em palavra, o resto só o número (sem unidade). */
function spokenValue (blockType, value) {
    if (blockType === 'setspeed' && SPEED_WORDS[value] !== undefined) {
        return SPEED_WORDS[value];
    }
    return String(value);
}

// Prefixos do caminho LEGADO (moravam em AssignmentBadge.js#_evaluateHints).
const LEGACY_ALERT_PREFIX = {
    trigger: 'Quase! O bloco está no lugar errado - confira qual bloco de início vem antes dele. ',
    order: 'Opa, esse bloco vem depois! Primeiro faça: ',
    confirm: 'Quase! Toque no número do bloco para confirmar o valor. ',
    fill: 'Falta escolher o valor do bloco - toque nele para definir. ',
    value: 'Quase! O valor do bloco ainda não está certo. ',
};

/**
 * Texto do modal de alerta (AssignmentBadge.js só exibe). Caminho legado:
 * prefixo do kind + texto da dica dita (spokenHint) - igual ao de antes.
 * Alinhamento (info.source 'expected'):
 *  - 'value': "Ops! Acho que o número do bloco de X era N" - N = o valor do
 *    PROFESSOR, sem unidade nenhuma (wait é décimo de segundo e o giro é
 *    1/12 de volta - a criança só vê o número no bloco); setspeed fala a
 *    velocidade ("Ops! Acho que o bloco de velocidade era normal");
 *  - 'extra': "Ops! Acho que tem um bloco de X a mais";
 *  - 'order': "Opa, esse bloco está fora do lugar! " + texto da dica cujo
 *    bloco está fora do lugar (a própria dica - ela diz onde ele vai);
 *  - 'confirm'/'fill': mesmos textos do legado.
 */
export function alertText (info, spokenHint) {
    const hintText = (spokenHint && spokenHint.text) || '';
    if (info && info.source === 'expected') {
        if (info.kind === 'value') {
            if (info.blockType === 'setspeed') {
                return 'Ops! Acho que o bloco de velocidade era ' + spokenValue('setspeed', info.expected);
            }
            return 'Ops! Acho que o número do bloco de ' + blockLabel(info.blockType) + ' era ' +
                spokenValue(info.blockType, info.expected);
        }
        if (info.kind === 'extra') {
            return 'Ops! Acho que tem um bloco de ' + blockLabel(info.blockType) + ' a mais';
        }
        if (info.kind === 'order') {
            return 'Opa, esse bloco está fora do lugar! ' + hintText;
        }
    }
    const kind = info && info.kind;
    return (LEGACY_ALERT_PREFIX[kind] || LEGACY_ALERT_PREFIX.value) + hintText;
}

// Esperas de ociosidade do caminho AUTOMÁTICO (poll) - moradas aqui (Fase 1,
// R4) junto de decideHintAction, que é quem as compara com idleMs. O
// AssignmentBadge.js não precisa mais delas: só passa PollScheduler.idleFor().
//
// IDLE_BEFORE_HINT_MS: aluno precisa ficar esse tempo sem clicar/arrastar/
// digitar em lugar NENHUM da página antes da próxima dica poder aparecer
// sozinha - achado em teste real ("cadência desordenada"): um tempo fixo
// desde o fechamento da dica anterior (mecanismo antigo) não tinha relação
// com o que o aluno estava fazendo, podendo interromper ele no meio de uma
// ação. Ver PollScheduler.idleFor()/PollScheduler.js. Só vale pro caminho
// automático (poll) - o painel de dicas (_openHintsPanel) ignora, de
// propósito: é exatamente pra isso que ele existe.
export const IDLE_BEFORE_HINT_MS = 3000;
// ALERT_IDLE_MS: o alerta "Quase!" (valor/gatilho errado) vem logo depois da
// AÇÃO do aluno (soltar o bloco) - é quando a dica mais vale, então não
// espera os 3s de IDLE_BEFORE_HINT_MS (esses são só pra dica proativa, que
// INTERROMPE o aluno). Um info com idleMs próprio (kind 'fill', ver
// FILL_IDLE_MS) sobrepõe este valor.
export const ALERT_IDLE_MS = 1000;

// Tipos cuja condição é SEMPRE verdadeira (hintConditionHolds devolve true
// sem olhar o projeto) - só "resolvem" quando o aluno fecha. Ver
// nextProactiveHint.
const ALWAYS_PENDING_WHEN_TYPES = ['mission_intro', MANUAL_WHEN_TYPE];

/**
 * Dica PROATIVA (a que aparece sozinha depois da ociosidade) pronta agora,
 * ou null. `dismissed` é o Set de ids já mostrados+fechados nesta sessão de
 * aba (dismissedHintIds em AssignmentBadge.js).
 *
 * Só a dica MAIS ANTIGA (na ordem que o professor cadastrou) cujo requisito
 * ainda não foi cumprido pode aparecer sozinha - mesmo que a condição de uma
 * dica POSTERIOR já esteja batendo agora. Achado em teste real: fechar a
 * dica 1 (sem o aluno ter feito a tarefa dela) deixava ela em
 * dismissedHintIds, e o .find() de antes pulava direto pra dica 2 assim que
 * a espera de ociosidade batesse - as dicas apareciam em sequência sem o
 * aluno nunca ter cumprido a primeira. Agora, se a primeira pendente já foi
 * dispensada, nenhuma dica aparece sozinha até ela ser resolvida de verdade
 * (o botão flutuante de dica continua dando acesso a todas via
 * _openHintsPanel, que ignora esta trava de propósito). Essa regra vale só
 * pras dicas de TAREFA e é deliberada - não "conserte" pulando a tarefa
 * dispensada.
 *
 * Exceção (Fase 1, falha P1): dicas SEMPRE-VERDADEIRAS (when.type
 * 'mission_intro' e 'manual' - ver hintConditionHolds) nunca deixam de
 * "estar pendentes", porque não há nada no projeto que as resolva. Então,
 * uma vez dispensadas, a trava acima as tratava como "primeira pendente
 * dispensada" PRA SEMPRE - e como a intro é sempre hints[0], nenhuma dica
 * proativa aparecia mais depois de fechar a intro. Telemetria de produção:
 * de 93 pares aluno/missão, 88 fecharam a intro e só 2 receberam qualquer
 * dica proativa depois. Agora intro/manual JÁ DISPENSADAS são puladas (pra
 * elas, "dispensada" é o único jeito de ficarem resolvidas); NÃO
 * dispensadas continuam aparecendo normalmente na sua vez.
 *
 * `expectedResults` (opcional, Fase 3): o Map de expectedResultsFor do ciclo;
 * ausente, é calculado (com cache) a partir de `hints`.
 */
export function nextProactiveHint (hints, detailed, dismissed, expectedResults) {
    const results = expectedResults || expectedResultsFor(hints, detailed);
    const firstPending = (hints || []).find(function (hint) {
        return hint && hintConditionHolds(hint, detailed, results) &&
            !(ALWAYS_PENDING_WHEN_TYPES.includes(hint.when.type) && dismissed.has(hint.id));
    });
    return (firstPending && !dismissed.has(firstPending.id)) ? firstPending : null;
}

/**
 * Decisão COMPLETA de um ciclo de _evaluateHints (AssignmentBadge.js), sem
 * efeito nenhum: o chamador só executa o que vier descrito aqui (DOM,
 * recordHintEvent, _showCoachModal, ...). Puro - recebe todo o estado como
 * argumento (os Sets não são modificados).
 *
 * Entrada (um objeto):
 *  - hints: assignment.hints (na ordem do professor);
 *  - detailed: computeDetailedManifest(projectJson) do projeto ATUAL;
 *  - dismissed: Set de ids de dica já mostrada+fechada (dismissedHintIds);
 *  - alerted: Set de assinaturas de alerta já dado (wrongValueAlerted);
 *  - idleMs: há quanto tempo o aluno está parado (PollScheduler.idleFor());
 *  - modalOpen: há um modal automático aberto agora (coachModalEl);
 *  - panelOpen: o painel navegável de dicas está aberto (hintsPanelEl).
 * A missão já completa NÃO entra aqui - o chamador trata antes (apaga o
 * pontinho e sai, sem nem calcular o manifesto).
 *
 * Saída: {buttonDot, action}
 *  - buttonDot: true/false = estado do pontinho do botão flutuante
 *    (_updateHintButton) - "há dica proativa pronta", mesmo que ela não
 *    possa ser MOSTRADA agora (ociosidade/modal); null = não mexe no ponto
 *    (missão sem dicas - o código antigo saía antes de chamar
 *    _updateHintButton).
 *  - action: null (não mostra nada neste ciclo) ou
 *    {kind: 'hint', hint}: mostrar a dica proativa `hint`;
 *    {kind: 'alert', hint, info, spokenHint}: alerta de erro. `info` é o
 *      retorno de mistakeInfo (info.kind 'value'/'trigger'/'confirm'/
 *      'fill') ou de orderInfo (info.kind 'order'); `hint` é a dica cujo
 *      bloco o aluno montou (vai pra _highlightMistake); `spokenHint` é a
 *      dica cujo TEXTO é dito e cujo id vai nos eventos/dismissed - a
 *      própria `hint`, exceto em 'order', onde é a PENDENTE que o aluno
 *      pulou (info.pendingHint). Ao fechar, o chamador marca info.sig em
 *      `alerted` e spokenHint.id em `dismissed`.
 *
 * Prioridade (igual ao código antigo): alerta de valor/gatilho/confirmação/
 * preenchimento (primeira dica, na ordem, com mistakeInfo de sig ainda não
 * avisada) > alerta de fora de ordem (orderInfo) > dica proativa. Nada é
 * mostrado com modal ou painel abertos. Alerta espera info.idleMs ||
 * ALERT_IDLE_MS de ociosidade; dica proativa espera IDLE_BEFORE_HINT_MS. Se
 * existe um alerta pendente mas a ociosidade dele ainda não bateu, NADA é
 * mostrado neste ciclo - a dica proativa não "passa na frente" do alerta.
 *
 * Fase 3 (missão com when.expected, possivelmente mista): o alinhamento roda
 * UMA vez por ciclo (expectedResultsFor). A varredura de alertas continua na
 * ORDEM das dicas: dica com expected -> alignmentInfo (info.source
 * 'expected', kinds value/order/extra/confirm/fill - ver lá); dica legada ->
 * mistakeInfo, exceto se legacyShadowedByExpected (o bloco dela já é
 * conferido pelo alinhamento). Depois, orderInfo (só entre legadas). Num
 * alerta 'order' do alinhamento o texto dito é o da PRÓPRIA dica (a do bloco
 * fora do lugar); só o 'order' legado fala a dica pendente pulada.
 */
export function decideHintAction (opts) {
    const hints = Array.isArray(opts.hints) ? opts.hints : [];
    if (!hints.length) {
        return {buttonDot: null, action: null};
    }
    const detailed = opts.detailed;
    const alerted = opts.alerted;
    const idleMs = opts.idleMs;
    const expectedResults = expectedResultsFor(hints, detailed);
    const readyHint = nextProactiveHint(hints, detailed, opts.dismissed, expectedResults);
    const buttonDot = !!readyHint;

    // Alerta de VALOR ERRADO - canal separado da dica proativa (readyHint):
    // a dica proativa aparece uma vez e, fechada, nunca volta (dismissed);
    // mas o aluno pode montar o bloco DEPOIS de fechá-la, com o valor errado
    // - e ninguém avisava (achado em teste real, aluno Josué/missão
    // "Cofrinho": grow 5 em vez de 2, silêncio). Independe de dismissed;
    // cada combinação de valores errados avisa uma única vez (alerted) -
    // mudar pra OUTRO valor errado avisa de novo, ficar parado no mesmo não
    // repete.
    let alertHint = null;
    let alertInfo = null;
    hints.some(function (hint) {
        let info = null;
        if (hasExpected(hint)) {
            info = alignmentInfo(hint, expectedResults.get(hint.id));
        } else if (!legacyShadowedByExpected(hint, hints)) {
            info = mistakeInfo(hint, detailed);
        }
        if (info && !alerted.has(info.sig)) {
            alertHint = hint;
            alertInfo = info;
            return true;
        }
        return false;
    });

    // Alerta de FORA DE ORDEM (só se não há erro de valor/gatilho a
    // apontar): o aluno montou o bloco de uma dica POSTERIOR enquanto uma
    // anterior do mesmo personagem ainda está pendente (achado em teste
    // real: clique + say montados antes da bandeira + say que a dica pedia
    // primeiro - nada avisava, a dica da bandeira já tinha sido fechada).
    if (!alertHint) {
        const order = orderInfo(hints, detailed);
        if (order && !alerted.has(order.sig)) {
            alertHint = order.doneHint;
            alertInfo = order;
        }
    }

    if ((!readyHint && !alertHint) || opts.modalOpen || opts.panelOpen) {
        // Painel aberto: o aluno já está olhando as dicas por conta própria
        // - não faz sentido interromper com o modal automático por cima.
        return {buttonDot, action: null};
    }
    if (alertHint) {
        if (idleMs < (alertInfo.idleMs || ALERT_IDLE_MS)) {
            // Acabou de soltar/arrastar algo - espera só um instante, não os
            // 3s da dica proativa.
            return {buttonDot, action: null};
        }
        // Em "fora de ordem" o texto dito (e o evento gravado) é o da dica
        // PENDENTE que o aluno pulou, não o da que ele já montou.
        const spokenHint = alertInfo.kind === 'order' && alertInfo.source !== 'expected' ? alertInfo.pendingHint : alertHint;
        return {buttonDot, action: {kind: 'alert', hint: alertHint, info: alertInfo, spokenHint}};
    }
    if (idleMs < IDLE_BEFORE_HINT_MS) {
        // Pronta, mas o aluno ainda está mexendo em algo - espera ele parar.
        return {buttonDot, action: null};
    }
    return {buttonDot, action: {kind: 'hint', hint: readyHint}};
}

/**
 * Rótulo "🧑 Nome" mostrado acima do texto da dica no painel navegável -
 * pedido explícito do usuário depois de um teste real: o texto da dica
 * às vezes só usa pronome ("faça ELE dizer...", regra de tom do
 * SYSTEM_PROMPT do backend permite isso depois da primeira menção ao
 * personagem numa SEQUÊNCIA de dicas, mas ao navegar solto pelo painel -
 * Anterior/Próxima, ou abrindo direto numa dica no meio - essa primeira
 * menção pode nunca ter sido lida) e a criança ficava sem saber de quem
 * a dica estava falando. Deriva o nome do characterMd5+sceneMd5+
 * sceneOccurrence do próprio `when` da dica, contra o projeto ATUAL do
 * aluno (mesmo detailed manifest já calculado por _openHintsPanel) -
 * nunca do projeto de referência do professor, que o aluno nunca vê.
 * Retorna null (painel esconde a linha) pra dicas sem personagem
 * (scene_missing/message_not_received/mission_intro/manual) ou quando o
 * personagem ainda nem existe no projeto do aluno (nada pra nomear
 * ainda) ou não tem nome salvo.
 *
 * Cópias repetidas (falha F9): com when.characterOccurrence e mais de uma
 * cópia do personagem na cena do aluno, o rótulo usa o nome DAQUELA cópia e
 * ganha a ordem dela ("🧑 Ruby (2º)") - o editor dá o MESMO nome às cópias
 * (Page.js#addSprite usa o nome do asset), então só o nome não diria qual
 * delas a dica quer. Sem characterOccurrence (legado), igual a antes: nome
 * da 1ª cópia, sem número.
 */
export function actorLabelFor (hint, detailed) {
    const when = hint && hint.when;
    if (!when || !when.characterMd5 || !when.sceneMd5) {
        return null;
    }
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence, when.characterOccurrence);
    if (!found.character || !found.character.characterName) {
        return null;
    }
    const ordinal = when.characterOccurrence && found.characters.length > 1 ? ' (' + when.characterOccurrence + 'º)' : '';
    return '🧑 ' + found.character.characterName + ordinal;
}
