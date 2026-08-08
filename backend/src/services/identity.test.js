const jwt = require('jsonwebtoken');

jest.mock('./helloyotta', () => ({
    verifyStudentToken: jest.fn(),
}));

const { verifyStudentToken } = require('./helloyotta');
const {
    verifyAndDecode,
    getUserIdFromClaims,
    getTurmaIdFromClaims,
    getPresenceStatusFromClaims,
} = require('./identity');

function fakeJwt(payload) {
    const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${b64({ alg: 'none' })}.${b64(payload)}.`;
}

beforeEach(() => {
    verifyStudentToken.mockReset();
});

describe('identity.verifyAndDecode — roteamento por formato de claim', () => {
    it('returns null for malformed tokens', async () => {
        await expect(verifyAndDecode('not-a-jwt')).resolves.toBeNull();
        await expect(verifyAndDecode('')).resolves.toBeNull();
        await expect(verifyAndDecode(null)).resolves.toBeNull();
    });

    it('returns null for a token whose payload is not valid JSON', async () => {
        const garbled = `${Buffer.from('{}').toString('base64url')}.not-base64-json.`;
        await expect(verifyAndDecode(garbled)).resolves.toBeNull();
    });
});

describe('identity.verifyAndDecode — token de PROFESSOR (role: "professor", HMAC local)', () => {
    const SECRET = 'test-shared-secret';

    beforeEach(() => {
        process.env.QUBITJR_JWT_SECRET = SECRET;
    });

    afterEach(() => {
        delete process.env.QUBITJR_JWT_SECRET;
    });

    it('accepts a token signed with the correct shared secret', async () => {
        const token = jwt.sign({ sub: 'prof_001', role: 'professor', turma_id: 'turma-001' }, SECRET, { algorithm: 'HS256' });
        const claims = await verifyAndDecode(token);
        expect(claims).toMatchObject({ sub: 'prof_001', role: 'professor', turma_id: 'turma-001' });
        expect(verifyStudentToken).not.toHaveBeenCalled();
    });

    it('rejects a token signed with the wrong secret', async () => {
        const token = jwt.sign({ sub: 'prof_001', role: 'professor' }, 'wrong-secret', { algorithm: 'HS256' });
        await expect(verifyAndDecode(token)).resolves.toBeNull();
    });

    it('rejects an unsigned/none-alg professor token even if well-formed', async () => {
        const token = fakeJwt({ sub: 'prof_001', role: 'professor' });
        await expect(verifyAndDecode(token)).resolves.toBeNull();
    });

    it('rejects an expired token', async () => {
        const token = jwt.sign({ sub: 'prof_001', role: 'professor' }, SECRET, { algorithm: 'HS256', expiresIn: -10 });
        await expect(verifyAndDecode(token)).resolves.toBeNull();
    });

    it('falls back to unsafe decode when QUBITJR_JWT_SECRET is not configured', async () => {
        delete process.env.QUBITJR_JWT_SECRET;
        const token = fakeJwt({ sub: 'prof_001', role: 'professor' });
        await expect(verifyAndDecode(token)).resolves.toEqual({ sub: 'prof_001', role: 'professor' });
    });
});

describe('identity.verifyAndDecode — token de ALUNO (sem role, verificação remota)', () => {
    afterEach(() => {
        delete process.env.HELLOYOTTA_MODE;
    });

    it('HELLOYOTTA_MODE=mock: decodes without calling the remote verifier', async () => {
        delete process.env.HELLOYOTTA_MODE; // default mock
        const token = fakeJwt({ id_usuario: 'usr_001', sub: 'usr_001', turma_id: 'turma-001' });
        const claims = await verifyAndDecode(token);
        expect(claims).toMatchObject({ id_usuario: 'usr_001', sub: 'usr_001' });
        expect(verifyStudentToken).not.toHaveBeenCalled();
    });

    it('HELLOYOTTA_MODE=live: delegates to verifyStudentToken and returns its result', async () => {
        process.env.HELLOYOTTA_MODE = 'live';
        verifyStudentToken.mockResolvedValue({ sub: 'usr_001', id_usuario: 'usr_001', turma_id: 'turma-001' });

        const token = fakeJwt({ id_usuario: 'usr_001' });
        const claims = await verifyAndDecode(token);
        expect(verifyStudentToken).toHaveBeenCalledWith(token);
        expect(claims).toEqual({ sub: 'usr_001', id_usuario: 'usr_001', turma_id: 'turma-001' });
    });

    it('HELLOYOTTA_MODE=live: returns null when the remote verifier rejects the token', async () => {
        process.env.HELLOYOTTA_MODE = 'live';
        verifyStudentToken.mockResolvedValue(null);

        const token = fakeJwt({ id_usuario: 'usr_001' });
        await expect(verifyAndDecode(token)).resolves.toBeNull();
    });
});

describe('identity.getUserIdFromClaims', () => {
    it('prefers user_id, then sub, then studentId, then id_usuario', () => {
        expect(getUserIdFromClaims({ user_id: 'a', sub: 'b', studentId: 'c', id_usuario: 'd' })).toBe('a');
        expect(getUserIdFromClaims({ sub: 'b', studentId: 'c' })).toBe('b');
        expect(getUserIdFromClaims({ studentId: 'c' })).toBe('c');
        expect(getUserIdFromClaims({ id_usuario: 'd' })).toBe('d');
    });

    it('returns null when no identity claim is present', () => {
        expect(getUserIdFromClaims({})).toBeNull();
        expect(getUserIdFromClaims(null)).toBeNull();
    });
});

describe('identity.getTurmaIdFromClaims', () => {
    it('reads turma_id / turmaId / classroom_id aliases', () => {
        expect(getTurmaIdFromClaims({ turma_id: 't1' })).toBe('t1');
        expect(getTurmaIdFromClaims({ turmaId: 't2' })).toBe('t2');
        expect(getTurmaIdFromClaims({ classroom_id: 't3' })).toBe('t3');
    });

    it('returns null when absent', () => {
        expect(getTurmaIdFromClaims({})).toBeNull();
    });
});

describe('identity.getPresenceStatusFromClaims', () => {
    it('reads status / presence_status aliases', () => {
        expect(getPresenceStatusFromClaims({ status: 'presente' })).toBe('presente');
        expect(getPresenceStatusFromClaims({ presence_status: 'ausente' })).toBe('ausente');
    });

    it('returns null when absent', () => {
        expect(getPresenceStatusFromClaims({})).toBeNull();
    });
});
