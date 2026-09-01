/**
 * src/app/src/editor/ui/detailedManifest.js
 *
 * Cópia client-side, em ES module, de backend/src/services/detailedManifest.js
 * (que vive num pacote Node separado, não importável pelo bundle do Vite) -
 * mesma relação que assignmentScoring.js já tem com seu original em
 * backend/src/services/assignmentScoring.js (ver o docblock daquele arquivo).
 *
 * Ao contrário de assignmentScoring.js (que produz um manifesto AGREGADO -
 * contagens de cenas/personagens/blocos usados, pra comparar com um
 * requisito), este arquivo produz um manifesto DETALHADO - cena por cena,
 * personagem por personagem, preservando a ordem de criação exatamente como
 * aparece em projectJson.pages/page.sprites. É consumido por
 * AssignmentBadge.js pra avaliar "dicas" (assignment.hints) que apontam pra
 * uma cena/personagem/bloco/mensagem específica ainda faltando no projeto do
 * aluno - pra isso, precisa saber não só "quantas cenas têm script" (como
 * assignmentScoring.js) mas "esta cena/personagem específica existe? tem
 * script? usa este tipo de bloco? manda/recebe esta mensagem?".
 *
 * Por isso este manifesto NÃO filtra cenas/personagens "não qualificados"
 * (sem script) como assignmentScoring.js faz para currentemente ao decidir
 * o que conta como "usado" - aqui toda página vira uma cena e todo sprite do
 * tipo 'sprite' vira um personagem, mesmo sem nenhum script ainda (é
 * exatamente esse caso, "personagem existe mas sem script", que os hints
 * character_no_script e character_missing_block_type precisam distinguir de
 * "personagem nem existe no projeto ainda").
 *
 * Qualquer mudança de regra aqui TEM que ser replicada no lado do backend
 * (backend/src/services/detailedManifest.js), ou a lista de dicas ao vivo
 * do aluno diverge do que o servidor entende - mesma obrigação de
 * sincronia documentada em assignmentScoring.js.
 */

/**
 * Editor UI artifacts, never real student-placed blocks. Mesmo conjunto de
 * assignmentScoring.js - devem ficar de fora de blockTypes por completo.
 */
const CARET_TYPES = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);

function emptyManifest () {
    return {scenes: []};
}

/**
 * Recursively walks one script (array of block tuples - script[0] é a
 * trigger tuple, ex.: ['onmessage', msgName, dx, dy], os demais são blocos
 * de comando na ordem em que aparecem), recolhendo em `agg`:
 *  - blockTypes: todo block[0] que não seja um marcador de caret/UI;
 *  - messagesSent: block[1] de todo bloco `message` (envio);
 *  - messagesReceived: block[1] de todo trigger `onmessage` (recebimento).
 * Recursa no strip aninhado de um `repeat` (block[4]) - mesmo walk de
 * assignmentScoring.js#walkScript, mesma razão (é o único bloco cuja
 * tupla carrega um array aninhado nesse índice).
 *
 * agg.blockSequence: ver docblock do original (backend) - o script inteiro,
 * na ordem real, sem deduplicar (ao contrário de blockTypes) - só pra
 * apresentação na transcrição da LLM, nunca usado em comparação/validação.
 */
function walkScript (script, agg) {
    if (!Array.isArray(script)) return;

    for (const block of script) {
        if (!Array.isArray(block) || block.length === 0) continue;

        const blockType = block[0];
        if (CARET_TYPES.has(blockType)) continue; // editor artifact, ignore entirely

        agg.blockTypes.add(blockType);

        const arg = block[1];
        const hasRealArg = arg !== null && arg !== undefined && arg !== 'null' && arg !== '';
        if (blockType === 'message' && hasRealArg) {
            agg.messagesSent.add(arg);
        } else if (blockType === 'onmessage' && hasRealArg) {
            agg.messagesReceived.add(arg);
        }
        // Ver docblock do original (backend) - conteúdo literal de todo
        // bloco `say`, sem deduplicar.
        if (blockType === 'say' && hasRealArg) {
            agg.sayTexts.push(arg);
        }

        // Ver docblock do original (backend) - token já pronto pra exibição,
        // na ORDEM real do script (nunca deduplicado, ao contrário de blockTypes).
        if (blockType === 'message' && hasRealArg) {
            agg.blockSequence.push(`message["${arg}"]`);
        } else if (blockType === 'onmessage' && hasRealArg) {
            agg.blockSequence.push(`onmessage["${arg}"]`);
        } else if (blockType === 'say' && hasRealArg) {
            agg.blockSequence.push(`say["${arg}"]`);
        } else {
            agg.blockSequence.push(blockType);
        }

        const nested = block[4];
        if (Array.isArray(nested)) {
            walkScript(nested, agg);
        }
    }
}

/**
 * Takes the PARSED project JSON object (already JSON.parse()'d by the
 * caller) and returns the detailed, order-preserving manifest described in
 * the module header. Never throws - malformed/missing input yields
 * {scenes: []}.
 */
export function computeDetailedManifest (projectJson) {
    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) {
        return emptyManifest();
    }

    const scenes = [];
    // Ver docblock do original em backend/src/services/detailedManifest.js -
    // conta ocorrências do MESMO fundo (sceneMd5) pra distinguir cenas
    // repetidas (ex.: volta pro "Bosque" depois de já tê-lo usado antes).
    const sceneOccurrenceBySceneMd5 = new Map();

    for (const pageId of projectJson.pages) {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') continue;

        const spriteIds = Array.isArray(page.sprites) ? page.sprites : [];
        const characters = [];

        for (const spriteId of spriteIds) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object') continue;
            if (sprite.type !== 'sprite') continue; // só personagens reais, nunca caixas de texto

            const scripts = Array.isArray(sprite.scripts) ? sprite.scripts : [];

            let hasScript = false;
            const agg = {
                blockTypes: new Set(),
                messagesSent: new Set(),
                messagesReceived: new Set(),
                sayTexts: [],
                blockSequence: [],
            };

            for (const script of scripts) {
                if (!Array.isArray(script) || script.length === 0) continue; // empty script: no code
                hasScript = true;
                walkScript(script, agg);
            }

            characters.push({
                characterMd5: sprite.md5 || null,
                // Ver docblock do original em backend/src/services/detailedManifest.js -
                // nome dado pelo professor, só pro texto das dicas, nunca pro `when`.
                characterName: sprite.name || null,
                hasScript,
                blockTypes: Array.from(agg.blockTypes),
                messagesSent: Array.from(agg.messagesSent),
                messagesReceived: Array.from(agg.messagesReceived),
                sayTexts: agg.sayTexts,
                blockSequence: agg.blockSequence,
            });
        }

        const sceneMd5 = page.md5 || null;
        let sceneOccurrence = null;
        if (sceneMd5) {
            sceneOccurrence = (sceneOccurrenceBySceneMd5.get(sceneMd5) || 0) + 1;
            sceneOccurrenceBySceneMd5.set(sceneMd5, sceneOccurrence);
        }

        scenes.push({
            sceneMd5,
            sceneOccurrence,
            characters,
        });
    }

    return {scenes};
}
