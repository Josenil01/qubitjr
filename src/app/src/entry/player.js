/**
 * src/app/src/entry/player.js
 *
 * Entry point para a página de visualização pública de projetos.
 * Carrega o engine ScratchJr em modo 'look' (somente leitura) a partir do share token,
 * bypassa auth para buscar dados do projeto e mídia via Supabase Storage público,
 * e inicia a animação automaticamente ao carregar.
 */

import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import Project from '../editor/ui/Project.js';
import UI from '../editor/ui/UI.js';
import Library from '../editor/ui/Library.js';
import Paint from '../painteditor/Paint.js';
import Record from '../editor/ui/Record.js';
import Undo from '../editor/ui/Undo.js';
import Alert from '../editor/ui/Alert.js';
import Palette from '../editor/ui/Palette.js';

const EMOJIS = ['❤️', '😄', '👏', '🌟', '🎉'];
const LABELS = { '❤️': 'Amei', '😄': 'Divertido', '👏': 'Parabéns', '🌟': 'Incrível', '🎉': 'Que show!' };

export async function playerMain() {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const apiBase = window.API_URL || (location.origin + '/api');

    if (!token) {
        _showFatalError('Link inválido. Nenhum token encontrado na URL.');
        return;
    }

    // ── 1. Buscar dados do projeto via rota pública (sem auth) ──────────────
    let projectData;
    try {
        const res = await fetch(apiBase + '/public/project/' + encodeURIComponent(token));
        if (!res.ok) throw new Error(res.status);
        projectData = await res.json();
    } catch (e) {
        _showFatalError('Projeto não encontrado ou link expirado.');
        return;
    }

    // Atualiza o título da página
    document.title = (projectData.name || 'Projeto') + ' — QubitJr';

    // Atualiza o header do player (se existir no HTML)
    const headerTitle = document.getElementById('player-header-title');
    if (headerTitle) headerTitle.textContent = projectData.name || 'Projeto';

    // ── 2. Armazenar dados globalmente para interceptação do IO ──────────────
    window.__playerProject = {
        id: 'player',
        name: projectData.name || 'Projeto',
        json: typeof projectData.json === 'string'
            ? projectData.json
            : JSON.stringify(projectData.json),
        thumbnail: null,
        deleted: 'NO',
        version: (window.Settings && window.Settings.scratchJrVersion) || 'iOSv01',
    };
    window.__playerMediaBaseUrl = projectData.mediaBaseUrl || null;
    window.__playerToken = token;
    window.__playerReactions = projectData.reactions || {};

    // ── 2b. Pré-popular localStorage com SVGs dos sprites ────────────────────
    // iOS.getmedia lê de localStorage (io_getmedialen sincrono). Viewers sem cache
    // recebem conteúdo vazio → sprites ficam em branco. Pré-buscar corrige isso.
    if (projectData.mediaBaseUrl) {
        await _prefetchMedia(window.__playerProject.json, projectData.mediaBaseUrl);
    }

    // ── 3. Patch IO.getObjectinDB — retorna projeto injetado sem chamar backend ──
    const _origGetObjectinDB = IO.getObjectinDB;
    IO.getObjectinDB = function (db, md5, fcn) {
        if (db === 'projects') {
            fcn(JSON.stringify([window.__playerProject]));
            return;
        }
        _origGetObjectinDB.call(IO, db, md5, fcn);
    };

    // ── 4. Patch io_getmedia — usa Supabase Storage público em vez de /api/media ──
    // tabletInterface já está disponível porque WebInterface.js roda no topo de appEntry-vite.js
    if (window.tabletInterface && window.__playerMediaBaseUrl) {
        const _origGetMedia = window.tabletInterface.io_getmedia.bind(window.tabletInterface);
        window.tabletInterface.io_getmedia = async function (filename) {
            // a) Cache local (localStorage) tem prioridade
            try {
                const cached = localStorage.getItem(`scratchjr_media_${filename}`);
                if (cached) {
                    return window.tabletInterface._base64ToBlob(
                        cached,
                        window.tabletInterface._mimeFromFilename(filename)
                    );
                }
            } catch (_) {}

            // b) Supabase Storage público
            try {
                const url = window.__playerMediaBaseUrl + filename;
                const resp = await fetch(url);
                if (resp.ok) return await resp.blob();
            } catch (_) {}

            // c) Fallback — tenta o caminho original (pode falhar sem auth, mas não quebra)
            try { return await _origGetMedia(filename); } catch (_) {}

            // d) Retorna blob vazio para não travar o carregamento
            return new Blob([], { type: window.tabletInterface._mimeFromFilename(filename) });
        };
    }

    // ── 5a. Patch UI.enterFullScreen — limita o stage a 80% do viewport ─────
    const _origEnterFullScreen = UI.enterFullScreen.bind(UI);
    UI.enterFullScreen = function () {
        _origEnterFullScreen();
        // Reaplica a escala limitada a 80% do viewport, centralizada
        try {
            const stage = ScratchJr.stage;
            if (!stage) return;
            const MAX = 0.80;
            const w = window.innerWidth;
            const h = window.innerHeight;
            const scale = Math.min((w * MAX) / stage.width, (h * MAX) / stage.height);
            const dx = Math.floor((w - stage.width * scale) / 2);
            const dy = Math.floor((h - stage.height * scale) / 2);
            stage.setStageScaleAndPosition(scale, dx / scale, dy / scale);
            stage.currentZoom = Math.floor(scale * 100) / 100;
            const stageEl = document.getElementById('stage');
            if (stageEl) stageEl.style.webkitTextSizeAdjust = Math.floor(scale * 100) + '%';
        } catch (e) {
            console.warn('[player] enterFullScreen 80% patch error:', e);
        }
    };

    // ── 5b. Polling: aguarda stage carregar e inicia animação ────────────────
    // Mais robusto que patch em liftCurtain — não depende de referência de classe
    // ou de BlockSpecs.loadCount chegar a zero antes do timeout.
    _waitAndPlay(token, apiBase);

    // ── 6. No-op dos módulos de editor (não usados no player) ────────────────
    Library.init = () => {};
    // Paint.init carrega splash.svg/splashshade.svg usados por UI.createColorMenu — deixar rodar
    Record.init  = () => {};
    Undo.init    = () => {};
    // Silenciar módulos de UI do editor que acessam DOM inexistente no player
    Alert.open = () => {};
    Alert.close = () => {};
    Palette.selectCategory = () => {};
    Palette.show = () => {};
    Palette.hide = () => {};
    // IO.setProjectIsGift tenta gravar no banco com auth do projeto — 401 no player
    IO.setProjectIsGift = () => {};
    // UI.layout precisa rodar completo para criar scriptsarea e demais containers
    // que o Sprite/Scripts constructor exige; o ganho de performance vem do
    // playerEntry-vite.js (MediaLib/PNGCache/Localization pulados), não daqui.
    // Apenas silenciamos erros de painéis que referenciam elementos ausentes.

    // ── 7. Configurar modo e projeto atual ────────────────────────────────────
    window.currentEditorMode = 'look';
    window.currentProjectMd5 = 'player';

    // ── 8. Inicializar o engine ────────────────────────────────────────────────
    iOS.getsettings(function (str) {
        const list = str.split(',');
        iOS.path = list[1] === '0' ? list[0] + '/' : undefined;

        // Em modo player, sobrescreve iOS.path com a base URL pública do Supabase.
        // Page.setBackground constrói url = iOS.path + nome para PNGs de usuário.
        // Sem isso, url fica 'undefinednome.png' → img falha → onerror ausente →
        // fcn() nunca chamado → mediaCount preso → doneProjectLoad nunca roda.
        if (window.__playerMediaBaseUrl) {
            iOS.path = window.__playerMediaBaseUrl;
        }

        ScratchJr.appinit(
            (window.Settings && window.Settings.scratchJrVersion) || 'iOSv01'
        );
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _waitAndPlay(token, apiBase) {
    let attempts = 0;
    const MAX = 60; // até 6 segundos
    const id = setInterval(() => {
        attempts++;
        const stage = ScratchJr.stage;
        // Verifica que o projeto carregou completamente: setLoadPage marca a
        // página corrente como visibility='visible' após todas as mídias serem carregadas.
        const page = stage && stage.currentPage;
        const ready = page && page.div && page.div.style.visibility === 'visible';
        if (ready || attempts >= MAX) {
            clearInterval(id);
            if (!ready) {
                console.warn('[player] stage não carregou após timeout');
                return;
            }
            try {
                const fakeEvt = { preventDefault(){}, stopPropagation(){}, target: null };
                ScratchJr.fullScreen(fakeEvt);
            } catch (e) { console.warn('[player] fullScreen error:', e); }

            // Diagnóstico completo do stage
            try {
                const stageEl = document.getElementById('stage');
                if (stageEl) {
                    const r = stageEl.getBoundingClientRect();
                    console.log('[player] stage rect:', Math.round(r.x), Math.round(r.y), Math.round(r.width), 'x', Math.round(r.height));
                    console.log('[player] stage class:', stageEl.className);
                    console.log('[player] stage parent:', stageEl.parentElement && stageEl.parentElement.id);
                    console.log('[player] stage children:', stageEl.childElementCount);
                    // Listar filhos diretos do stage
                    for (let i = 0; i < Math.min(stageEl.childElementCount, 5); i++) {
                        const c = stageEl.children[i];
                        const cr = c.getBoundingClientRect();
                        console.log(`[player] stage.children[${i}]:`, c.className, c.id, 'visibility:', c.style.visibility, 'rect:', Math.round(cr.x), Math.round(cr.y), Math.round(cr.width), 'x', Math.round(cr.height));
                    }
                    // Listar filhos da primeira página (sprites)
                    const pageDiv = stageEl.querySelector('.page');
                    if (pageDiv) {
                        console.log('[player] page children:', pageDiv.childElementCount, 'visibility:', pageDiv.style.visibility);
                        for (let i = 0; i < Math.min(pageDiv.childElementCount, 5); i++) {
                            const c = pageDiv.children[i];
                            const cr = c.getBoundingClientRect();
                            console.log(`[player] page.children[${i}]:`, c.className, c.id, 'visibility:', c.style.visibility, 'transform:', c.style.webkitTransform || c.style.transform, 'rect:', Math.round(cr.x), Math.round(cr.y), Math.round(cr.width), 'x', Math.round(cr.height));
                        }
                    }
                } else {
                    console.warn('[player] #stage não encontrado no DOM');
                }
            } catch (e) { console.warn('[player] diagnóstico error:', e); }

            try {
                ScratchJr.startGreenFlagThreads();
            } catch (e) { console.warn('[player] startGreenFlagThreads error:', e); }
            _renderReactions(token, apiBase);
        }
    }, 100);
}

async function _prefetchMedia(projectJsonStr, mediaBaseUrl) {
    let parsed;
    try {
        parsed = typeof projectJsonStr === 'string' ? JSON.parse(projectJsonStr) : projectJsonStr;
    } catch (_) { return; }

    const filenames = new Set();
    const pages = parsed.pages || [];
    for (const pageId of pages) {
        const page = parsed[pageId];
        if (!page) continue;
        const sprites = page.sprites || [];
        for (const spriteId of sprites) {
            const sprite = page[spriteId];
            if (sprite && sprite.md5) filenames.add(sprite.md5);
        }
    }

    const base = mediaBaseUrl.endsWith('/') ? mediaBaseUrl : mediaBaseUrl + '/';
    await Promise.all([...filenames].map(async (filename) => {
        const key = `scratchjr_media_${filename}`;
        try { if (localStorage.getItem(key)) return; } catch (_) {}
        try {
            const resp = await fetch(base + filename);
            if (!resp.ok) return;
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            localStorage.setItem(key, btoa(binary));
            console.log('[player] prefetch OK:', filename);
        } catch (e) {
            console.warn('[player] prefetch failed:', filename, e);
        }
    }));
}

function _showFatalError(msg) {
    document.body.innerHTML =
        `<div style="color:#fff;font-family:sans-serif;text-align:center;
                     padding:60px 20px;font-size:18px;">${msg}</div>`;
}

function _renderReactions(token, apiBase) {
    const bar = document.getElementById('player-reactions-bar');
    if (!bar) return;

    const reactions = window.__playerReactions || {};
    let sessionReacted = {};
    try {
        sessionReacted = JSON.parse(sessionStorage.getItem('sjr_reactions_' + token) || '{}');
    } catch (_) {}

    function saveSession() {
        try { sessionStorage.setItem('sjr_reactions_' + token, JSON.stringify(sessionReacted)); } catch (_) {}
    }

    function render() {
        bar.innerHTML = '';
        EMOJIS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'prx-btn' + (sessionReacted[emoji] ? ' reacted' : '');
            btn.title = LABELS[emoji] || emoji;

            const eSpan = document.createElement('span');
            eSpan.textContent = emoji;

            const cSpan = document.createElement('span');
            cSpan.className = 'prx-count';
            cSpan.textContent = reactions[emoji] || 0;

            btn.appendChild(eSpan);
            btn.appendChild(cSpan);
            bar.appendChild(btn);

            btn.addEventListener('click', async () => {
                if (sessionReacted[emoji]) return;
                sessionReacted[emoji] = true;
                reactions[emoji] = (reactions[emoji] || 0) + 1;
                saveSession();
                render();
                const newBtn = bar.querySelectorAll('.prx-btn')[EMOJIS.indexOf(emoji)];
                if (newBtn) {
                    newBtn.classList.add('pop');
                    newBtn.addEventListener('animationend', () => newBtn.classList.remove('pop'), { once: true });
                }
                try {
                    await fetch(
                        apiBase + '/public/project/' + encodeURIComponent(token) + '/react',
                        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) }
                    );
                } catch (_) {}
            });
        });
    }

    bar.style.display = 'flex';
    render();
}
