/**
 * src/app/src/services/RealtimeClient.js
 *
 * Wrapper fino sobre o cliente Supabase Realtime, usado só pela observação
 * ao vivo professor/aluno (LiveWatch.js). Não lida com dados de projeto
 * "normais" — isso continua indo por WebInterface.js/backend REST, como
 * sempre.
 *
 * ⚠️ Não testado contra um projeto Supabase real neste ambiente. Requer
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY em .env.local.
 *
 * Canais públicos (não privados) — o projeto Supabase usa o sistema novo de
 * chaves assimétricas, que não permite importar uma chave de assinatura
 * própria nem extrair o secret legado, então canal privado com RLS via
 * auth.jwt() não é viável. A proteção aqui é o nome do canal ser um UUID
 * imprevisível (gerado pelo backend), mesmo padrão já usado no share_token
 * de projeto público — não é RLS de verdade, é "impossível de adivinhar".
 */

import { createClient } from '@supabase/supabase-js';

let _client = null;

function getClient() {
    if (_client) return _client;
    const url = import.meta.env?.VITE_SUPABASE_URL;
    const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
        console.warn('[RealtimeClient] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY não configurados — recursos ao vivo desativados.');
        return null;
    }
    _client = createClient(url, anonKey);
    return _client;
}

/**
 * Conecta a um canal público. Devolve null se o Supabase não estiver
 * configurado no frontend.
 */
function connectChannel(channelName) {
    const client = getClient();
    if (!client || !channelName) return null;
    return client.channel(channelName, { config: { broadcast: { self: false } } });
}

export { getClient, connectChannel };
