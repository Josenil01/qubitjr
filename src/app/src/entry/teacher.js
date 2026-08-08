/**
 * src/app/src/entry/teacher.js
 *
 * Lobby do professor: lista os alunos de uma turma (online primeiro),
 * permite observar um aluno ao vivo (prévia de imagem via canal Realtime) e,
 * opcionalmente, assumir o controle do editor daquele aluno.
 *
 * turma_id vem de ?turmaId= na URL (redirect vindo da HelloYotta).
 *
 * ⚠️ Não testado contra Supabase/HelloYotta reais neste ambiente — ver
 * ressalvas na conversa de arquitetura. "Assumir controle" é a parte de
 * maior risco: monta o motor completo do ScratchJr (mesma abordagem do
 * player.js) contra os endpoints de bypass em backend/src/routes/teacher.js
 * (GET/PUT /api/teacher/session/:id/project), que existem só enquanto a
 * live_session estiver ativa.
 */

import ScratchJr from '../editor/ScratchJr.js';
import iOS from '../iPad/iOS.js';
import IO from '../iPad/IO.js';
import Project from '../editor/ui/Project.js';
import Library from '../editor/ui/Library.js';
import Record from '../editor/ui/Record.js';
import Undo from '../editor/ui/Undo.js';
import Palette from '../editor/ui/Palette.js';
import { connectChannel } from '../services/RealtimeClient.js';
import { newHTML, gn } from '../utils/lib.js';

const HEARTBEAT_MS = 20000;
const DEVICE_ID_KEY = 'scratchjr_teacher_device_id';

let apiBase;
let turmaId;
let roster = [];
let onlineIds = new Set();
let presenceChannel = null;
let sessionChannel = null;
let currentSession = null; // { sessionId, studentId, realtimeChannel, expiresAt }
let heartbeatTimer = null;
let hasControl = false; // true quando o PROFESSOR está no controle

function authHeader() {
    const token = window.__AUTH_TOKEN__;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...authHeader(), ...(options.headers || {}) },
    });
    return res;
}

