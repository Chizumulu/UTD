import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {minifyCss} from './minify-pages-assets.mjs';
const [base,out]=process.argv.slice(2);
if(!base||!out)throw Error('Usage: css-cold-entry-browser.mjs base out');
mkdirSync(out,{recursive:true});
const source=await minifyCss(readFileSync('style.css','utf8'));
const origin=new URL(base).origin;
const profiles=[
 {name:'desktop',width:1440,height:900,lang:'ko',theme:'light'},
 {name:'mobile',width:390,height:844,lang:'ko',theme:'light'},
 {name:'dark-en',width:360,height:780,lang:'en',theme:'dark'},
 {name:'tablet-ny',width:768,height:1024,lang:'ny',theme:'light'}
];
// Each case starts from a new browser context. No other feature CSS is
// artificially preloaded before the first visible state is captured.
const cases=[
 ['home',null,'#rankView,#nextMatchStrip,#nextMatchPreviewCard','#mainMiniTableBody tr',[]],
 ['teamcompare',()=>showView('teamCompare'),'#teamCompareView','.tc-card',['teamcompare']],
 ['rank',()=>showView('leagueRank'),'#leagueRankView','#leagueTableBody tr',['rank']],
 ['rounds',()=>showView('rounds'),'#roundsView','#roundMatchList > *',['rounds']],
 ['scorers',()=>showView('scorers'),'#scorersView','#scorersTableBody tr',['scorers']],
 ['stats-rank',()=>{showView('stats');setStatsTab('rank')},'#statsView','#statsView [data-stats-panel="rank"].active',[]],
 ['stats-analysis',()=>{showView('stats');setStatsTab('analysis')},'#statsView','#statsView [data-stats-panel="analysis"].active',[]],
 ['seasoncompare',()=>{showView('stats');setStatsTab('compare')},'#statsView','#seasonCompareCard .stats-title',['seasoncompare']],
 ['report',()=>showView('report'),'#reportView','#reportViewContent > *',['report']],
 ['prediction',()=>showView('predict'),'#predictView','#predictTableBody .pt-c-rank',['prediction']],
 ['venue-map',()=>{showView('venues');setVenueMode('map')},'#venuesView','#venueLeafletMap button',['venue']],
 ['venue-travel',()=>{setVenueMode('travel');showView('venues')},'#venuesView','#travelImpactWrap > *',['venue']],
 ['cup',()=>showCupView(),'#cupView','#cupViewContent button',['cup']],
 ['archive-main',()=>openSeasonArchive({tab:'main'}),'#archiveView','#archiveMiniBody tr',['archive']],
 ['archive-weekly',()=>openSeasonArchive({tab:'weekly'}),'#archiveView','#archiveTableBody tr',['archive']],
 ['archive-clubs',()=>openSeasonArchive({tab:'clubs'}),'#archiveView','#archiveClubBody > *',['archive']],
 ['club-overview',()=>{showView('squad');applyTeamInfoTab('overview')},'#myTeamInfoView','#teamInfoOverviewTab > *',['club']],
 ['club-squad',()=>{showView('squad');applyTeamInfoTab('squad')},'#myTeamInfoView','#squadGroups > *',['club']],
 ['club-honors',()=>{showView('squad');applyTeamInfoTab('honors')},'#myTeamInfoView','#teamInfoRecordRoomTab > *',['club']],
 ['club-results',()=>{showView('squad');applyTeamInfoTab('results')},'#myTeamInfoView','#teamInfoResultsTab > *',['club']],
 ['club-sponsors',()=>{showView('squad');applyTeamInfoTab('story')},'#myTeamInfoView','#teamInfoStoryTab .ti-sponsor-card',['club']],
 ['club-analysis',()=>{showView('squad');applyTeamInfoTab('analysis')},'#myTeamInfoView','#teamInfoAnalysisTab .ta-card',['club','analysis']],
 ['club-predict',()=>{showView('squad');applyTeamInfoTab('predict')},'#myTeamInfoView','#teamInfoPathFinder .path-finder-card',['club','pathfinder']],
 ['other-club',()=>{showView('squad');showTeamInfoForKey('Chibavi Real Stars FC')},'#otherTeamFullView','#otherTeamFullBody .ti-record-card',['club','other']],
 ['player',()=>openPlayerModal(topScorersData[0].key),'#playerModal','#playerTimeline > *',['players']],
 ['squad-player',()=>openSquadPlayerModal(squadData.find(x=>x.number!=null).number),'#squadPlayerModal','#squadPlayerModalName',['players']],
 ['match-detail',()=>{const k=Object.keys(matchLineups).find(k=>matchLineups[k]?.starters?.length);openMatchDetail(k,roundKeyPos(k))},'#matchDetailModal','#matchDetailBody .match-detail-layout',['matchdetail']],
 ['match-compare',()=>{const [a,b]=getRankedTeams('all').map(t=>t.nameEn);openMatchCompareModal(a,a,b,b,'round1',{homeScore:1,awayScore:0})},'#matchCompareModal','#matchCompareBody .mc-teams-row',['matchcompare']],
 ['full-record',()=>openFullRecordModal(Object.keys(FULL_RECORD_META)[0]),'#fullRecordModal','#fullRecordBody > *',['fullrecord']],
 ['postponed',()=>openPostponedMatchesModal(),'#postponedMatchesModal','#postponedMatchesBody > *',[]]
];
const results=[];
const slowCases=new Set(['teamcompare','rank','rounds','scorers','report','match-detail','match-compare','venue-map','venue-travel']);
const runs=[...profiles.flatMap(p=>cases.map(c=>({p,c,slow:false}))),...profiles.flatMap(p=>cases.filter(c=>slowCases.has(c[0])).map(c=>({p,c,slow:true})))];
const browser=await chromium.launch();
async function compare(page,root){
 return page.evaluate(({source,root})=>{
  const scopes=[...document.querySelectorAll(root)].filter(e=>e.getClientRects().length);
  if(!scopes.length)throw Error('Missing visible root '+root);
  const base=[...document.querySelectorAll('link[rel=stylesheet]')].find(l=>new URL(l.href).pathname.endsWith('/style.css'));
  if(!base?.sheet)throw Error('Missing critical stylesheet');
  const sponsor=[...document.querySelectorAll('link[rel=stylesheet]')].filter(l=>new URL(l.href).pathname.endsWith('/club-sponsors.css')&&l.sheet);
  const reference=document.createElement('style');
  reference.textContent=source;
  const props=['display','visibility','position','flex-direction','flex-wrap','align-items','justify-content','grid-template-columns','gap','width','height','min-width','max-width','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','background-color','background-image','color','font-family','font-size','font-weight','line-height','text-align','border-top-width','border-right-width','border-bottom-width','border-left-width','border-top-style','border-right-style','border-bottom-style','border-left-style','border-top-color','border-right-color','border-bottom-color','border-left-color','border-radius','box-shadow','overflow-x','overflow-y','object-fit'];
  const elems=[...new Set(scopes.flatMap(scope=>[scope,...scope.querySelectorAll('*')]))].filter(e=>!['SCRIPT','STYLE','LINK','OPTION'].includes(e.tagName)&&e.getClientRects().length);
  const describe=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+[...e.classList].slice(0,5).map(c=>'.'+c).join('');
  const snapshot=()=>elems.map(e=>{const c=getComputedStyle(e);return props.map(p=>c.getPropertyValue(p))});
  const cold=snapshot();
  const sheets=[base,...sponsor].map(l=>[l.sheet,l.sheet.disabled]);
  let expected;
  try{
   // Substitute the unsplit stylesheet in exactly the original cascade
   // position, with the same live DOM and no intervening event loop.
   base.before(reference);
   for(const [sheet] of sheets)sheet.disabled=true;
   expected=snapshot();
  }finally{
   reference.remove();
   for(const [sheet,disabled] of sheets)sheet.disabled=disabled;
  }
  const differences=[],byProperty={};
  let count=0,changedElements=0;
  for(let i=0;i<elems.length;i++){
   let changed=false;
   for(let p=0;p<props.length;p++){
    if(cold[i][p]===expected[i][p])continue;
    changed=true;count++;byProperty[props[p]]=(byProperty[props[p]]||0)+1;
    if(differences.length<100)differences.push({element:describe(elems[i]),property:props[p],cold:cold[i][p],reference:expected[i][p]});
   }
   if(changed)changedElements++;
  }
  return {elements:elems.length,changedElements,differenceCount:count,byProperty,differences,loaded:[...clubDetailCssReady].sort()};
 },{source,root});
}
try{
 for(const {p,c:[name,action,root,selector,kinds],slow} of runs){
  const label=(slow?'slow/':'')+p.name+'/'+name;
  const context=await browser.newContext({viewport:{width:p.width,height:p.height},colorScheme:p.theme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/(?:feature-[a-z]+|club-(?:analysis|other|sponsors))\.css\?/.test(r.url()))requests.push(r.url())});
  try{
   await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await page.goto(new URL('?lang='+p.lang,base).href,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0);
   if(p.theme==='dark')await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   let release,seen;
   const hold=new Promise(resolve=>{release=resolve});
   const started=new Promise(resolve=>{seen=resolve});
   if(slow){
    const target=kinds[0];
    await page.route(new RegExp('/feature-'+target+'\\.css\\?v='),async route=>{
     seen();
     await hold;
     await route.continue();
    });
   }
   try{
    if(action)await page.evaluate(action);
    if(slow){
     let timer;
     try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No cold CSS request for '+name)),10000)})]);}finally{clearTimeout(timer);}
     await page.waitForTimeout(800);
     if(await page.locator(selector).first().isVisible())throw Error('Feature content exposed before its CSS: '+name);
    }
   }finally{release();}
   if(kinds.length)await page.waitForFunction(ks=>ks.every(k=>clubDetailCssReady.has(k)),kinds,{timeout:30000});
   await page.locator(selector).first().waitFor({state:'visible',timeout:30000});
   await page.waitForTimeout(300);
   const result=await compare(page,root);
   // Revisit team comparison after the two other known CSS owners load.
   // This explicitly reproduces the user's cross-feature navigation.
   if(name==='teamcompare'&&!slow){
    await page.screenshot({path:join(out,p.name+'-teamcompare-first.png')});
    await page.evaluate(()=>showView('predict'));
    await page.waitForFunction(()=>clubDetailCssReady.has('prediction'));
    await page.evaluate(()=>{const [a,b]=getRankedTeams('all').map(t=>t.nameEn);openMatchCompareModal(a,a,b,b,'round1',{homeScore:1,awayScore:0})});
    await page.waitForFunction(()=>clubDetailCssReady.has('matchcompare'));
    await page.locator('#matchCompareBody .mc-teams-row').first().waitFor({state:'visible'});
    await page.evaluate(()=>{closeMatchCompareModal(false);showView('teamCompare')});
    await page.locator('.tc-card').first().waitFor({state:'visible'});
    await page.waitForTimeout(300);
    result.revisit=await compare(page,root);
    await page.screenshot({path:join(out,p.name+'-teamcompare-revisit.png')});
   }
   const record={label,...result,requests,errors};
   results.push(record);
   console.log('Cold CSS '+(result.differenceCount?'DIFF':'PASS')+' '+label+' elements='+result.elements+' changed='+result.changedElements+' properties='+result.differenceCount+' loaded='+result.loaded.join(',')+(result.revisit?' revisit='+result.revisit.differenceCount:''));
   if(result.differenceCount)console.log('Cold CSS examples '+label+' '+JSON.stringify(result.differences.slice(0,4)));
  }catch(e){results.push({label,error:String(e),requests,errors});console.log('Cold CSS ERROR '+label+' '+e.message);}
  finally{await context.close();writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2));}
 }
}finally{await browser.close();}
const mismatches=results.filter(r=>r.differenceCount>0||r.revisit?.differenceCount>0),errors=results.filter(r=>r.error||r.errors?.length);
const summary={expected:runs.length,cold:profiles.length*cases.length,slow:profiles.length*slowCases.size,executed:results.length,matched:results.filter(r=>!r.error&&!r.errors?.length&&!r.differenceCount&&!r.revisit?.differenceCount).length,mismatch:mismatches.length,errors:errors.length};
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2));
console.log('Cold CSS summary '+JSON.stringify(summary));
if(mismatches.length||errors.length||results.length!==summary.expected)process.exitCode=1;
