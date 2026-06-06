/**
 * appEntry-web.js
 * 
 * Entrada para ScratchJr Web usando ES6 módulos nativos
 * Funciona em navegadores modernos SEM bundler (Vite, Webpack, etc)
 * 
 * Features:
 * - ES6 imports nativos do browser
 * - Expõe globalmente funções principais 
 * - Substitui Electron IPC por HTTP API
 * - Funciona em localhost
 */

// ===== SERVIÇOS =====
import WebInterface from './src/services/WebInterface.js';

// ===== UTILS =====
import { 
    preprocessAndLoadCss, 
    gn, 
    getUrlVars, 
    libInit 
} from './src/utils/lib.js';
import Localization from './src/utils/Localization.js';
import AppUsage from './src/utils/AppUsage.js';
import Sound from './src/utils/Sound.js';
import ScratchAudio from './src/utils/ScratchAudio.js';

// ===== PLATFORM INTERFACES =====
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';

// ===== ENTRY POINTS =====
import { indexMain } from './src/entry/index.js';
import { homeMain } from './src/entry/home.js';
import { editorMain } from './src/entry/editor.js';
import { gettingStartedMain } from './src/entry/gettingstarted.js';
import { 
    inappInterfaceGuide, 
    inappAbout, 
    inappBlocksGuide, 
    inappPaintEditorGuide 
} from './src/entry/inapp.js';

// ===== EXPORTAR GLOBALMENTE =====
// Serviços
window.WebInterface = WebInterface;
window.tabletInterface = new WebInterface();

// Utils
window.preprocessAndLoadCss = preprocessAndLoadCss;
window.libInit = libInit;
window.gn = gn;
window.getUrlVars = getUrlVars;
window.Localization = Localization;
window.AppUsage = AppUsage;
window.Sound = Sound;
window.ScratchAudio = ScratchAudio;

// Platform
window.iOS = iOS;
window.IO = IO;
window.MediaLib = MediaLib;

// Entry points
window.indexMain = indexMain;
window.homeMain = homeMain;
window.editorMain = editorMain;
window.gettingStartedMain = gettingStartedMain;
window.inappInterfaceGuide = inappInterfaceGuide;
window.inappAbout = inappAbout;
window.inappBlocksGuide = inappBlocksGuide;
window.inappPaintEditorGuide = inappPaintEditorGuide;

console.log('%c🎨 ScratchJr Web Edition (ES6 Modules)', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
console.log('✅ WebInterface: Carregado');
console.log('✅ Módulos ES6: Importados com sucesso');
console.log('✅ API, iOS, Localization: Prontos');

// ===== INICIALIZAÇÃO =====

function loadSettings(settingsRoot, whenDone) {
    if (window.IO && window.IO.requestFromServer) {
        window.IO.requestFromServer(settingsRoot + 'settings.json', (result) => {
            try {
                window.Settings = JSON.parse(result);
                whenDone();
            } catch (e) {
                console.warn('Erro ao parsear settings:', e);
                // Settings padrão já foi carregado por bootstrap
                whenDone();
            }
        });
    } else {
        whenDone();
    }
}

// App entry point
window.onload = () => {
    console.log('[AppEntry] Iniciando página: ' + window.scratchJrPage);
    libInit(); // Inicializar utilidades gerais
    loadPage(window.scratchJrPage);
};

function loadPage(page) {
    let entryFunction = () => {
        console.log('[AppEntry] Página setup completo mas sem entry function');
    };
    let root = './';

    switch (page) {
    default:
    case 'index':
        if (window.preprocessAndLoadCss) {
            window.preprocessAndLoadCss('css', 'css/font.css');
            window.preprocessAndLoadCss('css', 'css/base.css');
            window.preprocessAndLoadCss('css', 'css/start.css');
            window.preprocessAndLoadCss('css', 'css/thumbs.css');
        }
        entryFunction = () => {
            if (window.iOS && window.iOS.waitForInterface) {
                window.iOS.waitForInterface(window.indexMain || function() {});
            }
        };
        break;

    case 'home':
        if (window.preprocessAndLoadCss) {
            window.preprocessAndLoadCss('css', 'css/font.css');
            window.preprocessAndLoadCss('css', 'css/base.css');
            window.preprocessAndLoadCss('css', 'css/lobby.css');
            window.preprocessAndLoadCss('css', 'css/thumbs.css');
        }
        entryFunction = () => {
            if (window.iOS && window.iOS.waitForInterface) {
                window.iOS.waitForInterface(window.homeMain || function() {});
            }
        };
        break;

    case 'editor':
        if (window.preprocessAndLoadCss) {
            window.preprocessAndLoadCss('css', 'css/font.css');
            window.preprocessAndLoadCss('css', 'css/base.css');
            window.preprocessAndLoadCss('css', 'css/editor.css');
            window.preprocessAndLoadCss('css', 'css/editorleftpanel.css');
            window.preprocessAndLoadCss('css', 'css/editorstage.css');
            window.preprocessAndLoadCss('css', 'css/editormodal.css');
            window.preprocessAndLoadCss('css', 'css/librarymodal.css');
            window.preprocessAndLoadCss('css', 'css/paintlook.css');
        }
        entryFunction = () => {
            if (window.iOS && window.iOS.waitForInterface) {
                window.iOS.waitForInterface(window.editorMain || function() {});
            }
        };
        break;

    case 'gettingstarted':
        if (window.preprocessAndLoadCss) {
            window.preprocessAndLoadCss('css', 'css/font.css');
            window.preprocessAndLoadCss('css', 'css/base.css');
            window.preprocessAndLoadCss('css', 'css/gs.css');
        }
        entryFunction = () => {
            if (window.iOS && window.iOS.waitForInterface) {
                window.iOS.waitForInterface(window.gettingStartedMain || function() {});
            }
        };
        break;
    }

    // Sequência de inicialização
    loadSettings(root, () => {
        // Carregar localizações
        if (window.Localization && window.Localization.includeLocales) {
            window.Localization.includeLocales(root, () => {
                // Carregar Media Library
                if (window.MediaLib && window.MediaLib.loadMediaLib) {
                    window.MediaLib.loadMediaLib(root, () => {
                        entryFunction();
                    });
                } else {
                    entryFunction();
                }
            });
        } else {
            entryFunction();
        }

        // Inicializar AppUsage
        if (window.AppUsage && window.AppUsage.initUsage) {
            window.AppUsage.initUsage();
        }
    });
}
