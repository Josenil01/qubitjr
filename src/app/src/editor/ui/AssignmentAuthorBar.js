/**
 * src/app/src/editor/ui/AssignmentAuthorBar.js
 *
 * Botão flutuante "Cadastrar aula" - existe em dois contextos (ver init()):
 * (1) quando o professor abre o editor em modo autor: editor.html?token=...
 * &teacherMode=author&projectName=Sistema+Solar (URL construída pela
 * HelloYotta, lançamento original de uma missão nova) - ver entry/editor.js
 * (editorMain) pro fluxo que cria um projeto novo em branco ANTES de
 * ScratchJr.appinit() rodar nesse modo; (2) quando o professor reabre um
 * projeto que JÁ é o molde de uma missão sua pela lobby normal (sem esse
 * parâmetro - Home.gotoEditor nunca inclui teacherMode=author, achado em
 * teste real), via GET /assignments/by-project/:id (_checkExistingMission).
 * Este módulo só cuida do botão e do registro da missão, não da criação do
 * projeto (isso é entry/editor.js, só no caso (1)).
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
 *     flutuante fora do palco. Na sequência, _showContextPrompt() pede um
 *     contexto opcional (texto livre, salvo em assignments.hint_context,
 *     pré-preenchido da última vez) antes de _runHintFlow() gerar as
 *     dicas - ver docblocks daquelas duas.
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
// Contexto livre (assignments.hint_context) da última vez que o professor
// escreveu um pra esta missão - preenchido por _checkExistingMission() (ver
// GET /assignments/by-project/:id) quando reabrindo um molde já existente;
// fica '' pra uma missão nova (teacherMode=author, ainda sem hint_context
// nenhum salvo). Pré-preenche a caixa de _showContextPrompt.
let cachedHintContext = '';

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
 * Rótulos amigáveis (PT-BR) pra when.type de cada dica gerada - o professor
 * vê isso ao lado do texto da dica na tela de revisão, pra entender quando
 * ela vai aparecer pro aluno, sem precisar decifrar o JSON cru devolvido
 * por POST /assignments/:id/generate-hints. Tipo desconhecido/futuro cai no
 * fallback genérico em vez de quebrar a tela de revisão.
 */
const HINT_WHEN_LABELS = {
    scene_missing: '🎬 aparece quando faltar essa cena',
    character_missing: '🧑 aparece quando esse personagem não existir ainda',
    character_no_script: '📝 aparece quando esse personagem não tiver nenhum script',
    character_missing_block_type: '🧩 aparece quando faltar esse tipo de bloco',
    message_not_received: '✉️ aparece quando a mensagem não for recebida por ninguém',
    default_character_present: '🧹 aparece quando o personagem default (Ruby) ainda estiver na cena',
};

function hintWhenLabel (when) {
    var type = when && when.type;
    return HINT_WHEN_LABELS[type] || '💡 dica geral';
}

export default class AssignmentAuthorBar {
    /**
     * Dois jeitos de chegar no botão "Cadastrar aula":
     *  1. Lançamento original da HelloYotta (URL com teacherMode=author) -
     *     mostra na hora, sem round-trip nenhum.
     *  2. Reabertura normal de um projeto pela lobby (Home.gotoEditor nunca
     *     inclui teacherMode=author - achado em teste real) - só sabe se
     *     este projeto é o molde de uma missão própria perguntando ao
     *     servidor (_checkExistingMission), então tem uma pequena latência
     *     assíncrona antes do botão aparecer, se aparecer.
     */
    static init () {
        if (getUrlVars().teacherMode === 'author') {
            AssignmentAuthorBar._show();
            return;
        }
        AssignmentAuthorBar._checkExistingMission();
    }

