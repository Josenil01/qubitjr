'use strict';

const { readCompletionSnapshot, persistCompletion, readCompletionFlags } = require('./completionSnapshot');

// Mock mínimo do cliente Supabase encadeável (.from().select()...) - só os
// métodos que completionSnapshot.js realmente chama, cada um devolvendo
// `this` até o método terminal (maybeSingle) resolver a Promise configurada
// pelo teste.
function fakeSupabase (result) {
    const chain = {
        from: jest.fn(() => chain),
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        is: jest.fn(() => chain),
        not: jest.fn(() => chain),
        in: jest.fn(() => chain),
        update: jest.fn(() => chain),
        maybeSingle: jest.fn(() => Promise.resolve(result)),
        then: (resolve) => Promise.resolve(result).then(resolve),
    };
    return chain;
}

describe('completionSnapshot.readCompletionSnapshot', () => {
    it('devolve null quando o projeto nunca foi concluído', async () => {
        const supabase = fakeSupabase({ data: { assignment_completed_at: null, assignment_completion_snapshot: null }, error: null });
        expect(await readCompletionSnapshot(supabase, 1)).toBeNull();
    });

    it('devolve a foto quando já concluído', async () => {
        const snapshot = { scenes: { met: true }, characters: { met: true }, blocks: { met: true } };
        const supabase = fakeSupabase({ data: { assignment_completed_at: '2026-09-27T00:00:00.000Z', assignment_completion_snapshot: snapshot }, error: null });
        const result = await readCompletionSnapshot(supabase, 1);
        expect(result).toEqual({ completedAt: '2026-09-27T00:00:00.000Z', snapshot });
    });

    it('trata coluna ainda não migrada (42703) como "nunca concluído", não como erro', async () => {
        const supabase = fakeSupabase({ data: null, error: { code: '42703', message: 'column does not exist' } });
        expect(await readCompletionSnapshot(supabase, 1)).toBeNull();
    });

    it('nunca lança - erro inesperado também vira null (best-effort)', async () => {
        const supabase = fakeSupabase({ data: null, error: { code: '500', message: 'boom' } });
        await expect(readCompletionSnapshot(supabase, 1)).resolves.toBeNull();
    });
});

describe('completionSnapshot.persistCompletion', () => {
    it('grava e devolve a foto na primeira vez (UPDATE casa a linha)', async () => {
        const snapshot = { scenes: { met: true } };
        const supabase = fakeSupabase({ data: { assignment_completed_at: '2026-09-27T00:00:00.000Z', assignment_completion_snapshot: snapshot }, error: null });
        const result = await persistCompletion(supabase, 1, snapshot);
        expect(result).toEqual({ persisted: true, completedAt: '2026-09-27T00:00:00.000Z', snapshot });
        expect(supabase.is).toHaveBeenCalledWith('assignment_completed_at', null);
    });

    it('corrida: UPDATE não casa nenhuma linha (já tinha completed_at) - relê e devolve a existente', async () => {
        const existingSnapshot = { scenes: { met: true } };
        let call = 0;
        const supabase = fakeSupabase(null);
        supabase.maybeSingle = jest.fn(() => {
            call += 1;
            // 1ª chamada: o UPDATE, sem linha casada (já concluído por outra requisição).
            if (call === 1) return Promise.resolve({ data: null, error: null });
            // 2ª chamada: o re-select de readCompletionSnapshot.
            return Promise.resolve({ data: { assignment_completed_at: '2026-09-26T23:00:00.000Z', assignment_completion_snapshot: existingSnapshot }, error: null });
        });
        const result = await persistCompletion(supabase, 1, { scenes: { met: true } });
        expect(result).toEqual({ persisted: true, completedAt: '2026-09-26T23:00:00.000Z', snapshot: existingSnapshot });
    });

    it('migração não rodada (42703) não lança - persisted:false', async () => {
        const supabase = fakeSupabase({ data: null, error: { code: '42703' } });
        const result = await persistCompletion(supabase, 1, {});
        expect(result).toEqual({ persisted: false, reason: 'not_migrated' });
    });
});

describe('completionSnapshot.readCompletionFlags', () => {
    it('lista vazia de ids não bate no banco - Set vazio direto', async () => {
        const supabase = fakeSupabase({ data: [], error: null });
        const result = await readCompletionFlags(supabase, []);
        expect(result).toEqual(new Set());
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('devolve só os ids que têm assignment_completed_at', async () => {
        const supabase = fakeSupabase({ data: [{ id: 10 }, { id: 30 }], error: null });
        const result = await readCompletionFlags(supabase, [10, 20, 30]);
        expect(result).toEqual(new Set([10, 30]));
        expect(supabase.in).toHaveBeenCalledWith('id', [10, 20, 30]);
    });

    it('migração não rodada (42703) - Set vazio, não lança', async () => {
        const supabase = fakeSupabase({ data: null, error: { code: '42703' } });
        await expect(readCompletionFlags(supabase, [1])).resolves.toEqual(new Set());
    });

    it('erro inesperado - Set vazio, não lança (best-effort)', async () => {
        const supabase = fakeSupabase({ data: null, error: { code: '500', message: 'boom' } });
        await expect(readCompletionFlags(supabase, [1])).resolves.toEqual(new Set());
    });
});
