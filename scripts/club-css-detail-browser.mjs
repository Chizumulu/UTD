import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitClubSponsorCss} from './club-css-split.mjs';

const [base]=process.argv.slice(2);
if(!base)throw Error('Usage: club-css-detail-browser.mjs base');
const origin=new URL(base).origin;
const baseline=(await splitClubSponsorCss(readFileSync('style.css','utf8'))).critical;
const kindOf=url=>new URL(url).pathname.match(/\/club-(analysis|other)\.css$/)?.[1];
const profiles=[
 {name:'desktop',viewport:{width:1440,height:900},lang:'ko',theme:'light'},
 {name:'mobile',viewport:{width:390,height:844},lang:'ko',theme:'light'},
 {name:'dark-en',viewport:{width:360,height:780},lang:'en',theme:'dark'},
 {name:'tablet',viewport:{width:768,height:1024},lang:'ny',theme:'light'}
];
const browser=await chromium.launch();
try{
 for(const p of profiles){
  const context=await browser.newContext({viewport:p.viewport,colorScheme:p.theme,reducedMotion:'reduce',serviceWorkers:'block'});
  try{
   const page=await context.newPage(),requests={analysis:0,other:0},errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{const k=kindOf(r.url());if(k)requests[k]++});
   await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await page.goto(new URL('?lang='+p.lang,base).href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
   if(p.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   assert.deepEqual(requests,{analysis:0,other:0});
   await page.evaluate(()=>{showView('squad');applyTeamInfoTab('overview')});
   await page.locator('#myTeamInfoView').waitFor({state:'visible'});
   assert.deepEqual(requests,{analysis:0,other:0});
   await page.evaluate(()=>applyTeamInfoTab('analysis'));
   await page.locator('#teamInfoAnalysisTab .ta-card').first().waitFor({state:'visible',timeout:30000});
   assert.deepEqual(requests,{analysis:1,other:0});
   await page.evaluate(()=>applyTeamInfoTab('overview'));
   await page.evaluate(()=>applyTeamInfoTab('analysis'));
   await page.locator('#teamInfoAnalysisTab .ta-card').first().waitFor({state:'visible'});
   assert.deepEqual(requests,{analysis:1,other:0});
   await page.evaluate(()=>showTeamInfoForKey('Chibavi Real Stars FC'));
   await page.locator('#otherTeamFullBody .ti-record-card').first().waitFor({state:'visible',timeout:30000});
   assert.deepEqual(requests,{analysis:1,other:1});
   await page.evaluate(()=>showTeamInfoForKey('Jenda United FC'));
   await page.locator('#otherTeamFullBody .ti-record-card').first().waitFor({state:'visible'});
   assert.deepEqual(requests,{analysis:1,other:1});
   const diff=await page.evaluate(source=>{
    const link=[...document.querySelectorAll('link[rel=stylesheet]')].find(l=>new URL(l.href).pathname.endsWith('/style.css'));
    if(!link?.sheet)throw Error('Missing base CSS');
    const reference=new CSSStyleSheet();reference.replaceSync(source);
    const actual=[...link.sheet.cssRules].filter(r=>!r.selectorText?.startsWith('#utd-club-css-slot-')).map(r=>r.cssText);
    const expected=[...reference.cssRules].map(r=>r.cssText);
    const index=actual.findIndex((s,i)=>s!==expected[i]);
    return {actual:actual.length,expected:expected.length,index,actualRule:index<0?null:actual[index],expectedRule:index<0?null:expected[index]};
   },baseline);
   assert.equal(diff.actual,diff.expected,JSON.stringify(diff));
   assert.equal(diff.index,-1,JSON.stringify(diff));
   assert.deepEqual(errors,[]);
   console.log('Club detail CSS PASS '+p.name+' lazy loading, independent requests, reuse, exact full CSSOM rule order');
  }finally{await context.close()}
 }
 for(const kind of ['analysis','other']){
  const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});
  try{
   const page=await context.newPage();let attempts=0;
   await page.route('**/*',r=>{
    const url=r.request().url();
    if(new URL(url).origin!==origin)return r.abort();
    if(kindOf(url)===kind&&++attempts===1)return r.abort();
    return r.continue();
   });
   const path=kind==='analysis'?'chizumulu-united-fc/analysis':'chibavi-real-stars-fc/overview';
   await page.goto(new URL('?lang=ko#/club/'+path,base).href,{waitUntil:'domcontentloaded'});
   const panel=page.locator(kind==='analysis'?'#teamInfoAnalysisTab':'#otherTeamFullBody');
   const result=panel.locator(kind==='analysis'?'.ta-card':'.ti-record-card').first();
   const retry=panel.locator('button.rmd-act-btn');
   await retry.waitFor({state:'visible',timeout:30000});
   assert.equal(attempts,1);assert.equal(await result.count(),0);
   const button=await retry.elementHandle();
   await page.evaluate(k=>{if(k==='analysis')applyTeamInfoTab('analysis');else showTeamInfoForKey('Chibavi Real Stars FC');},kind);
   assert.equal(await button.evaluate(el=>el.isConnected),true);
   assert.equal(attempts,1);
   await button.evaluate(el=>el.click());
   await result.waitFor({state:'visible',timeout:30000});
   assert.equal(attempts,2);
   assert.equal(await retry.count(),0);
   console.log('Club detail CSS PASS '+kind+' direct link, failure, explicit retry');
  }finally{await context.close()}
 }
}finally{await browser.close()}
