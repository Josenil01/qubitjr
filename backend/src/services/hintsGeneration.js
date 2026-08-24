'use strict';

/**
 * hintsGeneration.js
 *
 * Phase 1 (text-only) of LLM-generated, progress-gated coaching hints:
 * given a teacher's completed "missão" (reference project), asks an LLM to
 * read the project's structure (scenes -> characters -> scripts, in build
 * order) and turn it into a short list of warm, encouraging coaching hints
 * ("Que tal você colocar o cenário X?"), one at a time, that the student-side
 * UI shows as they build their own copy. A later phase adds a visual
 * position-guide on top of this; out of scope here.
 *
 * generateHints(projectJson) does, in order:
 *   1. computeDetailedManifest(projectJson) - see detailedManifest.js.
 *   2. Turn that into a human/LLM-readable transcript string, in build order.
 *   3. Ask DeepSeek (OpenAI-compatible `openai` SDK, baseURL pointed at
 *      DeepSeek) for STRICT JSON: `{ hints: [{ text, when }, ...] }`.
 *   4. Parse the response (defensively stripping markdown fences).
 *   5. VALIDATE every hint against the actual manifest - this is the safety
 *      net against a hallucinated/malformed reference from the LLM. Never
 *      trust model output blindly: any hint whose `when` references a scene,
 *      character, or message that doesn't really exist in this project is
 *      dropped (logged via console.warn), never surfaced to the teacher.
 *   6. Assign surviving hints sequential ids (h1, h2, ...) in final order.
 *
 * Scenes/characters with a null md5 (nothing stable to reference them by -
 * see detailedManifest.js) are skipped entirely from the transcript, and any
 * hint referencing one is therefore rejected by the validation step too,
 * since it can never appear in the "real identifiers" sets built from the
 * manifest.
 */

const OpenAI = require('openai');
const { computeDetailedManifest } = require('./detailedManifest');

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

/** The only `when.type` values a hint is allowed to carry - anything else is dropped. */
const VALID_WHEN_TYPES = new Set([
    'scene_missing',
    'character_missing',
    'character_no_script',
    'character_missing_block_type',
    'message_not_received',
]);

const MAX_HINTS = 8;

const SYSTEM_PROMPT = `Você é um coach amigável para crianças de 6 a 8 anos que estão aprendendo a programar no ScratchJr.

Você vai receber uma transcrição de um projeto de referência já completo, feito pelo professor, descrito cena por cena e personagem por personagem, NA ORDEM em que foram construídos. Sua tarefa é identificar os passos de construção mais importantes desse projeto e transformá-los em dicas curtas de coaching para uma criança que está construindo a própria versão desse projeto.

Regras de tom:
- Seja sempre caloroso e encorajador, nunca repreenda e nunca diga "errado" ou "faltou".
- Frases devem soar como uma sugestão gentil, por exemplo "Que tal..." ou "Depois de..., que tal...".
- As dicas devem estar em português do Brasil (pt-BR).

Regras de formato - responda APENAS com um JSON estrito, sem crases/markdown, sem nenhum texto fora do JSON, exatamente neste formato:

{"hints": [{"text": "...", "when": {"type": "...", ...campos...}}, ...]}

O campo "when.type" deve ser exatamente um destes valores, com exatamente estes campos (usando SOMENTE identificadores que aparecem literalmente na transcrição recebida - nunca invente um nome que não esteja lá):
- "scene_missing": {"type":"scene_missing","sceneMd5":"<da transcrição>"}
- "character_missing": {"type":"character_missing","sceneMd5":"...","characterMd5":"..."}
- "character_no_script": {"type":"character_no_script","sceneMd5":"...","characterMd5":"..."}
- "character_missing_block_type": {"type":"character_missing_block_type","sceneMd5":"...","characterMd5":"...","blockTypes":["forward","hop", ...]} - blockTypes é a lista de tipos de bloco de movimento/ação que, juntos, satisfariam essa dica (ex.: todos os blocos de movimento do ScratchJr juntos se a dica for sobre "andar": forward,back,up,down,left,right,hop; ou um único tipo, como ["say"], se a dica for sobre "falar")
- "message_not_received": {"type":"message_not_received","messageName":"..."}

Gere aproximadamente uma dica por passo de construção realmente relevante, no máximo 8 dicas no total mesmo para projetos grandes - priorize os passos mais pedagogicamente úteis se houver mais que isso. Ordene o array "hints" seguindo a mesma ordem da transcrição (a ordem natural de construção).`;

