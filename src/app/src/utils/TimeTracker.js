//////////////////////////////////////////////////
// TimeTracker
//
// Accumulates how long a student actively spends on the currently open
// project (tab visible, project loaded) and periodically reports the delta
// to POST /api/db/project/:id/heartbeat, which increments
// projects.time_spent_seconds atomically in Postgres (see
// increment_project_time in backend/supabase-setup.sql). "Total time on the
// platform" for a student is just SUM(time_spent_seconds) across their
// projects - no separate counter needed here.
//
// Self-contained: call TimeTracker.start() once from the editor entry point.
// It no-ops (via the ScratchJr.currentProject null-check in _flush) until a
// real project id exists, and needs no explicit stop - it flushes on tab
// hide and on page unload.
//////////////////////////////////////////////////

import ScratchJr from '../editor/ScratchJr.js';

const HEARTBEAT_MS = 60000;
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.API_URL || (isLocal ? 'http://localhost:5000/api' : (window.location.origin + '/api'));

let started = false;
let lastTick = 0;
let pendingSeconds = 0;

function authHeader () {
    const token = window.__AUTH_TOKEN__;
    return token ? {Authorization: 'Bearer ' + token} : {};
}

export default class TimeTracker {
    static start () {
        if (started) {
            return;
        }
        started = true;
        lastTick = Date.now();

        window.setInterval(TimeTracker._tick, HEARTBEAT_MS);
        document.addEventListener('visibilitychange', TimeTracker._onVisibilityChange);
        // pagehide (not beforeunload) - fires reliably on tab close/navigation
        // and, unlike beforeunload, doesn't block bfcache.
        window.addEventListener('pagehide', TimeTracker._flushFinal);
    }

    // Only accrues while the tab is actually visible - a backgrounded/minimized
    // tab shouldn't count as "time spent editing".
    static _accrue () {
        if (document.visibilityState !== 'visible') {
            lastTick = Date.now();
            return;
        }
        var now = Date.now();
        var delta = (now - lastTick) / 1000;
        lastTick = now;
        if (delta > 0) {
            pendingSeconds += delta;
        }
    }

    static _tick () {
        TimeTracker._accrue();
        TimeTracker._flush();
    }

    static _onVisibilityChange () {
        if (document.visibilityState === 'hidden') {
            TimeTracker._accrue();
            TimeTracker._flush();
        } else {
            lastTick = Date.now();
        }
    }

    static _flushFinal () {
        TimeTracker._accrue();
        TimeTracker._flush();
    }

    // fetch(..., {keepalive:true}) instead of navigator.sendBeacon(): beacon
    // can't send the Authorization header our backend requires, keepalive can
    // and still survives page unload the same way.
    static _flush () {
        var projectId = ScratchJr.currentProject;
        var seconds = Math.floor(pendingSeconds);
        if (!projectId || seconds <= 0) {
            return;
        }
        pendingSeconds -= seconds; // keep any sub-second remainder for next tick

        fetch(API_BASE_URL + '/db/project/' + projectId + '/heartbeat', {
            method: 'POST',
            keepalive: true,
            headers: Object.assign({'Content-Type': 'application/json'}, authHeader()),
            body: JSON.stringify({deltaSeconds: seconds})
        }).catch(function (err) {
            // Best-effort analytics - losing an occasional tick isn't worth retrying.
            console.warn('[TimeTracker] heartbeat failed:', err && err.message);
            pendingSeconds += seconds; // give it another shot on the next tick
        });
    }
}
