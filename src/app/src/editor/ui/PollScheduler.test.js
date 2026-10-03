// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

/** Sobrescreve document.visibilityState (jsdom não deixa setar direto). */
function setVisibility (state) {
    Object.defineProperty(document, 'visibilityState', {value: state, configurable: true});
}

// PollScheduler guarda estado de módulo (active, lastActivityAt,
// listenersRegistered, os 3 timers) de propósito - é um singleton real,
// pensado pra existir uma vez por carregamento de página (ver docblock do
// arquivo). Pra cada teste começar de um estado limpo (sem herdar
// lastActivityAt/active do teste anterior), reimporta o módulo do zero via
// vi.resetModules() + import() dinâmico em vez de um import estático no topo
// deste arquivo - listeners de DOM de gerações anteriores podem continuar
// registrados (document nunca é recriado entre testes), mas eles só mutam o
// `lastActivityAt`/etc. da ENCARNAÇÃO ANTIGA do módulo, que nenhum teste
// depois volta a ler - inofensivo.
let PollScheduler;

beforeEach(async () => {
    vi.useFakeTimers();
    setVisibility('visible');
    vi.resetModules();
    ({default: PollScheduler} = await import('./PollScheduler.js'));
});

afterEach(() => {
    PollScheduler.stop();
    vi.useRealTimers();
});

describe('PollScheduler.start/stop - cadência do poll', () => {
    it('chama onTick a cada ACTUAL_REFRESH_MS (2000ms) quando não há dica pendente', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});

        vi.advanceTimersByTime(1999);
        expect(onTick).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(onTick).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(2000);
        expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('acelera pra HINTS_PENDING_REFRESH_MS (800ms) enquanto hasPendingHints() diz que sim', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => true});

        vi.advanceTimersByTime(800);
        expect(onTick).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(800);
        expect(onTick).toHaveBeenCalledTimes(2);
    });

    it('não chama onTick enquanto a aba está oculta, mas retoma ao voltar a ficar visível', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});

        setVisibility('hidden');
        vi.advanceTimersByTime(2000);
        expect(onTick).not.toHaveBeenCalled();

        setVisibility('visible');
        vi.advanceTimersByTime(2000);
        expect(onTick).toHaveBeenCalledTimes(1);
    });

    it('recheck imediato ao disparar visibilitychange com a aba visível', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        onTick.mockClear(); // start() não chama onTick por si - só agenda; limpa qualquer chamada incidental

        document.dispatchEvent(new Event('visibilitychange'));
        expect(onTick).toHaveBeenCalledTimes(1);
    });

    it('é idempotente - uma segunda chamada a start() enquanto já ativo é ignorada', () => {
        const firstTick = vi.fn();
        const secondTick = vi.fn();
        PollScheduler.start({onTick: firstTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        PollScheduler.start({onTick: secondTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});

        vi.advanceTimersByTime(2000);
        expect(firstTick).toHaveBeenCalledTimes(1);
        expect(secondTick).not.toHaveBeenCalled();
    });

    it('onRequirementsRefresh roda a cada REQUIREMENTS_REFRESH_MS (30000ms), só com a aba visível', () => {
        const onRequirementsRefresh = vi.fn();
        PollScheduler.start({onTick: vi.fn(), onRequirementsRefresh, hasPendingHints: () => false});

        vi.advanceTimersByTime(30000);
        expect(onRequirementsRefresh).toHaveBeenCalledTimes(1);

        setVisibility('hidden');
        vi.advanceTimersByTime(30000);
        expect(onRequirementsRefresh).toHaveBeenCalledTimes(1); // não rodou enquanto oculta
    });

    it('stop() cancela o poll de vez - nenhum onTick depois, mesmo avançando bastante tempo', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        PollScheduler.stop();

        vi.advanceTimersByTime(60000);
        expect(onTick).not.toHaveBeenCalled();
    });

    it('stop() chamado DENTRO do próprio onTick (missão concluindo no meio do tick) impede o rearme - regressão do vazamento original', () => {
        const onTick = vi.fn(() => {
            PollScheduler.stop(); // simula _applyProgress -> _lockCompletion disparado pelo próprio tick
        });
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});

        vi.advanceTimersByTime(2000);
        expect(onTick).toHaveBeenCalledTimes(1);

        // Antes da correção (ver docblock de PollScheduler.js), o callback já
        // em voo reagendava um novo timer de qualquer forma - avançar mais
        // 2s chamaria onTick de novo. Agora não deve chamar mais nada.
        vi.advanceTimersByTime(60000);
        expect(onTick).toHaveBeenCalledTimes(1);
    });

    it('um start() depois de stop() reativa a cadência normalmente', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        PollScheduler.stop();

        const onTick2 = vi.fn();
        PollScheduler.start({onTick: onTick2, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        vi.advanceTimersByTime(2000);
        expect(onTick2).toHaveBeenCalledTimes(1);
    });
});

describe('PollScheduler.idleFor - rastreamento de atividade', () => {
    it('conta como "ocioso há muito tempo" antes de qualquer interação (lastActivityAt=0)', () => {
        expect(PollScheduler.idleFor()).toBeGreaterThan(1000 * 60 * 60); // bem mais que qualquer limiar real
    });

    it('zera ao detectar mousedown/keydown em qualquer lugar da página (fase de captura)', () => {
        PollScheduler.start({onTick: vi.fn(), onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});

        vi.advanceTimersByTime(5000);
        expect(PollScheduler.idleFor()).toBeGreaterThanOrEqual(5000);

        document.dispatchEvent(new Event('mousedown'));
        expect(PollScheduler.idleFor()).toBeLessThan(10);
    });

    it('mousemove só conta como atividade quando o botão está pressionado (arrasto)', () => {
        PollScheduler.start({onTick: vi.fn(), onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        vi.advanceTimersByTime(5000);

        const hover = new Event('mousemove');
        hover.buttons = 0;
        document.dispatchEvent(hover);
        expect(PollScheduler.idleFor()).toBeGreaterThanOrEqual(5000); // só passar o mouse não conta

        const drag = new Event('mousemove');
        drag.buttons = 1;
        document.dispatchEvent(drag);
        expect(PollScheduler.idleFor()).toBeLessThan(10);
    });

    it('mouseup/touchend/keyup agendam um recálculo instantâneo (coalescendo múltiplos em um só)', () => {
        const onTick = vi.fn();
        PollScheduler.start({onTick, onRequirementsRefresh: vi.fn(), hasPendingHints: () => false});
        onTick.mockClear();

        document.dispatchEvent(new Event('mouseup'));
        document.dispatchEvent(new Event('touchend'));
        document.dispatchEvent(new Event('keyup'));
        vi.advanceTimersByTime(0);

        expect(onTick).toHaveBeenCalledTimes(1); // coalescido, não 3
    });
});
