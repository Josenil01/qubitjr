'use strict';

/**
 * activityProjectBuilder.js
 *
 * Monta um projeto ScratchJr (.sjr) real, carregável no editor de verdade, a
 * partir de um "plano" simples e fechado (scenes -> characters -> scripts)
 * que a LLM preenche em activityGeneration.js. Deliberadamente burro/
 * determinístico - a LLM nunca escreve o JSON do projeto diretamente (ver
 * decisão do usuário: "DSL estruturado" em vez de "LLM gera o .sjr
 * livremente"); ela só escolhe DENTRO do schema fechado (quais assets, quais
 * blocos), e este módulo é quem sabe montar a estrutura real que Page.js/
 * Sprite.js/Project.js esperam.
 *
 * Shape de saída confirmado lendo o código real de carregamento/salvamento
 * (não documentação, não amostra) - ver:
 *   - Page.js#loadPageData/encodePage: page = {md5, sprites: [id,...],
 *     layers: [], num, lastSprite, textstartat, [spriteId]: spriteData}
 *   - Sprite.js#getSpriteData: sprite = {type:'sprite', id, md5, name, shown,
 *     flip, angle, scale, defaultScale, speed, dirx, diry, sounds, xcoor,
 *     ycoor, homex, homey, homescale, homeshown, scripts}
 *   - Sprite.js#displaySprite: cx/cy/w/h são SEMPRE recalculados a partir do
 *     asset real carregado (this.img.width/height), tanto na criação quanto
 *     no carregamento de um projeto salvo - por isso NÃO precisamos (nem
 *     tentamos) calcular esses 4 campos aqui; qualquer valor votaria
 *     descartado no primeiro load no editor real.
 *   - Project.js#encodeStrip/recreateObject: script = array de tuplas
 *     [blocktype, arg, dx, dy, inside?] - "inside" só em blocos de loop
 *     (repeat). arg 'null' (string) é o sentinela de "bloco sem argumento
 *     real" (onflag, ou message/onmessage sem mensagem escolhida) - ver
 *     mesma convenção em backend/src/services/detailedManifest.js.
 *   - UI.js#addSprite: sprAttr default (scale/speed/dirx/diry/sounds/homex/
 *     homey/homeshown) usado sempre que um personagem é adicionado à mão -
 *     mesmos defaults usados aqui pra manter a atividade gerada indistinguível
 *     de uma montada manualmente.
 */

// Mesmo conjunto de tipos que hintsGeneration.js já entende/valida (VALID_WHEN_TYPES
// cobre os efeitos desses blocos) - fechar a lista aqui garante que qualquer
// script gerado é decodificável pelas duas pontas (editor real E o pipeline
// de dicas que roda em cima do projeto gerado). 'onclick' (toque no
// personagem) confirmado como bloco real em BlockSpecs.js - não é um alias
// nem invenção, é o mesmo tipo que assignmentScoring.js já pontua em
// parallelism/userInteractivity.
const { getCharacterScale } = require('./activityAssetLibrary');

const TRIGGER_BLOCK_TYPES = new Set(['onflag', 'onclick', 'onmessage']);
const NUMERIC_BLOCK_TYPES = new Set(['forward', 'back', 'up', 'down', 'left', 'right', 'hop', 'wait', 'repeat', 'grow', 'shrink']);
const SETSPEED_VALUES = new Set([0, 1, 2]);
const STRING_ARG_BLOCK_TYPES = new Set(['say', 'message', 'onmessage']);
// playsnd: todo personagem montado por buildSprite() nasce com sounds:['pop.mp3']
// (ver buildSprite abaixo) - então 'pop.mp3' é sempre um som válido, não
// precisa de checagem por personagem, diferente de setcostume logo abaixo.
const SOUND_BLOCK_TYPES = new Set(['playsnd']);
const VALID_SOUND_NAMES = new Set(['pop.mp3']);
// setcostume: só existe visual alternativo pra personagens cadastrados aqui
// (mesmo mapeamento usado pelo editor real em
// src/app/src/editor/engine/Page.js#costumeVariants - duplicado de propósito
// porque um é ESM de frontend e o outro CommonJS de backend, sem um jeito
// limpo de compartilhar sem criar um módulo novo em shared/ só pra isso).
// Mantenha os dois em sincronia ao adicionar um personagem com variantes.
const COSTUME_VARIANTS = {
    'HY-SaciPerere1.svg': ['HY-SaciPerere1.svg', 'HY-SaciPerere2.svg'],
    'HY-SaciPerere2.svg': ['HY-SaciPerere1.svg', 'HY-SaciPerere2.svg'],
};
const ALL_BLOCK_TYPES = new Set([
    ...TRIGGER_BLOCK_TYPES, ...NUMERIC_BLOCK_TYPES, ...SOUND_BLOCK_TYPES, 'setspeed', 'setcostume', 'say', 'message',
]);