function getDeviceId() {
    let id = sessionStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random()}`);
        sessionStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

// ── Boot ─────────────────────────────────────────────────────────────────

export async function teacherMain() {
    apiBase = window.API_URL || (location.origin + '/api');
    const params = new URLSearchParams(location.search);
    turmaId = params.get('turmaId');

    if (!turmaId) {
        _fatal('Link inválido. Nenhuma turma informada na URL.');
        return;
    }

    await _loadRoster();
    await _connectPresence();
    _renderLobby();
}

function _fatal(msg) {
    const root = gn('teacher-root');
    root.innerHTML = '';
    const div = newHTML('div', 'teacherFatal', root);
    div.textContent = msg;
}

// ── Dados ────────────────────────────────────────────────────────────────

async function _loadRoster() {
    const res = await apiFetch(`/teacher/classroom/${encodeURIComponent(turmaId)}/students`);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        _fatal(body.error || 'Não foi possível carregar a turma.');
        return;
    }
    const data = await res.json();
    roster = data.students || [];
    gn('teacher-turma-name').textContent = data.turmaName || turmaId;
}

async function _connectPresence() {
    const res = await apiFetch('/realtime/presence-token', { method: 'POST' });
    if (!res.ok) return; // sem turma_id no token do professor — segue só com o snapshot inicial
    const data = await res.json();
    presenceChannel = connectChannel(data.channel);
    if (!presenceChannel) return;

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            onlineIds = new Set(Object.values(state).flat().map((p) => p.studentId));
            _renderLobby();
        })
        .subscribe();
}

// ── Lobby (grid de alunos, online primeiro) ─────────────────────────────

function _renderLobby() {
    const root = gn('teacher-root');
    root.innerHTML = '';

    const grid = newHTML('div', 'teacherGrid', root);
    const sorted = [...roster].sort((a, b) => {
        const aOnline = onlineIds.has(a.id) ? 1 : 0;
        const bOnline = onlineIds.has(b.id) ? 1 : 0;
        return bOnline - aOnline;
    });

    sorted.forEach((student) => {
        const online = onlineIds.has(student.id);
        const card = newHTML('div', 'teacherCard' + (online ? ' online' : ' offline'), grid);

        const status = newHTML('div', 'teacherCardStatus', card);
        status.textContent = online ? '🟢 online' : '⚪ offline';

        if (student.project && student.project.thumbnail) {
            const img = newHTML('img', 'teacherCardThumb', card);
            img.src = student.project.thumbnail;
            img.alt = student.project.name || '';
        } else {
            newHTML('div', 'teacherCardThumb teacherCardThumbEmpty', card);
        }

        const name = newHTML('div', 'teacherCardName', card);
        name.textContent = student.name;

        const btn = newHTML('button', 'teacherCardBtn', card);
        btn.textContent = online ? 'Observar' : 'Abrir';
        btn.onclick = () => (online ? _startObserving(student) : _openOffline(student));
    });
}

function _openOffline(student) {
    // Aluno offline: fora do escopo desta tela — abrir o projeto no modo
    // editor normal (assíncrono) é a mesma UI de edição já existente, não a
    // de observação ao vivo. Aqui só sinalizamos onde isso deveria acontecer.
    window.alert(`Abrir "${student.project ? student.project.name : 'projeto'}" de ${student.name} no modo editor normal (fora do escopo desta tela de observação ao vivo).`);
}

// ── Observar (prévia de imagem) ─────────────────────────────────────────

async function _startObserving(student) {
    const res = await apiFetch('/teacher/session/start', {
        method: 'POST',
        body: JSON.stringify({
            turmaId,
            studentId: student.id,
            deviceId: getDeviceId(),
            projectId: student.project ? student.project.id : null,
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.error || 'Não foi possível iniciar a observação.');
        return;
    }

    const data = await res.json();
    currentSession = { ...data, studentId: student.id, studentName: student.name };
    hasControl = false;

    sessionChannel = connectChannel(data.realtimeChannel);
    if (!sessionChannel) {
        window.alert('Canal Realtime não configurado (VITE_SUPABASE_URL/ANON_KEY ausentes).');
        return;
    }

    sessionChannel
        .on('broadcast', { event: 'preview_frame' }, (msg) => _updatePreview(msg.payload?.dataUrl))
        .on('broadcast', { event: 'control_ready' }, () => {
            if (hasControl) _mountControllingEngine();
        })
        .on('broadcast', { event: 'control_denied' }, () => {
            hasControl = false;
            const btn = document.querySelector('.teacherControlBtn');
            if (btn) { btn.disabled = false; btn.textContent = 'Assumir controle'; }
            window.alert('O aluno recusou o pedido de controle.');
        })
        .subscribe();

    // Avisa o aluno (via canal de presença da turma) que uma sessão começou.
    if (presenceChannel) {
        presenceChannel.send({
            type: 'broadcast',
            event: 'session_started',
            payload: { studentId: student.id, sessionId: data.sessionId },
        });
    }

    _renderObserving();
    _startHeartbeat();
}

function _renderObserving() {
    const root = gn('teacher-root');
    root.innerHTML = '';

    const bar = newHTML('div', 'teacherObserveBar', root);
    const back = newHTML('button', 'teacherBackBtn', bar);
    back.textContent = '← Voltar pra turma';
    back.onclick = _endSession;

    const title = newHTML('span', 'teacherObserveTitle', bar);
    title.textContent = `Observando: ${currentSession.studentName}`;

    const controlBtn = newHTML('button', 'teacherControlBtn', bar);
    controlBtn.textContent = 'Assumir controle';
    controlBtn.onclick = _requestControl;

    newHTML('div', 'teacherPreviewWrap', root).id = 'teacher-preview-wrap';
    const img = newHTML('img', 'teacherPreviewImg', gn('teacher-preview-wrap'));
    img.id = 'teacher-preview-img';
    img.alt = 'Prévia ao vivo';
}

function _updatePreview(dataUrl) {
    const img = gn('teacher-preview-img');
    if (img && dataUrl) img.src = dataUrl;
}

function _requestControl() {
    if (!sessionChannel) return;
    hasControl = true;
    sessionChannel.send({ type: 'broadcast', event: 'control_request', payload: { from: 'teacher' } });
    const btn = document.querySelector('.teacherControlBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Aguardando o aluno salvar...'; }
}

// ── Assumir controle (monta o motor completo — maior risco, não testado) ──

function _mountControllingEngine() {
    const sessionId = currentSession.sessionId;

    // Patch estreito de IO, só neste módulo/sessão: lê e grava o projeto do
    // aluno via os endpoints de bypass (backend/src/routes/teacher.js),
    // nunca pelo /api/db normal (que filtraria por owner e bloquearia).
    const _origGetObjectinDB = IO.getObjectinDB;
    IO.getObjectinDB = function (db, md5, fcn) {
        if (db === 'projects') {
            apiFetch(`/teacher/session/${sessionId}/project`)
                .then((r) => (r.ok ? r.json() : null))
                .then((project) => fcn(JSON.stringify(project ? [project] : [])))
                .catch(() => fcn('[]'));
            return;
        }
        _origGetObjectinDB.call(IO, db, md5, fcn);
    };

    IO.saveProject = function (obj, fcn) {
        apiFetch(`/teacher/session/${sessionId}/project`, {
            method: 'PUT',
            body: JSON.stringify({ json: JSON.stringify(obj.json) }),
        })
            .then((r) => (fcn ? fcn({ success: r.ok }) : null))
            .catch(() => (fcn ? fcn({ success: false }) : null));
    };

    // No-op de módulos de UI de editor não usados aqui — mesmo padrão do player.js.
    Library.init = () => {};
    Record.init = () => {};
    Undo.init = () => {};

    document.body.classList.add('teacherControlling');
    window.currentProjectMd5 = currentSession.projectId;

    iOS.getsettings(function (str) {
        const list = str.split(',');
        iOS.path = list[1] === '0' ? list[0] + '/' : undefined;
        ScratchJr.currentProject = currentSession.projectId;
        ScratchJr.appinit(window.Settings.scratchJrVersion);
    });

    const btn = document.querySelector('.teacherControlBtn');
    if (btn) { btn.textContent = 'Soltar controle'; btn.disabled = false; btn.onclick = _releaseControl; }
}

function _releaseControl() {
    ScratchJr.saveProject(null, function () {
        if (sessionChannel) sessionChannel.send({ type: 'broadcast', event: 'control_ready', payload: {} });
        hasControl = false;
        // Recarrega a visão de prévia — mais simples que desmontar o motor
        // do editor em memória. O aluno volta a ser a fonte da prévia.
        location.reload();
    }, true);
}

// ── Ciclo de vida da sessão ─────────────────────────────────────────────

function _startHeartbeat() {
    heartbeatTimer = setInterval(async () => {
        if (!currentSession) return;
        const res = await apiFetch(`/teacher/session/${currentSession.sessionId}/heartbeat`, { method: 'POST' });
        if (res.status === 410) {
            window.alert('Sessão de observação expirou (50min).');
            _endSession();
        }
    }, HEARTBEAT_MS);
}

async function _endSession(reason) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;

    // Avisa o aluno PRIMEIRO (broadcast sobre um websocket já aberto sai
    // quase na hora) — sem isso o aviso "professor vendo" fica preso na tela
    // dele pra sempre se o professor só fechar a aba/navegar embora em vez
    // de clicar em "voltar pra turma".
    if (sessionChannel) {
        sessionChannel.send({ type: 'broadcast', event: 'session_ended', payload: {} });
    }

    if (currentSession) {
        await apiFetch(`/teacher/session/${currentSession.sessionId}/end`, {
            method: 'POST',
            body: JSON.stringify({ reason: reason || 'teacher_left' }),
        }).catch(() => {});
    }
    if (sessionChannel) sessionChannel.unsubscribe();
    sessionChannel = null;
    currentSession = null;
    hasControl = false;
    _renderLobby();
}

// Fechar a aba / navegar pra outro lugar sem clicar em "voltar" não deveria
// deixar a sessão pendurada (nem o aviso preso na tela do aluno) até o
// timeout de 50min. pagehide é mais confiável que beforeunload pra isso.
window.addEventListener('pagehide', () => {
    if (currentSession) _endSession('teacher_left');
});
