'use strict';

const { computeProjectManifest } = require('./assignmentScoring');

describe('manifesto: contagem de personagens e cenas (limite de quantidade)', () => {
    const project = {
        pages: ['p1', 'p2', 'p3'],
        p1: { md5: 'Bedroom.svg', sprites: ['a', 'b'], a: { type: 'sprite', md5: 'HY-Jarra.svg', scripts: [] }, b: { type: 'sprite', md5: 'HY-Ruby.svg', scripts: [] } },
        p2: { md5: 'Bedroom.svg', sprites: ['a', 't'], a: { type: 'sprite', md5: 'HY-Jarra.svg', scripts: [[['onflag']]] }, t: { type: 'text', md5: null } },
        p3: { md5: 'Woods.svg', sprites: [] },
    };

    it('conta cada md5 em todas as cenas (com ou sem script) e ignora caixas de texto', () => {
        const m = computeProjectManifest(project);
        expect(m.characters.presentCounts).toEqual({ 'HY-Jarra.svg': 2, 'HY-Ruby.svg': 1 });
    });

    it('pageCount é o total de páginas, mesmo sem personagens', () => {
        expect(computeProjectManifest(project).scenes.pageCount).toBe(3);
    });

    it('projeto vazio/malformado não quebra', () => {
        expect(computeProjectManifest(null).scenes.pageCount).toBeUndefined();
    });
});

describe('manifesto: contagem por cena', () => {
    it('presentCountsByScene segue a ordem das páginas', () => {
        const m = computeProjectManifest({
            pages: ['p1', 'p2'],
            p1: { md5: 'A.svg', sprites: ['a'], a: { type: 'sprite', md5: 'HY-Jarra.svg' } },
            p2: { md5: 'B.svg', sprites: ['a', 'b'], a: { type: 'sprite', md5: 'HY-Jarra.svg' }, b: { type: 'sprite', md5: 'HY-Jarra.svg' } },
        });
        expect(m.characters.presentCountsByScene).toEqual([{ 'HY-Jarra.svg': 1 }, { 'HY-Jarra.svg': 2 }]);
        expect(m.characters.presentCounts).toEqual({ 'HY-Jarra.svg': 3 });
    });
});
