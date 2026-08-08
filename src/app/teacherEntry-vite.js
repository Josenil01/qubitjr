/**
 * src/app/teacherEntry-vite.js
 *
 * Entry point da tela de turma do professor (teacher.html). O lobby em si é
 * leve, mas "assumir controle" monta a UI de edição completa (não só o
 * palco, como no player.html) — por isso a sequência de boot espelha a do
 * appEntry-vite.js completo (settings → locales → MediaLib → watermarks →
 * AppUsage), ao contrário do playerEntry-vite.js (mais enxuto de propósito,
 * o player nunca edita).
 */

import WebInterface from './src/services/WebInterface.js';
import { preprocessAndLoadCss } from './src/utils/lib.js';
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';
import Localization from './src/utils/Localization.js';
import AppUsage from './src/utils/AppUsage.js';
import PNGCache from './src/painteditor/PNGCache.js';

import { teacherMain } from './src/entry/teacher.js';

window.preprocessAndLoadCss = preprocessAndLoadCss;
window.iOS = iOS;
window.IO = IO;
window.MediaLib = MediaLib;
window.Localization = Localization;
window.AppUsage = AppUsage;
window.PNGCache = PNGCache;
window.teacherMain = teacherMain;

function processTeacherCss () {
    // Igual ao editor.html completo — "assumir controle" precisa da UI de
    // edição inteira, não só do palco (diferente do player.html, que só exibe).
    //
    // Antes isto filtrava por nome de arquivo de origem (ex.: 'editor.css',
    // 'gs.css') contra um allowlist "needed". Em produção o Vite funde os 11
    // CSS de origem em só ~2 arquivos com hash (ex.: gs-Cks85t-d.css) —
    // href.endsWith('gs.css') nunca bate contra isso (o hash fica entre o
    // nome e a extensão), então TODOS os <link> eram removidos e a tela de
    // "assumir controle" renderizava sem nenhum CSS. teacher.html só
    // referencia os 11 CSS que já precisa, então não há nada "desnecessário"
    // a filtrar mesmo — processa tudo, igual ao processAllCss() do
    // appEntry-vite.js.
    import('./src/utils/lib.js').then(({ preprocess, css_vh, css_vw, scaleMultiplier }) => {
        window.css_vh = css_vh;
        window.css_vw = css_vw;
        window.scaleMultiplier = scaleMultiplier;

        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (!href || !href.endsWith('.css')) return;
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

if (window.scratchJrPage === 'teacher') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processTeacherCss);
    } else {
        setTimeout(processTeacherCss, 0);
    }
}

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

// Pré-carrega os PNGs de watermark dos sprites de biblioteca — sem isso,
// sprites de biblioteca ficam sem a marca d'água correta no editor de
// verdade. Mesma lógica de appEntry-vite.js, resumida.
async function preloadWatermarks () {
    if (!(MediaLib.sprites && PNGCache)) return;
    const spriteItems = MediaLib.sprites.filter(item => item.md5);
    const spriteFileNames = spriteItems.map(item => item.md5.replace(/\.[^.]+$/, '')).filter(Boolean);
    if (spriteFileNames.length === 0) return;
    try {
        await PNGCache.preload(spriteFileNames);
        spriteItems.forEach(item => {
            const fileKey = item.md5.replace(/\.[^.]+$/, '');
            if (item.name && item.name !== fileKey && PNGCache.cache[fileKey]) {
                PNGCache.cache[item.name] = PNGCache.cache[fileKey];
            }
        });
    } catch (_) { /* watermark não é crítico pro editor funcionar */ }
}

if (window.scratchJrPage === 'teacher') {
    window.onload = async () => {
        await loadSettings();

        await new Promise(resolve => {
            try {
                Localization.includeLocales('./', resolve);
            } catch (_) {
                resolve();
            }
        });

        await new Promise(resolve => {
            try {
                MediaLib.loadMediaLib('./', resolve);
            } catch (_) {
                resolve();
            }
        });

        await preloadWatermarks();

        if (AppUsage.initUsage) AppUsage.initUsage();

        iOS.waitForInterface(teacherMain);
    };
}
