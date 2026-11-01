/**
 * src/app/src/lobby/OfficialCatalog.js
 *
 * Botão "🏅 Catálogo" no topbar do Home/Lobby (home.html) + painel flutuante
 * com o CATÁLOGO OFICIAL inteiro (GET /api/assignments/official, ver
 * routes/assignments.js) - QUALQUER professor ou admin autenticado vê a
 * lista completa, independente de turma/roster (diferente de MissionsMenu.js,
 * que é só o histórico da PRÓPRIA turma do usuário). Mesmo estilo de
 * apiFetch/authHeader e peek inseguro de role (decodeJwtPayloadUnsafe) já
 * usado em GenerateActivityModal.js/AssignmentAuthorBar.js, pra manter um
 * único padrão nesta feature.
 *
 * Cada item mostra um selo discreto no canto direito do card:
 *  - "🏅 Oficial" sempre que a missão estiver no catálogo.
 *  - "🏅 Oficial · IA" quando, além disso, generatedByAi vier true (ver
 *    assignments.generated_by_ai/projects.created_via em supabase-setup.sql
 *    - marcado automaticamente por POST /register quando o projeto-exemplo
 *    nasceu de POST /generate-from-theme).
 *
 * Clicar no NOME da missão abre o editor já no modo de edição
 * (editor.html?editAssignmentId=<id>, ver entry/editor.js) - mas só quando
 * quem está olhando pode de fato editar (admin sempre; professor só a
 * própria missão, mesma regra de backend/src/routes/assignments.js
 * #canEditAssignment) - pra quem não pode editar, o card é só informativo
 * (sem onclick), evitando abrir o editor pra cair num 403 sem explicação.
 *
 * Botões de curadoria (admin-only, ao lado do selo): "🤖" alterna
 * generatedByAi; "✕" remove a missão do catálogo (isOfficial=false) - os
 * dois via PATCH /api/assignments/:id/official. Nenhum dos dois aparece pra
 * quem não é admin.
 *
 * [2026-10] Achado em teste real: o clique no botão abria o painel com a
 * lista que foi buscada UMA VEZ, em init() (carregamento da página) - uma
 * missão marcada oficial DEPOIS disso (ex.: pelo selo "🏅" direto no card do
 * projeto, ver lobby/Home.js) nunca aparecia até recarregar a página
 * inteira. Agora init() só decide se MOSTRA o botão (usa a 1ª busca pra
 * isso, sem round-trip extra no carregamento); cada clique busca a lista de
 * novo (_fetchMissions), então o painel sempre reflete o estado atual.
 */

import {gn, newHTML} from '../utils/lib.js';
import {decodeJwtPayloadUnsafe} from '../utils/jwtUnsafe.js';

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
let currentRole = null;
let currentUserId = null;

export default class OfficialCatalog {
    static async init () {
        var claims = decodeJwtPayloadUnsafe(window.__AUTH_TOKEN__);
        if (!claims || (claims.role !== 'professor' && claims.role !== 'admin')) {
            return; // igual GenerateActivityModal.js - some pra quem não é professor/admin
        }
        currentRole = claims.role;
        currentUserId = claims.user_id || claims.sub || claims.id_usuario || null;

        const missions = await OfficialCatalog._fetchMissions();
        if (missions === null) {
            return; // endpoint indisponível, ou token rejeitado - no-op silencioso
        }
        if (!missions.length) {
            return; // catálogo vazio - botão fica escondido, mesmo espírito de MissionsMenu.js
        }

        const tab = gn('officialCatalogTab');
        if (!tab) {
            return;
        }
        tab.classList.remove('hidden');
        tab.onclick = function () {
            if (panelEl) {
                OfficialCatalog._closePanel();
                return;
            }
            // Busca de novo a cada clique (nunca reusa a lista de init()) -
            // ver docblock do topo do arquivo pro porquê.
            OfficialCatalog._fetchMissions().then(function (fresh) {
                OfficialCatalog._openPanel(fresh || []);
            });
        };
        OfficialCatalog._keepClearOfMissionsTab(tab);
    }

