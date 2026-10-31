/**
 * src/app/src/lobby/MissionsMenu.js
 *
 * Botão "Missões" no topbar do Home/Lobby (home.html) + painel flutuante
 * com o HISTÓRICO INTEIRO de missões já atribuídas à turma do aluno (não só
 * a ativa - ver GET /api/assignments/mine em routes/assignments.js), cada
 * uma com borda/selo verde + ✓ se este aluno já concluiu, ou cinza se ainda
 * não (iniciada ou nem isso). Mesmo estilo de cliente HTTP (apiFetch/
 * authHeader) e resolução de API_BASE_URL de AssignmentNotice.js/
 * AssignmentBadge.js, pra manter um único padrão nesta feature.
 *
 * Chamado de Home.init(), depois de AssignmentNotice.init() - mesma
 * filosofia de no-op silencioso: sem turma_id compatível no token (a
 * maioria dos alunos fora do contexto HelloYotta) ou sem nenhuma missão
 * ainda registrada pra turma, o botão simplesmente nunca sai do `hidden`
 * inicial do HTML.
 *
 * Clicar numa missão da lista navega pro editor:
 *  - já iniciada (projectId presente) -> pmd5=<projectId>, mesmo padrão de
 *    Home.gotoEditor (reabre o projeto existente, nunca duplica);
 *  - ainda não iniciada -> assignmentId=<id>&projectName=<nome>, mesmo
 *    padrão de AssignmentNotice#_gotoEditorForMission (entry/editor.js
 *    pré-cria o projeto da missão antes do appinit(), isento do limite
 *    diário - ver docblock lá).
 */

import {gn, newHTML} from '../utils/lib.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

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

let panelEl = null;
let backdropEl = null;

export default class MissionsMenu {
    static async init () {
        let res;
        try {
            res = await apiFetch('/assignments/mine');
        } catch (err) {
            console.warn('[MissionsMenu] /assignments/mine falhou:', err && err.message);
            return;
        }
        if (!res.ok) {
            return; // sem turma_id compatível, ou endpoint indisponível - no-op silencioso
        }
        const data = await res.json().catch(function () {
            return {};
        });
        const missions = Array.isArray(data && data.missions) ? data.missions : [];
        if (!missions.length) {
            return; // turma sem nenhuma missão registrada ainda - botão fica escondido
        }

        const tab = gn('missionsTab');
        if (!tab) {
            return;
        }
        tab.classList.remove('hidden');
        tab.onclick = function () {
            if (panelEl) {
                MissionsMenu._closePanel();
            } else {
                MissionsMenu._openPanel(missions);
            }
        };
    }

    static _openPanel (missions) {
        backdropEl = newHTML('div', 'missionsPanelBackdrop', document.body);
        backdropEl.onclick = MissionsMenu._closePanel;

        panelEl = newHTML('div', 'missionsPanel', document.body);

        const titleBar = newHTML('div', 'missionsPanelTitle', panelEl);
        const titleText = newHTML('span', undefined, titleBar);
        titleText.textContent = '🏆 Missões';
        const closeBtn = newHTML('button', 'missionsPanelClose', titleBar);
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Fechar');
        closeBtn.onclick = MissionsMenu._closePanel;

        const list = newHTML('ul', 'missionsPanelList', panelEl);
        missions.forEach(function (mission) {
            const item = newHTML('li', 'missionItem' + (mission.completed ? ' completed' : ''), list);
            item.onclick = function () {
                MissionsMenu._goToMission(mission);
            };

            const check = newHTML('div', 'missionItem-check', item);
            check.textContent = mission.completed ? '✓' : '';

            const name = newHTML('div', 'missionItem-name', item);
            name.textContent = mission.projectName || 'Missão';

            const status = newHTML('div', 'missionItem-status', item);
            status.textContent = mission.completed ? 'Concluída' : (mission.started ? 'Em andamento' : 'Não iniciada');
        });
    }

    static _closePanel () {
        if (panelEl && panelEl.parentNode) {
            panelEl.parentNode.removeChild(panelEl);
        }
        if (backdropEl && backdropEl.parentNode) {
            backdropEl.parentNode.removeChild(backdropEl);
        }
        panelEl = null;
        backdropEl = null;
    }

    static _goToMission (mission) {
        var _tok = '';
        try { _tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
        var _params;
        if (mission.projectId) {
            _params = 'pmd5=' + encodeURIComponent(mission.projectId) + '&mode=edit';
        } else {
            _params = 'mode=edit&assignmentId=' + encodeURIComponent(mission.id) +
                '&projectName=' + encodeURIComponent(mission.projectName || '');
        }
        if (_tok) {
            _params += '&token=' + encodeURIComponent(_tok);
        }
        window.location.href = '/editor.html?' + _params;
    }
}
