const { resolveAssignmentFields } = require('./assignmentResolver');

/**
 * Builds a mock supabase client exposing exactly the chain resolveAssignmentFields
 * calls: .from('assignments').select(...).eq('id', ...).maybeSingle() -> Promise<{data, error}>.
 * No real Supabase connection involved - just a hand-built stub matching that shape.
 */
function buildSupabaseMock(maybeSingleResult) {
    const maybeSingle = jest.fn().mockResolvedValue(maybeSingleResult);
    const eq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ select }));
    return { from, select, eq, maybeSingle };
}

describe('assignmentResolver.resolveAssignmentFields', () => {
    it('resolves to null when assignmentRow is null or undefined', async () => {
        const supabase = buildSupabaseMock({ data: null, error: null });

        await expect(resolveAssignmentFields(supabase, null)).resolves.toBeNull();
        await expect(resolveAssignmentFields(supabase, undefined)).resolves.toBeNull();
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('returns the row\'s own fields directly when template_id is falsy, with no DB call', async () => {
        const supabase = buildSupabaseMock({ data: null, error: null });
        const templateRow = {
            id: 1,
            template_id: null,
            project_name: 'Missão da Fazenda',
            requirements: { scenes: { count: 1, used: ['Farm.svg'] } },
        };

        const result = await resolveAssignmentFields(supabase, templateRow);

        expect(result).toEqual({
            projectName: 'Missão da Fazenda',
            requirements: { scenes: { count: 1, used: ['Farm.svg'] } },
        });
        // Prova que nenhuma consulta desnecessária foi feita para uma linha de template.
        expect(supabase.from).not.toHaveBeenCalled();
        expect(supabase.select).not.toHaveBeenCalled();
        expect(supabase.eq).not.toHaveBeenCalled();
        expect(supabase.maybeSingle).not.toHaveBeenCalled();
    });

    it('returns the TEMPLATE fields (not the reference row\'s own) when template_id is set and the template is found', async () => {
        const supabase = buildSupabaseMock({
            data: { project_name: 'Template Original', requirements: { scenes: { count: 5, used: [] } } },
            error: null,
        });
        const referenceRow = {
            id: 2,
            template_id: 1,
            // Deliberadamente diferentes do template, para provar que são
            // ESTES campos que devem perder para os do template.
            project_name: 'campo antigo da referência (não deve vencer)',
            requirements: { scenes: { count: 0, used: [] } },
        };

        const result = await resolveAssignmentFields(supabase, referenceRow);

        expect(result).toEqual({
            projectName: 'Template Original',
            requirements: { scenes: { count: 5, used: [] } },
        });
        expect(supabase.from).toHaveBeenCalledWith('assignments');
        expect(supabase.select).toHaveBeenCalledWith('project_name, requirements');
        expect(supabase.eq).toHaveBeenCalledWith('id', 1);
    });

    it('degrades to the row\'s own fields, without throwing, when the template lookup returns an error', async () => {
        const supabase = buildSupabaseMock({ data: null, error: { message: 'boom' } });
        const referenceRow = { id: 3, template_id: 999, project_name: null, requirements: null };

        await expect(resolveAssignmentFields(supabase, referenceRow)).resolves.toEqual({
            projectName: null,
            requirements: null,
        });
    });

    it('degrades to the row\'s own fields, without throwing, when the template row no longer exists (deleted)', async () => {
        const supabase = buildSupabaseMock({ data: null, error: null });
        const referenceRow = { id: 4, template_id: 999, project_name: null, requirements: null };

        await expect(resolveAssignmentFields(supabase, referenceRow)).resolves.toEqual({
            projectName: null,
            requirements: null,
        });
    });

    it('degrades to the row\'s own fields, without throwing, when the supabase call itself throws', async () => {
        const maybeSingle = jest.fn().mockRejectedValue(new Error('network down'));
        const eq = jest.fn(() => ({ maybeSingle }));
        const select = jest.fn(() => ({ eq }));
        const from = jest.fn(() => ({ select }));
        const supabase = { from, select, eq, maybeSingle };
        const referenceRow = {
            id: 5,
            template_id: 999,
            project_name: 'fallback name',
            requirements: { blocks: { count: 1, byType: {} } },
        };

        await expect(resolveAssignmentFields(supabase, referenceRow)).resolves.toEqual({
            projectName: 'fallback name',
            requirements: { blocks: { count: 1, byType: {} } },
        });
    });
});
