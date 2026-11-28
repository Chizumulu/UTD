// Shared shell gate for synchronous view renderers. Navigation/state changes
// remain synchronous; the view's existing DOM is preserved while CSS loads.
export function wireFeatureViewCss(app,assets){
 const unique=(s)=>{if(app.split(s).length!==2)throw Error('Expected unique feature CSS anchor: '+s);};
 const replace=(a,b)=>{unique(a);app=app.replace(a,()=>b)};
 for(const [k,v] of Object.entries(assets))if(!new RegExp('^feature-'+k+'\\.css\\?v=[a-f0-9]{16}$').test(v.url))throw Error('Invalid feature CSS URL '+k);
 const helper=`  const featureCssShells=new WeakMap();
  function requireFeatureCss(kind,selector,active,render){
    if(clubDetailCssReady.has(kind))return true;
    if(!active())return true;
    const panel=document.querySelector(selector);
    if(!panel)throw Error('Missing CSS feature shell '+selector);
    const existing=featureCssShells.get(panel);
    if(existing){
      if(existing.kind!==kind)throw Error('CSS feature shell collision');
      existing.active=active;existing.render=render;
      return false;
    }
    if(!document.getElementById('utd-feature-css-shell-style')){
      const style=document.createElement('style');style.id='utd-feature-css-shell-style';
      style.textContent='[data-utd-css-pending] > :not(.utd-feature-css-status){display:none!important}';
      document.head.appendChild(style);
    }
    const status=document.createElement('div');
    status.className='utd-feature-css-status report-empty';
    status.setAttribute('role','status');
    const previousBusy=panel.getAttribute('aria-busy');
    const state={kind,active,render};
    featureCssShells.set(panel,state);
    panel.setAttribute('data-utd-css-pending',kind);
    panel.appendChild(status);
    const attempt=()=>{
      panel.setAttribute('aria-busy','true');
      status.textContent=isKorean?'불러오는 중…':'Loading…';
      loadClubDetailCss(kind).then(()=>{
        status.remove();panel.removeAttribute('data-utd-css-pending');
        if(previousBusy===null)panel.removeAttribute('aria-busy');else panel.setAttribute('aria-busy',previousBusy);
        featureCssShells.delete(panel);
        if(state.active()){
          state.render();
          requestAnimationFrame(()=>{try{refreshScrollFadeHints()}catch(e){}});
        }
      },error=>{
        console.error('Feature CSS load failed:',error);
        panel.removeAttribute('aria-busy');
        status.textContent=isKorean?'불러오지 못했어요. ':'Could not load. ';
        const retry=document.createElement('button');
        retry.type='button';retry.className='rmd-act-btn lbl';
        retry.dataset.ko='다시 시도';retry.dataset.en='Retry';
        retry.textContent=isKorean?retry.dataset.ko:retry.dataset.en;
        retry.onclick=attempt;status.appendChild(retry);
      });
    };
    attempt();
    return false;
  }
`;
 replace('  function renderTeamAnalysisTab() {',helper+'  function renderTeamAnalysisTab() {');
 const gate=(anchor,kind,selector,active,render)=>{
  replace(anchor,anchor+"\n    if(!requireFeatureCss("+JSON.stringify(kind)+","+JSON.stringify(selector)+",()=>"+active+",()=>"+render+"))return;");
 };
 gate('  function renderTeamInfoView() {','club','#myTeamInfoView',"currentView==='squad'&&!archiveMode&&currentTeamInfoKey==='Chizumulu United FC'",'renderTeamInfoView()');
 gate('  function renderOtherTeamFull(t, rank, total) {','club','#otherTeamFullView',"currentView==='squad'&&!archiveMode&&currentTeamInfoKey!=='Chizumulu United FC'",'showTeamInfoForKey(currentTeamInfoKey)');
 gate('  function renderRoundsView() {','rounds','#roundsView',"currentView==='rounds'&&!archiveMode",'renderRoundsView()');
 gate('  function renderLeagueTable() {','rank','#leagueRankView',"currentView==='leagueRank'&&!archiveMode",'renderLeagueTable()');
 gate('  function renderScorersTable() {','scorers','#scorersView',"currentView==='scorers'&&!archiveMode",'renderScorersTable()');
 gate('  function renderRoundResultReport() {','report','#reportViewContent',"currentView==='report'&&!archiveMode",'renderRoundResultReport()');
 gate('  function renderCupView(){','cup','#cupViewContent',"currentView==='cup'&&cupMode&&!archiveMode",'renderCupView()');
 gate('  function renderPredictions(forceRerun){','prediction','#predictView',"currentView==='predict'&&!archiveMode",'renderPredictions(forceRerun)');
 gate('  function renderTeamCompareView() {','teamcompare','#teamCompareView',"currentView==='teamCompare'&&!archiveMode",'renderTeamCompareView()');
 gate('  function applyVenueMode() {','venue','#venuesView',"currentView==='venues'&&!archiveMode",'applyVenueMode()');
 gate('  function renderPathFinder() {','pathfinder','#teamInfoPathFinder',"currentView==='squad'&&currentTeamInfoTab==='predict'&&!archiveMode",'renderPathFinder()');
 gate('  function renderRaceAnswer() {','pathfinder','#predictView',"currentView==='predict'&&predictTab==='race'&&!archiveMode",'renderRaceAnswer()');
 // Archive has its own cancellation token and pending entry workflow.
 replace('if (!archiveDataReady() || !window.__utdArchiveView) {',"if (!archiveDataReady() || !window.__utdArchiveView || !clubDetailCssReady.has('archive')) {");
 replace('Promise.all([loadArchiveData(),loadArchiveView().then(()=>true,()=>false)])',"Promise.all([loadArchiveData(),loadArchiveView().then(()=>true,()=>false),loadClubDetailCss('archive').then(()=>true,()=>false)])");
 // The comparison panel already owns its loading state and route guards.
 gate('  function renderSeasonCompareTab() {','seasoncompare','#statsView [data-stats-panel="compare"]',"currentView==='stats'&&statsTab==='compare'&&!archiveMode",'renderSeasonCompareTab()');
 return app;
}
