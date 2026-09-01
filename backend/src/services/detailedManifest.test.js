const { computeDetailedManifest } = require('./detailedManifest');

/**
 * Builds a parsed-project-JSON fixture matching the real getProject()/
 * encodePage()/getData() shape (see assignmentScoring.js header comment).
 * Copied from assignmentScoring.test.js's buildProject() helper - same
 * fixture shape, since computeDetailedManifest() walks the same project JSON.
 *
 * pageDefs: Array<{ id, md5?, sprites: Array<{ id, type?, md5?, scripts? }> }>
 */
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

describe('computeDetailedManifest — edge cases', () => {
    it('returns { scenes: [] } and never throws for null/malformed input', () => {
        expect(computeDetailedManifest(null)).toEqual({ scenes: [] });
        expect(computeDetailedManifest(undefined)).toEqual({ scenes: [] });
        expect(computeDetailedManifest('not an object')).toEqual({ scenes: [] });
        expect(computeDetailedManifest(42)).toEqual({ scenes: [] });
        expect(computeDetailedManifest({})).toEqual({ scenes: [] }); // missing pages
        expect(computeDetailedManifest({ pages: 'not-an-array' })).toEqual({ scenes: [] });
    });

    it('tolerates a ghost page id and a ghost sprite id without crashing', () => {
        const project = {
            pages: ['ghostPage', 'page1'],
            page1: {
                sprites: ['ghostSprite', 's1'],
                md5: 'Farm.svg',
                s1: { type: 'sprite', md5: 'A.svg', scripts: [] },
            },
        };
        expect(() => computeDetailedManifest(project)).not.toThrow();
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes).toHaveLength(1);
        expect(manifest.scenes[0].characters).toHaveLength(1);
    });

    it('never includes a text sprite as a character', () => {
        const project = buildProject([
            {
                id: 'page1',
                md5: 'Farm.svg',
                sprites: [{ id: 'label', type: 'text', md5: 'ignored.svg', scripts: [] }],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters).toEqual([]);
    });

    it('handles a sprite with no md5 gracefully - characterMd5 is null, not a crash', () => {
        const project = buildProject([
            { id: 'page1', md5: 'Farm.svg', sprites: [{ id: 's1', type: 'sprite', scripts: [] }] },
        ]);
        expect(() => computeDetailedManifest(project)).not.toThrow();
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].characterMd5).toBeNull();
    });

    it('handles a page with no background md5 gracefully - sceneMd5 is null', () => {
        const project = buildProject([{ id: 'page1', sprites: [] }]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].sceneMd5).toBeNull();
    });
});

describe('computeDetailedManifest — ordering', () => {
    it('preserves multi-scene, multi-character order exactly as given in pages/sprites arrays', () => {
        const project = buildProject([
            {
                id: 'page2',
                md5: 'Summer.svg',
                sprites: [
                    { id: 'ball', type: 'sprite', md5: 'HY-Ball.svg', scripts: [] },
                    { id: 'goalie', type: 'sprite', md5: 'HY-Goalie.svg', scripts: [] },
                ],
            },
            {
                id: 'page1',
                md5: 'Spring.svg',
                sprites: [{ id: 'ruby', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] }],
            },
        ]);
        // buildProject() sets projectJson.pages from pageDefs order, so passing
        // page2 first, page1 second must be reflected verbatim in manifest.scenes.
        const manifest = computeDetailedManifest(project);

        expect(manifest.scenes).toHaveLength(2);
        expect(manifest.scenes[0].sceneMd5).toBe('Summer.svg');
        expect(manifest.scenes[0].characters.map((c) => c.characterMd5)).toEqual(['HY-Ball.svg', 'HY-Goalie.svg']);
        expect(manifest.scenes[1].sceneMd5).toBe('Spring.svg');
        expect(manifest.scenes[1].characters.map((c) => c.characterMd5)).toEqual(['HY-Ruby.svg']);
    });

    it('includes a character with no script at all (hasScript=false), unlike assignmentScoring.js\'s qualifying filter', () => {
        const project = buildProject([
            {
                id: 'page1',
                md5: 'Spring.svg',
                sprites: [{ id: 'ruby', name: 'Ruby', type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] }],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0]).toEqual({
            characterMd5: 'HY-Ruby.svg',
            characterName: 'Ruby',
            hasScript: false,
            blockTypes: [],
            messagesSent: [],
            messagesReceived: [],
            sayTexts: [],
        });
    });

    it('captures the literal text of every say block, in order, without deduplicating repeats', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [
                            [['onflag', null, 0, 0], ['say', 'Olá!', 0, 0], ['say', 'Olá!', 0, 0]],
                            [['onclick', null, 0, 0], ['say', 'Tchau!', 0, 0]],
                        ],
                    },
                ],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].sayTexts).toEqual(['Olá!', 'Olá!', 'Tchau!']);
    });

    it('excludes a say block with no real text chosen yet (arg = the string "null") from sayTexts', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [[['onflag', null, 0, 0], ['say', 'null', 0, 0]]],
                    },
                ],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].sayTexts).toEqual([]);
        expect(manifest.scenes[0].characters[0].blockTypes).toEqual(['onflag', 'say']);
    });

    it('numbers sceneOccurrence per sceneMd5, independent of other scenes in between', () => {
        const project = buildProject([
            { id: 'page1', md5: 'Woods.svg', sprites: [] },
            { id: 'page2', md5: 'Bedroom.svg', sprites: [] },
            { id: 'page3', md5: 'Woods.svg', sprites: [] },
            { id: 'page4', md5: 'Bedroom.svg', sprites: [] },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes.map((s) => [s.sceneMd5, s.sceneOccurrence])).toEqual([
            ['Woods.svg', 1],
            ['Bedroom.svg', 1],
            ['Woods.svg', 2],
            ['Bedroom.svg', 2],
        ]);
    });

    it('leaves sceneOccurrence null alongside a null sceneMd5', () => {
        const project = buildProject([{ id: 'page1', sprites: [] }]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].sceneOccurrence).toBeNull();
    });

    it('falls back to null characterName when the sprite has none set', () => {
        const project = buildProject([
            {
                id: 'page1',
                md5: 'Spring.svg',
                sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [] }],
            },
        ]);
        // buildProject()'s own fixture helper defaults name to the sprite id
        // when none is given, so this test builds the raw project shape by
        // hand to actually exercise the "no name at all" case.
        delete project.page1.s1.name;
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].characterName).toBeNull();
    });
});

