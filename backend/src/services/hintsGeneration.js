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
 * generateHints(projectJson, hintContext) does, in order:
 *   1. computeDetailedManifest(projectJson) - see detailedManifest.js.
 *   2. Turn that into a human/LLM-readable transcript string, in build order.
 *   3. Ask DeepSeek (OpenAI-compatible `openai` SDK, baseURL pointed at
 *      DeepSeek) for STRICT JSON: `{ hints: [{ text, when }, ...] }` - the
 *      user message is the transcript, optionally prefixed with a
 *      "CONTEXTO DO PROFESSOR" block when `hintContext` (teacher-authored
 *      free text, assignments.hint_context - see routes/assignments.js) is
 *      non-empty. Context is tone/intent only - see SYSTEM_PROMPT rule -
 *      technical identifiers still only ever come from the transcript.
 *   4. Parse the response (defensively stripping markdown fences).
 *   5. VALIDATE every hint against the actual manifest - this is the safety
 *      net against a hallucinated/malformed reference from the LLM. Never
 *      trust model output blindly: any hint whose `when` references a scene,
 *      character, or message that doesn't really exist in this project is
 *      dropped (logged via console.warn), never surfaced to the teacher.
 *   5.5. fillBlockArgs() then fillMissingCharacterAddedHints() then
 *      fillMissingDefaultCharacterHints() - three SAFETY NETS:
 *      fillBlockArgs() OVERWRITES when.blockArgs on every
 *      character_missing_block_type hint with the exact numeric argument
 *      (forward steps, wait time, setspeed value, etc.) the teacher's own
 *      character really uses - never trusted from the LLM, always derived
 *      from the manifest (except "say", whose text may always differ - see
 *      that function's docblock); fillMissingCharacterAddedHints() guarantees
 *      a character_missing hint exists before any behavior hint
 *      (character_no_script/character_missing_block_type) for that same
 *      character; fillMissingDefaultCharacterHints() injects
 *      default_character_present for any scene lacking Ruby. The latter two
 *      cover cases where the LLM's own "OBRIGATÓRIO" prompt rule was
 *      ignored - see each function's docblock.
 *   6. Assign surviving hints sequential ids (h1, h2, ...) in final order.
 *
 * Scenes/characters with a null md5 (nothing stable to reference them by -
 * see detailedManifest.js) are skipped entirely from the transcript, and any
 * hint referencing one is therefore rejected by the validation step too,
 * since it can never appear in the "real identifiers" sets built from the
 * manifest.
 *
 * Sem limite de quantidade de dicas (removido 2026-09 - projetos grandes
 * como "Lendas Brasileiras", 4 cenas/9 personagens, perdiam a última cena
 * inteira cortada por um teto fixo de 8). isHintValid() continua sendo a
 * única defesa real contra lixo/alucinação da LLM - a quantidade em si não
 * é mais limitada artificialmente.
 *
 * Cenas repetidas (mesmo sceneMd5 usado em mais de uma página, ex.: a
 * história volta pro "Bosque" depois de já ter passado por ele) são
 * distinguidas via `sceneOccurrence` (1ª vez, 2ª vez, ...) em todo `when`
 * com escopo de cena - ver detailedManifest.js. Sem isso, duas dicas sobre
 * o MESMO fundo eram indistinguíveis pro lado do aluno (AssignmentBadge.js):
 * assim que a 1ª cena daquele fundo existisse, as duas eram dadas como
 * resolvidas, e "adicionar mais uma cena com este fundo" nunca virava uma
 * tarefa própria.
 *
 * O nome do fundo mostrado pro aluno na tela (ex.: "Bosque" pro asset
 * Woods.svg) vem de src/app/localizations/pt.json - sem isso, a LLM só via
 * o nome de arquivo em inglês e tinha que adivinhar/traduzir uma descrição
 * (já visto inventando "floresta" pra Woods.svg, quando o nome real
 * exibido é "Bosque") - ver loadBackgroundDisplayNames().
 *
 * Nomes de personagem repetidos (ex.: a mesma "Casa" reaparecendo em duas
 * cenas diferentes, cada instância com seu próprio characterMd5+sceneMd5+
 * sceneOccurrence - já distintos o suficiente pro `when`, mas indistinguíveis
 * pro ALUNO lendo o texto da dica) ganham numeração no texto ("Casa 1",
 * "Casa 2", ...) - ver numberFor() dentro de buildTranscript(). Só nomes que
 * realmente se repetem (2+) são numerados; um nome único nunca ganha número.
 *
 * Fase 2 do sistema de dicas (falhas F8/F9/F10):
 *  - F8: o manifesto detalhado agora guarda `triggerArg` (nome da mensagem)
 *    por script; fillBlockContext() conta ocorrências/minCounts/
 *    triggerExclusive por (gatilho, MENSAGEM) e grava when.triggerArg quando
 *    when.trigger === 'onmessage' - sem isso um minCounts podia somar blocos
 *    de dois onmessage diferentes e gerar uma dica impossível.
 *  - F9: personagem com CÓPIAS na mesma cena (mesmo md5 duas vezes) -
 *    fillCharacterOccurrence() grava when.characterOccurrence (1-based) só
 *    quando o professor tem cópias; todo o resto (validação, blockArgs,
 *    blockContext, character_missing de reserva) passa a olhar a cópia certa.
 *  - F10: blocos soltos (script sem gatilho) não existem pro manifesto (ver
 *    shared/detailedManifest.mjs), então também nunca viram dica aqui.
 *
 * Fase 3 do sistema de dicas (E6b - alinhamento posição a posição):
 *  - o transcript ganha, abaixo de cada personagem com script, uma linha
 *    NUMERADA por script ("S1 (onflag): #1 forward[3] #2 repeat[2] {
 *    #3 hop[1] #4 }") - ver formatNumberedScript; "#N" = índice N-1 em
 *    when.expected.script.
 *  - a LLM devolve só PONTEIROS (when.scriptRef + when.blockIndices); o
 *    código monta when.expected = {trigger, triggerArg, script, covered,
 *    occurrence?} a partir do projeto, com fallback por tipos quando os
 *    ponteiros faltam/são inválidos, e valida que toda dica com expected dá
 *    'done' no PRÓPRIO projeto do professor - ver buildExpectedForHints
 *    (também usada pela migração das dicas já salvas). Os campos legados
 *    continuam gravados, coerentes com expected.
 *
 * Personagem default (achado em teste real - nenhuma dica nunca mandava
 * remover a Ruby que sobra): toda página em branco no ScratchJr cria
 * automaticamente um personagem com o asset de ScratchJr.defaultSprite
 * (ver Page.js#emptyPage/createCat, UI.js#mascotData, settings.json -
 * "HY-Ruby.svg" hoje) - inclusive toda vez que o aluno clica em "+ nova
 * cena", não só na primeira página do projeto. Se a cena de referência do
 * professor não usa esse personagem ali, o aluno acumula uma Ruby indesejada
 * por cena sem nenhuma orientação pra removê-la. O novo when.type
 * "default_character_present" cobre isso - ver DEFAULT_CHARACTER_MD5,
 * fillMissingDefaultCharacterHints() (rede de segurança em código, não só a
 * regra "OBRIGATÓRIO" do prompt - mesma lição aprendida com scene_missing:
 * uma regra só no prompt já foi ignorada pela LLM antes).
 */

const fs = require('fs');
const path = require('path');
const { computeDetailedManifest, toExpectedTokens, REPEAT_CLOSE } = require('./detailedManifest');
const { evaluateExpectedHints } = require('./hintAlignment');
const { callLLM } = require('./llmProvider');
const { LLM_WHEN_TYPES } = require('../../../shared/hintSchema.mjs');

// Achado em teste real (aviso oficial da DeepSeek, set/2026) - 'deepseek-chat'
// é um alias LEGADO (mapeia pra V4-Flash desde 24/04/2026) que a própria
// DeepSeek já tinha sinalizado pra aposentar em 24/07/2026 - continuava
// respondendo até aqui, mas sem garantia de suporte contínuo. 'deepseek-flash'
// é o nome atual e oficial do mesmo nível (V4.1 Flash, lançado 10/09/2026,
// é pra onde inclusive o tráfego do V4 Pro passa a ir a partir de 14/09/2026)
// - ver https://api-docs.deepseek.com/updates/. Testado ao vivo com a API
// real antes de trocar.
const DEEPSEEK_MODEL = 'deepseek-flash';

/**
 * The only `when.type` values a hint is allowed to carry - anything else is
 * dropped. Fonte única em shared/hintSchema.mjs (refatoração Fase 4) - ver
 * aquele arquivo pro racional completo e pra lista irmã (ALL_WHEN_TYPES) que
 * o lado do aluno (HintEngine.js) usa.
 */
const VALID_WHEN_TYPES = new Set(LLM_WHEN_TYPES);

// ScratchJr.defaultSprite (settings.json) - o personagem que toda página em
// branco cria sozinha (ver docblock do topo). "default_character_present"
// só existe pra ELE, nunca pra outro characterMd5 - ver isHintValid.
const DEFAULT_CHARACTER_MD5 = 'HY-Ruby.svg';

// backend/src/services/ -> raiz do repo -> src/app/localizations/pt.json.
// Mesmo arquivo que o frontend usa pra rotular fundos na tela (BACKGROUND_*)
// - carregado uma vez e cacheado; nunca deve derrubar a geração de dicas se
// faltar/estiver corrompido, só degrada pra não anotar nome nenhum.
const PT_LOCALIZATION_PATH = path.join(__dirname, '../../../src/app/localizations/pt.json');
let _backgroundDisplayNames = null;

function loadBackgroundDisplayNames() {
    if (_backgroundDisplayNames) return _backgroundDisplayNames;
    _backgroundDisplayNames = {};
    try {
        const raw = fs.readFileSync(PT_LOCALIZATION_PATH, 'utf8');
        const strings = JSON.parse(raw);
        for (const key of Object.keys(strings)) {
            if (key.startsWith('BACKGROUND_')) {
                _backgroundDisplayNames[key.slice('BACKGROUND_'.length)] = strings[key];
            }
        }
    } catch (err) {
        console.warn('[hintsGeneration] Falha ao carregar nomes de fundo de', PT_LOCALIZATION_PATH, '- dicas de cena vão usar só o nome do arquivo:', err.message);
    }
    return _backgroundDisplayNames;
}

/**
 * Nome exibido pro aluno na tela pro fundo `sceneMd5` (ex.: "Bosque" pra
 * "Woods.svg"), ou null se não houver entrada de localização pra ele
 * (fundo customizado/enviado pelo próprio professor, por exemplo) - nesse
 * caso o transcript simplesmente omite a anotação de nome, sem inventar nada.
 */
function getBackgroundDisplayName(sceneMd5) {
    return loadBackgroundDisplayNames()[sceneMd5] || null;
}

const SYSTEM_PROMPT = `Você é um coach amigável para crianças de 6 a 8 anos que estão aprendendo a programar no ScratchJr.

Você vai receber uma transcrição de um projeto de referência já completo, feito pelo professor, descrito cena por cena e personagem por personagem, NA ORDEM em que foram construídos. Sua tarefa é identificar os passos de construção mais importantes desse projeto e transformá-los em dicas curtas de coaching para uma criança que está construindo a própria versão desse projeto.

Regras de tom:
- Seja sempre caloroso e encorajador, nunca repreenda e nunca diga "errado" ou "faltou".
- Frases CURTAS e diretas, como se estivesse falando com a criança ao vivo, não escrevendo um manual - de preferência COMANDOS simples ("Apague a Ruby.", "Coloque o Allan aqui."), não rodeios. Varie a construção entre as dicas - nem toda dica precisa começar com "Que tal..."; use também formas como "Agora...", "Vamos...", perguntas diretas ("Você consegue...?"), etc.
- PALAVRAS: pra pedir que a criança ponha um personagem/cenário na tela use SEMPRE "coloque"/"colocar" - NUNCA "adicione"/"adicionar". Pra falar do bloco de bandeira verde, diga "quando a bandeira verde for clicada" (nunca "tocada").
- PROIBIDO usar travessão (— ou –) em QUALQUER texto que você escrever (dicas e "intro"). Se precisar separar duas ideias, use ponto final, vírgula ou faça duas frases curtas.
- SEMPRE que a transcrição der um nome ao personagem (ex.: "Ruby", "Allan"), use esse nome na dica - nunca diga "o personagem" ou "esse personagem" genericamente quando um nome estiver disponível. Depois da primeira menção a um personagem numa dica, pode usar pronome (ele/ela) se ficar natural.
- Preste atenção às linhas "➡️ TROCA DE CENA - saem: ...; entram: ..." entre duas cenas - quando isso acontecer, a dica sobre adicionar o personagem novo deve mencionar a troca de forma natural (ex.: "Agora troque a Ruby pelo Allan aqui" ou "Nessa cena é a vez do Allan"), em vez de simplesmente ignorar que o personagem anterior sumiu.
- Cada linha relevante da transcrição vem numerada "PASSO N" (contador único, contínuo do início ao fim, nunca reinicia por cena) - gere as dicas RESPEITANDO ESSA ORDEM, na mesma sequência dos números, mesmo que agrupar de outro jeito pareça mais natural. As linhas "➡️ TROCA DE CENA" não têm PASSO (são só uma transição) e não geram dica própria.
- Quando um personagem tiver um bloco "say" com texto real na transcrição (ex.: say["Olá, primavera!"]), a dica sobre esse personagem falar algo deve sugerir ESSA fala exata (ex.: "Que tal fazer a Ruby dizer 'Olá, primavera!'?"), não uma fala genérica inventada - é a fala que o professor realmente usou no exemplo.
- OBRIGATÓRIO: gere uma dica "scene_missing" pra CADA cena da transcrição, sem exceção (inclusive a primeira, e inclusive quando o mesmo fundo já apareceu antes em outra cena - ver regra de "sceneOccurrence" abaixo) - nunca pule direto pras dicas de personagem de uma cena sem antes ter uma dica pedindo pra trocar/escolher aquele cenário. Coloque a dica "scene_missing" de uma cena SEMPRE antes das dicas dos personagens daquela mesma cena na lista.
- Não existe limite de quantidade de dicas - gere uma pra cada passo de construção realmente relevante da transcrição inteira, mesmo que o projeto seja grande. Não corte cenas nem personagens pra caber num teto.
- Dica "scene_missing" da PRIMEIRA cena da transcrição (Cena 1): o projeto do aluno já nasce com uma página aberta, então NÃO fale em página nova - seja o mais CURTA possível, só o cenário: "Que tal colocar o cenário da Primavera?". Toda dica "scene_missing" das cenas SEGUINTES é sobre CRIAR UMA PÁGINA NOVA (o aluno toca no "+" da faixa de páginas - é assim que a própria interface do ScratchJr chama essa ação) - "cenário"/"fundo" é só o QUE fica dentro dela, não a ação em si. NUNCA use verbos de "mudar"/"trocar" pro cenário ("vamos mudar pro cenário X?", "troque pro cenário X"), que soam como se já existisse uma cena aberta esperando ser alterada. Nomeie as duas coisas juntas: "Crie uma página nova com o cenário X", "Toque no + e escolha o cenário X". Quando uma cena reusa um fundo que já apareceu antes (a transcrição anota isso, ver "REGRA DE CENA REPETIDA" abaixo), ainda é uma página nova, mas a dica deve soar como um retorno da história pra esse cenário, não como a primeira vez (ex.: "Vamos voltar pro bosque agora? Crie outra página com esse cenário.", "De novo no bosque, mais uma página com esse fundo"), nunca repetindo o mesmo texto de quando ele apareceu a primeira vez.
- Quando o nome de um personagem vier seguido de um número (ex.: "Casa 2" em vez de só "Casa" - acontece quando o MESMO nome se repete em mais de uma instância no projeto inteiro, ver "REGRA DE NOME REPETIDO" abaixo), use o nome JUNTO com esse número no texto da dica (ex.: "coloque a Casa 2 aqui"), nunca omita o número - é o que diferencia essa instância das outras com o mesmo nome pro aluno.
- OBRIGATÓRIO: pra CADA cena da transcrição que NÃO tiver a Ruby (HY-Ruby.svg) na lista de personagens dela, gere também uma dica "default_character_present" pra essa cena (ver formato abaixo) - a Ruby aparece sozinha em toda cena nova que o aluno criar, então ele precisa ser lembrado de apagá-la quando ela não faz parte do projeto de verdade ali. O texto dessa dica é um COMANDO direto e curto, sem explicação: "Apague a Ruby." (numa cena que reaparece, "Apague a Ruby de novo aqui."). Coloque essa dica logo depois da dica "scene_missing" daquela cena, antes das dicas dos personagens de verdade. NUNCA gere essa dica pra uma cena que TEM a Ruby na lista de personagens - lá ela faz parte do projeto de verdade.
- OBRIGATÓRIO: "colocar um personagem" e "dar um comportamento a ele" (falar/andar/etc.) são SEMPRE dicas SEPARADAS, nunca uma só combinando os dois. Pra CADA personagem com script (que vai gerar uma dica "character_no_script" ou "character_missing_block_type"), gere TAMBÉM uma dica "character_missing" própria pra ele, ANTES da(s) dica(s) de comportamento - nunca pule direto pro "faça o Allan dizer algo" sem antes ter uma dica só de "coloque o Allan". EXCEÇÃO: nunca gere "character_missing" pra Ruby (HY-Ruby.svg) - ela já é criada automaticamente em toda página nova (é o personagem default do ScratchJr), então "colocá-la" nunca é um passo real pro aluno; ele já a encontra lá. Quando a Ruby faz parte do projeto de verdade numa cena, vá direto pras dicas de comportamento dela (character_no_script/character_missing_block_type), sem uma character_missing antes.
- OBRIGATÓRIO: UMA AÇÃO POR DICA. Quando a "sequência" de um personagem tiver mais de uma ação (falar, andar, esperar, repetir, mudar a velocidade...), NUNCA junte tudo numa dica só - quebre em VÁRIAS dicas "character_missing_block_type", uma por ação, na ordem real da sequência, cada uma com SÓ os blockTypes daquela ação (setspeed pode ir junto do movimento que ele acompanha; um repeat vai junto do bloco que ele repete). A PRIMEIRA dica do personagem carrega o gatilho ("...quando a bandeira verde for clicada"); as seguintes começam ligando à anterior ("Depois que ela falar, ...", "Agora faça ela..."). Exemplo - sequência onflag → say["Chegou a primavera!"] → repeat[3] → hop[2] da Borboleta vira DUAS dicas: "Faça a Borboleta dizer 'Chegou a primavera!' quando a bandeira verde for clicada." (blockTypes ["say"]) e "Depois que ela falar, faça ela pular 2 passos, 3 vezes, usando o bloco de repita." (blockTypes ["repeat","hop"]). Cada dica: UMA frase curta que uma criança de 6 anos lê de uma vez.
- OBRIGATÓRIO: quando a "sequência" de um personagem mostrar um bloco com um valor entre colchetes que NÃO seja "say" (ex.: "forward[3]", "wait[10]", "repeat[4]", "setspeed[normal]"), o TEXTO da dica precisa mencionar esse valor explicitamente - NUNCA deixe implícito ("faça o Carro andar pra frente" sem dizer quanto), ou o aluno fica em tentativa e erro sem saber o número certo. "say" é a ÚNICA exceção - a fala pode ser sugerida (ver regra acima) mas o aluno pode escrever qualquer coisa, então não precisa de um número. Guia de como mencionar cada valor no texto: forward/back/up/down/left/right/hop → "ande/vá N passos" (o número entre colchetes é a quantidade de passos); repeat → "N vezes, usando o bloco de repita" (ex.: "faça ela pular 3 vezes usando o bloco de repita"); setspeed → use a palavra que já vem pronta entre colchetes ("lenta"/"normal"/"rápida"), ex. "com uma velocidade normal"; wait → decisão explícita do usuário, use SEMPRE a frase exata "use o bloco de espere com o valor de N" pra mencionar esse bloco (NUNCA "bloco de tempo", NUNCA a forma antiga "esperar até aparecer o número N no bloco") - o wait é a sua PRÓPRIA dica (ver "UMA AÇÃO POR DICA"), na posição real dele na sequência: "Na [Personagem] use o bloco de espere com o valor de N." (blockTypes ["wait"]), e a ação vizinha vira outra dica ("Depois, faça ela dizer '...'."). grow/shrink (sem um jeito natural de nomear a unidade) → "aperte o bloco até aparecer o número N", ex. "aperte o bloco até aparecer o número 5 pra crescer". Exemplos: sequência "forward[3]" → "Faça o Carro andar 3 passos pra frente."; sequência "wait[60] → say[\"Vamos ué!\"]" da Tartaruga → DUAS dicas: "Na Tartaruga use o bloco de espere com o valor de 60." e "Depois faça ela dizer 'Vamos ué!'.". Não existe um campo separado no JSON pra esse valor (ver "character_missing_block_type" abaixo) - é só o texto que precisa mencionar.
- As dicas devem estar em português do Brasil (pt-BR).
- Se a mensagem trouxer um bloco "CONTEXTO DO PROFESSOR" antes da transcrição, use-o pra entender melhor o TEMA/INTENÇÃO do projeto (ex.: é sobre folclore brasileiro, cada cena é uma casa diferente, etc.) e deixar o texto das dicas mais alinhado com isso. Esse contexto é só pra tom/entendimento - os identificadores técnicos (sceneMd5/characterMd5/messageName/sceneOccurrence) e os fatos sobre o que existe no projeto continuam vindo EXCLUSIVAMENTE da transcrição estruturada, nunca do contexto livre (que pode estar incompleto ou desatualizado).

Regras de formato - responda APENAS com um JSON estrito, sem crases/markdown, sem nenhum texto fora do JSON, exatamente neste formato:

{"intro": "...", "hints": [{"text": "...", "when": {"type": "...", ...campos...}}, ...]}

"intro" é a PRIMEIRA mensagem que a criança vê ao abrir a missão: uma CHAMADA PARA AÇÃO curta (1 ou 2 frases, no máximo 160 caracteres), começando com um emoji, baseada no NOME DA ATIVIDADE e no CONTEXTO DO PROFESSOR (quando vierem na mensagem) - convide a criança a começar a criar, falando do tema em palavras simples, sem copiar o contexto inteiro e sem citar nomes de arquivos. Ex.: "🚀 Vamos criar uma história sobre a chegada da primavera com a Borboleta e o Coelho?". Se não vier nome nem contexto, omita o campo "intro".

ATENÇÃO - erro comum a evitar: cada personagem na transcrição aparece como \`"Nome" [characterMd5: valor.svg]\`. "Nome" é só pra você usar no TEXTO da dica (pra soar natural, "a Ruby precisa..."). "characterMd5" é um IDENTIFICADOR TÉCNICO que você deve copiar EXATAMENTE (incluindo a extensão .svg) pro campo "characterMd5" do "when" - NUNCA coloque o nome ali. O mesmo vale pra "sceneMd5" (copie o valor depois de "fundo:", tipo "Spring.svg") e "messageName" (copie o valor exato entre colchetes de message[...]/onmessage[...]).

REGRA DE NOME DE CENA: quando a linha da cena trouxer \`nome exibido ao aluno: "X"\`, use EXATAMENTE esse nome X no texto da dica (é o nome que o aluno vê na tela pra escolher aquele fundo) - nunca traduza ou invente uma palavra diferente a partir do nome do arquivo (sceneMd5). Se essa anotação não aparecer pra uma cena, não há nome oficial conhecido; descreva o cenário de forma genérica sem inventar um nome específico.

REGRA DE CENA REPETIDA: cada cena na transcrição também traz um número de ocorrência entre colchetes, tipo \`[sceneOccurrence: 2]\` - é 1 na primeira vez que aquele fundo aparece no projeto, 2 se for a segunda cena a reusar o MESMO fundo, etc. Copie esse número EXATAMENTE pro campo "sceneOccurrence" de todo "when" com escopo de cena (scene_missing, character_missing, character_no_script, character_missing_block_type, default_character_present) - mesmo quando for 1. Isso é o que permite duas dicas sobre o mesmo fundo (a cena aparecendo de novo mais adiante na história) serem tratadas como passos DIFERENTES e não uma só.

REGRA DE PERSONAGEM REPETIDO NA CENA: quando a MESMA cena tem mais de uma cópia do mesmo personagem (mesmo characterMd5), cada cópia vem com um número de cópia entre colchetes, tipo \`[characterMd5: HY-Ruby.svg] [characterOccurrence: 2]\` - copie esse número EXATAMENTE pro campo "characterOccurrence" do "when" de toda dica sobre aquela cópia (character_missing, character_no_script, character_missing_block_type). Quando a anotação não aparecer, NÃO inclua o campo.

REGRA DE NOME REPETIDO: quando o MESMO nome de personagem aparece em mais de uma instância no projeto inteiro (ex.: a mesma "Casa" numa cena e de novo em outra), cada instância aparece na transcrição com um número junto do nome, tipo \`"Casa 2" [characterMd5: ...]\` - use o nome JUNTO com esse número no texto da dica (ver regra de tom acima). Um nome que aparece só uma vez no projeto NUNCA vem com número - não invente um.

REGRA DE SCRIPTS NUMERADOS: logo abaixo da linha de um personagem com script vem UMA linha por script dele, tipo \`S2 (onmessage["azul"]): #1 forward[3] #2 repeat[2] { #3 hop[1] #4 } #5 say["Oi"]\` - "S2" identifica o script (o gatilho vem entre parênteses) e cada "#N" numera um bloco desse script, na ordem. Um repita aparece como "repeat[N] {", os blocos de dentro dele, e "}" (o fim do repita, que também ganha um número só pra contagem não pular). Em TODA dica "character_missing_block_type", inclua no "when": "scriptRef" com o rótulo do script onde estão os blocos que a dica ensina (ex.: "S1"), e "blockIndices" com os números #N EXATOS dos blocos que ESTA dica ensina, desse mesmo script (ex.: [2, 3]). Cada número só pode aparecer em UMA dica - se o personagem tem dois "hop" e você gera duas dicas de pular, a primeira usa o número do 1º hop e a segunda o do 2º. Ao ensinar um repita, inclua o número do "repeat" e dos blocos de dentro que a dica ensina (o número do "}" nunca precisa entrar). Esses números são SÓ posições - nunca escreva valores (passos, tempo, velocidade) em nenhum campo do "when"; os valores são lidos do projeto por código.

Exemplo de transcrição de entrada e a saída correta correspondente:
Entrada:
  PASSO 1 - Cena 1 (fundo: Spring.svg, nome exibido ao aluno: "Primavera") [sceneOccurrence: 1]:
    PASSO 2 - "Ruby" [characterMd5: HY-Ruby.svg]: tem script (sequência: onflag → say["Olá, primavera!"])
      S1 (onflag): #1 say["Olá, primavera!"]
➡️ TROCA DE CENA - saem: "Ruby" [characterMd5: HY-Ruby.svg]. entram: "Allan" [characterMd5: HY-Allan.svg].
  PASSO 3 - Cena 2 (fundo: Summer.svg, nome exibido ao aluno: "Verão") [sceneOccurrence: 1]:
    PASSO 4 - "Allan" [characterMd5: HY-Allan.svg]: sem script ainda
➡️ TROCA DE CENA - saem: "Allan" [characterMd5: HY-Allan.svg]. entram: "Ruby" [characterMd5: HY-Ruby.svg].
  PASSO 5 - Cena 3 (fundo: Spring.svg, nome exibido ao aluno: "Primavera") [sceneOccurrence: 2]:
    PASSO 6 - "Ruby" [characterMd5: HY-Ruby.svg]: tem script (sequência: onflag → say["Voltei!"])
      S1 (onflag): #1 say["Voltei!"]
Saída correta pra essas três cenas (NESTA ORDEM, seguindo os números PASSO 1 a 6 - reparem que a dica de cena vem ANTES das dicas de personagem de cada cena, a fala sugerida é a MESMA que o exemplo já usa, o nome "Primavera" é usado literalmente como veio da transcrição, e a Cena 3 tem sceneOccurrence 2 e um texto que deixa claro que é um RETORNO, não a primeira vez):
  {"text": "Que tal colocar o cenário da Primavera?", "when": {"type": "scene_missing", "sceneMd5": "Spring.svg", "sceneOccurrence": 1}}
  {"text": "Agora faça a Ruby dizer 'Olá, primavera!' quando a bandeira verde for clicada.", "when": {"type": "character_missing_block_type", "sceneMd5": "Spring.svg", "sceneOccurrence": 1, "characterMd5": "HY-Ruby.svg", "blockTypes": ["say"], "scriptRef": "S1", "blockIndices": [1]}}
  {"text": "Crie uma página nova com o cenário de Verão.", "when": {"type": "scene_missing", "sceneMd5": "Summer.svg", "sceneOccurrence": 1}}
  {"text": "Nessa cena é a vez do Allan. A Ruby não aparece mais aqui.", "when": {"type": "character_missing", "sceneMd5": "Summer.svg", "sceneOccurrence": 1, "characterMd5": "HY-Allan.svg"}}
  {"text": "Vamos voltar pra Primavera de novo?", "when": {"type": "scene_missing", "sceneMd5": "Spring.svg", "sceneOccurrence": 2}}
  {"text": "Dessa vez a Ruby diz 'Voltei!'. Pode fazer ela falar isso?", "when": {"type": "character_missing_block_type", "sceneMd5": "Spring.svg", "sceneOccurrence": 2, "characterMd5": "HY-Ruby.svg", "blockTypes": ["say"], "scriptRef": "S1", "blockIndices": [1]}}

O campo "when.type" deve ser exatamente um destes valores, com exatamente estes campos (usando SOMENTE os identificadores sceneMd5/characterMd5/messageName/sceneOccurrence que aparecem literalmente na transcrição recebida, sempre copiados por extenso incluindo extensão de arquivo quando houver - nunca invente um valor que não esteja lá, e nunca substitua um identificador pelo nome do personagem):
- "scene_missing": {"type":"scene_missing","sceneMd5":"<da transcrição>","sceneOccurrence":<da transcrição>}
- "character_missing": {"type":"character_missing","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"..."}
- "character_no_script": {"type":"character_no_script","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"..."}
- "character_missing_block_type": {"type":"character_missing_block_type","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"...","blockTypes":["wait","say"]} - blockTypes é a lista EXATA de tipos de bloco que essa dica pede - o aluno precisa colocar TODOS eles (não basta um só) pro personagem antes da dica ser considerada feita, então copie SOMENTE os tipos que aparecem de verdade na "sequência" da transcrição pra esse trecho, na mesma ordem. NUNCA liste um tipo que o personagem não usa de verdade (ex.: se a sequência mostra só "say", use ["say"]; se mostra "wait → say", use ["wait","say"]) - um tipo a mais deixaria a dica impossível de resolver. NÃO inclua um campo separado pro valor numérico do bloco (isso é calculado por código, não pela LLM) - em vez disso, siga a regra OBRIGATÓRIO abaixo sobre mencionar o valor no TEXTO da dica. Inclua SEMPRE também "scriptRef" e "blockIndices" (ver REGRA DE SCRIPTS NUMERADOS).
- "message_not_received": {"type":"message_not_received","messageName":"..."}
- "default_character_present": {"type":"default_character_present","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"HY-Ruby.svg"} - characterMd5 é SEMPRE "HY-Ruby.svg" pra este tipo (é o personagem default, nunca outro) - só gere pra cenas que NÃO têm a Ruby na lista de personagens (ver regra OBRIGATÓRIA acima).

Exemplo rápido de mencionar o valor exato de blocos numéricos no texto (sequência com "setspeed[normal]" e "forward[3]"):
Entrada (trecho):
  PASSO 1 - Cena 1 (fundo: City.svg, nome exibido ao aluno: "Cidade") [sceneOccurrence: 1]:
    PASSO 2 - "Carro" [characterMd5: HY-Carro.svg]: tem script (sequência: onflag → setspeed[normal] → forward[3])
      S1 (onflag): #1 setspeed[normal] #2 forward[3]
Saída correta (o texto menciona a velocidade E a quantidade de passos - nenhum campo extra no "when", só blockTypes com os tipos):
  {"text": "Que tal colocar o cenário da Cidade?", "when": {"type": "scene_missing", "sceneMd5": "City.svg", "sceneOccurrence": 1}}
  {"text": "Faça o Carro andar 3 passos pra frente com velocidade normal, quando a bandeira verde for clicada.", "when": {"type": "character_missing_block_type", "sceneMd5": "City.svg", "sceneOccurrence": 1, "characterMd5": "HY-Carro.svg", "blockTypes": ["setspeed", "forward"], "scriptRef": "S1", "blockIndices": [1, 2]}}

Exemplo rápido de "default_character_present" (cena SEM a Ruby na transcrição) e "REGRA DE NOME REPETIDO" (a mesma "Casa" reaparecendo):
Entrada (trecho):
  PASSO 1 - Cena 1 (fundo: Woods.svg, nome exibido ao aluno: "Bosque") [sceneOccurrence: 1]:
    PASSO 2 - "Lobisomem" [characterMd5: HY-Lobsomem.svg]: tem script (sequência: onflag → say["Au!"])
      S1 (onflag): #1 say["Au!"]
    PASSO 3 - "Casa 1" [characterMd5: HY-Casa2.svg]: sem script ainda
➡️ TROCA DE CENA - saem: "Lobisomem" [characterMd5: HY-Lobsomem.svg], "Casa 1" [characterMd5: HY-Casa2.svg].
  PASSO 4 - Cena 2 (fundo: Woods.svg, nome exibido ao aluno: "Bosque") [sceneOccurrence: 2]:
    PASSO 5 - "Casa 2" [characterMd5: HY-Casa2.svg]: sem script ainda
Saída correta (repare: dica default_character_present logo após scene_missing, ANTES das dicas de personagem; "Casa 1"/"Casa 2" usados com o número; a Ruby não aparece em nenhuma das duas cenas, então as duas ganham a dica; ordem segue PASSO 1 a 5):
  {"text": "Que tal colocar o cenário do Bosque?", "when": {"type": "scene_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 1}}
  {"text": "Apague a Ruby.", "when": {"type": "default_character_present", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Ruby.svg"}}
  {"text": "Faça o Lobisomem dizer 'Au!' quando a bandeira verde for clicada.", "when": {"type": "character_missing_block_type", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Lobsomem.svg", "blockTypes": ["say"], "scriptRef": "S1", "blockIndices": [1]}}
  {"text": "Agora coloque a Casa 1 no Bosque.", "when": {"type": "character_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Casa2.svg"}}
  {"text": "Vamos voltar pro Bosque de novo? Crie outra página com ele.", "when": {"type": "scene_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 2}}
  {"text": "Apague a Ruby de novo aqui.", "when": {"type": "default_character_present", "sceneMd5": "Woods.svg", "sceneOccurrence": 2, "characterMd5": "HY-Ruby.svg"}}
  {"text": "Agora coloque a Casa 2 aqui também.", "when": {"type": "character_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 2, "characterMd5": "HY-Casa2.svg"}}

Gere uma dica por passo de construção realmente relevante da transcrição INTEIRA, sem se preocupar com uma quantidade máxima. Ordene o array "hints" seguindo EXATAMENTE a ordem dos números "PASSO N" da transcrição - nunca embaralhe, agrupe fora de ordem, ou pule pra frente/volte atrás.`;

/**
 * Descreve um personagem pra LLM mostrando o NOME (entre aspas, quando
 * houver - ex. "Ruby") e o characterMd5 (entre colchetes, sempre) lado a
 * lado e claramente rotulados: '"Ruby" [characterMd5: HY-Ruby.svg]'. A
 * separação explícita existe porque, numa primeira versão sem essa
 * distinção clara, a LLM confundiu os dois e colocou o NOME no campo
 * characterMd5 do "when" (que a validação corretamente rejeitou, mas
 * descartou quase todo o lote de dicas útil junto) - ver SYSTEM_PROMPT
 * pro exemplo que reforça qual dos dois vai em cada lugar.
 *
 * `number`, quando passado (ver numberFor() em buildTranscript), vai colado
 * no nome ("Casa 2") - REGRA DE NOME REPETIDO no SYSTEM_PROMPT instrui a LLM
 * a usar esse número junto do nome no texto da dica, pra diferenciar essa
 * instância de outras com o mesmo nome no projeto (ver docblock do topo).
 */
function characterDescriptor(character, number, occurrence) {
    const namePart = character.characterName
        ? `"${character.characterName}${number ? ' ' + number : ''}" `
        : '';
    // occurrence só vem quando a cena tem cópias repetidas desse md5 (ver
    // buildTranscript e REGRA DE PERSONAGEM REPETIDO NA CENA no prompt).
    const occurrencePart = occurrence ? ` [characterOccurrence: ${occurrence}]` : '';
    return `${namePart}[characterMd5: ${character.characterMd5}]${occurrencePart}`;
}

/**
 * Renders one character's blockSequence (ver detailedManifest.js) como uma
 * única string "onflag → say[\"Oi\"] → forward → say[\"Tchau\"]" - a ORDEM
 * real do script, com repetições, não a lista deduplicada de blockTypes
 * (achado em teste real: dicas às vezes saíam fora de ordem porque a LLM só
 * via "quais tipos de bloco existem", nunca EM QUE ORDEM/quantas vezes). Sem
 * blockSequence (formato antigo do manifesto, hints salvos antes desta
 * mudança), cai pra montar a mesma coisa a partir de blockTypes/sayTexts,
 * sem ordem garantida - melhor que nada, nunca quebra.
 */
function formatBlocksFragment(character) {
    if (Array.isArray(character.blockSequence)) {
        return character.blockSequence.join(' → ');
    }
    const parts = character.blockTypes.filter((t) => t !== 'message' && t !== 'onmessage' && t !== 'say');
    for (const name of character.messagesSent) parts.push(`message["${name}"]`);
    for (const name of character.messagesReceived) parts.push(`onmessage["${name}"]`);
    for (const text of character.sayTexts) parts.push(`say["${text}"]`);
    return parts.join(' → ');
}

/**
 * Builds the transcript string fed to the LLM, in build order. Scenes with
 * `sceneMd5: null` and characters with `characterMd5: null` are skipped
 * entirely - there's nothing stable to reference them by in a `when` clause,
 * so describing them would only invite a hint the validation step would
 * have to reject anyway. Returns '' when there is nothing describable at
 * all (e.g. an empty project, or one where nothing has a real asset md5
 * yet), so the caller can skip the LLM call entirely.
 *
 * Also annotates, between each describable scene and the one right before
 * it, which characters DISAPPEARED (present in the previous scene, absent
 * here) and which are NEW (present here, absent in the previous scene) -
 * pure set comparison, no LLM involved in detecting it. Only compares
 * against the immediately preceding describable scene, not cumulatively
 * across all earlier ones, so a character reappearing later reads as "new"
 * again there too, matching how a child would actually narrate the story
 * scene-by-scene. This lets the LLM phrase a natural "troque a Ruby pelo
 * Allan aqui" instead of silently ignoring a character swap between scenes
 * (explicit request after reviewing the first generated batch, which had
 * no way to know Ruby was gone from the next scene).
 *
 * Cada linha de ação (cabeçalho de cena, linha de personagem) carrega um
 * "PASSO N" - um contador ÚNICO, contínuo pro transcript inteiro (não reinicia
 * por cena) - achado em teste real: a LLM ocasionalmente devolvia as dicas
 * fora da ordem de construção; numerar toda linha relevante dá uma âncora
 * explícita e inequívoca pra "gere as dicas nesta mesma ordem" (ver regra no
 * SYSTEM_PROMPT). O marcador "➡️ TROCA DE CENA" substitui as antigas
 * anotações separadas de "não aparece mais"/"é personagem novo" por uma
 * única linha entre as duas cenas (não numerada - é uma transição, não uma
 * ação em si), deixando o ponto exato da troca impossível de confundir com
 * mais uma linha de personagem comum.
 */
function buildTranscript(manifest, projectJson) {
    const lines = [];
    // Só pros rótulos das linhas numeradas de script (texto do say etc.) -
    // ver mapRawSprites/formatNumberedScript. Opcional.
    const rawSprites = mapRawSprites(projectJson, manifest);
    let sceneNumber = 0;
    let stepNumber = 0;
    let previousByMd5 = null; // Map<characterMd5, character> of the last describable scene, or null before the first

    // Pré-passo: conta quantas vezes cada NOME de personagem aparece no
    // projeto inteiro (uma contagem por instância describable, não por
    // characterMd5 distinto - a mesma "Casa" reaparecendo em duas cenas
    // conta 2). Só nomes com 2+ ocorrências ganham numeração - ver
    // numberFor() abaixo e docblock do topo do arquivo.
    const nameTotals = new Map();
    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;
        for (const character of scene.characters) {
            if (!character.characterMd5 || !character.characterName) continue;
            nameTotals.set(character.characterName, (nameTotals.get(character.characterName) || 0) + 1);
        }
    }
    const nameRunningCount = new Map(); // nome -> quantas instâncias já vistas até agora
    const numberByCharacter = new Map(); // objeto character -> número já atribuído (cache, ver abaixo)

    // Atribui (e cacheia) o número de uma instância na primeira vez que ela é
    // vista, e devolve o MESMO número em qualquer chamada seguinte pro mesmo
    // objeto character - importante porque o mesmo objeto é referenciado de
    // novo nas anotações de "não aparece mais"/"é personagem novo" abaixo, e
    // precisa continuar com o número já atribuído, não um novo.
    function numberFor(character) {
        if (!character.characterName || (nameTotals.get(character.characterName) || 0) < 2) {
            return null;
        }
        if (numberByCharacter.has(character)) {
            return numberByCharacter.get(character);
        }
        const next = (nameRunningCount.get(character.characterName) || 0) + 1;
        nameRunningCount.set(character.characterName, next);
        numberByCharacter.set(character, next);
        return next;
    }

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;

        const describableCharacters = scene.characters.filter((c) => c.characterMd5);
        if (describableCharacters.length === 0) continue; // nothing referenceable to say about this scene either

        const currentByMd5 = new Map(describableCharacters.map((c) => [c.characterMd5, c]));

        // Marcador de transição ANTES do cabeçalho da nova cena (não depois
        // dela) - lê como uma linha do tempo: "...última coisa da cena
        // anterior → TROCA DE CENA → primeira coisa desta cena", em vez de
        // uma nota de rodapé depois do fato. "saem"/"entram" evita
        // concordância singular/plural (não aparece mais/aparecem mais).
        if (previousByMd5) {
            const removed = [...previousByMd5.values()].filter((c) => !currentByMd5.has(c.characterMd5));
            const added = describableCharacters.filter((c) => !previousByMd5.has(c.characterMd5));
            if (removed.length || added.length) {
                const parts = [];
                if (removed.length) parts.push(`saem: ${removed.map((c) => characterDescriptor(c, numberFor(c))).join(', ')}`);
                if (added.length) parts.push(`entram: ${added.map((c) => characterDescriptor(c, numberFor(c))).join(', ')}`);
                lines.push(`➡️ TROCA DE CENA - ${parts.join('. ')}.`);
            }
        }

        sceneNumber += 1;
        stepNumber += 1;
        const displayName = getBackgroundDisplayName(scene.sceneMd5);
        const nameFragment = displayName ? `, nome exibido ao aluno: "${displayName}"` : '';
        const occurrence = scene.sceneOccurrence || 1;
        lines.push(`PASSO ${stepNumber} - Cena ${sceneNumber} (fundo: ${scene.sceneMd5}${nameFragment}) [sceneOccurrence: ${occurrence}]:`);

        // Cópias do mesmo md5 nesta cena (falha F9): só elas ganham a
        // anotação [characterOccurrence: N] - um personagem único na cena
        // nunca a recebe (a LLM só deve emitir o campo quando ele aparece).
        const copiesByMd5 = new Map();
        for (const c of describableCharacters) copiesByMd5.set(c.characterMd5, (copiesByMd5.get(c.characterMd5) || 0) + 1);

        for (const character of describableCharacters) {
            stepNumber += 1;
            const occurrence = copiesByMd5.get(character.characterMd5) > 1 ? character.characterOccurrence : null;
            const descriptor = characterDescriptor(character, numberFor(character), occurrence);
            if (!character.hasScript) {
                lines.push(`  PASSO ${stepNumber} - ${descriptor}: sem script ainda`);
                continue;
            }
            const blocksFragment = formatBlocksFragment(character);
            lines.push(`  PASSO ${stepNumber} - ${descriptor}: tem script (sequência: ${blocksFragment})`);
            // Fase 3 (E6b): uma linha NUMERADA por script, logo abaixo - é a
            // referência que a LLM usa em scriptRef/blockIndices. Sem PASSO
            // próprio (é detalhe do mesmo passo, não uma ação nova).
            const rawSprite = rawSprites ? rawSprites.get(character) : null;
            (character.scripts || []).forEach((script, s) => {
                const raw = rawSprite && Array.isArray(rawSprite.scripts) ? rawSprite.scripts[script.scriptIndex] : null;
                lines.push(`      ${formatNumberedScript(script, s, raw)}`);
            });
        }

        previousByMd5 = currentByMd5;
    }

    return lines.join('\n');
}

