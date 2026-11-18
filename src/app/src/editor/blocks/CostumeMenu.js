import {drawThumbnail} from '../../utils/lib.js';

// IO.js (and the iOS/Lobby/ScratchAudio chain it pulls in) assumes a real
// browser `window`, which breaks this module's node-environment unit tests
// (costumeOptions/menuGrid are pure). Load it lazily, only when a real
// drawCostumeChoice() call actually needs to fetch an asset.
let ioModulePromise;
function loadIO () {
    if (!ioModulePromise) {
        ioModulePromise = import('../../iPad/IO.js').then(m => m.default);
    }
    return ioModulePromise;
}

// Caches the loaded <img> per asset id (md5/filename) so re-drawing the same
// costume choice (block icon, every item in the open dropdown, etc.) does not
// re-request the asset from IO/the server each time.
const imageCache = {};

export function costumeOptions (sprite) {
    return (sprite?.costumes || []).map((_, index) => index);
}

export function menuGrid (count, columns = 3) {
    const width = Math.min(count, columns);
    return {columns: width, rows: width ? Math.ceil(count / width) : 0};
}

// Fallback used only while the real artwork hasn't loaded yet (or is missing),
// so the slot is never left blank.
function drawPlaceholder (ctx, canvas, scale, index) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(32, 32, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8e44ad';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const value = Number(index);
    ctx.fillText(Number.isInteger(value) && value >= 0 ? String(value + 1) : '?', 32, 33, 34);
    ctx.restore();
}

// Draws the actor's actual costume artwork onto the canvas (block icon or a
// dropdown slot), matching how every other menu (speeds, pictures, etc.)
// shows a real thumbnail instead of a number. Falls back to a numbered dot
// only while the sprite/asset isn't known yet.
export function drawCostumeChoice (canvas, index, scale, sprite) {
    var ctx = canvas.getContext('2d');
    var md5 = sprite && sprite.costumes && sprite.costumes[Number(index)];
    if (!md5) {
        drawPlaceholder(ctx, canvas, scale, index);
        return;
    }
    if (imageCache[md5]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawThumbnail(imageCache[md5], canvas);
        return;
    }
    drawPlaceholder(ctx, canvas, scale, index);
    loadIO().then(function (IO) {
        IO.getAsset(md5, function (dataurl) {
            var img = new Image();
            img.onload = function () {
                imageCache[md5] = img;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawThumbnail(img, canvas);
            };
            img.onerror = function () {
                drawPlaceholder(ctx, canvas, scale, index);
            };
            img.src = dataurl;
        });
    });
}
