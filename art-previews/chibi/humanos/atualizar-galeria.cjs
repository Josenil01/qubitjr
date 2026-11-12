const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const ordinary = read(path.join(__dirname, 'catalogo.json'));
const others = read(path.join(__dirname, '../humanoides/catalogo.json'));
const ordinaryIds = new Set(ordinary.map(a => a.md5));
const all = ordinary.concat(others).sort((a, b) => a.order.localeCompare(b.order) || a.name.localeCompare(b.name, 'pt-BR'));
let previous = '';
let cards = '';
for (const item of all) {
    if (item.order !== previous) {
        previous = item.order;
        cards += '<h2 style="grid-column:1/-1;margin:20px 0 0">' + item.order.split(',')[1].replace(/^\d+ /, '') + '</h2>';
    }
    const id = item.md5.replace(/\.svg$/, '');
    const src = (ordinaryIds.has(item.md5) ? '' : '../humanoides/') + id + '.png';
    const file = path.join(__dirname, src);
    const version = fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12) : 'pendente';
    const label = item.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    cards += `<figure><a href="${src}"><img src="${src}?v=${version}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
}
const file = path.join(__dirname, 'comparacao.html');
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/<main>[\s\S]*?<\/main>/, '<main>' + cards + '</main>');
html = html.replace('Personagens humanos · lote completo', 'Personagens humanos e humanoides · 30 artes');
html = html.replace('Oito personagens de Família e Profissões, seguindo as duas amostras aprovadas.', 'Trinta personagens de Família, Profissões, Turma Qubit, Fantasia, Folclore, Piratas, Halloween e Transportes.');
fs.writeFileSync(file, html);
console.log(JSON.stringify({characters: all.length}));
