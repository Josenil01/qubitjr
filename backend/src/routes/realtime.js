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
 */

const express = require('express');

const router = express.Router();

router.post('/presence-token', (req, res) => {
    if (!req.turmaId) {
        return res.status(400).json({
            error: 'Token de identidade não traz turma_id — não é possível determinar o canal de presença.',
        });
    }

    res.json({ channel: `turma-presence:${req.turmaId}` });
});

module.exports = router;
