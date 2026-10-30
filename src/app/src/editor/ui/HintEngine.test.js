import {describe, expect, it} from 'vitest';
import {
    findSceneAndCharacter,
    blockMatch,
    hintConditionHolds,
    mistakeInfo,
    orderInfo,
    actorLabelFor,
} from './HintEngine.js';
import {ALL_WHEN_TYPES, LLM_WHEN_TYPES, MANUAL_WHEN_TYPE} from '../../../../../shared/hintSchema.mjs';
import {project, b, onflag, onclick, onmessage} from '../../../../../shared/testing/projectFixtures.mjs';
import {computeDetailedManifest} from '../../../../../shared/detailedManifest.mjs';

/**
 * Constrói um personagem no formato que detailedManifest.js#computeDetailedManifest
 * produz de verdade (ver backend/src/services/detailedManifest.test.js pro
 * fixture equivalente do lado de lá) - só os campos que os testes abaixo
 * de fato leem precisam de valor realista; o resto fica no default "vazio".
 */
function character (overrides) {
    return {
        characterMd5: null,
        characterName: null,
        hasScript: false,
        blockTypes: [],
        messagesSent: [],
        messagesReceived: [],
        sayTexts: [],
        blockSequence: [],
        blockArgs: {},
        blockCounts: {},
        scripts: [],
        ...overrides,
    };
}

function scene (overrides) {
    return {sceneMd5: null, sceneOccurrence: null, characters: [], ...overrides};
}

/** Um script {trigger, blocks} na mesma forma que buildScriptDetail produz. */
function script (trigger, blocks) {
    return {trigger, blocks};
}

describe('findSceneAndCharacter', () => {
    it('retorna scene/character null quando a cena não existe', () => {
        // `characters` (todas as cópias do personagem na cena) entrou na Fase 2 (falha F9).
        expect(findSceneAndCharacter([], 'Woods.svg', 'HY-Ruby.svg', 1)).toEqual({scene: null, character: null, characters: []});
    });

    it('desambigua cenas repetidas pelo sceneOccurrence (1-based)', () => {
        const scenes = [
            scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: [character({characterMd5: 'A.svg'})]}),
            scene({sceneMd5: 'Woods.svg', sceneOccurrence: 2, characters: [character({characterMd5: 'B.svg'})]}),
        ];
        expect(findSceneAndCharacter(scenes, 'Woods.svg', 'B.svg', 2).character.characterMd5).toBe('B.svg');
        // Pedir a 2ª ocorrência mas buscar um personagem que só existe na 1ª não bate.
        expect(findSceneAndCharacter(scenes, 'Woods.svg', 'A.svg', 2).character).toBeNull();
    });

    it('sceneOccurrence ausente se comporta como 1 (hints antigos sem o campo)', () => {
        const scenes = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: [character({characterMd5: 'A.svg'})]})];
        expect(findSceneAndCharacter(scenes, 'Woods.svg', 'A.svg', undefined).character.characterMd5).toBe('A.svg');
    });
});

