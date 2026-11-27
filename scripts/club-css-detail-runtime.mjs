// Build-only transform: restore the extracted rules at their original
// positions in the existing same-origin stylesheet, rather than appending
// a stylesheet that could change the cascade. Never touch unrelated rules.
export function wireClubDetailCss(app,assets){
 for(const kind of ['analysis','other'])if(!new RegExp('^club-'+kind+'\\.css\\?v=[a-f0-9]{16}$').test(assets[kind]?.url))throw Error('Invalid club detail CSS URL: '+kind);
 const replace=(before,after)=>{if(app.split(before).length!==2)throw Error('Expected unique club CSS runtime anchor: '+before);app=app.replace(before,()=>after)};
 const urls=JSON.stringify(Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,v.url])));
 replace('  function renderTeamAnalysisTab() {',`  const clubDetailCssUrls=${urls};
  const clubDetailCssLoads=new Map();
  const clubDetailCssReady=new Set();
  const clubDetailCssFailed=new Set();
  function loadClubDetailCss(kind){
    if(clubDetailCssLoads.has(kind))return clubDetailCssLoads.get(kind);
    const prefix='#utd-club-css-slot-'+kind+'-';
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.media='not all';
    link.href=clubDetailCssUrls[kind];
    let succeed,fail;
    const pending=new Promise((resolve,reject)=>{succeed=resolve;fail=reject;});
    clubDetailCssLoads.set(kind,pending);
    function rejectLoad(error){
      link.remove();
      clubDetailCssLoads.delete(kind);
      fail(error);
    }
    link.onerror=()=>rejectLoad(new Error('Could not load '+clubDetailCssUrls[kind]));
    link.onload=()=>{
      let target;
      const inserted=[];
      try{
        const base=[...document.querySelectorAll('link[rel=stylesheet]')].find(l=>new URL(l.href).pathname.endsWith('/style.css'));
        target=base?.sheet;
        if(!target||!link.sheet)throw Error('Missing club stylesheet');
        const isSlot=r=>typeof r.selectorText==='string'&&r.selectorText.startsWith(prefix);
        const slots=[...target.cssRules].filter(isSlot);
        const groups=[];
        for(const rule of link.sheet.cssRules){
          if(isSlot(rule))groups.push({id:rule.selectorText,rules:[]});
          else {
            if(!groups.length)throw Error('Club CSS has rules before first slot');
            groups.at(-1).rules.push(rule.cssText);
          }
        }
        if(!slots.length||slots.length!==groups.length||slots.some((r,i)=>r.selectorText!==groups[i].id))throw Error('Club CSS slot mismatch');
        for(let g=0;g<groups.length;g++){
          for(const rule of groups[g].rules){
            const index=[...target.cssRules].indexOf(slots[g]);
            if(index<0)throw Error('Club CSS slot disappeared');
            target.insertRule(rule,index);
            inserted.push(target.cssRules[index]);
          }
        }
        clubDetailCssReady.add(kind);
        link.remove();
        succeed();
      }catch(error){
        // All inserted rules are tracked; roll back partial changes before retry.
        for(const rule of inserted.reverse()){
          const index=[...target.cssRules].indexOf(rule);
          if(index>=0)target.deleteRule(index);
        }
        rejectLoad(error);
      }
    };
    document.head.appendChild(link);
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