/**
 * Fase 3 (E6b) - casa cada personagem do manifesto com o sprite CRU do
 * projectJson (Map<objeto character do manifesto, sprite cru>), percorrendo
 * páginas/sprites com EXATAMENTE os mesmos filtros de
 * shared/detailedManifest.mjs#computeDetailedManifest (página fantasma/não
 * objeto pulada; sprite fantasma ou type !== 'sprite' pulado) - então
 * scenes[i].characters[j] <-> j-ésimo sprite aceito da i-ésima página
 * aceita. Serve só pra RÓTULO do transcript (texto do say, nome da mensagem
 * enviada - os tokens do manifesto não guardam texto). Sem projectJson (ou
 * formato estranho) devolve null e os rótulos caem pro tipo[valor].
 */
function mapRawSprites(projectJson, manifest) {
    if (!projectJson || typeof projectJson !== 'object' || !Array.isArray(projectJson.pages)) return null;
    const out = new Map();
    let sceneIdx = 0;
    for (const pageId of projectJson.pages) {
        const page = projectJson[pageId];
        if (!page || typeof page !== 'object') continue;
        const scene = manifest.scenes[sceneIdx++];
        if (!scene) break;
        let charIdx = 0;
        for (const spriteId of Array.isArray(page.sprites) ? page.sprites : []) {
            const sprite = page[spriteId];
            if (!sprite || typeof sprite !== 'object' || sprite.type !== 'sprite') continue;
            const character = scene.characters[charIdx++];
            if (character) out.set(character, sprite);
        }
    }
    return out;
}

