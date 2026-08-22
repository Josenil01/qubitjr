//////////////////////////////////////////////////
// Home Screen
//////////////////////////////////////////////////

import Lobby from './Lobby.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import Project from '../editor/ui/Project.js';
import Localization from '../utils/Localization.js';
import ScratchAudio from '../utils/ScratchAudio.js';
import Vector from '../geom/Vector.js';
import AssignmentNotice from './AssignmentNotice.js';
import {gn, newHTML, isTablet} from '../utils/lib.js';

let frame;
let scrollvalue;
let version;
let timeoutEvent;

export default class Home {
    static init () {
        version = Lobby.version;
        frame = gn('htmlcontents');
        var inner = newHTML('div', 'inner', frame);
        var div = newHTML('div', 'scrollarea', inner);
        div.setAttribute('id', 'scrollarea');
        frame.onmousedown = Home.handleTouchStart;
        frame.onmouseup = Home.handleTouchEnd;
        Home.showLoading();
        Home.displayYourProjects();
        // Sino de missão pendente no topbar - no-op silencioso se não
        // houver missão ativa/não iniciada pro aluno (ver AssignmentNotice.js).
        AssignmentNotice.init();
    }

    ////////////////////////////
    // Loading overlay
    ////////////////////////////

    // Shown from init() until the project list has been fetched AND every
    // project's thumbnail has resolved (or failed) - so the grid never
    // flashes blank/broken thumbnails while io_getmediaAsync's network
    // fallback is still in flight for cards synced from another device.
    static showLoading () {
        Home._pendingThumbs = 0;
        Home._stillEnumerating = true;
        if (gn('homeloading')) {
            return;
        }
        var overlay = newHTML('div', 'homeloading', document.body);
        overlay.setAttribute('id', 'homeloading');
        newHTML('div', 'homeloading-spinner', overlay);
        Home._loadingTimeout = setTimeout(Home.hideLoading, 6000);
    }

