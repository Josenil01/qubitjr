'use strict';

/**
 * activityAssetLibrary.js
 *
 * Lista de personagens/cenários que a geração de atividade por tema (ver
 * activityGeneration.js) pode usar. Fonte: as chaves BACKGROUND_ e CHARACTER_
 * de src/app/localizations/pt.json - mesmo arquivo que hintsGeneration.js já
 * lê pra rotular fundos pro aluno (ver loadBackgroundDisplayNames lá) e a
 * mesma fonte que o editor real usa pra popular a Library.js. Deliberadamente
 * NÃO varremos src/app/svglibrary/pnglibrary/media.json diretamente - ver
 * memória do projeto sobre as armadilhas de duplicação/pareamento desses
 * arquivos; toda entrada com um rótulo em pt.json já é, por construção, um
 * asset real e selecionável no editor.
 *
 * Isolado de hintsGeneration.js de propósito (nenhuma duplicação de código
 * compartilhada, só o mesmo padrão de leitura) - aquele arquivo só precisa de
 * fundos; este precisa de fundos E personagens, com a lista completa (não só
 * os md5 usados por um projeto específico).
 */

const fs = require('fs');
const path = require('path');

// backend/src/services/ -> raiz do repo -> src/app/localizations/pt.json.
const PT_LOCALIZATION_PATH = path.join(__dirname, '../../../src/app/localizations/pt.json');
// Só pra ler o "scale" de cada personagem (ver getCharacterScale) - a LISTA de
// personagens continua vindo de pt.json, ver docblock acima.
const MEDIA_JSON_PATH = path.join(__dirname, '../../../src/app/media.json');

// Mesmo default de Library.js (`!data.scale ? 0.5 : data.scale`) pra
// personagem sem "scale" no media.json ou se o arquivo não puder ser lido.
const DEFAULT_CHARACTER_SCALE = 0.5;

let _scaleByMd5 = null;

let _library = null;

function loadLibrary() {
    if (_library) return _library;

    const backgrounds = [];
    const characters = [];

    try {
        const raw = fs.readFileSync(PT_LOCALIZATION_PATH, 'utf8');
        const strings = JSON.parse(raw);
        for (const key of Object.keys(strings)) {
            if (key.startsWith('BACKGROUND_')) {
                backgrounds.push({ md5: key.slice('BACKGROUND_'.length), displayName: strings[key] });
            } else if (key.startsWith('CHARACTER_')) {
                characters.push({ md5: key.slice('CHARACTER_'.length), displayName: strings[key] });
            }
        }
    } catch (err) {
        console.warn('[activityAssetLibrary] Falha ao carregar', PT_LOCALIZATION_PATH, '- biblioteca de assets ficará vazia:', err.message);
    }

    _library = {
        backgrounds,
        characters,
        backgroundMd5s: new Set(backgrounds.map((b) => b.md5)),
        characterMd5s: new Set(characters.map((c) => c.md5)),
    };
    return _library;
}

/**
 * Escala inicial de um personagem, lida do campo "scale" do media.json - a
 * mesma que o editor usa ao adicioná-lo pela galeria (Library.js), pra
 * personagens gerados por IA nascerem no mesmo tamanho dos escolhidos à mão.
 */
function getCharacterScale(md5) {
    if (!_scaleByMd5) {
        _scaleByMd5 = new Map();
        try {
            const media = JSON.parse(fs.readFileSync(MEDIA_JSON_PATH, 'utf8'));
            for (const spr of Array.isArray(media.sprites) ? media.sprites : []) {
                const scale = Number(spr.scale);
                if (spr.md5 && scale > 0) _scaleByMd5.set(spr.md5, scale);
            }
        } catch (err) {
            console.warn('[activityAssetLibrary] Falha ao carregar', MEDIA_JSON_PATH, '- escalas usarão o default', DEFAULT_CHARACTER_SCALE + ':', err.message);
        }
    }
    return _scaleByMd5.get(md5) || DEFAULT_CHARACTER_SCALE;
}

module.exports = { loadLibrary, getCharacterScale };
