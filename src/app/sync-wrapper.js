/**
 * sync-wrapper.js
 * 
 * Adapta WebInterface (async/Promise) para o padrão síncrono esperado por iOS.js
 * iOS.js espera que métodos retornem valores diretos ou usem callbacks
 * WebInterface usa async/await e Promises
 * 
 * Este wrapper converte entre os dois padrões
 */

// Cache para armazenar resultados de operações async
const asyncCache = {};
const asyncCallbacks = {};

export function setupAsyncWrapper() {
  if (!window.tabletInterface) {
    console.error('[SyncWrapper] WebInterface não está disponível');
    return;
  }

  const originalInterface = window.tabletInterface;
  
  // Wrapper para gettextresource que usa callback
  const origGetText = originalInterface.io_gettextresource.bind(originalInterface);
  originalInterface.io_gettextresource = function(filename, fcnOptional) {
    // Se chamado com callback (iOS.js style)
    if (typeof fcnOptional === 'function') {
      origGetText(filename).then(result => {
        fcnOptional(result);
      }).catch(error => {
        console.error('[SyncWrapper] gettextresource error:', error);
        fcnOptional(null);
      });
      return null; // Não tem valor síncrono
    }
    
    // Se chamado sem callback, retorna um "placeholder" 
    // iOS.js vai chamar com callback
    return '';
  };

  // Wrapper para getfile
  const origGetFile = originalInterface.io_getfile.bind(originalInterface);
  originalInterface.io_getfile = function(filename, fcnOptional) {
    if (typeof fcnOptional === 'function') {
      origGetFile(filename).then(result => {
        fcnOptional(result);
      }).catch(error => {
        console.error('[SyncWrapper] getfile error:', error);
        fcnOptional(null);
      });
      return null;
    }
    return '';
  };

  // Wrapper para setfile
  const origSetFile = originalInterface.io_setfile.bind(originalInterface);
  originalInterface.io_setfile = function(name, data, fcnOptional) {
    if (typeof fcnOptional === 'function') {
      origSetFile(name, data).then(result => {
        fcnOptional(result);
      }).catch(error => {
        console.error('[SyncWrapper] setfile error:', error);
        fcnOptional(null);
      });
      return null;
    }
    return '';
  };

  // Wrapper para database_stmt  
  const origStmt = originalInterface.database_stmt.bind(originalInterface);
  originalInterface.database_stmt = function(json, fcnOptional) {
    if (typeof fcnOptional === 'function') {
      origStmt(json).then(result => {
        fcnOptional(result);
      }).catch(error => {
        console.error('[SyncWrapper] database_stmt error:', error);
        fcnOptional(null);
      });
      return '{}';
    }
    return '{}';
  };

  // Wrapper para database_query
  const origQuery = originalInterface.database_query.bind(originalInterface);
  originalInterface.database_query = function(json, fcnOptional) {
    if (typeof fcnOptional === 'function') {
      origQuery(json).then(result => {
        fcnOptional(result);
      }).catch(error => {
        console.error('[SyncWrapper] database_query error:', error);
        fcnOptional(null);
      });
      return '[]';
    }
    return '[]';
  };

  console.log('[SyncWrapper] ✅ Async wrapper instalado para WebInterface');
}
