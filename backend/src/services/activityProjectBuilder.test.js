const { validatePlan, buildProjectFromPlan, LEVEL_PROFILES } = require('./activityProjectBuilder');
const { computeProjectManifest } = require('./assignmentScoring');
const { computeDetailedManifest } = require('./detailedManifest');

const FAKE_LIBRARY = {
    backgroundMd5s: new Set(['Woods.svg', 'Farm.svg', 'Lake.svg']),
    characterMd5s: new Set(['HY-Bruxa.svg', 'HY-Cachorro.svg', 'HY-Yara.svg']),
};

describe('validatePlan', () => {
    test('mantém cenas/personagens/blocos válidos', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['say', 'Oi!'], ['forward', 3]]],
                }],
            }],
        };

        const { plan, warnings } = validatePlan(rawPlan, FAKE_LIBRARY);

        expect(warnings).toEqual([]);
        expect(plan.scenes).toHaveLength(1);
        expect(plan.scenes[0].characters).toHaveLength(1);
        expect(plan.scenes[0].characters[0].scripts[0]).toEqual([
            { blockType: 'onflag', arg: 'null' },
            { blockType: 'say', arg: 'Oi!' },
            { blockType: 'forward', arg: 3 },
        ]);
    });

    test('descarta cena com fundo que não existe na biblioteca', () => {
        const rawPlan = { scenes: [{ backgroundMd5: 'Saci.svg', characters: [] }] };
        const { plan, warnings } = validatePlan(rawPlan, FAKE_LIBRARY);
        expect(plan.scenes).toHaveLength(0);
        expect(warnings[0]).toMatch(/fundo inválido/);
    });

    test('descarta personagem com md5 que não existe, mas mantém a cena', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [
                    { md5: 'Saci.svg', name: 'Saci', scripts: [] },
                    { md5: 'HY-Cachorro.svg', name: 'Cachorro', scripts: [] },
                ],
            }],
        };
        const { plan, warnings } = validatePlan(rawPlan, FAKE_LIBRARY);
        expect(plan.scenes).toHaveLength(1);
        expect(plan.scenes[0].characters).toHaveLength(1);
        expect(plan.scenes[0].characters[0].md5).toBe('HY-Cachorro.svg');
        expect(warnings[0]).toMatch(/Personagem descartado/);
    });

    test('descarta bloco com tipo inexistente e mantém o resto do script', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['voar', 5], ['say', 'Oi!']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script.map((b) => b.blockType)).toEqual(['onflag', 'say']);
    });

    test('valida repeat com blocos internos recursivamente', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['repeat', 2, [['say', 'Pulando!']]]]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script[1]).toEqual({
            blockType: 'repeat',
            arg: 2,
            nested: [{ blockType: 'say', arg: 'Pulando!' }],
        });
    });

    test('rejeita onmessage como bloco que não seja o primeiro do script, e descarta o script inteiro (fica sem gatilho)', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['say', 'Oi!'], ['onmessage', 'foo']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY);
        // 'onmessage' cai fora por não ser o primeiro bloco; o 'say' que
        // sobrevive sozinho não tem gatilho pra disparar o script (nunca
        // rodaria no editor real), então o script inteiro é descartado - ver
        // validateScript.
        expect(plan.scenes[0].characters[0].scripts).toEqual([]);
    });

    test('plano vazio/malformado devolve scenes: []', () => {
        expect(validatePlan(null, FAKE_LIBRARY).plan.scenes).toEqual([]);
        expect(validatePlan({}, FAKE_LIBRARY).plan.scenes).toEqual([]);
    });
});

describe('buildProjectFromPlan', () => {
    test('produz um projeto carregável pelo pipeline real de manifesto/dicas', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['say', 'Oi!'], ['repeat', 2, [['forward', 3]]]]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY);
        const { projectJson } = buildProjectFromPlan(plan);

        // Shape básico que Page.js#loadPageData/Project.js#recreateObject
        // exigem pra carregar sem lançar - ver docblock do módulo.
        expect(projectJson.pages).toHaveLength(1);
        const pageId = projectJson.pages[0];
        const page = projectJson[pageId];
        expect(page.md5).toBe('Woods.svg');
        expect(Array.isArray(page.layers)).toBe(true);
        expect(page.sprites).toHaveLength(1);
        const sprite = page[page.sprites[0]];
        expect(sprite.type).toBe('sprite');
        expect(sprite.md5).toBe('HY-Bruxa.svg');
        expect(Array.isArray(sprite.scripts[0])).toBe(true);
        // tupla [blocktype, arg, dx, dy, inside?] - ver encodeStrip real em Project.js
        expect(sprite.scripts[0][0].slice(0, 2)).toEqual(['onflag', 'null']);
        const repeatTuple = sprite.scripts[0][2];
        expect(repeatTuple[0]).toBe('repeat');
        expect(repeatTuple[4]).toEqual([['forward', 3, 0, 0]]);

        // Compatível sem adaptação com os dois consumidores reais já
        // existentes (assignmentScoring.js e detailedManifest.js).
        const manifest = computeProjectManifest(projectJson);
        expect(manifest.scenes.count).toBe(1);
        expect(manifest.characters.used).toEqual(['HY-Bruxa.svg']);

        const detailed = computeDetailedManifest(projectJson);
        expect(detailed.scenes[0].characters[0].hasScript).toBe(true);
        expect(detailed.scenes[0].characters[0].blockSequence).toEqual(['onflag', 'say["Oi!"]', 'repeat[2]', 'forward[3]']);
    });
});

