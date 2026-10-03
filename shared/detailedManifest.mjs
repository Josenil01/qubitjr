/**
 * shared/detailedManifest.mjs
 *
 * Fonte ÚNICA (refatoração Fase 1 - antes existia como duas cópias mantidas
 * manualmente em sincronia: backend/src/services/detailedManifest.js em
 * CommonJS e src/app/src/editor/ui/detailedManifest.js em ES module, porque
 * o Vite não conseguia importar um pacote CommonJS do backend. Isso deixou
 * de ser um problema: Node >= 22.12 faz `require()` síncrono de um módulo
 * ESM, então o backend passou a reexportar este arquivo direto -
 * backend/src/services/detailedManifest.js agora é só um shim de uma linha
 * - e o Vite já importa ESM nativamente. Qualquer mudança de regra aqui
 * agora vale pros dois lados automaticamente, sem precisar lembrar de
 * replicar nada.
 *
 * Companion to assignmentScoring.mjs, but for a very different purpose:
 * assignmentScoring.mjs's computeProjectManifest() collapses a project down
 * to AGGREGATE counts (how many scenes, how many characters, how many of
 * each block type) because that's all compareManifests() needs to score a
 * student's project against a teacher's requirements. That collapse throws
 * away exactly the information a coaching-hint generator needs: WHICH scene,
 * WHICH character, in WHICH order the teacher built things.
 *
 * computeDetailedManifest() below walks the SAME project JSON shape (see
 * assignmentScoring.mjs's header docblock for the exact shape:
 * `{pages: [...], [pageId]: {sprites: [...], md5, [spriteId]: {type, md5,
 * scripts: [...]}}}`) but preserves per-scene, per-character detail, IN
 * ARRAY ORDER. The order pages appear in projectJson.pages, and sprites in
 * page.sprites, reflects the order the teacher created them in the editor -
 * that order is deliberate and meaningful for hint generation (it IS the
 * "natural build sequence" hintsGeneration.js turns into a transcript), so
 * nothing here sorts or reorders it.
 *
 * Unlike assignmentScoring.mjs's "qualifying sprite/scene" filter (which only
 * credits a scene/character once it has a real script, to avoid over-crediting
 * decorative unused assets), EVERY scene and EVERY character sprite is
 * included here, scripted or not - a character with no script yet is exactly
 * the kind of thing a coaching hint needs to describe ("sem script ainda").
 *
 * This module is 100% pure (no I/O, no Supabase, no DOM/window) - roda igual
 * em Node (backend) e no navegador (frontend via Vite).
 */

/**
 * Editor UI artifacts, never real student/teacher-placed blocks. Excluded
 * from blockTypes entirely, mirroring assignmentScoring.mjs's CARET_TYPES.
 */
const CARET_TYPES = new Set(['caretstart', 'caretend', 'caretrepeat', 'caretcmd']);

/**
 * Rótulos em PT-BR pro argumento (0/1/2) do bloco `setspeed` (ver
 * Prims.js#SetSpeed: `speed = 2^num`, os ícones "andando/correndo/voando" no
 * editor) - usados tanto no token de blockSequence quanto no texto das dicas
 * geradas por código, pra bater com a mesma palavra que a LLM já usa
 * ("velocidade lenta/normal/rápida").
 */
const SPEED_LABELS = ['lenta', 'normal', 'rápida'];

/**
 * Achado em teste real (decisão explícita do usuário) - "say" é o ÚNICO
 * bloco cujo argumento pode divergir do que o professor usou (qualquer fala
 * o aluno escrever conta - só a presença do bloco diga importa). TODO OUTRO
 * bloco com argumento numérico precisa do valor EXATO conferido, senão o
 * aluno fica em tentativa-e-erro (ex.: "ande pra frente" sem dizer quantos
 * passos, ou "espere" sem dizer quanto tempo). BlockSpecs.js#setupBlocksSpecs
 * mostra o argtype 'n' (campo numérico) desses blocos - listados aqui;
 * 'setspeed' usa argtype 'd' (menu por índice numérico 0/1/2) mas é o MESMO
 * tipo de valor (um inteiro), então entra na mesma lista/mecanismo.
 * message/onmessage NÃO entram aqui - a mensagem exata já é conferida por um
 * mecanismo próprio (messagesSent/messagesReceived + o hint
 * "message_not_received", ver hintsGeneration.js), não precisam de blockArgs.
 */
const TRIGGER_TYPES = new Set(['onflag', 'onclick', 'ontouch', 'onmessage']);

const NUMERIC_ARG_TYPES = new Set([
    'forward', 'back', 'up', 'down', 'left', 'right', 'hop',
    'wait', 'repeat', 'grow', 'shrink', 'setspeed',
]);

