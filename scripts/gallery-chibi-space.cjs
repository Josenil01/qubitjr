const fs=require('fs');const crypto=require('crypto');const {chromium}=require('playwright');
const dir='art-previews/chibi/planetas';
const catalog=JSON.parse(fs.readFileSync(dir+'/catalogo.json','utf8'));
const cards=catalog.map(a=>{
 const id=a.md5.replace('.svg','');
 const version=crypto.createHash('sha256').update(fs.readFileSync(dir+'/'+id+'.png')).digest('hex').slice(0,12);
 const original=id==='HY-Sol'?'<p class="empty">Nova arte<br>criada do zero</p>':'<img alt="Original: '+a.name+'" src="backup-biblioteca-original/pnglibrary/'+id+'.png">';
 return '<article><h2>'+a.name+(id==='HY-Urano2'?' · com anel':'')+'</h2><div class="pair"><figure>'+original+'<figcaption>Original</figcaption></figure><figure><a href="'+id+'.png"><img class="new" alt="'+a.name+'" src="'+id+'.png?v='+version+'"></a><figcaption>Chibi com rosto</figcaption></figure></div></article>';
}).join('');
fs.writeFileSync(dir+'/comparacao.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Espaço chibi · 13 artes</title><style>body{margin:24px;font:18px system-ui;background:#fff6e5;color:#513321}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:22px}article{background:white;border:1px solid #ead9bf;border-radius:20px;padding:18px;text-align:center}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{width:100%;height:260px;object-fit:contain;background:repeating-conic-gradient(#f3efe8 0% 25%,white 0% 50%) 0/20px 20px}figure{margin:0}.empty{height:260px;margin:0;display:grid;place-content:center;color:#796656}figcaption{font-size:14px}body:has(#dark:checked) img{background:#292b35}h2{font-size:20px}</style><h1>Espaço com rosto chibi · 13 artes</h1><p>Categoria oficial completa, incluindo o novo Sol, os planetas, Lua, estrela e meteoro. As duas versões de Urano foram preservadas.</p><p><label><input id="dark" type="checkbox"> Comparar em fundo escuro</label></p><main>'+cards+'</main></html>');
(async()=>{const b=await chromium.launch();try{
 const p=await b.newPage({viewport:{width:1440,height:1000},javaScriptEnabled:false});
 await p.goto('http://127.0.0.1:5502/'+dir+'/comparacao.html');
 const images=await p.locator('main img').evaluateAll(imgs=>imgs.map(i=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;if(!c.width)return {loaded:false};const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return {name:i.alt,loaded:i.complete,width:c.width,height:c.height,cornerAlpha:ctx.getImageData(0,0,1,1).data[3]}}));
 if(images.length!==25||images.some(i=>!i.loaded||i.cornerAlpha>5))throw Error(JSON.stringify(images));
 await p.screenshot({path:dir+'/comparacao.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});
 const mobileOverflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(mobileOverflow)throw Error('Mobile overflow');
 fs.writeFileSync(dir+'/verificacao.json',JSON.stringify({images,mobileOverflow},null,2));
 console.log(JSON.stringify({characters:catalog.length,loaded:images.length,transparent:true,mobileOverflow}));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
