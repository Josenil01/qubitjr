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
 *   5.5. fillMissingDefaultCharacterHints() - a SECOND safety net, this one
 *      for completeness rather than hallucination: injects a
 *      default_character_present hint (code-generated text) for any scene
 *      where the LLM's "OBRIGATÓRIO" prompt rule was ignored - see that
 *      function's docblock.
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
    'default_character_present',
]);

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
- Frases CURTAS e diretas, como se estivesse falando com a criança ao vivo, não escrevendo um manual. Varie a construção da frase entre as dicas - nem toda dica precisa começar com "Que tal..."; use também formas como "Agora...", "Vamos...", perguntas diretas ("Você consegue...?"), etc.
- SEMPRE que a transcrição der um nome ao personagem (ex.: "Ruby", "Allan"), use esse nome na dica - nunca diga "o personagem" ou "esse personagem" genericamente quando um nome estiver disponível. Depois da primeira menção a um personagem numa dica, pode usar pronome (ele/ela) se ficar natural.
- Preste atenção às anotações da transcrição tipo "(X não aparece mais nesta cena...)" e "(Y é personagem novo nesta cena...)" - quando isso acontecer entre uma cena e a seguinte, a dica sobre adicionar o personagem novo deve mencionar a troca de forma natural (ex.: "Agora troque a Ruby pelo Allan aqui" ou "Nessa cena é a vez do Allan"), em vez de simplesmente ignorar que o personagem anterior sumiu.
- Quando um personagem tiver um bloco "say" com texto real na transcrição (ex.: say["Olá, primavera!"]), a dica sobre esse personagem falar algo deve sugerir ESSA fala exata (ex.: "Que tal fazer a Ruby dizer 'Olá, primavera!'?"), não uma fala genérica inventada - é a fala que o professor realmente usou no exemplo.
- OBRIGATÓRIO: gere uma dica "scene_missing" pra CADA cena da transcrição, sem exceção (inclusive a primeira, e inclusive quando o mesmo fundo já apareceu antes em outra cena - ver regra de "sceneOccurrence" abaixo) - nunca pule direto pras dicas de personagem de uma cena sem antes ter uma dica pedindo pra trocar/escolher aquele cenário. Coloque a dica "scene_missing" de uma cena SEMPRE antes das dicas dos personagens daquela mesma cena na lista.
- Não existe limite de quantidade de dicas - gere uma pra cada passo de construção realmente relevante da transcrição inteira, mesmo que o projeto seja grande. Não corte cenas nem personagens pra caber num teto.
- Quando uma cena reusa um fundo que já apareceu antes (a transcrição anota isso, ver "REGRA DE CENA REPETIDA" abaixo), a dica "scene_missing" dela deve deixar claro que é pra trazer aquele cenário DE VOLTA/DE NOVO (ex.: "Vamos voltar pro bosque agora?"), não repetir o mesmo texto de quando ele apareceu a primeira vez.
- Quando o nome de um personagem vier seguido de um número (ex.: "Casa 2" em vez de só "Casa" - acontece quando o MESMO nome se repete em mais de uma instância no projeto inteiro, ver "REGRA DE NOME REPETIDO" abaixo), use o nome JUNTO com esse número no texto da dica (ex.: "adicione a Casa 2 aqui"), nunca omita o número - é o que diferencia essa instância das outras com o mesmo nome pro aluno.
- OBRIGATÓRIO: pra CADA cena da transcrição que NÃO tiver a Ruby (HY-Ruby.svg) na lista de personagens dela, gere também uma dica "default_character_present" pra essa cena (ver formato abaixo) - a Ruby aparece sozinha em toda cena nova que o aluno criar, então ele precisa ser lembrado de apagá-la quando ela não faz parte do projeto de verdade ali. Coloque essa dica logo depois da dica "scene_missing" daquela cena, antes das dicas dos personagens de verdade. NUNCA gere essa dica pra uma cena que TEM a Ruby na lista de personagens - lá ela faz parte do projeto de verdade.
- As dicas devem estar em português do Brasil (pt-BR).
- Se a mensagem trouxer um bloco "CONTEXTO DO PROFESSOR" antes da transcrição, use-o pra entender melhor o TEMA/INTENÇÃO do projeto (ex.: é sobre folclore brasileiro, cada cena é uma casa diferente, etc.) e deixar o texto das dicas mais alinhado com isso. Esse contexto é só pra tom/entendimento - os identificadores técnicos (sceneMd5/characterMd5/messageName/sceneOccurrence) e os fatos sobre o que existe no projeto continuam vindo EXCLUSIVAMENTE da transcrição estruturada, nunca do contexto livre (que pode estar incompleto ou desatualizado).

