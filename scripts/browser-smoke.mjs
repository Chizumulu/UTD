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
// CI must not inflate real GA4/Clarity visitor or event statistics.
async function blockAnalytics(context){
 await context.route(/^https:\/\/(?:[^/]+\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|clarity\.ms|doubleclick\.net)(?:\/|$)/i,route=>route.abort());
}
async function analyticsEvents(page,name='utd_screen_view'){
 return page.evaluate(n=>(window.dataLayer||[]).filter(x=>x?.[0]==='event'&&x[1]===n).map(x=>x[2]),name);
}
async function analyticsScreen(page,group,extra={}){
 await page.waitForFunction(({group,extra})=>{
  const e=(window.dataLayer||[]).filter(x=>x?.[0]==='event'&&x[1]==='utd_screen_view').at(-1)?.[2];
  return e?.screen_group===group&&Object.entries(extra).every(([k,v])=>e[k]===v);
 },{group,extra},{timeout:15000});
 return (await analyticsEvents(page)).at(-1);
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
  await blockAnalytics(context);
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
    if(base.hostname==='127.0.0.1'){
     await page.waitForFunction(()=>Array.from(document.querySelectorAll('#mainMiniTableBody img[srcset]')).some(img=>img.complete&&img.naturalWidth>0&&img.currentSrc.includes('/crest-assets/')));
     const logos=await page.locator('#mainMiniTableBody img[srcset]').evaluateAll(imgs=>imgs.map(img=>({src:img.getAttribute('src'),current:img.currentSrc,width:img.naturalWidth})));
     assert.ok(logos.length>=10,'responsive league crests missing');
     assert.ok(logos.every(img=>img.src&&!img.src.includes('crest-assets/')),'original fallback lost');
     console.log(label+' responsive crests: '+JSON.stringify(logos));
     // Mini standings render before home match strips in the initial DOMContentLoaded handler.
     // Wait for actual strip content, then require raster crests to load responsive candidates.
     await page.waitForFunction(()=>['homeRecentStrip','homeUpcomingStrip'].every(id=>document.getElementById(id)?.children.length>0),null,{timeout:20000});
     await page.waitForFunction(()=>Array.from(document.querySelectorAll('#homeRecentStrip img.home-match-crest, #homeUpcomingStrip img.home-match-crest')).some(img=>img.hasAttribute('srcset')&&img.complete&&img.naturalWidth>0&&img.currentSrc.includes('/crest-assets/')),null,{timeout:20000});
     const strips=await page.locator('img.home-match-crest').evaluateAll(imgs=>imgs.filter(img=>/\.(webp|png|jpe?g)(?:[?#].*)?$/i.test(img.getAttribute('src')||'')).map(img=>({src:img.getAttribute('src'),srcset:img.getAttribute('srcset'),current:img.currentSrc})));
     assert.ok(strips.length>0,'home match raster crests missing');
     assert.ok(strips.every(img=>img.srcset),'home match crest missing responsive source');
     console.log(label+' home match crests: '+JSON.stringify(strips));
     assert.equal(await page.locator('img.league-logo[srcset],img.archive-hero-logo[srcset]').count(),2,'static NRFA responsive sources missing');
    }
    await dismiss(page);
    await visible(page,'#rankView');
    await visible(page,mobile?'#mTabbar':'#appSidebar');
    await layout(page,mobile);
    await analyticsScreen(page,'home',{entry_type:'entry'});
    assert.equal((await analyticsEvents(page)).length,1,'initial home must count once');
   });
   for(const [view,selector] of [['leagueRank','#leagueTableBody'],['rounds','#roundMatchList'],['scorers','#scorersTableBody'],['squad','#teamInfoRecordTab'],['report','#reportViewContent'],['predict','#predictTableBody']]){
    await run(label+' '+view,async()=>{
     await dismiss(page);
     await navigate(page,view,mobile);
     await filled(page,selector);
     await analyticsScreen(page,({leagueRank:'league',squad:'club'})[view]||view);
     if(view==='leagueRank'){
      const count=(await analyticsEvents(page)).length;
      await page.evaluate(()=>{window.showView('leagueRank');window.showView('leagueRank')});
      await page.waitForTimeout(100);
      assert.equal((await analyticsEvents(page)).length,count,'re-render must not add a screen view');
     }
     if(view==='squad'){
      await page.locator('#tiSquadBtn').click({timeout:10000});
      await filled(page,'#squadGroups');
      await analyticsScreen(page,'club',{screen_tab:'squad'});
     }
    });
   }
   await run(label+' FA Cup',async()=>{
    await dismiss(page);
    await page.locator(mobile?'#cupToggleMobile':'#cupToggleSide').click({timeout:10000});
    await filled(page,'#cupViewContent');
    await visible(page,'#cupView');
    const first=await analyticsScreen(page,'cup');
    assert.ok(['faCup2627','mmbelwaCup'].includes(first.competition_id));
    await page.locator('#cupViewContent .cup-chip[onclick*="mmbelwaCup"]').click({timeout:10000});
    await analyticsScreen(page,'cup',{competition_id:'mmbelwaCup'});
    await page.locator('#cupTabsWrap [data-cup-tab="teams"]').click({timeout:10000});
    await analyticsScreen(page,'cup',{competition_id:'mmbelwaCup',screen_tab:'teams'});
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
   await run(label+' analytics deep link and privacy',async()=>{
    const deep=await context.newPage();
    try {
     await deep.goto(new URL('#/club/chizumulu-united-fc/squad',base).href,{waitUntil:'domcontentloaded',timeout:45000});
     await analyticsScreen(deep,'club',{team_id:'chizumulu-united-fc',screen_tab:'squad',entry_type:'entry'});
     const events=await analyticsEvents(deep);
     assert.equal(events.length,1,'deep link must not count home first');
     assert.ok(events.every(e=>!e.page_location.includes('#')&&!e.page_location.includes('?')));
    }finally{await deep.close()}
   });
   await run(label+' archive navigation and history',async()=>{
    const archive=await context.newPage();
    const archiveErrors=[];
    archive.on('pageerror',e=>archiveErrors.push(e.message));
    try {
     await archive.goto(new URL('#/archive/weekly',base).href,{waitUntil:'domcontentloaded',timeout:45000});
     await dismiss(archive);
     await visible(archive,'#archiveWeeklyPane');
     await analyticsScreen(archive,'archive');
     await archive.locator('#archiveNavClubs').click();
     await visible(archive,'#archiveClubsPane');
     await archive.waitForFunction(()=>location.hash.includes('archive/clubs'));
     await archive.goBack();
     await visible(archive,'#archiveWeeklyPane');
     await archive.goForward();
     await visible(archive,'#archiveClubsPane');
     await archive.locator('#archiveNavMain').click();
     await visible(archive,'#archiveMainPane');
     await archive.evaluate(()=>window.exitSeasonArchive());
     await visible(archive,'#rankView');
     await archive.evaluate(()=>window.openSeasonArchive({tab:'weekly'}));
     await visible(archive,'#archiveWeeklyPane');
     await archive.evaluate(()=>window.exitSeasonArchive());
     await visible(archive,'#rankView');
     assert.deepEqual(archiveErrors,[]);
    }finally{await archive.close()}
   });
   await run(label+' archive load failure and retry',async()=>{
    const isolated=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},serviceWorkers:'block'});
    await blockAnalytics(isolated);
    const p=await isolated.newPage();
    const runtime=[];
    p.on('pageerror',e=>runtime.push(e.message));
    let requests=0;
    await p.route(/\/archive-2526\.js(?:\?|$)/,route=>{requests++;return requests===1?route.abort():route.continue()});
    try{
     await p.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
     await filled(p,'#mainMiniTableBody');
     await dismiss(p);
     await p.evaluate(()=>window.openSeasonArchive());
     await p.waitForFunction(()=>document.body.style.cursor!=='progress');
     assert.equal(requests,1);
     assert.ok(!await p.locator('body').evaluate(e=>e.classList.contains('season-archive')));
     await p.evaluate(()=>window.openSeasonArchive({tab:'weekly'}));
     await visible(p,'#archiveWeeklyPane');
     assert.equal(requests,2);
     assert.deepEqual(runtime,[]);
    }finally{await isolated.close()}
   });
   await run(label+' archive slow request must not override later navigation',async()=>{
    const isolated=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},serviceWorkers:'block'});
    await blockAnalytics(isolated);
    const p=await isolated.newPage();
    let release,started;
    const held=new Promise(resolve=>{release=resolve});
    const requested=new Promise(resolve=>{started=resolve});
    await p.route(/\/archive-2526\.js(?:\?|$)/,async route=>{started();await held;await route.continue()});
    try{
     await p.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
     await filled(p,'#mainMiniTableBody');
     await dismiss(p);
     await p.evaluate(()=>window.openSeasonArchive());
     await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(Error('archive request did not start')),10000))]);
     await p.evaluate(()=>window.showView('leagueRank'));
     await visible(p,'#leagueRankView');
     release();
     await p.waitForFunction(()=>typeof ARCHIVE_2526!=='undefined'&&document.body.style.cursor!=='progress');
     await p.waitForTimeout(150);
     assert.ok(!await p.locator('body').evaluate(e=>e.classList.contains('season-archive')),'late archive response reopened a screen the visitor left');
     await visible(p,'#leagueRankView');
    }finally{release();await isolated.close()}
   });
   await run(label+' archive latest request wins',async()=>{
    const isolated=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},serviceWorkers:'block'});
    await blockAnalytics(isolated);
    const p=await isolated.newPage();
    let release,started;
    const held=new Promise(resolve=>{release=resolve});
    const requested=new Promise(resolve=>{started=resolve});
    let requests=0;
    await p.route(/\/archive-2526\.js(?:\?|$)/,async route=>{requests++;started();await held;await route.continue()});
    try{
     await p.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
     await filled(p,'#mainMiniTableBody');
     await dismiss(p);
     await p.evaluate(()=>window.openSeasonArchive({tab:'main'}));
     await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(Error('archive request did not start')),10000))]);
     await p.evaluate(()=>window.openSeasonArchive({tab:'clubs'}));
     release();
     await visible(p,'#archiveClubsPane');
     await p.waitForFunction(()=>location.hash.includes('archive/clubs'));
     assert.equal(requests,1);
     assert.ok(!await p.locator('#archiveMainPane').isVisible());
    }finally{release();await isolated.close()}
   });
   await run(label+' JavaScript runtime',async()=>assert.deepEqual(pageErrors,[]));
  }finally{
   await page.screenshot({path:join(out,label+'.png'),fullPage:false,timeout:10000}).catch(()=>{});
   await context.close();
  }
 }
 // Startup diagnostics: attach listeners before any document scripts execute.
 // This is a separate diagnostic context, not a change to production HTML.
 for(const scenario of ['tablet-cold','tablet-delayed-scripts','tablet-missing-round-tools']){
  await run(scenario+' startup',async()=>{
   const ctx=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block',locale:'ko-KR'});
   await blockAnalytics(ctx);
   const p=await ctx.newPage();
   const faults=[];
   p.on('pageerror',e=>faults.push(String(e.stack||e.message)));
   p.on('response',r=>{if(sameSite(r.url())&&r.status()>=400&&['script','stylesheet'].includes(r.request().resourceType()))faults.push('Local asset HTTP '+r.status()+' '+new URL(r.url()).pathname)});
   let injected=0;
   if(scenario==='tablet-delayed-scripts'){
    await p.route(/\/(?:app|data|a11y|lang-ny)\.js(?:\?|$)/,async route=>{
     if(sameSite(route.request().url())){injected++;await new Promise(resolve=>setTimeout(resolve,650));}
     await route.continue();
    });
   }
   if(scenario==='tablet-missing-round-tools'){
    // Controlled incompatible-markup case; not proof of a historical cache mismatch.
    await p.route(url=>url.origin===base.origin&&url.pathname===base.pathname,async route=>{
     if(!route.request().isNavigationRequest())return route.continue();
     const response=await route.fetch();
     const html=await response.text();
     assert.match(html,/id="roundTools"/);
     injected++;
     await route.fulfill({response,body:html.replace('id="roundTools"','id="roundToolsDiagnosticMissing"')});
    });
   }
   try{
    for(let attempt=0;attempt<(scenario==='tablet-missing-round-tools'?1:3);attempt++){
     if(attempt===0)await p.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
     else await p.reload({waitUntil:'domcontentloaded',timeout:45000});
     // No clicks: replicate the reported error within a second of initial entry.
     await p.waitForTimeout(2200);
     if(faults.length)throw Error('Startup page errors: '+faults.join('\n').slice(0,1800));
     await p.waitForFunction(()=>{const n=document.querySelector('#mainMiniTableBody');return n&&n.children.length>0&&n.textContent.trim().length>0},null,{timeout:15000});
     assert.deepEqual(faults,[]);
    }
    if(scenario!=='tablet-cold')assert.ok(injected>0,'diagnostic interception did not run');
   }finally{
    await p.screenshot({path:join(out,scenario+'.png'),fullPage:false,timeout:5000}).catch(()=>{});
    await ctx.close();
   }
  });
 }
 await run('automatic notices wait, preserve order and acknowledge once',async()=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',serviceWorkers:'block',reducedMotion:'reduce',locale:'ko-KR'});
  await blockAnalytics(ctx);
  const p=await ctx.newPage();
  const faults=[];
  p.on('pageerror',e=>faults.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('nrfa-pwa-visit-count','2'));
  // Test-only fixtures: the production news has expired; supply one match for any test date.
  await p.route(/\/app\.js(?:\?|$)/,async route=>{
   const res=await route.fetch(),src=await res.text();
    const expiry=/\bconst\s+NEWS_POPUP_EXPIRES_AT\s*=\s*[^;]+;/;
    const matches=/\bfunction\s+collectTodayMatches\s*\(\s*\)\s*\{/;
    assert.match(src,expiry,'news expiry fixture target missing');
    assert.match(src,matches,'matchday fixture target missing');
    const edited=src.replace(expiry,'const NEWS_POPUP_EXPIRES_AT = Date.now()+86400000;')
     .replace(matches, "function collectTodayMatches() { return [{m:{homeEn:'Chizumulu United FC',homeKo:'치주물루',awayEn:'Mafu Stars FC',awayKo:'마푸',kickoffTime:'15:00'},ms:Date.now(),pos:19}];");
    assert.notEqual(edited,src);
   await route.fulfill({response:res,body:edited});
  });
  try{
   await p.goto(base.href,{waitUntil:'domcontentloaded',timeout:45000});
   await visible(p,'#disclaimerModal');
   // The install delay is allowed to expire without dismissing the first modal.
   await p.waitForTimeout(15500);
   for(const id of ['newsPopupModal','matchdayPopupModal','pwaInstallBanner'])assert.ok(!await p.locator('#'+id).isVisible(),id+' overlapped disclaimer');
   await p.locator('#disclaimerModal .dc-confirm').click();
   await visible(p,'#newsPopupModal');
   assert.ok(!await p.locator('#disclaimerModal').isVisible());
   assert.ok(!await p.locator('#matchdayPopupModal').isVisible());
   await p.locator('#newsPopupModal .news-popup-close-x').click();
   await visible(p,'#matchdayPopupModal');
   assert.ok(!await p.locator('#newsPopupModal').isVisible());
   assert.ok(!await p.locator('#pwaInstallBanner').isVisible());
   // Open a visitor-requested dialog before the next automatic notice.
   await p.evaluate(()=>{closeMatchdayPopup();openIosGuideModal()});
   await visible(p,'#iosGuideModal');
   await p.waitForTimeout(700);
   assert.ok(!await p.locator('#pwaInstallBanner').isVisible());
   await p.evaluate(()=>closeIosGuideModal());
   await visible(p,'#pwaInstallBanner');
   await p.locator('#pwaInstallBanner .pwa-install-banner-close').click();
   await p.reload({waitUntil:'domcontentloaded',timeout:45000});
   await visible(p,'#disclaimerModal');
   await p.locator('#disclaimerModal .dc-confirm').click();
   await p.waitForTimeout(800);
   assert.ok(!await p.locator('#newsPopupModal').isVisible());
   assert.ok(!await p.locator('#matchdayPopupModal').isVisible());
   assert.ok(!await p.locator('#pwaInstallBanner').isVisible());
   assert.deepEqual(faults,[]);
  }finally{await ctx.close()}
 });
 const seoContext=await browser.newContext({serviceWorkers:'block'});
 await blockAnalytics(seoContext);
 try{
  await run('SEO analytics real landing page',async()=>{
   const page=await seoContext.newPage();
   await page.goto(new URL('matches/',base).href,{waitUntil:'domcontentloaded',timeout:45000});
   await analyticsScreen(page,'seo',{screen_tab:'matches',entry_type:'entry'});
   assert.equal((await analyticsEvents(page)).length,1);
   assert.equal(await page.evaluate(()=>(window.dataLayer||[]).filter(x=>x?.[0]==='config'&&x[1]==='G-N6GC687TZD').length),1);
  });
 }finally{await seoContext.close()}
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
