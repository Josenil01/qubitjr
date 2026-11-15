import {afterEach, describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';

const {requestFromServer} = vi.hoisted(() => ({requestFromServer: vi.fn()}));
vi.mock('./IO.js', () => ({default: {requestFromServer}}));
vi.mock('../utils/Cookie.js', () => ({default: {get: () => 'pt-BR'}}));

import MediaLib from './MediaLib.js';
import Localization from '../utils/Localization.js';

const catalog = JSON.parse(readFileSync(new URL('../../public/media.json', import.meta.url), 'utf8'));
const portuguese = JSON.parse(readFileSync(new URL('../../localizations/pt.json', import.meta.url), 'utf8'));

async function loadLibrary(messages) {
    const fetchMock = vi.fn().mockResolvedValue({ok: true, json: async () => messages});
    vi.stubGlobal('fetch', fetchMock);
    await new Promise(resolve => Localization.includeLocales('/', resolve));
    requestFromServer.mockImplementation((url, done) => done(JSON.stringify(catalog)));
    await new Promise(resolve => MediaLib.loadMediaLib('/', resolve));
    return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('library display names', () => {
    it('preserves catalog names when a cached or incomplete locale lacks new entries', async () => {
        await loadLibrary({});
        expect(MediaLib.backgrounds.map(s => s.name)).toEqual(catalog.backgrounds.map(s => s.name));
        expect(MediaLib.sprites.map(s => s.name)).toEqual(catalog.sprites.map(s => s.name));
        expect(MediaLib.keys['HY-Cenario-IlhaPirata.svg'].name).toBe('Ilha dos piratas');
    });

    it('loads the Portuguese names of all ten new scenes and revalidates the locale cache', async () => {
        const fetchMock = await loadLibrary(portuguese);
        expect(fetchMock).toHaveBeenCalledWith('/localizations/pt.json', {cache: 'no-cache'});
        const scenes = MediaLib.backgrounds.filter(s => s.md5.startsWith('HY-Cenario-'));
        expect(scenes).toHaveLength(10);
        for (const scene of scenes) {
            expect(scene.name).toBe(portuguese['BACKGROUND_' + scene.md5]);
            expect(scene.name).not.toContain('BACKGROUND_');
        }
    });
});
