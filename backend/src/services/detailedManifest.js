'use strict';

/**
 * detailedManifest.js
 *
 * Companion to assignmentScoring.js, but for a very different purpose:
 * assignmentScoring.js's computeProjectManifest() collapses a project down
 * to AGGREGATE counts (how many scenes, how many characters, how many of
 * each block type) because that's all compareManifests() needs to score a
 * student's project against a teacher's requirements. That collapse throws
 * away exactly the information a coaching-hint generator needs: WHICH scene,
 * WHICH character, in WHICH order the teacher built things.
 *
 * computeDetailedManifest() below walks the SAME project JSON shape (see
 * assignmentScoring.js's header docblock for the exact shape:
 * `{pages: [...], [pageId]: {sprites: [...], md5, [spriteId]: {type, md5,
 * scripts: [...]}}}`) but preserves per-scene, per-character detail, IN
 * ARRAY ORDER. The order pages appear in projectJson.pages, and sprites in
 * page.sprites, reflects the order the teacher created them in the editor -
 * that order is deliberate and meaningful for hint generation (it IS the
 * "natural build sequence" hintsGeneration.js turns into a transcript), so
 * nothing here sorts or reorders it.
 *
 * Unlike assignmentScoring.js's "qualifying sprite/scene" filter (which only
 * credits a scene/character once it has a real script, to avoid over-crediting
 * decorative unused assets), EVERY scene and EVERY character sprite is
 * included here, scripted or not - a character with no script yet is exactly
 * the kind of thing a coaching hint needs to describe ("sem script ainda").
 *
 * This module is 100% pure (no I/O, no Supabase), same as assignmentScoring.js.
 */

/**
 * Editor UI artifacts, never real student/teacher-placed blocks. Excluded
 * from blockTypes entirely, mirroring assignmentScoring.js's CARET_TYPES.
 */
const CARET_TYPES = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);

/**
 * Recursively walks one script (array of block tuples), mirroring
 * assignmentScoring.js#walkScript's traversal exactly (same CARET_TYPES
 * exclusion, same "nested strip lives at block[4]" recursion for `repeat`),
 * but collecting per-sprite detail instead of aggregate byType counts:
 * every block-type string seen (agg.blockTypes), and the message names
 * carried by `message` (sent) and `onmessage` (received) blocks - the
 * `onmessage` trigger tuple is block[0] of a top-level script, which is just
 * the first element walked here, same as any other block.
 *
 * agg.blockSequence (achado em teste real - dicas às vezes saíam fora de
 * ordem) é o script inteiro, na ORDEM REAL em que os blocos aparecem, SEM
 * deduplicar - ao contrário de blockTypes (Set, colapsa repetições e perde a
 * posição relativa entre elas), isto é o que permite a LLM ver a sequência
 * exata de ações que o professor executou (ex.: "onflag → say[\"Oi\"] →
 * forward → say[\"Tchau\"]"), em vez de só "quais tipos de bloco existem em
 * algum lugar". say/message/onmessage entram já formatados com o argumento
 * real, mesmo texto que sayTexts/messagesSent/messagesReceived carregam
 * separadamente (blockTypes/messagesSent/messagesReceived/sayTexts
 * continuam existindo do jeito que estão - usados pela VALIDAÇÃO de hints e
 * pela avaliação de condição no cliente; blockSequence é só pra
 * apresentação/transcrição, nunca usado numa comparação de igualdade).
 */
