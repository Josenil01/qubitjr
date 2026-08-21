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

        // Só entra no fluxo de autoria se ainda não há projeto definido pra
        // carregar (window.currentProjectMd5/urlvars.pmd5 - mesma checagem
        // que ScratchJr.appinit faz pra decidir currentProject, ver
        // src/app/src/editor/ScratchJr.js ~linha 197). Se já existir, o
        // professor está reabrindo um projeto específico (não criando um
        // novo) e o fluxo normal serve igual.
        var hasProjectAlready = !!window.currentProjectMd5 ||
            (urlvars.pmd5 && urlvars.pmd5 !== 'null' && urlvars.pmd5 !== 'undefined');

        if (teacherMode === 'author' && !hasProjectAlready) {
            var rawName = urlvars.projectName;
            var projectName = rawName ? decodeURIComponent(rawName.replace(/\+/g, ' ')) : null;
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
        } else {
            finishBoot();
        }

        function finishBoot () {
            ScratchJr.appinit(window.Settings.scratchJrVersion);
            if (teacherMode === 'author') {
                // Botão flutuante "Cadastrar aula" - só existe neste modo.
                AssignmentAuthorBar.init();
            } else {
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