Regras de formato - responda APENAS com um JSON estrito, sem crases/markdown, sem nenhum texto fora do JSON, exatamente neste formato:

{"hints": [{"text": "...", "when": {"type": "...", ...campos...}}, ...]}

ATENÇÃO - erro comum a evitar: cada personagem na transcrição aparece como \`"Nome" [characterMd5: valor.svg]\`. "Nome" é só pra você usar no TEXTO da dica (pra soar natural, "a Ruby precisa..."). "characterMd5" é um IDENTIFICADOR TÉCNICO que você deve copiar EXATAMENTE (incluindo a extensão .svg) pro campo "characterMd5" do "when" - NUNCA coloque o nome ali. O mesmo vale pra "sceneMd5" (copie o valor depois de "fundo:", tipo "Spring.svg") e "messageName" (copie o valor exato entre colchetes de message[...]/onmessage[...]).

REGRA DE NOME DE CENA: quando a linha da cena trouxer \`nome exibido ao aluno: "X"\`, use EXATAMENTE esse nome X no texto da dica (é o nome que o aluno vê na tela pra escolher aquele fundo) - nunca traduza ou invente uma palavra diferente a partir do nome do arquivo (sceneMd5). Se essa anotação não aparecer pra uma cena, não há nome oficial conhecido; descreva o cenário de forma genérica sem inventar um nome específico.

REGRA DE CENA REPETIDA: cada cena na transcrição também traz um número de ocorrência entre colchetes, tipo \`[sceneOccurrence: 2]\` - é 1 na primeira vez que aquele fundo aparece no projeto, 2 se for a segunda cena a reusar o MESMO fundo, etc. Copie esse número EXATAMENTE pro campo "sceneOccurrence" de todo "when" com escopo de cena (scene_missing, character_missing, character_no_script, character_missing_block_type, default_character_present) - mesmo quando for 1. Isso é o que permite duas dicas sobre o mesmo fundo (a cena aparecendo de novo mais adiante na história) serem tratadas como passos DIFERENTES e não uma só.

REGRA DE NOME REPETIDO: quando o MESMO nome de personagem aparece em mais de uma instância no projeto inteiro (ex.: a mesma "Casa" numa cena e de novo em outra), cada instância aparece na transcrição com um número junto do nome, tipo \`"Casa 2" [characterMd5: ...]\` - use o nome JUNTO com esse número no texto da dica (ver regra de tom acima). Um nome que aparece só uma vez no projeto NUNCA vem com número - não invente um.

Exemplo de transcrição de entrada e a saída correta correspondente:
Entrada:
  Cena 1 (fundo: Spring.svg, nome exibido ao aluno: "Primavera") [sceneOccurrence: 1]:
    - "Ruby" [characterMd5: HY-Ruby.svg]: tem script (blocos: onflag, say["Olá, primavera!"])
  Cena 2 (fundo: Summer.svg, nome exibido ao aluno: "Verão") [sceneOccurrence: 1]:
    - "Allan" [characterMd5: HY-Allan.svg]: sem script ainda
    (Ruby não aparece mais nesta cena, comparado com a cena anterior)
    (Allan é personagem novo nesta cena, não estava na cena anterior)
  Cena 3 (fundo: Spring.svg, nome exibido ao aluno: "Primavera") [sceneOccurrence: 2]:
    - "Ruby" [characterMd5: HY-Ruby.svg]: tem script (blocos: onflag, say["Voltei!"])
Saída correta pra essas três cenas (nesta ordem - reparem que a dica de cena vem ANTES das dicas de personagem de cada cena, a fala sugerida é a MESMA que o exemplo já usa, o nome "Primavera" é usado literalmente como veio da transcrição, e a Cena 3 tem sceneOccurrence 2 e um texto que deixa claro que é um RETORNO, não a primeira vez):
  {"text": "Que tal escolher o cenário da Primavera pra começar?", "when": {"type": "scene_missing", "sceneMd5": "Spring.svg", "sceneOccurrence": 1}}
  {"text": "Agora faça a Ruby dizer 'Olá, primavera!' quando a bandeira verde for tocada.", "when": {"type": "character_missing_block_type", "sceneMd5": "Spring.svg", "sceneOccurrence": 1, "characterMd5": "HY-Ruby.svg", "blockTypes": ["say"]}}
  {"text": "Vamos mudar pro cenário de Verão agora?", "when": {"type": "scene_missing", "sceneMd5": "Summer.svg", "sceneOccurrence": 1}}
  {"text": "Nessa cena é a vez do Allan - a Ruby não aparece mais aqui.", "when": {"type": "character_missing", "sceneMd5": "Summer.svg", "sceneOccurrence": 1, "characterMd5": "HY-Allan.svg"}}
  {"text": "Vamos voltar pra Primavera de novo?", "when": {"type": "scene_missing", "sceneMd5": "Spring.svg", "sceneOccurrence": 2}}
  {"text": "Dessa vez a Ruby diz 'Voltei!' - pode fazer ela falar isso?", "when": {"type": "character_missing_block_type", "sceneMd5": "Spring.svg", "sceneOccurrence": 2, "characterMd5": "HY-Ruby.svg", "blockTypes": ["say"]}}

O campo "when.type" deve ser exatamente um destes valores, com exatamente estes campos (usando SOMENTE os identificadores sceneMd5/characterMd5/messageName/sceneOccurrence que aparecem literalmente na transcrição recebida, sempre copiados por extenso incluindo extensão de arquivo quando houver - nunca invente um valor que não esteja lá, e nunca substitua um identificador pelo nome do personagem):
- "scene_missing": {"type":"scene_missing","sceneMd5":"<da transcrição>","sceneOccurrence":<da transcrição>}
- "character_missing": {"type":"character_missing","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"..."}
- "character_no_script": {"type":"character_no_script","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"..."}
- "character_missing_block_type": {"type":"character_missing_block_type","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"...","blockTypes":["forward","hop", ...]} - blockTypes é a lista de tipos de bloco de movimento/ação que, juntos, satisfariam essa dica (ex.: todos os blocos de movimento do ScratchJr juntos se a dica for sobre "andar": forward,back,up,down,left,right,hop; ou um único tipo, como ["say"], se a dica for sobre "falar")
- "message_not_received": {"type":"message_not_received","messageName":"..."}
- "default_character_present": {"type":"default_character_present","sceneMd5":"...","sceneOccurrence":<...>,"characterMd5":"HY-Ruby.svg"} - characterMd5 é SEMPRE "HY-Ruby.svg" pra este tipo (é o personagem default, nunca outro) - só gere pra cenas que NÃO têm a Ruby na lista de personagens (ver regra OBRIGATÓRIA acima).

Exemplo rápido de "default_character_present" (cena SEM a Ruby na transcrição) e "REGRA DE NOME REPETIDO" (a mesma "Casa" reaparecendo):
Entrada (trecho):
  Cena 1 (fundo: Woods.svg, nome exibido ao aluno: "Bosque") [sceneOccurrence: 1]:
    - "Lobisomem" [characterMd5: HY-Lobsomem.svg]: tem script (blocos: onflag, say["Au!"])
    - "Casa 1" [characterMd5: HY-Casa2.svg]: sem script ainda
  Cena 2 (fundo: Woods.svg, nome exibido ao aluno: "Bosque") [sceneOccurrence: 2]:
    - "Casa 2" [characterMd5: HY-Casa2.svg]: sem script ainda
Saída correta (repare: dica default_character_present logo após scene_missing, ANTES das dicas de personagem; "Casa 1"/"Casa 2" usados com o número; a Ruby não aparece em nenhuma das duas cenas, então as duas ganham a dica):
  {"text": "Que tal escolher o cenário do Bosque pra começar?", "when": {"type": "scene_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 1}}
  {"text": "A Ruby aparece sozinha aqui - pode apagar ela, essa cena não é dela!", "when": {"type": "default_character_present", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Ruby.svg"}}
  {"text": "Faça o Lobisomem dizer 'Au!' quando a bandeira verde for tocada.", "when": {"type": "character_missing_block_type", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Lobsomem.svg", "blockTypes": ["say"]}}
  {"text": "Agora adicione a Casa 1 no Bosque.", "when": {"type": "character_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 1, "characterMd5": "HY-Casa2.svg"}}
  {"text": "Vamos voltar pro Bosque de novo?", "when": {"type": "scene_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 2}}
  {"text": "De novo, apague a Ruby - essa cena também não é dela!", "when": {"type": "default_character_present", "sceneMd5": "Woods.svg", "sceneOccurrence": 2, "characterMd5": "HY-Ruby.svg"}}
  {"text": "Agora adicione a Casa 2 aqui também.", "when": {"type": "character_missing", "sceneMd5": "Woods.svg", "sceneOccurrence": 2, "characterMd5": "HY-Casa2.svg"}}

Gere uma dica por passo de construção realmente relevante da transcrição INTEIRA, sem se preocupar com uma quantidade máxima. Ordene o array "hints" seguindo a mesma ordem da transcrição (a ordem natural de construção).`;

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
function characterDescriptor(character, number) {
    const namePart = character.characterName
        ? `"${character.characterName}${number ? ' ' + number : ''}" `
        : '';
    return `${namePart}[characterMd5: ${character.characterMd5}]`;
}

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
        if (blockType === 'message' || blockType === 'onmessage' || blockType === 'say') continue; // rendered below, with their real content
        parts.push(blockType);
    }
    for (const name of character.messagesSent) parts.push(`message["${name}"]`);
    for (const name of character.messagesReceived) parts.push(`onmessage["${name}"]`);
    // Texto literal de cada say, na ordem em que aparece - sem isto a LLM só
    // sabia "existe um say em algum lugar" e tinha que inventar uma fala
    // genérica em vez de sugerir a que o professor realmente usou (pedido
    // explícito depois de ver o segundo lote de dicas geradas).
    for (const text of character.sayTexts) parts.push(`say["${text}"]`);
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
 */
