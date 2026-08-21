/**
 * src/app/src/editor/ui/AssignmentBadge.js
 *
 * Selo flutuante de progresso da missão (lado do ALUNO). Chamado de
 * entry/editor.js (editorMain), só no ramo NORMAL (não professor-autor),
 * depois de ScratchJr.appinit().
 *
 * Fluxo:
 *  1. init() consulta GET /api/assignments/active. Sem turma_id no token
 *     (a maioria dos alunos, fora do contexto HelloYotta) o backend
 *     devolve { assignment: null } (ou nem 200) - no-op silencioso, mesma
 *     filosofia de initLiveWatch() (ver comentário em entry/editor.js e em
 *     LiveWatch.js).
 *  2. Se a missão existe mas ainda não foi iniciada (existingProjectId
 *     null) e o projeto aberto agora não é o dela, mostra um banner
 *     dispensável ("Nova missão: X - Iniciar?"), NÃO bloqueante. Ao clicar
 *     "Iniciar", cria um projeto novo já vinculado à missão via
 *     Project.createNewProject({name, assignmentId}, ...) - ver Part 3/
 *     IO.js (createProject grava assignment_id quando presente).
 *  3. Se o projeto aberto agora já é o da missão (ou o aluno acabou de
 *     iniciar no passo 2), mostra o selo colapsado: 🎯 metCount/3, contando
 *     quantos dos 3 grupos de requisito de topo (scenes/characters/blocks)
 *     têm met:true - as 6 notas de pensamento computacional (ctScores)
 *     ficam de fora da visão do aluno neste primeiro momento (mais úteis
 *     pro professor do que pra uma criança de 6 anos decifrar).
 *  4. Atualiza chamando GET /api/assignments/my-progress a cada ~30s
 *     enquanto a aba está visível - mesmo padrão de polling condicionado a
 *     visibilitychange que TimeTracker.js já usa (mas mais simples: aqui
 *     não precisamos acumular delta, só reconsultar).
 *  5. Clicar no selo expande um popover com o detalhamento (cenas/atores/
 *     blocos, requerido vs atual). Clicar fora fecha.
 *
 * Se assignment existe, existingProjectId NÃO é null, mas o projeto aberto
 * agora é outro (aluno abriu um projeto qualquer da lobby enquanto tem uma
 * missão pendente noutro projeto) - nem banner nem selo aparecem: mostrar
 * progresso de um projeto que não está nem aberto seria confuso pra uma
 * criança, e a tela dele não deveria falar de algo que ele não está vendo.
 */

import ScratchJr from '../ScratchJr.js';
import Project from './Project.js';
import {newHTML} from '../../utils/lib.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));
const POLL_MS = 30000;

let assignment = null; // { id, projectName, requirements, nivel, turmaId, existingProjectId }
let lastProgress = null; // último payload de /my-progress (pro popover não ficar vazio ao abrir)
let bannerEl = null;
let badgeEl = null;
let popoverEl = null;
let pollTimer = null;
let dismissedThisSession = false;

function authHeader () {
    var token = window.__AUTH_TOKEN__;
    return token ? {Authorization: 'Bearer ' + token} : {};
}