describe('blockMatch', () => {
    it('typesOk exige TODOS os blockTypes (AND, não OR)', () => {
        const char = character({scripts: [script('onflag', [{type: 'wait', num: 10}])]});
        const onlyWait = blockMatch(char, {blockTypes: ['wait', 'say']});
        expect(onlyWait.typesOk).toBe(false); // falta 'say'

        const withBoth = character({scripts: [script('onflag', [{type: 'wait', num: 10}, {type: 'say', num: null}])]});
        expect(blockMatch(withBoth, {blockTypes: ['wait', 'say']}).typesOk).toBe(true);
    });

    it('argsOk exige o valor numérico exato quando blockArgs é pedido', () => {
        const char = character({scripts: [script('onflag', [{type: 'forward', num: 1}])]});
        expect(blockMatch(char, {blockTypes: ['forward'], blockArgs: {forward: 3}}).argsOk).toBe(false);
        expect(blockMatch(char, {blockTypes: ['forward'], blockArgs: {forward: 1}}).argsOk).toBe(true);
    });

    it('when.trigger escopa a checagem só aos scripts daquele gatilho', () => {
        const char = character({
            scripts: [
                script('onflag', [{type: 'wait', num: 10}]),
                script('onclick', [{type: 'grow', num: 2}]),
            ],
        });
        // 'grow' existe no personagem, mas não sob onflag.
        expect(blockMatch(char, {blockTypes: ['grow'], trigger: 'onflag'}).typesOk).toBe(false);
        expect(blockMatch(char, {blockTypes: ['grow'], trigger: 'onclick'}).typesOk).toBe(true);
    });

    it('minCounts exige N ocorrências do tipo (2º say, não só "existe algum")', () => {
        const char = character({
            scripts: [script('onflag', [{type: 'say', num: null}, {type: 'wait', num: 60}, {type: 'say', num: null}])],
        });
        expect(blockMatch(char, {blockTypes: ['say'], minCounts: {say: 2}}).typesOk).toBe(true);
        expect(blockMatch(char, {blockTypes: ['say'], minCounts: {say: 3}}).typesOk).toBe(false);
    });

    it('wrongTrigger só acusa quando when.triggerExclusive=true e o professor só usa o tipo naquele gatilho', () => {
        const char = character({scripts: [script('onclick', [{type: 'grow', num: 2}])]});
        const when = {blockTypes: ['grow'], trigger: 'onflag', triggerExclusive: true};
        const result = blockMatch(char, when);
        expect(result.typesOk).toBe(false);
        expect(result.wrongTrigger).toBe(true);

        // Sem triggerExclusive, o mesmo cenário não pode ser acusado como erro
        // (o tipo pode legitimamente existir em outro script, ver docblock).
        expect(blockMatch(char, {blockTypes: ['grow'], trigger: 'onflag'}).wrongTrigger).toBe(false);
    });

    it('distingue valor pendente (ainda não confirmado) de valor real escolhido', () => {
        const char = character({scripts: [script('onflag', [{type: 'wait', num: null, pending: 10}])]});
        const match = blockMatch(char, {blockTypes: ['wait'], blockArgs: {wait: 10}});
        expect(match.argsOk).toBe(false); // ainda não vale como "feito" - é só o padrão, não confirmado
        expect(match.pendings.wait).toEqual([10]);
        expect(match.values.wait).toBeUndefined();
    });
});