function buildTranscript(manifest) {
    const lines = [];
    let sceneNumber = 0;
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

        sceneNumber += 1;
        const displayName = getBackgroundDisplayName(scene.sceneMd5);
        const nameFragment = displayName ? `, nome exibido ao aluno: "${displayName}"` : '';
        const occurrence = scene.sceneOccurrence || 1;
        lines.push(`Cena ${sceneNumber} (fundo: ${scene.sceneMd5}${nameFragment}) [sceneOccurrence: ${occurrence}]:`);

        const currentByMd5 = new Map(describableCharacters.map((c) => [c.characterMd5, c]));

        for (const character of describableCharacters) {
            const descriptor = characterDescriptor(character, numberFor(character));
            if (!character.hasScript) {
                lines.push(`  - ${descriptor}: sem script ainda`);
                continue;
            }
            const blocksFragment = formatBlocksFragment(character);
            lines.push(`  - ${descriptor}: tem script (blocos: ${blocksFragment})`);
        }

        if (previousByMd5) {
            const removed = [...previousByMd5.values()].filter((c) => !currentByMd5.has(c.characterMd5));
            const added = describableCharacters.filter((c) => !previousByMd5.has(c.characterMd5));
            if (removed.length) {
                lines.push(`  (${removed.map((c) => characterDescriptor(c, numberFor(c))).join(', ')} não aparece mais nesta cena, comparado com a cena anterior)`);
            }
            if (added.length) {
                lines.push(`  (${added.map((c) => characterDescriptor(c, numberFor(c))).join(', ')} é personagem novo nesta cena, não estava na cena anterior)`);
            }
        }

        previousByMd5 = currentByMd5;
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
 * os dois juntos), e a união, no projeto inteiro, de todo nome de mensagem
 * enviada.
 */