/**
 * Renders one character's blockTypes/messagesSent/messagesReceived as a
 * single human-readable "blocos: ..." fragment, e.g. "ontouch, message[\"gol\"]".
 * message/onmessage are rendered with their argument in brackets (so the LLM
 * sees the actual message name, not just the bare block type); every other
 * block type is listed plainly.
 */
function formatBlocksFragment(character) {
    const parts = [];
    for (const blockType of character.blockTypes) {
        if (blockType === 'message' || blockType === 'onmessage') continue; // rendered below, with their arg
        parts.push(blockType);
    }
    for (const name of character.messagesSent) parts.push(`message["${name}"]`);
    for (const name of character.messagesReceived) parts.push(`onmessage["${name}"]`);
    return parts.join(', ');
}

/**
 * Builds the transcript string fed to the LLM, in build order. Scenes with
 * `sceneMd5: null` and characters with `characterMd5: null` are skipped
 * entirely - there's nothing stable to reference them by in a `when` clause,
 * so describing them would only invite a hint the validation step would
 * have to reject anyway. Returns '' when there is nothing describable at
 * all (e.g. an empty project, or one where nothing has a real asset md5
 * yet), so the caller can skip the LLM call entirely.
 */
function buildTranscript(manifest) {
    const lines = [];
    let sceneNumber = 0;

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;

        const describableCharacters = scene.characters.filter((c) => c.characterMd5);
        if (describableCharacters.length === 0) continue; // nothing referenceable to say about this scene either

        sceneNumber += 1;
        lines.push(`Cena ${sceneNumber} (fundo: ${scene.sceneMd5}):`);

        for (const character of describableCharacters) {
            if (!character.hasScript) {
                lines.push(`  - Personagem ${character.characterMd5}: sem script ainda`);
                continue;
            }
            const blocksFragment = formatBlocksFragment(character);
            lines.push(`  - Personagem ${character.characterMd5}: tem script (blocos: ${blocksFragment})`);
        }
    }

    return lines.join('\n');
}

/**
 * Strips a ```json ... ``` or ``` ... ``` fence wrapping the LLM response,
 * defensively - the system prompt asks for strict JSON with no fences, but
 * models don't always comply.
 */
function stripCodeFences(text) {
    if (typeof text !== 'string') return text;
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Lazily builds the DeepSeek client. Throws a clearly-typed error
 * (err.code = 'NOT_CONFIGURED') when DEEPSEEK_API_KEY isn't set, mirroring
 * how getSupabase() in routes/db.js and routes/assignments.js handles
 * missing config (there it returns null and the route answers 503; here the
 * caller/route does the same on this error code - see routes/assignments.js).
 */
function getClient() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        const err = new Error('DEEPSEEK_API_KEY não configurada - geração de dicas indisponível.');
        err.code = 'NOT_CONFIGURED';
        throw err;
    }
    return new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
}

/**
 * Builds the lookup sets used to validate hints against the REAL manifest:
 * every real sceneMd5, every real characterMd5 (scoped per scene, since a
 * `when` clause always names both together for character-scoped hint
 * types), and the project-wide union of every sent message name.
 */
function buildValidationIndex(manifest) {
    const sceneMd5Set = new Set();
    const charactersByScene = new Map(); // sceneMd5 -> Set<characterMd5>
    const allMessagesSent = new Set();

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;
        sceneMd5Set.add(scene.sceneMd5);

        const charSet = charactersByScene.get(scene.sceneMd5) || new Set();
        for (const character of scene.characters) {
            if (character.characterMd5) charSet.add(character.characterMd5);
            for (const name of character.messagesSent) allMessagesSent.add(name);
        }
        charactersByScene.set(scene.sceneMd5, charSet);
    }

    return { sceneMd5Set, charactersByScene, allMessagesSent };
}