/** Tupla crua de um token (token.path dentro do script cru) ou null. */
function tupleAt(rawScript, path) {
    let strip = rawScript;
    let tuple = null;
    for (const i of path || []) {
        if (!Array.isArray(strip)) return null;
        tuple = strip[i];
        strip = Array.isArray(tuple) ? tuple[4] : null;
    }
    return Array.isArray(tuple) ? tuple : null;
}

const SPEED_LABELS_PT = ['lenta', 'normal', 'rápida'];

/**
 * Rótulo de UM token no transcript numerado - mesmo vocabulário da
 * "sequência" (say["texto"], forward[3], setspeed[normal], message["nome"]),
 * pra LLM reconhecer os mesmos blocos nas duas linhas. Repeat abre com "{"
 * e o fechamento é só "}" (ver formatNumberedScript). Numérico sem valor no
 * professor = tipo[?] (raro; o código nunca cobre essa posição - ver
 * buildExpectedForHints).
 */
function tokenLabel(token, rawScript) {
    if (token.type === REPEAT_CLOSE) return '}';
    const tuple = rawScript ? tupleAt(rawScript, token.path) : null;
    const arg = tuple ? tuple[1] : null;
    const realArg = arg !== null && arg !== undefined && arg !== 'null' && arg !== '';
    if (token.type === 'say') {
        return token.unset || !realArg ? 'say[(texto padrão)]' : `say["${arg}"]`;
    }
    if (token.type === 'message') return realArg ? `message["${arg}"]` : 'message';
    let label = token.type;
    if (token.type === 'setspeed' && token.num !== null && SPEED_LABELS_PT[token.num]) {
        label = `setspeed[${SPEED_LABELS_PT[token.num]}]`;
    } else if (token.num !== null && token.num !== undefined) {
        label = `${token.type}[${token.num}]`;
    } else if (token.unset) {
        label = `${token.type}[?]`;
    }
    return token.type === 'repeat' ? `${label} {` : label;
}

