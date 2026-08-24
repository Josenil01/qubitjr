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

/** A small two-scene project used across most tests below. */
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

    it('caps the surviving hints at 8 even if the LLM returns more', async () => {
        const hints = [];
        for (let i = 0; i < 12; i += 1) {
            hints.push({ text: `Dica ${i}`, when: { type: 'scene_missing', sceneMd5: i % 2 === 0 ? 'Spring.svg' : 'Summer.svg' } });
        }
        mockLlmResponse(JSON.stringify({ hints }));

        const result = await generateHints(twoSceneProject());
        expect(result.hints).toHaveLength(8);
        expect(result.hints[7].id).toBe('h8');
    });

    it('throws a clear error when the LLM response is not valid JSON', async () => {
        mockLlmResponse('isto não é json nenhum');

        await expect(generateHints(twoSceneProject())).rejects.toThrow(/JSON/);
    });

    it('throws a clear error when the underlying API call itself rejects', async () => {
        mockCreate.mockRejectedValue(new Error('network down'));

        await expect(generateHints(twoSceneProject())).rejects.toThrow(/Falha ao chamar/);
    });

    it('returns an empty hints array without calling the LLM when the project has nothing describable', async () => {
        const emptyProject = buildProject([{ id: 'page1', sprites: [] }]);

        const result = await generateHints(emptyProject);

        expect(result).toEqual({ hints: [] });
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
