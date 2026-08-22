/**
 * src/app/src/lobby/AssignmentNotice.js
 *
 * Sino de notificação de missão pendente (lado do ALUNO), mostrado no
 * topbar do Home/Lobby (home.html). Chamado de Home.init(), depois do
 * boot normal da lobby.
 *
 * Cobre o caso que AssignmentBadge.js (editor/ui/) NÃO cobre: o aluno
 * que ainda não iniciou a missão e está parado na lobby (fluxo padrão
 * do HelloYotta pra quem não tem projeto específico ainda - redireciona
 * pra home.html, sem parâmetros novos, igual hoje). Uma vez que a
 * missão é iniciada (existingProjectId presente), ela vira um projeto
 * comum na lista da lobby, e o selo/banner de AssignmentBadge.js já
 * assume dentro do editor - este sino para de aparecer (ver init()).
 *
 * Fetch/auth mirror EXATAMENTE AssignmentBadge.js (mesma resolução de
 * API_BASE_URL, mesmo authHeader/apiFetch) pra manter um único estilo
 * de cliente HTTP neste projeto - ver aquele arquivo pra mais contexto
 * sobre o formato de resposta de GET /assignments/active.
 *
 * O clique manda assignmentId+projectName na URL pro editor.js pré-criar
 * o projeto da missão ANTES do appinit() rodar (mesmo truque já usado por
 * teacherMode=author em entry/editor.js) - navegar pra um editor.html
 * totalmente vazio (sem esses params) deixaria o fallback genérico de
 * Project.startLoad() criar um projeto em branco SEM assignment_id, que
 * não é isento do limite diário de criação e podia estourar
 * DAILY_LIMIT_EXCEEDED pra um aluno que já tivesse criado 1 projeto no dia.
 */

import {gn} from '../utils/lib.js';

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

export default class AssignmentNotice {
    static async init () {
        let res;
        try {
            res = await apiFetch('/assignments/active');
        } catch (err) {
            console.warn('[AssignmentNotice] /assignments/active falhou:', err && err.message);
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
        const assignment = data.assignment;
        if (assignment.existingProjectId) {
            // Missão já iniciada - já aparece como projeto comum na lista
            // da lobby, e o badge/banner de AssignmentBadge.js assume
            // dentro do editor quando o aluno abrir esse projeto. Nada a
            // fazer aqui (ver docblock acima).
            return;
        }
        AssignmentNotice._showBell(assignment);
    }

    static _showBell (assignment) {
        const bell = gn('assignmentBellTab');
        if (!bell) {
            return;
        }
        bell.title = 'Você tem uma missão pendente: ' + assignment.projectName;
        bell.classList.remove('hidden');
        bell.onclick = function () {
            AssignmentNotice._gotoEditorForMission(assignment);
        };
    }

    // Navega pro editor SEM pmd5 (o projeto da missão ainda não existe),
    // mas COM assignmentId/projectName - entry/editor.js pré-cria o
    // projeto já vinculado à missão antes de appinit() rodar (ver docblock
    // no topo do arquivo). AssignmentBadge.init() então encontra
    // existingProjectId batendo com o projeto recém-criado e mostra o selo
    // direto, sem passar pelo banner "Iniciar". Mesmo padrão de
    // preservação de token usado em Home.gotoEditor/Home.performAction.
    static _gotoEditorForMission (assignment) {
        var _tok = '';
        try { _tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (_) {}
        var _params = 'mode=edit&assignmentId=' + encodeURIComponent(assignment.id) +
            '&projectName=' + encodeURIComponent(assignment.projectName || '');
        if (_tok) {
            _params += '&token=' + encodeURIComponent(_tok);
        }
        window.location.href = '/editor.html?' + _params;
    }
}
