/**
 * src/app/src/lobby/MyLessons.js
 *
 * Botão "📚 Minhas aulas" no topbar do Home/Lobby (home.html) + painel
 * flutuante listando TODAS as aulas (assignments-template) que o próprio
 * professor/admin autorou, em qualquer turma, com a série (nivel) de cada
 * uma (GET /api/assignments/authored, estendido com `nivel` - ver
 * routes/assignments.js). Mesmo estilo de apiFetch/authHeader de
 * MissionsMenu.js/OfficialCatalog.js, pra manter um único padrão nesta
 * feature.
 *
 * Caso de uso real: o professor montou uma aula pro 1º ano e quer uma cópia
 * de partida pro 2º ano, sem perder/alterar a original. Cada item mostra a
 * série atual + botão "Duplicar para outra série", que abre um seletor
 * inline com as outras séries e chama POST /api/assignments/:id/duplicate
 * (ver docblock da rota em routes/assignments.js pro porquê de a cópia
 * nascer `active: false`). Depois de duplicar, oferece abrir a cópia direto
 * no editor (mesmo padrão de OfficialCatalog._goToMission).
 */

import {gn, newHTML} from '../utils/lib.js';
import {decodeJwtPayloadUnsafe} from '../utils/jwtUnsafe.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

// Mesmos rótulos de GenerateActivityModal.js (levelLabels) - mantém o
// vocabulário "Nível N (Nº ano)" consistente em toda a feature de missões.
const NIVEL_LABELS = {'1': 'Nível 1 (1º ano)', '2': 'Nível 2 (2º ano)', '3': 'Nível 3 (3º ano)'};
const ALL_NIVEIS = ['1', '2', '3'];

function nivelLabel (nivel) {
    if (!nivel) return 'Série não definida';
    return NIVEL_LABELS[String(nivel)] || ('Nível ' + nivel);
}

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

export default class MyLessons {
    static async init () {
        var claims = decodeJwtPayloadUnsafe(window.__AUTH_TOKEN__);
        if (!claims || (claims.role !== 'professor' && claims.role !== 'admin')) {
            return; // igual OfficialCatalog.js - some pra quem não é professor/admin
        }

        const missions = await MyLessons._fetchMissions();
        if (missions === null || !missions.length) {
            return; // endpoint indisponível, token rejeitado, ou ainda sem nenhuma aula autorada
        }

        const tab = gn('myLessonsTab');
        if (!tab) {
            return;
        }
        tab.classList.remove('hidden');
        tab.onclick = function () {
            if (panelEl) {
                MyLessons._closePanel();
                return;
            }
            MyLessons._fetchMissions().then(function (fresh) {
                MyLessons._openPanel(fresh || []);
            });
        };
        MyLessons._keepClearOfOtherTabs(tab);
    }

    static async _fetchMissions () {
        let res;
        try {
            res = await apiFetch('/assignments/authored');
        } catch (err) {
            console.warn('[MyLessons] /assignments/authored falhou:', err && err.message);
            return null;
        }
        if (!res.ok) {
            return null;
        }
        const data = await res.json().catch(function () {
            return {};
        });
        return Array.isArray(data && data.missions) ? data.missions : [];
    }

    /**
     * Mesma lógica de OfficialCatalog._keepClearOfMissionsTab, só que
     * encadeada: mede a posição real de .officialCatalogTab (que já se
     * posiciona à esquerda de .missionsTab) e cresce mais pra esquerda
     * ainda - os três nunca se sobrepõem, mesmo sem saber a largura
     * renderizada de nenhum dos textos de antemão.
     */
    static _keepClearOfOtherTabs (tab) {
        var GAP_PX = 10;
        function reposition () {
            var refTab = gn('officialCatalogTab');
            if (!refTab || refTab.classList.contains('hidden')) {
                refTab = gn('missionsTab');
            }
            if (!refTab || refTab.classList.contains('hidden')) {
                tab.style.right = '';
                return;
            }
            var rect = refTab.getBoundingClientRect();
            tab.style.right = (window.innerWidth - rect.left + GAP_PX) + 'px';
        }
        reposition();
        ['officialCatalogTab', 'missionsTab'].forEach(function (id) {
            var el = gn(id);
            if (el && window.MutationObserver) {
                new MutationObserver(reposition).observe(el, {attributes: true, attributeFilter: ['class', 'style']});
            }
        });
        window.addEventListener('resize', reposition);
    }

