import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitClubSponsorCss} from './club-css-split.mjs';
import {policies} from './feature-css-policy.mjs';
const [base]=process.argv.slice(2);
if(!base)throw Error('Usage: feature-css-browser.mjs base');
const origin=new URL(base).origin;
const baseline=(await splitClubSponsorCss(readFileSync('style.css','utf8'))).critical;
const kindOf=url=>new URL(url).pathname.match(/\/feature-([a-z]+)\.css$/)?.[1];
const scenarios=[
 ['club',()=>{showView('squad');applyTeamInfoTab('overview')},'#myTeamInfoView .ti-card'],
 ['pathfinder',()=>applyTeamInfoTab('predict'),'#teamInfoPathFinder'],
 ['rank',()=>showView('leagueRank'),'#leagueTableBody tr'],
 ['rounds',()=>showView('rounds'),'#roundMatchList > *'],
 ['scorers',()=>showView('scorers'),'#scorersTableBody tr'],
 ['report',()=>showView('report'),'#reportViewContent > *'],
 ['prediction',()=>showView('predict'),'#predictTableBody .pt-c-rank'],
 ['teamcompare',()=>showView('teamCompare'),'#teamCompareBody .tc-card'],
 ['seasoncompare',()=>{showView('stats');setStatsTab('compare')},'#seasonCompareCard .stats-title'],
 ['venue',()=>{showView('venues');setVenueMode('travel')},'#venueModeTravel'],
 ['archive',()=>openSeasonArchive({tab:'weekly'}),'#archiveWeeklyPane'],
 ['cup',()=>showCupView(),'#cupViewContent button'],
 ['players',()=>{showView('rank');openPlayerModal(topScorersData[0].key)},'#playerTimeline > *',()=>closePlayerModal()],
 ['matchdetail',()=>{const k=Object.keys(matchLineups).find(k=>matchLineups[k]?.starters?.length);openMatchDetail(k,roundKeyPos(k))},'#matchDetailBody .match-detail-layout',()=>closeMatchDetail()],
 ['matchcompare',()=>{const [a,b]=getRankedTeams('all').map(t=>t.nameEn);openMatchCompareModal(a,a,b,b,'round1',{homeScore:1,awayScore:0})},'#matchCompareBody .mc-teams-row',()=>closeMatchCompareModal()],
 ['fullrecord',()=>openFullRecordModal(Object.keys(FULL_RECORD_META)[0]),'#fullRecordModal',()=>closeFullRecordModal()],
];
assert.deepEqual(scenarios.map(s=>s[0]).sort(),Object.keys(policies).sort());
const profiles=[
 {name:'desktop',viewport:{width:1440,height:900},lang:'ko',theme:'light'},
 {name:'mobile',viewport:{width:390,height:844},lang:'ko',theme:'light'},
 {name:'dark-en',viewport:{width:360,height:780},lang:'en',theme:'dark'},
 {name:'tablet',viewport:{width:768,height:1024},lang:'ny',theme:'light'}
];
const browser=await chromium.launch();
async function start(profile){
 const context=await browser.newContext({viewport:profile.viewport,colorScheme:profile.theme,reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),requests={},errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const k=kindOf(r.url());if(k)requests[k]=(requests[k]||0)+1});
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 return {context,page,requests,errors};
}
async function ready(page,kind){await page.waitForFunction(k=>clubDetailCssReady.has(k),kind,{timeout:30000});}
try{
 for(const profile of profiles){
  const {context,page,requests,errors}=await start(profile);
  try{
   await page.goto(new URL('?lang='+profile.lang,base).href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
   if(profile.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   assert.deepEqual(requests,{});
   for(const [kind,action,selector,close] of scenarios){
    await page.evaluate(action);
    await ready(page,kind);
    await page.locator(selector).first().waitFor({state:'visible',timeout:30000});
    assert.equal(requests[kind],1,kind);
    if(close)await page.evaluate(close);
    console.log('Integrated CSS PASS '+profile.name+'/'+kind+' request=1');
   }
   for(const [kind,action,selector,close] of scenarios){
    await page.evaluate(action);await page.locator(selector).first().waitFor({state:'visible',timeout:30000});
    assert.equal(requests[kind],1,kind+' duplicate');
    if(close)await page.evaluate(close);
   }
   await page.evaluate(()=>Promise.all(Object.keys(clubDetailCssUrls).map(loadClubDetailCss)));
   const diff=await page.evaluate(source=>{
    const base=[...document.querySelectorAll('link[rel=stylesheet]')].find(l=>new URL(l.href).pathname.endsWith('/style.css'));
    const expected=new CSSStyleSheet();expected.replaceSync(source);
    const actual=[...base.sheet.cssRules].filter(r=>!r.selectorText?.startsWith('#utd-club-css-slot-')).map(r=>r.cssText);
    const ref=[...expected.cssRules].map(r=>r.cssText);
    const index=actual.findIndex((r,i)=>r!==ref[i]);
    return {actual:actual.length,expected:ref.length,index,rule:index<0?null:actual[index],reference:index<0?null:ref[index]};
   },baseline);
   assert.equal(diff.actual,diff.expected,JSON.stringify(diff));assert.equal(diff.index,-1,JSON.stringify(diff));
   // Regression: var()-backed border shorthand must survive a later
   // border-top override, not just compare equal at the selector level.
   const border=await page.evaluate(()=>{
    const probe=document.createElement('div');
    probe.className='squad-former-panel';
    probe.style.setProperty('--color-border-light','rgb(17, 34, 51)');
    document.body.appendChild(probe);
    try{
     const c=getComputedStyle(probe);
     return ['top','right','bottom','left'].map(side=>[
      c.getPropertyValue('border-'+side+'-width'),
      c.getPropertyValue('border-'+side+'-style'),
      c.getPropertyValue('border-'+side+'-color')
     ]);
    }finally{probe.remove();}
   });
   assert.equal(border[0][0],'0px');
   assert.equal(border[0][1],'none');
   for(const edge of border.slice(1))assert.deepEqual(edge,['1px','solid','rgb(17, 34, 51)']);
   console.log('Integrated CSS shorthand PASS '+profile.name);
   assert.deepEqual(errors,[]);
   console.log('Integrated CSS order PASS '+profile.name);
  }finally{await context.close()}
 }
 // Forced CSS failure must keep the route, leave the original DOM intact,
 // and wait for an explicit retry instead of retrying on every rerender.
 for(const kind of ['club','rounds','prediction','players','matchdetail','matchcompare']){
  const {context,page,requests}=await start(profiles[0]);
  try{
   let attempts=0;
   await page.route(new RegExp('/feature-'+kind+'\\.css\\?v='),r=>++attempts===1?r.abort():r.continue());
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
   const [,action,selector,close]=scenarios.find(x=>x[0]===kind);
   await page.evaluate(action);
   const retry=page.locator(kind==='players'?'#playerModal .player-modal-load-status button':kind==='matchdetail'?'#matchDetailBody .rmd-act-btn':kind==='matchcompare'?'#matchCompareBody .rmd-act-btn':'[data-utd-css-pending="'+kind+'"] .utd-feature-css-status button');
   await retry.first().waitFor({state:'visible',timeout:30000});
   assert.equal(attempts,1);
   await retry.first().evaluate(el=>el.click());
   await ready(page,kind);await page.locator(selector).first().waitFor({state:'visible',timeout:30000});
   assert.equal(attempts,2);assert.equal(requests[kind],2);
   if(close)await page.evaluate(close);
   console.log('Integrated CSS retry PASS '+kind);
  }finally{await context.close()}
 }
}finally{await browser.close()}
