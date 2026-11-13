const fs=require('fs');const {chromium}=require('playwright');
const dir='art-previews/chibi/construcoes';fs.mkdirSync(dir,{recursive:true});
const snapshot=dir+'/catalogo.json';
const catalog=fs.existsSync(snapshot)?JSON.parse(fs.readFileSync(snapshot,'utf8')):JSON.parse(fs.readFileSync('src/app/media.json')).sprites.filter(a=>!a.legacy&&a.order==='characters,20 Construcoes');
if(!fs.existsSync(snapshot))fs.writeFileSync(snapshot,JSON.stringify(catalog,null,2));
fs.writeFileSync(dir+'/originais.html','<!doctype html><meta charset="utf-8"><style>body{font:18px system-ui;background:#fff6e5}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0;background:white;padding:10px;text-align:center}img{width:240px;height:240px;object-fit:contain}</style><main>'+catalog.map(a=>'<figure><img src="../../../src/app/pnglibrary/'+a.md5.replace('.svg','.png')+'"><figcaption>'+a.name+' · '+a.md5+'</figcaption></figure>').join('')+'</main>');
(async()=>{const b=await chromium.launch();try{const p=await b.newPage({viewport:{width:1200,height:900},javaScriptEnabled:false});await p.goto('http://127.0.0.1:5502/'+dir+'/originais.html');await p.screenshot({path:dir+'/originais.png',fullPage:true});}finally{await b.close()}})();
