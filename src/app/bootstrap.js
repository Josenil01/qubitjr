/**
 * src/app/bootstrap.js
 * 
 * Bootstrap para ScratchJr Web
 * Carrega todas as dependências e inicializa a app
 */

// Criar aliases globais para compatibilidade
window.tabletInterface = window.tabletInterface || {};

// Simular a estrutura esperada pelo ScratchJr
window.Settings = window.Settings || {
  scale: 1.0,
  lang: 'en',
  volume: 0.8
};

// Utilidades simples
window.preprocessAndLoadCss = function(type, path) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = path;
  document.head.appendChild(link);
};

// Mock para IO/Localization se não carregados
window.IO = window.IO || {
  requestFromServer: function(url, callback) {
    // Detecta o tipo de arquivo pela extensão
    const isSVG = url.toLowerCase().endsWith('.svg');
    const isJSON = url.toLowerCase().endsWith('.json');
    const isText = isSVG || url.toLowerCase().endsWith('.txt') || url.toLowerCase().endsWith('.xml');
    
    fetch(url, { method: 'GET', timeout: 5000 })
      .then(r => {
        // Se é SVG/texto, usa .text(); se é JSON, usa .json()
        if (isText) {
          return r.text();
        } else if (isJSON) {
          return r.json().then(data => JSON.stringify(data));
        } else {
          // Default: tenta JSON, senão texto
          return r.text();
        }
      })
      .then(data => {
        // Validar que recebemos algo
        if (!data || typeof data !== 'string') {
          callback('');  // Callback com string vazia, deixa que o fallback seja usado
          return;
        }
        callback(data);
      })
      .catch(e => {
        callback('');  // Callback com string vazia para manter para o fallback
      });
  }
};

window.Localization = window.Localization || {
  includeLocales: function(root, callback) {
    setTimeout(callback, 100);
  },
  string: function(key) { 
    return key; 
  }
};

window.AppUsage = window.AppUsage || {
  initUsage: function() {
    // Inicializar uso do app
  }
};

window.MediaLib = window.MediaLib || {
  loadMediaLib: function(root, callback) {
    setTimeout(callback, 100);
  },
  getResource: function(name) {
    return null;
  }
};

// iOS mock
window.iOS = window.iOS || {
  waitForInterface: function(callback) {
    setTimeout(callback, 500);
  }
};

// Bootstrap pronto
export {};
