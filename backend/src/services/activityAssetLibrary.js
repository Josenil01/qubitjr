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

module.exports = { loadLibrary };
