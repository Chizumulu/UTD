import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const [base,cssPath,out]=process.argv.slice(2);
if(!base||!cssPath||!out)throw Error('Usage: css-audit-browser.mjs base cssPath out');
const css=readFileSync(cssPath,'utf8'),samples=[],failures=[];
mkdirSync(out,{recursive:true});
let browser;
const scenarios=[
 ['home',null,'#mainMiniTableBody'],
 ['rank',()=>showView('leagueRank'),'#leagueRankView'],
 ['rounds',()=>showView('rounds'),'#roundsView'],
 ['scorers',()=>showView('scorers'),'#scorersView'],
 ['club',()=>showView('squad'),'#squadView'],
 ['report',()=>showView('report'),'#reportView'],
 ['prediction',()=>{location.hash='#/predict/outlook'},'#predictTableBody .pt-c-rank'],
 ['venue-travel',()=>{setVenueMode('travel');showView('venues')},'#venueModeTravel'],
 ['venue-map',()=>{showView('venues');setVenueMode('map')},'#venueLeafletMap button'],
 ['archive',()=>openSeasonArchive({tab:'weekly'}),'#archiveWeeklyPane'],
 ['season-compare',()=>{location.hash='#/stats/compare'},'#seasonCompareCard'],
 ['cup',null,'#cupViewContent button','#cupToggleSide'],
 ['player',()=>openPlayerModal(topScorersData[0].key),'#playerTimeline'],
 ['squad-player',()=>openSquadPlayerModal(squadData.find(x=>x.number!=null).number),'#squadPlayerModalName'],
 ['sponsors',()=>{showView('squad');applyTeamInfoTab('overview')},'#teamInfoStoryTab .ti-sponsor-card'],
 ['postponed',()=>{showView('rounds');openPostponedMatchesModal()},'#postponedMatchesModal']
];
const profiles=[{name:'desktop',width:1440,height:900,lang:'ko',theme:'light'},{name:'mobile',width:390,height:844,lang:'ko',theme:'light'},{name:'mobile-dark-en',width:360,height:780,lang:'en',theme:'dark'},{name:'tablet-ny',width:768,height:1024,lang:'ny',theme:'light'}];
const expected=profiles.flatMap(p=>scenarios.map(s=>p.name+'/'+s[0]));
writeFileSync(join(out,'manifest.json'),JSON.stringify({expected},null,2));
try{
 browser=await chromium.launch({headless:true});
 for(const profile of profiles)for(const [name,action,selector,click] of scenarios){
  const label=profile.name+'/'+name,context=await browser.newContext({viewport:{width:profile.width,height:profile.height},colorScheme:profile.theme,serviceWorkers:'block'});
  const page=await context.newPage(),pageErrors=[],consoleErrors=[],localFailures=[],localHttpErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,2000))});
  page.on('requestfailed',r=>{if(r.url().startsWith(new URL(base).origin+'/'))localFailures.push({url:r.url(),error:r.failure()?.errorText})});
  page.on('response',r=>{if(r.url().startsWith(new URL(base).origin+'/')&&r.status()>=400)localHttpErrors.push({url:r.url(),status:r.status()})});
  try{
   await page.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===new URL(base).origin?r.continue():r.abort()});
   await page.coverage.startCSSCoverage({resetOnNavigation:false});
   await page.goto(new URL('?lang='+profile.lang,base).href,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0,{},{timeout:15000});
   if(profile.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   if(action)await page.evaluate(action);
   if(name==='sponsors'){
    await page.locator('#squadView').waitFor({state:'visible',timeout:15000});
    await page.evaluate(()=>applyTeamInfoTab('story'));
   }
   if(click)await page.evaluate(()=>{const b=document.querySelector('#cupToggleSide');if(!b)throw Error('Cup toggle unavailable');b.click()});
   await page.locator(selector).first().waitFor({state:'visible',timeout:15000});
   if(name==='prediction'){
    const disclaimer=page.locator('#disclaimerModal');
    await disclaimer.waitFor({state:'visible',timeout:15000});
    await disclaimer.locator('button.disclaimer-confirm-btn').click({timeout:15000});
    await disclaimer.waitFor({state:'hidden',timeout:15000});
    await page.locator('#predictTabs [data-predict-tab="model"]').click();
    await page.locator('#predictView [data-predict-panel="model"].active').waitFor({state:'visible',timeout:15000});
    await page.locator('#aiTrackDetails > summary').waitFor({state:'visible',timeout:15000});
    if(!(await page.locator('#aiTrackDetails').evaluate(el=>el.open)))await page.locator('#aiTrackDetails > summary').click();
    await page.waitForFunction(()=>document.querySelector('#aiTrackSummary')?.children.length>0,{},{timeout:15000});
    await page.locator('#predictTabs [data-predict-tab="outlook"]').click();
    await page.locator('#predictTableBody .pt-c-rank').first().waitFor({state:'visible',timeout:15000});
   }
   await page.waitForTimeout(350);
   if(pageErrors.length)throw Error('Uncaught page errors: '+pageErrors.join('; '));
   const entries=await page.coverage.stopCSSCoverage();
   const matching=entries.filter(e=>{try{return new URL(e.url).pathname===new URL('style.css',base).pathname&&e.text===css}catch{return false}});
   if(matching.length!==1)throw Error('Expected exactly one byte-identical style.css coverage entry; got '+matching.length);
   samples.push({name:label,profile,scenario:name,ranges:matching[0].ranges});
   console.log('CSS coverage PASS '+label+' ranges='+matching[0].ranges.length);
  }catch(e){
   const stem=label.replace(/\//g,'-'),diagnostics=join(out,'diagnostics');mkdirSync(diagnostics,{recursive:true});
   const state=await page.evaluate(sel=>({url:location.href,title:document.title,theme:document.documentElement.dataset.theme,lang:document.documentElement.lang,targetCount:document.querySelectorAll(sel).length,visiblePanels:[...document.querySelectorAll('[id$="View"]')].filter(el=>el.getClientRects().length).map(el=>el.id),bodyText:document.body?.innerText.slice(0,3000)}),selector).catch(err=>({error:String(err)}));
   const screenshot=stem+'.png';let screenshotSaved=false;
   try{await page.screenshot({path:join(diagnostics,screenshot),timeout:5000});screenshotSaved=true;}catch(err){state.screenshotError=String(err);}
   const record={name:label,error:String(e),selector,profile,state,pageErrors,consoleErrors:consoleErrors.slice(-50),localFailures,localHttpErrors,screenshot:screenshotSaved?'diagnostics/'+screenshot:null};
   failures.push(record);writeFileSync(join(diagnostics,stem+'.json'),JSON.stringify(record,null,2));
   console.error('CSS coverage FAIL '+label+': '+e.message);
  }
  finally{await context.close();}
 }
}finally{if(browser)await browser.close();writeFileSync(join(out,'samples.json'),JSON.stringify(samples));writeFileSync(join(out,'failures.json'),JSON.stringify(failures,null,2));}
if(failures.length||samples.length!==profiles.length*scenarios.length)throw Error('Incomplete CSS coverage: '+samples.length+' successful; '+failures.length+' failed');