describe('computeDetailedManifest — messages sent/received', () => {
    it('extracts a message sent by one sprite and received by another sprite on a different page', () => {
        const project = buildProject([
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
                ],
            },
        ]);

        const manifest = computeDetailedManifest(project);

        const sender = manifest.scenes[0].characters[0];
        expect(sender.hasScript).toBe(true);
        expect(sender.messagesSent).toEqual(['gol']);
        expect(sender.messagesReceived).toEqual([]);
        expect(sender.blockTypes).toEqual(expect.arrayContaining(['ontouch', 'message']));

        const receiver = manifest.scenes[1].characters[0];
        expect(receiver.messagesReceived).toEqual(['gol']);
        expect(receiver.messagesSent).toEqual([]);
        expect(receiver.blockTypes).toEqual(expect.arrayContaining(['onmessage', 'say']));
    });

    it('does not treat an unset message/onmessage block (arg = the string "null", per Project.js#encodeStrip\'s sentinel for "no real arg") as a real message name', () => {
        // A message/onmessage block always carries SOME arg once encoded
        // (both are in Project.js#encodeStrip's hasargs list), even before
        // the student picks an actual message from the dropdown - encodeStrip
        // falls back to the literal string 'null' in that case. Counting
        // that as a real sent/received message name would let a coaching
        // hint validate against - or worse, fire for - a message that was
        // never actually chosen.
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [[['onflag', null, 0, 0], ['message', 'null', 0, 0]]],
                    },
                    {
                        id: 's2',
                        type: 'sprite',
                        md5: 'B.svg',
                        scripts: [[['onmessage', 'null', 0, 0], ['say', 'oi', 0, 0]]],
                    },
                ],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].messagesSent).toEqual([]);
        expect(manifest.scenes[0].characters[1].messagesReceived).toEqual([]);
        // The block types themselves are still recorded - only the sentinel
        // arg is filtered out of messagesSent/messagesReceived.
        expect(manifest.scenes[0].characters[0].blockTypes).toEqual(['onflag', 'message']);
        expect(manifest.scenes[0].characters[1].blockTypes).toEqual(['onmessage', 'say']);
    });

    it('deduplicates repeated message names sent/received by the same sprite', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [
                            [['ontouch', null, 0, 0], ['message', 'go', 0, 0]],
                            [['onclick', null, 0, 0], ['message', 'go', 0, 0]],
                        ],
                    },
                ],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].messagesSent).toEqual(['go']);
    });
});

describe('computeDetailedManifest — nested repeat blocks', () => {
    it('walks a nested repeat strip (block[4]) and picks up block types inside it', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [
                            [
                                ['onflag', null, 10, 20],
                                [
                                    'repeat',
                                    3,
                                    10,
                                    100,
                                    [
                                        ['forward', 2, 20, 10],
                                        ['say', 'oi', 20, 40],
                                    ],
                                ],
                            ],
                        ],
                    },
                ],
            },
        ]);

        const manifest = computeDetailedManifest(project);
        const character = manifest.scenes[0].characters[0];
        expect(character.hasScript).toBe(true);
        expect(character.blockTypes).toEqual(['onflag', 'repeat', 'forward', 'say']);
    });

    it('excludes caret/UI-marker types from blockTypes, same as assignmentScoring.js', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [
                            [
                                ['caretstart', null, 0, 0],
                                ['onflag', null, 10, 20],
                                ['caretcmd', null, 10, 40],
                                ['forward', 5, 10, 60],
                                ['caretend', null, 10, 80],
                            ],
                        ],
                    },
                ],
            },
        ]);
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].blockTypes).toEqual(['onflag', 'forward']);
    });

    it('handles a forever block (no nested strip) without crashing', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [[['onflag', null, 10, 20], ['forever', null, 10, 60]]],
                    },
                ],
            },
        ]);
        expect(() => computeDetailedManifest(project)).not.toThrow();
        const manifest = computeDetailedManifest(project);
        expect(manifest.scenes[0].characters[0].blockTypes).toEqual(['onflag', 'forever']);
    });
});