/**
 * Perfis de complexidade por nível (1º/2º/3º ano - decisão do usuário,
 * conversa de 2026-09-19). Fonte única da verdade: tanto a VALIDAÇÃO/
 * SANEAMENTO do plano abaixo quanto o prompt da LLM em activityGeneration.js
 * leem daqui - nunca duas cópias dos mesmos números. Números NUNCA confiados
 * só ao prompt (mesma lição de sempre neste código: uma regra só no prompt
 * já foi ignorada pela LLM antes) - validatePlan/validateScript abaixo
 * CORTAM o que exceder o perfil, em vez de só pedir educadamente.
 *
 * loop/messages: 'none' (bloco removido onde aparecer) | 'optional' (LLM
 * pode usar, sem mínimo exigido em código) | 'expected' (só orienta o
 * prompt a usar - não há como EXIGIR um mínimo em código sem arriscar
 * travar a geração inteira por um detalhe estilístico).
 *
 * [2026-11] Nível 1 igualado ao Nível 2 (decisão do usuário: os projetos
 * gerados por IA que o professor editou e aprovou - usados como referência
 * de qualidade - foram todos gerados sob o perfil do Nível 2; a versão
 * antiga do Nível 1 (1 cena, 1 personagem, sem mensagem/loop) travava
 * estruturalmente esse nível de atividade pra turmas de 1º ano, mesmo
 * quando apropriado pro tema/aluno). Mantido como entrada própria (não só
 * um alias de LEVEL_PROFILES[2]) para preservar o rótulo "1º ano" exibido
 * ao professor e deixar margem pra divergir de novo no futuro, se for o
 * caso - mas hoje os números são os mesmos de propósito.
 */
const LEVEL_PROFILES = {
    1: {
        level: 1,
        label: 'Nível 1 (1º ano)',
        scenes: 2,
        charactersPerScene: 2,
        blocksPerScript: { min: 4, max: 5 },
        allowedTriggers: ['onflag', 'onclick', 'onmessage'],
        loop: 'optional',
        messages: 'optional',
    },
    2: {
        level: 2,
        label: 'Nível 2 (2º ano)',
        scenes: 2,
        charactersPerScene: 2,
        blocksPerScript: { min: 4, max: 5 },
        allowedTriggers: ['onflag', 'onclick', 'onmessage'],
        loop: 'optional',
        messages: 'optional',
    },
    3: {
        level: 3,
        label: 'Nível 3 (3º ano)',
        scenes: 3,
        charactersPerScene: 3,
        blocksPerScript: { min: 6, max: 7 },
        allowedTriggers: ['onflag', 'onclick', 'onmessage'],
        loop: 'expected',
        messages: 'expected',
    },
};
const DEFAULT_LEVEL = 2;

/** Nível inválido/ausente cai no default (2) - nunca lança, geração sempre segue. */
function resolveLevelProfile(level) {
    return LEVEL_PROFILES[Number(level)] || LEVEL_PROFILES[DEFAULT_LEVEL];
}

let _idCounter = 0;
function nextId(prefix) {
    _idCounter += 1;
    return `${prefix}_${Date.now().toString(36)}_${_idCounter}`;
}

/**
 * Valida recursivamente uma tupla de bloco simplificada vinda da LLM:
 * [blockType, arg] ou, só pra "repeat", [blockType, arg, nestedBlocks].
 * Retorna null se inválida (nunca lança - quem chama decide descartar).
 *
 * `levelProfile` (opcional - null/undefined = sem restrição de nível, usado
 * pelos testes e por qualquer chamador que não passe nível) reforça, em
 * código, o que o prompt pede: gatilho fora de levelProfile.allowedTriggers,
 * `repeat` quando levelProfile.loop === 'none', ou `message` quando
 * levelProfile.messages === 'none' são todos REJEITADOS aqui - nunca chegam
 * a virar bloco no projeto final, mesmo que a LLM os tenha sugerido.
 *
 * `characterMd5` identifica de quem é este script - necessário só pra
 * `setcostume` (ver COSTUME_VARIANTS acima): o índice que a LLM escolhe
 * (0, 1, 2...) só faz sentido pra um personagem que de fato tem essa
 * variante cadastrada, então rejeitamos aqui em vez de deixar o editor
 * carregar um bloco que não faz nada pra esse personagem.
 */
