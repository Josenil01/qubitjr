/**
 * src/app/src/services/WebInterface.js
 * 
 * Substitui ElectronDesktopInterface para ambiente web
 * Faz chamadas HTTP para o backend Express
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

class WebInterface {
  constructor() {
    this.isDebug = true;
    this.currentAudio = {};
    this.offlineMode = false;
    this.mediaReadCache = {};
    
    console.log('[WebInterface] Inicializado com API:', API_BASE_URL);
    
    // Testar conexão com backend
    this.testConnection();
  }

  /**
   * Retorna objeto de headers com Authorization, se houver token disponível.
   * Modo mock: usa VITE_MOCK_TOKEN (injetado em build pelo Vite).
   * Modo produção: usa window.__AUTH_TOKEN__ injetado pela plataforma externa.
   */
  _authHeader() {
    const token = window.__AUTH_TOKEN__ || (import.meta?.env?.VITE_MOCK_TOKEN) || null;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async testConnection() {
    try {
      const healthUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000/health'
        : '/api/health';
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('✅ Conectado ao backend em', healthUrl);
        this.offlineMode = false;
        return;
      }
    } catch (err) {
      // Tentar com 127.0.0.1 como fallback (apenas local)
      if (window.location.hostname === 'localhost') {
        try {
          const response = await fetch('http://127.0.0.1:5000/health');
          if (response.ok) {
            this.offlineMode = false;
            return;
          }
        } catch (err2) { /* ignore */ }
      }
      console.warn('⚠️ Backend não respondendo, ativando modo offline');
      this.offlineMode = true;
    }
  }

  // ============================================
  // Database Operations (substituem ipcRenderer)
  // ============================================

  async database_query(query) {
    try {
      // query já vem stringificado de iOS.query(), precisa fazer parse
      let queryObj = typeof query === 'string' ? JSON.parse(query) : query;
      
      // Converter 'stmt' para 'sql' se necessário (compatibilidade com formato iOS)
      if (queryObj.stmt && !queryObj.sql) {
        queryObj.sql = queryObj.stmt;
        delete queryObj.stmt;
      }
      
      console.log('[WebInterface] Enviando query:', JSON.stringify(queryObj).substring(0, 200));
      
      const response = await fetch(`${API_BASE_URL}/db/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(),
        },
        body: JSON.stringify(queryObj)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[WebInterface] Backend error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('[WebInterface] database_query error:', error);
      if (this.offlineMode) {
        return [];
      }
      throw error;
    }
  }

  async database_stmt(statement) {
    try {
      // statement já vem stringificado de iOS.stmt(), precisa fazer parse
      let stmtObj = typeof statement === 'string' ? JSON.parse(statement) : statement;
      
      // Converter 'stmt' para 'sql' se necessário (compatibilidade com formato iOS)
      if (stmtObj.stmt && !stmtObj.sql) {
        stmtObj.sql = stmtObj.stmt;
        delete stmtObj.stmt;
      }
      
      const response = await fetch(`${API_BASE_URL}/db/stmt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this._authHeader(),
        },
        body: JSON.stringify(stmtObj)
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        console.error('[WebInterface] Backend error response:', body);
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        changes: result.changes,
        lastID: result.lastID,
        data: result.data
      };
    } catch (error) {
      console.error('[WebInterface] database_stmt error:', error);
      if (this.offlineMode) {
        return { success: false, changes: 0 };
      }
      throw error;
    }
  }

  // ============================================
  // Settings
  // ============================================

  io_getsettings() {
    try {
      // Retornar string no formato esperado pelo app: "path,flag"
      // path: caminho de armazenamento dos projetos
      // flag: 0 = com barra, 1 = sem barra
      const path = localStorage.getItem('scratchjr_path') || './data';
      const flag = localStorage.getItem('scratchjr_pathflag') || '0';
      return `${path},${flag}`;
    } catch (error) {
      console.error('[WebInterface] io_getsettings error:', error);
      return './data,0'; // Default
    }
  }

  io_setsettings(settings) {
    try {
      localStorage.setItem('scratchjr_settings', JSON.stringify(settings));
      return { success: true };
    } catch (error) {
      console.error('[WebInterface] io_setsettings error:', error);
      return { success: false };
    }
  }

  // ============================================
  // File I/O Operations
  // ============================================

  io_setfile(name, content, fcn) {
    try {
      // O content já vem em base64 de iOS.setfile
      // Armazenar em localStorage com prefixo
      const key = `scratchjr_file_${name}`;
      localStorage.setItem(key, content);
      
      // Chamar callback sincronamente (sem async)
      if (fcn) {
        fcn(true);
      }
      return true;
    } catch (error) {
      console.error('[WebInterface] io_setfile error:', error);
      if (fcn) {
        fcn(false);
      }
      return false;
    }
  }

  io_getfile(filename) {
    try {
      // Recuperar arquivo de localStorage de forma síncrona
      const key = `scratchjr_file_${filename}`;
      const content = localStorage.getItem(key);
      
      // Retornar conteúdo ou string vazia (não null, pois atob vai quebrar)
      return content || '';
    } catch (error) {
      console.error('[WebInterface] io_getfile error:', error);
      return '';
    }
  }

  // ============================================
  // Media Operations
  // ============================================

  async io_getmedia(filename) {
    try {
      const localData = localStorage.getItem(this._mediaKey(filename));
      if (localData) {
        return this._base64ToBlob(localData, this._mimeFromFilename(filename));
      }

      const metaResp = await fetch(`${API_BASE_URL}/media/${filename}`, {
        headers: { ...this._authHeader() }
      });
      if (!metaResp.ok) {
        throw new Error(`Failed to get media metadata: ${filename}`);
      }
      const meta = await metaResp.json();
      if (!meta || !meta.url) {
        throw new Error(`Media URL not found for: ${filename}`);
      }

      const fileResp = await fetch(meta.url);
      if (!fileResp.ok) {
        throw new Error(`Failed to download media file: ${filename}`);
      }
      return await fileResp.blob();
    } catch (error) {
      console.error('[WebInterface] io_getmedia error:', error);
      throw error;
    }
  }

  io_setmedia(dataOrBase64, ext, fcn) {
    try {
      // Compatibilidade:
      // 1) io_setmedia({ filename, content })
      // 2) io_setmedia(base64, ext, callback)
      let filename;
      let content;

      if (typeof dataOrBase64 === 'object' && dataOrBase64 !== null) {
        filename = dataOrBase64.filename;
        content = dataOrBase64.content;
      } else {
        const base64 = dataOrBase64 || '';
        const safeExt = (ext || 'dat').toLowerCase();
        const md5 = this.io_getmd5(base64);
        filename = `${md5}.${safeExt}`;
        content = base64;
      }

      if (!filename || !content) {
        if (fcn) fcn(null);
        return null;
      }

      // Armazenamento local (sincrono), necessario para o fluxo legado de chunks.
      localStorage.setItem(this._mediaKey(filename), content);

      // Melhor esforco: sincronizar com backend quando disponivel.
      fetch(`${API_BASE_URL}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._authHeader() },
        body: JSON.stringify({
          filename,
          data: content
        })
      }).catch((err) => {
        console.warn('[WebInterface] io_setmedia backend sync warning:', err?.message || err);
      });

      if (fcn) fcn(filename);
      return filename;
    } catch (error) {
      console.error('[WebInterface] io_setmedia error:', error);
      if (fcn) fcn(null);
      return null;
    }
  }

  // ============================================
  // Audio
  // ============================================

  async io_getAudioData(audioName) {
    try {
      const blob = await this.io_getmedia(audioName);
      return blob;
    } catch (error) {
      console.error('[WebInterface] io_getAudioData error:', error);
      throw error;
    }
  }

  // Registrar som da biblioteca media
  io_registersound(dir, name) {
    try {
      if (!this.currentAudio[name]) {
        // Normalizar o caminho do som vindo do ScratchAudio
        let cleanDir = dir || '';
        if (cleanDir.startsWith('HTML5/')) {
          cleanDir = cleanDir.substring('HTML5/'.length);
        }
        if (cleanDir === '' || cleanDir === '/') {
          cleanDir = 'sounds/';
        }
        if (!cleanDir.endsWith('/')) {
          cleanDir += '/';
        }
        const cleanName = name.startsWith('/') ? name.substring(1) : name;
        const audioPath = `${cleanDir}${cleanName}`;
        const audio = new Audio(audioPath);
        audio.volume = 0.8;
        
        // Quando o som termina, notificar ScratchJr
        audio.onended = () => {
          if (window.iOS && window.iOS.soundDone) {
            window.iOS.soundDone(name);
          }
        };
        
        this.currentAudio[name] = audio;
      }
      return true;
    } catch (error) {
      console.error('[WebInterface] io_registersound error:', error);
      return false;
    }
  }

  // Tocar som registrado
  io_playsound(name) {
    try {
      const audioElement = this.currentAudio[name];
      
      if (!audioElement) {
        console.warn('[WebInterface] io_playsound: som não registrado:', name);
        // Notificar que som completou (vazio) para não travar o script
        if (window.iOS && window.iOS.soundDone) {
          setTimeout(() => window.iOS.soundDone(name), 1);
        }
        return;
      }

      // Tentar tocar
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Autoplay bloqueado pelo browser é normal, não logar como erro
          if (error.name === 'NotAllowedError') {
            // Browser bloqueou autoplay, passa silenciosamente
            // Sinalizar que som "completou" para não travar
            if (window.iOS && window.iOS.soundDone) {
              setTimeout(() => window.iOS.soundDone(name), 1);
            }
          } else {
            console.warn('[WebInterface] Aviso ao tocar som:', error.message);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('[WebInterface] io_playsound error:', error);
      return false;
    }
  }

  // Parar som
  io_stopsound(name) {
    try {
      const audioElement = this.currentAudio[name];
      
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      
      return true;
    } catch (error) {
      console.error('[WebInterface] io_stopsound error:', error);
      return false;
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  io_getIsDebug() {
    return this.isDebug;
  }

  io_getmd5(data) {
    // Implementação simples - em produção usar crypto.subtle
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  io_gettextresource(filename, fcn) {
    try {
      // Tentar carregar arquivo: primeiro sem assets/, depois com assets/
      const fetchFile = async () => {
        try {
          // Se for um arquivo da raiz (como settings.json, localizations, etc)
          if (filename.includes('settings') || filename.startsWith('./') || filename.startsWith('/')) {
            let url = filename.startsWith('/') ? filename : filename;
            const response = await fetch(url);
            if (response.ok) {
              const content = await response.text();
              if (fcn) fcn(content);
              return;
            }
          }
          
          // Se for um asset dentro de assets/
          const assetUrl = filename.startsWith('assets/') ? filename : `assets/${filename}`;
          const response = await fetch(assetUrl);
          if (response.ok) {
            const content = await response.text();
            if (fcn) fcn(content);
            return;
          }
          
          // Se tudo falhar, retornar null
          if (fcn) fcn(null);
        } catch (error) {
          console.error('[WebInterface] io_gettextresource error loading:', filename, error);
          if (fcn) fcn(null);
        }
      };
      
      // Executar async
      fetchFile();
    } catch (error) {
      console.error('[WebInterface] io_gettextresource error:', error);
      if (fcn) fcn(null);
    }
  }

  // ============================================
  // Camera (com permissão do usuário)
  // ============================================

  async io_camera_start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 320 }, height: { ideal: 240 } }
      });
      
      this.cameraStream = stream;
      return { success: true };
    } catch (error) {
      console.error('[WebInterface] Camera error:', error);
      return { success: false, error: error.message };
    }
  }

  io_camera_stop() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
      return { success: true };
    }
    return { success: false };
  }

  // ============================================
  // Recording (Audio via MediaRecorder API)
  // ============================================

  async io_record_start(filename) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          const base64 = e.target.result.split(',')[1];
          await this.io_setmedia({
            filename,
            content: base64
          });
        };
        
        reader.readAsDataURL(blob);
      };

      this.currentAudio = { recorder, stream };
      recorder.start();
      return { success: true };
    } catch (error) {
      console.error('[WebInterface] Recording error:', error);
      return { success: false, error: error.message };
    }
  }

  io_record_stop() {
    if (this.currentAudio.recorder) {
      this.currentAudio.recorder.stop();
      this.currentAudio.stream.getTracks().forEach(track => track.stop());
      this.currentAudio = {};
      return { success: true };
    }
    return { success: false };
  }

  // ============================================
  // System Info
  // ============================================

  io_getsysteminfo() {
    return {
      platform: 'web',
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      storage: {
        local: localStorage.length,
        session: sessionStorage.length
      }
    };
  }

  // ============================================
  // Missing IO Methods (stubs for compatibility)
  // ============================================

  io_cleanassets(fileType) {
    // Remove cached assets of a certain type
    return true;
  }

  io_getmedialen(file, key) {
    try {
      const data = localStorage.getItem(this._mediaKey(file)) || '';
      this.mediaReadCache[String(key)] = data;
      return data.length;
    } catch (error) {
      console.error('[WebInterface] io_getmedialen error:', error);
      this.mediaReadCache[String(key)] = '';
      return 0;
    }
  }

  io_getmediadata(key, offset, len) {
    const data = this.mediaReadCache[String(key)] || '';
    const start = Number(offset) || 0;
    const size = Number(len) || 0;
    return data.substring(start, start + size);
  }

  io_getmediadone(file) {
    delete this.mediaReadCache[String(file)];
    return true;
  }

  io_setmedianame(data, name, ext) {
    try {
      const filename = `${name}.${ext}`;
      if (!data) {
        return null;
      }

      localStorage.setItem(this._mediaKey(filename), data);

      fetch(`${API_BASE_URL}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this._authHeader() },
        body: JSON.stringify({ filename, data })
      }).catch((err) => {
        console.warn('[WebInterface] io_setmedianame backend sync warning:', err?.message || err);
      });

      return filename;
    } catch (error) {
      console.error('[WebInterface] io_setmedianame error:', error);
      return null;
    }
  }

  io_remove(path) {
    try {
      localStorage.removeItem(this._mediaKey(path));

      fetch(`${API_BASE_URL}/media/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: { ...this._authHeader() }
      }).catch((err) => {
        console.warn('[WebInterface] io_remove backend sync warning:', err?.message || err);
      });

      return true;
    } catch (error) {
      console.error('[WebInterface] io_remove error:', error);
      return false;
    }
  }

  _mediaKey(filename) {
    return `scratchjr_media_${filename}`;
  }

  _mimeFromFilename(filename) {
    const lower = (filename || '').toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.svg')) return 'image/svg+xml';
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    return 'application/octet-stream';
  }

  _base64ToBlob(base64, mimeType) {
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  // ============================================
  // Recording Methods
  // ============================================

  recordsound_recordstart() {
    if (!this.recordingAudio) {
      this.recordingAudio = { recording: false };
    }
    this.recordingAudio.recording = true;
    return 0;
  }

  recordsound_recordstop() {
    if (this.recordingAudio) {
      this.recordingAudio.recording = false;
    }
    return 0;
  }

  recordsound_volume() {
    // Return recorded volume level (0-100)
    return 50;
  }

  recordsound_startplay() {
    // Start playing recorded audio
    return 0;
  }

  // ============================================
  // Permissions
  // ============================================

  askForPermission() {
    // Request user permissions for camera/microphone
    // Em web, as permissões são solicitadas quando necessário
    console.log('[WebInterface] askForPermission called');
    return true;
  }

  // ============================================
  // Camera Check
  // ============================================

  scratchjr_cameracheck() {
    // Check if camera is available
    const hasCamera = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    return hasCamera ? 1 : 0;
  }

  // ============================================
  // Analytics
  // ============================================

  analyticsEvent(category, action, label, value) {
    // Send analytics event
    // Em web, pode usar Google Analytics, Mixpanel, etc.
    console.log('[WebInterface] Analytics:', { category, action, label, value });
    return true;
  }

  // ============================================
  // Additional Recording Methods
  // ============================================

  recordsound_recordclose(b) {
    // Close recording session
    return 0;
  }

  recordsound_stopplay() {
    // Stop playing recorded audio
    return 0;
  }

  // ============================================
  // Camera Feed Methods
  // ============================================

  scratchjr_startfeed(containerId) {
    // Start camera feed in container
    try {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[WebInterface] Container not found:', containerId);
        return false;
      }
      
      navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 } } })
        .then(stream => {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.width = 320;
          video.height = 240;
          container.appendChild(video);
          this.currentVideoStream = stream;
          this.currentVideoElement = video;
        })
        .catch(err => console.error('[WebInterface] Camera feed error:', err));
      
      return true;
    } catch (error) {
      console.error('[WebInterface] scratchjr_startfeed error:', error);
      return false;
    }
  }

  scratchjr_stopfeed() {
    // Stop camera feed
    try {
      if (this.currentVideoStream) {
        this.currentVideoStream.getTracks().forEach(track => track.stop());
        this.currentVideoStream = null;
      }
      if (this.currentVideoElement && this.currentVideoElement.parentNode) {
        this.currentVideoElement.parentNode.removeChild(this.currentVideoElement);
        this.currentVideoElement = null;
      }
      return true;
    } catch (error) {
      console.error('[WebInterface] scratchjr_stopfeed error:', error);
      return false;
    }
  }

  scratchjr_choosecamera(mode) {
    // Choose front/back camera (on web, usually front only)
    console.log('[WebInterface] choosecamera mode:', mode);
    return true;
  }

  scratchjr_captureimage(fcn) {
    // Capture image from camera feed
    try {
      if (!this.currentVideoElement) {
        console.warn('[WebInterface] No camera feed active');
        if (fcn) fcn(null);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.currentVideoElement, 0, 0, 320, 240);
      
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      if (fcn) fcn(imageData);
    } catch (error) {
      console.error('[WebInterface] scratchjr_captureimage error:', error);
      if (fcn) fcn(null);
    }
  }

  // ============================================
  // UI Methods
  // ============================================

  hideSplash() {
    // Hide splash screen
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.display = 'none';
    }
    return true;
  }

  sendSjrUsingShareDialog(fileName, emailSubject, emailBody, shareType, b64data) {
    // Send SJR file via share dialog
    try {
      console.log('[WebInterface] Share request:', { fileName, shareType });
      
      // Em web, pode oferecer download ou integração com APIs de compartilhamento
      if (navigator.share) {
        const blob = new Blob([atob(b64data)], { type: 'application/octet-stream' });
        const file = new File([blob], fileName, { type: 'application/octet-stream' });
        
        navigator.share({
          title: emailSubject,
          text: emailBody,
          files: [file],
        }).catch(err => console.log('[WebInterface] Share error:', err));
      } else {
        // Fallback: download do arquivo
        const blob = new Blob([atob(b64data)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      return true;
    } catch (error) {
      console.error('[WebInterface] sendSjrUsingShareDialog error:', error);
      return false;
    }
  }

  deviceName() {
    // Return device name
    return 'Web Browser';
  }
}

// Exportar interface global
window.tabletInterface = new WebInterface();

// Exportar para ES6 modules
export default WebInterface;
