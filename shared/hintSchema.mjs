/**
 * shared/hintSchema.mjs
 *
 * Único lugar que enumera os valores válidos de `when.type` - contrato entre
 * três arquivos que antes mantinham cada um sua PRÓPRIA lista, sem nada
 * garantindo que concordassem (refatoração Fase 4):
 *  - backend/src/services/hintsGeneration.js#isHintValid - valida uma dica
 *    GERADA pela LLM contra o manifesto real do projeto-exemplo;
 *  - src/app/src/editor/ui/HintEngine.js#hintConditionHolds - avalia se a
 *    condição de uma dica já existente (LLM ou manual) está batendo AGORA
 *    no projeto do aluno;
 *  - src/app/src/editor/ui/AssignmentAuthorBar.js#HINT_WHEN_LABELS - rotula
 *    cada tipo na tela de revisão do professor.
 * Hoje os três concordam (checado manualmente nesta refatoração), mas nada
 * impedia um `when.type` novo ser adicionado em só um lugar e os outros dois
 * ficarem pra trás EM SILÊNCIO - a dica nunca apareceria pro aluno, ou nunca
 * seria rotulada certo pro professor, sem erro nenhum pra avisar.
 *
 * LLM_WHEN_TYPES: os tipos que uma dica GERADA pela LLM pode legitimamente
 * carregar (ver SYSTEM_PROMPT em hintsGeneration.js) - isHintValid() rejeita
 * qualquer outro. A LLM nunca pode emitir MANUAL_WHEN_TYPE.
 *
 * ALL_WHEN_TYPES: LLM_WHEN_TYPES + MANUAL_WHEN_TYPE - todo tipo que o lado
 * do ALUNO (HintEngine.js#hintConditionHolds) precisa saber avaliar,
 * incluindo dicas escritas à mão pelo professor na tela de revisão
 * (AssignmentAuthorBar.js#_showHintReview addBtn), que nunca passam por
 * isHintValid - não vêm da LLM, não tem o que validar contra o manifesto,
 * ficam disponíveis pro aluno até ele mesmo fechar.
 */

export const LLM_WHEN_TYPES = Object.freeze([
    'scene_missing',
    'character_missing',
    'character_no_script',
    'character_missing_block_type',
    'message_not_received',
    'default_character_present',
    'mission_intro',
]);

export const MANUAL_WHEN_TYPE = 'manual';

export const ALL_WHEN_TYPES = Object.freeze([...LLM_WHEN_TYPES, MANUAL_WHEN_TYPE]);

/**
 * Campos de `when` por tipo (documentação - nenhum destes objetos é usado em
 * runtime, só pra quem for ler/alterar isHintValid ou hintConditionHolds
 * entender o contrato sem precisar ler os dois arquivos lado a lado):
 *
 * scene_missing:                {type, sceneMd5, sceneOccurrence}
 * character_missing:             {type, sceneMd5, sceneOccurrence, characterMd5,
 *                                  characterOccurrence?: number}
 * character_no_script:           {type, sceneMd5, sceneOccurrence, characterMd5,
 *                                  characterOccurrence?: number}
 * character_missing_block_type:  {type, sceneMd5, sceneOccurrence, characterMd5,
 *                                  characterOccurrence?: number,
 *                                  blockTypes: string[], blockArgs?: {[blockType]: number},
 *                                  minCounts?: {[blockType]: number}, trigger?: string,
 *                                  triggerArg?: string, triggerExclusive?: true}
 *                                 - blockArgs/minCounts/trigger/triggerArg/triggerExclusive
 *                                   são preenchidos por CÓDIGO depois da LLM gerar a dica
 *                                   (fillBlockArgs/fillBlockContext em hintsGeneration.js),
 *                                   nunca confiados ao texto que a LLM devolve.
 *                                 - triggerArg (Fase 2, falha F8): só com trigger
 *                                   'onmessage' - o NOME da mensagem do script do professor
 *                                   (manifesto: scripts[].triggerArg). O bloco só conta sob
 *                                   "quando receber ESSA mensagem"; minCounts e
 *                                   triggerExclusive também são por (gatilho, mensagem).
 *                                   Ausente (dica legada, ou onmessage do professor sem
 *                                   mensagem escolhida - o 'null' literal do editor) =
 *                                   qualquer onmessage serve.
 *
 * characterOccurrence (Fase 2, falha F9) - 1-based, qual CÓPIA do personagem
 *   (mesmo characterMd5) na cena, na ordem de page.sprites - mesma ideia de
 *   sceneOccurrence, um nível abaixo (manifesto: characters[].characterOccurrence).
 *   O gerador (fillCharacterOccurrence em hintsGeneration.js) só grava quando a
 *   cena do PROFESSOR tem cópias repetidas daquele personagem; senão o campo não
 *   existe. Ausente = regra "qualquer cópia" no cliente (HintEngine.js#candidatesFor):
 *   a dica conta como feita se QUALQUER cópia a satisfaz, pendente se nenhuma.
 *   character_missing com characterOccurrence N = pendente enquanto o aluno não
 *   tem N cópias. Nunca usado em default_character_present.
 * message_not_received:          {type, messageName}
 * default_character_present:     {type, sceneMd5, sceneOccurrence, characterMd5: 'HY-Ruby.svg'}
 * mission_intro:                 {type} - sem cena/personagem, sempre o 1º hint do array,
 *                                  nunca vem da LLM (montado em código - buildIntroHint).
 * manual:                        {type} - sem cena/personagem/bloco, escrito à mão pelo
 *                                  professor, nunca checado automaticamente.
 */
