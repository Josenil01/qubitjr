import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import Camera from '../painteditor/Camera.js';
import Record from '../editor/ui/Record.js';
import Project from '../editor/ui/Project.js';
import { initLiveWatch } from '../editor/LiveWatch.js';
import TimeTracker from '../utils/TimeTracker.js';
import { getUrlVars } from '../utils/lib.js';
import AssignmentAuthorBar from '../editor/ui/AssignmentAuthorBar.js';
import AssignmentBadge from '../editor/ui/AssignmentBadge.js';

const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const EDITOR_API_BASE_URL = window.API_URL || (isLocalHost ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

function editorApiFetch (path, options) {
    options = options || {};
    var token = window.__AUTH_TOKEN__;
    var headers = {'Content-Type': 'application/json', ...(options.headers || {})};
    if (token) {
        headers.Authorization = 'Bearer ' + token;
    }
    return fetch(EDITOR_API_BASE_URL + path, {...options, headers: headers});
}

/**
 * Patch estreito de IO, só nesta aba/sessão - admin (ou o próprio professor-
 * autor) editando uma missão EXISTENTE de qualquer dono via
 * editor.html?editAssignmentId=<id> (link enviado pela HelloYotta). Lê e
 * grava o projeto-exemplo via GET/PUT /api/assignments/:id/project
 * (backend/src/routes/assignments.js - bypass do filtro de owner do /api/db,
 * autorizado só para admin ou o teacher_id da própria missão), nunca pelo
 * /api/db normal - mesmo padrão já usado por entry/teacher.js#_patchIOBypass
 * pro bypass de live_session, só que amarrado a uma missão em vez de uma
 * sessão de observação.
 */
function patchIOForAssignmentEdit (assignmentId) {
    var origGetObjectinDB = IO.getObjectinDB;
    IO.getObjectinDB = function (db, md5, fcn) {
        if (db !== 'projects') {
            origGetObjectinDB.call(IO, db, md5, fcn);
            return;
        }
        editorApiFetch('/assignments/' + encodeURIComponent(assignmentId) + '/project')
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (project) { fcn(JSON.stringify(project ? [project] : [])); })
            .catch(function () { fcn('[]'); });
    };

    IO.saveProject = function (obj, fcn) {
        editorApiFetch('/assignments/' + encodeURIComponent(assignmentId) + '/project', {
            method: 'PUT',
            body: JSON.stringify({json: JSON.stringify(obj.json)}),
        })
            .then(function (res) { if (fcn) fcn({success: res.ok}); })
            .catch(function () { if (fcn) fcn({success: false}); });
    };
}