describe('validatePlan com onclick', () => {
    test('aceita onclick como gatilho válido, sem argumento', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onclick', null], ['say', 'Você me tocou!']]],
                }],
            }],
        };
        const { plan, warnings } = validatePlan(rawPlan, FAKE_LIBRARY);
        expect(warnings).toEqual([]);
        expect(plan.scenes[0].characters[0].scripts[0][0]).toEqual({ blockType: 'onclick', arg: 'null' });
    });
});

describe('validatePlan com levelProfile (perfis de nível 1/2/3)', () => {
    function scenePlan(n) {
        return {
            scenes: Array.from({ length: n }, (unused, i) => ({
                backgroundMd5: i % 2 === 0 ? 'Woods.svg' : 'Farm.svg',
                characters: [{ md5: 'HY-Bruxa.svg', name: 'Bruxa ' + i, scripts: [] }],
            })),
        };
    }

    test('corta cenas excedentes pro nível 1 (só 1 cena permitida)', () => {
        const { plan, warnings } = validatePlan(scenePlan(3), FAKE_LIBRARY, LEVEL_PROFILES[1]);
        expect(plan.scenes).toHaveLength(1);
        expect(warnings.some((w) => w.includes('mais cenas'))).toBe(true);
    });

    test('corta personagens excedentes por cena conforme o nível', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [
                    { md5: 'HY-Bruxa.svg', name: 'A', scripts: [] },
                    { md5: 'HY-Cachorro.svg', name: 'B', scripts: [] },
                    { md5: 'HY-Yara.svg', name: 'C', scripts: [] },
                ],
            }],
        };
        const { plan, warnings } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[2]); // charactersPerScene: 2
        expect(plan.scenes[0].characters).toHaveLength(2);
        expect(plan.scenes[0].characters.map((c) => c.md5)).toEqual(['HY-Bruxa.svg', 'HY-Cachorro.svg']);
        expect(warnings.some((w) => w.includes('mais personagens'))).toBe(true);
    });

    test('nível 1 rejeita onmessage como gatilho (só onflag/onclick permitidos)', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onmessage', 'foo'], ['say', 'Oi!']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[1]);
        expect(plan.scenes[0].characters[0].scripts).toEqual([]);
    });

    test('nível 2 aceita onmessage como gatilho', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onmessage', 'foo'], ['say', 'Oi!']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[2]);
        expect(plan.scenes[0].characters[0].scripts).toHaveLength(1);
    });

    test('nível 1 remove qualquer bloco repeat (loop: none)', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['repeat', 2, [['say', 'Oi!']]], ['forward', 3]]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[1]);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script.map((b) => b.blockType)).toEqual(['onflag', 'forward']);
    });

    test('nível 1 remove blocos message (messages: none)', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    scripts: [[['onflag', null], ['message', 'oi'], ['say', 'Oi!']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[1]);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script.map((b) => b.blockType)).toEqual(['onflag', 'say']);
    });

    test('corta o script no tamanho máximo do nível (blocksPerScript.max)', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    // nível 1: max 3 blocos - manda 5, espera cortar pros 3 primeiros.
                    scripts: [[['onflag', null], ['say', 'a'], ['say', 'b'], ['say', 'c'], ['say', 'd']]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[1]);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script).toHaveLength(3);
        expect(script.map((b) => b.arg)).toEqual(['null', 'a', 'b']);
    });

    test('não corta o conteúdo interno de um repeat pelo limite de blocksPerScript', () => {
        const rawPlan = {
            scenes: [{
                backgroundMd5: 'Woods.svg',
                characters: [{
                    md5: 'HY-Bruxa.svg',
                    name: 'Bruxa',
                    // nível 3: repeat permitido, script conta o repeat como 1 bloco no topo.
                    scripts: [[['onflag', null], ['repeat', 2, [['say', 'a'], ['say', 'b'], ['say', 'c'], ['say', 'd']]]]],
                }],
            }],
        };
        const { plan } = validatePlan(rawPlan, FAKE_LIBRARY, LEVEL_PROFILES[3]);
        const script = plan.scenes[0].characters[0].scripts[0];
        expect(script).toHaveLength(2); // onflag + repeat, dentro do max de 7
        expect(script[1].nested).toHaveLength(4); // conteúdo interno do repeat não é cortado
    });
});