/**
 * Fase 3 (E6b) - uma linha do transcript por script do professor, com os
 * blocos NUMERADOS: `S2 (onmessage["azul"]): #1 forward[3] #2 repeat[2] {
 * #3 hop[1] #4 } #5 say["Oi"]`.
 *  - "S<n>": n = posição 1-based do script em character.scripts do
 *    manifesto (só scripts COM gatilho - os soltos nunca aparecem). É o
 *    valor que a LLM devolve em when.scriptRef.
 *  - "#<n>": n = (índice em when.expected.script) + 1, ou seja, o índice
 *    1-based nos tokens de scriptTokens()/manifest.tokens - INCLUINDO o
 *    fechamento do repeat. O gatilho não é token (fica no rótulo do script).
 *  - Fechamento do repeat: decisão - ele GANHA número ("#4 }") em vez de
 *    ficar sem número. Pular o número ("#2 repeat[2] { #3 hop[1] } #5 ...")
 *    faria a LLM achar que falta um bloco #4; numerado, a sequência é
 *    contínua e o prompt explica que o número do "}" nunca precisa ir em
 *    blockIndices (se vier, o código ignora em silêncio - não é posição
 *    ensinável, ver buildExpectedForHints).
 */
function formatNumberedScript(script, s, rawScript) {
    const triggerLabel = script.trigger === 'onmessage' && script.triggerArg
        ? `onmessage["${script.triggerArg}"]`
        : script.trigger;
    const tokens = Array.isArray(script.tokens) ? script.tokens : [];
    const body = tokens.length
        ? tokens.map((t, i) => `#${i + 1} ${tokenLabel(t, rawScript)}`).join(' ')
        : '(sem blocos)';
    return `S${s + 1} (${triggerLabel}): ${body}`;
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
 * Chave composta (sceneMd5 + sceneOccurrence) usada pra distinguir cenas
 * repetidas (mesmo fundo usado em mais de uma página) - sceneMd5 sozinho não
 * basta, ver docblock do topo do arquivo. occurrence ausente/undefined é
 * tratado como 1 (primeira/única ocorrência), tanto aqui quanto em
 * isHintValid, pra hints antigos (salvos antes desta mudança, sem o campo)
 * continuarem validando contra a primeira ocorrência de cada fundo.
 */
function sceneKey(sceneMd5, occurrence) {
    return `${sceneMd5}::${occurrence || 1}`;
}

/**
 * Builds the lookup sets used to validate hints against the REAL manifest:
 * every real (sceneMd5, sceneOccurrence) pair, every real characterMd5
 * (scoped per cena+ocorrência, já que um `when` de personagem sempre nomeia
 * os dois juntos), a união, no projeto inteiro, de todo nome de mensagem
 * enviada, os blockTypes reais de cada personagem (scoped por
 * cena+ocorrência+personagem) - usado pra impedir que "character_missing_block_type"
 * peça um tipo de bloco que o personagem do professor nem tem (ver
 * comentário de character_missing_block_type em isHintValid: como o cliente
 * agora exige TODOS os blockTypes listados - AND, não OR - um único tipo
 * inventado tornaria a dica impossível de resolver pra sempre) - e, do mesmo
 * jeito, os blockArgs reais de cada personagem (Map<blockType, Set<number>>,
 * espelhando detailedManifest.js#blockArgs), consumido por fillBlockArgs()
 * pra preencher o argumento EXATO de cada bloco numérico (ver docblock
 * daquela função - por que isso é derivado por código, não confiado à LLM).
 */
function buildValidationIndex(manifest) {
    const sceneKeySet = new Set();
    const charactersByScene = new Map(); // sceneKey(sceneMd5,occurrence) -> Set<characterMd5>
    const blockTypesByCharacter = new Map(); // sceneKey::characterMd5 -> Set<blockType> (união das cópias)
    const blockArgsByCharacter = new Map(); // sceneKey::characterMd5 -> Map<blockType, Set<number>> (união das cópias)
    // Falha F9 - o mesmo, por CÓPIA (characterKey com a ocorrência): uma
    // dica com when.characterOccurrence é validada/preenchida contra a cópia
    // dela, não contra a união de todas.
    const copiesByCharacter = new Map(); // sceneKey::characterMd5 -> quantas cópias na cena
    const blockTypesByCopy = new Map(); // characterKey(...) -> Set<blockType>
    const blockArgsByCopy = new Map(); // characterKey(...) -> Map<blockType, Set<number>>
    const allMessagesSent = new Set();

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;
        const key = sceneKey(scene.sceneMd5, scene.sceneOccurrence);
        sceneKeySet.add(key);

        const charSet = charactersByScene.get(key) || new Set();
        for (const character of scene.characters) {
            if (character.characterMd5) {
                charSet.add(character.characterMd5);
                const blockTypeKey = `${key}::${character.characterMd5}`;
                const blockTypeSet = blockTypesByCharacter.get(blockTypeKey) || new Set();
                for (const bt of character.blockTypes || []) blockTypeSet.add(bt);
                blockTypesByCharacter.set(blockTypeKey, blockTypeSet);

                const argsByType = blockArgsByCharacter.get(blockTypeKey) || new Map();
                const copyArgs = new Map();
                for (const [blockType, values] of Object.entries(character.blockArgs || {})) {
                    const valueSet = argsByType.get(blockType) || new Set();
                    for (const v of values) valueSet.add(v);
                    argsByType.set(blockType, valueSet);
                    copyArgs.set(blockType, new Set(values));
                }
                blockArgsByCharacter.set(blockTypeKey, argsByType);

                const copy = (copiesByCharacter.get(blockTypeKey) || 0) + 1;
                copiesByCharacter.set(blockTypeKey, copy);
                const copyKey = characterKey(scene.sceneMd5, scene.sceneOccurrence, character.characterMd5, copy);
                blockTypesByCopy.set(copyKey, new Set(character.blockTypes || []));
                blockArgsByCopy.set(copyKey, copyArgs);
            }
            for (const name of character.messagesSent) allMessagesSent.add(name);
        }
        charactersByScene.set(key, charSet);
    }

    return {
        sceneKeySet, charactersByScene, blockTypesByCharacter, blockArgsByCharacter, allMessagesSent,
        copiesByCharacter, blockTypesByCopy, blockArgsByCopy,
    };
}

/**
 * Chave de UMA cópia de personagem (falha F9): cena+ocorrência+md5+cópia.
 * copy ausente = 1 (personagem sem cópias / dica sem characterOccurrence).
 */
function characterKey(sceneMd5, sceneOccurrence, characterMd5, copy) {
    return `${sceneKey(sceneMd5, sceneOccurrence)}::${characterMd5}#${copy || 1}`;
}

