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
 *
 * Terceiro ponto de integração, SEPARADO dos dois acima e AINDA NÃO
 * confirmado com o time da HelloYotta: notifyAssignmentRegistered() avisa
 * (best-effort) quando um professor termina de cadastrar uma missão. Não
 * confundir com o roster/verify-token acima — aqueles têm contrato fechado
 * por e-mail; este usa HELLOYOTTA_ASSIGNMENT_WEBHOOK_URL, que fica vazia (e
 * a função vira no-op) até a URL real existir do lado deles.
 *
 * Quarto e quinto pontos, pro sistema de créditos de IA (ver
 * services/credits.js):
 *
 *  - getTeacherCredits(): lê o saldo do professor só pra EXIBIR na UI (GET
 *    /api/teacher/credits). NUNCA usar o retorno disto pra decidir se uma
 *    geração pode rodar (ver próximo item - teria a mesma corrida que
 *    debitTeacherCredits foi desenhada pra evitar).
 *
 *  - debitTeacherCredits(): débito SÍNCRONO E BLOQUEANTE, contrato
 *    confirmado por e-mail (2026-11). [2026-11-20] Design anterior
 *    (debitar localmente, avisar depois por webhook best-effort) foi
 *    REJEITADO pelo time da HelloYotta: eles identificaram que não
 *    serializa débitos concorrentes quando VÁRIAS plataformas (não só o
 *    QubitJr) debitam do MESMO saldo do MESMO professor ao mesmo tempo -
 *    cada uma decidindo "tem saldo?" sobre a própria cópia local, sem
 *    nenhum ponto único de verdade no momento da decisão. Corrigido: a
 *    decisão agora é SEMPRE da HelloYotta - chamamos o endpoint deles ANTES
 *    de qualquer geração e só seguimos se vier {success:true}. O valor
 *    debitado (`amount`) também NÃO é mais decidido por nós - só mandamos
 *    `reason` (qual ação), e eles resolvem o custo numa tabela própria,
 *    ajustável sem deploy do lado deles.
 *
 *    [2026-11-20] Contrato final (GET e debit) confirmado contra produção
 *    real da HelloYotta: os dois endpoints exigem header `X-App-Id: qubitjr`
 *    além do Bearer QUBITJR_API_KEY - sem ele a HelloYotta não sabe qual app
 *    chamador está debitando (não é mais `appId` no corpo do POST, como no
 *    rascunho anterior do contrato). O GET de saldo também deixou de ser
 *    placeholder: path fixo `/api/credits/teachers/:teacherId` (mesmo
 *    teacherId do debit), não precisa mais de HELLOYOTTA_CREDITS_ENDPOINT.
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
    // Resposta real vem envelopada: { success: true, data: { turmaName, students } }
    // — o e-mail original mostrou o formato sem o envelope, confirmado agora
    // testando direto contra produção.
    const data = body.data || body;
    return { turmaId, turmaName: data.turmaName, students: data.students || [] };
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

/**
 * Notificação best-effort para a HelloYotta quando um professor termina de
 * cadastrar uma missão (ver POST /api/assignments/register em
 * routes/assignments.js). O endpoint real de recebimento AINDA NÃO está
 * confirmado com o time deles (diferente de verify-token/roster acima, que
 * já são contrato fechado) — por isso fica atrás de uma env var própria,
 * HELLOYOTTA_ASSIGNMENT_WEBHOOK_URL, e vira no-op enquanto ela não existir.
 * Nunca lança: quem chama trata isso como fire-and-forget (ver
 * routes/assignments.js, mesmo padrão do sync de mídia em WebInterface.js).
 */