function validateBlockTuple(tuple, { isFirstInScript, levelProfile, characterMd5 }) {
    if (!Array.isArray(tuple) || tuple.length < 2) return null;
    const [blockType, arg, nested] = tuple;
    if (typeof blockType !== 'string' || !ALL_BLOCK_TYPES.has(blockType)) return null;

    if (TRIGGER_BLOCK_TYPES.has(blockType)) {
        if (!isFirstInScript) return null; // onflag/onclick/onmessage só fazem sentido como primeiro bloco do script
        if (levelProfile && !levelProfile.allowedTriggers.includes(blockType)) return null;
    }

    if (blockType === 'repeat') {
        if (levelProfile && levelProfile.loop === 'none') return null;
        const count = Number(arg);
        if (!Number.isFinite(count) || count <= 0) return null;
        // Nível não se aplica RECURSIVAMENTE dentro do repeat de propósito -
        // blocksPerScript já limita o TOPO do script (o "repeat" em si conta
        // como 1 bloco ali); o conteúdo interno não tem um limite próprio
        // pedido pelo usuário, então não inventamos um.
        const validNested = validateScript(nested, { allowTrigger: false, levelProfile: null, characterMd5 });
        if (!validNested) return null;
        return { blockType, arg: count, nested: validNested };
    }

    if (blockType === 'message' && levelProfile && levelProfile.messages === 'none') {
        return null; // envio de mensagem também não faz sentido num nível sem sincronização
    }

    if (NUMERIC_BLOCK_TYPES.has(blockType)) {
        const num = Number(arg);
        if (!Number.isFinite(num)) return null;
        return { blockType, arg: num };
    }

    if (blockType === 'setspeed') {
        const num = Number(arg);
        if (!SETSPEED_VALUES.has(num)) return null;
        return { blockType, arg: num };
    }

    if (blockType === 'setcostume') {
        const variants = characterMd5 ? COSTUME_VARIANTS[characterMd5] : null;
        if (!variants || variants.length < 2) return null; // personagem sem variante cadastrada - bloco não faria nada
        const idx = Number(arg);
        if (!Number.isInteger(idx) || idx < 0 || idx >= variants.length) return null;
        return { blockType, arg: idx };
    }

    if (SOUND_BLOCK_TYPES.has(blockType)) {
        if (typeof arg !== 'string' || !VALID_SOUND_NAMES.has(arg)) return null;
        return { blockType, arg };
    }

    if (blockType === 'onflag' || blockType === 'onclick') {
        return { blockType, arg: 'null' };
    }

    if (STRING_ARG_BLOCK_TYPES.has(blockType)) {
        // message/onmessage sem valor escolhido == sentinela 'null' (mesma
        // convenção do editor real - ver detailedManifest.js#hasRealArg).
        if (blockType === 'say') {
            if (typeof arg !== 'string' || !arg.trim()) return null;
            return { blockType, arg: arg.trim() };
        }
        if (typeof arg !== 'string' || !arg.trim()) return null;
        return { blockType, arg: arg.trim() };
    }

    return null;
}

/**
 * Valida um script inteiro (array de tuplas). `allowTrigger` é false dentro
 * de um repeat (onflag/onclick/onmessage não podem aparecer lá dentro).
 * Retorna o script validado (array de {blockType, arg, nested?}) ou null se
 * vazio/totalmente inválido.
 *
 * `levelProfile`, quando presente E `allowTrigger` (ou seja, só no TOPO do
 * script, nunca dentro de um repeat recursivo - ver validateBlockTuple),
 * corta o script pro tamanho máximo do nível (levelProfile.blocksPerScript.max)
 * - sempre cortando do FIM, nunca do meio, pra preservar o gatilho inicial e
 * a ordem que a LLM escolheu.
 */
