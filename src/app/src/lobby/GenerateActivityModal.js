/**
 * src/app/src/lobby/GenerateActivityModal.js
 *
 * Botão flutuante "🤖 Gerar atividade com IA" na lobby (só pra professor -
 * mesmo peek inseguro de claims.role já usado em AssignmentAuthorBar.js,
 * reimplementado aqui em vez de importado de lá pra não criar uma dependência
 * cruzada entre editor/ui e lobby por causa de duas linhas). Fluxo:
 *
 *  1. Clique no botão → _showThemePrompt(): overlay pedindo o tema (texto
 *     livre, ex.: "A lenda do Saci Pererê") e o NÍVEL (1º/2º/3º ano - ajusta
 *     a complexidade da atividade gerada, ver LEVEL_PROFILES em
 *     activityProjectBuilder.js). Nível pré-selecionado a partir do
 *     `nivel`/grade das claims do professor (mesmo peek inseguro), quando
 *     der pra decodificar - sempre editável, nunca travado.
 *  2. "Gerar atividade" → POST /api/assignments/generate-from-theme -
 *     SÍNCRONO (sem callback/polling, ao contrário do endpoint da HelloYotta
 *     em routes/share.js - aqui tem um professor de verdade esperando na
 *     tela, então um spinner simples basta). Pode levar ~10-30s (uma
 *     chamada de LLM) - ver docblock da rota em routes/assignments.js pro
 *     motivo de não gerar dicas aqui também.
 *  3. Sucesso → _showResult(): mostra a descrição gerada (e o aviso de asset
 *     aproximado, se houver) e um botão "Abrir no editor", que navega pro
 *     projeto recém-criado - mesma URL (/editor.html?pmd5=...) que
 *     Home.gotoEditor já usa (mais teacherMode=author, pra mostrar o botão
 *     "Cadastrar aula" - é dele que saem as dicas e a aprovação), duplicada aqui de propósito (ver nota acima
 *     sobre não importar Home.js) em vez de importada.
 *
 * Reaproveita as classes .assignmentHintsOverlay/.assignmentHintsCard/
 * .assignmentHintsTitle/.assignmentHintsSubtitle/.assignmentContextTextarea/
 * .assignmentHintsFooter/.assignmentHintsSkipBtn/.assignmentHintsSaveBtn de
 * css/assignment.css (mesma folha de estilo da tela de revisão de dicas do
 * professor) - só o botão flutuante em si usa .assignmentAuthorBtn. Nenhuma
 * classe nova precisou ser criada.
 */

import { newHTML } from '../utils/lib.js';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

let btnEl = null;
let busy = false;

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

/**
 * Mesmo peek inseguro (não verifica assinatura) já usado em
 * AssignmentAuthorBar.js#decodeJwtPayloadUnsafe - só pra ler `role` das
 * claims e decidir se mostra o botão, nunca pra uma decisão de segurança (a
 * checagem de verdade é o req.role === 'professor' no backend).
 */
