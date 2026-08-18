import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import Camera from '../painteditor/Camera.js';
import Record from '../editor/ui/Record.js';
import { initLiveWatch } from '../editor/LiveWatch.js';
import TimeTracker from '../utils/TimeTracker.js';

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
        ScratchJr.appinit(window.Settings.scratchJrVersion);
        // No-op silencioso se o aluno não estiver num contexto HelloYotta
        // (token sem turma_id) — ver LiveWatch.js.
        initLiveWatch();
        // Acumula tempo de edição por projeto (ver TimeTracker.js) — no-op
        // até existir um projeto real, e se auto-gerencia daí em diante.
        TimeTracker.start();
    }
}