/** characterOccurrence válido (inteiro 1..copies) ou null. */
function validOccurrence(value, copies) {
    return Number.isInteger(value) && value >= 1 && value <= copies ? value : null;
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

    const key = typeof when.sceneMd5 === 'string' ? sceneKey(when.sceneMd5, when.sceneOccurrence) : null;
    const hasValidScene = key !== null && index.sceneKeySet.has(key);
    const charsInScene = hasValidScene ? index.charactersByScene.get(key) : null;
    const hasValidCharacter = hasValidScene && !!charsInScene &&
        typeof when.characterMd5 === 'string' && charsInScene.has(when.characterMd5);

    switch (when.type) {
        case 'scene_missing':
            return hasValidScene;
        case 'character_missing':
            // Achado em teste real - a Ruby (personagem default) é criada
            // sozinha em toda página nova, então "adicioná-la" nunca é um
            // passo de verdade (o aluno já a encontra lá) - rejeitada mesmo
            // que a LLM ou a rede de segurança tentem gerar uma, ver
            // fillMissingCharacterAddedHints() e docblock do topo do arquivo.
            return hasValidCharacter && when.characterMd5 !== DEFAULT_CHARACTER_MD5;
        case 'character_no_script':
            return hasValidCharacter;
        case 'character_missing_block_type': {
            if (!hasValidCharacter || !Array.isArray(when.blockTypes) || when.blockTypes.length === 0) {
                return false;
            }
            // O cliente exige TODOS os blockTypes listados (AND) pra considerar
            // a dica resolvida - ver _hintConditionHolds em AssignmentBadge.js.
            // Por isso cada tipo listado aqui precisa ser um tipo que o
            // personagem do PRÓPRIO professor de fato usa nessa cena; um tipo
            // alucinado/errado tornaria a dica impossível de resolver (o aluno
            // nunca teria como "completar o conjunto").
            const blockTypeKey = `${key}::${when.characterMd5}`;
            const realBlockTypes = index.blockTypesByCharacter.get(blockTypeKey);
            if (!realBlockTypes) return false;
            if (!when.blockTypes.every((t) => typeof t === 'string' && t.length > 0)) return false;
            // when.blockArgs (o valor exato de cada bloco numérico) NÃO é
            // validado aqui de propósito - é derivado por código logo depois
            // via fillBlockArgs(), que sobrescreve qualquer coisa que a LLM
            // tenha mandado nesse campo com o valor REAL do manifesto (ver
            // docblock de fillBlockArgs pra entender por quê). Confiar na
            // LLM pra copiar o número certo seria só mais uma chance de
            // alucinação sobre algo que o código já sabe com certeza.
            //
            // Falha F9 - com cópias, todos os tipos precisam estar numa MESMA
            // cópia (o cliente exige todos numa só - ver
            // HintEngine.js#candidatesFor). Qual cópia é decidido depois, por
            // código (fillCharacterOccurrence corrige um characterOccurrence
            // errado da LLM), então aqui basta existir UMA cópia com todos.
            // Sem cópias = a checagem de sempre (o único personagem tem todos).
            const copies = index.copiesByCharacter.get(blockTypeKey) || 1;
            for (let copy = 1; copy <= copies; copy += 1) {
                const types = index.blockTypesByCopy.get(characterKey(when.sceneMd5, when.sceneOccurrence, when.characterMd5, copy));
                if (types && when.blockTypes.every((t) => types.has(t))) return true;
            }
            return false;
        }
        case 'message_not_received':
            return typeof when.messageName === 'string' && index.allMessagesSent.has(when.messageName);
        case 'default_character_present':
            // Só válida pra uma cena REAL onde a Ruby NÃO está de verdade -
            // se ela realmente faz parte da cena do professor ali, mandar o
            // aluno apagá-la seria errado (ver docblock do topo do arquivo).
            return hasValidScene && when.characterMd5 === DEFAULT_CHARACTER_MD5 &&
                !(charsInScene && charsInScene.has(DEFAULT_CHARACTER_MD5));
        case 'mission_intro':
            // Sem cena/personagem pra checar - é a dica de apresentação da
            // missão inteira (ver buildIntroHint), sempre válida por
            // construção (nunca vem da LLM, só do código - ver generateHints).
            return true;
        default:
            return false; // unreachable (VALID_WHEN_TYPES already filtered), kept for exhaustiveness
    }
}

/**
 * Preenche/sobrescreve `when.blockArgs` de toda dica "character_missing_block_type"
 * com o valor EXATO que o personagem do PRÓPRIO professor usa pra cada bloco
 * numérico em blockTypes (forward/back/up/down/left/right/hop/wait/repeat/
 * grow/shrink/setspeed - ver NUMERIC_ARG_TYPES em detailedManifest.js) -
 * NUNCA pra "say" (achado em teste real, decisão explícita do usuário: "say"
 * é o único bloco cujo argumento pode divergir do que o professor usou -
 * qualquer fala do aluno conta, então nunca entra em blockArgs).
 *
 * Por que isso é CÓDIGO e não confiado à LLM (mesma lição já aprendida com
 * scene_missing/default_character_present/character_missing - uma regra só
 * no prompt não é garantia, ver docblock do topo do arquivo): o valor exato
 * já está 100% disponível no manifesto (é dado estruturado, não precisa de
 * interpretação de linguagem natural) - pedir pra LLM copiar um número é só
 * mais uma chance de alucinação sobre algo que o código já sabe com
 * certeza. Por isso o valor da LLM pra este campo é IGNORADO por completo
 * (isHintValid nem valida when.blockArgs - ver comentário lá) e
 * substituído aqui.
 *
 * Só preenche quando o valor é INEQUÍVOCO - se o personagem usou o MESMO
 * tipo de bloco com dois valores DIFERENTES em pontos diferentes do script
 * (raro, mas possível - ex.: "forward 3" numa cena e "forward 5" depois),
 * não tem como saber qual dos dois esta dica específica está descrevendo, e
 * a dica não guarda "índice de ocorrência dentro do personagem" (só
 * sceneOccurrence, que é por CENA) - nesses casos o tipo fica sem argumento
 * associado, mantendo o comportamento anterior (só o tipo é exigido, sem
 * checar o valor).
 */
function fillBlockArgs(hints, manifest) {
    const index = buildValidationIndex(manifest);

    for (const hint of hints) {
        if (!hint.when || hint.when.type !== 'character_missing_block_type') continue;
        const blockTypeKey = `${sceneKey(hint.when.sceneMd5, hint.when.sceneOccurrence)}::${hint.when.characterMd5}`;
        // Com characterOccurrence (falha F9), os valores DAQUELA cópia - a
        // outra cópia pode usar o mesmo bloco com outro valor.
        const argsByType = hint.when.characterOccurrence
            ? index.blockArgsByCopy.get(characterKey(hint.when.sceneMd5, hint.when.sceneOccurrence, hint.when.characterMd5, hint.when.characterOccurrence))
            : index.blockArgsByCharacter.get(blockTypeKey);
        if (!argsByType) continue;

        const blockArgs = {};
        for (const blockType of hint.when.blockTypes || []) {
            if (blockType === 'say') continue; // nunca - ver docblock acima
            const values = argsByType.get(blockType);
            if (values && values.size === 1) {
                blockArgs[blockType] = values.values().next().value;
            }
        }
        hint.when.blockArgs = blockArgs;
    }

    return hints;
}

/**
 * Identidade do gatilho de um script do manifesto pra contagem: (gatilho,
 * mensagem). Falha F8 - "quando receber azul" e "quando receber verde" são
 * gatilhos DIFERENTES; contá-los juntos fazia minCounts somar blocos dos
 * dois e a dica pedir, sob UMA mensagem, mais blocos do que o professor
 * pôs ali (dica impossível). triggerArg ausente (manifesto antigo / outro
 * gatilho / onmessage sem mensagem) = null.
 */
function triggerKeyOf(script) {
    return `${script.trigger}|${script.triggerArg == null ? '' : script.triggerArg}`;
}

/**
 * Acha, no personagem do professor, a k-ésima ocorrência (1-based, contando
 * em todos os scripts na ordem) do bloco `type`. Devolve o gatilho do script
 * onde ela está (trigger + triggerArg) e quantas ocorrências desse tipo
 * existem ATÉ ali só entre os scripts do MESMO gatilho - mesma mensagem, no
 * caso do onmessage (triggerCount) - é esse número, e não k, que o cliente
 * compara, já que ele conta só dentro do gatilho da dica. null se o
 * personagem não tem k ocorrências (ex.: manifesto antigo, sem `scripts`).
 */
function locateOccurrence(character, type, k) {
    if (!character || !Array.isArray(character.scripts)) return null;
    let globalCount = 0;
    const perTrigger = new Map();
    for (const script of character.scripts) {
        const tKey = triggerKeyOf(script);
        for (const block of script.blocks || []) {
            if (block.type !== type) continue;
            globalCount++;
            const soFar = (perTrigger.get(tKey) || 0) + 1;
            perTrigger.set(tKey, soFar);
            if (globalCount === k) {
                return { trigger: script.trigger, triggerArg: script.triggerArg == null ? null : script.triggerArg, triggerKey: tKey, triggerCount: soFar };
            }
        }
    }
    return null;
}

/**
 * Preenche `when.minCounts` e `when.trigger` de toda dica
 * "character_missing_block_type" a partir do personagem do PRÓPRIO professor
 * (mesma lógica de fillBlockArgs: dado estruturado que o código já sabe, não
 * confiado à LLM - o valor dela pra esses campos é sobrescrito/ignorado).
 *
 *  - minCounts ({[blockType]: N}, só N > 1): a dica descreve a N-ésima vez
 *    que esse bloco aparece no personagem (ex.: o 2º `say` da sequência
 *    "say → wait → say"). Sem isso o cliente dava a dica por feita assim que
 *    existia QUALQUER `say` (achado em teste real: a 2ª fala do Cofrinho já
 *    nascia "resolvida" por causa da 1ª). N é contado em ordem de dicas do
 *    mesmo personagem (a 1ª dica com "say" = 1, a 2ª = 2...) e relativo ao
 *    gatilho da dica - ver locateOccurrence.
 *  - trigger (onflag/onclick/ontouch/onmessage): o gatilho do script do
 *    professor onde o bloco está. Só definido quando TODOS os blockTypes da
 *    dica caem em scripts de um mesmo gatilho (uma dica = uma ação = um
 *    script) - senão fica de fora e o cliente aceita o bloco em qualquer
 *    script, como antes (achado em teste real: "quando clicar no Cofrinho,
 *    faça crescer" era dada por feita com o `grow` sob a bandeira verde).
 *  - triggerArg (falha F8): com trigger 'onmessage', o NOME da mensagem do
 *    script do professor. Contagem (triggerCount/minCounts) e
 *    triggerExclusive passam a ser por (gatilho, mensagem) - ver
 *    triggerKeyOf. "Mesmo gatilho" entre os blockTypes da dica também exige
 *    a mesma mensagem. Um onmessage do professor SEM mensagem escolhida
 *    (triggerArg null) não grava triggerArg: o cliente aceita qualquer
 *    onmessage ali (comportamento antigo) e o minCounts, contado só entre
 *    os onmessage sem mensagem, fica no máximo frouxo, nunca impossível.
 * Personagem com cópias na cena (falha F9): olha a cópia de
 * when.characterOccurrence (gravado antes por fillCharacterOccurrence) e
 * numera minCounts por cópia; sem o campo, a 1ª/única cópia.
 * Dicas antigas sem esses campos continuam funcionando (cliente trata
 * ausente como "qualquer script, pelo menos 1").
 */
function fillBlockContext(hints, manifest) {
    const charactersByKey = new Map();
    for (const scene of (manifest && manifest.scenes) || []) {
        const copies = new Map();
        for (const character of scene.characters || []) {
            const copy = (copies.get(character.characterMd5) || 0) + 1;
            copies.set(character.characterMd5, copy);
            charactersByKey.set(characterKey(scene.sceneMd5, scene.sceneOccurrence, character.characterMd5, copy), character);
        }
    }

    const consumed = new Map(); // key::blockType -> quantas dicas anteriores já pediram esse tipo
    for (const hint of hints) {
        if (!hint.when || hint.when.type !== 'character_missing_block_type') continue;
        const key = characterKey(hint.when.sceneMd5, hint.when.sceneOccurrence, hint.when.characterMd5, hint.when.characterOccurrence);
        const character = charactersByKey.get(key);
        const types = Array.isArray(hint.when.blockTypes) ? hint.when.blockTypes : [];

        const locations = [];
        const ks = [];
        for (const type of types) {
            const k = (consumed.get(`${key}::${type}`) || 0) + 1;
            consumed.set(`${key}::${type}`, k);
            const real = character && character.blockCounts ? character.blockCounts[type] : 0;
            ks.push(Math.min(k, real || 1)); // nunca exige mais do que o professor tem
            locations.push(real >= k ? locateOccurrence(character, type, k) : null);
        }

        delete hint.when.minCounts;
        delete hint.when.trigger;
        delete hint.when.triggerArg;
        delete hint.when.triggerExclusive;
        const sameTrigger = locations.length > 0 &&
            locations.every((loc) => loc && loc.trigger && loc.triggerKey === locations[0].triggerKey);
        if (sameTrigger) {
            hint.when.trigger = locations[0].trigger;
            if (hint.when.trigger === 'onmessage' && locations[0].triggerArg !== null) {
                hint.when.triggerArg = locations[0].triggerArg;
            }
            // triggerExclusive: o professor só usa esses tipos sob ESTE
            // gatilho. Só então o cliente pode afirmar "está no lugar errado"
            // ao achar o bloco sob outro gatilho - se o mesmo tipo também
            // aparece legitimamente em outro script do professor (ex.: `say`
            // na bandeira E no clique), um `say` fora do gatilho pode ser o
            // de outra dica, não um erro.
            const exclusive = types.every((type) => character.scripts.every((script) =>
                triggerKeyOf(script) === locations[0].triggerKey || !script.blocks.some((b) => b.type === type)));
            if (exclusive) hint.when.triggerExclusive = true;
        }

        // Com gatilho, o cliente conta só dentro dele (triggerCount); sem
        // gatilho, conta em todos os scripts (k global).
        const minCounts = {};
        types.forEach((type, i) => {
            const n = sameTrigger ? locations[i].triggerCount : ks[i];
            if (n > 1) minCounts[type] = n;
        });
        if (Object.keys(minCounts).length) hint.when.minCounts = minCounts;
    }

    return hints;
}