function apiFetch (path, options) {
    options = options || {};
    return fetch(API_BASE_URL + path, {
        ...options,
        headers: {'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {})},
    });
}

export default class AssignmentBadge {
    static async init () {
        let res;
        try {
            res = await apiFetch('/assignments/active');
        } catch (err) {
            console.warn('[AssignmentBadge] /assignments/active falhou:', err && err.message);
            return;
        }
        if (!res.ok) {
            return; // sem turma_id compatível no token, ou endpoint indisponível - no-op silencioso
        }
        const data = await res.json().catch(function () {
            return {};
        });
        if (!data || !data.assignment) {
            return;
        }
        assignment = data.assignment;

        const isCurrentProject = !!assignment.existingProjectId &&
            String(ScratchJr.currentProject) === String(assignment.existingProjectId);

        if (isCurrentProject) {
            AssignmentBadge._showBadge();
        } else if (!assignment.existingProjectId) {
            AssignmentBadge._showStartBanner();
        }
        // else: missão já iniciada só que NOUTRO projeto, e o aluno está
        // olhando pra este agora - fica em silêncio (ver comentário no topo do arquivo).
    }

    static _showStartBanner () {
        if (dismissedThisSession || bannerEl) {
            return;
        }
        bannerEl = newHTML('div', 'assignmentStartBanner', document.body);
        const text = newHTML('span', 'assignmentStartText', bannerEl);
        text.textContent = '🎯 Nova missão: ' + assignment.projectName + ' — Iniciar?';
        const startBtn = newHTML('button', 'assignmentStartBtn', bannerEl);
        startBtn.type = 'button';
        startBtn.textContent = 'Iniciar';
        startBtn.onclick = AssignmentBadge._startMission;
        const closeBtn = newHTML('button', 'assignmentStartClose', bannerEl);
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Dispensar');
        closeBtn.onclick = AssignmentBadge._dismissBanner;
    }

    static _dismissBanner () {
        // Só esconde pra esta sessão de aba - não persiste nada durável
        // (pedido explícito da spec pra este primeiro passe).
        dismissedThisSession = true;
        AssignmentBadge._hideBanner();
    }

    static _hideBanner () {
        if (bannerEl && bannerEl.parentNode) {
            bannerEl.parentNode.removeChild(bannerEl);
        }
        bannerEl = null;
    }

    static _startMission () {
        if (!assignment) {
            return;
        }
        AssignmentBadge._hideBanner();
        Project.createNewProject({
            name: assignment.projectName,
            assignmentId: assignment.id,
        }, function (md5) {
            assignment.existingProjectId = md5;
            AssignmentBadge._showBadge();
        });
    }

    static _showBadge () {
        if (badgeEl) {
            return;
        }
        badgeEl = newHTML('div', 'assignmentBadge', document.body);
        badgeEl.setAttribute('role', 'button');
        badgeEl.tabIndex = 0;
        badgeEl.textContent = '🎯 …';
        badgeEl.onclick = AssignmentBadge._toggleExpanded;
        AssignmentBadge._refreshProgress();
        pollTimer = window.setInterval(function () {
            if (document.visibilityState === 'visible') {
                AssignmentBadge._refreshProgress();
            }
        }, POLL_MS);
    }

    static async _refreshProgress () {
        let res;
        try {
            res = await apiFetch('/assignments/my-progress');
        } catch (err) {
            return; // best-effort - próximo tick tenta de novo
        }
        if (!res.ok) {
            return;
        }
        const data = await res.json().catch(function () {
            return {};
        });
        if (!data || !data.hasAssignment) {
            return;
        }
        lastProgress = data;
        const groups = [data.scenes, data.characters, data.blocks];
        const met = groups.filter(function (g) {
            return g && g.met;
        }).length;
        if (badgeEl) {
            badgeEl.textContent = '🎯 ' + met + '/' + groups.length;
        }
        if (popoverEl) {
            AssignmentBadge._renderPopover(data);
        }
    }

    static _toggleExpanded () {
        if (popoverEl) {
            AssignmentBadge._closePopover();
        } else {
            AssignmentBadge._openPopover();
        }
    }

    static _openPopover () {
        popoverEl = newHTML('div', 'assignmentPopover', document.body);
        if (lastProgress) {
            AssignmentBadge._renderPopover(lastProgress);
        } else {
            popoverEl.textContent = 'Carregando...';
        }
        // Registra o listener de "clicar fora fecha" só no próximo tick -
        // senão o próprio clique que ABRIU o popover (que já borbulhou até
        // aqui) seria capturado de novo e fecharia na hora.
        window.setTimeout(function () {
            document.addEventListener('mousedown', AssignmentBadge._onOutsideClick);
        }, 0);
    }

    static _closePopover () {
        document.removeEventListener('mousedown', AssignmentBadge._onOutsideClick);
        if (popoverEl && popoverEl.parentNode) {
            popoverEl.parentNode.removeChild(popoverEl);
        }
        popoverEl = null;
    }

    static _onOutsideClick (e) {
        if (!popoverEl) {
            return;
        }
        if (popoverEl.contains(e.target) || e.target === badgeEl) {
            return;
        }
        AssignmentBadge._closePopover();
    }

    static _renderPopover (data) {
        popoverEl.innerHTML = '';
        const title = newHTML('div', 'assignmentPopoverTitle', popoverEl);
        title.textContent = data.projectName || 'Missão';
        AssignmentBadge._renderRow(popoverEl, '🎬 Cenas', data.scenes);
        AssignmentBadge._renderRow(popoverEl, '🧑 Personagens', data.characters);
        AssignmentBadge._renderRow(popoverEl, '🧩 Blocos', data.blocks);
    }

    static _renderRow (parent, label, group) {
        if (!group) {
            return;
        }
        const row = newHTML('div', 'assignmentPopoverRow' + (group.met ? ' met' : ''), parent);
        const name = newHTML('span', 'assignmentPopoverLabel', row);
        name.textContent = label;
        const val = newHTML('span', 'assignmentPopoverValue', row);
        val.textContent = group.actual + '/' + group.required + (group.met ? ' ✓' : '');
    }
}