    /**
     * Só vale a pena perguntar ao servidor se o token é de professor (role
     * vem das claims, mesmo peek inseguro de decodeJwtPayloadUnsafe já usado
     * acima pra authorId) - evita uma chamada de rede desperdiçada pro caso
     * de longe mais comum (aluno abrindo o próprio projeto de missão, que
     * também tem assignment_id setado mas não é dele autorar). A checagem
     * de verdade (teacher_id da missão bate com quem está chamando) continua
     * sendo feita no servidor (GET /assignments/by-project/:id) - este
     * filtro client-side é só uma otimização, nunca uma fronteira de segurança.
     */
    static _checkExistingMission () {
        if (barEl || !ScratchJr.currentProject) {
            return;
        }
        var claims = decodeJwtPayloadUnsafe(window.__AUTH_TOKEN__);
        if (!claims || claims.role !== 'professor') {
            return;
        }
        apiFetch('/assignments/by-project/' + encodeURIComponent(ScratchJr.currentProject))
            .then(function (res) {
                return res.ok ? res.json() : null;
            })
            .then(function (data) {
                if (data && data.assignment) {
                    cachedHintContext = data.assignment.hintContext || '';
                    AssignmentAuthorBar._show();
                }
            })
            .catch(function () {}); // best-effort - nunca quebra o boot do editor
    }

