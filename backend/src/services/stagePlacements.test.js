'use strict';

const { readStagePlacements, persistStagePlacements } = require('./stagePlacements');
const { resolveAssignmentFields } = require('./assignmentResolver');

/**
 * Fake mínimo do encadeamento usado pelos dois helpers:
 * from().select().eq().maybeSingle() e from().update().eq() (await direto).
 * `byId` mapeia id -> linha; `error` (opcional) é devolvido em toda chamada.
 */
function buildSupabase({ byId = {}, error = null } = {}) {
    const calls = [];
    const from = jest.fn((table) => {
        const call = { table, select: null, update: null, eqs: [] };
        calls.push(call);
        const builder = {
            select: (cols) => { call.select = cols; return builder; },
            update: (payload) => { call.update = payload; return builder; },
            eq: (col, val) => { call.eqs.push([col, val]); return builder; },
            maybeSingle: () => Promise.resolve(error ? { data: null, error } : { data: byId[call.eqs[0][1]] || null, error: null }),
            then: (resolve, reject) => Promise.resolve(error ? { data: null, error } : { data: null, error: null }).then(resolve, reject),
        };
        return builder;
    });
    return { from, calls };
}

const PLACEMENTS = [[{ characterMd5: 'Ruby.svg', characterOccurrence: 1, homex: 100, homey: 300, homescale: 1 }]];

describe('stagePlacements.readStagePlacements', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('lê a coluna numa consulta separada, só dela', async () => {
        const supabase = buildSupabase({ byId: { 7: { stage_placements: PLACEMENTS } } });
        await expect(readStagePlacements(supabase, 7)).resolves.toEqual(PLACEMENTS);
        expect(supabase.calls[0].select).toBe('stage_placements');
        expect(supabase.calls[0].eqs).toEqual([['id', 7]]);
    });

    it('coluna inexistente (42703, migração não aplicada) vira null, sem lançar', async () => {
        const supabase = buildSupabase({ error: { code: '42703', message: 'column does not exist' } });
        await expect(readStagePlacements(supabase, 7)).resolves.toBeNull();
    });

    it('qualquer outro erro também vira null (nunca derruba o chamador)', async () => {
        const supabase = buildSupabase({ error: { code: '08006', message: 'connection failure' } });
        await expect(readStagePlacements(supabase, 7)).resolves.toBeNull();
    });

    it('linha sem valor (missão anterior ao recurso) ou sem id = null', async () => {
        await expect(readStagePlacements(buildSupabase({ byId: { 7: { stage_placements: null } } }), 7)).resolves.toBeNull();
        const supabase = buildSupabase();
        await expect(readStagePlacements(supabase, null)).resolves.toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });
});

describe('stagePlacements.persistStagePlacements', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('grava num UPDATE só da coluna nova', async () => {
        const supabase = buildSupabase();
        await expect(persistStagePlacements(supabase, 7, PLACEMENTS)).resolves.toEqual({ persisted: true });
        expect(supabase.calls[0].update).toEqual({ stage_placements: PLACEMENTS });
        expect(supabase.calls[0].eqs).toEqual([['id', 7]]);
    });

    it('PGRST204 / 42703 (coluna não migrada) = not_migrated, sem lançar', async () => {
        await expect(persistStagePlacements(buildSupabase({ error: { code: 'PGRST204' } }), 7, PLACEMENTS))
            .resolves.toEqual({ persisted: false, reason: 'not_migrated' });
        await expect(persistStagePlacements(buildSupabase({ error: { code: '42703' } }), 7, PLACEMENTS))
            .resolves.toEqual({ persisted: false, reason: 'not_migrated' });
    });

    it('outro erro = persisted false, sem lançar', async () => {
        const result = await persistStagePlacements(buildSupabase({ error: { code: '500', message: 'boom' } }), 7, PLACEMENTS);
        expect(result.persisted).toBe(false);
    });
});

describe('assignmentResolver.resolveAssignmentFields com includeStagePlacements', () => {
    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => {}));
    afterEach(() => jest.restoreAllMocks());

    it('sem a opção: retorno idêntico ao de sempre (sem a chave stagePlacements, sem consulta extra)', async () => {
        const supabase = buildSupabase();
        const result = await resolveAssignmentFields(supabase, { id: 7, template_id: null, project_name: 'X', requirements: {}, hints: null });
        expect(result).toEqual({ projectName: 'X', requirements: {}, hints: [] });
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('template: lê stage_placements da própria linha', async () => {
        const supabase = buildSupabase({ byId: { 7: { stage_placements: PLACEMENTS } } });
        const result = await resolveAssignmentFields(supabase, { id: 7, template_id: null, project_name: 'X', requirements: {}, hints: [] }, { includeStagePlacements: true });
        expect(result.stagePlacements).toEqual(PLACEMENTS);
        expect(supabase.calls.map((c) => c.select)).toEqual(['stage_placements']);
    });

    it('referência: herda do TEMPLATE, e o SELECT do template continua sem a coluna nova', async () => {
        const supabase = buildSupabase({ byId: {
            7: { project_name: 'Template', requirements: { r: 1 }, hints: [], stage_placements: PLACEMENTS },
            9: { stage_placements: null },
        } });
        const result = await resolveAssignmentFields(supabase, { id: 9, template_id: 7 }, { includeStagePlacements: true });
        expect(result).toEqual({ projectName: 'Template', requirements: { r: 1 }, hints: [], stagePlacements: PLACEMENTS });
        expect(supabase.calls[0].select).toBe('project_name, requirements, hints');
        expect(supabase.calls[1].select).toBe('stage_placements');
        expect(supabase.calls[1].eqs).toEqual([['id', 7]]);
    });

    it('coluna não migrada: requirements/hints resolvidos normalmente, stagePlacements null', async () => {
        // Primeira consulta (template) funciona; a da coluna nova falha com 42703.
        const supabase = buildSupabase({ byId: { 7: { project_name: 'Template', requirements: { r: 1 }, hints: [] } } });
        const originalFrom = supabase.from.getMockImplementation();
        let n = 0;
        supabase.from.mockImplementation((table) => {
            const builder = originalFrom(table);
            if (n++ === 1) {
                builder.maybeSingle = () => Promise.resolve({ data: null, error: { code: '42703' } });
            }
            return builder;
        });
        const result = await resolveAssignmentFields(supabase, { id: 9, template_id: 7 }, { includeStagePlacements: true });
        expect(result).toEqual({ projectName: 'Template', requirements: { r: 1 }, hints: [], stagePlacements: null });
    });
});
