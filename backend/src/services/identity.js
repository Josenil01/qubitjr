/**
 * backend/src/services/identity.js
 *
 * Resolve a identidade (userId) a partir de um token JWT recebido no header
 * Authorization. Contrato confirmado por e-mail com o time da HelloYotta —
 * professor e aluno usam mecanismos de verificação DIFERENTES:
 *
 *  - Token do PROFESSOR: { sub, role: "professor", turma_id, iat, exp },
 *    assinado com QUBITJR_JWT_SECRET (HMAC compartilhado) — verificado
 *    LOCALMENTE aqui, sem chamada de rede.
 *  - Token do ALUNO: { id_usuario, sub, iss: "helloyotta-auth",
 *    aud: "qubitjr", turma_id, iat, exp }, assinado com uma chave que a
 *    HelloYotta NÃO compartilha — verificado remotamente via
 *    services/helloyotta.js#verifyStudentToken (POST /api/auth/verify-token).
 *
 * Os dois formatos têm `sub`, mas só o do professor tem `role`. Usamos isso
 * pra rotear qual verificação aplicar (ver verifyAndDecode). O peek inicial
 * é sempre inseguro (não verificado) — só usado pra decidir o caminho, nunca
 * pra confiar na identidade em si.
 *
 * Cache de verificação de aluno: identityMiddleware roda em toda request
 * (ver backend/src/index.js), então sem cache um cliente fazendo polling
 * (ex.: LiveWatch) reverifica o MESMO token a cada chamada — cada uma bate
 * na HelloYotta e conta como leitura no Firestore deles. Estourou a cota de
 * leituras do plano Spark por causa disso (2026-08). Corrigido guardando o
 * resultado da verificação em memória, chaveado pelo token, até o `exp` do
 * próprio JWT vencer: um token só é verificado remotamente uma vez.
 */

const jwt = require('jsonwebtoken');
const { verifyStudentToken } = require('./helloyotta');

// token -> { claims, expiresAt (ms epoch) }. Local ao processo — não
// sobrevive a cold start em serverless, mas já elimina a reverificação
// repetida numa mesma instância quente (o caso comum de polling).
const studentTokenCache = new Map();

function getCachedStudentClaims(token) {
    const entry = studentTokenCache.get(token);
    if (!entry) return undefined; // undefined = "não cacheado" (claims em si pode ser null)
    if (Date.now() >= entry.expiresAt) {
        studentTokenCache.delete(token);
        return undefined;
    }
    return entry.claims;
}

function setCachedStudentClaims(token, claims, peek) {
    // Sem `exp` no peek não dá pra saber até quando o cache é válido — não
    // cacheia, pra não reter claims (ou uma rejeição) indefinidamente.
    if (!peek || typeof peek.exp !== 'number') return;
    studentTokenCache.set(token, { claims, expiresAt: peek.exp * 1000 });
}

function decodeJwtPayloadUnsafe(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4 || 4)) % 4);
        const json = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(json);
    } catch (_) {
        return null;
    }
}

/**
 * Verificação local do token do PROFESSOR (HMAC, QUBITJR_JWT_SECRET).
 * Trade-off aceito conscientemente: com HMAC, quem verifica também consegue
 * assinar — se QUBITJR_JWT_SECRET vazar do nosso lado, dá pra forjar token
 * de professor. Guardar como segredo de verdade (nunca commitar, nunca logar).
 */
function verifyTeacherToken(token) {
    const secret = process.env.QUBITJR_JWT_SECRET;

    if (!secret) {
        console.warn('[identity] QUBITJR_JWT_SECRET não configurada — aceitando token de professor SEM verificar assinatura (inseguro, só ok fora de produção)');
        return decodeJwtPayloadUnsafe(token);
    }

    try {
        return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch (err) {
        console.warn('[identity] Token de professor rejeitado — assinatura inválida ou expirada:', err.message);
        return null;
    }
}

/**
 * Roteia pra verificação certa com base no formato das claims (peek
 * inseguro só pra decidir o caminho). Assíncrono porque a verificação do
 * aluno é uma chamada de rede pra HelloYotta.
 */
async function verifyAndDecode(token) {
    const peek = decodeJwtPayloadUnsafe(token);
    if (!peek) return null;

    if (peek.role === 'professor') {
        return verifyTeacherToken(token);
    }

    // Token de aluno: só a HelloYotta consegue verificar a assinatura.
    const mode = process.env.HELLOYOTTA_MODE || 'mock';
    if (mode === 'mock') {
        console.warn('[identity] HELLOYOTTA_MODE=mock — aceitando token de aluno SEM verificação remota (inseguro, só ok fora de produção)');
        return peek;
    }

    const cached = getCachedStudentClaims(token);
    if (cached !== undefined) return cached;

    const claims = await verifyStudentToken(token);
    if (!claims) {
        console.warn('[identity] Token de aluno rejeitado pela verificação remota da HelloYotta');
    }
    // Cacheia os dois desfechos (aceito e rejeitado) — uma rejeição também
    // não deve ser reverificada a cada request do mesmo token inválido.
    setCachedStudentClaims(token, claims, peek);
    return claims;
}

function getUserIdFromClaims(claims) {
    if (!claims || typeof claims !== 'object') return null;
    return claims.user_id || claims.sub || claims.studentId || claims.id_usuario || null;
}

/**
 * turma_id embarcado no token — confirmado no contrato: tanto o token do
 * professor quanto o do aluno trazem `turma_id` assinado.
 * Não usar o parâmetro de URL `classId` (WebInterface.js) para isso — ele não
 * é assinado e qualquer cliente pode alterá-lo.
 */
function getTurmaIdFromClaims(claims) {
    if (!claims || typeof claims !== 'object') return null;
    return claims.turma_id || claims.turmaId || claims.classroom_id || null;
}

/**
 * Status de presença (ex.: "presente") embarcado no token pela HelloYotta.
 * Ainda não confirmado no contrato — capturado, mas nenhuma rota depende disso hoje.
 */
function getPresenceStatusFromClaims(claims) {
    if (!claims || typeof claims !== 'object') return null;
    return claims.status || claims.presence_status || null;
}

module.exports = {
    verifyAndDecode,
    getUserIdFromClaims,
    getTurmaIdFromClaims,
    getPresenceStatusFromClaims,
};