    static _show () {
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
                var assignmentId = result.body.assignmentId;

                if (canReturn) {
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
                    // Dois passos extras entre a confirmação acima e o fim do
                    // fluxo - contexto opcional (_showContextPrompt) e depois
                    // as dicas geradas por IA (_runHintFlow). O
                    // redirecionamento pro returnUrl (ou reset do botão, se
                    // não houver returnUrl) continua acontecendo sempre, só
                    // que agora dentro de _finish(), chamado ao final dos dois
                    // passos - o destino final não muda, só adia por alguns
                    // segundos pra dar chance de revisão.
                    AssignmentAuthorBar._showContextPrompt(assignmentId, canReturn, returnUrl);
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

    /**
     * Passo extra entre "aula cadastrada" e a geração de dicas em si
     * (_runHintFlow): caixa de texto opcional pro professor descrever em
     * poucas palavras do que se trata a atividade ("uma história sobre o
     * folclore brasileiro, cada cena numa casa diferente...") - vira
     * `hintContext`, incluído no corpo de POST /generate-hints e usado como
     * contexto extra pra LLM (ver docblock de hintsGeneration.js). Pré-
     * preenchida com o que o professor escreveu da última vez (ver
     * cachedHintContext/_checkExistingMission), editável antes de gerar de
     * novo. "Pular" segue com contexto vazio - a geração de dicas continua
     * acontecendo normalmente, só sem esse extra (nunca é obrigatório
     * escrever nada aqui). Mesma guarda contra empilhar tela repetida que
     * _showHintReview já usa (professor clicando "Cadastrar aula" mais de
     * uma vez antes de fechar a anterior).
     */
    static _showContextPrompt (assignmentId, canReturn, returnUrl) {
        var proceed = function (hintContext) {
            AssignmentAuthorBar._runHintFlow(assignmentId, canReturn, returnUrl, hintContext);
        };
        if (document.querySelector('.assignmentHintsOverlay')) {
            proceed('');
            return;
        }

        var overlayEl = newHTML('div', 'assignmentHintsOverlay', document.body);
        var card = newHTML('div', 'assignmentHintsCard', overlayEl);
        var title = newHTML('div', 'assignmentHintsTitle', card);
        title.textContent = '📝 Sobre o que é esta atividade?';
        var subtitle = newHTML('div', 'assignmentHintsSubtitle', card);
        subtitle.textContent = 'Opcional - ajuda a IA a gerar dicas melhores. Fica salvo pra próxima vez que você reautorar esta missão.';
        var textarea = newHTML('textarea', 'assignmentContextTextarea', card);
        textarea.maxLength = 1000;
        textarea.placeholder = 'Ex.: uma história sobre o folclore brasileiro, cada cena se passa numa casa diferente...';
        textarea.value = cachedHintContext;

        var footer = newHTML('div', 'assignmentHintsFooter', card);
        var skipBtn = newHTML('button', 'assignmentHintsSkipBtn', footer);
        skipBtn.type = 'button';
        skipBtn.textContent = 'Pular';
        var goBtn = newHTML('button', 'assignmentHintsSaveBtn', footer);
        goBtn.type = 'button';
        goBtn.textContent = 'Gerar dicas';

        var close = function () {
            if (overlayEl.parentNode) {
                overlayEl.parentNode.removeChild(overlayEl);
            }
        };
        skipBtn.onclick = function () {
            close();
            proceed('');
        };
        goBtn.onclick = function () {
            var text = textarea.value.trim();
            close();
            proceed(text);
        };
    }

    /**
     * Passo extra entre "aula cadastrada" e o fim do fluxo (redirecionamento
     * pro returnUrl, ou reset do botão): pede à IA um lote de dicas-rascunho
     * pra esta missão (POST /assignments/:id/generate-hints, com
     * `hintContext` vindo de _showContextPrompt no corpo) e, se vier alguma,
     * abre a tela de revisão (_showHintReview) pro professor aprovar ou
     * rejeitar cada uma. `finish` (definido aqui, repassado adiante) é o
     * único jeito de sair desse passo - sempre encerra chamando _finish com
     * o mesmo (canReturn, returnUrl) calculados lá em _register, então o
     * destino final do fluxo original nunca muda, só o momento em que ele
     * acontece. Qualquer falha (503 sem IA configurada, erro de rede, lote
     * vazio) cai direto em finish() - dica é extra, nunca pode travar o
     * cadastro da aula.
     */
    static _runHintFlow (assignmentId, canReturn, returnUrl, hintContext) {
        var finish = function () {
            AssignmentAuthorBar._finish(canReturn, returnUrl);
        };
        if (!assignmentId) {
            finish();
            return;
        }
        if (barEl) {
            barEl.textContent = 'Gerando dicas com IA... ⏳';
        }
        apiFetch('/assignments/' + encodeURIComponent(assignmentId) + '/generate-hints', {
            method: 'POST',
            body: JSON.stringify({hintContext: hintContext || ''}),
        }).then(function (res) {
            return res.json().catch(function () {
                return {};
            }).then(function (body) {
                return {ok: res.ok, body: body};
            });
        }).then(function (result) {
            if (!barEl) {
                finish();
                return;
            }
            barEl.textContent = IDLE_LABEL;
            if (!result.ok) {
                // 503 (IA não configurada no servidor), 404/400/500 - falha
                // silenciosa e não alarmante: reaproveita o mesmo balão do
                // Alert.js usado pra "Aula cadastrada!", só que cinza/breve,
                // e segue o fluxo normalmente sem bloquear o professor.
                Alert.open(frame, barEl, 'Não foi possível gerar dicas agora', '#999');
                window.setTimeout(function () {
                    Alert.close();
                    finish();
                }, 1500);
                return;
            }
            var hints = result.body && Array.isArray(result.body.hints) ? result.body.hints : [];
            if (!hints.length) {
                finish(); // nenhuma dica sugerida - segue direto, sem alarde
                return;
            }
            AssignmentAuthorBar._showHintReview(assignmentId, hints, finish);
        }).catch(function (err) {
            console.error('[AssignmentAuthorBar] generate-hints error:', err);
            finish();
        });
    }

    /**
     * Fim do fluxo de "Cadastrar aula" - idêntico ao comportamento original
     * (antes deste passo de dicas existir): redireciona pro returnUrl já
     * montado em _register (se ele passou em _isAllowedReturnUrl), ou volta
     * o botão flutuante pro rótulo ocioso.
     */
    static _finish (canReturn, returnUrl) {
        if (canReturn) {
            window.location.href = returnUrl;
            return; // saindo da página - não precisa restaurar o texto do botão
        }
        if (barEl) {
            barEl.textContent = IDLE_LABEL;
        }
    }

    /**
     * Tela de revisão das dicas-rascunho (overlay central, mesmo idioma
     * visual do resto da feature de missões - ver assignment.css, seção
     * "Hints review UI"). Cada dica começa neutra (nem aprovada nem
     * rejeitada) - o professor decide uma a uma clicando em ✅ Aprovar ou
     * ❌ Rejeitar (clicar de novo no mesmo botão desfaz, voltando a neutro).
     * "Concluir" salva só o subconjunto aprovado via POST
     * /assignments/:id/hints (se nada foi aprovado, nem chama o endpoint -
     * equivalente a pular). "Pular por agora" fecha sem salvar nada. Os dois
     * caminhos (e qualquer falha do POST de salvar) terminam chamando
     * `onDone` - nunca deixam o professor preso nesta tela.
     *
     * Guarda contra chamada repetida: se o professor clicar "Cadastrar
     * aula" mais de uma vez na mesma aba (ex.: durante um teste, ou um
     * clique duplo) antes de fechar a revisão anterior, sem isso cada
     * chamada empilhava mais uma tela por baixo/por cima da anterior -
     * nunca removidas, só acumulando no body.
     */
    static _showHintReview (assignmentId, hints, onDone) {
        if (document.querySelector('.assignmentHintsOverlay')) {
            onDone(); // já tem uma revisão aberta - não empilha outra
            return;
        }
        var entries = hints.map(function (hint) {
            return {hint: hint, status: null}; // null | 'approved' | 'rejected'
        });

        var overlayEl = newHTML('div', 'assignmentHintsOverlay', document.body);
        var card = newHTML('div', 'assignmentHintsCard', overlayEl);
        var title = newHTML('div', 'assignmentHintsTitle', card);
        title.textContent = '💡 Revisar dicas sugeridas';
        var subtitle = newHTML('div', 'assignmentHintsSubtitle', card);
        subtitle.textContent = 'Aprove ou rejeite cada dica antes de salvar.';
        var list = newHTML('div', 'assignmentHintsList', card);

        entries.forEach(function (entry) {
            var row = newHTML('div', 'assignmentHintRow', list);
            var textEl = newHTML('div', 'assignmentHintText', row);
            textEl.textContent = entry.hint.text;
            var whenEl = newHTML('div', 'assignmentHintWhen', row);
            whenEl.textContent = hintWhenLabel(entry.hint.when);
            var actions = newHTML('div', 'assignmentHintActions', row);
            var approveBtn = newHTML('button', 'assignmentHintApproveBtn', actions);
            approveBtn.type = 'button';
            approveBtn.textContent = '✅ Aprovar';
            var rejectBtn = newHTML('button', 'assignmentHintRejectBtn', actions);
            rejectBtn.type = 'button';
            rejectBtn.textContent = '❌ Rejeitar';

            var applyStatus = function (status) {
                entry.status = status;
                approveBtn.classList.toggle('selected', status === 'approved');
                rejectBtn.classList.toggle('selected', status === 'rejected');
            };
            approveBtn.onclick = function () {
                applyStatus(entry.status === 'approved' ? null : 'approved');
            };
            rejectBtn.onclick = function () {
                applyStatus(entry.status === 'rejected' ? null : 'rejected');
            };
        });

        var footer = newHTML('div', 'assignmentHintsFooter', card);
        var skipBtn = newHTML('button', 'assignmentHintsSkipBtn', footer);
        skipBtn.type = 'button';
        skipBtn.textContent = 'Pular por agora';
        var saveBtn = newHTML('button', 'assignmentHintsSaveBtn', footer);
        saveBtn.type = 'button';
        saveBtn.textContent = 'Concluir';

        var closeOverlay = function () {
            if (overlayEl.parentNode) {
                overlayEl.parentNode.removeChild(overlayEl);
            }
        };

        skipBtn.onclick = function () {
            closeOverlay();
            onDone();
        };

        saveBtn.onclick = function () {
            var approved = entries.filter(function (entry) {
                return entry.status === 'approved';
            }).map(function (entry) {
                return entry.hint;
            });
            if (!approved.length) {
                // Achado em produção: "Concluir" sem aprovar NENHUMA dica
                // individualmente (cada uma nasce neutra, ver docblock acima)
                // saía do fluxo em silêncio, igual a "Pular por agora" - o
                // professor lia "Concluir" como "terminei de revisar, tá tudo
                // bem" e não fazia ideia de que nada tinha sido salvo (missão
                // ficava sem nenhuma dica, sem aviso nenhum). Confirmação
                // explícita fecha essa armadilha sem contradizer a regra de
                // nunca aprovar em lote automaticamente.
                var reallySkip = window.confirm(
                    'Nenhuma dica foi aprovada - esta missão ficará SEM dicas de coaching. Continuar mesmo assim?'
                );
                if (!reallySkip) {
                    return; // professor volta pra tela de revisão pra aprovar algo
                }
                closeOverlay();
                onDone();
                return;
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            apiFetch('/assignments/' + encodeURIComponent(assignmentId) + '/hints', {
                method: 'POST',
                body: JSON.stringify({hints: approved}),
            }).catch(function (err) {
                // Best-effort: salvar dicas é um extra sobre um cadastro que
                // já teve sucesso - uma falha aqui não pode travar o professor
                // nesta tela nem reverter a aula já cadastrada.
                console.error('[AssignmentAuthorBar] save hints error:', err);
            }).then(function () {
                closeOverlay();
                onDone();
            });
        };
    }
}
