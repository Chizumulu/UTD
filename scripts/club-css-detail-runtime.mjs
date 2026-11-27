import {parseDeferredCssGroups} from './club-css-raw-groups.mjs';
// Build-only transform: restore the extracted rules at their original
// positions in the existing same-origin stylesheet, rather than appending
// a stylesheet that could change the cascade. Never touch unrelated rules.
export function wireClubDetailCss(app,assets){
 for(const kind of ['analysis','other'])if(!new RegExp('^club-'+kind+'\\.css\\?v=[a-f0-9]{16}$').test(assets[kind]?.url))throw Error('Invalid club detail CSS URL: '+kind);
 const replace=(before,after)=>{if(app.split(before).length!==2)throw Error('Expected unique club CSS runtime anchor: '+before);app=app.replace(before,()=>after)};
 const urls=JSON.stringify(Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,v.url])));
 replace('  function renderTeamAnalysisTab() {',`  const clubDetailCssUrls=${urls};
  ${parseDeferredCssGroups.toString()}
  const clubDetailCssLoads=new Map();
  const clubDetailCssReady=new Set();
  const clubDetailCssFailed=new Set();
  function loadClubDetailCss(kind){
    if(clubDetailCssLoads.has(kind))return clubDetailCssLoads.get(kind);
    const prefix='#utd-club-css-slot-'+kind+'-';
    // Fetch exact source, never reserialize CSSRule.cssText: Chromium can
    // lose var()-backed shorthand declarations during that round trip.
    const pending=Promise.resolve().then(async()=>{
      const url=new URL(clubDetailCssUrls[kind],document.baseURI);
      if(url.origin!==location.origin)throw Error('Cross-origin deferred CSS');
      const response=await fetch(url.href,{credentials:'same-origin'});
      if(!response.ok)throw Error('Could not load '+url.pathname+' ('+response.status+')');
      const groups=parseDeferredCssGroups(await response.text(),kind);
      let target;
      const inserted=[];
      try{
        const base=[...document.querySelectorAll('link[rel=stylesheet]')].find(l=>new URL(l.href).pathname.endsWith('/style.css'));
        target=base?.sheet;
        if(!target)throw Error('Missing club stylesheet');
        const slots=[...target.cssRules].filter(r=>typeof r.selectorText==='string'&&r.selectorText.startsWith(prefix));
        if(!slots.length||slots.length!==groups.length||slots.some((r,i)=>r.selectorText!==groups[i].id))throw Error('Club CSS slot mismatch');
        for(let g=0;g<groups.length;g++){
          let index=[...target.cssRules].indexOf(slots[g]);
          if(index<0)throw Error('Club CSS slot disappeared');
          for(const rule of groups[g].rules){
            target.insertRule(rule,index);
            inserted.push(target.cssRules[index]);
            index++;
          }
        }
        clubDetailCssReady.add(kind);
      }catch(error){
        for(const rule of inserted.reverse()){
          const index=[...target.cssRules].indexOf(rule);
          if(index>=0)target.deleteRule(index);
        }
        throw error;
      }
    }).catch(error=>{
      clubDetailCssLoads.delete(kind);
      throw error;
    });
    clubDetailCssLoads.set(kind,pending);
    return pending;
  }
  function loadClubDetailPanel(kind,panel,render){
    if(clubDetailCssFailed.has(kind))return;
    loadFeaturePanel(panel,()=>loadClubDetailCss(kind).catch(error=>{
      clubDetailCssFailed.add(kind);throw error;
    }),render,()=>{clubDetailCssFailed.delete(kind);render();});
  }
  function renderTeamAnalysisTab() {`);
 replace("    if (!mine) { el.innerHTML = ''; return; }\n    syncClubCompetitionFilter('teamAnalysisCompFilter',",`    if (!mine) { el.innerHTML = ''; return; }
    if(!clubDetailCssReady.has('analysis')){
      loadClubDetailPanel('analysis',el,()=>{
        if(currentView==='squad'&&currentTeamInfoKey==='Chizumulu United FC'&&currentTeamInfoTab==='analysis'&&!archiveMode)renderTeamAnalysisTab();
      });
      return;
    }
    syncClubCompetitionFilter('teamAnalysisCompFilter',`);
 replace('  function renderOtherTeamFull(t, rank, total) {',`  function renderOtherTeamFull(t, rank, total) {
    if(!clubDetailCssReady.has('other')){
      const panel=document.getElementById('otherTeamFullBody');
      if(!panel)return;
      const header=document.getElementById('otherTeamFullHeader');
      if(header)header.replaceChildren();
      loadClubDetailPanel('other',panel,()=>{
        if(currentView==='squad'&&currentTeamInfoKey!=='Chizumulu United FC'&&!archiveMode)showTeamInfoForKey(currentTeamInfoKey);
      });
      return;
    }`);
 return app;
}
