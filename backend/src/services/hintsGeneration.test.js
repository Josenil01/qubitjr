/**
 * hintsGeneration.test.js
 *
 * Mocks the `openai` client (jest module mock - never hits the real
 * network/DeepSeek). See buildProject() below for the same fixture-building
 * pattern as assignmentScoring.test.js/detailedManifest.test.js.
 */

const mockCreate = jest.fn();

jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
    }));
});

const { generateHints } = require('./hintsGeneration');

function buildProject(pageDefs) {
    const project = {
        pages: pageDefs.map((p) => p.id),
        currentPage: pageDefs.length ? pageDefs[0].id : null,
    };

    for (const p of pageDefs) {
        const pageData = {
            textstartat: 0,
            sprites: p.sprites.map((s) => s.id),
            num: 1,
            lastSprite: p.sprites.length ? p.sprites[0].id : null,
        };
        if (p.md5) pageData.md5 = p.md5;

        for (const s of p.sprites) {
            const spriteData = {
                shown: true,
                type: s.type || 'sprite',
                id: s.id,
                flip: false,
                name: s.name || s.id,
                angle: 0,
                scale: 1,
                speed: 1,
                scripts: s.scripts || [],
            };
            if (s.md5) spriteData.md5 = s.md5;
            pageData[s.id] = spriteData;
        }

        project[p.id] = pageData;
    }

    return project;
}

/**
 * A small two-scene project used across most tests below. Both scenes
 * include HY-Ruby.svg (the default character - see DEFAULT_CHARACTER_MD5)
 * on purpose, so the fillMissingDefaultCharacterHints() safety net never
 * fires here and doesn't leak an unrelated extra hint into tests that have
 * nothing to do with that feature - see defaultCharacterProject() below for
 * dedicated fixtures that DO omit Ruby from a scene.
 */
function twoSceneProject() {
    return buildProject([
        {
            id: 'page1',
            md5: 'Spring.svg',
            sprites: [
                {
                    id: 'ball',
                    type: 'sprite',
                    md5: 'HY-Ball.svg',
                    scripts: [[['ontouch', null, 0, 0], ['message', 'gol', 10, 20]]],
                },
                { id: 'ruby0', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] },
            ],
        },
        {
            id: 'page2',
            md5: 'Summer.svg',
            sprites: [
                {
                    id: 'goalie',
                    type: 'sprite',
                    md5: 'HY-Goalie.svg',
                    scripts: [[['onmessage', 'gol', 0, 0], ['say', 'Gol!', 10, 20]]],
                },
                { id: 'ruby', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] },
            ],
        },
    ]);
}

function mockLlmResponse(content) {
    mockCreate.mockResolvedValue({
        choices: [{ message: { content } }],
    });
}