function validateScript(script, { allowTrigger = true, levelProfile = null, characterMd5 = null } = {}) {
    if (!Array.isArray(script) || script.length === 0) return null;
    const result = [];
    script.forEach((tuple, idx) => {
        const isFirstInScript = allowTrigger && idx === 0;
        const validated = validateBlockTuple(tuple, { isFirstInScript, levelProfile, characterMd5 });
        if (validated) result.push(validated);
    });
    if (result.length === 0) return null;
    // Um script no TOPO (allowTrigger - nunca dentro de um repeat, ver
    // validateBlockTuple) sem um gatilho válido logo no início nunca executa
    // de verdade no editor real (não tem hat block pra disparar) - se o
    // gatilho original foi rejeitado (tipo fora do nível, ou simplesmente
    // inválido), o script INTEIRO é descartado, não só aquele bloco. Sem
    // isso, os blocos seguintes sobreviviam soltos e órfãos - achado
    // escrevendo o teste "nível 1 rejeita onmessage como gatilho".
    if (allowTrigger && !TRIGGER_BLOCK_TYPES.has(result[0].blockType)) {
        return null;
    }
    if (levelProfile && allowTrigger && result.length > levelProfile.blocksPerScript.max) {
        return result.slice(0, levelProfile.blocksPerScript.max);
    }
    return result;
}

/**
 * Converte um script já validado (array de {blockType, arg, nested?}) na
 * tupla real [blocktype, arg, dx, dy, inside?] que Project.js#recreateObject
 * espera. dx/dy são só a posição visual do bloco na área de script -
 * incrementamos verticalmente (mesmo efeito de empilhar blocos um embaixo do
 * outro à mão); não precisa ser pixel-perfect, o professor pode reorganizar
 * livremente ao abrir o projeto no editor.
 */
function encodeScript(validatedScript, startY = 0) {
    let y = startY;
    return validatedScript.map((block) => {
        const tuple = [block.blockType, block.arg, 0, y];
        y += 42; // altura aproximada de um bloco no editor real
        if (block.blockType === 'repeat') {
            tuple.push(encodeScript(block.nested, 0));
        }
        return tuple;
    });
}

function buildSprite({ md5, name, scripts }, isFirstSprite) {
    const id = nextId('spr');
    const scale = getCharacterScale(md5);
    return {
        id,
        data: {
            type: 'sprite',
            id,
            md5,
            name,
            shown: true,
            flip: false,
            angle: 0,
            scale,
            defaultScale: scale,
            speed: 2,
            dirx: 1,
            diry: 1,
            sounds: ['pop.mp3'],
            // Mesma convenção do editor real (ver Page.js#addSprite/costumeVariants) -
            // sem isso o bloco setcostume carregaria no projeto gerado mas
            // não faria nada (Prims.SetCostume vira no-op sem s.costumes).
            costumes: COSTUME_VARIANTS[md5] || [],
            // Espalha os personagens horizontalmente pra não nascerem todos
            // exatamente empilhados no centro do palco (480x360) - só
            // cosmético, o professor reposiciona à vontade no editor.
            xcoor: isFirstSprite ? 240 : 140 + Math.floor(Math.random() * 200),
            ycoor: 180,
            homex: 240,
            homey: 180,
            homescale: scale,
            homeshown: true,
            scripts: scripts.map((s) => encodeScript(s)),
        },
    };
}

function buildPage(sceneMd5, sprites, pageNum) {
    const pageId = nextId('page');
    const spriteEntries = sprites.map((s, idx) => buildSprite(s, idx === 0));
    const pageData = {
        md5: sceneMd5,
        sprites: spriteEntries.map((s) => s.id),
        layers: [],
        num: pageNum,
        lastSprite: spriteEntries.length ? spriteEntries[0].id : undefined,
        textstartat: 36,
    };
    for (const entry of spriteEntries) {
        pageData[entry.id] = entry.data;
    }
    return { pageId, pageData };
}

/**
 * @param {object} plan - já validado por validatePlan() abaixo (ver
 *   activityGeneration.js: nunca chame isto direto com o output cru da LLM).
 * @param {Array<{backgroundMd5: string, characters: Array<{md5, name, scripts}>}>} plan.scenes
 * @returns {{projectJson: object}} - projeto pronto pra virar o `json` de uma
 *   linha em `projects`/`ai_activity_drafts`, e pra alimentar
 *   computeProjectManifest/computeDetailedManifest/generateHints sem nenhuma
 *   adaptação (mesmo shape que um projeto autorado à mão no editor produz).
 */
