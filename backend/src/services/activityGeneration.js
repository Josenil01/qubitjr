'use strict';

/**
 * activityGeneration.js
 *
 * Fase 1 do agente "tema -> atividade pronta pro professor revisar" (ver
 * POST /api/public/activities/generate em routes/share.js): dado um tema em
 * texto livre (ex.: "A lenda do Saci Pererê"), pede pra LLM escolher, DENTRO
 * de um schema fechado (só assets/blocos que realmente existem - ver
 * activityAssetLibrary.js/activityProjectBuilder.js), quais cenas/
 * personagens/scripts montam uma atividade sobre esse tema, mais uma
 * descrição pro professor. NUNCA deixa a LLM escrever o .sjr diretamente -
 * mesma decisão/risco já documentado em activityProjectBuilder.js.
 *
 * generateActivityPlan(theme, level) faz, em ordem:
 *   1. Resolve o perfil do nível (1º/2º/3º ano - ver activityProjectBuilder.js
 *      #LEVEL_PROFILES/resolveLevelProfile; nível ausente/inválido cai no
 *      default). Fonte ÚNICA desses números - nunca duplicados aqui.
 *   2. Monta o prompt com a biblioteca real de fundos/personagens
 *      (activityAssetLibrary.js), o DSL de blocos suportado, e as regras de
 *      complexidade do nível resolvido.
 *   3. Chama o provider configurado (llmProvider.js - DeepSeek por padrão,
 *      Claude se ACTIVITY_GENERATION_PROVIDER=anthropic).
 *   4. Parseia a resposta como JSON estrito (mesma defesa de aspas/crases já
 *      usada em hintsGeneration.js#stripCodeFences).
 *   5. Saneia contra a biblioteca real E contra o perfil do nível via
 *      activityProjectBuilder#validatePlan - nunca confia só no prompt pra
 *      isso (o código CORTA cena/personagem/bloco/gatilho que excede o
 *      nível, mesmo que a LLM ignore a instrução).
 *   6. Se sobrar 0 cena válida, tenta UMA vez mais (a LLM às vezes erra o
 *      formato na primeira tentativa) antes de desistir.
 *
 * Não decide onde/como o plano validado vira um projeto real - isso é
 * activityProjectBuilder.js#buildProjectFromPlan, chamado por quem invoca
 * este módulo (routes/share.js, routes/assignments.js).
 */

const { loadLibrary } = require('./activityAssetLibrary');
const { validatePlan, resolveLevelProfile } = require('./activityProjectBuilder');
const { callLLM, getProviderConfig } = require('./llmProvider');

const BLOCK_DSL_DOC = `Cada script de personagem é uma lista de blocos, cada bloco representado como uma tupla [tipo, argumento]. Tipos válidos e seus argumentos:
- ["onflag", null] - inicia o script quando a bandeira verde é tocada. Só pode ser o PRIMEIRO bloco de um script.
- ["onclick", null] - inicia o script quando o ALUNO TOCA no personagem na tela. Só pode ser o PRIMEIRO bloco de um script.
- ["onmessage", "<nomeDaMensagem>"] - inicia o script quando essa mensagem é recebida. Só pode ser o PRIMEIRO bloco de um script.
- ["message", "<nomeDaMensagem>"] - envia uma mensagem (dispara qualquer script com onmessage do mesmo nome, em qualquer personagem/cena).
- ["say", "<texto>"] - personagem fala esse texto (bem curto, de criança pequena).
- ["forward", N] / ["back", N] / ["up", N] / ["down", N] / ["left", N] / ["right", N] / ["hop", N] - move N passos (N inteiro de 1 a 10) na direção indicada.
- ["wait", N] - espera N (inteiro, unidade arbitrária do ScratchJr, use valores entre 10 e 60).
- ["setspeed", N] - N é 0 (lenta), 1 (normal) ou 2 (rápida).
- ["grow", N] / ["shrink", N] - N inteiro pequeno (1 a 5).
- ["repeat", N, [<blocos internos>]] - repete N vezes (inteiro de 2 a 6) os blocos da lista interna (mesma sintaxe de tupla, sem onflag/onclick/onmessage lá dentro).
Nenhum outro tipo de bloco existe. Nunca invente um tipo, nem um valor de md5 que não esteja nas listas abaixo.`;

