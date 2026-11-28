import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const rows=[];
try{
 for(const width of [390,412,720,768,1199,1200,1440])for(const lang of ['ko','en'])for(const theme of ['light','dark']){
  const key=width+'-'+lang+'-'+theme;
  const images=[],geometry=[];
  for(const port of [8081,8082]){
   const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1,locale:lang==='ko'?'ko-KR':'en-US',timezoneId:'Asia/Seoul',colorScheme:theme,serviceWorkers:'block'});
   try{
    const page=await context.newPage();
    await page.clock.setFixedTime(new Date('2026-11-28T01:00:00Z'));
    await page.addInitScript(t=>{localStorage.setItem('nrfa-theme',t)},theme);
    await page.route('**/*',r=>{const h=new URL(r.request().url()).hostname;return /(^|\.)(google-analytics\.com|googletagmanager\.com|clarity\.ms|onesignal\.com)$/.test(h)?r.abort():r.continue()});
    await page.goto('http://127.0.0.1:'+port+'/UTD/?lang='+lang,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0,null,{timeout:30000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(3000);
    geometry.push(await page.evaluate(()=>Object.fromEntries(['.app-sidebar','.side-controls','#nmHero','#nmCupPanel','#promoRaceStrip','#rankView','#mainContent'].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r?{x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden,parent:e.parentElement?.id||e.parentElement?.className}:null]}))));
    const buf=await page.screenshot({path:join(out,key+'-'+port+'.png'),animations:'disabled'});
    images.push(PNG.sync.read(buf));
   }finally{await context.close()}
  }
  const [a,b]=images,diff=new PNG({width:a.width,height:a.height});
  const pixels=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0,includeAA:true});
  let minX=a.width,minY=a.height,maxX=-1,maxY=-1;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}
  const bounds=maxX<0?null:{minX,minY,maxX,maxY};
  writeFileSync(join(out,key+'-diff.png'),PNG.sync.write(diff));
  rows.push({key,pixels,total:a.width*a.height,ratio:pixels/(a.width*a.height),bounds,geometry});
  writeFileSync(join(out,'summary.json'),JSON.stringify(rows,null,2));
 }
}finally{await browser.close();writeFileSync(join(out,'summary.json'),JSON.stringify(rows,null,2))}
console.log('Pixel comparison: '+JSON.stringify(rows.map(({key,pixels,ratio})=>({key,pixels,ratio}))));