function emptyManifest () {
    return {scenes: []};
}

/**
 * Texto PADRÃO do bloco `say` em cada idioma (BlockSpecs.js: chave
 * SAY_BLOCK_DEFAULT_ARGUMENT nas localizações) - o que o bloco mostra
 * quando o aluno acabou de arrastá-lo e AINDA NÃO escreveu nada. Um `say`
 * com esse texto não conta como "feito" (nem pra completar a missão, nem
 * pra resolver a dica): achado em teste real - o aluno arrastava o bloco
 * "olá" sem editar e recebia os parabéns. Comparação sem caixa/espaços.
 * Mesmo Set que assignmentScoring.mjs usa - os dois precisam tratar o
 * mesmo texto-padrão como "ainda não feito".
 */
const DEFAULT_SAY_TEXTS = new Set(['hola', 'hallo', 'hi', 'bonjour', 'ciao', 'はい', 'hoi', 'olá', 'hej', 'สวัสดี', '嗨']);

function isDefaultSayText (arg) {
    return typeof arg === 'string' && DEFAULT_SAY_TEXTS.has(arg.trim().toLowerCase());
}

/**
 * Recursively walks one script (array of block tuples - script[0] é a
 * trigger tuple, ex.: ['onmessage', msgName, dx, dy], os demais são blocos
 * de comando na ordem em que aparecem), recolhendo em `agg`:
 *  - blockTypes: todo block[0] que não seja um marcador de caret/UI;
 *  - messagesSent: block[1] de todo bloco `message` (envio);
 *  - messagesReceived: block[1] de todo trigger `onmessage` (recebimento).
 * Recursa no strip aninhado de um `repeat` (block[4]) - mesmo walk de
 * assignmentScoring.mjs#walkScript, mesma razão (é o único bloco cuja
 * tupla carrega um array aninhado nesse índice).
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
 *
 * agg.blockArgs (Map<blockType, Set<number>>) - pra cada tipo em
 * NUMERIC_ARG_TYPES, todo valor numérico já configurado nesse tipo de bloco
 * deste personagem. Existe porque um TIPO em blockTypes só diz "o
 * personagem tem um forward/wait/repeat/etc.", nunca COM QUAL valor - uma
 * dica que pede "ande 3 passos" ou "espere um pouco" (número X) precisa
 * conferir o valor exato, não só a presença do bloco (ver isHintValid/
 * hintConditionHolds em HintEngine.js). "say" fica de fora de propósito -
 * ver NUMERIC_ARG_TYPES acima.
 */
