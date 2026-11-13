// Package the approved masters for the existing catalog; never redraw the artwork.
// Run from the repository root: node scripts/promote-chibi-furniture.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const app = path.join(root, 'src/app');
const masters = path.join(root, 'art-previews/chibi/moveis');
const staged = path.join(masters, 'exportacao-oficial');
const backup = path.join(root, 'art-previews/chibi/moveis/backup-biblioteca-original');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

// Trace pixel boundaries, retaining holes and detached parts (antennae, feet, etc.).
// Coordinates are in the catalog's logical viewport, matching the thumbnail mask.
function silhouette(alpha, width, height) {
    const edges = new Map();
    const stride = width + 1;
    const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] >= 64;
    const add = (x, y, xx, yy, dir) => {
        const key = y * stride + x;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({to: yy * stride + xx, dir});
    };
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (!solid(x, y)) continue;
            if (!solid(x, y - 1)) add(x, y, x + 1, y, 0);
            if (!solid(x + 1, y)) add(x + 1, y, x + 1, y + 1, 1);
            if (!solid(x, y + 1)) add(x + 1, y + 1, x, y + 1, 2);
            if (!solid(x - 1, y)) add(x, y + 1, x, y, 3);
        }
    }
    const contours = [];
    while (edges.size) {
        const start = edges.keys().next().value;
        let key = start;
        let direction = null;
        const points = [];
        do {
            points.push([key % stride, Math.floor(key / stride)]);
            const options = edges.get(key);
            if (!options || !options.length) throw new Error('Open silhouette boundary');
            let index = 0;
            if (direction !== null && options.length > 1) {
                const priorities = [(direction + 1) % 4, direction, (direction + 3) % 4, (direction + 2) % 4];
                index = options.reduce((best, item, i) => priorities.indexOf(item.dir) < priorities.indexOf(options[best].dir) ? i : best, 0);
            }
            const edge = options.splice(index, 1)[0];
            if (!options.length) edges.delete(key);
            key = edge.to;
            direction = edge.dir;
        } while (key !== start);
        const corners = points.filter((p, i) => {
            const a = points[(i + points.length - 1) % points.length];
            const b = points[(i + 1) % points.length];
            return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
        });
        if (corners.length >= 3) contours.push('M' + corners.map(p => p.join(' ')).join('L') + 'Z');
    }
    if (!contours.length) throw new Error('Empty animal silhouette');
    return contours.join('');
}