/**
 * Validates one raw hint object from the LLM against the real manifest.
 * Returns true only if every identifier it references verifiably exists.
 * This is the safety net against hallucinated/malformed LLM output - it is
 * the ONLY thing standing between whatever the model returns and what the
 * teacher sees, so it is deliberately strict: anything not certain to be
 * real is rejected, and every field a given `when.type` REQUIRES must
 * actually be present and valid - not just "valid if present" (a hint
 * missing a required field, e.g. character_missing with no characterMd5,
 * would otherwise slip through and never resolve on the student side: its
 * condition would always read as unmet, so it would show forever).
 */
function isHintValid(hint, index) {
    if (!hint || typeof hint !== 'object') return false;
    if (typeof hint.text !== 'string' || !hint.text.trim()) return false;

    const when = hint.when;
    if (!when || typeof when !== 'object' || !VALID_WHEN_TYPES.has(when.type)) return false;

    const hasValidScene = typeof when.sceneMd5 === 'string' && index.sceneMd5Set.has(when.sceneMd5);
    const charsInScene = hasValidScene ? index.charactersByScene.get(when.sceneMd5) : null;
    const hasValidCharacter = hasValidScene && !!charsInScene &&
        typeof when.characterMd5 === 'string' && charsInScene.has(when.characterMd5);

    switch (when.type) {
        case 'scene_missing':
            return hasValidScene;
        case 'character_missing':
        case 'character_no_script':
            return hasValidCharacter;
        case 'character_missing_block_type':
            return hasValidCharacter &&
                Array.isArray(when.blockTypes) && when.blockTypes.length > 0 &&
                when.blockTypes.every((t) => typeof t === 'string' && t.length > 0);
        case 'message_not_received':
            return typeof when.messageName === 'string' && index.allMessagesSent.has(when.messageName);
        default:
            return false; // unreachable (VALID_WHEN_TYPES already filtered), kept for exhaustiveness
    }
}

/**
 * @param {object} projectJson - the teacher's PARSED (already JSON.parse()'d)
 *   reference project, same shape computeDetailedManifest() expects.
 * @returns {Promise<{ hints: Array<{ id: string, text: string, when: object }> }>}
 * @throws with err.code === 'NOT_CONFIGURED' when DEEPSEEK_API_KEY is unset;
 *   throws a plain Error (unparseable/empty LLM response, API call failure)
 *   otherwise. Never returns hallucinated/invalid hints - see isHintValid().
 */
async function generateHints(projectJson) {
    const manifest = computeDetailedManifest(projectJson);
    const transcript = buildTranscript(manifest);

    if (!transcript) {
        // Nothing describable yet (empty project, or nothing with a real
        // asset md5 set) - no point spending an LLM call on it.
        return { hints: [] };
    }

    const client = getClient(); // throws NOT_CONFIGURED before any network call if unset

    let completion;
    try {
        completion = await client.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: transcript },
            ],
            temperature: 0.7,
        });
    } catch (err) {
        throw new Error('Falha ao chamar a API de geração de dicas: ' + err.message);
    }

    const rawContent =
        completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content;

    let parsed;
    try {
        parsed = JSON.parse(stripCodeFences(rawContent));
    } catch (err) {
        throw new Error('Resposta da IA de geração de dicas não é um JSON válido: ' + err.message);
    }

    const rawHints = Array.isArray(parsed && parsed.hints) ? parsed.hints : [];
    const validationIndex = buildValidationIndex(manifest);

    const validHints = [];
    for (const hint of rawHints) {
        if (isHintValid(hint, validationIndex)) {
            validHints.push(hint);
        } else {
            console.warn('[hintsGeneration] Descartando dica inválida/possivelmente alucinada da LLM:', JSON.stringify(hint));
        }
    }

    const hints = validHints.slice(0, MAX_HINTS).map((hint, idx) => ({
        id: `h${idx + 1}`,
        text: hint.text,
        when: hint.when,
    }));

    return { hints };
}

module.exports = { generateHints };
