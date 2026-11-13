// Confirm that every visible catalog entry is backed by a promoted, unchanged PNG/SVG pair.
const fs=require('fs');const path=require('path');const crypto=require('crypto');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const root='art-previews/chibi';const records=new Map();
for(const d of fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory())){
 const file=path.join(root,d.name,'exportacao-oficial/manifesto.json');
 if(!fs.existsSync(file))continue;
 for(const r of JSON.parse(fs.readFileSync(file,'utf8')).records||[]){
  if(records.has(r.id))throw Error('Duplicate promoted ID '+r.id);
  records.set(r.id,{...r,group:d.name});
 }
}
const appCatalog=fs.readFileSync('src/app/media.json','utf8');
if(appCatalog!==fs.readFileSync('src/app/public/media.json','utf8'))throw Error('Media catalogs differ');
const active=JSON.parse(appCatalog).sprites.filter(a=>!a.legacy);const results=[];
for(const a of active){
 const id=a.md5.replace(/\.svg$/,'');const r=records.get(id);
 if(!r)throw Error('Unstandardized entry '+id);
 if(r.width!==Number(a.width)||r.height!==Number(a.height)||r.scale!==a.scale)throw Error('Catalog metadata changed '+id);
 if(hash('src/app/pnglibrary/'+id+'.png')!==r.pngSha256||hash('src/app/svglibrary/'+id+'.svg')!==r.svgSha256)throw Error('Official files differ from approved export '+id);
 results.push({id,group:r.group,width:r.width,height:r.height,scale:r.scale});
}
if(active.length!==168||records.size!==168)throw Error('Expected 168 unique entries');
fs.mkdirSync(root+'/auditoria-final',{recursive:true});
fs.writeFileSync(root+'/auditoria-final/cobertura.json',JSON.stringify({count:active.length,remaining:0,catalogsIdentical:true,results},null,2));
console.log(JSON.stringify({count:active.length,remaining:0,officialHashesMatch:true,catalogsIdentical:true}));
