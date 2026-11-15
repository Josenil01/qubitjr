export function costumeOptions (sprite) {
    return (sprite?.costumes || []).map((_, index) => index);
}

export function menuGrid (count, columns = 3) {
    const width = Math.min(count, columns);
    return {columns: width, rows: width ? Math.ceil(count / width) : 0};
}

// Draw numbers directly so actors can have more appearances than the bundled icons.
export function drawCostumeChoice (canvas, index, scale) {
    const ctx = canvas.getContext('2d');
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