/**
 * Traduz o levelProfile (ver activityProjectBuilder.js#LEVEL_PROFILES) pras
 * regras de conteúdo do prompt - os NÚMEROS aqui são só orientação pra LLM
 * tentar acertar de primeira; o código (validatePlan/validateScript) é quem
 * garante de verdade que nada exceda o nível, mesmo se a LLM ignorar isto.
 */
function describeLevelRules(levelProfile) {
    const loopText = {
        none: 'NÃO use o bloco "repeat" neste nível - é cedo demais pra esse conceito.',
        optional: 'Pode usar "repeat" no máximo 1 vez, em algum personagem, se fizer sentido pra história - não é obrigatório.',
        expected: 'Use "repeat" em pelo menos 1 personagem - é o conceito principal deste nível.',
    }[levelProfile.loop];
    const messagesText = {
        none: 'NÃO use "message"/"onmessage" neste nível - cada personagem age sozinho, sem se comunicar com os outros.',
        optional: 'Pode usar "message"/"onmessage" pra um personagem reagir a outro, se fizer sentido - não é obrigatório.',
        expected: 'Use "message"/"onmessage" pra pelo menos 2 personagens se comunicarem (um manda, outro reage) - é o conceito principal deste nível.',
    }[levelProfile.messages];

    return `- Exatamente ${levelProfile.scenes} cena(s). Cada cena tem exatamente ${levelProfile.charactersPerScene} personagem(ns).
- Gatilhos permitidos nos scripts deste nível: ${levelProfile.allowedTriggers.map((t) => `"${t}"`).join(', ')} - nenhum outro tipo de gatilho.
- Cada script de personagem deve ter entre ${levelProfile.blocksPerScript.min} e ${levelProfile.blocksPerScript.max} blocos (contando o gatilho inicial).
- ${loopText}
- ${messagesText}`;
}

function buildSystemPrompt(library, levelProfile) {
    const backgroundList = library.backgrounds
        .map((b) => `- "${b.md5}" (${b.displayName})`)
        .join('\n');
    const characterList = library.characters
        .map((c) => `- "${c.md5}" (${c.displayName})`)
        .join('\n');

    return `Você ajuda professores a criar atividades de programação em bloco no ScratchJr pra crianças do ${levelProfile.label}, a partir de um TEMA (ex.: uma lenda, um livro, um assunto de aula).

Sua tarefa: escolher cenas, personagens e scripts DENTRO das listas reais abaixo (nunca fora delas) que contem uma pequena história/atividade sobre o tema recebido, adequada à complexidade do ${levelProfile.label} descrita abaixo, e escrever uma descrição curta da atividade pra o professor.

FUNDOS DE CENA DISPONÍVEIS (use o valor entre aspas, exatamente como está, no campo "backgroundMd5"):
${backgroundList}

PERSONAGENS DISPONÍVEIS (use o valor entre aspas, exatamente como está, no campo "md5" de cada personagem):
${characterList}

${BLOCK_DSL_DOC}

Regras de complexidade do ${levelProfile.label} (OBRIGATÓRIAS - a atividade é pra esse nível específico, nem mais simples nem mais complexa):
${describeLevelRules(levelProfile)}

Outras regras de conteúdo:
- Cada personagem precisa de pelo menos 1 script.
- Frases de "say" curtas, alegres, sem violência/susto pesado - é pra criança pequena.
- Se o tema pedir um personagem/cenário ICÔNICO que NÃO existe nas listas acima (ex.: um Saci Pererê de verdade, que não está na lista de personagens), escolha o personagem mais parecido/aproximado disponível e preencha "assetGapNote" explicando isso pro professor (qual seria o ideal, qual você usou no lugar). Se tudo que o tema precisa já existe nas listas, deixe "assetGapNote" como null.
- "teacherDescription": 2 a 4 frases, em português, explicando pro PROFESSOR o que a atividade ensina e como está estruturada (não é o texto que a criança lê).
- "projectName": nome curto da atividade (até 40 caracteres).

Responda APENAS com um JSON estrito, sem crases/markdown, exatamente neste formato:
{"projectName": "...", "teacherDescription": "...", "assetGapNote": "..." ou null, "scenes": [{"backgroundMd5": "...", "characters": [{"md5": "...", "name": "...", "scripts": [[["onflag", null], ["say", "..."]]]}]}]}`;
}