export function editorMain () { // eslint-disable-line import/prefer-default-export
    iOS.getsettings(doNext);
    function doNext (str) {
        var list = str.split(',');
        iOS.path = list[1] == '0' ? list[0] + '/' : undefined;
        if (list.length > 2) {
            Record.available = (list[2] == 'YES');
        }
        if (list.length > 3) {
            Camera.available = (list[3] == 'YES');
        }

        // teacherMode/projectName são parâmetros de URL PLANOS, lidos
        // separadamente do mecanismo de auth (token/studentId/classId) que
        // WebInterface._extractTokenFromUrl já cuida - ver HelloYotta,
        // que monta editor.html?token=...&teacherMode=author&projectName=...
        // quando um PROFESSOR abre o editor pra criar uma missão.
        var urlvars = getUrlVars();
        var teacherMode = urlvars.teacherMode;
        // Ver lobby/AssignmentNotice.js - o sino de missão pendente manda o
        // aluno pra cá com assignmentId (+ projectName) quando ele clica
        // numa missão que ainda não foi iniciada.
        var startAssignmentId = urlvars.assignmentId;
        // Admin (ou o próprio professor-autor) editando uma missão EXISTENTE
        // de qualquer dono - link enviado pela HelloYotta, diferente de
        // startAssignmentId acima (que é o ALUNO iniciando um projeto NOVO a
        // partir de uma missão). Nunca cria projeto, sempre carrega o
        // existente via patchIOForAssignmentEdit (ver docblock acima).
        // `activityId` é um alias aceito pelo mesmo motivo - a HelloYotta já
        // manda esse nome (junto com teacherMode=author, pensado só pro fluxo
        // de CRIAR missão nova) nos links de edição do painel admin; em vez
        // de depender de uma mudança do lado deles, tratamos os dois nomes
        // como equivalentes aqui. `editAssignmentId` tem prioridade se os
        // dois vierem juntos (não deveria acontecer, mas não há motivo pra
        // um vencer silenciosamente o outro por acidente de ordem de código).
        var editAssignmentId = urlvars.editAssignmentId || urlvars.activityId;
        var rawName = urlvars.projectName;
        var projectName = rawName ? decodeURIComponent(rawName.replace(/\+/g, ' ')) : null;

        // Só entra num fluxo de pré-criação se ainda não há projeto definido
        // pra carregar (window.currentProjectMd5/urlvars.pmd5 - mesma
        // checagem que ScratchJr.appinit faz pra decidir currentProject, ver
        // src/app/src/editor/ScratchJr.js ~linha 197). Se já existir, quem
        // abriu está reabrindo um projeto específico (não criando um novo) e
        // o fluxo normal serve igual.
        var hasProjectAlready = !!window.currentProjectMd5 ||
            (urlvars.pmd5 && urlvars.pmd5 !== 'null' && urlvars.pmd5 !== 'undefined');

        if (editAssignmentId) {
            patchIOForAssignmentEdit(editAssignmentId);
            // Sentinela sem '/' (cai no ramo getObjectinDB de IO.getObject,
            // já patchado acima) - o valor em si é ignorado pelo patch, só
            // precisa ser truthy pra Project.startLoad não cair no fallback
            // de "criar projeto em branco" (ver Project.js#startLoad).
            window.currentProjectMd5 = 'assignment-edit:' + editAssignmentId;
            finishBoot();
        } else if (teacherMode === 'author' && !hasProjectAlready) {
            // Cria o projeto novo ANTES do appinit - appinit() lê
            // window.currentProjectMd5 sincronamente logo no início (linha
            // 197), então precisa já estar definido quando ele rodar. Ver
            // Project.createNewProject: com o palco ainda inexistente
            // nesse ponto, ela pula o recarregamento redundante e deixa
            // o próprio appinit()->Project.load cuidar de carregar/
            // renderizar pelo caminho normal.
            Project.createNewProject({name: projectName || 'Nova Atividade'}, function (md5) {
                window.currentProjectMd5 = md5;
                finishBoot();
            });
        } else if (startAssignmentId && !hasProjectAlready) {
            // Mesmo truque acima, mas pro lado do ALUNO iniciando uma
            // missão pendente a partir do sino da lobby. Pré-criar aqui
            // (já com assignmentId) evita cair no fallback genérico de
            // Project.startLoad() - que roda dentro de appinit(), dispara
            // ANTES de AssignmentBadge.init() sequer existir, e cria um
            // projeto em branco SEM assignment_id. Esse projeto solto não
            // é isento do limite diário de criação (a isenção em
            // routes/db.js exige assignment_id truthy), então um aluno que
            // já tivesse criado 1 projeto no dia bateria
            // DAILY_LIMIT_EXCEEDED só de clicar no sino - mesma classe do
            // incidente de produção original, só que agora pro aluno em vez
            // do professor. Se a missão já tiver sido iniciada nesse meio-
            // tempo (ex.: corrida entre duas abas), o dedup do backend
            // (routes/db.js) devolve o projeto existente em vez de duplicar.
            Project.createNewProject({name: projectName, assignmentId: startAssignmentId}, function (md5) {
                window.currentProjectMd5 = md5;
                finishBoot();
            });
        } else {
            finishBoot();
        }

        function finishBoot () {
            ScratchJr.appinit(window.Settings.scratchJrVersion);
            if (editAssignmentId) {
                // Modo dedicado (admin ou professor-autor editando uma
                // missão existente, qualquer dono) - botão próprio, nunca o
                // fluxo normal de "Cadastrar aula" (que tentaria criar/
                // reautorar via POST /register, owner-filtrado) nem os
                // fluxos de aluno (LiveWatch/AssignmentBadge não fazem
                // sentido pra quem está editando o exemplo, não jogando).
                AssignmentAuthorBar.initAdminEdit(editAssignmentId);
            } else {
                // Botão flutuante "Cadastrar aula" - aparece tanto no lançamento
                // original da HelloYotta (teacherMode=author) quanto ao reabrir
                // um projeto-missão próprio pela lobby normal, sem esse parâmetro
                // (Home.gotoEditor nunca inclui teacherMode=author - achado em
                // teste real: sem isso, o professor perdia acesso ao botão pra
                // sempre assim que fechava e reabria o próprio projeto-exemplo).
                // AssignmentAuthorBar.init() decide sozinho qual dos dois casos é
                // este (ver seu init()/_checkExistingMission) - sempre chamado.
                AssignmentAuthorBar.init();
                if (teacherMode !== 'author') {
                    // No-op silencioso se o aluno não estiver num contexto HelloYotta
                    // (token sem turma_id) — ver LiveWatch.js.
                    initLiveWatch();
                    // Selo flutuante de progresso da missão - também no-op
                    // silencioso se não houver missão ativa pro aluno.
                    AssignmentBadge.init();
                }
            }
            // Acumula tempo de edição por projeto (ver TimeTracker.js) — no-op
            // até existir um projeto real, e se auto-gerencia daí em diante.
            TimeTracker.start();
        }
    }
}