async function notifyAssignmentRegistered(payload) {
    const url = process.env.HELLOYOTTA_ASSIGNMENT_WEBHOOK_URL;
    if (!url) {
        // Não configurada ainda - no-op silencioso (log em debug, não warn,
        // pra não poluir os logs de produção com algo esperado por enquanto).
        if (process.env.DEBUG === 'true') {
            console.log('[helloyotta] notifyAssignmentRegistered: HELLOYOTTA_ASSIGNMENT_WEBHOOK_URL não configurada, pulando notificação');
        }
        return;
    }

    try {
        await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${QUBITJR_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.warn('[helloyotta] notifyAssignmentRegistered failed (non-fatal):', err.message);
    }
}

// Saldo generoso de propósito pra dev local (HELLOYOTTA_MODE=mock) - não
// depende de nenhum contrato, só destrava testar o fluxo de créditos sem
// travar em saldo zero.
const MOCK_CREDITS_BALANCE = 9999;

/**
 * Saldo de créditos de IA do professor. Contrato confirmado contra produção
 * real da HelloYotta (2026-11):
 *
 *   GET {HELLOYOTTA_API_URL}/api/credits/teachers/:teacherId
 *   Authorization: Bearer QUBITJR_API_KEY
 *   X-App-Id: qubitjr
 *
 * Só pra EXIBIR na UI - nunca usar o retorno pra decidir se uma geração pode
 * rodar (ver debitTeacherCredits). Em qualquer falha (rede, HTTP não-ok),
 * devolve null — services/credits.js mantém o último saldo local conhecido
 * em vez de zerar o professor na tela.
 *
 * @param {string} teacherToken - não usado na chamada (autenticação é via
 *        QUBITJR_API_KEY, não o token do professor) - mantido no parâmetro
 *        por simetria com getClassroomRoster/chamadores existentes.
 * @param {string} teacherId - sub do token, usado no modo mock e no path.
 * @returns {Promise<number|null>} saldo, ou null se a HelloYotta respondeu
 *          com erro ou a chamada falhou.
 */
async function getTeacherCredits(teacherToken, teacherId) {
    if (HELLOYOTTA_MODE === 'mock') {
        return MOCK_CREDITS_BALANCE;
    }

    if (!HELLOYOTTA_API_URL) {
        if (process.env.DEBUG === 'true') {
            console.log('[helloyotta] getTeacherCredits: HELLOYOTTA_API_URL não configurada, mantendo saldo local');
        }
        return null;
    }

    try {
        const url = `${HELLOYOTTA_API_URL}/api/credits/teachers/${encodeURIComponent(teacherId)}`;
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${QUBITJR_API_KEY}`, 'X-App-Id': 'qubitjr' },
        });
        if (!response.ok) {
            console.warn('[helloyotta] getTeacherCredits: HelloYotta respondeu', response.status, '- mantendo saldo local');
            return null;
        }
        const body = await response.json();
        // Mesmo cuidado do roster: resposta real pode vir envelopada em
        // { success, data: {...} } - aceita os dois formatos até confirmar.
        const data = body.data || body;
        const balance = Number(data.balance ?? data.credits);
        return Number.isFinite(balance) ? balance : null;
    } catch (err) {
        console.warn('[helloyotta] getTeacherCredits failed (non-fatal, mantendo saldo local):', err.message);
        return null;
    }
}

// Custos fixos só pra simular uma resposta plausível em modo mock - não tem
// nenhum efeito em produção, onde o custo real vem sempre da HelloYotta.
const MOCK_CREDIT_COSTS = {
    'activities.generate': 5,
    'hints.generate': 1,
};

/**
 * Débito SÍNCRONO E BLOQUEANTE de créditos de IA - decidido atomicamente do
 * lado da HelloYotta (ver docblock do arquivo pro raciocínio completo de
 * por que o design anterior, local, foi abandonado). Contrato confirmado
 * por e-mail (2026-11):
 *
 *   POST {HELLOYOTTA_API_URL}/api/credits/teachers/:teacherId/debit
 *   Authorization: Bearer QUBITJR_API_KEY
 *   X-App-Id: qubitjr
 *   Body: { reason, idempotencyKey }
 *
 * `reason` identifica a AÇÃO ('activities.generate' | 'hints.generate'),
 * nunca o valor - quem resolve quanto custa é a HelloYotta. `idempotencyKey`
 * deve ser único por TENTATIVA de geração (gerado em services/credits.js) -
 * reenviar a mesma key devolve o mesmo resultado sem debitar de novo,
 * essencial pra retry seguro de rede (um timeout do nosso lado não é
 * garantia de que o débito não aconteceu do lado deles).
 *
 * @returns {Promise<{success: boolean, debited?: number, balance: number}>}
 *          success:false (HTTP 402) = saldo insuficiente, nada foi debitado.
 * @throws se a HelloYotta responder 400 (reason não cadastrado do lado
 *         deles - avisar a HelloYotta antes de introduzir uma ação nova) ou
 *         qualquer outro erro de rede/servidor. NUNCA interpretar uma falha
 *         de rede/exceção como "pode gerar" - sem {success:true} confirmado,
 *         a geração não deve rodar.
 */
async function debitTeacherCredits(teacherId, reason, idempotencyKey) {
    if (HELLOYOTTA_MODE === 'mock') {
        // Sem endpoint real em dev - sempre aprova (mesmo espírito do resto
        // do modo mock: destrava testar o fluxo sem depender do contrato).
        return { success: true, debited: MOCK_CREDIT_COSTS[reason] || 0, balance: MOCK_CREDITS_BALANCE };
    }

    if (!HELLOYOTTA_API_URL) {
        throw new Error('HELLOYOTTA_API_URL não configurada para HELLOYOTTA_MODE=live');
    }

    const response = await fetch(`${HELLOYOTTA_API_URL}/api/credits/teachers/${encodeURIComponent(teacherId)}/debit`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${QUBITJR_API_KEY}`,
            'X-App-Id': 'qubitjr',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, idempotencyKey }),
    });

    if (response.status === 402) {
        // Resposta real vem envelopada: { success:false, error, data: { balance } }
        // — confirmado testando direto contra produção (mesmo formato do roster).
        const body = await response.json().catch(() => ({}));
        const data = body.data || body;
        return { success: false, balance: typeof data.balance === 'number' ? data.balance : 0 };
    }

    if (!response.ok) {
        // Inclui 400 (reason não cadastrado do lado deles) - não é um caso
        // de "saldo insuficiente", é configuração/contrato errado, por isso
        // lança em vez de devolver success:false.
        const err = new Error(`HelloYotta respondeu ${response.status} ao debitar créditos`);
        err.status = 502;
        throw err;
    }

    const body = await response.json();
    const data = body.data || body;
    return { success: true, debited: data.debited, balance: data.balance };
}

module.exports = {
    getClassroomRoster,
    verifyStudentToken,
    notifyAssignmentRegistered,
    getTeacherCredits,
    debitTeacherCredits,
};