function buildValidationIndex(manifest) {
    const sceneKeySet = new Set();
    const charactersByScene = new Map(); // sceneKey(sceneMd5,occurrence) -> Set<characterMd5>
    const allMessagesSent = new Set();

    for (const scene of manifest.scenes) {
        if (!scene.sceneMd5) continue;
        const key = sceneKey(scene.sceneMd5, scene.sceneOccurrence);
        sceneKeySet.add(key);

        const charSet = charactersByScene.get(key) || new Set();
        for (const character of scene.characters) {
            if (character.characterMd5) charSet.add(character.characterMd5);
            for (const name of character.messagesSent) allMessagesSent.add(name);
        }
        charactersByScene.set(key, charSet);
    }

    return { sceneKeySet, charactersByScene, allMessagesSent };
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
        case 'character_no_script':
            return hasValidCharacter;
        case 'character_missing_block_type':
            return hasValidCharacter &&
                Array.isArray(when.blockTypes) && when.blockTypes.length > 0 &&
                when.blockTypes.every((t) => typeof t === 'string' && t.length > 0);
        case 'message_not_received':
            return typeof when.messageName === 'string' && index.allMessagesSent.has(when.messageName);
        case 'default_character_present':
            // Só válida pra uma cena REAL onde a Ruby NÃO está de verdade -
            // se ela realmente faz parte da cena do professor ali, mandar o
            // aluno apagá-la seria errado (ver docblock do topo do arquivo).
            return hasValidScene && when.characterMd5 === DEFAULT_CHARACTER_MD5 &&
                !(charsInScene && charsInScene.has(DEFAULT_CHARACTER_MD5));
        default:
            return false; // unreachable (VALID_WHEN_TYPES already filtered), kept for exhaustiveness
    }
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
            text: 'A Ruby aparece sozinha aqui - pode apagar ela, essa cena não é dela!',
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
 * @param {object} projectJson - the teacher's PARSED (already JSON.parse()'d)
 *   reference project, same shape computeDetailedManifest() expects.
 * @param {string} [hintContext] - optional free text the TEACHER wrote
 *   (assignments.hint_context, see routes/assignments.js) describing the
 *   project's theme/intent - prepended to the user message as a labeled
 *   block the LLM is told to treat as tone/context only, never as a source
 *   of technical identifiers (see SYSTEM_PROMPT). Empty/whitespace-only is
 *   treated as "none" and omitted entirely.
 * @returns {Promise<{ hints: Array<{ id: string, text: string, when: object }> }>}
 * @throws with err.code === 'NOT_CONFIGURED' when DEEPSEEK_API_KEY is unset;
 *   throws a plain Error (unparseable/empty LLM response, API call failure)
 *   otherwise. Never returns hallucinated/invalid hints - see isHintValid().
 */
async function generateHints(projectJson, hintContext) {
    const manifest = computeDetailedManifest(projectJson);
    const transcript = buildTranscript(manifest);

    if (!transcript) {
        // Nothing describable yet (empty project, or nothing with a real
        // asset md5 set) - no point spending an LLM call on it.
        return { hints: [] };
    }

    const trimmedContext = typeof hintContext === 'string' ? hintContext.trim() : '';
    const userMessage = trimmedContext
        ? `CONTEXTO DO PROFESSOR:\n${trimmedContext}\n\nTRANSCRIÇÃO DO PROJETO:\n${transcript}`
        : transcript;

    const client = getClient(); // throws NOT_CONFIGURED before any network call if unset

    let completion;
    try {
        completion = await client.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
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

    const withDefaultCharacterHints = fillMissingDefaultCharacterHints(validHints, manifest);

    const hints = withDefaultCharacterHints.map((hint, idx) => ({
        id: `h${idx + 1}`,
        text: hint.text,
        when: hint.when,
    }));

    return { hints };
}

module.exports = { generateHints };
