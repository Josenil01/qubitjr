'use strict';

/**
 * llmProvider.js
 *
 * Ponto único de configuração de "qual modelo gera a atividade a partir do
 * tema" (decisão do usuário: um único modelo cuida de atividade+descrição+
 * dicas, mas configurável, não fixo em código). Abstrai DeepSeek
 * (OpenAI-compatible, mesmo provedor já usado em hintsGeneration.js) e Claude
 * (Anthropic SDK) atrás de uma única função, callLLM(), que devolve o texto
 * bruto da resposta.
 *
 * Escolha de provedor/modelo via env var (ACTIVITY_GENERATION_PROVIDER=
 * deepseek|anthropic, ACTIVITY_GENERATION_MODEL opcional pra sobrescrever o
 * default de cada provedor) - ver backend/.env.example.
 *
 * Deliberadamente SEPARADO do getClient()/DEEPSEEK_MODEL fixos dentro de
 * hintsGeneration.js: aquele caminho continua intocado para quem já chama
 * generateHints() sem provider (routes/assignments.js, fluxo já validado em
 * produção pro professor que monta o projeto à mão). Este módulo só entra em
 * jogo pra quem passar um provider explicitamente (a nova geração por tema em
 * routes/share.js, e generateHintsWithProvider() em hintsGeneration.js).
 */

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// Mesma observação de hintsGeneration.js: 'deepseek-flash' é o nome atual
// (V4.1 Flash) do modelo antes chamado 'deepseek-chat' (alias legado).
const DEFAULT_MODELS = {
    deepseek: 'deepseek-flash',
    // Modelo de propósito geral mais capaz da Anthropic no momento - ver
    // claude-api skill. Sobrescrevível via ACTIVITY_GENERATION_MODEL se um
    // modelo mais barato (ex.: claude-sonnet-5/claude-haiku-4-5) bastar.
    anthropic: 'claude-opus-5',
};

/**
 * @returns {{provider: 'deepseek'|'anthropic', model: string}} configuração
 *   default lida do ambiente - usada quando o chamador não força um provider
 *   próprio.
 */
function getProviderConfig() {
    const provider = (process.env.ACTIVITY_GENERATION_PROVIDER || 'deepseek').toLowerCase();
    const resolvedProvider = provider === 'anthropic' ? 'anthropic' : 'deepseek';
    const model = process.env.ACTIVITY_GENERATION_MODEL || DEFAULT_MODELS[resolvedProvider];
    return { provider: resolvedProvider, model };
}

function missingKeyError(varName) {
    const err = new Error(varName + ' não configurada - geração por IA indisponível.');
    err.code = 'NOT_CONFIGURED';
    return err;
}

async function callDeepSeek(model, systemPrompt, userMessage, temperature) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw missingKeyError('DEEPSEEK_API_KEY');

    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const completion = await client.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        temperature,
    });
    return completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content;
}

async function callAnthropic(model, systemPrompt, userMessage) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw missingKeyError('ANTHROPIC_API_KEY');

    // Lazy require - só quem realmente escolher provider=anthropic paga o
    // custo de carregar o SDK (mesmo espírito do getClient() lazy em
    // hintsGeneration.js).
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
    });
    const textBlock = (response.content || []).find((block) => block.type === 'text');
    return textBlock ? textBlock.text : '';
}

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userMessage
 * @param {number} [opts.temperature=0.7] - ignorado pelo provider anthropic
 *   (Claude não usa temperature da mesma forma / recomenda-se depender de
 *   effort+thinking - ver claude-api skill), respeitado pelo deepseek.
 * @param {'deepseek'|'anthropic'} [opts.provider] - força um provider
 *   específico, ignorando ACTIVITY_GENERATION_PROVIDER. Usado por
 *   generateHintsWithProvider() pra repassar a MESMA escolha feita pra
 *   geração da atividade.
 * @param {string} [opts.model] - força um modelo específico, ignorando
 *   ACTIVITY_GENERATION_MODEL/o default do provider.
 * @returns {Promise<string>} texto bruto da resposta (ainda não parseado).
 * @throws com err.code === 'NOT_CONFIGURED' quando a chave do provider
 *   escolhido não está definida.
 */
async function callLLM({ systemPrompt, userMessage, temperature = 0.7, provider, model }) {
    const defaults = getProviderConfig();
    const useProvider = provider || defaults.provider;
    const useModel = model || (provider ? DEFAULT_MODELS[provider] : defaults.model);

    if (useProvider === 'anthropic') {
        return callAnthropic(useModel, systemPrompt, userMessage);
    }
    return callDeepSeek(useModel, systemPrompt, userMessage, temperature);
}

module.exports = { callLLM, getProviderConfig };
