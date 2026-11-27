// Existing optional JS loaders already handle loading/error UI and modal
// cancellation tokens. Require matching CSS before handing off to their renderer.
export function wireFeatureModalCss(app){
 const replace=(a,b)=>{if(app.split(a).length!==2)throw Error('Expected unique modal CSS anchor: '+a);app=app.replace(a,()=>b)};
 function withCss(pattern,kind){
  const matches=[...app.matchAll(pattern)];
  if(matches.length!==1)throw Error('Expected unique optional JS asset: '+kind+' got '+matches.length);
  const a=matches[0][0];replace(a,"Promise.all(["+a+",loadClubDetailCss('"+kind+"')])");
 }
 replace('if (window.__utdPlayerModals) {',"if (window.__utdPlayerModals&&clubDetailCssReady.has('players')) {");
 withCss(/loadOptionalAsset\('player-modals\.js\?v=[a-f0-9]{16}',\(\)=>!!window\.__utdPlayerModals\)/g,'players');
 replace("if (typeof window.__utdMatchDetail === 'function') {","if (typeof window.__utdMatchDetail === 'function'&&clubDetailCssReady.has('matchdetail')) {");
 withCss(/loadOptionalAsset\('match-detail\.js\?v=[a-f0-9]{16}',\(\)=>typeof window\.__utdMatchDetail==='function'\)/g,'matchdetail');
 replace("if (typeof window.__utdMatchCompare === 'function') {","if (typeof window.__utdMatchCompare === 'function'&&clubDetailCssReady.has('matchcompare')) {");
 withCss(/loadOptionalAsset\('match-compare\.js\?v=[a-f0-9]{16}', \(\) => typeof window\.__utdMatchCompare === 'function'\)/g,'matchcompare');
 // Venue map modal may also be opened outside the venues view.
 withCss(/loadOptionalAsset\('venue-map\.js\?v=[a-f0-9]{16}',\(\)=>!!window\.__utdVenueMap\)/g,'venue');
 replace('if(window.__utdVenueMap){window.__utdVenueMap.large();return;}',"if(window.__utdVenueMap&&clubDetailCssReady.has('venue')){window.__utdVenueMap.large();return;}");
 replace('  function renderFullRecordModal() {',`  function renderFullRecordModal() {
    if(!requireFeatureCss('fullrecord','#fullRecordBody',()=>!!currentFullRecordType,()=>{
      if(document.getElementById('fullRecordModal')?.style.display!=='none')renderFullRecordModal();
    }))return;`);
 return app;
}
