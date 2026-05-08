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
        Home.displayYourProjects();
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
                Home.createNewProject();
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
        default:
            if (Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
                Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility = 'hidden';
            }
            break;
        }
        function doNext () {
            iOS.analyticsEvent('lobby', 'existing_project_edited');
            window.location.href = '/editor.html?pmd5=' + md5 + '&mode=edit';
        }
    }

    static createNewProject () {
        iOS.analyticsEvent('lobby', 'project_created');
        var obj = {};
        // XXX: for localization, the new project name should likely be refactored
        obj.name = Home.getNextName(Localization.localize('NEW_PROJECT_PREFIX'));
        obj.version = version;
        obj.mtime = (new Date()).getTime().toString();
        IO.createProject(obj, Home.gotoEditor);
    }

    static gotoEditor (md5) {
        iOS.setfile('homescroll.sjr', gn('wrapc').scrollTop, function () {
            doNext(md5);
        });
        function doNext (md5) {
            window.location.href = '/editor.html?pmd5=' + md5 + '&mode=edit';
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
        var shown = (Home.actionTarget.childElementCount > 2) ?
            Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1].style.visibility == 'visible' :
            false;
        if (e && shown) {
            var t;
            if (window.event) {
                t = window.event.srcElement;
            } else {
                t = e.target;
            }
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
            json.items = ['name', 'thumbnail', 'id', 'isgift'];
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
            
            return;
        }
        
        try {
            var data = JSON.parse(str);
        } catch (e) {
            console.error('[Home] ❌ Erro ao parsear projetos:', e);
            console.error('[Home] Stack:', e.stack);
            Home.emptyProjectThumbnail(gn('scrollarea'));
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
        
        for (var i = 0; i < data.length; i++) {
            console.log(`[displayProjects] Adicionando projeto ${i + 1}/${data.length}:`, data[i]);
            Home.addProjectLink(div, data[i]);
        }
        
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
        if (!th) {
            return;
        }
        var thumb = (typeof th === 'string') ? JSON.parse(th) : th;
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

        newHTML('div', 'closex', tb);
    }

    static insertThumbnail (p, w, h, data) {
        var md5 = data.md5;
        var img = newHTML('img', undefined, p);
        if (md5 && typeof md5 === 'string') {
            IO.getAsset(md5, drawMe);
        }
        function drawMe (url) {
            img.src = url;
        }
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
