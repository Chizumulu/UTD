import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [before,after,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const profiles=[['desktop',1440,900,'ko','light'],['mobile',390,844,'ko','light'],['dark-en',360,780,'en','dark'],['tablet-ny',768,1024,'ny','light']];
const cases=[['hero',null,'#nextMatchStrip','#nextMatchStrip .nmh-top'],['rank',()=>showView('leagueRank'),'#leagueRankView','#leagueTableBody tr'],['teamcompare',()=>showView('teamCompare'),'#teamCompareView','.tc-card']];
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
const records=[];
async function capture(base,profile,c,side){
 const [name,width,height,lang,theme]=profile;
 const [view,action,root,ready]=c;
 const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block',timezoneId:'Asia/Seoul'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
  await page.clock.setFixedTime(new Date('2026-11-28T00:00:00Z'));
  await page.addInitScript(()=>localStorage.setItem('nrfa-disclaimer-hide-until',String(Number.MAX_SAFE_INTEGER)));
  await page.goto(new URL('?lang='+lang,base).href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
  if(theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  if(action)await page.evaluate(action);
  await page.locator(ready).first().waitFor({state:'visible'});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(500);
  const state=await page.evaluate(root=>{
   const r=document.querySelector(root);
   const props=['display','position','color','background-color','background-image','font-family','font-size','font-weight','line-height','padding','margin','gap','border','border-radius','box-shadow','align-items','justify-content','grid-template-columns','width','height','visibility','object-fit'];
   const elements=[r,...r.querySelectorAll('*')].filter(e=>e.getClientRects().length).map(e=>{
    const s=getComputedStyle(e),b=e.getBoundingClientRect();
    return {tag:e.tagName,cls:typeof e.className==='string'?e.className:e.getAttribute('class'),size:[b.width,b.height].map(x=>Math.round(x*100)/100),style:props.map(p=>s.getPropertyValue(p).replaceAll(location.origin,'<origin>'))};
   });
   const fonts=[...document.querySelector('#utd-pretendard-fonts').sheet.cssRules].map(r=>r.cssText.replaceAll(location.origin,'<origin>'));
   return {elements,fonts};
  },root);
  await page.locator(root).screenshot({path:join(out,name+'-'+view+'-'+side+'.png'),animations:'disabled',timeout:30000});
  let fallback=null;
  if(view==='hero'){
   fallback=await page.evaluate(()=>{
    const box=document.createElement('div');document.body.appendChild(box);
    for(let i=0;i<100;i++){const img=document.createElement('img');img.dataset.fallbackListenerAdded='true';box.appendChild(img);}
    const cases=[undefined,'','0','false','true'].map((v,i)=>{
     const img=document.createElement('img');img.alt='Example FC';img.className=i===0?'team-logo':'team-logo-sm';
     if(v!==undefined)img.dataset.fallbackListenerAdded=v;
     box.appendChild(img);return img;
    });
    const original=document.querySelectorAll;
    let scanned=0;
    document.querySelectorAll=function(s){const nodes=original.call(this,s);if(s.startsWith('img'))scanned+=nodes.length;return nodes};
    try{attachImageFallback()}finally{document.querySelectorAll=original}
    const flags=cases.map(img=>{img.dispatchEvent(new Event('error'));return [img.dataset.fallbackListenerAdded,img.dataset.fallbackApplied||null,img.getAttribute('src')]});
    box.remove();return {flags,scanned};
   });
  }
  assert.deepEqual(errors,[],'Runtime errors '+side+' '+name+' '+view);
  return {state,fallback};
 }finally{await context.close()}
}
try{
 for(const p of profiles)for(const c of cases){
  const label=p[0]+'/'+c[0];
  try{
   const a=await capture(before,p,c,'before'),b=await capture(after,p,c,'after');
   assert.deepEqual(b.state.fonts,a.state.fonts,'Font CSSOM differs');
   assert.deepEqual(b.state.elements,a.state.elements,'Computed design differs');
   if(a.fallback){assert.deepEqual(a.fallback.flags,b.fallback.flags,'Image error semantics differ');assert.ok(b.fallback.scanned<a.fallback.scanned,'No scan reduction');}
   records.push({label,status:'pass',elements:a.state.elements.length,fontRules:a.state.fonts.length,scanBefore:a.fallback?.scanned,scanAfter:b.fallback?.scanned});
   console.log('Pinned design PASS '+JSON.stringify(records.at(-1)));
  }catch(e){records.push({label,status:'fail',error:String(e).slice(0,8000)});console.log('Pinned design FAIL '+label+' '+String(e).slice(0,2000));}
  finally{writeFileSync(join(out,'results.json'),JSON.stringify(records,null,2))}
 }
}finally{await browser.close()}
if(records.some(r=>r.status!=='pass')||records.length!==profiles.length*cases.length)process.exitCode=1;
