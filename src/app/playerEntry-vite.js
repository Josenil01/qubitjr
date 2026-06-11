/**
 * src/app/playerEntry-vite.js
 *
 * Entry point LEVE para a página de visualização pública.
 * Diferenças em relação ao appEntry-vite.js completo:
 *   - NÃO pré-carrega PNGCache (maior economia de tempo/rede)
 *   - NÃO carrega MediaLib.loadMediaLib (arquivo JSON grande)
 *   - NÃO carrega Localization (arquivos de idioma)
 *   - NÃO inicializa AppUsage (analytics)
 *   - Expõe apenas playerMain
 */

import WebInterface from './src/services/WebInterface.js';
import { preprocessAndLoadCss } from './src/utils/lib.js';
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';

import { playerMain } from './src/entry/player.js';

// Expor globalmente o mínimo necessário
window.preprocessAndLoadCss = preprocessAndLoadCss;
window.iOS = iOS;
window.IO = IO;
window.MediaLib = MediaLib;
window.playerMain = playerMain;

// ── CSS: processa apenas os arquivos necessários para o stage ──────────────
function processPlayerCss () {
    const needed = ['./css/font.css', './css/editorstage.css', './css/editor.css'];
    import('./src/utils/lib.js').then(({ preprocess, css_vh, css_vw, scaleMultiplier }) => {
        window.css_vh = css_vh;
        window.css_vw = css_vw;
        window.scaleMultiplier = scaleMultiplier;

        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (!href || !href.endsWith('.css')) return;

            // Processar somente os CSS essenciais; remover os demais imediatamente
            if (!needed.some(n => href.endsWith(n.replace('./', '')))) {
                link.remove();
                return;
            }

            fetch(href)
                .then(r => r.ok ? r.text() : '')
                .then(cssText => {
                    if (!cssText) return;
                    const style = document.createElement('style');
                    style.setAttribute('data-processed-css', href);
                    style.textContent = preprocess(cssText);
                    document.head.appendChild(style);
                    link.remove();
                })
                .catch(() => {});
        });
    }).catch(() => {});
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPlayerCss);
} else {
    setTimeout(processPlayerCss, 0);
}

// ── Settings ──────────────────────────────────────────────────────────────
async function loadSettings () {
    return new Promise(resolve => {
        try {
            IO.requestFromServer('./settings.json', result => {
                try {
                    window.Settings = result ? JSON.parse(result) : {};
                } catch (_) {
                    window.Settings = {};
                }
                resolve();
            });
        } catch (_) {
            window.Settings = {};
            resolve();
        }
    });
}

// ── Inicialização mínima ───────────────────────────────────────────────────
window.onload = async () => {
    await loadSettings();

    // Carregar MediaLib para popular MediaLib.keys — necessário para sprites de
    // biblioteca (Ruby, Boy, etc.) resolverem via IO.requestFromServer em vez de
    // ios.getmedia (localStorage). Sem isso, sprites de biblioteca ficam em branco.
    await new Promise(resolve => {
        try {
            MediaLib.loadMediaLib('./', resolve);
        } catch (_) {
            resolve();
        }
    });

    // Aguarda tabletInterface (WebInterface) estar pronto
    iOS.waitForInterface(playerMain);
};