describe('hintConditionHolds', () => {
    it('scene_missing bate enquanto a ocorrência pedida ainda não existir (não só "existe uma cena qualquer com esse fundo")', () => {
        const hint = {id: 'h1', when: {type: 'scene_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 2}};
        const onlyFirst = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: []})];
        expect(hintConditionHolds(hint, {scenes: onlyFirst})).toBe(true); // só a 1ª ocorrência existe - a 2ª ainda falta

        const both = [...onlyFirst, scene({sceneMd5: 'Woods.svg', sceneOccurrence: 2, characters: []})];
        expect(hintConditionHolds(hint, {scenes: both})).toBe(false);
    });

    it('character_missing só bate se a CENA já existe mas o personagem não', () => {
        const hint = {id: 'h1', when: {type: 'character_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Allan.svg'}};
        expect(hintConditionHolds(hint, {scenes: []})).toBe(false); // cena nem existe - scene_missing cobre isso
        const sceneExists = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: []})];
        expect(hintConditionHolds(hint, {scenes: sceneExists})).toBe(true);
    });

    it('character_missing_block_type bate quando o personagem não tem NENHUM script ainda (achado em teste real 1)', () => {
        const hint = {
            id: 'h1',
            when: {type: 'character_missing_block_type', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'A.svg', blockTypes: ['say']},
        };
        const scenes = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: [character({characterMd5: 'A.svg', hasScript: false})]})];
        expect(hintConditionHolds(hint, {scenes})).toBe(true); // nunca "já resolvida" só por falta de script
    });

    it('character_missing_block_type exige TODOS os blockTypes, não só um (achado em teste real 2)', () => {
        const hint = {
            id: 'h1',
            when: {type: 'character_missing_block_type', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'A.svg', blockTypes: ['wait', 'say']},
        };
        const onlyWait = [scene({
            sceneMd5: 'Woods.svg', sceneOccurrence: 1,
            characters: [character({characterMd5: 'A.svg', hasScript: true, scripts: [script('onflag', [{type: 'wait', num: 10}])]})],
        })];
        expect(hintConditionHolds(hint, {scenes: onlyWait})).toBe(true); // falta 'say' - ainda precisa

        const both = [scene({
            sceneMd5: 'Woods.svg', sceneOccurrence: 1,
            characters: [character({
                characterMd5: 'A.svg', hasScript: true,
                scripts: [script('onflag', [{type: 'wait', num: 10}, {type: 'say', num: null}])],
            })],
        })];
        expect(hintConditionHolds(hint, {scenes: both})).toBe(false);
    });

    it('message_not_received bate só quando a mensagem foi enviada mas ninguém recebeu', () => {
        const hint = {id: 'h1', when: {type: 'message_not_received', messageName: 'gol'}};
        const noOneSent = [scene({characters: [character({messagesSent: [], messagesReceived: []})]})];
        expect(hintConditionHolds(hint, {scenes: noOneSent})).toBe(false); // nada a receber ainda

        const sentNotReceived = [scene({characters: [character({messagesSent: ['gol'], messagesReceived: []})]})];
        expect(hintConditionHolds(hint, {scenes: sentNotReceived})).toBe(true);

        const bothSides = [scene({characters: [
            character({messagesSent: ['gol'], messagesReceived: []}),
            character({messagesSent: [], messagesReceived: ['gol']}),
        ]})];
        expect(hintConditionHolds(hint, {scenes: bothSides})).toBe(false);
    });

    it('default_character_present bate enquanto a Ruby (ou o default configurado) ainda estiver na cena', () => {
        const hint = {id: 'h1', when: {type: 'default_character_present', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg'}};
        const stillThere = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: [character({characterMd5: 'HY-Ruby.svg'})]})];
        expect(hintConditionHolds(hint, {scenes: stillThere})).toBe(true);

        const removed = [scene({sceneMd5: 'Woods.svg', sceneOccurrence: 1, characters: []})];
        expect(hintConditionHolds(hint, {scenes: removed})).toBe(false);
    });

    it('mission_intro e manual sempre batem; um when.type desconhecido nunca bate', () => {
        expect(hintConditionHolds({id: 'h1', when: {type: 'mission_intro'}}, {scenes: []})).toBe(true);
        expect(hintConditionHolds({id: 'h1', when: {type: 'manual'}}, {scenes: []})).toBe(true);
        expect(hintConditionHolds({id: 'h1', when: {type: 'algo_futuro_desconhecido'}}, {scenes: []})).toBe(false);
        expect(hintConditionHolds({id: 'h1', when: null}, {scenes: []})).toBe(false);
        expect(hintConditionHolds(null, {scenes: []})).toBe(false);
    });
});

describe('mistakeInfo', () => {
    const baseWhen = {type: 'character_missing_block_type', sceneMd5: 'City.svg', sceneOccurrence: 1, characterMd5: 'HY-Carro.svg', blockTypes: ['forward'], blockArgs: {forward: 3}};
    const scenesWith = (char) => [scene({sceneMd5: 'City.svg', sceneOccurrence: 1, characters: [char]})];

    it('retorna null pra when.type que não é character_missing_block_type, ou personagem inexistente', () => {
        expect(mistakeInfo({id: 'h1', when: {type: 'scene_missing'}}, {scenes: []})).toBeNull();
        expect(mistakeInfo({id: 'h1', when: baseWhen}, {scenes: []})).toBeNull();
    });

    it('kind "value": bloco existe com valor ERRADO já escolhido pelo aluno', () => {
        const char = character({characterMd5: 'HY-Carro.svg', scripts: [script('onflag', [{type: 'forward', num: 5}])]});
        const info = mistakeInfo({id: 'h1', when: baseWhen}, {scenes: scenesWith(char)});
        expect(info).toMatchObject({kind: 'value'});
    });

    it('kind "confirm": o valor pedido já está lá, mas só como padrão pendente (ainda não confirmado)', () => {
        const char = character({characterMd5: 'HY-Carro.svg', scripts: [script('onflag', [{type: 'forward', num: null, pending: 3}])]});
        const info = mistakeInfo({id: 'h1', when: baseWhen}, {scenes: scenesWith(char)});
        expect(info).toMatchObject({kind: 'confirm'});
    });

    it('kind "fill": bloco zerado largado sem nenhum valor escolhido - inclui idleMs próprio', () => {
        const char = character({characterMd5: 'HY-Carro.svg', scripts: [script('onflag', [{type: 'forward', num: null, pending: null}])]});
        const info = mistakeInfo({id: 'h1', when: baseWhen}, {scenes: scenesWith(char)});
        expect(info).toMatchObject({kind: 'fill'});
        expect(info.idleMs).toBeGreaterThan(0);
    });

    it('kind "trigger": bloco certo existe, mas só sob outro gatilho (triggerExclusive)', () => {
        const when = {...baseWhen, trigger: 'onclick', triggerExclusive: true};
        const char = character({characterMd5: 'HY-Carro.svg', scripts: [script('onflag', [{type: 'forward', num: 3}])]});
        const info = mistakeInfo({id: 'h1', when}, {scenes: scenesWith(char)});
        expect(info).toMatchObject({kind: 'trigger'});
    });

    it('retorna null quando o bloco já está certo (nada pra alertar)', () => {
        const char = character({characterMd5: 'HY-Carro.svg', scripts: [script('onflag', [{type: 'forward', num: 3}])]});
        expect(mistakeInfo({id: 'h1', when: baseWhen}, {scenes: scenesWith(char)})).toBeNull();
    });
});

