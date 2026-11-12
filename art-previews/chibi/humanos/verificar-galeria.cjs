const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage({viewport:{width:1440,height:1000},javaScriptEnabled:false});
  await page.goto('http://127.0.0.1:5502/art-previews/chibi/humanos/comparacao.html',{waitUntil:'load',timeout:60000});
  const images = await page.locator('main img').evaluateAll(items => items.map(img => {
   const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
   if (!c.width || !c.height) return {name:img.alt,loaded:false};
   const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
   return {name:img.alt,loaded:img.complete,width:c.width,height:c.height,cornerAlpha:ctx.getImageData(0,0,1,1).data[3]};
  }));
  if(images.length!==30 || images.some(i=>!i.loaded || i.cornerAlpha>5)) throw new Error(JSON.stringify(images));
  await page.screenshot({path:path.join(__dirname,'comparacao.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) throw new Error('Mobile overflow');
  fs.writeFileSync(path.join(__dirname,'verificacao.json'),JSON.stringify({date:new Date().toISOString(),count:images.length,mobileOverflow:overflow,images},null,2));
  console.log(JSON.stringify({count:images.length,loaded:true,transparent:true,mobileOverflow:overflow}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
