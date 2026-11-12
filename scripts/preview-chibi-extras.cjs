const fs=require('fs');const path=require('path');const {chromium}=require('playwright');
const dir='art-previews/chibi/animais-miticos';fs.mkdirSync(dir,{recursive:true});
const ids=['HY-DinoSinoceratops','HY-Dragao','HY-Boitata','HY-MulaSemCabeca','HY-PapagaioPirata','HY-CapiravaBicicleta'];
const catalog=JSON.parse(fs.readFileSync('src/app/media.json')).sprites.filter(a=>ids.includes(a.md5.replace(/\.svg$/,''))&&!a.legacy);
fs.writeFileSync(dir+'/catalogo.json',JSON.stringify(catalog,null,2));
const html='<!doctype html><meta charset="utf-8"><style>body{font:20px sans-serif;background:#fff6e5}main{display:grid;grid-template-columns:repeat(3,1fr)}figure{background:white;padding:15px}img{width:300px;height:300px;object-fit:contain}</style><main>'+catalog.map(a=>'<figure><img src="../../../src/app/pnglibrary/'+a.md5.replace('.svg','.png')+'"><figcaption>'+a.name+'</figcaption></figure>').join('')+'</main>';
fs.writeFileSync(dir+'/originais.html',html);
(async()=>{const b=await chromium.launch();try{const p=await b.newPage({viewport:{width:1200,height:900},javaScriptEnabled:false});await p.goto('http://127.0.0.1:5502/'+dir+'/originais.html');await p.screenshot({path:dir+'/originais.png',fullPage:true});}finally{await b.close()}})();
