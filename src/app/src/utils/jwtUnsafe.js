/**
 * src/app/src/utils/jwtUnsafe.js
 *
 * Peek inseguro (NÃO verifica assinatura) no payload de um JWT, usando
 * window.atob - mesma técnica de backend/src/services/identity.js#
 * decodeJwtPayloadUnsafe, reimplementada aqui no navegador (sem Buffer).
 * Nunca usar isto pra qualquer decisão de segurança/autorização - é só pra
 * ler um identificador/claim pra exibição ou pra decidir se vale a pena
 * mostrar um botão (a checagem de verdade é sempre revalidada no backend
 * contra o token real).
 *
 * Fonte única (refatoração Fase 5) - esta função existia triplicada, byte a
 * byte idêntica, em AssignmentAuthorBar.js, LiveWatch.js e
 * GenerateActivityModal.js. A duplicação em GenerateActivityModal.js era
 * deliberada ("pra não criar uma dependência cruzada entre editor/ui e
 * lobby por causa de duas linhas" - ver docblock antigo daquele arquivo),
 * mas o problema real era não ter um lugar NEUTRO pros dois lados
 * importarem - utils/ já serve exatamente esse papel (os três arquivos já
 * importam de utils/lib.js), então a duplicação deixou de ser necessária.
 */
export function decodeJwtPayloadUnsafe (token) {
    try {
        if (!token || typeof token !== 'string') {
            return null;
        }
        const parts = token.split('.');
        if (parts.length < 2) {
            return null;
        }
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4 || 4)) % 4);
        const json = decodeURIComponent(window.atob(padded).split('').map((c) => (
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        )).join(''));
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}
