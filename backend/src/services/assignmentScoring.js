'use strict';

/**
 * assignmentScoring.js
 *
 * Extracts a "requirements manifest" from a ScratchJr project's saved JSON
 * (scenes/characters/block-types used, plus lightweight computational-thinking
 * scores), and compares a student's manifest against a teacher's required one.
 *
 * The manifest shape is intentionally simple JSON so it can be stored as-is
 * (e.g. alongside a "missão"/assignment row) and re-diffed later without
 * re-parsing the original project files.
 *
 * Why "qualifying sprite/scene" filters exist:
 * ScratchJr projects routinely contain decorative sprites (background props,
 * unused character variants dragged onto the stage and never wired up) that
 * carry no code. Counting every sprite/page as "used" would over-credit a
 * project for assets present but not exercised. This mirrors the standard
 * static-analysis practice (as in Dr. Scratch / Moreno-León & Robles, "Dr.
 * Scratch: Automatic Analysis of Scratch Projects") of only crediting an
 * asset once it participates in actual behavior (has a non-empty script),
 * not merely because it exists in the project file.
 *
 * CT (computational thinking) scores below are adapted from the Dr. Scratch
 * rubric, but restricted to what ScratchJr's real block set supports: there
 * are no conditionals, variables, lists, custom blocks, or clones in
 * ScratchJr, so several Dr. Scratch dimensions/tiers (logic, data operators,
 * abstraction via custom blocks, etc.) simply don't apply here and are
 * either dropped or reinterpreted against the closest ScratchJr equivalent
 * (see each score's inline comment below for the exact rule used).
 */

/** Blocks that start a script (always tuple index 0 of a top-level script). */
const TRIGGER_TYPES = new Set(['onflag', 'onmessage', 'onclick', 'ontouch']);

/**
 * Editor UI artifacts, never real student-placed blocks. Must be excluded
 * entirely from every count (not counted, not present in byType).
 */
const CARET_TYPES = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);

/** Blocks whose presence signals "data representation" (see ctScores below). */
const DATA_REPRESENTATION_TYPES = new Set(['grow', 'shrink', 'setspeed', 'say']);

/** Blocks whose presence signals "synchronization" tier 2 (see ctScores below). */
const SYNC_TIER2_TYPES = new Set(['message', 'stopmine']);

function emptyManifest() {
    return {
        scenes: { count: 0, used: [] },
        characters: { count: 0, used: [] },
        blocks: { count: 0, byType: {} },
        ctScores: {
            parallelism: 0,
            flowControl: 0,
            synchronization: 0,
            userInteractivity: 0,
            abstraction: 0,
            dataRepresentation: 0,
        },
    };
}

/**
 * Recursively walks one script (array of block tuples), tallying real block
 * instances into `agg` and flagging the CT-relevant features it contains.
 * Recurses into a `repeat` block's nested strip (tuple index 4), which is
 * the only block in this codebase's encoding that carries a nested array.
 * `forever` has no nested strip (it's a terminal marker block), so there is
 * nothing to recurse into for it - it is still tallied as a normal block.
 */
function walkScript(script, agg) {
    if (!Array.isArray(script)) return;

    for (const block of script) {
        if (!Array.isArray(block) || block.length === 0) continue;

        const blockType = block[0];
        if (CARET_TYPES.has(blockType)) continue; // editor artifact, ignore entirely

        agg.blocks.count += 1;
        agg.blocks.byType[blockType] = (agg.blocks.byType[blockType] || 0) + 1;

        if (blockType === 'repeat' || blockType === 'forever') agg.hasLoop = true;
        if (SYNC_TIER2_TYPES.has(blockType)) agg.hasSyncTier2 = true;
        if (blockType === 'wait') agg.hasWait = true;
        if (DATA_REPRESENTATION_TYPES.has(blockType)) agg.hasDataRepresentation = true;

        const nested = block[4];
        if (Array.isArray(nested)) {
            walkScript(nested, agg);
        }
    }
}

