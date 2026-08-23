const { computeProjectManifest, compareManifests } = require('./assignmentScoring');

/**
 * Builds a parsed-project-JSON fixture matching the real getProject()/
 * encodePage()/getData() shape (see assignmentScoring.js header comment).
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

const ZERO_MANIFEST = {
    scenes: { count: 0, used: [] },
    characters: { count: 0, used: [] },
    blocks: { count: 0, byType: {} },
    ctScores: {
        parallelism: 0,
        flowControl: 0,
        synchronization: 0,
        userInteractivity: 0,
        abstraction: 0,
        dataRepresentation: 0,
    },
};

describe('computeProjectManifest — edge cases', () => {
    it('returns a fully zeroed manifest and never throws for null/malformed input', () => {
        expect(computeProjectManifest(null)).toEqual(ZERO_MANIFEST);
        expect(computeProjectManifest(undefined)).toEqual(ZERO_MANIFEST);
        expect(computeProjectManifest('not an object')).toEqual(ZERO_MANIFEST);
        expect(computeProjectManifest(42)).toEqual(ZERO_MANIFEST);
        expect(computeProjectManifest({})).toEqual(ZERO_MANIFEST); // missing pages
        expect(computeProjectManifest({ pages: 'not-an-array' })).toEqual(ZERO_MANIFEST);
    });

    it('tolerates a page id listed in pages but missing as a key, and a sprite id missing as a key', () => {
        const project = {
            pages: ['ghostPage', 'page1'],
            page1: { sprites: ['ghostSprite', 's1'], md5: 'Farm.svg', s1: { type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] } },
        };
        expect(() => computeProjectManifest(project)).not.toThrow();
        const manifest = computeProjectManifest(project);
        expect(manifest.characters.count).toBe(1);
        expect(manifest.scenes.count).toBe(1);
    });
});

describe('computeProjectManifest — scene/character qualification', () => {
    it('counts only the sprite with a non-empty script as a character, and excludes the decorative sprite md5 from used', () => {
        const project = buildProject([
            {
                id: 'page1',
                md5: 'Farm.svg',
                sprites: [
                    { id: 'deco', type: 'sprite', md5: 'Deco.svg', scripts: [] },
                    {
                        id: 'func',
                        type: 'sprite',
                        md5: 'Func.svg',
                        scripts: [[['onflag', null, 10, 20], ['forward', 5, 10, 60]]],
                    },
                ],
            },
        ]);

        const manifest = computeProjectManifest(project);

        expect(manifest.characters.count).toBe(1);
        expect(manifest.characters.used).toEqual(['Func.svg']);
        expect(manifest.characters.used).not.toContain('Deco.svg');
        expect(manifest.scenes.count).toBe(1);
        expect(manifest.scenes.used).toEqual(['Farm.svg']);
    });

    it('never counts a text sprite as a character, even with a non-empty script array', () => {
        const project = buildProject([
            {
                id: 'page1',
                md5: 'Farm.svg',
                sprites: [
                    { id: 'label', type: 'text', md5: 'ignored.svg', scripts: [[['onflag', null, 0, 0]]] },
                ],
            },
        ]);
        const manifest = computeProjectManifest(project);
        expect(manifest.characters.count).toBe(0);
        expect(manifest.characters.used).toEqual([]);
    });

    it('does not count a page as a scene when its only sprite has an empty scripts array', () => {
        const project = buildProject([
            { id: 'page1', md5: 'Farm.svg', sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [] }] },
        ]);
        const manifest = computeProjectManifest(project);
        expect(manifest.scenes.count).toBe(0);
        expect(manifest.characters.count).toBe(0);
    });

    it('does not count a page as a scene when it has zero sprites', () => {
        const project = buildProject([{ id: 'page1', md5: 'Farm.svg', sprites: [] }]);
        const manifest = computeProjectManifest(project);
        expect(manifest.scenes.count).toBe(0);
    });

    it('counts a qualifying page toward scenes.count even when it has no background md5 set, but omits it from used', () => {
        const project = buildProject([
            { id: 'page1', sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] }] },
        ]);
        const manifest = computeProjectManifest(project);
        expect(manifest.scenes.count).toBe(1);
        expect(manifest.scenes.used).toEqual([]);
    });

    it('deduplicates repeated character md5 values in characters.used', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'Ruby.svg', scripts: [[['onflag', null, 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'Ruby.svg', scripts: [[['onclick', null, 0, 0]]] },
                ],
            },
        ]);
        const manifest = computeProjectManifest(project);
        expect(manifest.characters.count).toBe(2);
        expect(manifest.characters.used).toEqual(['Ruby.svg']);
    });
});

describe('computeProjectManifest — block tallying', () => {
    it('counts nested repeat blocks in blocks.count/byType and scores flowControl=2', () => {
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

        const manifest = computeProjectManifest(project);

        expect(manifest.blocks.count).toBe(4); // onflag, repeat, forward, say
        expect(manifest.blocks.byType).toEqual({ onflag: 1, repeat: 1, forward: 1, say: 1 });
        expect(manifest.ctScores.flowControl).toBe(2);
    });

    it('handles a forever block (no nested strip) without crashing, and still scores flowControl=2', () => {
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

        expect(() => computeProjectManifest(project)).not.toThrow();
        const manifest = computeProjectManifest(project);
        expect(manifest.blocks.byType.forever).toBe(1);
        expect(manifest.ctScores.flowControl).toBe(2);
    });

    it('excludes caret/UI marker blocks from blocks.count and byType entirely', () => {
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

        const manifest = computeProjectManifest(project);

        expect(manifest.blocks.count).toBe(2); // onflag + forward only
        expect(manifest.blocks.byType).toEqual({ onflag: 1, forward: 1 });
        expect(manifest.blocks.byType.caretstart).toBeUndefined();
        expect(manifest.blocks.byType.caretend).toBeUndefined();
    });
});

describe('computeProjectManifest — ctScores.parallelism tier boundaries', () => {
    it('is 0 with exactly one onflag-started script', () => {
        const project = buildProject([
            { id: 'page1', sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] }] },
        ]);
        expect(computeProjectManifest(project).ctScores.parallelism).toBe(0);
    });

    it('is 1 with exactly two onflag-started scripts on different sprites', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'B.svg', scripts: [[['onflag', null, 0, 0]]] },
                ],
            },
        ]);
        expect(computeProjectManifest(project).ctScores.parallelism).toBe(1);
    });

    it('drops from 1 back to 0 once one of the two onflag scripts is changed to onclick', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'B.svg', scripts: [[['onclick', null, 0, 0]]] },
                ],
            },
        ]);
        // 1 onflag script (< 2) and 1 onclick/ontouch script (< 2): neither tier reached.
        expect(computeProjectManifest(project).ctScores.parallelism).toBe(0);
    });

    it('reaches tier 2 with two onclick/ontouch-started scripts combined', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onclick', null, 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'B.svg', scripts: [[['ontouch', null, 0, 0]]] },
                ],
            },
        ]);
        expect(computeProjectManifest(project).ctScores.parallelism).toBe(2);
    });

    it('reaches tier 3 with two onmessage-started scripts', () => {
        const project = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onmessage', 'go', 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'B.svg', scripts: [[['onmessage', 'go', 0, 0]]] },
                ],
            },
        ]);
        expect(computeProjectManifest(project).ctScores.parallelism).toBe(3);
    });
});

describe('computeProjectManifest — other ctScores dimensions', () => {
    it('scores userInteractivity=2 when a top-level script starts onclick/ontouch', () => {
        const project = buildProject([
            { id: 'page1', sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['ontouch', null, 0, 0]]] }] },
        ]);
        expect(computeProjectManifest(project).ctScores.userInteractivity).toBe(2);
    });

    it('scores userInteractivity=1 when only onflag-started scripts exist', () => {
        const project = buildProject([
            { id: 'page1', sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] }] },
        ]);
        expect(computeProjectManifest(project).ctScores.userInteractivity).toBe(1);
    });

    it('scores synchronization=2 for message/stopmine and =1 for wait-only', () => {
        const withMessage = buildProject([
            {
                id: 'page1',
                sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0], ['message', 'go', 0, 0]]] }],
            },
        ]);
        expect(computeProjectManifest(withMessage).ctScores.synchronization).toBe(2);

        const withWait = buildProject([
            {
                id: 'page1',
                sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0], ['wait', 1, 0, 0]]] }],
            },
        ]);
        expect(computeProjectManifest(withWait).ctScores.synchronization).toBe(1);
    });

    it('scores dataRepresentation=1 when say/grow/shrink/setspeed appear, else 0', () => {
        const withSay = buildProject([
            {
                id: 'page1',
                sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0], ['say', 'oi', 0, 0]]] }],
            },
        ]);
        expect(computeProjectManifest(withSay).ctScores.dataRepresentation).toBe(1);

        const withoutIt = buildProject([
            {
                id: 'page1',
                sprites: [{ id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0], ['forward', 1, 0, 0]]] }],
            },
        ]);
        expect(computeProjectManifest(withoutIt).ctScores.dataRepresentation).toBe(0);
    });

    it('scores abstraction=1 only with more than one qualifying character AND more than one script total', () => {
        const twoCharsTwoScripts = buildProject([
            {
                id: 'page1',
                sprites: [
                    { id: 's1', type: 'sprite', md5: 'A.svg', scripts: [[['onflag', null, 0, 0]]] },
                    { id: 's2', type: 'sprite', md5: 'B.svg', scripts: [[['onclick', null, 0, 0]]] },
                ],
            },
        ]);
        expect(computeProjectManifest(twoCharsTwoScripts).ctScores.abstraction).toBe(1);

        const oneCharTwoScripts = buildProject([
            {
                id: 'page1',
                sprites: [
                    {
                        id: 's1',
                        type: 'sprite',
                        md5: 'A.svg',
                        scripts: [[['onflag', null, 0, 0]], [['onclick', null, 0, 0]]],
                    },
                ],
            },
        ]);
        expect(computeProjectManifest(oneCharTwoScripts).ctScores.abstraction).toBe(0);
    });
});

describe('compareManifests', () => {
    it('reports met=true across the board when the actual manifest fully satisfies the required one', () => {
        const required = {
            scenes: { count: 1, used: ['Farm.svg'] },
            characters: { count: 1, used: ['Ruby.svg'] },
            blocks: { count: 2, byType: { onflag: 1, forward: 1 } },
            ctScores: {
                parallelism: 0,
                flowControl: 0,
                synchronization: 0,
                userInteractivity: 1,
                abstraction: 0,
                dataRepresentation: 0,
            },
        };
        const actual = {
            scenes: { count: 2, used: ['Farm.svg', 'Beach.svg'] },
            characters: { count: 1, used: ['Ruby.svg'] },
            blocks: { count: 3, byType: { onflag: 1, forward: 2 } },
            ctScores: {
                parallelism: 0,
                flowControl: 1,
                synchronization: 0,
                userInteractivity: 2,
                abstraction: 0,
                dataRepresentation: 0,
            },
        };

        const result = compareManifests(required, actual);

        expect(result.scenes).toEqual({ required: 1, actual: 2, met: true });
        expect(result.characters).toEqual({ required: 1, actual: 1, met: true });
        expect(result.blocks.met).toBe(true);
        expect(result.blocks.byType.onflag).toEqual({ required: 1, actual: 1, met: true });
        expect(result.blocks.byType.forward).toEqual({ required: 1, actual: 2, met: true });
        expect(result.ctScores.userInteractivity).toEqual({ required: 1, actual: 2, met: true });
    });

    it('flags met=false at both the per-type and top level when actual is short on a required block type', () => {
        const required = {
            scenes: { count: 1, used: [] },
            characters: { count: 1, used: [] },
            blocks: { count: 3, byType: { onflag: 1, forward: 2 } },
            ctScores: {},
        };
        const actual = {
            scenes: { count: 1, used: [] },
            characters: { count: 1, used: [] },
            blocks: { count: 2, byType: { onflag: 1, forward: 1 } },
            ctScores: {},
        };

        const result = compareManifests(required, actual);

        expect(result.blocks.byType.forward).toEqual({ required: 2, actual: 1, met: false });
        expect(result.blocks.byType.onflag).toEqual({ required: 1, actual: 1, met: true });
        expect(result.blocks.met).toBe(false);
    });

    it('defaults a block type absent from actual.byType entirely to 0 (not met)', () => {
        const required = {
            scenes: { count: 0, used: [] },
            characters: { count: 0, used: [] },
            blocks: { count: 1, byType: { repeat: 1 } },
            ctScores: {},
        };
        const actual = {
            scenes: { count: 0, used: [] },
            characters: { count: 0, used: [] },
            blocks: { count: 1, byType: { forward: 1 } },
            ctScores: {},
        };

        const result = compareManifests(required, actual);

        expect(result.blocks.byType.repeat).toEqual({ required: 1, actual: 0, met: false });
        expect(result.blocks.met).toBe(false);
    });

    it('fails scenes/characters met when a required asset md5 is missing from actual.used, even with sufficient counts', () => {
        const required = {
            scenes: { count: 1, used: ['Farm.svg'] },
            characters: { count: 0, used: [] },
            blocks: { count: 0, byType: {} },
            ctScores: {},
        };
        const actual = {
            scenes: { count: 1, used: ['Beach.svg'] },
            characters: { count: 0, used: [] },
            blocks: { count: 0, byType: {} },
            ctScores: {},
        };

        const result = compareManifests(required, actual);

        expect(result.scenes.met).toBe(false);
    });

    it('handles missing/malformed required or actual manifests defensively, without throwing', () => {
        expect(() => compareManifests(null, null)).not.toThrow();
        const result = compareManifests(null, null);
        expect(result.scenes).toEqual({ required: 0, actual: 0, met: true });
        expect(result.blocks.met).toBe(true);
    });

    it('completed is true only when scenes/characters/blocks are ALL met (ctScores excluded)', () => {
        const required = {
            scenes: { count: 1, used: [] },
            characters: { count: 1, used: [] },
            blocks: { count: 1, byType: { onflag: 1 } },
            ctScores: { userInteractivity: 2 }, // required score not reached below - must not affect completed
        };
        const fullyMet = {
            scenes: { count: 1, used: [] },
            characters: { count: 1, used: [] },
            blocks: { count: 1, byType: { onflag: 1 } },
            ctScores: { userInteractivity: 0 },
        };
        expect(compareManifests(required, fullyMet).completed).toBe(true);

        const shortOnBlocks = {
            scenes: { count: 1, used: [] },
            characters: { count: 1, used: [] },
            blocks: { count: 0, byType: {} },
            ctScores: { userInteractivity: 2 },
        };
        expect(compareManifests(required, shortOnBlocks).completed).toBe(false);
    });
});