    static hideLoading () {
        clearTimeout(Home._loadingTimeout);
        var overlay = gn('homeloading');
        if (!overlay) {
            return;
        }
        overlay.className = 'homeloading fade';
        setTimeout(function () {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
    }

    static maybeHideLoading () {
        if (!Home._stillEnumerating && (Home._pendingThumbs <= 0)) {
            Home.hideLoading();
        }
    }

    ////////////////////////////
    // Home Screen
    ////////////////////////////

    static emptyProjectThumbnail (parent) {
        console.log('[emptyProjectThumbnail] 📍 parent:', parent);
        console.log('[emptyProjectThumbnail] parent.children antes:', parent.childElementCount);
        
        var tb = newHTML('div', 'projectthumb', parent);
        console.log('[emptyProjectThumbnail] tb criado:', tb);
        console.log('[emptyProjectThumbnail] tb.classList:', Array.from(tb.classList));
        
        var empty = newHTML('div', 'aproject empty', tb);
        console.log('[emptyProjectThumbnail] aproject.empty criado:', empty);
        console.log('[emptyProjectThumbnail] empty.classList:', Array.from(empty.classList));
        
        tb.id = 'newproject';
        console.log('[emptyProjectThumbnail] ✅ Botão + projeto criado, id=newproject');
        console.log('[emptyProjectThumbnail] tb.id:', tb.id);
        console.log('[emptyProjectThumbnail] div.style:', getComputedStyle(tb));
        console.log('[emptyProjectThumbnail] empty.style:', getComputedStyle(empty));
    }

    //////////////////////////
    // Events
    //////////////////////////

    static handleTouchStart (e) {
        Home.dragging = false;
        Home.holding = false;
        // if ((t.nodeName == "INPUT") || (t.nodeName == "FORM")) return;
        var mytarget = Home.getMouseTarget(e);
        if ((mytarget != Home.actionTarget) && Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
            Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility = 'hidden';
        }
        Home.actionTarget = mytarget;
        Home.initialPt = Events.getTargetPoint(e);
        if (Home.actionTarget) {
            holdit(Home.actionTarget);
        }
        function holdit () {
            frame.onmousemove = Home.handleMove;
            var repeat = function () {
                if (Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
                    Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility = 'visible';

                    Home.holding = true;
                }
            };
            timeoutEvent = setTimeout(repeat, 500);
        }
        Home.scrolltop = document.body.scrollTop;
    }

    static handleMove (e) {
        var pt = Events.getTargetPoint(e);
        var delta = Vector.diff(pt, Home.initialPt);
        if (!Home.dragging && (Vector.len(delta) > 20)) {
            Home.dragging = true;
        }
        if (!Home.dragging) {
            return;
        }
        if (timeoutEvent) {
            clearTimeout(timeoutEvent);
        }
        timeoutEvent = undefined;
    }

    static getMouseTarget (e) {
        var t = e.target;
        if (t == frame) {
            return null;
        }
        if (t.parentNode && !t.parentNode.tagName) {
            return null;
        }
        while (t.parentNode && (t.parentNode != frame) && (t.parentNode.getAttribute('class') != 'scrollarea')) {
            t = t.parentNode;
        }
        return (!t.parentNode || (t.parentNode == frame)) ? null : t;
    }

    static handleTouchEnd (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches && (e.touches.length > 1)) {
            return;
        }
        if (isTablet) {
            frame.onmousemove = undefined;
        } else {
            frame.onmousemove = undefined;
        }
        if (timeoutEvent) {
            clearTimeout(timeoutEvent);
        }
        timeoutEvent = undefined;
        if (Home.dragging) {
            return;
        }
        Home.performAction(e);
    }

    static performAction (e) {
        e.preventDefault();
        e.stopPropagation();
        if (!Home.actionTarget) {
            return;
        }
        if (Home.holding) {
            return;
        }
        var md5 = Home.actionTarget.id;
        switch (Home.getAction(e)) {
        case 'project':
            ScratchAudio.sndFX('keydown.wav');
            if (md5 && (md5 == 'newproject')) {
                if (Home._dailyLimitReached) {
                    Home._showDailyLimitModal();
                } else {
                    Home.showNewProjectModal();
                }
            } else if (md5) {
                iOS.setfile('homescroll.sjr', gn('wrapc').scrollTop, function () {
                    doNext(md5);
                });
            }
            break;
        case 'delete':
            ScratchAudio.sndFX('cut.wav');
            Project.thumbnailUnique(Home.actionTarget.thumb, Home.actionTarget.id, function (isUnique) {
                if (isUnique) {
                    iOS.remove(Home.actionTarget.thumb, iOS.trace);
                }
            });
            iOS.setfield(iOS.database, Home.actionTarget.id, 'deleted', 'YES', Home.removeProjThumb);
            break;
        case 'share':
            Home.shareProject(Home.actionTarget.id);
            break;
        default:
            if (Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
                Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility = 'hidden';
            }
            break;
        }
        function doNext () {
            iOS.analyticsEvent('lobby', 'existing_project_edited');
            var _tok = '';
            try { _tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
            var _edUrl = '/editor.html?pmd5=' + md5 + '&mode=edit' + (_tok ? '&token=' + encodeURIComponent(_tok) : '');
            window.location.href = _edUrl;
        }
    }

    static createNewProject () {
        iOS.analyticsEvent('lobby', 'project_created');
        var obj = {};
        // XXX: for localization, the new project name should likely be refactored
        obj.name = Home.getNextName(Localization.localize('NEW_PROJECT_PREFIX'));
        obj.version = version;
        obj.mtime = (new Date()).getTime().toString();
        IO.createProject(obj, Home.gotoEditor, Home._handleCreateProjectError);
    }

    static showNewProjectModal () {
        var suggested = Home.getNextName(Localization.localize('NEW_PROJECT_PREFIX'));
        var modal    = document.getElementById('sjr-naming-modal');
        var input    = document.getElementById('sjr-naming-input');
        var backdrop = document.getElementById('sjr-naming-backdrop');
        var btnOk    = document.getElementById('sjr-naming-confirm');
        var btnCancel = document.getElementById('sjr-naming-cancel');

        if (!modal || !input) {
            // fallback: criar diretamente se o modal não estiver no DOM
            Home.createNewProject();
            return;
        }

        // Guarda o nome sugerido para uso no _confirmNewProject
        Home._namingSuggested = suggested;

        input.value = suggested;
        modal.classList.remove('hidden');
        // Seleciona o texto para que a criança possa digitar direto
        setTimeout(function () { input.select(); input.focus(); }, 50);

        // Listeners de confirmação/cancelamento (once: evita duplicatas)
        function onConfirm () {
            cleanup();
            Home._confirmNewProject();
        }
        function onCancel () {
            cleanup();
            Home._hideNewProjectModal();
        }
        function onKey (e) {
            if (e.key === 'Enter') { cleanup(); Home._confirmNewProject(); }
            if (e.key === 'Escape') { cleanup(); Home._hideNewProjectModal(); }
        }
        function cleanup () {
            btnOk.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            backdrop.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKey);
        }

        btnOk.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
        backdrop.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKey);
    }