    /**
     * Devolve o array de missões oficiais (fresco, sempre busca de novo) ou
     * `null` se a chamada falhou/foi rejeitada - nunca lança.
     */
    static async _fetchMissions () {
        let res;
        try {
            res = await apiFetch('/assignments/official');
        } catch (err) {
            console.warn('[OfficialCatalog] /assignments/official falhou:', err && err.message);
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
     * Achado em teste real: os dois botões (.missionsTab e .officialCatalogTab)
     * ficavam colados/sobrepostos - os dois usam `right` fixo crescendo pra
     * ESQUERDA (CSS, ver missions.css), e a largura de cada um depende do
     * texto renderizado, que não dá pra prever em CSS puro sem arriscar
     * estourar de novo com qualquer mudança de fonte/idioma/texto. Mede a
     * posição REAL do .missionsTab (se/quando ele existir - MissionsMenu.js
     * é assíncrono e pode terminar antes OU depois deste init) e empurra
     * .officialCatalogTab pra a esquerda dele com um respiro fixo em px -
     * nunca mais depende de adivinhar larguras.
     */
    static _keepClearOfMissionsTab (tab) {
        var GAP_PX = 10;
        function reposition () {
            var missionsTab = gn('missionsTab');
            if (!missionsTab || missionsTab.classList.contains('hidden')) {
                tab.style.right = ''; // volta pro valor do CSS (missions.css)
                return;
            }
            var rect = missionsTab.getBoundingClientRect();
            tab.style.right = (window.innerWidth - rect.left + GAP_PX) + 'px';
        }
        reposition();
        // .missionsTab pode sair de `hidden` DEPOIS deste momento (seu
        // próprio fetch é assíncrono, independente deste) - observa a
        // mudança de classe pra reposicionar assim que isso acontecer.
        var missionsTab = gn('missionsTab');
        if (missionsTab && window.MutationObserver) {
            new MutationObserver(reposition).observe(missionsTab, {attributes: true, attributeFilter: ['class']});
        }
        window.addEventListener('resize', reposition);
    }

    static _canEdit (mission) {
        return currentRole === 'admin' || (!!currentUserId && mission.teacherId === currentUserId);
    }

    static _openPanel (missions) {
        backdropEl = newHTML('div', 'missionsPanelBackdrop', document.body);
        backdropEl.onclick = OfficialCatalog._closePanel;

        panelEl = newHTML('div', 'missionsPanel officialCatalogPanel', document.body);

        const titleBar = newHTML('div', 'missionsPanelTitle', panelEl);
        const titleText = newHTML('span', undefined, titleBar);
        titleText.textContent = '🏅 Catálogo oficial';
        const closeBtn = newHTML('button', 'missionsPanelClose', titleBar);
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', 'Fechar');
        closeBtn.onclick = OfficialCatalog._closePanel;

        const list = newHTML('ul', 'missionsPanelList', panelEl);
        missions.forEach(function (mission) {
            const editable = OfficialCatalog._canEdit(mission);
            const item = newHTML('li', 'missionItem officialItem' + (editable ? ' editable' : ''), list);
            if (editable) {
                item.onclick = function (e) {
                    // Não navega se o clique foi num botão de curadoria
                    // (toggleAiBtn/removeBtn) - eles já param a propagação
                    // sozinhos (ver abaixo), isto é só uma segunda trava.
                    if (e.target.closest('.officialItemAction')) {
                        return;
                    }
                    OfficialCatalog._goToMission(mission);
                };
            }

            const name = newHTML('div', 'missionItem-name', item);
            name.textContent = mission.name || 'Missão';

            const badgeWrap = newHTML('div', 'officialItemBadges', item);
            const badge = newHTML('span', 'officialBadge', badgeWrap);
            badge.textContent = mission.generatedByAi ? '🏅 Oficial · IA' : '🏅 Oficial';

            if (currentRole === 'admin') {
                const aiBtn = newHTML('button', 'officialItemAction officialItemAiBtn', badgeWrap);
                aiBtn.type = 'button';
                aiBtn.title = mission.generatedByAi ? 'Desmarcar como feito com IA' : 'Marcar como feito com IA';
                aiBtn.textContent = '🤖';
                aiBtn.classList.toggle('active', !!mission.generatedByAi);
                aiBtn.onclick = function (e) {
                    e.stopPropagation();
                    OfficialCatalog._toggleAi(mission, badge, aiBtn);
                };

                const removeBtn = newHTML('button', 'officialItemAction officialItemRemoveBtn', badgeWrap);
                removeBtn.type = 'button';
                removeBtn.title = 'Remover do catálogo oficial';
                removeBtn.textContent = '✕';
                removeBtn.onclick = function (e) {
                    e.stopPropagation();
                    OfficialCatalog._removeFromCatalog(mission, item);
                };
            }
        });
    }

    static _toggleAi (mission, badgeEl, btnEl) {
        const next = !mission.generatedByAi;
        btnEl.disabled = true;
        apiFetch('/assignments/' + encodeURIComponent(mission.id) + '/official', {
            method: 'PATCH',
            body: JSON.stringify({generatedByAi: next}),
        }).then(function (res) {
            btnEl.disabled = false;
            if (!res.ok) {
                window.alert('Não foi possível atualizar o selo de IA agora.');
                return;
            }
            mission.generatedByAi = next;
            badgeEl.textContent = next ? '🏅 Oficial · IA' : '🏅 Oficial';
            btnEl.classList.toggle('active', next);
            btnEl.title = next ? 'Desmarcar como feito com IA' : 'Marcar como feito com IA';
        }).catch(function () {
            btnEl.disabled = false;
            window.alert('Não foi possível atualizar o selo de IA agora.');
        });
    }

    static _removeFromCatalog (mission, itemEl) {
        if (!window.confirm('Remover "' + (mission.name || 'esta missão') + '" do catálogo oficial?')) {
            return;
        }
        apiFetch('/assignments/' + encodeURIComponent(mission.id) + '/official', {
            method: 'PATCH',
            body: JSON.stringify({isOfficial: false}),
        }).then(function (res) {
            if (!res.ok) {
                window.alert('Não foi possível remover a missão do catálogo agora.');
                return;
            }
            if (itemEl.parentNode) {
                itemEl.parentNode.removeChild(itemEl);
            }
        }).catch(function () {
            window.alert('Não foi possível remover a missão do catálogo agora.');
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
        var _params = 'editAssignmentId=' + encodeURIComponent(mission.id);
        if (_tok) {
            _params += '&token=' + encodeURIComponent(_tok);
        }
        window.location.href = '/editor.html?' + _params;
    }
}
