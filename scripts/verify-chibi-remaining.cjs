// Read-only integration check against the real Vite editor modules.
// Start Vite, then: node scripts/verify-chibi-remaining.cjs
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'art-previews/chibi/restantes/exportacao-oficial');
const base = process.env.ANIMAL_LIBRARY_URL || 'http://127.0.0.1:3000';

async function main() {
    console.log('Final batch check: launching browser');
    const browser = await chromium.launch({headless: true});
    try {
        const page = await browser.newPage({viewport: {width: 1280, height: 900}});
        page.on('pageerror', error => console.error('Editor error:', error.message));
        page.on('console', message => {
            if (message.text().startsWith('Final batch check:')) console.log(message.text());
        });
        await page.route('**/__animal_check', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><style>body{font:16px system-ui;background:#fff6e5;color:#513321;padding:20px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}figure{margin:0;padding:10px;background:white;border:1px solid #ead9bf;border-radius:12px}.assetbox{width:160px;height:160px;position:relative}figcaption{text-align:center;font-size:13px}img{object-fit:contain}</style></head><body><h1>Biblioteca oficial · Pacote final</h1><p>Miniaturas criadas pelo módulo Library do aplicativo.</p><main id="animals"></main></body></html>'}));
        const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
        const approved = read(path.join(root, 'art-previews/chibi/restantes/catalogo.json')).map(a => a.md5);
        await page.route('**/__human_ids', route => route.fulfill({contentType:'application/json',body:JSON.stringify(approved)}));
        await page.goto(base + '/__animal_check');
        console.log('Final batch check: editor fixture ready');
        const report = await page.evaluate(async () => {
            function deadline(promise, label) {
                let timer;
                return Promise.race([promise, new Promise((resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('Timeout: ' + label)), 15000);
                })]).finally(() => clearTimeout(timer));
            }
            console.log('Final batch check: settings');
            window.Settings = await (await fetch('/settings.json')).json();
            console.log('Final batch check: modules');
            const [{default: IO}, {default: MediaLib}, {default: Library}, {default: Sprite}, {default: SVG2Canvas}, {default: SVGTools}, {default: PNGCache}, {LIBRARY_ASSET_VERSION}] = await deadline(Promise.all([
                import('/src/iPad/IO.js'), import('/src/iPad/MediaLib.js'), import('/src/editor/ui/Library.js'),
                import('/src/editor/engine/Sprite.js'), import('/src/utils/SVG2Canvas.js'),
                import('/src/painteditor/SVGTools.js'), import('/src/painteditor/PNGCache.js'), import('/src/utils/libraryAssets.js')
            ]), 'editor modules');
            // Supply the real IO/iOS bridge, not a patched module singleton:
            // Vite HMR can give imports separate module instances during checks.
            // This adapter performs no auth, database or project writes.
            window.tabletInterface = {
                io_gettextresource: (url, done) => fetch(url).then(r => {
                    if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
                    return r.text();
                }).then(done)
            };
            console.log('Final batch check: media catalog');
            await deadline(new Promise(resolve => MediaLib.loadMediaLib('/', resolve)), 'media catalog');
            window.PNGCache = PNGCache;
            const catalog = await (await fetch('/media.json')).json();
            const labels = Object.fromEntries(catalog.sprites.map(a => [a.md5, a.name]));
            const approved = await (await fetch('/__human_ids')).json();
            const animals = Library.currentSprites().filter(a => approved.includes(a.md5));
            const results = [];
            const failures = [];
            for (const animal of animals) {
                const id = animal.md5.replace(/\.svg$/, '');
                console.log('Final batch check: ' + id);
                const figure = document.createElement('figure');
                document.querySelector('#animals').append(figure);
                const thumb = Library.addLocalThumbChoose(figure, animal, 150, 150, () => {});
                const label = document.createElement('figcaption');
                label.textContent = labels[animal.md5];
                figure.append(label);
                const thumbImg = thumb.querySelector('img');
                await deadline(thumbImg.decode(), id + ' thumbnail');
                const cache = await deadline(PNGCache.loadPNG(id), id + ' PNGCache');
                const sprite = {md5: animal.md5, setSVG: Sprite.prototype.setSVG};
                const url = await deadline(new Promise(resolve => Sprite.prototype.getAsset.call(sprite, resolve)), id + ' Sprite.getAsset');
                const img = new Image();
                img.src = url;
                await deadline(img.decode(), id + ' stage image');
                sprite.img = img;
                sprite.originalImg = img;
                sprite.outline = document.createElement('canvas');
                SVG2Canvas.drawInCanvas(sprite);
                Sprite.prototype.drawBorder.call(sprite);
                await deadline(new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), id + ' rendering');
                const actual = sprite.outline.getContext('2d').getImageData(0, 0, animal.width, animal.height).data;
                const expected = cache.getContext('2d').getImageData(0, 0, animal.width, animal.height).data;
                let intersection = 0;
                let union = 0;
                for (let i = 3; i < actual.length; i += 4) {
                    const a = actual[i] >= 128;
                    const b = expected[i] >= 64;
                    if (a && b) intersection++;
                    if (a || b) union++;
                }
                const iou = intersection / union;
                const dimensions = [img.naturalWidth, img.naturalHeight, thumbImg.naturalWidth, thumbImg.naturalHeight, cache.width, cache.height];
                const expectedDimensions = [animal.width, animal.height, animal.width, animal.height, animal.width, animal.height];
                const watermark = SVGTools.getWatermark(sprite.svg, '#B3B3B3', id);
                const ok = iou >= 0.99 && dimensions.every((value, i) => value === expectedDimensions[i]) &&
                    thumbImg.src.includes('v=' + LIBRARY_ASSET_VERSION) && watermark === cache && !SVG2Canvas.svgerror;
                results.push({id, dimensions, silhouetteIoU: iou, watermark: watermark === cache, ok});
                if (!ok) failures.push(id);
            }
            return {count: animals.length, version: LIBRARY_ASSET_VERSION, failures, results};
        });
        fs.writeFileSync(path.join(output, 'verificacao-editor.json'), JSON.stringify(report, null, 2));
        await page.screenshot({path: path.join(output, 'biblioteca-oficial.png'), fullPage: true});
        console.log(JSON.stringify({checked: report.count, failures: report.failures, minEngineSilhouetteIoU: Math.min(...report.results.map(r => r.silhouetteIoU))}));
        if (report.count !== 33 || report.failures.length) throw new Error('Official extras integration failed');
    } finally {
        await browser.close();
    }
}

main().catch(error => {console.error(error); process.exitCode = 1;});