    static _confirmNewProject () {
        var input = document.getElementById('sjr-naming-input');
        var name = (input && input.value.trim()) || Home._namingSuggested ||
                   Home.getNextName(Localization.localize('NEW_PROJECT_PREFIX'));
        Home._hideNewProjectModal();
        iOS.analyticsEvent('lobby', 'project_created');
        var obj = {};
        obj.name = name;
        obj.version = version;
        obj.mtime = (new Date()).getTime().toString();
        IO.createProject(obj, Home.gotoEditor, Home._handleCreateProjectError);
    }

    static _hideNewProjectModal () {
        var modal = document.getElementById('sjr-naming-modal');
        if (modal) { modal.classList.add('hidden'); }
    }

    static _showDailyLimitModal () {
        Home._showActionErrorModal(Localization.localize('DAILY_LIMIT_MESSAGE'), '⏰');
    }

    // Reused for any "couldn't create project" failure - not just the daily limit
    // (backend/auth/network errors), so the child gets feedback instead of a silent
    // no-op click.
    static _showActionErrorModal (message, icon) {
        var modal = document.getElementById('sjr-daily-limit-modal');
        var text  = document.getElementById('sjr-daily-limit-text');
        var iconEl = document.getElementById('sjr-daily-limit-icon');
        if (!modal) return;
        if (text) text.textContent = message;
        if (iconEl) iconEl.textContent = icon || '⏰';
        modal.classList.remove('hidden');
        function close () { modal.classList.add('hidden'); }
        var btnOk    = document.getElementById('sjr-daily-limit-ok');
        var backdrop = document.getElementById('sjr-daily-limit-backdrop');
        if (btnOk)    btnOk.onclick    = close;
        if (backdrop) backdrop.onclick = close;
    }

    // errorFcn passed to IO.createProject - branches on the error code so the
    // daily-limit case keeps its own message instead of showing a generic one.
    static _handleCreateProjectError (code) {
        if (code === 'DAILY_LIMIT_EXCEEDED') {
            Home._showDailyLimitModal();
        } else {
            Home._showActionErrorModal('Não foi possível criar o projeto. Tente novamente.', '⚠️');
        }
    }