/**
 * Rede de segurança pra "default_character_present" - não confia só na
 * regra "OBRIGATÓRIO" do SYSTEM_PROMPT (mesma lição já aprendida com
 * scene_missing: uma instrução só no prompt já foi ignorada pela LLM antes,
 * ver docblock do topo). Pra CADA cena describable do manifesto REAL que não
 * tem a Ruby entre seus personagens, garante que o array de dicas tenha uma
 * default_character_present pra ela - se a LLM já gerou uma válida, não
 * duplica; se esqueceu, injeta uma com texto padrão.
 *
 * Só INSERE, nunca reordena o que já existe - `hints` pode conter dicas sem
 * cena nenhuma (message_not_received não tem sceneMd5) cuja posição relativa
 * às outras não deve mudar. A dica injetada entra logo depois da dica
 * "scene_missing" daquela cena, se houver uma no array atual; senão, logo
 * antes da primeira dica já existente daquela mesma cena; senão (cena sem
 * NENHUMA dica ainda), no fim.
 */
function fillMissingDefaultCharacterHints(hints, manifest) {
    const alreadyCovered = new Set();
    for (const hint of hints) {
        if (hint.when && hint.when.type === 'default_character_present') {
            alreadyCovered.add(sceneKey(hint.when.sceneMd5, hint.when.sceneOccurrence));
        }
    }

    const result = hints.slice();

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;
        const describableCharacters = scene.characters.filter((c) => c.characterMd5);
        if (describableCharacters.length === 0) continue; // mesmo filtro de buildTranscript - nada descritível nesta cena

        const key = sceneKey(scene.sceneMd5, scene.sceneOccurrence);
        const hasDefaultCharacter = describableCharacters.some((c) => c.characterMd5 === DEFAULT_CHARACTER_MD5);
        if (hasDefaultCharacter || alreadyCovered.has(key)) continue;

        const fallback = {
            text: 'Apague a Ruby.',
            when: {
                type: 'default_character_present',
                sceneMd5: scene.sceneMd5,
                sceneOccurrence: scene.sceneOccurrence || 1,
                characterMd5: DEFAULT_CHARACTER_MD5,
            },
        };

        const sceneMissingIdx = result.findIndex((h) =>
            h.when && h.when.type === 'scene_missing' && sceneKey(h.when.sceneMd5, h.when.sceneOccurrence) === key);
        if (sceneMissingIdx >= 0) {
            result.splice(sceneMissingIdx + 1, 0, fallback);
            continue;
        }
        const firstOwnIdx = result.findIndex((h) => h.when && sceneKey(h.when.sceneMd5, h.when.sceneOccurrence) === key);
        result.splice(firstOwnIdx >= 0 ? firstOwnIdx : result.length, 0, fallback);
    }

    return result;
}

/**
 * Rede de segurança pra "adicionar o personagem" nunca ser pulado - achado
 * em teste real: a LLM às vezes gera só a dica de COMPORTAMENTO
 * (character_no_script/character_missing_block_type) sem nunca ter gerado
 * uma character_missing separada pra aquele mesmo personagem, pulando direto
 * pro "faça o Allan dizer algo" sem uma dica prévia de "adicione o Allan"
 * (viola a regra OBRIGATÓRIO do SYSTEM_PROMPT - mesma lição já aprendida com
 * scene_missing e default_character_present: regra só no prompt não basta).
 *
 * Só injeta character_missing pra (cena, personagem) que já tem alguma dica
 * de COMPORTAMENTO no array mas nenhuma character_missing própria - nunca
 * força uma dica pra um personagem que a LLM decidiu não mencionar de jeito
 * nenhum (isso é julgamento legítimo dela, fora do escopo desta rede de
 * segurança). Texto sempre code-gerado (não reaproveita texto de outra
 * dica), inserido logo ANTES da primeira dica de comportamento daquele
 * personagem - mesma posição que a LLM é instruída a usar.
 */
function findCharacterInManifest(manifest, sceneMd5, sceneOccurrence, characterMd5, characterOccurrence) {
    const scene = manifest.scenes.find((s) => s.sceneMd5 === sceneMd5 && (s.sceneOccurrence || 1) === (sceneOccurrence || 1));
    if (!scene) return null;
    return scene.characters.filter((c) => c.characterMd5 === characterMd5)[(characterOccurrence || 1) - 1] || null;
}

/**
 * Falha F9 - grava/normaliza `when.characterOccurrence` (1-based) nas dicas
 * com escopo de personagem (character_missing, character_no_script,
 * character_missing_block_type), SÓ quando a cena do professor tem cópias
 * repetidas daquele personagem (mesmo md5). Sem cópias o campo é apagado
 * (mesmo que a LLM tenha mandado) - o cliente então usa a regra legada
 * "qualquer cópia" (HintEngine.js#candidatesFor), que pra um personagem
 * único dá no mesmo.
 *
 * Com cópias: mantém o valor da LLM (copiado da anotação
 * [characterOccurrence: N] do transcript) se for válido E coerente; senão
 * escolhe por código:
 *  - character_missing_block_type: a 1ª cópia que tem TODOS os blockTypes
 *    (isHintValid já garantiu que existe uma);
 *  - character_no_script: a 1ª cópia sem script (ou a pedida/1ª, se todas
 *    têm script);
 *  - character_missing: a k-ésima dica character_missing desse personagem
 *    nessa cena vira a cópia k (limitado ao nº de cópias) - "coloque a
 *    Ruby" duas vezes = a 1ª e a 2ª cópia.
 * Roda ANTES de fillBlockArgs/fillBlockContext (que leem o campo).
 */
function fillCharacterOccurrence(hints, manifest) {
    const SCOPED_TYPES = new Set(['character_missing', 'character_no_script', 'character_missing_block_type']);
    const copiesOf = (when) => {
        const scene = manifest.scenes.find((s) => s.sceneMd5 === when.sceneMd5 && (s.sceneOccurrence || 1) === (when.sceneOccurrence || 1));
        return scene ? scene.characters.filter((c) => c.characterMd5 === when.characterMd5) : [];
    };
    const missingSeen = new Map(); // sceneKey::md5 -> quantas character_missing já vistas

    for (const hint of hints) {
        const when = hint.when;
        if (!when || typeof when !== 'object') continue;
        if (!SCOPED_TYPES.has(when.type)) {
            delete when.characterOccurrence;
            continue;
        }
        const copies = copiesOf(when);
        if (copies.length <= 1) {
            delete when.characterOccurrence;
            continue;
        }
        const asked = validOccurrence(when.characterOccurrence, copies.length);
        let chosen = null;
        if (when.type === 'character_missing_block_type') {
            const types = Array.isArray(when.blockTypes) ? when.blockTypes : [];
            const hasAll = (c) => types.every((t) => (c.blockTypes || []).includes(t));
            if (asked && hasAll(copies[asked - 1])) {
                chosen = asked;
            } else {
                const idx = copies.findIndex(hasAll);
                chosen = idx >= 0 ? idx + 1 : (asked || 1);
            }
        } else if (when.type === 'character_no_script') {
            if (asked && !copies[asked - 1].hasScript) {
                chosen = asked;
            } else {
                const idx = copies.findIndex((c) => !c.hasScript);
                chosen = idx >= 0 ? idx + 1 : (asked || 1);
            }
        } else {
            const k = `${sceneKey(when.sceneMd5, when.sceneOccurrence)}::${when.characterMd5}`;
            const nth = (missingSeen.get(k) || 0) + 1;
            missingSeen.set(k, nth);
            chosen = asked || Math.min(nth, copies.length);
        }
        when.characterOccurrence = chosen;
    }
    return hints;
}

function fillMissingCharacterAddedHints(hints, manifest) {
    const BEHAVIOR_TYPES = new Set(['character_no_script', 'character_missing_block_type']);
    const characterAddedCovered = new Set(); // sceneKey::characterMd5 já coberto por um character_missing

    for (const hint of hints) {
        if (hint.when && hint.when.type === 'character_missing') {
            characterAddedCovered.add(`${sceneKey(hint.when.sceneMd5, hint.when.sceneOccurrence)}::${hint.when.characterMd5}#${hint.when.characterOccurrence || 0}`);
        }
    }

    const result = hints.slice();
    const seenBehaviorFor = new Set(); // já processamos o fallback pra este personagem (só a 1ª dica de comportamento importa - a posição de inserção)

    for (let i = 0; i < hints.length; i += 1) {
        const hint = hints[i];
        if (!hint.when || !BEHAVIOR_TYPES.has(hint.when.type)) continue;
        // Ruby nunca ganha character_missing (ver isHintValid/docblock do
        // topo do arquivo) - ela já está lá sozinha, "adicioná-la" nunca é
        // um passo real, então esta rede de segurança não se aplica a ela.
        if (hint.when.characterMd5 === DEFAULT_CHARACTER_MD5) continue;

        // Cópia (falha F9) faz parte do escopo: colocar a 1ª Ruby não cobre a 2ª.
        const scopeKey = `${sceneKey(hint.when.sceneMd5, hint.when.sceneOccurrence)}::${hint.when.characterMd5}#${hint.when.characterOccurrence || 0}`;
        if (characterAddedCovered.has(scopeKey) || seenBehaviorFor.has(scopeKey)) continue;
        seenBehaviorFor.add(scopeKey);

        // Nome sem artigo (não dá pra saber o/a só pelo nome) - "coloque
        // Ruby aqui" soa um pouco menos natural que "coloque a Ruby", mas
        // evita chutar o gênero errado; melhor que o genérico "esse
        // personagem" quando o nome está disponível.
        const character = findCharacterInManifest(manifest, hint.when.sceneMd5, hint.when.sceneOccurrence, hint.when.characterMd5, hint.when.characterOccurrence);
        const text = character && character.characterName
            ? `Antes disso, coloque ${character.characterName} aqui.`
            : 'Antes disso, coloque esse personagem na cena.';

        const fallback = {
            text,
            when: {
                type: 'character_missing',
                sceneMd5: hint.when.sceneMd5,
                sceneOccurrence: hint.when.sceneOccurrence,
                characterMd5: hint.when.characterMd5,
            },
        };
        if (hint.when.characterOccurrence) fallback.when.characterOccurrence = hint.when.characterOccurrence;
        const insertAt = result.indexOf(hint); // reencontra - índices já podem ter mudado por inserções anteriores neste loop
        result.splice(insertAt, 0, fallback);
    }

    return result;
}

// ---------------------------------------------------------------------------
// Fase 3 (E6b) - when.expected gerado por CÓDIGO
// ---------------------------------------------------------------------------

const TRIGGER_BLOCK_TYPES = new Set(['onflag', 'onclick', 'ontouch', 'onmessage']);

/**
 * scriptRef da LLM ("S2", "s2", 2 ou "2") -> índice 0-based em
 * character.scripts do manifesto, ou -1 se não der pra ler/fora do
 * intervalo. Ver formatNumberedScript pro "S<n>".
 */
function parseScriptRef(ref, count) {
    let n = NaN;
    if (Number.isInteger(ref)) n = ref;
    else if (typeof ref === 'string') {
        const m = /^\s*[sS]?\s*(\d+)\s*$/.exec(ref);
        if (m) n = Number(m[1]);
    }
    return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : -1;
}

/**
 * Posição do professor que nunca pode ser coberta: fechamento de repeat
 * (acompanha a abertura) e token sem valor escolhido no PRÓPRIO professor
 * (unset/pending - say com texto padrão, numérico vazio, setspeed 3): o
 * alinhamento trata o lado do aluno pareado com ela como "pending" nunca
 * 'done' no próprio professor, então cobri-la tornaria a dica impossível.
 */
function isCoverable(token) {
    return !!token && token.type !== REPEAT_CLOSE && token.unset !== true &&
        (token.pending === null || token.pending === undefined);
}

