/**
 * src/app/src/editor/ui/CenterModal.js
 *
 * Modal central genérico (ícone + miniatura opcional + título opcional +
 * texto + botão(ões)) - extraído de AssignmentBadge.js#_showCoachModal pra
 * poder ser reaproveitado por LiveWatch.js (avisos de handoff de controle/
 * retorno ao HelloYotta) sem acoplar os dois sistemas um no outro. Mesmas
 * classes CSS de sempre (assignmentComplete* - nome histórico do modal de
 * "parabéns" da missão, mantido de propósito pra não precisar tocar no CSS
 * já existente em assignment.css) - visual idêntico ao que já existia,
 * agora num módulo sem nenhuma dependência do sistema de dicas (Project.js/
 * Palette.js/GalleryRestriction.js, que AssignmentBadge.js importa e
 * LiveWatch.js não precisa).
 *
 * Um modal por vez NESTE módulo - AssignmentBadge.js e LiveWatch.js
 * compartilham a mesma instância/estado, então os dois nunca empilham um
 * por cima do outro (mesma garantia de antes, agora valendo entre os dois
 * sistemas também).
 */

import {newHTML} from '../../utils/lib.js';

const DEFAULT_CLOSE_DELAY_MS = 2000;

let modalEl = null;

export function isCenterModalOpen () {
    return !!modalEl;
}

export function closeCenterModal () {
    if (modalEl && modalEl.parentNode) {
        modalEl.parentNode.removeChild(modalEl);
    }
    modalEl = null;
}

/**
 * @param {string} [opts.icon] emoji do topo - default '💡'.
 * @param {string} [opts.title] título em destaque - omitido pula o elemento
 *   por completo (card fica só ícone+texto, sem cabeçalho).
 * @param {string} [opts.text] corpo do balão.
 * @param {string} [opts.extraClass] classe CSS extra no card (acento visual).
 * @param {string} [opts.thumbSrc] miniatura (ex.: personagem) acima do
 *   título - removida sozinha se a imagem falhar (onerror).
 * @param {number} [opts.zIndex] sobrescreve o z-index padrão do CSS (9500) -
 *   necessário pra ficar acima do vidro de bloqueio do LiveMirror
 *   (ABOVE_LOCK_OVERLAY_Z_INDEX) quando chamado de LiveWatch.js.
 * @param {Array<{label:string, onClick:Function}>} [opts.buttons] um botão
 *   por entrada, todos fecham o modal IMEDIATAMENTE ao clicar e então
 *   chamam onClick - pra decisões (Aceitar/Recusar, Voltar pro HelloYotta)
 *   que não devem esperar nenhum delay. Sem este campo, usa o botão único
 *   de fechar (ver closeLabel/closeDelayMs/onClose) - caso do modal
 *   "Continuar" de parabéns/dica de coach.
 * @param {string} [opts.closeLabel] texto do botão único - default 'Continuar'.
 * @param {number} [opts.closeDelayMs] atraso antes do botão único habilitar -
 *   trava contra clique reflexo/duplo fechando antes de dar tempo de ler;
 *   default 2000ms. Ignorado quando `buttons` é passado.
 * @param {Function} [opts.onClose] chamado ao fechar pelo botão único.
 * @returns {boolean} false se já havia um modal aberto (não abriu outro) -
 *   chamador decide o que fazer (AssignmentBadge.js ignora; nenhum chamador
 *   de LiveWatch.js precisa tratar hoje, mas o retorno existe pra isso).
 */
export function showCenterModal ({
    icon, title, text, extraClass, thumbSrc, zIndex, buttons,
    closeLabel, closeDelayMs, onClose,
} = {}) {
    if (modalEl) {
        return false; // já tem um modal (de qualquer um dos dois sistemas) aberto - não duplica/sobrepõe
    }
    modalEl = newHTML('div', 'assignmentCompleteOverlay', document.body);
    if (zIndex) {
        modalEl.style.zIndex = String(zIndex);
    }
    // Sem onclick no fundo - só um botão dentro do cartão fecha (mesma regra
    // de sempre: nunca um clique acidental fora dispensa o aviso).
    const cardClass = 'assignmentCompleteCard' + (extraClass ? (' ' + extraClass) : '');
    const card = newHTML('div', cardClass, modalEl);
    const emoji = newHTML('div', 'assignmentCompleteEmoji', card);
    emoji.textContent = icon || '💡';
    if (thumbSrc) {
        const thumb = newHTML('img', 'assignmentCompleteThumb', card);
        thumb.src = thumbSrc;
        thumb.alt = '';
        thumb.onerror = function () {
            if (thumb.parentNode) {
                thumb.parentNode.removeChild(thumb);
            }
        };
    }
    if (title) {
        const titleEl = newHTML('div', 'assignmentCompleteTitle', card);
        titleEl.textContent = title;
    }
    const textEl = newHTML('div', 'assignmentCompleteText', card);
    textEl.textContent = text || '';

    if (Array.isArray(buttons) && buttons.length) {
        const footer = newHTML('div', 'assignmentCompleteButtons', card);
        buttons.forEach(function (btn) {
            const btnEl = newHTML('button', 'assignmentCompleteClose', footer);
            btnEl.type = 'button';
            btnEl.textContent = btn.label;
            btnEl.onclick = function () {
                closeCenterModal();
                if (btn.onClick) {
                    btn.onClick();
                }
            };
        });
        return true;
    }

    const closeBtn = newHTML('button', 'assignmentCompleteClose', card);
    closeBtn.type = 'button';
    closeBtn.textContent = closeLabel || 'Continuar';
    closeBtn.disabled = true;
    closeBtn.onclick = function () {
        closeCenterModal();
        if (onClose) {
            onClose();
        }
    };
    window.setTimeout(function () {
        closeBtn.disabled = false;
    }, closeDelayMs === undefined ? DEFAULT_CLOSE_DELAY_MS : closeDelayMs);
    return true;
}
