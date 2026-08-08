describe('helloyotta.getClassroomRoster (HELLOYOTTA_MODE=mock)', () => {
    let getClassroomRoster;

    beforeEach(() => {
        jest.resetModules();
        delete process.env.HELLOYOTTA_MODE; // default = mock
        ({ getClassroomRoster } = require('./helloyotta'));
    });

    // No modo mock o teacherToken não é usado (só teacherId), mas o
    // parâmetro existe pra manter a assinatura igual ao modo live.
    it('returns the roster for the authorized teacher', async () => {
        const roster = await getClassroomRoster('fake-token', 'prof_001', 'turma-mock-001');
        expect(roster).not.toBeNull();
        expect(roster.turmaId).toBe('turma-mock-001');
        expect(roster.students.map((s) => s.id)).toEqual(['usr_001', 'usr_002']);
    });

    it('returns null for a teacher not assigned to that turma', () => {
        return expect(getClassroomRoster('fake-token', 'prof_999', 'turma-mock-001')).resolves.toBeNull();
    });

    it('returns null for an unknown turma', () => {
        return expect(getClassroomRoster('fake-token', 'prof_001', 'turma-inexistente')).resolves.toBeNull();
    });
});

describe('helloyotta.getClassroomRoster (HELLOYOTTA_MODE=live)', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env.HELLOYOTTA_MODE = 'live';
    });

    afterEach(() => {
        delete process.env.HELLOYOTTA_MODE;
        delete process.env.HELLOYOTTA_API_URL;
    });

    it('throws when HELLOYOTTA_API_URL is not configured', async () => {
        const { getClassroomRoster } = require('./helloyotta');
        await expect(getClassroomRoster('teacher-token', 'prof_001', 'turma-mock-001')).rejects.toThrow(
            /HELLOYOTTA_API_URL/
        );
    });

    it('calls the confirmed endpoint with the teacher token as Bearer auth', async () => {
        process.env.HELLOYOTTA_API_URL = 'https://helloyotta.example.com';
        const { getClassroomRoster } = require('./helloyotta');

        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ turmaName: 'Turma X', students: [{ id: 'usr_777', name: 'Zé' }] }),
        });

        try {
            const roster = await getClassroomRoster('teacher-token-abc', 'prof_001', 'turma-x');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://helloyotta.example.com/api/qubit/classrooms/turma-x/roster',
                expect.objectContaining({
                    headers: { Authorization: 'Bearer teacher-token-abc' },
                })
            );
            expect(roster).toEqual({
                turmaId: 'turma-x',
                turmaName: 'Turma X',
                students: [{ id: 'usr_777', name: 'Zé' }],
            });
        } finally {
            global.fetch = originalFetch;
        }
    });

    // Formato real confirmado testando direto contra produção (2026-08): a
    // resposta vem envelopada em {success, data}, diferente do exemplo plano
    // do e-mail original — causava lista de alunos sempre vazia em produção.
    it('unwraps the real {success, data} envelope HelloYotta actually returns', async () => {
        process.env.HELLOYOTTA_API_URL = 'https://helloyotta.example.com';
        const { getClassroomRoster } = require('./helloyotta');

        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data: { turmaName: 'Turma X', students: [{ id: 'usr_777', name: 'Zé' }] },
            }),
        });

        try {
            const roster = await getClassroomRoster('teacher-token-abc', 'prof_001', 'turma-x');
            expect(roster).toEqual({
                turmaId: 'turma-x',
                turmaName: 'Turma X',
                students: [{ id: 'usr_777', name: 'Zé' }],
            });
        } finally {
            global.fetch = originalFetch;
        }
    });
});

describe('helloyotta.verifyStudentToken', () => {
    afterEach(() => {
        delete process.env.HELLOYOTTA_MODE;
        delete process.env.HELLOYOTTA_API_URL;
        jest.resetModules();
    });

    it('returns null in mock mode (no real endpoint to call)', async () => {
        jest.resetModules();
        delete process.env.HELLOYOTTA_MODE;
        const { verifyStudentToken } = require('./helloyotta');
        await expect(verifyStudentToken('any-token')).resolves.toBeNull();
    });

    it('calls the confirmed endpoint with the QubitJr API key as Bearer and the student token in the body', async () => {
        jest.resetModules();
        process.env.HELLOYOTTA_MODE = 'live';
        process.env.HELLOYOTTA_API_URL = 'https://helloyotta.example.com';
        process.env.QUBITJR_API_KEY = 'qubitjr-api-key-xyz';
        const { verifyStudentToken } = require('./helloyotta');

        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, studentId: 'usr_001', id_usuario: 'usr_001', turma_id: 'turma-xyz' }),
        });

        try {
            const claims = await verifyStudentToken('student-firebase-id-token');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://helloyotta.example.com/api/auth/verify-token',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({ Authorization: 'Bearer qubitjr-api-key-xyz' }),
                    body: JSON.stringify({ idToken: 'student-firebase-id-token' }),
                })
            );
            expect(claims).toEqual({ sub: 'usr_001', id_usuario: 'usr_001', turma_id: 'turma-xyz' });
        } finally {
            global.fetch = originalFetch;
            delete process.env.QUBITJR_API_KEY;
        }
    });

    it('returns null when HelloYotta responds ok:false', async () => {
        jest.resetModules();
        process.env.HELLOYOTTA_MODE = 'live';
        process.env.HELLOYOTTA_API_URL = 'https://helloyotta.example.com';
        const { verifyStudentToken } = require('./helloyotta');

        const originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false }) });

        try {
            await expect(verifyStudentToken('bad-token')).resolves.toBeNull();
        } finally {
            global.fetch = originalFetch;
        }
    });
});
