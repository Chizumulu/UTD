import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const [base,cssPath,out]=process.argv.slice(2);
if(!base||!cssPath||!out)throw Error('Usage: css-audit-browser.mjs base cssPath out');
const css=readFileSync(cssPath,'utf8'),samples=[],failures=[];
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const scenarios=[
 ['home',null,'#mainMiniTableBody'],
 ['rank',()=>showView('leagueRank'),'#leagueRankView'],
 ['rounds',()=>showView('rounds'),'#roundsView'],
 ['scorers',()=>showView('scorers'),'#scorersView'],
 ['club',()=>showView('squad'),'#squadView'],
 ['report',()=>showView('report'),'#reportView'],
 ['prediction',()=>showView('predict'),'#predictTableBody button.analysis-share'],
 ['venue-travel',()=>{setVenueMode('travel');showView('venues')},'#venueModeTravel'],
 ['venue-map',()=>{showView('venues');setVenueMode('map')},'#venueLeafletMap button'],
 ['archive',()=>openSeasonArchive({tab:'weekly'}),'#archiveWeeklyPane'],
 ['season-compare',()=>{location.hash='#/stats/compare'},'#seasonCompareCard'],
 ['cup',null,'#cupViewContent button','#cupToggleSide'],
 ['player',()=>openPlayerModal(topScorersData[0].key),'#playerTimeline'],
 ['squad-player',()=>openSquadPlayerModal(squadData.find(x=>x.number!=null).number),'#squadPlayerModalName'],
 ['sponsors',()=>{showView('squad');applyTeamInfoTab('story')},'#teamInfoStoryTab button'],
 ['postponed',()=>{showView('rounds');openPostponedMatchesModal()},'#postponedMatchesModal']
];
const profiles=[{name:'desktop',width:1440,height:900,lang:'ko',theme:'light'},{name:'mobile',width:390,height:844,lang:'ko',theme:'light'},{name:'mobile-dark-en',width:360,height:780,lang:'en',theme:'dark'},{name:'tablet-ny',width:768,height:1024,lang:'ny',theme:'light'}];
try{
 for(const profile of profiles)for(const [name,action,selector,click] of scenarios){
  const label=profile.name+'/'+name,context=await browser.newContext({viewport:{width:profile.width,height:profile.height},colorScheme:profile.theme,serviceWorkers:'block'});
  const page=await context.newPage();
  try{
   await page.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===new URL(base).origin?r.continue():r.abort()});
   await page.coverage.startCSSCoverage({resetOnNavigation:false});
   await page.goto(new URL('?lang='+profile.lang,base).href,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0,{},{timeout:15000});
   if(profile.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   if(action)await page.evaluate(action);
   if(click)await page.evaluate(()=>{const b=document.querySelector('#cupToggleSide');if(!b)throw Error('Cup toggle unavailable');b.click()});
   await page.locator(selector).first().waitFor({state:'visible',timeout:15000});
   await page.waitForTimeout(350);
   const entries=await page.coverage.stopCSSCoverage();
   const matching=entries.filter(e=>{try{return new URL(e.url).pathname===new URL('style.css',base).pathname&&e.text===css}catch{return false}});
   if(matching.length!==1)throw Error('Expected exactly one byte-identical style.css coverage entry; got '+matching.length);
   samples.push({name:label,profile,scenario:name,ranges:matching[0].ranges});
   console.log('CSS coverage PASS '+label+' ranges='+matching[0].ranges.length);
  }catch(e){failures.push({name:label,error:String(e)});console.error('CSS coverage FAIL '+label+': '+e.message);}
  finally{await context.close();}
 }
}finally{await browser.close();writeFileSync(join(out,'samples.json'),JSON.stringify(samples));writeFileSync(join(out,'failures.json'),JSON.stringify(failures,null,2));}
if(failures.length||samples.length!==profiles.length*scenarios.length)throw Error('Incomplete CSS coverage: '+samples.length+' successful; '+failures.length+' failed');