/**
 * Takes the PARSED project JSON object (already JSON.parse()'d by the
 * caller) and returns the requirements manifest described in the module
 * header. Never throws - malformed/missing input yields a zeroed-out
 * manifest of the same shape.
 */
function computeProjectManifest(projectJson) {
    const manifest = emptyManifest();

    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) {
        return manifest;
    }

    const characterMd5Set = new Set();

    // Cross-project tallies feeding the ctScores rules below.
    let onmessageTriggerCount = 0;
    let onclickOrTouchTriggerCount = 0;
    let onflagTriggerCount = 0;
    let hasInteractiveTrigger = false; // any top-level script starts onclick/ontouch
    let hasOnflagTrigger = false; // any top-level script starts onflag
    let hasNonTriggerContent = false; // any script has real content beyond just its trigger
    let hasLoop = false; // any script contains repeat/forever, anywhere
    let hasSyncTier2 = false; // any script contains message/stopmine, anywhere
    let hasWait = false; // any script contains wait, anywhere
    let hasDataRepresentation = false; // any script contains grow/shrink/setspeed/say, anywhere
    let totalScriptCount = 0; // non-empty scripts across the whole project

    for (const pageId of projectJson.pages) {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') continue;

        const spriteIds = Array.isArray(page.sprites) ? page.sprites : [];
        let pageQualifies = false;

        for (const spriteId of spriteIds) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object') continue;

            const scripts = Array.isArray(sprite.scripts) ? sprite.scripts : [];
            const isCharacter = sprite.type === 'sprite';

            let spriteHasRealScript = false;

            for (const script of scripts) {
                if (!Array.isArray(script) || script.length === 0) continue; // empty script: no code

                spriteHasRealScript = true;
                totalScriptCount += 1;

                const triggerTuple = script[0];
                const triggerType = Array.isArray(triggerTuple) ? triggerTuple[0] : undefined;

                if (triggerType === 'onmessage') onmessageTriggerCount += 1;
                else if (triggerType === 'onclick' || triggerType === 'ontouch') onclickOrTouchTriggerCount += 1;
                else if (triggerType === 'onflag') onflagTriggerCount += 1;

                if (triggerType === 'onclick' || triggerType === 'ontouch') hasInteractiveTrigger = true;
                if (triggerType === 'onflag') hasOnflagTrigger = true;
                if (script.length > 1) hasNonTriggerContent = true;

                const agg = {
                    blocks: manifest.blocks,
                    hasLoop: false,
                    hasSyncTier2: false,
                    hasWait: false,
                    hasDataRepresentation: false,
                };
                walkScript(script, agg);
                if (agg.hasLoop) hasLoop = true;
                if (agg.hasSyncTier2) hasSyncTier2 = true;
                if (agg.hasWait) hasWait = true;
                if (agg.hasDataRepresentation) hasDataRepresentation = true;
            }

            if (isCharacter && spriteHasRealScript) {
                manifest.characters.count += 1;
                if (sprite.md5) characterMd5Set.add(sprite.md5);
                pageQualifies = true;
            }
        }

        if (pageQualifies) {
            manifest.scenes.count += 1;
            if (page.md5) manifest.scenes.used.push(page.md5);
        }
    }

    manifest.characters.used = Array.from(characterMd5Set);

    // parallelism (0-3): most-parallel trigger style wins, by count of scripts using it.
    if (onmessageTriggerCount >= 2) manifest.ctScores.parallelism = 3;
    else if (onclickOrTouchTriggerCount >= 2) manifest.ctScores.parallelism = 2;
    else if (onflagTriggerCount >= 2) manifest.ctScores.parallelism = 1;
    else manifest.ctScores.parallelism = 0;

    // flowControl (0-2): a loop beats mere sequencing beats nothing but a trigger.
    if (hasLoop) manifest.ctScores.flowControl = 2;
    else if (hasNonTriggerContent) manifest.ctScores.flowControl = 1;
    else manifest.ctScores.flowControl = 0;

    // synchronization (0-2): message-passing/stop beats a plain wait beats nothing.
    if (hasSyncTier2) manifest.ctScores.synchronization = 2;
    else if (hasWait) manifest.ctScores.synchronization = 1;
    else manifest.ctScores.synchronization = 0;

    // userInteractivity (0-2): touch/click trigger beats flag-only beats nothing.
    if (hasInteractiveTrigger) manifest.ctScores.userInteractivity = 2;
    else if (hasOnflagTrigger) manifest.ctScores.userInteractivity = 1;
    else manifest.ctScores.userInteractivity = 0;

    // abstraction (0-1): more than one working character AND more than one script
    // total is the closest ScratchJr proxy for "decomposed into reusable parts"
    // (ScratchJr has no custom blocks to decompose into).
    manifest.ctScores.abstraction = manifest.characters.count > 1 && totalScriptCount > 1 ? 1 : 0;

    // dataRepresentation (0-1): any block that mutates/displays sprite state.
    manifest.ctScores.dataRepresentation = hasDataRepresentation ? 1 : 0;

    return manifest;
}