/**
 * Preenche `when.expected` (Fase 3 - ver shared/hintSchema.mjs e
 * shared/hintAlignment.mjs) em toda dica "character_missing_block_type" que
 * dá pra ancorar num script REAL do professor, e devolve uma CÓPIA da lista
 * (a entrada nunca é mutada). Pura e determinística - a mesma entrada dá
 * sempre a mesma saída. Usada em dois lugares:
 *  - generateHintsCore (dicas novas): honra os ponteiros que a LLM mandou
 *    (when.scriptRef = "S<n>" e when.blockIndices = números "#<n>" do
 *    transcript - ver formatNumberedScript);
 *  - a MIGRAÇÃO (backend/scripts/backfillHintExpected.js): dicas JÁ SALVAS,
 *    sem ponteiro nenhum - cai inteira no fallback por tipos abaixo.
 *
 * @param {Array<object>} hints - lista de dicas ({text, when, id?}), em ordem.
 *   Dicas de outros tipos passam intactas (só perdem scriptRef/blockIndices/
 *   expected soltos que a LLM tenha inventado nelas).
 * @param {object} projectJson - projeto do professor JÁ parseado.
 * @param {{manifest?: object, reconcileLegacy?: boolean}} [options]
 *   manifest: computeDetailedManifest(projectJson) já calculado (evita
 *   recomputar); reconcileLegacy (default true): reescreve os campos legados
 *   (blockTypes/trigger/triggerArg/minCounts/blockArgs/triggerExclusive) pra
 *   ficarem coerentes com expected - ver "Legado" abaixo.
 * @returns {{hints: Array<object>, report: Array<{index: number, status:
 *   'expected'|'legacy', source?: 'llm'|'fallback', reason?: string,
 *   detail?: object}>}} - report tem uma entrada por dica de bloco (index =
 *   posição em `hints`); reason em 'legacy': 'no_character' (personagem/
 *   scripts não achados), 'no_script' (nenhum script tem todos os tipos
 *   ainda livres), 'not_done' (montou mas não deu 'done' no projeto do
 *   professor - detail traz o resultado do alinhamento).
 *
 * Regras (em ordem, por dica; o estado "posições já cobertas" é por
 * personagem-cópia + script do professor e avança dica a dica):
 *  1. A LLM NUNCA fornece valores: when.expected/scriptRef/blockIndices que
 *     vierem dela são apagados; script/trigger/triggerArg vêm do manifesto
 *     (toExpectedTokens(scripts[k].tokens) == scriptTokens(tupla crua) - o
 *     MESMO tokenizador do aluno). Os números da LLM só APONTAM posições.
 *  2. Com scriptRef válido (e, se blockTypes lista um gatilho, o script tem
 *     esse gatilho): cada blockIndices n vira o índice n-1; descartados os
 *     não-inteiros, fora do intervalo, de tipo fora de blockTypes, não
 *     cobríveis (isCoverable; o "}" do repeat é ignorado em silêncio) e os já
 *     cobertos por uma dica ANTERIOR do mesmo script (a posterior perde a
 *     posição). Tipo de blockTypes que ficou sem posição recebe a posição do
 *     fallback (regra 4) DENTRO desse script. Se nada sobrar, regra 3.
 *  3. Fallback de localização (sem ponteiros, ou ponteiros inúteis): o 1º
 *     script do personagem (ordem do manifesto) que tem, pra CADA tipo não-
 *     gatilho de blockTypes, ao menos uma posição cobrível ainda não coberta
 *     (e o gatilho certo, se blockTypes lista um). É a generalização de
 *     locateOccurrence/fillBlockContext (R2): com dicas consumindo em ordem,
 *     "1ª posição ainda livre" == "k-ésima ocorrência", e a escolha é por
 *     script inteiro, então (gatilho, MENSAGEM) saem juntos - o forward sob
 *     "quando receber verde" nunca é ancorado no script de "azul".
 *  4. Posições do fallback, por tipo: a 1ª ainda livre no script; e, se
 *     NENHUMA dica posterior do mesmo personagem-cópia pede esse tipo, TODAS
 *     as livres restantes dele (cobre "ande 3 vezes" = 3 forwards numa dica
 *     só). Por que não "todas sempre": duas dicas "hop" seguidas (falha F4)
 *     - a 1ª pegaria os dois hops e a 2ª ficaria sem nada; com a olhada pra
 *     frente a 1ª fica com o 1º hop e a 2ª com o 2º.
 *     4b. A absorção para ANTES da próxima posição livre (no mesmo script)
 *     de qualquer tipo que uma dica posterior do mesmo personagem-cópia
 *     ensina: "diga 'Fala 2'" em say,say,say,message,say não engole a fala
 *     depois do message (achado no fixture mensagens.json) - cobri-la
 *     prenderia a dica de fala até a criança montar um bloco que o texto
 *     nem menciona, e o message da dica seguinte viraria wrong_order.
 *     Posições que nenhuma dica cobre simplesmente não são conferidas
 *     (mesmo comportamento do caminho legado).
 *  5. Sem posição pra nenhum tipo -> sem expected (dica legada, intacta).
 *     blockTypes só com gatilho (ex.: ["onmessage"]) -> covered [] ("crie o
 *     script com esse gatilho", done assim que existir).
 *  6. occurrence (1-based) só quando o personagem do professor tem 2+
 *     scripts com trigger+triggerArg+tokens idênticos.
 *  7. VALIDAÇÃO por código: todas as dicas com expected são avaliadas com
 *     evaluateExpectedHints contra o manifesto do PRÓPRIO professor; a que
 *     não der 'done' (inclui qualquer wrong_value/wrong_order/extra_block - ex.: atribuição
 *     gulosa de scripts idênticos do alinhamento pareando o grupo errado)
 *     perde o expected e volta EXATAMENTE aos campos legados de antes desta
 *     função (fillBlockArgs/fillBlockContext já os validaram). Repete até
 *     estabilizar, porque tirar uma dica de um grupo muda a visão cruzada
 *     (dono do extra_block) das demais.
 *
 * Legado (reconcileLegacy): com expected, os campos antigos passam a
 * DERIVAR dele, pra cliente antigo e novo concordarem: trigger/triggerArg =
 * os do expected; blockTypes = os da LLM que ficaram com posição (+ o
 * gatilho, se ela o listou); minCounts[T] = quantos T existem nos scripts do
 * mesmo escopo do cliente legado (mesmo gatilho; mesma mensagem se houver)
 * ANTES deste script + os deste script até a última posição coberta de T
 * (só > 1); blockArgs = os já calculados por fillBlockArgs, menos tipos que
 * saíram de blockTypes ou cujo valor não bate com TODAS as posições cobertas
 * daquele tipo; triggerExclusive recalculado pro novo escopo.
 */
function buildExpectedForHints(hints, projectJson, options) {
    const opts = options || {};
    const manifest = opts.manifest || computeDetailedManifest(projectJson);
    const reconcileLegacy = opts.reconcileLegacy !== false;
    const out = JSON.parse(JSON.stringify(Array.isArray(hints) ? hints : []));
    const report = [];

    const charactersByKey = new Map();
    for (const scene of (manifest && manifest.scenes) || []) {
        const copies = new Map();
        for (const character of scene.characters || []) {
            const copy = (copies.get(character.characterMd5) || 0) + 1;
            copies.set(character.characterMd5, copy);
            charactersByKey.set(characterKey(scene.sceneMd5, scene.sceneOccurrence, character.characterMd5, copy), character);
        }
    }

    // Ponteiros da LLM saem de TODA dica (nunca ficam gravados).
    const entries = [];
    out.forEach((hint, index) => {
        const when = hint && hint.when;
        if (!when || typeof when !== 'object') return;
        const pointers = { scriptRef: when.scriptRef, blockIndices: when.blockIndices };
        delete when.scriptRef;
        delete when.blockIndices;
        delete when.expected;
        if (when.type !== 'character_missing_block_type') return;
        const key = characterKey(when.sceneMd5, when.sceneOccurrence, when.characterMd5, when.characterOccurrence);
        entries.push({ index, hint, key, pointers });
    });

    const coveredByScript = new Map(); // key + '@' + s -> Set<índice do professor>
    const takenIn = (key, s) => {
        const k = `${key}@${s}`;
        if (!coveredByScript.has(k)) coveredByScript.set(k, new Set());
        return coveredByScript.get(k);
    };

    const built = []; // {entry, character, s, covered, legacyWhen}
    entries.forEach((entry, e) => {
        const when = entry.hint.when;
        const character = charactersByKey.get(entry.key);
        const scripts = character && Array.isArray(character.scripts) ? character.scripts : [];
        if (!scripts.length) {
            report.push({ index: entry.index, status: 'legacy', reason: 'no_character' });
            return;
        }
        const types = (Array.isArray(when.blockTypes) ? when.blockTypes : []).filter((t) => typeof t === 'string');
        const triggerTypes = types.filter((t) => TRIGGER_BLOCK_TYPES.has(t));
        const bodyTypes = [...new Set(types.filter((t) => !TRIGGER_BLOCK_TYPES.has(t)))];
        const triggerOk = (script) => triggerTypes.length === 0 || triggerTypes.includes(script.trigger);
        // Regra 4: alguma dica posterior do mesmo personagem-cópia pede o tipo?
        const laterWants = (type) => entries.slice(e + 1).some((other) =>
            other.key === entry.key && Array.isArray(other.hint.when.blockTypes) && other.hint.when.blockTypes.includes(type));
        const freeOf = (s, type) => {
            const taken = takenIn(entry.key, s);
            const positions = [];
            (scripts[s].tokens || []).forEach((t, i) => {
                if (t.type === type && isCoverable(t) && !taken.has(i)) positions.push(i);
            });
            return positions;
        };
        const laterTypes = new Set();
        entries.slice(e + 1).forEach((other) => {
            if (other.key !== entry.key || !Array.isArray(other.hint.when.blockTypes)) return;
            other.hint.when.blockTypes.forEach((t) => laterTypes.add(t));
        });
        const fallbackFor = (s, type, already) => {
            const free = freeOf(s, type).filter((i) => !already.includes(i));
            if (!free.length) return [];
            if (laterWants(type)) return [free[0]];
            // Absorve só até a próxima posição livre de um tipo que uma dica
            // POSTERIOR ensina (regra 4b): "diga Fala 2" não engole as falas
            // que vêm depois do `message` da dica seguinte.
            const taken = takenIn(entry.key, s);
            let boundary = Infinity;
            (scripts[s].tokens || []).forEach((t, i) => {
                if (i > free[0] && i < boundary && laterTypes.has(t.type) && isCoverable(t) && !taken.has(i)) boundary = i;
            });
            return free.filter((i) => i < boundary);
        };

        let s = -1;
        let covered = [];
        let source = 'fallback';

        // Regra 2 - ponteiros da LLM.
        const ref = parseScriptRef(entry.pointers.scriptRef, scripts.length);
        if (ref >= 0 && triggerOk(scripts[ref]) && bodyTypes.length === 0) {
            // Só gatilho em blockTypes ("crie o script quando receber X"):
            // o script apontado basta, covered [].
            s = ref;
            source = 'llm';
        } else if (ref >= 0 && triggerOk(scripts[ref]) && Array.isArray(entry.pointers.blockIndices)) {
            const tokens = scripts[ref].tokens || [];
            const taken = takenIn(entry.key, ref);
            const picked = [];
            for (const n of entry.pointers.blockIndices) {
                const i = Number.isInteger(n) ? n - 1 : -1;
                const t = tokens[i];
                if (!t || !bodyTypes.includes(t.type) || !isCoverable(t) || taken.has(i) || picked.includes(i)) continue;
                picked.push(i);
            }
            if (picked.length) {
                for (const type of bodyTypes) {
                    if (!picked.some((i) => tokens[i].type === type)) picked.push(...fallbackFor(ref, type, picked));
                }
                s = ref;
                covered = picked;
                source = 'llm';
            }
        }

        // Regra 3/4 - fallback por tipos.
        if (s < 0) {
            for (let k = 0; k < scripts.length && s < 0; k++) {
                if (!triggerOk(scripts[k])) continue;
                if (bodyTypes.every((type) => freeOf(k, type).length > 0)) s = k;
            }
            if (s < 0) {
                report.push({ index: entry.index, status: 'legacy', reason: 'no_script' });
                return;
            }
            covered = [];
            for (const type of bodyTypes) covered.push(...fallbackFor(s, type, covered));
        }

        covered = [...new Set(covered)].sort((a, b) => a - b);
        const taken = takenIn(entry.key, s);
        covered.forEach((i) => taken.add(i));

        const script = scripts[s];
        const expectedScript = toExpectedTokens(script.tokens);
        const triggerArg = script.trigger === 'onmessage' && script.triggerArg != null ? script.triggerArg : null;
        const expected = { trigger: script.trigger, triggerArg, script: expectedScript, covered };
        // Regra 6 - scripts idênticos do mesmo personagem.
        const sig = (sc) => JSON.stringify([sc.trigger, sc.trigger === 'onmessage' ? sc.triggerArg : null, toExpectedTokens(sc.tokens)]);
        const mySig = sig(script);
        const twins = scripts.map((sc, k) => (sig(sc) === mySig ? k : -1)).filter((k) => k >= 0);
        if (twins.length >= 2) expected.occurrence = twins.indexOf(s) + 1;

        const legacyWhen = JSON.parse(JSON.stringify(when));
        when.expected = expected;
        if (reconcileLegacy) reconcileLegacyFields(when, character, script, s, covered);
        built.push({ entry, legacyWhen, source });
    });

    // Regra 7 - validação contra o PRÓPRIO projeto do professor.
    const failed = new Map(); // index -> resultado do alinhamento
    for (let round = 0; round < built.length + 1; round++) {
        const live = built.filter((b) => !failed.has(b.entry.index));
        if (!live.length) break;
        const evalHints = live.map((b) => ({ id: `__${b.entry.index}`, when: b.entry.hint.when }));
        const results = evaluateExpectedHints(evalHints, manifest);
        let changed = false;
        for (const b of live) {
            const r = results.get(`__${b.entry.index}`);
            if (!r || r.state !== 'done') {
                failed.set(b.entry.index, r || { state: 'missing_result' });
                b.entry.hint.when = b.legacyWhen; // volta EXATAMENTE ao legado de antes
                changed = true;
            }
        }
        if (!changed) break;
    }

    for (const b of built) {
        if (failed.has(b.entry.index)) {
            report.push({ index: b.entry.index, status: 'legacy', reason: 'not_done', detail: failed.get(b.entry.index) });
        } else {
            report.push({ index: b.entry.index, status: 'expected', source: b.source });
        }
    }
    report.sort((a, b) => a.index - b.index);
    return { hints: out, report };
}

/**
 * Reescreve os campos legados de uma dica de bloco a partir do expected que
 * acabou de ganhar (ver "Legado" no docblock de buildExpectedForHints).
 * `script` = character.scripts[s] do manifesto do professor.
 */