async function main() {
    const catalogBytes = fs.readFileSync(path.join(app, 'media.json'));
    const catalog = readJson(path.join(app, 'media.json'));
    const approved = readJson(path.join(masters, 'catalogo.json'));
    const approvedIds = new Set(approved.map(a => a.md5));
    const animals = catalog.sprites.filter(a => approvedIds.has(a.md5) && !a.legacy);
    const ids = list => list.map(a => a.md5).sort().join('\n');
    if (animals.length !== 2 || ids(animals) !== ids(approved)) throw new Error('Official extras differ from approved set');
    for (const dir of ['pnglibrary', 'svglibrary']) fs.mkdirSync(path.join(staged, dir), {recursive: true});

    const browser = await chromium.launch({headless: true});
    const records = [];
    try {
        const page = await browser.newPage();
        for (const animal of animals) {
            const id = animal.md5.replace(/\.svg$/, '');
            const masterFile = path.join(masters, id + '.png');
            const master = fs.readFileSync(masterFile);
            const width = Number(animal.width);
            const height = Number(animal.height);
            const result = await page.evaluate(async ({uri, width, height}) => {
                const img = new Image();
                img.src = uri;
                await img.decode();
                if (img.naturalWidth < 512 || img.naturalHeight < 512) throw new Error('Unexpected master dimensions');
                let bounds = null;
                if (true) {
                    // Fit the actual animal, not the square master's empty margins,
                    // into portrait/landscape catalog viewports without stretching.
                    const probe = document.createElement('canvas');
                    probe.width = img.naturalWidth;
                    probe.height = img.naturalHeight;
                    const context = probe.getContext('2d');
                    context.drawImage(img, 0, 0);
                    const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
                    let left = probe.width, top = probe.height, right = -1, bottom = -1;
                    for (let y = 0; y < probe.height; y++) {
                        for (let x = 0; x < probe.width; x++) {
                            if (pixels[(y * probe.width + x) * 4 + 3] < 16) continue;
                            left = Math.min(left, x); top = Math.min(top, y);
                            right = Math.max(right, x); bottom = Math.max(bottom, y);
                        }
                    }
                    if (right < left) throw new Error('Empty animal master');
                    bounds = {left, top, width: right - left + 1, height: bottom - top + 1};
                }
                function render(density) {
                    const canvas = document.createElement('canvas');
                    canvas.width = width * density;
                    canvas.height = height * density;
                    const ctx = canvas.getContext('2d');
                    ctx.imageSmoothingQuality = 'high';
                    if (bounds) {
                        const ratio = Math.min(canvas.width * 0.9 / bounds.width, canvas.height * 0.9 / bounds.height);
                        ctx.drawImage(img, (canvas.width - bounds.width * ratio) / 2 - bounds.left * ratio,
                            (canvas.height - bounds.height * ratio) / 2 - bounds.top * ratio,
                            img.naturalWidth * ratio, img.naturalHeight * ratio);
                    } else {
                        const side = Math.min(canvas.width, canvas.height);
                        ctx.drawImage(img, (canvas.width - side) / 2, (canvas.height - side) / 2, side, side);
                    }
                    return canvas;
                }
                const thumb = render(1);
                const data = thumb.getContext('2d').getImageData(0, 0, width, height).data;
                const alpha = [];
                for (let i = 3; i < data.length; i += 4) alpha.push(data[i]);
                return {png: thumb.toDataURL('image/png').split(',')[1], embedded: render(2).toDataURL('image/png'), alpha};
            }, {uri: 'data:image/png;base64,' + master.toString('base64'), width, height});
            const border = silhouette(result.alpha, width, height);
            const imageId = 'image_' + id;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image id="${imageId}" x="0" y="0" width="${width}" height="${height}" xlink:href="${result.embedded}"/><path id="pathborder_${imageId}" d="${border}" fill="none" stroke="none"/></svg>`;
            const png = Buffer.from(result.png, 'base64');
            fs.writeFileSync(path.join(staged, 'pnglibrary', id + '.png'), png);
            fs.writeFileSync(path.join(staged, 'svglibrary', id + '.svg'), svg);

            // Compare the generated path to the actual alpha mask, including holes.
            const match = await page.evaluate(({d, alpha, width, height}) => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fill(new Path2D(d));
                const pixels = ctx.getImageData(0, 0, width, height).data;
                let intersection = 0;
                let union = 0;
                for (let i = 0; i < alpha.length; i++) {
                    const a = alpha[i] >= 64;
                    const b = pixels[i * 4 + 3] >= 128;
                    if (a && b) intersection++;
                    if (a || b) union++;
                }
                return intersection / union;
            }, {d: border, alpha: result.alpha, width, height});
            if (match < 0.999) throw new Error(id + ': invalid silhouette ' + match);
            records.push({id, width, height, scale: animal.scale, masterSha256: hash(master), pngSha256: hash(png), svgSha256: hash(svg), silhouetteIoU: match});
        }
    } finally {
        await browser.close();
    }

    // Every export has been checked before changing the official files.
    const originals = [];
    for (const record of records) {
        for (const [dir, ext] of [['pnglibrary', '.png'], ['svglibrary', '.svg']]) {
            const filename = record.id + ext;
            const original = path.join(app, dir, filename);
            const saved = path.join(backup, dir, filename);
            fs.mkdirSync(path.dirname(saved), {recursive: true});
            if (!fs.existsSync(saved)) fs.copyFileSync(original, saved);
            originals.push({file: dir + '/' + filename, sha256: hash(fs.readFileSync(saved))});
        }
    }
    fs.writeFileSync(path.join(backup, 'manifesto.json'), JSON.stringify({catalogSha256: hash(catalogBytes), files: originals}, null, 2));
    for (const record of records) {
        for (const [dir, ext] of [['pnglibrary', '.png'], ['svglibrary', '.svg']]) {
            fs.copyFileSync(path.join(staged, dir, record.id + ext), path.join(app, dir, record.id + ext));
        }
    }
    if (hash(fs.readFileSync(path.join(app, 'media.json'))) !== hash(catalogBytes)) throw new Error('Catalog changed during promotion');
    const version = fs.readFileSync(path.join(app, 'src/utils/libraryAssets.js'), 'utf8').match(/LIBRARY_ASSET_VERSION\s*=\s*'([^']+)'/)[1];
    fs.writeFileSync(path.join(staged, 'manifesto.json'), JSON.stringify({version, catalogSha256: hash(catalogBytes), records}, null, 2));
    console.log(JSON.stringify({promoted: records.length, silhouetteMinIoU: Math.min(...records.map(r => r.silhouetteIoU)), backup: path.relative(root, backup)}));
}

main().catch(error => {console.error(error); process.exitCode = 1;});