function buildProjectFromPlan(plan) {
    const projectJson = { pages: [] };
    plan.scenes.forEach((scene, idx) => {
        const { pageId, pageData } = buildPage(scene.backgroundMd5, scene.characters, idx + 1);
        projectJson.pages.push(pageId);
        projectJson[pageId] = pageData;
    });
    return { projectJson };
}

/**
 * Valida e SANEIA (nunca lança) o plano cru vindo da LLM contra a biblioteca
 * de assets real. Cenas com fundo inválido são descartadas inteiras;
 * personagens com md5 inválido são descartados da cena (a cena sobrevive sem
 * eles, igual uma cena "sem personagem ainda" no editor real); scripts/
 * blocos inválidos são descartados um a um (ver validateScript). Retorna
 * `{ plan: <saneado>, warnings: string[] }` - `plan.scenes` pode vir vazio se
 * NADA sobrou, e quem chama (activityGeneration.js) deve tratar isso como
 * falha (não dá pra montar um projeto sem nenhuma cena).
 *
 * `levelProfile` (opcional - ver LEVEL_PROFILES/resolveLevelProfile acima)
 * também CORTA, aqui em código, o que exceder o nível: cenas além de
 * levelProfile.scenes e personagens além de levelProfile.charactersPerScene
 * são removidos do FIM da lista (mantém os primeiros, nunca reordena) - a
 * limitação de gatilho/loop/mensagem/tamanho de script já acontece dentro de
 * validateScript/validateBlockTuple, chamadas abaixo.
 */
function validatePlan(rawPlan, library, levelProfile) {
    const warnings = [];
    if (!rawPlan || typeof rawPlan !== 'object' || !Array.isArray(rawPlan.scenes)) {
        return { plan: { scenes: [] }, warnings: ['Plano vazio ou malformado'] };
    }

    const scenes = [];
    for (const rawScene of rawPlan.scenes) {
        if (!rawScene || typeof rawScene.backgroundMd5 !== 'string' || !library.backgroundMd5s.has(rawScene.backgroundMd5)) {
            warnings.push(`Cena descartada - fundo inválido/inexistente: ${rawScene && rawScene.backgroundMd5}`);
            continue;
        }

        const characters = [];
        for (const rawCharacter of Array.isArray(rawScene.characters) ? rawScene.characters : []) {
            if (!rawCharacter || typeof rawCharacter.md5 !== 'string' || !library.characterMd5s.has(rawCharacter.md5)) {
                warnings.push(`Personagem descartado - asset inválido/inexistente: ${rawCharacter && rawCharacter.md5}`);
                continue;
            }
            const name = typeof rawCharacter.name === 'string' && rawCharacter.name.trim()
                ? rawCharacter.name.trim()
                : rawCharacter.md5;

            const scripts = [];
            for (const rawScript of Array.isArray(rawCharacter.scripts) ? rawCharacter.scripts : []) {
                const validated = validateScript(rawScript, { levelProfile, characterMd5: rawCharacter.md5 });
                if (validated) scripts.push(validated);
            }

            characters.push({ md5: rawCharacter.md5, name, scripts });
        }

        const trimmedCharacters = levelProfile ? characters.slice(0, levelProfile.charactersPerScene) : characters;
        if (levelProfile && characters.length > trimmedCharacters.length) {
            warnings.push(`Cena "${rawScene.backgroundMd5}" tinha mais personagens que o nível ${levelProfile.level} permite - mantidos só os ${levelProfile.charactersPerScene} primeiros.`);
        }

        scenes.push({ backgroundMd5: rawScene.backgroundMd5, characters: trimmedCharacters });
    }

    const trimmedScenes = levelProfile ? scenes.slice(0, levelProfile.scenes) : scenes;
    if (levelProfile && scenes.length > trimmedScenes.length) {
        warnings.push(`Plano tinha mais cenas que o nível ${levelProfile.level} permite - mantidas só as ${levelProfile.scenes} primeiras.`);
    }

    return { plan: { scenes: trimmedScenes }, warnings };
}

module.exports = {
    buildProjectFromPlan, validatePlan, LEVEL_PROFILES, DEFAULT_LEVEL, resolveLevelProfile, COSTUME_VARIANTS,
};
