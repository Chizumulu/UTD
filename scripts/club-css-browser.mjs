import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const [base]=process.argv.slice(2);
if(!base)throw Error('Usage: club-css-browser.mjs base');
const original=readFileSync('style.css','utf8');
const origin=new URL(base).origin;
const isClub=url=>new URL(url).pathname.endsWith('/club-sponsors.css');
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
   const page=await context.newPage(),requests=[],errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('request',r=>{if(isClub(r.url()))requests.push(r.url())});
   await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const url=new URL('?lang='+p.lang,base);
   await page.goto(url.href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
   if(p.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   assert.equal(requests.length,0,'home must not request sponsor CSS');
   await page.evaluate(()=>{showView('squad');applyTeamInfoTab('overview')});
   await page.locator('#squadView').waitFor({state:'visible'});
   assert.equal(requests.length,0,'club overview must not request sponsor CSS');
   await page.evaluate(()=>applyTeamInfoTab('story'));
   await page.locator('#teamInfoStoryTab .ti-sponsor-card').first().waitFor({state:'visible'});
   await page.waitForFunction(()=>[...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href.includes('club-sponsors.css')&&l.sheet));
   assert.equal(requests.length,1,'sponsor CSS loads once');
   const diff=await page.evaluate(source=>{
    const links=[...document.querySelectorAll('link[rel=stylesheet]')];
    const main=links.find(l=>new URL(l.href).pathname.endsWith('/style.css'));
    const club=links.find(l=>new URL(l.href).pathname.endsWith('/club-sponsors.css'));
    if(!main?.sheet||!club?.sheet)throw Error('Missing loaded stylesheets');
    const nodes=[...document.querySelectorAll('#teamInfoStoryTab, #teamInfoStoryTab *')];
    const props=['display','position','box-sizing','flex-direction','align-items','justify-content','gap','grid-template-columns','width','height','max-width','min-width','padding','margin','border','border-radius','background-color','background-image','color','font-size','font-weight','line-height','text-align','text-decoration-line','box-shadow','object-fit','overflow','transform','animation-name','transition-property'];
    const snap=()=>nodes.map(el=>[...props.map(k=>getComputedStyle(el).getPropertyValue(k)),getComputedStyle(el,'::before').content]);
    const actual=snap(),full=document.createElement('style');
    full.textContent=source;
    main.before(full);main.disabled=true;club.disabled=true;
    const expected=snap();
    full.remove();main.disabled=false;club.disabled=false;
    return actual.flatMap((row,i)=>row.flatMap((v,j)=>v===expected[i][j]?[]:[{element:nodes[i].className,property:props[j]||'::before content',actual:v,expected:expected[i][j]}])).slice(0,30);
   },original);
   assert.deepEqual(diff,[],'computed sponsor styles differ from original');
   await page.evaluate(()=>{applyTeamInfoTab('overview');applyTeamInfoTab('story')});
   await page.locator('#teamInfoStoryTab .ti-sponsor-card').first().waitFor({state:'visible'});
   assert.equal(requests.length,1,'reentry must reuse loaded CSS');
   assert.deepEqual(errors,[]);
   console.log('Club CSS PASS '+p.name+' home/overview lazy load, computed parity, reuse');
  }finally{await context.close()}
 }
 const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});
 try{
  const page=await context.newPage();let attempts=0;
  await page.route('**/*',r=>{
   const url=r.request().url();
   if(new URL(url).origin!==origin)return r.abort();
   if(isClub(url)&&++attempts===1)return r.abort();
   return r.continue();
  });
  await page.goto(new URL('?lang=ko#/club/chizumulu-united-fc/story',base).href,{waitUntil:'domcontentloaded'});
  const panel=page.locator('#teamInfoStoryTab');
  const retry=panel.locator('button.rmd-act-btn');
  await retry.waitFor({state:'visible',timeout:30000});
  assert.equal(await panel.locator('.ti-sponsor-card').count(),0,'unstyled cards must not render');
  await retry.evaluate(el=>el.click());
  await panel.locator('.ti-sponsor-card').first().waitFor({state:'visible',timeout:30000});
  assert.equal(attempts,2);
  console.log('Club CSS PASS direct link, failed CSS, retry');
 }finally{await context.close()}
}finally{await browser.close()}
