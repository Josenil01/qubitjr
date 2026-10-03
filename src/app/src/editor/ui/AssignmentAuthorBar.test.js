// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';

// AssignmentAuthorBar.js importa ScratchJr.js só pra usar
// currentProject/saveProject (nenhuma das 3 funções testadas aqui depende
// disso) - mas ScratchJr.js arrasta a cadeia inteira do motor/painteditor,
// que por sua vez estende SVGMatrix.prototype (Transform.js), uma interface
// SVG que o jsdom não implementa. Mock vazio evita carregar essa cadeia só
// pra testar funções puras que nunca tocam o motor do editor.
vi.mock('../ScratchJr.js', () => ({default: {}}));

import {isAllowedReturnUrl, getAuthorId, hintWhenLabel} from './AssignmentAuthorBar.js';

/** header.payload.signature com um payload JSON arbitrário, base64url - mesmo helper de utils/jwtUnsafe.test.js. */
function fakeJwt (payload) {
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64url({alg: 'none'})}.${b64url(payload)}.sig`;
}

afterEach(() => {
    delete window.__AUTH_TOKEN__;
});

describe('isAllowedReturnUrl', () => {
    it('aceita helloyotta.com e qualquer subdomínio dele, sempre https', () => {
        expect(isAllowedReturnUrl('https://helloyotta.com/voltar')).toBe(true);
        expect(isAllowedReturnUrl('https://app.helloyotta.com/voltar')).toBe(true);
        expect(isAllowedReturnUrl('https://a.b.helloyotta.com/x')).toBe(true);
    });

    it('rejeita qualquer outro host, mesmo parecido (typosquat/subdomínio reverso)', () => {
        expect(isAllowedReturnUrl('https://helloyotta.com.evil.com/voltar')).toBe(false);
        expect(isAllowedReturnUrl('https://evilhelloyotta.com/voltar')).toBe(false);
        expect(isAllowedReturnUrl('https://helloyotta.com.br/voltar')).toBe(false);
        expect(isAllowedReturnUrl('https://example.com')).toBe(false);
    });

    it('rejeita protocolo que não seja https (http, javascript:, etc - nunca abre um redirect perigoso)', () => {
        expect(isAllowedReturnUrl('http://helloyotta.com/voltar')).toBe(false);
        expect(isAllowedReturnUrl('javascript:alert(1)')).toBe(false);
        expect(isAllowedReturnUrl('ftp://helloyotta.com/voltar')).toBe(false);
    });

    it('rejeita URL ausente, vazia ou malformada sem lançar', () => {
        expect(isAllowedReturnUrl(null)).toBe(false);
        expect(isAllowedReturnUrl(undefined)).toBe(false);
        expect(isAllowedReturnUrl('')).toBe(false);
        expect(() => isAllowedReturnUrl('não é uma url')).not.toThrow();
        expect(isAllowedReturnUrl('não é uma url')).toBe(false);
        expect(isAllowedReturnUrl('/caminho/relativo')).toBe(false); // relativa não é absoluta
    });
});

describe('getAuthorId', () => {
    it('lê user_id/sub/id_usuario das claims do window.__AUTH_TOKEN__, nessa ordem de preferência', () => {
        window.__AUTH_TOKEN__ = fakeJwt({user_id: 'u1', sub: 's1', id_usuario: 'i1'});
        expect(getAuthorId()).toBe('u1');

        window.__AUTH_TOKEN__ = fakeJwt({sub: 's1', id_usuario: 'i1'});
        expect(getAuthorId()).toBe('s1');

        window.__AUTH_TOKEN__ = fakeJwt({id_usuario: 'i1'});
        expect(getAuthorId()).toBe('i1');
    });

    it('retorna null sem token, com token inválido, ou sem nenhuma das 3 claims', () => {
        delete window.__AUTH_TOKEN__;
        expect(getAuthorId()).toBeNull();

        window.__AUTH_TOKEN__ = 'token-corrompido';
        expect(getAuthorId()).toBeNull();

        window.__AUTH_TOKEN__ = fakeJwt({role: 'professor'});
        expect(getAuthorId()).toBeNull();
    });
});

describe('hintWhenLabel', () => {
    it('devolve o rótulo certo pra cada when.type conhecido', () => {
        expect(hintWhenLabel({type: 'scene_missing'})).toMatch(/cena/);
        expect(hintWhenLabel({type: 'character_missing'})).toMatch(/personagem/);
        expect(hintWhenLabel({type: 'mission_intro'})).toMatch(/primeira dica/);
        expect(hintWhenLabel({type: 'manual'})).toMatch(/escrita por você/);
    });

    it('cai no fallback genérico pra when.type desconhecido, ausente, ou when nulo', () => {
        expect(hintWhenLabel({type: 'tipo_futuro_desconhecido'})).toBe('💡 dica geral');
        expect(hintWhenLabel({})).toBe('💡 dica geral');
        expect(hintWhenLabel(null)).toBe('💡 dica geral');
    });
});