describe('generateHints', () => {
    const ORIGINAL_KEY = process.env.DEEPSEEK_API_KEY;

    beforeEach(() => {
        mockCreate.mockReset();
        process.env.DEEPSEEK_API_KEY = 'fake-test-key';
    });

    afterAll(() => {
        if (ORIGINAL_KEY === undefined) delete process.env.DEEPSEEK_API_KEY;
        else process.env.DEEPSEEK_API_KEY = ORIGINAL_KEY;
    });

    it('throws a NOT_CONFIGURED error and never calls the LLM when DEEPSEEK_API_KEY is unset', async () => {
        delete process.env.DEEPSEEK_API_KEY;

        await expect(generateHints(twoSceneProject())).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('assigns sequential ids (h1, h2, ...) in final order to valid hints', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    { text: 'Que tal colocar o cenário Spring.svg?', when: { type: 'scene_missing', sceneMd5: 'Spring.svg' } },
                    {
                        text: 'Depois de acertar a bola, que tal avisar o goleiro?',
                        when: { type: 'message_not_received', messageName: 'gol' },
                    },
                    {
                        text: 'Que tal fazer a Ruby falar algo?',
                        when: { type: 'character_no_script', sceneMd5: 'Summer.svg', characterMd5: 'HY-Ruby.svg' },
                    },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints.map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
        expect(result.hints[0].text).toBe('Que tal colocar o cenário Spring.svg?');
        expect(result.hints[1].when).toEqual({ type: 'message_not_received', messageName: 'gol' });
    });

    it('parses a markdown-fence-wrapped JSON response despite instructions not to use fences', async () => {
        const fenced = '```json\n' + JSON.stringify({
            hints: [{ text: 'Que tal adicionar a cena Summer.svg?', when: { type: 'scene_missing', sceneMd5: 'Summer.svg' } }],
        }) + '\n```';
        mockLlmResponse(fenced);

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].when).toEqual({ type: 'scene_missing', sceneMd5: 'Summer.svg' });
    });

    it('drops a hint with a hallucinated sceneMd5 not present in the manifest', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    { text: 'Cena inventada', when: { type: 'scene_missing', sceneMd5: 'Nao-Existe.svg' } },
                    { text: 'Cena real', when: { type: 'scene_missing', sceneMd5: 'Spring.svg' } },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Cena real');
    });

    it('drops a hint with a hallucinated characterMd5 not present in that scene', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    {
                        text: 'Personagem inventado',
                        when: { type: 'character_missing', sceneMd5: 'Summer.svg', characterMd5: 'HY-Naoexiste.svg' },
                    },
                    {
                        // Real character, but in the WRONG scene - must also be rejected.
                        text: 'Personagem na cena errada',
                        when: { type: 'character_missing', sceneMd5: 'Spring.svg', characterMd5: 'HY-Goalie.svg' },
                    },
                    {
                        text: 'Personagem real',
                        when: { type: 'character_no_script', sceneMd5: 'Summer.svg', characterMd5: 'HY-Ruby.svg' },
                    },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Personagem real');
    });

    it('drops a hint with a hallucinated messageName not in the union of sent messages', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    { text: 'Mensagem inventada', when: { type: 'message_not_received', messageName: 'nunca-enviada' } },
                    { text: 'Mensagem real', when: { type: 'message_not_received', messageName: 'gol' } },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Mensagem real');
    });

    it('drops a character_missing_block_type hint with an empty/malformed blockTypes array', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    {
                        text: 'Sem blockTypes',
                        when: {
                            type: 'character_missing_block_type',
                            sceneMd5: 'Summer.svg',
                            characterMd5: 'HY-Ruby.svg',
                            blockTypes: [],
                        },
                    },
                    {
                        text: 'Com blockTypes válido',
                        when: {
                            type: 'character_missing_block_type',
                            sceneMd5: 'Summer.svg',
                            characterMd5: 'HY-Ruby.svg',
                            blockTypes: ['forward', 'hop'],
                        },
                    },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Com blockTypes válido');
    });

    it('drops a character-scoped hint missing its required characterMd5, even though sceneMd5 alone is real', async () => {
        // A hint that names a real scene but omits characterMd5 entirely
        // must not slip through just because there was nothing invalid to
        // compare characterMd5 against - the field is required for these
        // types, and skipping the check for an absent field would let the
        // hint through with a condition that can never resolve client-side.
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    { text: 'Sem characterMd5', when: { type: 'character_missing', sceneMd5: 'Summer.svg' } },
                    { text: 'Sem characterMd5 (no-script)', when: { type: 'character_no_script', sceneMd5: 'Summer.svg' } },
                    {
                        text: 'Com characterMd5 válido',
                        when: { type: 'character_missing', sceneMd5: 'Summer.svg', characterMd5: 'HY-Ruby.svg' },
                    },
                ],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Com characterMd5 válido');
    });

    it('drops a hint with an unrecognized when.type entirely', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [{ text: 'Tipo desconhecido', when: { type: 'algo_nao_previsto', sceneMd5: 'Spring.svg' } }],
            })
        );

        const result = await generateHints(twoSceneProject());
        expect(result.hints).toHaveLength(0);
    });

    it('keeps every valid hint - no cap on how many survive, even for a large batch', async () => {
        const hints = [];
        for (let i = 0; i < 12; i += 1) {
            hints.push({ text: `Dica ${i}`, when: { type: 'scene_missing', sceneMd5: i % 2 === 0 ? 'Spring.svg' : 'Summer.svg' } });
        }
        mockLlmResponse(JSON.stringify({ hints }));

        const result = await generateHints(twoSceneProject());
        expect(result.hints).toHaveLength(12);
        expect(result.hints[11].id).toBe('h12');
    });

    it('treats sceneOccurrence as part of the scene identity - a hint for the 2nd time a background is reused only validates against that 2nd scene', async () => {
        // Same background (Spring.svg) used twice: page1 has Ruby, page3 (the
        // reused Spring.svg) has Allan instead - distinguishing them is the
        // whole point of sceneOccurrence (see docblock at the top of the file).
        // Both instances also carry a Ruby sprite of their own (unrelated id,
        // 'ruby'/'ruby3') so fillMissingDefaultCharacterHints() never fires
        // here - this test is about sceneOccurrence identity, not that
        // feature; see the dedicated tests below for it.
        const project = buildProject([
            { id: 'page1', md5: 'Spring.svg', sprites: [{ id: 'ruby', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] }] },
            { id: 'page2', md5: 'Summer.svg', sprites: [] },
            {
                id: 'page3',
                md5: 'Spring.svg',
                sprites: [
                    { id: 'allan', type: 'sprite', md5: 'HY-Allan.svg', scripts: [] },
                    { id: 'ruby3', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] },
                ],
            },
        ]);
        mockLlmResponse(
            JSON.stringify({
                hints: [
                    { text: '1a vez na Primavera - Ruby', when: { type: 'character_missing', sceneMd5: 'Spring.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg' } },
                    { text: '2a vez na Primavera - Allan', when: { type: 'character_missing', sceneMd5: 'Spring.svg', sceneOccurrence: 2, characterMd5: 'HY-Allan.svg' } },
                    // Allan só existe na ocorrência 2, não na 1 - deve ser rejeitada.
                    { text: 'Allan na ocorrencia errada', when: { type: 'character_missing', sceneMd5: 'Spring.svg', sceneOccurrence: 1, characterMd5: 'HY-Allan.svg' } },
                    // Só existem 2 ocorrências de Spring.svg - a 3a não existe.
                    { text: 'Ocorrencia inexistente', when: { type: 'scene_missing', sceneMd5: 'Spring.svg', sceneOccurrence: 3 } },
                ],
            })
        );

        const result = await generateHints(project);

        expect(result.hints.map((h) => h.text)).toEqual(['1a vez na Primavera - Ruby', '2a vez na Primavera - Allan']);
    });

    it('defaults sceneOccurrence to 1 when the LLM omits it, for backward compatibility', async () => {
        mockLlmResponse(
            JSON.stringify({
                hints: [{ text: 'Sem sceneOccurrence', when: { type: 'scene_missing', sceneMd5: 'Spring.svg' } }],
            })
        );

        const result = await generateHints(twoSceneProject());

        expect(result.hints).toHaveLength(1);
        expect(result.hints[0].text).toBe('Sem sceneOccurrence');
    });

    it('throws a clear error when the LLM response is not valid JSON', async () => {
        mockLlmResponse('isto não é json nenhum');

        await expect(generateHints(twoSceneProject())).rejects.toThrow(/JSON/);
    });

    it('throws a clear error when the underlying API call itself rejects', async () => {
        mockCreate.mockRejectedValue(new Error('network down'));

        await expect(generateHints(twoSceneProject())).rejects.toThrow(/Falha ao chamar/);
    });

    it('feeds the LLM the real localized background name and the sceneOccurrence annotation, not just the raw filename', async () => {
        // Farm.svg -> "Quinta" em src/app/localizations/pt.json (BACKGROUND_Farm.svg)
        // - sem esse nome no transcript, a LLM só via "Farm.svg" e tinha que
        // adivinhar uma tradução (foi assim que "Woods.svg" virou "floresta"
        // numa dica real, quando o nome exibido de verdade é "Bosque").
        const project = buildProject([
            { id: 'page1', md5: 'Farm.svg', sprites: [{ id: 'ruby', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] }] },
            { id: 'page2', md5: 'Summer.svg', sprites: [] },
            { id: 'page3', md5: 'Farm.svg', sprites: [{ id: 'ruby2', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] }] },
        ]);
        mockLlmResponse(JSON.stringify({ hints: [] }));

        await generateHints(project);

        const transcript = mockCreate.mock.calls[0][0].messages[1].content;
        expect(transcript).toContain('nome exibido ao aluno: "Quinta"');
        expect(transcript).toContain('[sceneOccurrence: 1]');
        expect(transcript).toContain('[sceneOccurrence: 2]');
    });

    it('returns an empty hints array without calling the LLM when the project has nothing describable', async () => {
        const emptyProject = buildProject([{ id: 'page1', sprites: [] }]);

        const result = await generateHints(emptyProject);

        expect(result).toEqual({ hints: [] });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    describe('hintContext (contexto livre escrito pelo professor)', () => {
        it('prepends a labeled CONTEXTO DO PROFESSOR block to the user message when hintContext is given', async () => {
            mockLlmResponse(JSON.stringify({ hints: [] }));

            await generateHints(twoSceneProject(), 'Uma história sobre o dia de um goleiro.');

            const userMessage = mockCreate.mock.calls[0][0].messages[1].content;
            expect(userMessage.startsWith('CONTEXTO DO PROFESSOR:\nUma história sobre o dia de um goleiro.\n\nTRANSCRIÇÃO DO PROJETO:\n')).toBe(true);
        });

        it('sends just the plain transcript, with no CONTEXTO block, when hintContext is omitted/blank', async () => {
            mockLlmResponse(JSON.stringify({ hints: [] }));

            await generateHints(twoSceneProject());
            await generateHints(twoSceneProject(), '   ');

            for (const call of mockCreate.mock.calls) {
                expect(call[0].messages[1].content).not.toContain('CONTEXTO DO PROFESSOR');
            }
        });
    });

    describe('default_character_present (Ruby, o personagem default)', () => {
        /** Woods.svg sem Ruby - o cenário legítimo do professor pra essa missão. */
        function projectWithoutRuby() {
            return buildProject([
                { id: 'page1', md5: 'Woods.svg', sprites: [{ id: 'lobo', type: 'sprite', md5: 'HY-Lobsomem.svg', scripts: [] }] },
            ]);
        }

        it('accepts a valid default_character_present hint from the LLM for a scene that really lacks Ruby', async () => {
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        { text: 'Que tal o Bosque?', when: { type: 'scene_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 1 } },
                        { text: 'Apague a Ruby, ela não é desta cena.', when: { type: 'default_character_present', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg' } },
                    ],
                })
            );

            const result = await generateHints(projectWithoutRuby());

            expect(result.hints).toHaveLength(2);
            expect(result.hints[1]).toMatchObject({ text: 'Apague a Ruby, ela não é desta cena.', when: { type: 'default_character_present' } });
        });

        it('rejects a default_character_present hint for a scene where Ruby really is part of the teacher\'s project', async () => {
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        // Summer.svg (twoSceneProject) HAS Ruby - this hint must be dropped.
                        { text: 'Apague a Ruby (errado - ela faz parte daqui)', when: { type: 'default_character_present', sceneMd5: 'Summer.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg' } },
                    ],
                })
            );

            const result = await generateHints(twoSceneProject());

            expect(result.hints.filter((h) => h.when.type === 'default_character_present')).toHaveLength(0);
        });

        it('rejects a default_character_present hint that names any characterMd5 other than Ruby (falls back to the code-generated one instead)', async () => {
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        { text: 'Apague o Lobisomem (tipo errado pra este when)', when: { type: 'default_character_present', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Lobsomem.svg' } },
                    ],
                })
            );

            const result = await generateHints(projectWithoutRuby());

            // A dica com characterMd5 errado é descartada pela validação -
            // mas a cena AINDA carece de Ruby de verdade, então
            // fillMissingDefaultCharacterHints() injeta a dela própria no
            // lugar (rede de segurança, não um "sem dica nenhuma").
            const matches = result.hints.filter((h) => h.when.type === 'default_character_present');
            expect(matches).toHaveLength(1);
            expect(matches[0].when.characterMd5).toBe('HY-Ruby.svg');
            expect(matches[0].text).not.toContain('Lobisomem');
        });

        it('injects a fallback default_character_present hint, right after scene_missing, when the LLM forgets it entirely', async () => {
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        { text: 'Que tal o Bosque?', when: { type: 'scene_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 1 } },
                        { text: 'Faça o Lobisomem uivar.', when: { type: 'character_missing_block_type', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Lobsomem.svg', blockTypes: ['say'] } },
                    ],
                })
            );

            const result = await generateHints(projectWithoutRuby());

            expect(result.hints.map((h) => h.when.type)).toEqual([
                'scene_missing',
                'default_character_present',
                'character_missing_block_type',
            ]);
            expect(result.hints[1].when).toMatchObject({ sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg' });
        });

        it('does not inject a fallback when the LLM already provided a valid one for that scene', async () => {
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        { text: 'Que tal o Bosque?', when: { type: 'scene_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 1 } },
                        { text: 'Apague a Ruby dessa vez.', when: { type: 'default_character_present', sceneMd5: 'Woods.svg', sceneOccurrence: 1, characterMd5: 'HY-Ruby.svg' } },
                    ],
                })
            );

            const result = await generateHints(projectWithoutRuby());

            expect(result.hints.filter((h) => h.when.type === 'default_character_present')).toHaveLength(1);
            expect(result.hints.filter((h) => h.when.type === 'default_character_present')[0].text).toBe('Apague a Ruby dessa vez.');
        });

        it('never removes a scene-less hint (message_not_received) or changes its relative order when injecting a fallback', async () => {
            const project = buildProject([
                {
                    id: 'page1',
                    md5: 'Woods.svg',
                    sprites: [{ id: 'lobo', type: 'sprite', md5: 'HY-Lobsomem.svg', scripts: [[['ontouch', null, 0, 0], ['message', 'uivo', 0, 0]]] }],
                },
            ]);
            mockLlmResponse(
                JSON.stringify({
                    hints: [
                        { text: 'Que tal o Bosque?', when: { type: 'scene_missing', sceneMd5: 'Woods.svg', sceneOccurrence: 1 } },
                        { text: 'Mensagem sem cena', when: { type: 'message_not_received', messageName: 'uivo' } },
                    ],
                })
            );

            const result = await generateHints(project);

            expect(result.hints.map((h) => h.when.type)).toEqual([
                'scene_missing',
                'default_character_present',
                'message_not_received',
            ]);
        });
    });

    describe('numeração de nomes de personagem duplicados', () => {
        it('numbers a character name that recurs across the project, and never numbers a unique name', async () => {
            // "Casa" (mesmo characterMd5) aparece no Bosque e, de novo, no
            // Quarto - deve virar "Casa 1"/"Casa 2" no transcript. "Lobisomem"
            // aparece só uma vez e nunca deve ganhar número.
            const project = buildProject([
                {
                    id: 'page1',
                    md5: 'Woods.svg',
                    sprites: [
                        { id: 'lobo', type: 'sprite', md5: 'HY-Lobsomem.svg', name: 'Lobisomem', scripts: [] },
                        { id: 'casa1', type: 'sprite', md5: 'HY-Casa2.svg', name: 'Casa', scripts: [] },
                    ],
                },
                {
                    id: 'page2',
                    md5: 'Bedroom.svg',
                    sprites: [{ id: 'casa2', type: 'sprite', md5: 'HY-Casa2.svg', name: 'Casa', scripts: [] }],
                },
            ]);
            mockLlmResponse(JSON.stringify({ hints: [] }));

            await generateHints(project);

            const transcript = mockCreate.mock.calls[0][0].messages[1].content;
            expect(transcript).toContain('"Casa 1" [characterMd5: HY-Casa2.svg]');
            expect(transcript).toContain('"Casa 2" [characterMd5: HY-Casa2.svg]');
            expect(transcript).toContain('"Lobisomem" [characterMd5: HY-Lobsomem.svg]');
            expect(transcript).not.toContain('"Lobisomem 1"');
        });

        it('keeps the same assigned number for a character instance when it is also referenced in the disappeared/new annotation lines', async () => {
            // Cena 1 tem Casa (vira "Casa 1") - cena 2 não tem Casa nenhuma
            // (Casa "não aparece mais", usando o número JÁ atribuído: 1) -
            // cena 3 traz Casa de volta (2ª instância no projeto - vira
            // "Casa 2", e é anotada como "personagem novo" ali).
            const project = buildProject([
                {
                    id: 'page1',
                    md5: 'Woods.svg',
                    sprites: [{ id: 'casa1', type: 'sprite', md5: 'HY-Casa2.svg', name: 'Casa', scripts: [] }],
                },
                {
                    id: 'page2',
                    md5: 'Bedroom.svg',
                    sprites: [{ id: 'lobo', type: 'sprite', md5: 'HY-Lobsomem.svg', name: 'Lobisomem', scripts: [] }],
                },
                {
                    id: 'page3',
                    md5: 'Woods.svg',
                    sprites: [{ id: 'casa2', type: 'sprite', md5: 'HY-Casa2.svg', name: 'Casa', scripts: [] }],
                },
            ]);
            mockLlmResponse(JSON.stringify({ hints: [] }));

            await generateHints(project);

            const transcript = mockCreate.mock.calls[0][0].messages[1].content;
            expect(transcript).toContain('"Casa 1" [characterMd5: HY-Casa2.svg] não aparece mais nesta cena');
            expect(transcript).toContain('"Casa 2" [characterMd5: HY-Casa2.svg] é personagem novo nesta cena');
        });
    });
});
