import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const base=new URL(process.env.SITE_URL||'http://127.0.0.1:8080/UTD/');
const out=process.env.SMOKE_OUTPUT||'smoke-results';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const errors=[];
const sameSite=url=>{try{return new URL(url).origin===base.origin}catch{return false}};
async function run(name,fn){
 try{await fn();results.push({name,ok:true});console.log('PASS '+name)}
 catch(e){results.push({name,ok:false,error:String(e.message).slice(0,1000)});console.error('FAIL '+name+': '+e.message)}
}
async function visible(page,selector){await page.locator(selector).first().waitFor({state:'visible',timeout:20000})}
async function filled(page,selector){
 await page.waitForFunction(sel=>{const n=document.querySelector(sel);return n&&n.children.length>0&&n.textContent.trim().length>0},selector,{timeout:30000});
 await visible(page,selector);
}
async function dismiss(page){
 for(let i=0;i<4;i++){
  for(const [modal,button] of [['#disclaimerModal','.dc-confirm'],['#newsPopupModal','.news-popup-close-x'],['#matchdayPopupModal','.matchday-popup-btn-close']]){
   if(await page.locator(modal).isVisible())await page.locator(modal+' '+button).click({timeout:5000});
  }
  await page.waitForTimeout(250);
 }
}
async function layout(page,mobile){
 const m=await page.evaluate(()=>{
  const shell=document.querySelector('.app-shell'),main=document.querySelector('#mainContent'),side=document.querySelector('#appSidebar');
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}};
  return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,shell:box(shell),main:box(main),side:box(side),seoNav:!!document.querySelector('body > nav[aria-label="경기 기록 바로가기"]')};
 });
 assert.ok(!m.seoNav,'unexpected SEO navigation outside app shell');
 assert.ok(m.main.width>m.width*(mobile?0.70:0.45),'main content is compressed: '+JSON.stringify(m));
 assert.ok(m.main.x>=-4&&m.main.right<=m.width+4,'main content outside viewport: '+JSON.stringify(m));
 assert.ok(m.scroll<=m.width+8,'document horizontally overflows: '+JSON.stringify(m));
 if(!mobile)assert.ok(m.main.x>=m.side.right-4,'sidebar overlaps main content: '+JSON.stringify(m));
}
async function navigate(page,view,mobile){
 // The mobile tab bar intentionally hides on downward scrolling. Return to
 // the top with an upward scroll before exercising the real navigation.
 if(mobile){
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.waitForFunction(()=>{const b=document.querySelector('#mTabbar');return b&&!b.classList.contains('is-hidden')&&b.getBoundingClientRect().top<window.innerHeight;},{},{timeout:10000});
 }
 const button={rank:'viewRankBtn',leagueRank:'viewLeagueRankBtn',rounds:'viewRoundsBtn',stats:'viewStatsBtn',scorers:'viewScorersBtn',squad:'viewSquadBtn',predict:'viewPredictBtn',report:'viewReportBtn'}[view];
 if(!mobile)await page.locator('#'+button).click({timeout:10000});
 else if(['rank','leagueRank','rounds','stats'].includes(view)){
  await page.locator('#mTabbar [data-view="'+view+'"]').click({timeout:10000});
 }else{
  await page.locator('#mTabbar [data-view="more"]').click({timeout:10000});
  await visible(page,'#moreSheetModal');
  await page.locator('#moreSheetModal [data-view="'+view+'"]').click({timeout:10000});
 }
 await visible(page,'#'+view+'View');
}
try{
 for(const mobile of [false,true]){
  const label=mobile?'mobile-390':'desktop-1440';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1,serviceWorkers:'block',reducedMotion:'reduce',locale:'ko-KR'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',r=>{
   if(sameSite(r.url())&&r.status()>=400&&['script','stylesheet'].includes(r.request().resourceType()))pageErrors.push('Local asset HTTP '+r.status()+' '+new URL(r.url()).pathname);
  });
  try{
   await run(label+' homepage and layout',async()=>{
    const response=await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
    assert.ok(response?.ok(),'homepage HTTP error');
    await filled(page,'#mainMiniTableBody');
    await dismiss(page);
    await visible(page,'#rankView');
    await visible(page,mobile?'#mTabbar':'#appSidebar');
    await layout(page,mobile);
   });
   for(const [view,selector] of [['leagueRank','#leagueTableBody'],['rounds','#roundMatchList'],['scorers','#scorersTableBody'],['squad','#teamInfoRecordTab'],['report','#reportViewContent'],['predict','#predictTableBody']]){
    await run(label+' '+view,async()=>{
     await dismiss(page);
     await navigate(page,view,mobile);
     await filled(page,selector);
     if(view==='squad'){
      await page.locator('#tiSquadBtn').click({timeout:10000});
      await filled(page,'#squadGroups');
     }
    });
   }
   await run(label+' FA Cup',async()=>{
    await dismiss(page);
    await page.locator(mobile?'#cupToggleMobile':'#cupToggleSide').click({timeout:10000});
    await filled(page,'#cupViewContent');
    await visible(page,'#cupView');
   });
   await run(label+' poster canvas module',async()=>{
    const ok=await page.evaluate(async()=>{
     if(!window.MatchPoster){
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='poster.js';s.onload=resolve;s.onerror=()=>reject(Error('poster script failed'));document.head.append(s)});
     }
     const p=window.MatchPoster,c=document.createElement('canvas');
     c.width=p.SIZE.w;c.height=p.SIZE.h;const ctx=c.getContext('2d');
     p.drawResultPoster(ctx,c.width,c.height,{homeKo:'테스트 홈',awayKo:'테스트 원정',homeScore:2,awayScore:1,result:'W',isKorean:true,roundLabel:'TEST',weekLabel:'TEST',homeScorers:[],awayScorers:[]});
     return c.toDataURL('image/png').length>1000&&ctx.getImageData(20,20,1,1).data[3]>0;
    });
    assert.ok(ok,'poster canvas did not render');
   });
   await run(label+' JavaScript runtime',async()=>assert.deepEqual(pageErrors,[]));
  }finally{
   await page.screenshot({path:join(out,label+'.png'),fullPage:false,timeout:10000}).catch(()=>{});
   await context.close();
  }
 }
 for(const path of ['matches/','league/','teams/','players/','cup/']){
  await run('SEO '+path,async()=>{
   const res=await fetch(new URL(path,base),{signal:AbortSignal.timeout(15000)});
   assert.ok(res.ok,'HTTP '+res.status);
   const html=await res.text();
   assert.match(html,/<h1>[^<]+<\/h1>/);
   assert.match(html,/<link rel="canonical"/);
  });
 }
}finally{await browser.close();writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2)+'\n');}
if(results.some(r=>!r.ok))process.exitCode=1;