    static gotoEditor (md5) {
        iOS.setfile('homescroll.sjr', gn('wrapc').scrollTop, function () {
            doNext(md5);
        });
        function doNext (md5) {
            var _tok = '';
            try { _tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
            var _edUrl = '/editor.html?pmd5=' + md5 + '&mode=edit' + (_tok ? '&token=' + encodeURIComponent(_tok) : '');
            window.location.href = _edUrl;
        }
    }

    // Project names are given by reading the DOM elements of existing projects...
    static getNextName (name) {
        var pn = [];
        var div = gn('scrollarea');
        for (var i = 0; i < div.childElementCount; i++) {
            if (div.childNodes[i].id == 'newproject') {
                continue;
            }
            pn.push(div.childNodes[i].childNodes[1].childNodes[0].textContent);
        }
        var n = 1;
        while (pn.indexOf(name + ' ' + n) > -1) {
            n++;
        }
        return name + ' ' + n;
    }

    static removeProjThumb () {
        if (Home.actionTarget && Home.actionTarget.parentNode) {
            Home.actionTarget.parentNode.removeChild(Home.actionTarget);
        }
        Home.actionTarget = undefined;
    }

    static getAction (e) {
        if (!Home.actionTarget) {
            return 'none';
        }
        var t = (window.event ? window.event.srcElement : e && e.target);
        if (t && t.getAttribute('class') === 'sharex') {
            return 'share';
        }
        var shown = (Home.actionTarget.childElementCount > 2) ?
            Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility == 'visible' :
            false;
        if (e && shown && t) {
            if (t.getAttribute('class') == 'closex') {
                return 'delete';
            }
        }
        return 'project';
    }

    //////////////////////////
    // Gather projects
    //////////////////////////

    static displayYourProjects () {
        iOS.getfile('homescroll.sjr', gotScrollsState);
        function gotScrollsState (str) {
            scrollvalue = 0;
            try {
              if (str && str.length > 0) {
                var num = Number(atob(str));
                scrollvalue = (num.toString() == 'NaN') ? 0 : num;
              }
            } catch (e) {
              console.warn('[Home] Erro ao decodificar scroll state:', e);
              scrollvalue = 0;
            }
            var json = {};
            json.cond = 'deleted = ? AND version = ? AND gallery IS NULL';
            json.items = ['name', 'thumbnail', 'id', 'isgift', 'created_at'];
            json.values = ['NO', version];
            json.order = 'ctime desc';
            IO.query(iOS.database, json, Home.displayProjects);
        }
    }

    static displayProjects (str) {
        console.log('%c[displayProjects] 🎨 Iniciando renderização de projetos', 'color: blue; font-weight: bold;');
        console.log('[displayProjects] str recebido:', str ? `${str.substring(0, 100)}...` : 'null/empty');
        
        if (!str) {
            // Sem resultados, mostrar mensagem vazia
            var div = gn('scrollarea');
            console.log('[displayProjects] ⚠️ str é null/empty, renderizando empty state');
            console.log('[displayProjects] div:', div);
            console.log('[displayProjects] div.childElementCount ANTES:', div.childElementCount);
            
            while (div.childElementCount > 0) {
                console.log('[displayProjects] Removendo child:', div.childNodes[0]);
                div.removeChild(div.childNodes[0]);
            }
            console.log('[displayProjects] div.childElementCount DEPOIS de limpar:', div.childElementCount);
            
            Home.emptyProjectThumbnail(div);
            console.log('[displayProjects] ✅ emptyProjectThumbnail() chamado');
            console.log('[displayProjects] div.childElementCount APÓS emptyProjectThumbnail:', div.childElementCount);
            console.log('[displayProjects] div.innerHTML:', div.innerHTML);
            Home._dailyLimitReached = false;
            Home._stillEnumerating = false;
            Home.maybeHideLoading();
            return;
        }

        try {
            var data = JSON.parse(str);
        } catch (e) {
            console.error('[Home] ❌ Erro ao parsear projetos:', e);
            console.error('[Home] Stack:', e.stack);
            Home.emptyProjectThumbnail(gn('scrollarea'));
            Home._stillEnumerating = false;
            Home.maybeHideLoading();
            return;
        }
        
        var div = gn('scrollarea');
        console.log('[displayProjects] ✅ Projetos parseados, quantidade:', data.length);
        console.log('[displayProjects] div:', div);
        console.log('[displayProjects] Limpando div...');
        
        while (div.childElementCount > 0) {
            div.removeChild(div.childNodes[0]);
        }
        
        Home.emptyProjectThumbnail(div);
        
        // Check daily project limit (UTC day)
        var _today = new Date().toISOString().split('T')[0];
        Home._dailyLimitReached = data.some(function(p) {
            return p.isgift !== '1' && p.created_at && p.created_at.startsWith(_today);
        });
        if (Home._dailyLimitReached) {
            var _btn = gn('newproject');
            if (_btn) _btn.classList.add('daily-limit-reached');
        }
        
        for (var i = 0; i < data.length; i++) {
            console.log(`[displayProjects] Adicionando projeto ${i + 1}/${data.length}:`, data[i]);
            Home.addProjectLink(div, data[i]);
        }
        Home._stillEnumerating = false;
        Home.maybeHideLoading();

        setTimeout(function () {
            Lobby.busy = false;
        }, 1000);
        
        if (gn('wrapc')) {
            gn('wrapc').scrollTop = scrollvalue;
        }
    }

    static addProjectLink (parent, aa) {
        var data = IO.parseProjectData(aa);
        var id = data.id;
        var th = data.thumbnail;
        var thumb = th ? ((typeof th === 'string') ? JSON.parse(th) : th) : {};
        var pc = thumb.pagecount ? thumb.pagecount : 1;
        var tb = newHTML('div', 'projectthumb', parent);
        tb.setAttribute('id', id);
        tb.type = 'projectthumb';
        tb.thumb = thumb.md5;
        var mt = newHTML('div', 'aproject p' + pc, tb);
        Home.insertThumbnail(mt, 192, 144, thumb);
        var label = newHTML('div', 'projecttitle', tb);
        var txt = newHTML('h4', undefined, label);
        txt.textContent = data.name;

        var bow = newHTML('div', 'share', tb);
        var ribbonHorizontal = newHTML('div', 'ribbonHorizontal', tb);
        var ribbonVertical = newHTML('div', 'ribbonVertical', tb);

        if (data.isgift != '0') {
            // If it's a gift, show the bow and ribbon
            bow.style.visibility = 'visible';
            ribbonHorizontal.style.visibility = 'visible';
            ribbonVertical.style.visibility = 'visible';
        }

        var shareBtn = newHTML('div', 'sharex', tb);
        shareBtn.title = 'Compartilhar';
        shareBtn.textContent = '📤';

        newHTML('div', 'closex', tb);
    }

    static insertThumbnail (p, w, h, data) {
        var md5 = data.md5;
        var img = newHTML('img', undefined, p);
        if (md5 && typeof md5 === 'string') {
            Home._pendingThumbs++;
            IO.getAsset(md5, drawMe);
        }
        function drawMe (url) {
            img.src = url;
            Home._pendingThumbs--;
            Home.maybeHideLoading();
        }
    }

    static shareProject (projectId) {
        var token = '';
        try { token = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
        var apiBase = window.API_URL || '/api';
        fetch(apiBase + '/share/' + projectId, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        })
            .then(function (res) {
                var contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error('Backend indisponível (status ' + res.status + '). Reinicie o servidor.');
                }
                return res.json();
            })
            .then(function (data) {
                if (data.shareUrl) {
                    Home._showShareModal(data.shareUrl);
                } else {
                    Home._showShareModal(null, data.error || 'Erro ao gerar link.');
                }
            })
            .catch(function (err) {
                Home._showShareModal(null, err.message);
            });
    }

