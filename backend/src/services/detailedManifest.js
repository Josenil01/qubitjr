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
            };
            let hasScript = false;

            for (const script of scripts) {
                if (!Array.isArray(script) || script.length === 0) continue; // empty script: no code
                hasScript = true;
                walkScriptForDetail(script, agg);
            }

            characters.push({
                characterMd5: sprite.md5 || null,
                hasScript,
                blockTypes: Array.from(agg.blockTypes),
                messagesSent: Array.from(agg.messagesSent),
                messagesReceived: Array.from(agg.messagesReceived),
            });
        }

        scenes.push({
            sceneMd5: page.md5 || null,
            characters,
        });
    }

    return { scenes };
}

module.exports = { computeDetailedManifest };