function stripCodeFences(text) {
    if (typeof text !== 'string') return text;
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

async function requestPlanFromLLM(theme, library, levelProfile, provider, model) {
    const systemPrompt = buildSystemPrompt(library, levelProfile);
    const userMessage = `TEMA DA ATIVIDADE: ${theme}`;

    const rawContent = await callLLM({ systemPrompt, userMessage, temperature: 0.8, provider, model });

    let parsed;
    try {
        parsed = JSON.parse(stripCodeFences(rawContent));
    } catch (err) {
        throw new Error('Resposta da IA de geração de atividade não é um JSON válido: ' + err.message);
    }
    return parsed;
}

/**
 * @param {string} theme - texto livre vindo da HelloYotta ou do professor
 *   (ver routes/share.js, routes/assignments.js), ex.: "A lenda do Saci
 *   Pererê".
 * @param {number|string} [level] - 1/2/3 (1º/2º/3º ano - ver
 *   activityProjectBuilder.js#LEVEL_PROFILES). Ausente/inválido cai no
 *   default (nível 2) - nunca lança por causa disso.
 * @returns {Promise<{
 *   projectName: string, teacherDescription: string,
 *   assetGapNote: string|null, plan: {scenes: Array}, level: number,
 *   levelLabel: string, provider: string, model: string, warnings: string[],
 * }>}
 * @throws com err.code === 'NOT_CONFIGURED' quando a chave do provider
 *   configurado não está definida; Error comum se, mesmo após retry, nenhuma
 *   cena válida sobrar.
 */
async function generateActivityPlan(theme, level) {
    const library = loadLibrary();
    const levelProfile = resolveLevelProfile(level);
    const { provider, model } = getProviderConfig();

    let raw = await requestPlanFromLLM(theme, library, levelProfile, provider, model);
    let { plan, warnings } = validatePlan(raw, library, levelProfile);

    if (plan.scenes.length === 0) {
        // A LLM às vezes erra o formato/inventa um md5 na primeira tentativa -
        // uma segunda chamada limpa (mesmo prompt) resolve na maioria dos
        // casos sem precisar de lógica de "corrigir" o JSON malformado.
        console.warn('[activityGeneration] Plano sem nenhuma cena válida na 1ª tentativa, tentando novamente:', warnings);
        raw = await requestPlanFromLLM(theme, library, levelProfile, provider, model);
        const retryResult = validatePlan(raw, library, levelProfile);
        plan = retryResult.plan;
        warnings = [...warnings, ...retryResult.warnings];
    }

    if (plan.scenes.length === 0) {
        const err = new Error('A IA não conseguiu montar nenhuma cena válida pra este tema após 2 tentativas.');
        err.code = 'GENERATION_FAILED';
        throw err;
    }

    const projectName = typeof raw.projectName === 'string' && raw.projectName.trim()
        ? raw.projectName.trim().slice(0, 60)
        : theme.slice(0, 60);
    const teacherDescription = typeof raw.teacherDescription === 'string' ? raw.teacherDescription.trim() : '';
    const assetGapNote = typeof raw.assetGapNote === 'string' && raw.assetGapNote.trim() ? raw.assetGapNote.trim() : null;

    return {
        projectName, teacherDescription, assetGapNote, plan,
        level: levelProfile.level, levelLabel: levelProfile.label,
        provider, model, warnings,
    };
}

module.exports = { generateActivityPlan };