    static _openPanel (missions) {
        backdropEl = newHTML('div', 'missionsPanelBackdrop', document.body);
        backdropEl.onclick = MyLessons._closePanel;

        panelEl = newHTML('div', 'missionsPanel myLessonsPanel', document.body);

        const titleBar = newHTML('div', 'missionsPanelTitle', panelEl);
        const titleText = newHTML('span', undefined, titleBar);
        titleText.textContent = '📚 Minhas aulas';
        const closeBtn = newHTML('button', 'missionsPanelClose', titleBar);
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Fechar');
        closeBtn.onclick = MyLessons._closePanel;

        const list = newHTML('ul', 'missionsPanelList', panelEl);
        missions.forEach(function (mission) {
            MyLessons._renderItem(mission, list);
        });
    }

    static _renderItem (mission, list) {
        const item = newHTML('li', 'missionItem myLessonItem', list);

        const name = newHTML('div', 'missionItem-name', item);
        name.textContent = mission.name || 'Aula sem nome';

        const row = newHTML('div', 'myLessonItemRow', item);
        const nivelTag = newHTML('span', 'myLessonNivelTag', row);
        nivelTag.textContent = nivelLabel(mission.nivel);

        const dupBtn = newHTML('button', 'myLessonDupBtn', row);
        dupBtn.type = 'button';
        dupBtn.textContent = 'Duplicar para outra série';
        dupBtn.onclick = function () {
            MyLessons._showNivelPicker(mission, item, row, dupBtn);
        };
    }

    static _showNivelPicker (mission, item, row, dupBtn) {
        const existing = item.querySelector('.myLessonNivelPicker');
        if (existing) {
            existing.parentNode.removeChild(existing);
            return;
        }

        const picker = newHTML('div', 'myLessonNivelPicker', item);
        const options = ALL_NIVEIS.filter(function (n) {
            return String(mission.nivel || '') !== n;
        });

        options.forEach(function (n) {
            const optBtn = newHTML('button', 'myLessonNivelOption', picker);
            optBtn.type = 'button';
            optBtn.textContent = nivelLabel(n);
            optBtn.onclick = function () {
                MyLessons._duplicate(mission, n, picker, item);
            };
        });

        if (!options.length) {
            const msg = newHTML('div', 'myLessonNivelEmpty', picker);
            msg.textContent = 'Não há outra série para duplicar.';
        }
    }

    static _duplicate (mission, targetNivel, pickerEl, itemEl) {
        pickerEl.innerHTML = '';
        const loading = newHTML('div', 'myLessonNivelEmpty', pickerEl);
        loading.textContent = 'Duplicando...';

        apiFetch('/assignments/' + encodeURIComponent(mission.id) + '/duplicate', {
            method: 'POST',
            body: JSON.stringify({targetNivel: targetNivel}),
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                return {ok: res.ok, data: data};
            });
        }).then(function (result) {
            if (!result.ok) {
                pickerEl.innerHTML = '';
                const err = newHTML('div', 'myLessonNivelEmpty', pickerEl);
                err.textContent = (result.data && result.data.error) || 'Não foi possível duplicar esta aula agora.';
                return;
            }
            pickerEl.innerHTML = '';
            const done = newHTML('div', 'myLessonNivelDone', pickerEl);
            done.textContent = '✓ Copiada para ' + nivelLabel(targetNivel) + '.';
            const openBtn = newHTML('button', 'myLessonNivelOption', pickerEl);
            openBtn.type = 'button';
            openBtn.textContent = 'Abrir a cópia no editor';
            openBtn.onclick = function () {
                MyLessons._goToMission(result.data.assignmentId);
            };
        }).catch(function () {
            pickerEl.innerHTML = '';
            const err = newHTML('div', 'myLessonNivelEmpty', pickerEl);
            err.textContent = 'Não foi possível duplicar esta aula agora.';
        });
    }

    static _goToMission (assignmentId) {
        var _tok = '';
        try { _tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
        var _params = 'editAssignmentId=' + encodeURIComponent(assignmentId);
        if (_tok) {
            _params += '&token=' + encodeURIComponent(_tok);
        }
        window.location.href = '/editor.html?' + _params;
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
}
