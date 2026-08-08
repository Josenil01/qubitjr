/**
 * backend/src/services/helloyotta.js
 *
 * Integração com a HelloYotta (plataforma mãe) — fonte da verdade para
 * autorização professor↔turma, roster de alunos, e verificação do token do
 * aluno. Contrato confirmado por e-mail com o time da HelloYotta (ver
 * conversa de arquitetura de live-session) — dois mecanismos de identidade
 * diferentes, não confundir:
 *
 *  - Token do PROFESSOR: assinado com QUBITJR_JWT_SECRET (HMAC compartilhado),
 *    verificado LOCALMENTE em services/identity.js — não passa por aqui.
 *  - Token do ALUNO: assinado com uma chave que NÃO é compartilhada com a
 *    gente — só a HelloYotta pode verificar. Por isso chamamos
 *    verifyStudentToken() abaixo, que bate no endpoint deles.
 *
 * HELLOYOTTA_MODE=mock (padrão) usa um roster fixo local para desenvolvimento,
 * sem depender dos endpoints reais.
 */

const HELLOYOTTA_MODE = process.env.HELLOYOTTA_MODE || 'mock';
const HELLOYOTTA_API_URL = process.env.HELLOYOTTA_API_URL || '';
// Chave dedicada ao QubitJr (não confundir com a QUBIT_API_KEY da integração
// "Qubit" original, de progresso do aluno — são chaves diferentes, ver
// e-mail da HelloYotta de 2026-08 sobre a QUBITJR_API_KEY).
const QUBITJR_API_KEY = process.env.QUBITJR_API_KEY || '';

// Roster fixo para desenvolvimento local (HELLOYOTTA_MODE=mock).
// IDs de aluno batem com os MOCK_TOKENS de backend/src/index.js.
const MOCK_ROSTER = {
    'turma-mock-001': {
        turmaName: 'Turma Mock 3A',
        teacherId: 'prof_001',
        students: [
            { id: 'usr_001', name: 'Aluno A (mock)' },
            { id: 'usr_002', name: 'Aluno B (mock)' },
        ],
    },
};

/**
 * Retorna o roster de uma turma, se o professor tiver acesso a ela.
 * @param {string} teacherToken - token do professor JÁ VERIFICADO localmente
 *        (ver identity.js) — repassado como Bearer pra HelloYotta autorizar.
 * @param {string} teacherId - sub do token, usado só no modo mock.
 * @param {string} turmaId
 * @returns {Promise<{turmaId: string, turmaName: string, students: Array<{id:string,name:string}>}|null>}
 *          null quando o professor não tem acesso à turma (ou ela não existe) —
 *          rota chamadora deve responder 403, não vazar se a turma existe.
 */
async function getClassroomRoster(teacherToken, teacherId, turmaId) {
    if (HELLOYOTTA_MODE === 'mock') {
        const turma = MOCK_ROSTER[turmaId];
        if (!turma || turma.teacherId !== teacherId) return null;
        return { turmaId, turmaName: turma.turmaName, students: turma.students };
    }

    if (!HELLOYOTTA_API_URL) {
        throw new Error('HELLOYOTTA_API_URL não configurada para HELLOYOTTA_MODE=live');
    }

    // Contrato confirmado por e-mail (2026-08): GET /api/qubit/classrooms/:turmaId/roster,
    // Authorization: Bearer <token do professor> (não X-Teacher-Id).
    const response = await fetch(`${HELLOYOTTA_API_URL}/api/qubit/classrooms/${turmaId}/roster`, {
        headers: { Authorization: `Bearer ${teacherToken}` },
    });

    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok) {
        const err = new Error(`HelloYotta respondeu ${response.status}`);
        err.status = 502;
        throw err;
    }

    const body = await response.json();
    return { turmaId, turmaName: body.turmaName, students: body.students || [] };
}

/**
 * Verifica um token de ALUNO junto à HelloYotta (não temos a chave de
 * assinatura desse token, só eles conseguem validar).
 *
 * Contrato confirmado por e-mail (2026-08): o Bearer é a NOSSA API key
 * (QUBITJR_API_KEY, identifica o QubitJr como chamador) — o token do
 * aluno vai no corpo, campo `idToken` (aceita tanto o Firebase idToken cru
 * da primeira verificação quanto um `authToken` já emitido numa renovação).
 * Não confundir com o Bearer do endpoint de roster (modo recomendado usa o
 * token do PROFESSOR, não essa API key) — são mecanismos diferentes.
 *
 * @returns {Promise<{sub: string, id_usuario: string, turma_id: string}|null>}
 *          null se a HelloYotta responder ok:false ou o request falhar.
 */
async function verifyStudentToken(token) {
    if (HELLOYOTTA_MODE === 'mock') {
        // Sem endpoint real em dev — decodifica sem verificar, mesmo aviso
        // inseguro do fallback de identity.js. Usado só com AUTH_MODE=mock.
        return null;
    }

    if (!HELLOYOTTA_API_URL) {
        throw new Error('HELLOYOTTA_API_URL não configurada para HELLOYOTTA_MODE=live');
    }

    const response = await fetch(`${HELLOYOTTA_API_URL}/api/auth/verify-token`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${QUBITJR_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken: token }),
    });

    if (!response.ok) return null;

    const body = await response.json();
    if (!body.ok) return null;

    return {
        sub: body.id_usuario || body.studentId,
        id_usuario: body.id_usuario,
        turma_id: body.turma_id,
    };
}

module.exports = { getClassroomRoster, verifyStudentToken };
