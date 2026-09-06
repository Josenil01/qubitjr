/**
 * src/app/src/editor/ui/assignmentScoring.js
 *
 * Cópia client-side, em ES module, de backend/src/services/assignmentScoring.js
 * (que é CommonJS - `require`/`module.exports` - e vive num pacote Node
 * separado, não importável pelo bundle do Vite). É usada por
 * AssignmentBadge.js pra calcular o checklist da missão EM TEMPO REAL, direto
 * do estado atual do projeto na memória do navegador (Project.getProject()),
 * sem esperar autosave + round-trip ao servidor (ver comentário no topo de
 * AssignmentBadge.js).
 *
 * A lógica em si (computeProjectManifest/compareManifests) é idêntica -
 * qualquer mudança de regra de pontuação feita num lado TEM que ser replicada
 * no outro, ou o checklist ao vivo do aluno diverge do que
 * GET /api/public/students/:id/assignment-score (consultado pela HelloYotta)
 * calcula a partir do projeto salvo. Ver o arquivo original pro racional
 * completo de cada regra - aqui só o código, sem repetir os comentários.
 */

const TRIGGER_TYPES = new Set(['onflag', 'onmessage', 'onclick', 'ontouch']);
const CARET_TYPES = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);
const DATA_REPRESENTATION_TYPES = new Set(['grow', 'shrink', 'setspeed', 'say']);
const SYNC_TIER2_TYPES = new Set(['message', 'stopmine']);
// Ver docblock do original (backend) - "say" é o único bloco cujo argumento
// pode divergir do professor; todo tipo aqui exige o valor exato (byTypeValue).
const NUMERIC_ARG_TYPES = new Set([
    'forward', 'back', 'up', 'down', 'left', 'right', 'hop',
    'wait', 'repeat', 'grow', 'shrink', 'setspeed',
]);

function emptyManifest () {
    return {
        scenes: {count: 0, used: []},
        characters: {count: 0, used: []},
        blocks: {count: 0, byType: {}, byTypeValue: {}},
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

function walkScript (script, agg) {
    if (!Array.isArray(script)) return;

    for (const block of script) {
        if (!Array.isArray(block) || block.length === 0) continue;

        const blockType = block[0];
        if (CARET_TYPES.has(blockType)) continue;

        agg.blocks.count += 1;
        agg.blocks.byType[blockType] = (agg.blocks.byType[blockType] || 0) + 1;

        // Ver docblock do original (backend) - hasRealArg como pré-condição
        // (Number(null) === 0 em JS contaria um bloco sem argumento como valor 0).
        if (NUMERIC_ARG_TYPES.has(blockType)) {
            const arg = block[1];
            const hasRealArg = arg !== null && arg !== undefined && arg !== 'null' && arg !== '';
            const numArg = hasRealArg ? Number(arg) : NaN;
            if (!Number.isNaN(numArg)) {
                const byValue = agg.blocks.byTypeValue[blockType] || {};
                byValue[numArg] = (byValue[numArg] || 0) + 1;
                agg.blocks.byTypeValue[blockType] = byValue;
            }
        }

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

export function computeProjectManifest (projectJson) {
    const manifest = emptyManifest();

    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) {
        return manifest;
    }

    const characterMd5Set = new Set();

    let onmessageTriggerCount = 0;
    let onclickOrTouchTriggerCount = 0;
    let onflagTriggerCount = 0;
    let hasInteractiveTrigger = false;
    let hasOnflagTrigger = false;
    let hasNonTriggerContent = false;
    let hasLoop = false;
    let hasSyncTier2 = false;
    let hasWait = false;
    let hasDataRepresentation = false;
    let totalScriptCount = 0;

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
                if (!Array.isArray(script) || script.length === 0) continue;

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

    if (onmessageTriggerCount >= 2) manifest.ctScores.parallelism = 3;
    else if (onclickOrTouchTriggerCount >= 2) manifest.ctScores.parallelism = 2;
    else if (onflagTriggerCount >= 2) manifest.ctScores.parallelism = 1;
    else manifest.ctScores.parallelism = 0;

    if (hasLoop) manifest.ctScores.flowControl = 2;
    else if (hasNonTriggerContent) manifest.ctScores.flowControl = 1;
    else manifest.ctScores.flowControl = 0;

    if (hasSyncTier2) manifest.ctScores.synchronization = 2;
    else if (hasWait) manifest.ctScores.synchronization = 1;
    else manifest.ctScores.synchronization = 0;

    if (hasInteractiveTrigger) manifest.ctScores.userInteractivity = 2;
    else if (hasOnflagTrigger) manifest.ctScores.userInteractivity = 1;
    else manifest.ctScores.userInteractivity = 0;

    manifest.ctScores.abstraction = manifest.characters.count > 1 && totalScriptCount > 1 ? 1 : 0;
    manifest.ctScores.dataRepresentation = hasDataRepresentation ? 1 : 0;

    return manifest;
}

export function compareManifests (required, actual) {
    const req = required && typeof required === 'object' ? required : emptyManifest();
    const act = actual && typeof actual === 'object' ? actual : emptyManifest();

    const reqScenes = req.scenes || {count: 0, used: []};
    const actScenes = act.scenes || {count: 0, used: []};
    const scenesMet =
        actScenes.count >= reqScenes.count &&
        (reqScenes.used || []).every((md5) => (actScenes.used || []).includes(md5));

    const reqCharacters = req.characters || {count: 0, used: []};
    const actCharacters = act.characters || {count: 0, used: []};
    const charactersMet =
        actCharacters.count >= reqCharacters.count &&
        (reqCharacters.used || []).every((md5) => (actCharacters.used || []).includes(md5));

    const reqBlocks = req.blocks || {count: 0, byType: {}};
    const actBlocks = act.blocks || {count: 0, byType: {}};
    const reqByType = reqBlocks.byType || {};
    const actByType = actBlocks.byType || {};
    const reqByTypeValue = reqBlocks.byTypeValue || {};
    const actByTypeValue = actBlocks.byTypeValue || {};

    const byType = {};
    let blocksMet = true;
    for (const type of Object.keys(reqByType)) {
        const requiredCount = reqByType[type];
        const actualCount = actByType[type] || 0;
        let met = actualCount >= requiredCount;

        // Ver docblock do original (backend) - requirements antigos sem
        // byTypeValue pra este tipo pulam a checagem extra (reqByValue
        // undefined), preservando o comportamento anterior até reautorar.
        const reqByValue = reqByTypeValue[type];
        if (reqByValue) {
            const actByValue = actByTypeValue[type] || {};
            for (const value of Object.keys(reqByValue)) {
                if ((actByValue[value] || 0) < reqByValue[value]) {
                    met = false;
                    break;
                }
            }
        }

        byType[type] = {required: requiredCount, actual: actualCount, met};
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
        scenes: {required: reqScenes.count, actual: actScenes.count, met: scenesMet},
        characters: {required: reqCharacters.count, actual: actCharacters.count, met: charactersMet},
        blocks: {
            required: reqBlocks.count || 0,
            actual: actBlocks.count || 0,
            met: blocksMet,
            byType,
        },
        ctScores,
        // Ver o docblock do arquivo original (backend/src/services/assignmentScoring.js) -
        // mesmo campo, mesma regra, tem que ficar em sincronia.
        completed: scenesMet && charactersMet && blocksMet,
    };
}
