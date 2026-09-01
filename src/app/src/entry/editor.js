import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import Camera from '../painteditor/Camera.js';
import Record from '../editor/ui/Record.js';
import Project from '../editor/ui/Project.js';
import { initLiveWatch } from '../editor/LiveWatch.js';
import TimeTracker from '../utils/TimeTracker.js';
import { getUrlVars } from '../utils/lib.js';
import AssignmentAuthorBar from '../editor/ui/AssignmentAuthorBar.js';
import AssignmentBadge from '../editor/ui/AssignmentBadge.js';

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

        if (teacherMode === 'author' && !hasProjectAlready) {
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
            // Acumula tempo de edição por projeto (ver TimeTracker.js) — no-op
            // até existir um projeto real, e se auto-gerencia daí em diante.
            TimeTracker.start();
        }
    }
}