function walkScriptForDetail(script, agg) {
    if (!Array.isArray(script)) return;

    for (const block of script) {
        if (!Array.isArray(block) || block.length === 0) continue;

        const blockType = block[0];
        if (CARET_TYPES.has(blockType)) continue; // editor artifact, ignore entirely

        agg.blockTypes.add(blockType);

        // 'message'/'onmessage' estão em Project.js#encodeStrip's hasargs,
        // então SEMPRE carregam um arg codificado - mas quando o aluno ainda
        // não escolheu uma mensagem no dropdown, esse arg vem como a STRING
        // literal 'null' (o sentinela que encodeStrip grava pra "sem
        // argumento real"), não a ausência de valor. Sem esse filtro, um
        // bloco message/onmessage ainda não configurado seria contado como
        // enviando/recebendo uma mensagem chamada "null" de verdade.
        const arg = block[1];
        const hasRealArg = arg !== null && arg !== undefined && arg !== 'null' && arg !== '';
        if (blockType === 'message' && hasRealArg) {
            agg.messagesSent.add(arg);
        }
        if (blockType === 'onmessage' && hasRealArg) {
            agg.messagesReceived.add(arg);
        }
        // Conteúdo literal de todo bloco `say` (o que o personagem realmente
        // fala) - sem isto, a LLM só sabia "existe um bloco say em algum
        // lugar", nunca O QUE ele diz, e tinha que inventar um texto genérico
        // pra dica em vez de sugerir a fala real do exemplo do professor.
        // Não deduplica (Array, não Set) - se o personagem fala a mesma
        // coisa duas vezes isso é informação real sobre o script, não ruído.
        if (blockType === 'say' && hasRealArg) {
            agg.sayTexts.push(arg);
        }

        // Ver docblock acima - token já pronto pra exibição, na ORDEM real
        // do script (nunca deduplicado).
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
            walkScriptForDetail(nested, agg);
        }
    }
}

/**
 * Takes the PARSED project JSON object (already JSON.parse()'d by the
 * caller) and returns the detailed, order-preserving manifest described in
 * the module header. Never throws - malformed/missing input yields
 * `{ scenes: [] }`, mirroring computeProjectManifest()'s defensive style.
 */
function computeDetailedManifest(projectJson) {
    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) {
        return { scenes: [] };
    }

    const scenes = [];
    // sceneMd5 -> quantas cenas com esse MESMO fundo já foram vistas até agora
    // (inclusive a atual) - um projeto que reusa um fundo (ex.: volta pro
    // "Bosque" na cena 3 depois de já tê-lo usado na cena 1) precisa de algo
    // além de sceneMd5 pra distinguir as duas ocorrências num `when` de dica
    // (ver sceneOccurrence abaixo e services/hintsGeneration.js). Só conta
    // cenas com md5 real - sceneOccurrence fica null junto com sceneMd5 null.
    const sceneOccurrenceBySceneMd5 = new Map();

    for (const pageId of projectJson.pages) {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') continue; // tolerate a ghost page id, like assignmentScoring.js

        const spriteIds = Array.isArray(page.sprites) ? page.sprites : [];
        const characters = [];

        for (const spriteId of spriteIds) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object') continue; // tolerate a ghost sprite id

            if (sprite.type !== 'sprite') continue; // never text boxes, same rule as assignmentScoring.js

            const scripts = Array.isArray(sprite.scripts) ? sprite.scripts : [];
            const agg = {
                blockTypes: new Set(),
                messagesSent: new Set(),
                messagesReceived: new Set(),
                sayTexts: [],
                blockSequence: [],
            };
            let hasScript = false;

            for (const script of scripts) {
                if (!Array.isArray(script) || script.length === 0) continue; // empty script: no code
                hasScript = true;
                walkScriptForDetail(script, agg);
            }

            characters.push({
                characterMd5: sprite.md5 || null,
                // Nome dado pelo professor (ex. "Ruby"), NÃO o md5 do asset -
                // sprite.name é a mesma propriedade que Sprite.js#getSpriteData()
                // grava. Só usado pra deixar o texto das dicas mais natural
                // ("a Ruby precisa..." em vez de "o personagem precisa...") -
                // nunca entra na validação/no `when` (que continua por md5,
                // estável independente de nome/idioma). null se o sprite não
                // tiver nome definido.
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
            // 1 na primeira cena a usar este fundo, 2 na segunda vez que o
            // MESMO fundo aparece em outra cena, etc. - ver o Map acima.
            sceneOccurrence,
            characters,
        });
    }

    return { scenes };
}

module.exports = { computeDetailedManifest };
