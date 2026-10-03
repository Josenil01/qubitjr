// @vitest-environment jsdom
import {describe, expect, it} from 'vitest';
import {decodeJwtPayloadUnsafe} from './jwtUnsafe.js';

/** header.payload.signature com um payload JSON arbitrário, base64url (sem padding, +/- no lugar de +//), igual a um JWT real. */
function fakeJwt (payload) {
    const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64url({alg: 'none'})}.${b64url(payload)}.sig`;
}

describe('decodeJwtPayloadUnsafe', () => {
    it('decodifica o payload de um JWT real (base64url, sem padding)', () => {
        const token = fakeJwt({sub: 'teacher-42', role: 'professor', nivel: '2'});
        expect(decodeJwtPayloadUnsafe(token)).toEqual({sub: 'teacher-42', role: 'professor', nivel: '2'});
    });

    it('decodifica corretamente caracteres não-ASCII no payload (UTF-8)', () => {
        const token = fakeJwt({name: 'José Niléze'});
        expect(decodeJwtPayloadUnsafe(token)).toEqual({name: 'José Niléze'});
    });

    it('troca - e _ (base64url) por + e / (base64 padrão) antes de decodificar', () => {
        // {v: '😃😄'} é o payload mais simples achado que produz tanto '+'
        // quanto '/' no base64 PADRÃO do JSON - fakeJwt() já troca os dois
        // por '-'/'_' na hora de codificar (igual um JWT real faria), então
        // isto garante que decodeJwtPayloadUnsafe de fato troca de volta,
        // não só funciona por acaso com payloads que nunca precisam disso.
        const token = fakeJwt({v: '😃😄'});
        expect(token).toContain('-');
        expect(token).toContain('_');
        expect(decodeJwtPayloadUnsafe(token)).toEqual({v: '😃😄'});
    });

    it('retorna null pra token vazio, não-string, ou sem 2 partes separadas por ponto', () => {
        expect(decodeJwtPayloadUnsafe('')).toBeNull();
        expect(decodeJwtPayloadUnsafe(null)).toBeNull();
        expect(decodeJwtPayloadUnsafe(undefined)).toBeNull();
        expect(decodeJwtPayloadUnsafe(42)).toBeNull();
        expect(decodeJwtPayloadUnsafe('semponto')).toBeNull();
    });

    it('retorna null (nunca lança) pra um payload que não decodifica em JSON válido', () => {
        expect(decodeJwtPayloadUnsafe('eyJhbGciOiJub25lIn0.not-valid-base64url-json.sig')).toBeNull();
        expect(() => decodeJwtPayloadUnsafe('a.b.c')).not.toThrow();
    });
});
