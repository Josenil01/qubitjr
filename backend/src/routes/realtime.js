/**
 * backend/src/routes/realtime.js
 *
 * GET /api/realtime/presence-token
 * Devolve o nome do canal de presença da turma pro cliente (aluno OU
 * professor) se conectar diretamente com a anon key — canal Realtime
 * público, protegido só por o cliente precisar já saber o turma_id (que só
 * vem de um fluxo autenticado, nunca é exposto publicamente).
 *
 * Não assina mais token nenhum: o projeto Supabase usa o sistema novo de
 * chaves assimétricas, que não permite importar uma chave de assinatura
 * própria nem extrair o secret legado — canal privado com RLS via
 * auth.jwt() não é viável aqui. Ver supabase-setup.sql.
 *
 * Também devolve `userId: req.userId` — o id JÁ RESOLVIDO pelo identity
 * middleware, mesma identidade usada pra projects.owner e student.id no
 * roster do professor (routes/teacher.js). Existe porque em
 * HELLOYOTTA_MODE=live o JWT bruto do aluno é o idToken do Firebase (claim
 * `sub`/`user_id` = UID do Firebase); a identidade de verdade (`id_usuario`)
 * só existe depois de verifyStudentToken() bater na HelloYotta aqui no
 * backend (ver services/helloyotta.js) — decodificar o token localmente no
 * cliente (como LiveWatch.js fazia) pega o UID do Firebase errado, que nunca
 * bate com nenhum id do roster. Ver LiveWatch.js#initLiveWatch.
 */

const express = require('express');

const router = express.Router();

router.post('/presence-token', (req, res) => {
    if (!req.turmaId) {
        return res.status(400).json({
            error: 'Token de identidade não traz turma_id — não é possível determinar o canal de presença.',
        });
    }

    res.json({ channel: `turma-presence:${req.turmaId}`, userId: req.userId });
});

module.exports = router;
