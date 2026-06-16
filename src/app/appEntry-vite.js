/**
 * src/app/appEntry-vite.js
 * 
 * Entry point para Vite
 * Pode usar ES6 imports normalmente!
 */

// Importar WebInterface para global scope
import WebInterface from './src/services/WebInterface.js';

// Importar os módulos do ScratchJr
import { preprocessAndLoadCss } from './src/utils/lib.js';
import Localization from './src/utils/Localization.js';
import AppUsage from './src/utils/AppUsage.js';
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';

import { indexMain } from './src/entry/index.js';
import { homeMain } from './src/entry/home.js';
import { editorMain } from './src/entry/editor.js';
import { gettingStartedMain } from './src/entry/gettingstarted.js';
import { inappInterfaceGuide, inappAbout, inappBlocksGuide, inappPaintEditorGuide } from './src/entry/inapp.js';
import PNGCache from './src/painteditor/PNGCache.js';

// Expor globalmente
window.preprocessAndLoadCss = preprocessAndLoadCss;
window.Localization = Localization;
window.AppUsage = AppUsage;
window.iOS = iOS;
window.IO = IO;
window.MediaLib = MediaLib;
window.PNGCache = PNGCache;
console.log('[AppEntry] ✅ PNGCache exposto globalmente:', !!window.PNGCache);

// Resolve quando todo o CSS tiver sido processado (ou após timeout de 3 s)
let _cssReadyResolve;
const cssReady = new Promise(resolve => { _cssReadyResolve = resolve; });

// Processar CSS carregado via <link> para substituir template literals
function processAllCss() {
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  
  // Importar preprocess do lib.js aqui dentro da função
  import('./src/utils/lib.js').then(({ preprocess, css_vh, css_vw, scaleMultiplier }) => {
    // Expor funções globalmente para que eval() as encontre
    window.css_vh = css_vh;
    window.css_vw = css_vw;
    window.scaleMultiplier = scaleMultiplier;
    
    const validLinks = styleLinks.filter(link => {
      const href = link.getAttribute('href');
      return href && href.endsWith('.css');
    });

    if (validLinks.length === 0) {
      _cssReadyResolve();
      return;
    }

    let pending = validLinks.length;
    const done = () => { if (--pending === 0) _cssReadyResolve(); };

    validLinks.forEach((link) => {
      const href = link.getAttribute('href');
      fetch(href)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(cssText => {
          try {
            const processedCss = preprocess(cssText);
            const style = document.createElement('style');
            style.setAttribute('data-processed-css', href);
            style.setAttribute('id', `style-${href.replace(/[^a-z0-9]/gi, '_')}`);
            style.textContent = processedCss;
            document.head.appendChild(style);
            link.remove();
          } catch (err) {
            console.error(`Erro ao processar CSS ${href}:`, err);
          }
          done();
        })
        .catch(err => {
          console.error(`Erro ao carregar CSS ${href}:`, err);
          done();
        });
    });
  }).catch(err => {
    console.error('Erro ao carregar preprocess:', err);
    _cssReadyResolve(); // nunca bloquear a inicialização em caso de erro
  });

  // Fallback: resolve após 3 s independente do resultado
  setTimeout(_cssReadyResolve, 3000);
}

// Executar processamento de CSS quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processAllCss);
} else {
  // Se o DOM já está pronto, chamar após um pequeno delay
  setTimeout(processAllCss, 100);
}

// Recalcular CSS quando a janela muda de tamanho ou zoom (Ctrl+/-)
let _resizeTimer = null;
window.addEventListener('resize', function () {
  if (_resizeTimer) clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(function () {
    if (window.recalculateCSSValues) {
      window.recalculateCSSValues();
    }
    if (typeof window._onLayoutResize === 'function') {
      try { window._onLayoutResize(); } catch (e) { /* best-effort */ }
    }
  }, 150);
});

// Função para recalcular valores CSS dinâmicos (css_vh, css_vw)
// Útil quando o layout muda (ex: fullscreen para normal)
window.recalculateCSSValues = function() {
  import('./src/utils/lib.js').then(({ preprocess, css_vh, css_vw, scaleMultiplier }) => {
    // Expor funções globalmente para que eval() as encontre
    window.css_vh = css_vh;
    window.css_vw = css_vw;
    window.scaleMultiplier = scaleMultiplier;
    
    // Reprocessar todos os styles que foram marcados como data-processed-css
    const styles = document.querySelectorAll('style[data-processed-css]');
    styles.forEach((style) => {
      const href = style.getAttribute('data-processed-css');
      
      // Recarregar o arquivo CSS original
      fetch(href)
        .then(response => response.text())
        .then(cssText => {
          // Reprocessar com novos valores de viewport
          const processedCss = preprocess(cssText);
          style.textContent = processedCss;
        })
        .catch(err => console.error(`Erro ao recalcular CSS ${href}:`, err));
    });
  }).catch(err => {
    console.error('Erro ao carregar lib.js para recalculateCSSValues:', err);
  });
};

window.MediaLib = MediaLib;

window.indexMain = indexMain;
window.homeMain = homeMain;
window.editorMain = editorMain;
window.gettingStartedMain = gettingStartedMain;
window.inappInterfaceGuide = inappInterfaceGuide;
window.inappAbout = inappAbout;
window.inappBlocksGuide = inappBlocksGuide;
window.inappPaintEditorGuide = inappPaintEditorGuide;
// Router simples para navegar entre páginas
// Propaga o token de auth na URL para que cada página o receba mesmo sem sessionStorage
function _getAuthTokenForNav() {
  try { return window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || null; }
  catch (_) { return window.__AUTH_TOKEN__ || null; }
}

