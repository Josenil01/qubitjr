/**
 * src/app/src/editor/ui/AssignmentAuthorBar.js
 *
 * Botão flutuante "Cadastrar aula" - só existe quando o professor abre o
 * editor em modo autor: editor.html?token=...&teacherMode=author&
 * projectName=Sistema+Solar (URL construída pela HelloYotta). Ver
 * entry/editor.js (editorMain) pro fluxo que cria um projeto novo em
 * branco ANTES de ScratchJr.appinit() rodar nesse modo - este módulo só
 * cuida do botão e do registro da missão, não da criação do projeto.
 *
 * Ao clicar:
 *  1. Salva o projeto atual - ScratchJr.saveAndFlip navegaria de volta pro
 *     lobby depois de salvar, então usamos ScratchJr.saveProject direto
 *     (mesmo padrão de "salvar só, sem navegar" já usado por
 *     teacher.js:_releaseControl e LiveWatch.js:saveThenSignalReady -
 *     ambos chamam `ScratchJr.saveProject(null, fn, true)`).
 *  2. POST /api/assignments/register com { projectId: ScratchJr.currentProject }.
 *  3. Mostra confirmação reaproveitando Alert.js (mesmo balão usado pelo
 *     indicador "Saving" em Project.js) - erros usam window.alert, mesmo
 *     padrão simples já usado por teacher.js pra essa classe de UI
 *     flutuante fora do palco.
 *  4. Se a URL trouxer um `returnUrl` válido (pedido da HelloYotta, e-mail
 *     2026-08), navega de volta pra lá depois da confirmação - ver
 *     _isAllowedReturnUrl: só helloyotta.com/*.helloyotta.com, nunca um
 *     destino arbitrário (evita virar um open-redirect através do nosso
 *     domínio). Sem returnUrl ou com um valor que não passa na checagem,
 *     comportamento atual sem mudança nenhuma: fica no editor.
 *  5. Ao voltar pro returnUrl, ecoa activityId/projectName/authorId como
 *     query params (contrato confirmado com a HelloYotta) - assignmentId e
 *     projectName vêm direto do corpo da resposta de /register;
 *     authorId é o id do professor que está chamando. Não existe hoje
 *     nenhum lugar client-side que já exponha esse id (window.__AUTH_CONTEXT__
 *     só guarda studentId/classId - ver services/WebInterface.js), então
 *     decodificamos localmente o payload do próprio window.__AUTH_TOKEN__
 *     (peek inseguro, não-verificado - mesma técnica de
 *     backend/src/services/identity.js#decodeJwtPayloadUnsafe, só que aqui é
 *     só pra incluir um identificador na URL de retorno, nunca pra uma
 *     decisão de segurança).
 */

import ScratchJr from '../ScratchJr.js';
import Alert from './Alert.js';
import { newHTML, getUrlVars, frame } from '../../utils/lib.js';

const ALLOWED_RETURN_HOST = 'helloyotta.com';

function isAllowedReturnUrl (raw) {
    if (!raw) {
        return false;
    }
    var url;
    try {
        url = new URL(raw);
    } catch (err) {
        return false; // não é uma URL absoluta válida - não arrisca
    }
    if (url.protocol !== 'https:') {
        return false; // nunca redireciona pra http:/javascript:/etc
    }
    var host = url.hostname.toLowerCase();
    return host === ALLOWED_RETURN_HOST || host.endsWith('.' + ALLOWED_RETURN_HOST);
}

/**
 * Peek inseguro (não verifica assinatura) no payload de um JWT - mesma
 * técnica de backend/src/services/identity.js#decodeJwtPayloadUnsafe,
 * reimplementada aqui no navegador (sem Buffer) só pra ler o `sub` do
 * professor e incluir como authorId na URL de retorno. Nunca usar isto pra
 * qualquer decisão de segurança/autorização - é só um identificador.
 */
function decodeJwtPayloadUnsafe (token) {
    try {
        if (!token || typeof token !== 'string') {
            return null;
        }
        var parts = token.split('.');
        if (parts.length < 2) {
            return null;
        }
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
 * Id do professor autenticado, extraído das claims do próprio
 * window.__AUTH_TOKEN__ (mesmos nomes alternativos aceitos pelo backend em
 * identity.js#getUserIdFromClaims). Retorna null se não der pra determinar -
 * a chamada em _register() trata isso como "omite authorId", não como erro.
 */
function getAuthorId () {
    var claims = decodeJwtPayloadUnsafe(window.__AUTH_TOKEN__);
    if (!claims) {
        return null;
    }
    return claims.user_id || claims.sub || claims.id_usuario || null;
}

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

const IDLE_LABEL = '📋 Cadastrar aula';

let barEl = null;
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

export default class AssignmentAuthorBar {
    static init () {
        if (getUrlVars().teacherMode !== 'author') {
            return;
        }
        if (barEl) {
            return;
        } // já inicializado - evita duplicar o botão numa segunda chamada
        barEl = newHTML('button', 'assignmentAuthorBtn', document.body);
        barEl.type = 'button';
        barEl.textContent = IDLE_LABEL;
        barEl.onclick = AssignmentAuthorBar._onClick;
    }

    static _onClick () {
        if (busy || !barEl) {
            return;
        }
        busy = true;
        barEl.disabled = true;
        barEl.textContent = 'Salvando...';
        ScratchJr.saveProject(null, function () {
            AssignmentAuthorBar._register();
        }, true);
    }

    static _register () {
        barEl.textContent = 'Cadastrando...';
        apiFetch('/assignments/register', {
            method: 'POST',
            body: JSON.stringify({projectId: ScratchJr.currentProject}),
        }).then(function (res) {
            return res.json().catch(function () {
                return {};
            }).then(function (body) {
                return {ok: res.ok, body: body};
            });
        }).then(function (result) {
            busy = false;
            if (!barEl) {
                return;
            }
            barEl.disabled = false;
            if (result.ok && result.body && result.body.success) {
                var rawReturnUrl = getUrlVars().returnUrl;
                var returnUrl = rawReturnUrl ? decodeURIComponent(rawReturnUrl) : null;
                var canReturn = isAllowedReturnUrl(returnUrl);

                if (canReturn) {
                    var assignmentId = result.body.assignmentId;
                    var projectName = result.body.projectName;
                    var authorId = getAuthorId();

                    var params = 'activityId=' + encodeURIComponent(assignmentId) +
                        '&projectName=' + encodeURIComponent(projectName);
                    if (authorId) {
                        params += '&authorId=' + encodeURIComponent(authorId);
                    }
                    returnUrl += (returnUrl.indexOf('?') === -1 ? '?' : '&') + params;
                }

                barEl.textContent = '✅ Aula cadastrada!';
                Alert.open(frame, barEl, 'Aula cadastrada!', '#01bebc');
                window.setTimeout(function () {
                    Alert.close();
                    if (canReturn) {
                        window.location.href = returnUrl;
                        return; // saindo da página - não precisa restaurar o texto do botão
                    }
                    if (barEl) {
                        barEl.textContent = IDLE_LABEL;
                    }
                }, 2000);
            } else {
                barEl.textContent = IDLE_LABEL;
                window.alert((result.body && result.body.error) || 'Não foi possível cadastrar a aula.');
            }
        }).catch(function (err) {
            busy = false;
            console.error('[AssignmentAuthorBar] register error:', err);
            if (barEl) {
                barEl.disabled = false;
                barEl.textContent = IDLE_LABEL;
            }
            window.alert('Não foi possível cadastrar a aula.');
        });
    }
}
