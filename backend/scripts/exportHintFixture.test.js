const { parseArgs, anonymizeFixture, pickTeacherProject } = require('./exportHintFixture');

// Entrada "suja" de propósito: tudo que é texto livre carrega um marcador
// SEGREDO_* pra o teste varrer a saída e provar que nenhum sobrou.
const CUSTOM = 'a1b2c3d4e5f60718293a4b5c6d7e8f90.png';
const dirty = {
    projectJson: {
        pages: ['page 1', 'page 2'],
        currentPage: 'page 1',
        owner: 'SEGREDO_OWNER',
        'page 1': {
            md5: 'Bosque.svg',
            sprites: ['Joãozinho 1', 'caixa'],
            textstartat: 0,
            'Joãozinho 1': {
                type: 'sprite', md5: CUSTOM, name: 'SEGREDO_NOME_Maria da Silva', email: 'SEGREDO@x.com',
                scripts: [[
                    ['onflag', 'null', 10, 20],
                    ['say', 'SEGREDO_FALA Escola Municipal', 0, 0],
                    ['repeat', 3, 0, 0, [['say', 'SEGREDO_FALA2', 0, 0], ['forward', 'unconfirmed:5', 0, 0]]],
                    ['message', 'SEGREDO_MSG', 0, 0],
                    ['message', 'verde', 0, 0],
                ], [['onmessage', 'SEGREDO_MSG', 0, 0], ['wait', '10', 0, 0]]],
            },
            caixa: { type: 'text', name: 'SEGREDO_TEXTO', scripts: [] },
        },
        'page 2': { md5: CUSTOM, sprites: [] },
    },
    hints: [
        { id: 'uuid-SEGREDO_ID', text: 'SEGREDO_TEXTO_DICA Escola', title: 'SEGREDO_T', createdAt: '2026-01-01',
          when: { type: 'message_not_received', messageName: 'SEGREDO_MSG', extra: 'SEGREDO_EXTRA' } },
        { id: 'x', text: 'outra', when: { type: 'character_missing_block_type', sceneMd5: 'Bosque.svg', characterMd5: CUSTOM, blockTypes: ['say'] } },
    ],
};

function allStrings(v, acc = []) {
    if (typeof v === 'string') acc.push(v);
    else if (Array.isArray(v)) v.forEach((x) => allStrings(x, acc));
    else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { acc.push(k); allStrings(v[k], acc); });
    return acc;
}

describe('exportHintFixture', () => {
    const out = anonymizeFixture({ name: 'apelido', ...dirty });

    test('nenhuma string livre original sobra (valores nem chaves)', () => {
        const json = JSON.stringify(out);
        expect(json).not.toMatch(/SEGREDO/);
        expect(json).not.toMatch(/Escola|Maria|João|Municipal|uuid|2026/);
        expect(json).not.toContain(CUSTOM);
    });

    test('toda string da saída é estrutural ou placeholder', () => {
        const ok = /^(Fala \d+|Personagem \d+|mensagem-\d+|Texto \d+|Dica \d+|h\d+|page\d+|sprite\d+_\d+|custom-\d+\.png|null|unconfirmed:\d+|[a-zA-Z0-9_]+|Bosque\.svg|\d+)$/;
        allStrings(out).forEach((s) => expect(s).toMatch(ok));
    });

    test('mantém estrutura: ids sintéticos, repeat aninhado, caixa de texto descartada', () => {
        const p = out.projectJson;
        expect(p.pages).toEqual(['page1', 'page2']);
        expect(p.page1.sprites).toEqual(['sprite1_1']);
        const sc = p.page1.sprite1_1.scripts[0];
        expect(sc[2][0]).toBe('repeat');
        expect(sc[2][4].map((b) => b[0])).toEqual(['say', 'forward']);
        expect(sc[2][4][1][1]).toBe('unconfirmed:5');
        expect(out.source).toBe('anonimizado');
    });

    test('aliases estáveis: mesma mensagem/md5 -> mesmo placeholder, cor neutra preservada', () => {
        const sc = out.projectJson.page1.sprite1_1.scripts;
        const sent = sc[0][3][1];
        expect(sent).toMatch(/^mensagem-\d+$/);
        expect(sc[1][0][1]).toBe(sent); // onmessage casa com message
        expect(out.hints[0].when.messageName).toBe(sent); // e com a dica
        expect(sc[0][4][1]).toBe('verde');
        expect(out.projectJson.page1.sprite1_1.md5).toBe('custom-1.png');
        expect(out.projectJson.page2.md5).toBe('custom-1.png');
        expect(out.hints[1].when.characterMd5).toBe('custom-1.png');
        expect(out.hints[1].when.sceneMd5).toBe('Bosque.svg');
    });

    test('dicas: id/texto trocados, campos fora da allowlist de when descartados', () => {
        expect(out.hints.map((h) => [h.id, h.text])).toEqual([['h1', 'Dica 1'], ['h2', 'Dica 2']]);
        expect(Object.keys(out.hints[0])).toEqual(['id', 'text', 'when']);
        expect(out.hints[0].when.extra).toBeUndefined();
    });

    test('parseArgs e pickTeacherProject', () => {
        expect(parseArgs(['--assignment', '5', '--out', 'x.json']).assignment).toBe(5);
        expect(() => parseArgs(['--out', 'x'])).toThrow();
        expect(parseArgs(['--list']).list).toBe(true);
        expect(pickTeacherProject([{ deleted: 'YES' }, { deleted: 'NO', id: 2 }]).id).toBe(2);
        expect(pickTeacherProject([])).toBeNull();
    });
});
