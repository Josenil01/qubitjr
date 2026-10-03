import {defineConfig} from 'vitest/config';

/**
 * Config mínima pro teste de unidade de módulos puros do frontend
 * (src/app/src/**\/*.test.js) - refatoração Fase 0 (ver CLAUDE.md/plano de
 * refatoração do sistema de dicas). Ambiente 'node' (sem jsdom) de propósito:
 * os primeiros módulos extraídos pra teste (HintEngine.js) são puros, sem
 * DOM/window - não precisam de um ambiente de browser simulado. Quando um
 * módulo testado precisar de DOM, mude esse arquivo (ou use um comentário
 * `// @vitest-environment jsdom` por arquivo de teste) em vez de pagar o
 * custo do jsdom pra todo teste.
 */
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/app/src/**/*.test.js'],
        // O pool default ('forks') trava ao iniciar o worker neste ambiente
        // sandboxed (timeout esperando o processo filho responder) - 'threads'
        // funciona normalmente aqui. Sem relação com os testes em si.
        pool: 'threads',
    },
});