    static _ensureShareModal () {
        if (document.getElementById('sjr-share-modal')) return;
        var backdrop = document.createElement('div');
        backdrop.id = 'sjr-share-backdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9998;display:none;';

        var modal = document.createElement('div');
        modal.id = 'sjr-share-modal';
        modal.style.cssText = [
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);',
            'background:#fff;border-radius:16px;padding:24px;width:min(90vw,420px);',
            'z-index:9999;display:none;box-shadow:0 8px 40px rgba(0,0,0,0.3);',
            'font-family:Helvetica Neue,Arial,sans-serif;'
        ].join('');

        modal.innerHTML = [
            '<div style="font-size:22px;font-weight:700;color:#333;margin-bottom:8px;">📤 Compartilhar Projeto</div>',
            '<div id="sjr-share-msg" style="font-size:14px;color:#555;margin-bottom:14px;">',
            'Envie este link para alguém assistir à sua animação!</div>',
            '<div id="sjr-share-link-wrap" style="display:flex;gap:8px;margin-bottom:8px;">',
            '<input id="sjr-share-link-input" readonly style="flex:1;padding:9px 12px;border:1.5px solid #ddd;',
            'border-radius:10px;font-size:13px;color:#333;background:#f9f9f9;outline:none;" />',
            '<button id="sjr-share-copy-btn" style="background:#6c63ff;color:#fff;border:none;border-radius:10px;',
            'padding:9px 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">Copiar</button>',
            '</div>',
            '<div id="sjr-share-copied" style="font-size:12px;color:#48c9b0;height:16px;"></div>',
            '<div id="sjr-share-error" style="font-size:13px;color:#e74c3c;display:none;"></div>',
            '<div style="margin-top:16px;text-align:right;">',
            '<button id="sjr-share-close-btn" style="background:#f0f0f0;color:#555;border:none;border-radius:10px;',
            'padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;">Fechar</button>',
            '</div>'
        ].join('');

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        document.getElementById('sjr-share-copy-btn').onclick = function () {
            var input = document.getElementById('sjr-share-link-input');
            input.select();
            try { document.execCommand('copy'); } catch (_) {
                navigator.clipboard && navigator.clipboard.writeText(input.value);
            }
            var copied = document.getElementById('sjr-share-copied');
            copied.textContent = '✓ Link copiado!';
            setTimeout(function () { copied.textContent = ''; }, 2000);
        };

        function closeModal() {
            document.getElementById('sjr-share-modal').style.display = 'none';
            document.getElementById('sjr-share-backdrop').style.display = 'none';
        }
        document.getElementById('sjr-share-close-btn').onclick = closeModal;
        backdrop.onclick = closeModal;
    }

    static _showShareModal (shareUrl, errorMsg) {
        Home._ensureShareModal();
        var modal    = document.getElementById('sjr-share-modal');
        var backdrop = document.getElementById('sjr-share-backdrop');
        var linkWrap = document.getElementById('sjr-share-link-wrap');
        var input    = document.getElementById('sjr-share-link-input');
        var errDiv   = document.getElementById('sjr-share-error');
        var copied   = document.getElementById('sjr-share-copied');

        copied.textContent = '';

        if (errorMsg) {
            linkWrap.style.display = 'none';
            errDiv.style.display = 'block';
            errDiv.textContent = errorMsg;
        } else {
            linkWrap.style.display = 'flex';
            errDiv.style.display = 'none';
            input.value = shareUrl;
        }

        modal.style.display = 'block';
        backdrop.style.display = 'block';
    }
}

class Events {
    static getTargetPoint (e) {
        if (isTablet) {
            if (e.touches && (e.touches.length > 0)) {
                return {
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY
                };
            } else if (e.changedTouches) {
                return {
                    x: e.changedTouches[0].pageX,
                    y: e.changedTouches[0].pageY
                };
            }
        }
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
}
