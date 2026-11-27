import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitCupView(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique cup source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid cup boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const tiers=take('  let cupRegionalView =','  function setCupTab(id) {');
 const money=take('  let cupShowKrw = false;','  const CUP_EXTRA_LOGO_SRC = {');
 const lists=take('  function cupClusterTablesHtml(g, ko) {','  function announcedBenchHtml(lineup) {');
 const progress=take('  function cupProgressHtml(cup, matches) {','  // 컵 카드의 동작은');
 const view=take('  function cupKstLabel(m, ko) {','  function showView(view) {');
 const code=await minifyJs('(function(){\n'+tiers+money+lists+progress+view+'\nwindow.__utdCupView={render:renderCupView,krw:toggleCupKrw,regional:setCupRegionalView};\n})();');
 const file='cup-view.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace('  function showView(view) {',`  function loadCupView(){
    return loadOptionalAsset('${url}',()=>!!window.__utdCupView);
  }
  function renderCupView(){
    const panel=document.getElementById('cupViewContent');
    if(!panel)return;
    if(window.__utdCupView){window.__utdCupView.render();return;}
    loadFeaturePanel(panel,loadCupView,()=>{
      if(currentView==='cup'&&cupMode&&!archiveMode)renderCupView();
    },renderCupView);
  }
  function toggleCupKrw(){window.__utdCupView?.krw();}
  function setCupRegionalView(v){window.__utdCupView?.regional(v);}
  function showView(view) {`);
 return {app,file,code};
}