function walkScriptForDetail (script, agg) {
    if (!Array.isArray(script)) return;

    for (const block of script) {
        if (!Array.isArray(block) || block.length === 0) continue;

        const blockType = block[0];
        if (CARET_TYPES.has(blockType)) continue; // editor artifact, ignore entirely
        // say com o texto padrão (aluno ainda não editou) = bloco ainda não feito.
        if (blockType === 'say' && isDefaultSayText(block[1])) continue;

        agg.blockTypes.add(blockType);
        agg.blockCounts.set(blockType, (agg.blockCounts.get(blockType) || 0) + 1);

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
        } else if (blockType === 'onmessage' && hasRealArg) {
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

        // Achado em teste real - um bloco com argumento numérico
        // (forward/wait/repeat/setspeed/etc.) sempre caía no ramo genérico
        // abaixo, contando só COMO TIPO ("o personagem tem um wait"), nunca
        // COM QUAL VALOR. Uma dica que pede "espere 10" ficava satisfeita só
        // por existir QUALQUER wait, com qualquer tempo - mesmo problema já
        // tratado pra say/message, generalizado agora pra todo bloco
        // numérico (ver NUMERIC_ARG_TYPES acima; "say" fica de fora de
        // propósito). hasRealArg como pré-condição (não só checar NaN) -
        // achado em teste real: `Number(null) === 0` em JS, então um bloco
        // sem argumento de verdade (null/undefined) seria lido como valor 0
        // por engano, mesmo cuidado já tomado com message/onmessage.
        const numArg = NUMERIC_ARG_TYPES.has(blockType) && hasRealArg ? Number(arg) : NaN;
        const hasRealNumArg = !Number.isNaN(numArg);
        if (hasRealNumArg) {
            const argSet = agg.blockArgs.get(blockType) || new Set();
            argSet.add(numArg);
            agg.blockArgs.set(blockType, argSet);
        }

        // Bloco (na ordem real, inclusive aninhados) do script que está sendo
        // percorrido agora - alimenta agg.scripts em computeDetailedManifest.
        // pending: valor PADRÃO ainda não confirmado pelo aluno (ver
        // Project.maskUnconfirmed, src/app/src/editor/ui/Project.js) - só
        // acontece no lado do CLIENTE (o servidor nunca recebe um projeto
        // mascarado, então o regex abaixo nunca casa lá - sem custo/efeito
        // nenhum pro backend). num fica null nesse caso.
        const pendingMatch = (typeof arg === 'string') ? /^unconfirmed:(-?\d+(?:\.\d+)?)$/.exec(arg) : null;
        agg.currentBlocks.push({
            type: blockType,
            num: hasRealNumArg ? numArg : null,
            pending: pendingMatch ? Number(pendingMatch[1]) : null,
        });

        // Ver docblock acima - token já pronto pra exibição, na ORDEM real
        // do script (nunca deduplicado). setspeed usa o rótulo em PT-BR
        // (SPEED_LABELS); os demais blocos numéricos mostram o valor cru
        // (ex.: "forward[3]", "wait[10]", "repeat[4]").
        if (blockType === 'message' && hasRealArg) {
            agg.blockSequence.push(`message["${arg}"]`);
        } else if (blockType === 'onmessage' && hasRealArg) {
            agg.blockSequence.push(`onmessage["${arg}"]`);
        } else if (blockType === 'say' && hasRealArg) {
            agg.blockSequence.push(`say["${arg}"]`);
        } else if (blockType === 'setspeed' && hasRealNumArg && numArg >= 0 && numArg < SPEED_LABELS.length) {
            agg.blockSequence.push(`setspeed[${SPEED_LABELS[numArg]}]`);
        } else if (hasRealNumArg) {
            agg.blockSequence.push(`${blockType}[${numArg}]`);
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
 * Resume um script: `trigger` (script[0][0] se for um dos blocos de início -
 * onflag/onclick/ontouch/onmessage; null se o script começa solto) e `blocks`
 * (os demais, na ordem real, com o valor numérico quando existe - {type,
 * num}). Permite às dicas conferir EM QUAL gatilho o bloco está (when.trigger)
 * e quantos blocos de um tipo existem (when.minCounts), coisas que a lista
 * achatada blockTypes/blockSequence não sabe dizer.
 */
function buildScriptDetail (script, blocks) {
    const first = script[0];
    const firstType = Array.isArray(first) ? first[0] : null;
    const isTrigger = TRIGGER_TYPES.has(firstType);
    return {
        trigger: isTrigger ? firstType : null,
        blocks: isTrigger ? blocks.slice(1) : blocks,
    };
}

/**
 * Takes the PARSED project JSON object (already JSON.parse()'d by the
 * caller) and returns the detailed, order-preserving manifest described in
 * the module header. Never throws - malformed/missing input yields
 * `{ scenes: [] }`, mirroring computeProjectManifest()'s defensive style.
 */
export function computeDetailedManifest (projectJson) {
    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) {
        return emptyManifest();
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
        if (!page || typeof page !== 'object') continue; // tolerate a ghost page id, like assignmentScoring.mjs

        const spriteIds = Array.isArray(page.sprites) ? page.sprites : [];
        const characters = [];

        for (const spriteId of spriteIds) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object') continue; // tolerate a ghost sprite id

            if (sprite.type !== 'sprite') continue; // never text boxes, same rule as assignmentScoring.mjs

            const scripts = Array.isArray(sprite.scripts) ? sprite.scripts : [];
            const agg = {
                blockTypes: new Set(),
                messagesSent: new Set(),
                messagesReceived: new Set(),
                sayTexts: [],
                blockSequence: [],
                blockArgs: new Map(),
                blockCounts: new Map(),
                currentBlocks: [],
            };
            const scriptDetails = [];
            let hasScript = false;

            for (const script of scripts) {
                if (!Array.isArray(script) || script.length === 0) continue; // empty script: no code
                hasScript = true;
                agg.currentBlocks = [];
                walkScriptForDetail(script, agg);
                scriptDetails.push(buildScriptDetail(script, agg.currentBlocks));
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
                // { [blockType]: quantas vezes aparece no personagem } - ver
                // when.minCounts em hintsGeneration.js#fillBlockContext.
                blockCounts: Object.fromEntries(agg.blockCounts),
                // Um item por script, com o gatilho e os blocos DELE - o que
                // blockSequence/blockTypes (achatados) perdem. Ver buildScriptDetail.
                scripts: scriptDetails,
                // { [blockType]: number[] } - todo valor numérico já
                // configurado em cada tipo de NUMERIC_ARG_TYPES pra este
                // personagem (ordenado). Ex.: {"forward": [3], "wait": [10]}.
                blockArgs: Object.fromEntries(
                    Array.from(agg.blockArgs.entries(), ([type, values]) => [type, Array.from(values).sort((a, b) => a - b)])
                ),
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

    return {scenes};
}