function reconcileLegacyFields(when, character, script, s, covered) {
    const tokens = script.tokens || [];
    const coveredTypes = new Set(covered.map((i) => tokens[i].type));
    const types = (Array.isArray(when.blockTypes) ? when.blockTypes : []).filter((t) =>
        coveredTypes.has(t) || t === script.trigger);
    when.blockTypes = [...new Set(types)];

    delete when.trigger;
    delete when.triggerArg;
    delete when.minCounts;
    delete when.triggerExclusive;
    when.trigger = script.trigger;
    const triggerArg = script.trigger === 'onmessage' && script.triggerArg != null ? script.triggerArg : null;
    if (triggerArg !== null) when.triggerArg = triggerArg;

    // Escopo do cliente legado (HintEngine.js#blockMatch): mesmo gatilho e,
    // se triggerArg, mesma mensagem.
    const scripts = character.scripts || [];
    const inScope = (sc) => sc.trigger === script.trigger && (triggerArg === null || sc.triggerArg === triggerArg);
    const minCounts = {};
    for (const type of coveredTypes) {
        let n = 0;
        for (let k = 0; k < s; k++) {
            if (inScope(scripts[k])) n += (scripts[k].blocks || []).filter((b) => b.type === type).length;
        }
        const last = Math.max(...covered.filter((i) => tokens[i].type === type));
        // say unset (texto padrão) não existe em `blocks` - não conta, pra
        // nunca exigir mais do que o professor tem pro cliente legado.
        for (let i = 0; i <= last; i++) {
            if (tokens[i].type === type && !(type === 'say' && tokens[i].unset)) n++;
        }
        if (n > 1) minCounts[type] = n;
    }
    if (Object.keys(minCounts).length) when.minCounts = minCounts;

    if (when.blockArgs && typeof when.blockArgs === 'object') {
        for (const type of Object.keys(when.blockArgs)) {
            const nums = covered.filter((i) => tokens[i].type === type).map((i) => tokens[i].num);
            if (!coveredTypes.has(type) || !nums.every((v) => v === when.blockArgs[type])) delete when.blockArgs[type];
        }
    }

    const key = triggerKeyOf(script);
    const exclusive = [...coveredTypes].every((type) => scripts.every((sc) =>
        triggerKeyOf(sc) === key || !(sc.blocks || []).some((b) => b.type === type)));
    if (exclusive && coveredTypes.size > 0) when.triggerExclusive = true;
}

/**
 * Dica de apresentação da missão - achado em teste real (professor sentiu
 * falta de uma abertura contextualizando "o desafio de hoje"). Ao contrário
 * de todas as outras, NUNCA vem da LLM - é montada aqui, em código, garantida
 * sempre presente (mesma lição das outras redes de segurança: uma regra só
 * no prompt já foi ignorada antes, e esta é importante demais - a PRIMEIRA
 * coisa que o aluno vê - pra correr esse risco). Prefere o hintContext
 * (texto livre do professor, ver docblock do topo) quando houver; cai pro
 * nome do projeto senão; cai pra um texto genérico se nem isso existir.
 * `when: {type: 'mission_intro'}` não referencia cena/personagem nenhum -
 * a condição do lado do aluno (AssignmentBadge.js) é sempre verdadeira até
 * ele fechar, então é sempre a PRIMEIRA dica mostrada (ver generateHints,
 * sempre inserida no início do array final).
 */
/**
 * Rede de segurança pra regra "PROIBIDO travessão" do SYSTEM_PROMPT (mesma
 * lição das outras redes: regra só no prompt já foi ignorada pela LLM antes -
 * travessão é um vício típico de texto gerado por IA). Troca "—"/"–" (e o
 * espaço em volta) por ", ". Exportada porque activityGeneration.js aplica a
 * mesma limpeza nos textos da atividade (nome/descrição).
 */
function stripDashes(text) {
    return typeof text === 'string' ? text.replace(/\s*[\u2014\u2013]\s*/g, ', ') : text;
}

/**
 * Rede de segurança - achado em teste real [2026-10]: a regra "PERSONAGEM
 * CRIS É UM MENINO" no SYSTEM_PROMPT (ver lá) não é garantia nenhuma, mesma
 * lição já aprendida com todas as outras redes de segurança deste arquivo
 * (ensureFirstHintIsSceneMissing, fillMissingDefaultCharacterHints etc.) - a
 * LLM continuava gerando "a Cris"/"essa Cris" mesmo com a instrução
 * explícita no prompt. Corrige DETERMINISTICAMENTE, por regex, o artigo/
 * pronome demonstrativo logo antes do nome "Cris" pra forma masculina -
 * escopo bem estreito de propósito (só a combinação artigo+nome, nunca um
 * pronome solto como "ela"/"dela" sem o nome ao lado, que exigiria resolver
 * a quem o pronome se refere - risco de reescrever errado algo que já
 * estava certo). Preserva a capitalização da primeira letra do artigo
 * (inicio de frase vs. meio de frase).
 */
// (^|\s) em vez de \b antes do artigo - \b do JS não reconhece 'à'/'À' como
// caractere de palavra, então \b nunca "fecha a fronteira" antes dele e o
// padrão de "à Cris" nunca batia (achado testando os casos manualmente).
const CRIS_GENDER_FIXES = [
    [/(^|\s)([Aa])\s+Cris\b/g, (m, pre, art) => pre + (art === 'A' ? 'O' : 'o') + ' Cris'],
    [/(^|\s)([Àà])\s+Cris\b/g, (m, pre, art) => pre + (art === 'À' ? 'Ao' : 'ao') + ' Cris'],
    [/(^|\s)([Dd])a\s+Cris\b/g, (m, pre, art) => pre + art + 'o Cris'],
    [/(^|\s)([Pp])ela\s+Cris\b/g, (m, pre, art) => pre + art + 'elo Cris'],
    [/(^|\s)([Ee])ssa\s+Cris\b/g, (m, pre, art) => pre + art + 'sse Cris'],
    [/(^|\s)([Aa])quela\s+Cris\b/g, (m, pre, art) => pre + art + 'quele Cris'],
];

function fixKnownCharacterGender(text) {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const [pattern, replacer] of CRIS_GENDER_FIXES) {
        result = result.replace(pattern, replacer);
    }
    return result;
}

const INTRO_MAX_LENGTH = 200;
const INTRO_FALLBACK_CONTEXT_MAX_LENGTH = 140;

function buildIntroHint(hintContext, projectName, llmIntro) {
    // Chamada pra ação escrita pela LLM a partir do nome+contexto (ver campo
    // "intro" do SYSTEM_PROMPT) - só usada se vier texto de verdade e curto;
    // qualquer coisa fora disso cai no texto montado por código abaixo, então
    // a primeira dica NUNCA fica sem texto (mesma lição das outras redes de
    // segurança). É só texto de apresentação: não referencia nenhum
    // identificador técnico, então não há o que validar contra o manifesto.
    const trimmedIntro = typeof llmIntro === 'string' ? llmIntro.trim() : '';
    if (trimmedIntro && trimmedIntro.length <= INTRO_MAX_LENGTH) {
        return { text: trimmedIntro, when: { type: 'mission_intro' } };
    }

    const trimmedContext = typeof hintContext === 'string' ? hintContext.trim() : '';
    // Contexto longo (ex.: a descrição de vários parágrafos gerada por IA)
    // não cabe como abertura - cai pro nome do projeto em vez de despejar o
    // texto inteiro na cara da criança.
    const useContext = trimmedContext && trimmedContext.length <= INTRO_FALLBACK_CONTEXT_MAX_LENGTH;
    const text = useContext
        ? `📋 Desafio de hoje: ${trimmedContext}`
        : (projectName ? `🎯 Hoje vamos construir: ${projectName}!` : '🎯 Vamos começar uma nova missão!');
    return { text, when: { type: 'mission_intro' } };
}

/**
 * Núcleo único do pipeline (transcript -> LLM -> validação contra o
 * manifesto real -> redes de segurança de fillBlockArgs/
 * fillMissingCharacterAddedHints/fillMissingDefaultCharacterHints) -
 * refatoração Fase 2: generateHints() e generateHintsWithProvider() eram
 * ~75 linhas quase idênticas, duplicadas só porque uma fixava o provider
 * (DeepSeek/DEEPSEEK_MODEL via client OpenAI direto) e a outra delegava pro
 * provider configurável de llmProvider.js - a única diferença real entre
 * elas. Unificado aqui: QUEM chama este núcleo decide o provider/model (ou
 * deixa explícito, ou deixa callLLM() cair no default de
 * ACTIVITY_GENERATION_PROVIDER) - toda mudança de regra do pipeline agora
 * só precisa ser feita uma vez.
 *
 * @param {object} projectJson - the teacher's PARSED (already JSON.parse()'d)
 *   reference project, same shape computeDetailedManifest() expects.
 * @param {string} [hintContext] - optional free text the TEACHER wrote
 *   (assignments.hint_context, see routes/assignments.js) describing the
 *   project's theme/intent - prepended to the user message as a labeled
 *   block the LLM is told to treat as tone/context only, never as a source
 *   of technical identifiers (see SYSTEM_PROMPT). Empty/whitespace-only is
 *   treated as "none" and omitted entirely. Also feeds buildIntroHint() when
 *   present (preferred over projectName there).
 * @param {string} [projectName] - the reference project's name (assignments.
 *   project_name / projects.name) - fallback source for buildIntroHint()'s
 *   text when hintContext is empty.
 * @param {'deepseek'|'anthropic'} [provider] - repassado pra llmProvider.js#callLLM;
 *   omitido usa o default de ACTIVITY_GENERATION_PROVIDER.
 * @param {string} [model] - idem, pro modelo.
 * @returns {Promise<{ hints: Array<{ id: string, text: string, when: object }> }>}
 * @throws with err.code === 'NOT_CONFIGURED' when the chosen provider's API
 *   key is unset; throws a plain Error (unparseable/empty LLM response, API
 *   call failure) otherwise. Never returns hallucinated/invalid hints - see
 *   isHintValid().
 */
async function generateHintsCore(projectJson, hintContext, projectName, provider, model) {
    const manifest = computeDetailedManifest(projectJson);
    const transcript = buildTranscript(manifest, projectJson);
    const introHint = buildIntroHint(hintContext, projectName);

    if (!transcript) {
        // Nothing describable yet (empty project, or nothing with a real
        // asset md5 set) - no point spending an LLM call on it, mas a dica
        // de apresentação ainda faz sentido sozinha.
        return { hints: [{ id: 'h1', text: introHint.text, when: introHint.when }] };
    }

    const trimmedContext = typeof hintContext === 'string' ? hintContext.trim() : '';
    const baseMessage = trimmedContext
        ? `CONTEXTO DO PROFESSOR:\n${trimmedContext}\n\nTRANSCRIÇÃO DO PROJETO:\n${transcript}`
        : transcript;
    // Depois da transcrição (não antes) pra não mexer no formato que o resto
    // do prompt já descreve - só alimenta o campo "intro" da resposta.
    const userMessage = projectName ? `${baseMessage}\n\nNOME DA ATIVIDADE: ${projectName}` : baseMessage;

    let rawContent;
    try {
        rawContent = await callLLM({ systemPrompt: SYSTEM_PROMPT, userMessage, temperature: 0.7, provider, model });
    } catch (err) {
        if (err.code === 'NOT_CONFIGURED') throw err;
        throw new Error('Falha ao chamar a API de geração de dicas: ' + err.message);
    }

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

    const withOccurrence = fillCharacterOccurrence(validHints, manifest);
    const withBlockArgs = fillBlockContext(fillBlockArgs(withOccurrence, manifest), manifest);
    const withCharacterAddedHints = fillMissingCharacterAddedHints(withBlockArgs, manifest);
    const withDefaultCharacterHints = fillMissingDefaultCharacterHints(withCharacterAddedHints, manifest);
    // Fase 3 (E6b): when.expected por código (scriptRef/blockIndices da LLM
    // são só ponteiros; script/valores vêm do projeto) + validação de que
    // toda dica com expected dá 'done' no PRÓPRIO projeto do professor - ver
    // buildExpectedForHints. Por último entre as etapas de dica, pra ver a
    // lista final (inclusive as injetadas, que não são de bloco).
    const withExpected = buildExpectedForHints(withDefaultCharacterHints, projectJson, { manifest });
    for (const entry of withExpected.report) {
        if (entry.status === 'legacy' && entry.reason === 'not_done') {
            console.warn('[hintsGeneration] when.expected removido (não dá done no projeto do professor):', entry.detail);
        }
    }
    const withIntro = [buildIntroHint(hintContext, projectName, parsed && parsed.intro), ...withExpected.hints];

    const hints = withIntro.map((hint, idx) => ({
        id: `h${idx + 1}`,
        text: fixKnownCharacterGender(stripDashes(hint.text)),
        when: hint.when,
    }));

    return { hints };
}

/**
 * Caminho já validado em produção pra routes/assignments.js (professor que
 * monta o projeto de exemplo à mão) - SEMPRE DeepSeek/DEEPSEEK_MODEL,
 * explicitamente, nunca afetado por ACTIVITY_GENERATION_PROVIDER (que outra
 * feature - geração de atividade por tema, ver generateHintsWithProvider -
 * pode mudar pra 'anthropic' sem que este caminho sinta nada).
 *
 * @see generateHintsCore pros parâmetros/retorno/erros.
 */
function generateHints(projectJson, hintContext, projectName) {
    return generateHintsCore(projectJson, hintContext, projectName, 'deepseek', DEEPSEEK_MODEL);
}

/**
 * Mesmo pipeline de generateHints(), mas com o provider CONFIGURÁVEL de
 * llmProvider.js - usada pela geração de atividade por tema (ver
 * activityGeneration.js/routes/share.js), que decidiu deixar o mesmo
 * provider escolhido pra gerar a atividade também gerar as dicas dela.
 *
 * @see generateHintsCore pros parâmetros/retorno/erros.
 */
function generateHintsWithProvider(projectJson, hintContext, projectName, provider, model) {
    return generateHintsCore(projectJson, hintContext, projectName, provider, model);
}

module.exports = {
    generateHints, generateHintsWithProvider, stripDashes, fillBlockContext, fillCharacterOccurrence,
    // Fase 3 (E6b): buildExpectedForHints é reusada pela migração
    // (backend/scripts/backfillHintExpected.js); buildTranscript exportada
    // pros testes do formato numerado.
    buildExpectedForHints, buildTranscript,
};
