const fs=require('fs');
const root='art-previews/chibi';const report=JSON.parse(fs.readFileSync(root+'/auditoria-final/verificacao-editor.json','utf8'));
if(report.count!==168||report.failures.length)throw Error('Full editor audit must pass first');
const remaining=new Set(JSON.parse(fs.readFileSync(root+'/restantes/catalogo.json','utf8')).map(a=>a.md5.replace('.svg','')));
const results=report.results.filter(r=>remaining.has(r.id));
if(results.length!==33)throw Error('Expected 33 final-batch audit results');
fs.writeFileSync(root+'/restantes/exportacao-oficial/verificacao-editor.json',JSON.stringify({count:results.length,version:report.version,failures:[],derivedFrom:'../../auditoria-final/verificacao-editor.json',results},null,2));
const catalog=JSON.parse(fs.readFileSync('src/app/media.json','utf8')).sprites.filter(a=>!a.legacy);
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
let previous='';let cards='';
for(const a of catalog){if(a.order!==previous){previous=a.order;cards+='<h2>'+escape(a.order.split(',')[1].replace(/^\d+ /,''))+'</h2>'}cards+='<figure><img src="../../../src/app/pnglibrary/'+a.md5.replace('.svg','.png')+'?v='+report.version+'" alt="'+escape(a.name)+'"><figcaption>'+escape(a.name)+'</figcaption></figure>'}
fs.writeFileSync(root+'/auditoria-final/index.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Biblioteca chibi completa · 168 artes</title><style>body{font:17px system-ui;color:#513321;background:#fff6e5;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}h2{grid-column:1/-1}figure{margin:0;padding:12px;background:white;border:1px solid #ead9bf;border-radius:16px;text-align:center}img{width:100%;height:150px;object-fit:contain}figcaption{font-size:14px}a{color:inherit}</style><h1>Biblioteca chibi completa · 168 artes</h1><p>Personagens e objetos padronizados, organizados por categoria.</p><p><a href="../restantes/comparacao.html">Comparar as 33 artes do pacote final</a></p><main>'+cards+'</main></html>');
for(const group of ['construcoes','restantes']){const p=root+'/'+group+'/originais.html';if(fs.existsSync(p)){const s=fs.readFileSync(p,'utf8').replaceAll('../../../src/app/pnglibrary/','backup-biblioteca-original/pnglibrary/');fs.writeFileSync(p,s)}}
console.log(JSON.stringify({gallery:catalog.length,finalBatchReport:results.length}));
