/**
 * src/app/teacherEntry-vite.js
 *
 * Entry point da tela de turma do professor (teacher.html). Espelha o
 * playerEntry-vite.js: bootstrap leve (settings + MediaLib, sem
 * Localization/AppUsage), pra estar pronto caso o professor assuma o
 * controle do editor de um aluno (precisa de MediaLib pros sprites de
 * biblioteca resolverem corretamente).
 */

import WebInterface from './src/services/WebInterface.js';
import { preprocessAndLoadCss } from './src/utils/lib.js';
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';

import { teacherMain } from './src/entry/teacher.js';

window.preprocessAndLoadCss = preprocessAndLoadCss;
window.iOS = iOS;
window.IO = IO;
window.MediaLib = MediaLib;
window.teacherMain = teacherMain;

function processTeacherCss () {
    const needed = ['./css/font.css', './css/editorstage.css', './css/editor.css'];
    import('./src/utils/lib.js').then(({ preprocess, css_vh, css_vw, scaleMultiplier }) => {
        window.css_vh = css_vh;
        window.css_vw = css_vw;
        window.scaleMultiplier = scaleMultiplier;

        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            const href = link.getAttribute('href');
            if (!href || !href.endsWith('.css')) return;
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

if (window.scratchJrPage === 'teacher') {
    window.onload = async () => {
        await loadSettings();

        await new Promise(resolve => {
            try {
                MediaLib.loadMediaLib('./', resolve);
            } catch (_) {
                resolve();
            }
        });

        iOS.waitForInterface(teacherMain);
    };
}