describe('orderInfo', () => {
    it('acusa uma dica POSTERIOR já cumprida enquanto a ANTERIOR do mesmo personagem ainda está pendente', () => {
        const earlierHint = {
            id: 'h1',
            when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'A.svg', blockTypes: ['say']},
        };
        const laterHint = {
            id: 'h2',
            when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'A.svg', blockTypes: ['forward'], blockArgs: {forward: 2}},
        };
        // O aluno já montou 'forward' (a dica posterior) mas nunca o 'say' (a anterior).
        const char = character({characterMd5: 'A.svg', scripts: [script('onflag', [{type: 'forward', num: 2}])]});
        const scenes = [scene({sceneMd5: 'S.svg', sceneOccurrence: 1, characters: [char]})];

        const result = orderInfo([earlierHint, laterHint], {scenes});
        expect(result).toMatchObject({kind: 'order', doneHint: laterHint, pendingHint: earlierHint});
    });

    it('não acusa fora-de-ordem entre personagens/cenas diferentes', () => {
        const hintA = {id: 'h1', when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'A.svg', blockTypes: ['say']}};
        const hintB = {id: 'h2', when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'B.svg', blockTypes: ['forward'], blockArgs: {forward: 2}}};
        const charB = character({characterMd5: 'B.svg', scripts: [script('onflag', [{type: 'forward', num: 2}])]});
        const scenes = [scene({sceneMd5: 'S.svg', sceneOccurrence: 1, characters: [charB]})];
        expect(orderInfo([hintA, hintB], {scenes})).toBeNull();
    });

    it('retorna null quando tudo está em ordem (ou nada foi feito ainda)', () => {
        expect(orderInfo([], {scenes: []})).toBeNull();
    });
});

describe('actorLabelFor', () => {
    it('retorna o rótulo "🧑 Nome" quando o personagem já existe no projeto do aluno', () => {
        const hint = {when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'A.svg'}};
        const scenes = [scene({sceneMd5: 'S.svg', sceneOccurrence: 1, characters: [character({characterMd5: 'A.svg', characterName: 'Allan'})]})];
        expect(actorLabelFor(hint, {scenes})).toBe('🧑 Allan');
    });

    it('retorna null pra dicas sem personagem (scene_missing/mission_intro) ou personagem ainda inexistente/sem nome', () => {
        expect(actorLabelFor({when: {type: 'scene_missing', sceneMd5: 'S.svg'}}, {scenes: []})).toBeNull();
        expect(actorLabelFor({when: {type: 'mission_intro'}}, {scenes: []})).toBeNull();
        const hint = {when: {type: 'character_missing_block_type', sceneMd5: 'S.svg', sceneOccurrence: 1, characterMd5: 'ghost.svg'}};
        expect(actorLabelFor(hint, {scenes: []})).toBeNull();
    });
});

/**
 * Teste de contrato (refatoração Fase 4) - garante que hintConditionHolds
 * conhece EXATAMENTE os tipos de shared/hintSchema.mjs, nem mais nem menos.
 * Sem isso, um when.type novo podia ser adicionado só no backend
 * (hintsGeneration.js) ou só aqui sem o outro lado notar - a dica nunca
 * apareceria pro aluno (se só o backend soubesse gerar) ou a LLM nunca
 * poderia emitir um tipo que só o cliente soubesse avaliar.
 */