window.ScratchJrRouter = {
  navigateTo: function(page) {
    const pages = {
      'index': '/index.html',
      'home': '/home.html',
      'lobby': '/home.html',
      'splash': '/index.html',
      'editor': '/editor.html',
      'gettingstarted': '/gettingstarted.html',
      'starting': '/gettingstarted.html'
    };
    const base = pages[page] || '/index.html';
    const token = _getAuthTokenForNav();
    window.location.href = token ? base + '?token=' + encodeURIComponent(token) : base;
  }
};

// Log
// Módulos carregados

// Versão em Promise de loadSettings
async function loadSettings(settingsRoot) {
  return new Promise((resolve, reject) => {
    try {
      IO.requestFromServer(settingsRoot + 'settings.json', (result) => {
        try {
          if (result) {
            window.Settings = JSON.parse(result);
          } else {
            window.Settings = window.Settings || {};
          }
          resolve();
        } catch (e) {
          window.Settings = window.Settings || {};
          resolve(); // Continua mesmo com erro
        }
      });
    } catch (error) {
      window.Settings = window.Settings || {};
      resolve(); // Continua mesmo com erro
    }
  });
}

// App entry point
window.onload = async () => {
  console.log('[AppEntry] Iniciando:', window.scratchJrPage);
  await loadPage(window.scratchJrPage);
};

async function loadPage(page) {
  let entryFunction = () => {};
  let root = './';

  switch (page) {
  default:
  case 'index':
    // CSS carregado direto no HTML com <link>
    entryFunction = () => iOS.waitForInterface(indexMain);
    break;
  case 'home':
    entryFunction = () => iOS.waitForInterface(homeMain);
    break;
  case 'editor':
    entryFunction = () => iOS.waitForInterface(editorMain);
    break;
  case 'gettingstarted':
    entryFunction = () => iOS.waitForInterface(gettingStartedMain);
    break;
  }

  // Carregar em sequência com Promises
  try {
    console.log('[AppEntry] 1️⃣ Carregando settings...');
    await loadSettings(root);
    console.log('[AppEntry] 2️⃣ Settings carregado, carregando localizações...');
    
    if (window.Localization && window.Localization.includeLocales) {
      await new Promise((resolve) => {
        console.log('[AppEntry] 3️⃣ Incluindo locales...');
        window.Localization.includeLocales(root, () => {
          console.log('[AppEntry] 4️⃣ Locales carregadas!');
          resolve();
        });
      });
    }
    
    console.log('[AppEntry] 5️⃣ Carregando MediaLib...');
    if (window.MediaLib && window.MediaLib.loadMediaLib) {
      await new Promise((resolve) => {
        window.MediaLib.loadMediaLib(root, () => {
          console.log('[AppEntry] 6️⃣ MediaLib carregada!');
          resolve();
        });
      });
    }
    
    // Pré-carregar PNGs para watermarks
    console.log('[AppEntry] 6️⃣ ½ Pré-carregando PNGs para watermarks...');
    console.log('[AppEntry] DEBUG: window.MediaLib =', !!window.MediaLib, 'window.MediaLib.sprites =', !!(window.MediaLib && window.MediaLib.sprites), 'window.PNGCache =', !!window.PNGCache);
    if (window.MediaLib && window.MediaLib.sprites && window.PNGCache) {
      // Pré-carregar usando md5 (nome do arquivo) e criar alias pelo name (nome exibido)
      const spriteItems = window.MediaLib.sprites.filter(item => item.md5);
      const spriteFileNames = spriteItems
        .map(item => item.md5.replace(/\.[^.]+$/, ''))
        .filter(name => name);
      const spriteNames = spriteItems.map(item => item.name).filter(name => name);
      
      console.log('[AppEntry] Sprites para pré-carregar:', spriteFileNames.length);
      if (spriteFileNames.length > 0) {
        await window.PNGCache.preload(spriteFileNames);
        // Criar aliases: cache[name] = cache[md5fileName] para que getWatermark(this.name) funcione
        spriteItems.forEach(item => {
          const fileKey = item.md5.replace(/\.[^.]+$/, '');
          if (item.name && item.name !== fileKey && window.PNGCache.cache[fileKey]) {
            window.PNGCache.cache[item.name] = window.PNGCache.cache[fileKey];
          }
        });
        console.log('[AppEntry] ✅ PNGs pré-carregadas:', Object.keys(window.PNGCache.cache || {}).length);
      }
    } else {
      console.warn('[AppEntry] ⚠️ Não foi possível pré-carregar PNGs - MediaLib.sprites ou PNGCache indisponíveis');
    }
    
    console.log('[AppEntry] 7️⃣ Inicializando AppUsage...');
    // Inicializar AppUsage ANTES de entryFunction
    if (window.AppUsage && window.AppUsage.initUsage) {
      window.AppUsage.initUsage();
    }
    
    // Para a página home, aguarda o CSS ser processado antes de renderizar
    // para evitar que o topsection apareça com alturas css_vh() em 0px.
    if (page === 'home') {
      await cssReady;
    }

    console.log('[AppEntry] 8️⃣ Chamando entryFunction para ' + page);
    // Executar função de entrada
    if (entryFunction) {
      entryFunction();
      console.log('[AppEntry] ✅ EntryFunction executada!');
    } else {
      console.error('[AppEntry] ❌ EntryFunction não definida para página:', page);
    }
  } catch (error) {
    console.error('[AppEntry] Erro ao carregar página:', error, error.stack);
  }
}
