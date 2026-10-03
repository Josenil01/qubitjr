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
 */
export function findSceneAndCharacter (scenes, sceneMd5, characterMd5, sceneOccurrence) {
    const matches = scenes.filter(function (s) {
        return s.sceneMd5 === sceneMd5;
    });
    const scene = matches[(sceneOccurrence || 1) - 1] || null;
    if (!scene) {
        return {scene: null, character: null};
    }
    const character = scene.characters.find(function (c) {
        return c.characterMd5 === characterMd5;
    }) || null;
    return {scene, character};
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
 * Dica sem esses campos (salva antes deles existirem) se comporta como
 * sempre: qualquer script, pelo menos 1 de cada tipo.
 * Retorna {typesOk, argsOk, values, wrongTrigger}: wrongTrigger = os
 * blocos existem (contando todos os scripts) mas não no gatilho pedido.
 */
export function blockMatch (character, when) {
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
        return script.trigger === when.trigger;
    }) : allScripts;
    const result = evaluate(scoped);
    // wrongTrigger só quando o professor usa esse bloco APENAS naquele
    // gatilho (when.triggerExclusive) - senão um bloco fora dele pode ser
    // o de outra dica, não um erro (ver fillBlockContext).
    result.wrongTrigger = !!when.trigger && when.triggerExclusive === true &&
        !result.typesOk && evaluate(allScripts).typesOk;
    return result;
}

/**
 * Regras de cada when.type - ver o docblock do Part 2 desta feature
 * (mesma nomenclatura/contrato que AssignmentAuthorBar.js usa pra
 * rotular as dicas na tela do professor). Nunca lança - when.type
 * desconhecido/malformado simplesmente não bate (retorna false).
 */
export function hintConditionHolds (hint, detailed) {
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
        const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        // Cena em si nem existindo ainda não conta como "personagem
        // faltando" - esse caso é coberto por um hint scene_missing
        // separado (ver comentário no topo do arquivo/spec).
        return !!found.scene && !found.character;
    }

    case 'character_no_script': {
        const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        return !!found.character && !found.character.hasScript;
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
        const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
        if (!found.character) {
            return false; // personagem nem existe ainda - character_missing cobre esse caso
        }
        // Tipos (com contagem/gatilho - ver blockMatch) e valores
        // exigidos: ainda precisa enquanto algum não bater. Valor:
        // achado em teste real (3), decisão explícita do usuário - "say"
        // é o ÚNICO bloco cujo argumento pode divergir do professor
        // (por isso nunca aparece em blockArgs), todos os outros exigem
        // o valor exato.
        const match = blockMatch(found.character, when);
        return !match.typesOk || !match.argsOk;
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
 */
export function mistakeInfo (hint, detailed) {
    const when = hint && hint.when;
    if (!when || when.type !== 'character_missing_block_type') {
        return null;
    }
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
    if (!found.character) {
        return null;
    }
    const match = blockMatch(found.character, when);
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
        const where = (found.character.scripts || []).filter(function (script) {
            return script.blocks.some(function (b) {
                return wantedTypes.includes(b.type);
            });
        }).map(function (script) {
            return script.trigger || 'solto';
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
 * {kind:'order', sig, doneHint, pendingHint} ou null.
 */
export function orderInfo (hints, detailed) {
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const blockHints = hints.filter(function (hint) {
        return hint && hint.when && hint.when.type === 'character_missing_block_type';
    });
    const sameActor = function (a, b) {
        return a.when.characterMd5 === b.when.characterMd5 && a.when.sceneMd5 === b.when.sceneMd5 &&
            (a.when.sceneOccurrence || 1) === (b.when.sceneOccurrence || 1);
    };
    const isDone = function (hint) {
        const found = findSceneAndCharacter(scenes, hint.when.sceneMd5, hint.when.characterMd5, hint.when.sceneOccurrence);
        if (!found.character) {
            return false;
        }
        const match = blockMatch(found.character, hint.when);
        return match.typesOk && match.argsOk;
    };
    for (let j = 1; j < blockHints.length; j++) {
        const later = blockHints[j];
        if (!isDone(later)) {
            continue;
        }
        const pending = blockHints.slice(0, j).find(function (earlier) {
            return sameActor(earlier, later) && !isDone(earlier) &&
                hintConditionHolds(earlier, detailed);
        });
        if (pending) {
            return {kind: 'order', sig: pending.id + '|order|' + later.id, doneHint: later, pendingHint: pending};
        }
    }
    return null;
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
 */
export function actorLabelFor (hint, detailed) {
    const when = hint && hint.when;
    if (!when || !when.characterMd5 || !when.sceneMd5) {
        return null;
    }
    const scenes = (detailed && Array.isArray(detailed.scenes)) ? detailed.scenes : [];
    const found = findSceneAndCharacter(scenes, when.sceneMd5, when.characterMd5, when.sceneOccurrence);
    if (!found.character || !found.character.characterName) {
        return null;
    }
    return '🧑 ' + found.character.characterName;
}