function decodeJwtPayloadUnsafe (token) {
    try {
        if (!token || typeof token !== 'string') return null;
        var parts = token.split('.');
        if (parts.length < 2) return null;
        var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        var padded = b64 + '='.repeat((4 - (b64.length % 4 || 4)) % 4);
        var json = decodeURIComponent(window.atob(padded).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(json);
    } catch (err) {
        return null;
    }
}

/**
 * Melhor palpite de nível (1/2/3) a partir do `nivel`/grade das claims do
 * professor (mesmo campo que identity.js#getNivelFromClaims lê no backend -
 * "1", "1º Ano", etc., formato não garantido). Só um DEFAULT pro dropdown -
 * o professor sempre pode trocar antes de gerar; token mock/indecodificável
 * ou claim ausente cai no nível 2 (meio-termo), nunca trava a tela.
 */
function guessDefaultLevel () {
    var token = window.__AUTH_TOKEN__;
    var looksLikeJwt = typeof token === 'string' && token.split('.').length >= 3;
    if (!looksLikeJwt) return 2;
    var claims = decodeJwtPayloadUnsafe(token);
    var raw = claims && (claims.nivel || claims.grade || claims.gradeLevel);
    if (!raw) return 2;
    var match = String(raw).match(/[123]/);
    return match ? parseInt(match[0], 10) : 2;
}

/**
 * Mesma navegação de Home.js#gotoEditor - duplicada aqui de propósito (ver
 * docblock do topo) - com UMA diferença: inclui teacherMode=author. Sem
 * isso o projeto gerado abre como um projeto comum, o botão "Cadastrar aula"
 * (AssignmentAuthorBar.init) nunca aparece (ele só existe com teacherMode=author
 * ou quando o projeto já é o molde de uma missão, e este acabou de ser
 * criado) e o professor não tem como registrar a missão, gerar as dicas nem
 * passar pela tela de aprovação. Com pmd5 já definido, entry/editor.js NÃO
 * cria um projeto novo (hasProjectAlready) - só reabre este.
 */
function gotoEditor (projectId) {
    var tok = '';
    try { tok = window.__AUTH_TOKEN__ || sessionStorage.getItem('scratchjr_auth_token') || ''; } catch (err) { /* noop */ }
    window.location.href = '/editor.html?pmd5=' + projectId + '&mode=edit&teacherMode=author' +
        (tok ? '&token=' + encodeURIComponent(tok) : '');
}

function closeOverlay (overlayEl) {
    if (overlayEl && overlayEl.parentNode) {
        overlayEl.parentNode.removeChild(overlayEl);
    }
}

export default class GenerateActivityModal {
    static init () {
        var token = window.__AUTH_TOKEN__;
        // Token mock de dev (dev-teacher-a/dev-user-a) não é um JWT - não tem
        // ponto nenhum pra separar header.payload.signature, então
        // decodeJwtPayloadUnsafe sempre devolve null pra ele. Só esconde o
        // botão quando CONSEGUIMOS decodificar um JWT de verdade e ele diz
        // explicitamente que não é professor - um token mock (indecodificável)
        // cai no "mostra por padrão" (ambiente de dev, sem HelloYotta real
        // emitindo JWT). Nunca é uma fronteira de segurança de qualquer jeito -
        // POST /assignments/generate-from-theme já rejeita com 403 quem não
        // for professor de verdade no backend.
        var looksLikeJwt = typeof token === 'string' && token.split('.').length >= 3;
        if (looksLikeJwt) {
            var claims = decodeJwtPayloadUnsafe(token);
            if (!claims || claims.role !== 'professor') {
                return;
            }
        }
        if (btnEl) return;
        btnEl = newHTML('button', 'assignmentAuthorBtn', document.body);
        btnEl.type = 'button';
        btnEl.textContent = '🤖 Gerar atividade com IA';
        btnEl.onclick = GenerateActivityModal._showThemePrompt;
    }

    static _showThemePrompt () {
        if (busy || document.querySelector('.assignmentHintsOverlay')) return;

        var overlayEl = newHTML('div', 'assignmentHintsOverlay', document.body);
        var card = newHTML('div', 'assignmentHintsCard', overlayEl);
        var title = newHTML('div', 'assignmentHintsTitle', card);
        title.textContent = '🤖 Gerar atividade com IA';
        var subtitle = newHTML('div', 'assignmentHintsSubtitle', card);
        subtitle.textContent = 'Descreva o tema da atividade (ex.: "A lenda do Saci Pererê") - a IA monta um projeto novo com cenas, personagens e blocos prontos pra você revisar.';
        var textarea = newHTML('textarea', 'assignmentContextTextarea', card);
        textarea.maxLength = 200;
        textarea.placeholder = 'Ex.: A lenda do Saci Pererê';

        var levelLabelEl = newHTML('div', 'assignmentHintWhen', card);
        levelLabelEl.textContent = 'Nível de complexidade (ajusta cenas, personagens, blocos e gatilhos):';
        var selectedLevel = guessDefaultLevel();
        var levelRow = newHTML('div', 'assignmentHintActions', card);
        var levelButtons = [];
        var levelLabels = {1: 'Nível 1 (1º ano)', 2: 'Nível 2 (2º ano)', 3: 'Nível 3 (3º ano)'};
        [1, 2, 3].forEach(function (lvl) {
            var btn = newHTML('button', 'assignmentHintApproveBtn', levelRow);
            btn.type = 'button';
            btn.textContent = levelLabels[lvl];
            btn.classList.toggle('selected', lvl === selectedLevel);
            btn.onclick = function () {
                selectedLevel = lvl;
                levelButtons.forEach(function (b, i) {
                    b.classList.toggle('selected', (i + 1) === lvl);
                });
            };
            levelButtons.push(btn);
        });

        var footer = newHTML('div', 'assignmentHintsFooter', card);
        var cancelBtn = newHTML('button', 'assignmentHintsSkipBtn', footer);
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancelar';
        var goBtn = newHTML('button', 'assignmentHintsSaveBtn', footer);
        goBtn.type = 'button';
        goBtn.textContent = 'Gerar atividade';

        cancelBtn.onclick = function () {
            closeOverlay(overlayEl);
        };
        goBtn.onclick = function () {
            var theme = textarea.value.trim();
            if (!theme) {
                window.alert('Escreva um tema antes de gerar.');
                return;
            }
            closeOverlay(overlayEl);
            GenerateActivityModal._generate(theme, selectedLevel);
        };

        window.setTimeout(function () { textarea.focus(); }, 50);
    }

    static _generate (theme, level) {
        busy = true;
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.textContent = 'Gerando atividade com IA... ⏳';
        }

        apiFetch('/assignments/generate-from-theme', {
            method: 'POST',
            body: JSON.stringify({theme: theme, level: level}),
        }).then(function (res) {
            return res.json().catch(function () {
                return {};
            }).then(function (body) {
                return {ok: res.ok, body: body};
            });
        }).then(function (result) {
            busy = false;
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = '🤖 Gerar atividade com IA';
            }
            if (result.ok && result.body && result.body.success) {
                GenerateActivityModal._showResult(result.body);
            } else {
                window.alert((result.body && result.body.error) || 'Não foi possível gerar a atividade agora.');
            }
        }).catch(function (err) {
            busy = false;
            console.error('[GenerateActivityModal] generate error:', err);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.textContent = '🤖 Gerar atividade com IA';
            }
            window.alert('Não foi possível gerar a atividade agora.');
        });
    }

    /**
     * @param {{projectId: number, projectName: string, description: string,
     *   assetGapNote: string|null, level: number, levelLabel: string}} data
     */
    static _showResult (data) {
        var overlayEl = newHTML('div', 'assignmentHintsOverlay', document.body);
        var card = newHTML('div', 'assignmentHintsCard', overlayEl);
        var title = newHTML('div', 'assignmentHintsTitle', card);
        title.textContent = '✅ ' + (data.projectName || 'Atividade gerada!');
        if (data.levelLabel) {
            var levelTag = newHTML('div', 'assignmentHintWhen', card);
            levelTag.textContent = data.levelLabel;
        }
        var subtitle = newHTML('div', 'assignmentHintsSubtitle', card);
        subtitle.textContent = data.description || 'Atividade pronta pra você revisar no editor.';

        if (data.assetGapNote) {
            var gapNote = newHTML('div', 'assignmentHintsSubtitle', card);
            gapNote.textContent = '⚠️ ' + data.assetGapNote;
        }

        var footer = newHTML('div', 'assignmentHintsFooter', card);
        var closeBtn = newHTML('button', 'assignmentHintsSkipBtn', footer);
        closeBtn.type = 'button';
        closeBtn.textContent = 'Fechar';
        var openBtn = newHTML('button', 'assignmentHintsSaveBtn', footer);
        openBtn.type = 'button';
        openBtn.textContent = 'Abrir no editor';

        closeBtn.onclick = function () {
            closeOverlay(overlayEl);
        };
        openBtn.onclick = function () {
            gotoEditor(data.projectId);
        };
    }
}