describe('contrato com shared/hintSchema.mjs', () => {
    it('ALL_WHEN_TYPES é exatamente LLM_WHEN_TYPES + MANUAL_WHEN_TYPE, sem repetir nenhum', () => {
        expect(ALL_WHEN_TYPES).toEqual([...LLM_WHEN_TYPES, MANUAL_WHEN_TYPE]);
        expect(new Set(ALL_WHEN_TYPES).size).toBe(ALL_WHEN_TYPES.length);
    });

    it('hintConditionHolds nunca lança e devolve um boolean pra TODO tipo em ALL_WHEN_TYPES', () => {
        for (const type of ALL_WHEN_TYPES) {
            const result = hintConditionHolds({id: 'h1', when: {type}}, {scenes: []});
            expect(typeof result).toBe('boolean');
        }
    });

    it('só os tipos sem pré-requisito (mission_intro/manual) e scene_missing batem contra um manifesto vazio', () => {
        // scene_missing bate de forma VACUOUSLY verdadeira aqui - sem
        // sceneMd5 no `when` e sem nenhuma cena no projeto, "a ocorrência
        // pedida ainda não existe" é tecnicamente verdade (ver
        // hintConditionHolds case 'scene_missing'); todo o resto em
        // ALL_WHEN_TYPES exige um personagem/mensagem que só passa a
        // existir depois que uma cena real aparece, então bate false.
        const always = ['scene_missing', 'mission_intro', MANUAL_WHEN_TYPE];
        for (const type of ALL_WHEN_TYPES) {
            const result = hintConditionHolds({id: 'h1', when: {type}}, {scenes: []});
            expect(result).toBe(always.includes(type));
        }
    });

    it('um when.type fora de ALL_WHEN_TYPES nunca bate', () => {
        expect(ALL_WHEN_TYPES.includes('nao_existe')).toBe(false);
        expect(hintConditionHolds({id: 'h1', when: {type: 'nao_existe'}}, {scenes: []})).toBe(false);
    });
});

/**
 * Fase 2 (falhas F8/F9) - com projetos sintéticos reais (projectFixtures +
 * computeDetailedManifest), não com o manifesto escrito à mão acima.
 */