/**
 * Compares a required manifest (from the teacher's example project) against
 * an actual manifest (from a student's project), both in the
 * computeProjectManifest() shape, and returns a per-dimension met/unmet
 * breakdown.
 */
function compareManifests(required, actual) {
    const req = required && typeof required === 'object' ? required : emptyManifest();
    const act = actual && typeof actual === 'object' ? actual : emptyManifest();

    const reqScenes = req.scenes || { count: 0, used: [] };
    const actScenes = act.scenes || { count: 0, used: [] };
    const scenesMet =
        actScenes.count >= reqScenes.count &&
        (reqScenes.used || []).every((md5) => (actScenes.used || []).includes(md5));

    const reqCharacters = req.characters || { count: 0, used: [] };
    const actCharacters = act.characters || { count: 0, used: [] };
    const charactersMet =
        actCharacters.count >= reqCharacters.count &&
        (reqCharacters.used || []).every((md5) => (actCharacters.used || []).includes(md5));

    const reqBlocks = req.blocks || { count: 0, byType: {} };
    const actBlocks = act.blocks || { count: 0, byType: {} };
    const reqByType = reqBlocks.byType || {};
    const actByType = actBlocks.byType || {};

    const byType = {};
    let blocksMet = true;
    for (const type of Object.keys(reqByType)) {
        const requiredCount = reqByType[type];
        const actualCount = actByType[type] || 0;
        const met = actualCount >= requiredCount;
        byType[type] = { required: requiredCount, actual: actualCount, met };
        if (!met) blocksMet = false;
    }

    const ctScores = {};
    const reqCt = req.ctScores || {};
    const actCt = act.ctScores || {};
    const dimensions = [
        'parallelism',
        'flowControl',
        'synchronization',
        'userInteractivity',
        'abstraction',
        'dataRepresentation',
    ];
    for (const dimension of dimensions) {
        const requiredValue = reqCt[dimension] || 0;
        const actualValue = actCt[dimension] || 0;
        ctScores[dimension] = {
            required: requiredValue,
            actual: actualValue,
            met: actualValue >= requiredValue,
        };
    }

    return {
        scenes: { required: reqScenes.count, actual: actScenes.count, met: scenesMet },
        characters: { required: reqCharacters.count, actual: actCharacters.count, met: charactersMet },
        blocks: {
            required: reqBlocks.count || 0,
            actual: actBlocks.count || 0,
            met: blocksMet,
            byType,
        },
        ctScores,
        // Atalho pra quem consome a resposta (HelloYotta via assignment-score,
        // AssignmentBadge.js pro modal de conclusão) não precisar reimplementar
        // "os 3 grupos bateram" - ctScores fica de fora de propósito (são notas
        // de qualidade, não requisitos de conclusão da missão em si).
        completed: scenesMet && charactersMet && blocksMet,
    };
}

module.exports = { computeProjectManifest, compareManifests };
