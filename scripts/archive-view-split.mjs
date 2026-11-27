import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitArchiveView(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique archive view source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid archive view boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const views=take('  function goToArchiveTeam(idx) {','  // ===== 매직넘버');
 const code=await minifyJs('(function(){\n'+views+'\nwindow.__utdArchiveView={main:renderArchiveMain,clubs:renderArchiveClubs,weekly:renderArchive,go:goToArchiveTeam,open:openArchiveTeamModal,close:closeArchiveTeamModal,jump:jumpToArchiveTeam};\n})();');
 const file='archive-view.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace('  function openSeasonArchive(opts) {',`  function loadArchiveView(){
    return loadOptionalAsset('${url}',()=>!!window.__utdArchiveView);
  }
  function renderArchiveMain(){window.__utdArchiveView?.main();}
  function renderArchiveClubs(){window.__utdArchiveView?.clubs();}
  function renderArchive(){window.__utdArchiveView?.weekly();}
  function goToArchiveTeam(idx){window.__utdArchiveView?.go(idx);}
  function openArchiveTeamModal(){window.__utdArchiveView?.open();}
  function closeArchiveTeamModal(){
    closeModalAnimated(document.getElementById('archiveTeamModal'));
  }
  function jumpToArchiveTeam(idx){window.__utdArchiveView?.jump(idx);}
  function openSeasonArchive(opts) {`);
 replace('    if (!archiveWeeks().length) {','    if (!archiveDataReady() || !window.__utdArchiveView) {');
 replace('      loadArchiveData().then(function (ok) {','      Promise.all([loadArchiveData(),loadArchiveView().then(()=>true,()=>false)]).then(function (results) {\n        const ok=results.every(Boolean);');
 replace('            if (!archiveDataReady()) { lastHash = normHash(location.hash); return; }','            if (archiveEntryPending || !archiveDataReady()) { lastHash = normHash(location.hash); return; }');
 return {app,file,code};
}