describe('Fase 2 - cópias do mesmo personagem (F9) e mensagem do onmessage (F8)', () => {
    const SCENE = 'Woods.svg';
    const RUBY = 'HY-Ruby.svg';
    const twins = (first, second) => computeDetailedManifest(project([{md5: SCENE, sprites: [
        {md5: RUBY, name: 'Ruby', scripts: first},
        {md5: RUBY, name: 'Ruby', scripts: second},
    ]}]));
    const blockHint = (id, extra) => ({
        id: id,
        when: Object.assign({type: 'character_missing_block_type', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY, blockTypes: ['forward']}, extra),
    });

    it('findSceneAndCharacter devolve a N-ésima cópia e todas em `characters`', () => {
        const d = twins([[onflag()]], [[onclick()]]);
        const found = findSceneAndCharacter(d.scenes, SCENE, RUBY, 1, 2);
        expect(found.characters.length).toBe(2);
        expect(found.character.scripts[0].trigger).toBe('onclick');
        expect(findSceneAndCharacter(d.scenes, SCENE, RUBY, 1, 3).character).toBeNull();
    });

    it('character_missing com characterOccurrence 2: pendente até existir a 2ª cópia', () => {
        const hint = {id: 'h1', when: {type: 'character_missing', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY, characterOccurrence: 2}};
        const one = computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, scripts: []}]}]));
        expect(hintConditionHolds(hint, one)).toBe(true);
        expect(hintConditionHolds(hint, twins([], []))).toBe(false);
    });

    it('character_no_script legado: resolvida se QUALQUER cópia tem script', () => {
        const hint = {id: 'h1', when: {type: 'character_no_script', sceneMd5: SCENE, sceneOccurrence: 1, characterMd5: RUBY}};
        expect(hintConditionHolds(hint, twins([], [[onflag(), b('say', 'Oi')]]))).toBe(false);
        expect(hintConditionHolds(hint, twins([], []))).toBe(true);
        // Com a cópia pedida: só ela conta.
        const second = {id: 'h2', when: Object.assign({}, hint.when, {characterOccurrence: 2})};
        expect(hintConditionHolds(second, twins([[onflag(), b('say', 'Oi')]], []))).toBe(true);
    });

    it('orderInfo distingue as cópias: dica da 2ª cópia feita não acusa a pendente da 1ª', () => {
        const first = blockHint('h1', {characterOccurrence: 1, blockTypes: ['say']});
        const second = blockHint('h2', {characterOccurrence: 2, blockArgs: {forward: 3}});
        const d = twins([[onflag()]], [[onflag(), b('forward', 3)]]);
        expect(orderInfo([first, second], d)).toBeNull();
        // Mesma cópia: aí sim é fora de ordem, e o retorno diz em qual cópia piscar.
        const secondEarlier = blockHint('h1', {characterOccurrence: 2, blockTypes: ['say']});
        expect(orderInfo([secondEarlier, second], d)).toMatchObject({kind: 'order', pendingHint: secondEarlier, characterOccurrence: 2});
    });

    it('orderInfo legado (sem characterOccurrence) aceita a dica posterior feita em qualquer cópia', () => {
        const earlier = blockHint('h1', {blockTypes: ['say']});
        const later = blockHint('h2', {blockArgs: {forward: 3}});
        const d = twins([[onflag()]], [[onflag(), b('forward', 3)]]);
        expect(orderInfo([earlier, later], d)).toMatchObject({kind: 'order', doneHint: later, characterOccurrence: 2});
    });

    it('mistakeInfo aponta a cópia do erro (characterOccurrence) e não alerta se outra cópia já cumpriu', () => {
        const hint = blockHint('h1', {blockArgs: {forward: 3}});
        const wrongInSecond = twins([[onflag()]], [[onflag(), b('forward', 5)]]);
        expect(mistakeInfo(hint, wrongInSecond)).toMatchObject({kind: 'value', characterOccurrence: 2, sig: 'h1|value|forward=5@2'});
        const doneInFirst = twins([[onflag(), b('forward', 3)]], [[onflag(), b('forward', 5)]]);
        expect(mistakeInfo(hint, doneInFirst)).toBeNull();
    });

    it('actorLabelFor numera a cópia quando a dica tem characterOccurrence e a cena tem cópias', () => {
        const d = twins([], []);
        expect(actorLabelFor(blockHint('h1', {characterOccurrence: 2}), d)).toBe('🧑 Ruby (2º)');
        // Legado: igual a antes, sem número.
        expect(actorLabelFor(blockHint('h1'), d)).toBe('🧑 Ruby');
        // Uma cópia só no aluno: sem número, mesmo com characterOccurrence 1.
        const one = computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, name: 'Ruby', scripts: []}]}]));
        expect(actorLabelFor(blockHint('h1', {characterOccurrence: 1}), one)).toBe('🧑 Ruby');
    });

    it('blockMatch com triggerArg: só conta sob a mensagem certa; wrongTrigger por mensagem', () => {
        const when = blockHint('h1', {trigger: 'onmessage', triggerArg: 'abrir', triggerExclusive: true}).when;
        const wrongMsg = computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, scripts: [[onmessage('fechar'), b('forward', 3)]]}]}]));
        const ruby = wrongMsg.scenes[0].characters[0];
        expect(blockMatch(ruby, when)).toMatchObject({typesOk: false, wrongTrigger: true});
        expect(mistakeInfo({id: 'h1', when}, wrongMsg)).toMatchObject({kind: 'trigger', sig: 'h1|trigger|onmessage:fechar'});
        const rightMsg = computeDetailedManifest(project([{md5: SCENE, sprites: [{md5: RUBY, scripts: [[onmessage('abrir'), b('forward', 3)]]}]}]));
        expect(blockMatch(rightMsg.scenes[0].characters[0], when).typesOk).toBe(true);
        // Legado (sem triggerArg): qualquer onmessage serve.
        const legacy = blockHint('h1', {trigger: 'onmessage'}).when;
        expect(blockMatch(ruby, legacy).typesOk).toBe(true);
    });
});
