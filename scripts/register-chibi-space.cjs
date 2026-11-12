// Add the new visible Sun while preserving the hidden legacy Sun and catalog formatting.
const fs=require('fs');const path=require('path');
const dir='art-previews/chibi/planetas';
const sun={md5:'HY-Sol.svg',width:300,height:300,ext:'svg',name:'Sol',scale:0.6,order:'characters,13 Espaco',tags:['characters','13 Espaco']};
const files=['src/app/media.json','src/app/public/media.json'];
const sources=files.map(p=>fs.readFileSync(p,'utf8'));
if(sources[0]!==sources[1])throw Error('Media catalogs must agree before registration');
const old=JSON.parse(sources[0]);
const originals=JSON.parse(fs.readFileSync(dir+'/catalogo-original.json','utf8'));
const actual=old.sprites.filter(a=>!a.legacy&&a.order===sun.order&&a.md5!==sun.md5);
if(JSON.stringify(actual)!==JSON.stringify(originals))throw Error('Space catalog changed since review');
let result=sources[0];
if(!old.sprites.some(a=>a.md5===sun.md5)) {
 const marker='        {"md5":"Sun.svg"';
 if(!result.includes(marker))throw Error('Legacy Sun insertion anchor missing');
 const eol=result.includes('\r\n')?'\r\n':'\n';
 result=result.replace(marker,'        '+JSON.stringify(sun)+','+eol+marker);
}
const catalog=JSON.parse(result).sprites.filter(a=>!a.legacy&&a.order===sun.order);
if(catalog.length!==13)throw Error('Expected 13 space characters');
for(let i=0;i<files.length;i++) {
 const backup=path.join(dir,'backup-biblioteca-original',i?'public-media.json':'media.json');
 fs.mkdirSync(path.dirname(backup),{recursive:true});
 if(!fs.existsSync(backup))fs.writeFileSync(backup,sources[i]);
 fs.writeFileSync(files[i],result);
}
fs.writeFileSync(dir+'/catalogo.json',JSON.stringify(catalog,null,2));
console.log('Visible Sun registered; 13 space characters; legacy Sun preserved');
