import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitVenueMap(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique venue map source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid venue map boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const state=take('  let venueLeafletMap = null;','  // 두 좌표 간 직선거리');
 const maps=take('  function getVenueEntries() {','  const RANK_HIST_COLORS = [');
 const code=await minifyJs('(function(){\n'+state+maps+'\nwindow.__utdVenueMap={list:renderVenuesList,map:renderVenueLeafletMap,large:renderVenueLeafletMapLarge,open:openVenueMapModal,sort:setVenueSort};\n})();');
 const file='venue-map.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 unique('  function renderVenuesView() {\n    renderVenuesList();\n    applyVenueMode();\n  }');
 app=app.replace('  function renderVenuesView() {\n    renderVenuesList();\n    applyVenueMode();\n  }',()=>`  function loadVenueMapModule(){
    return loadOptionalAsset('${url}',()=>!!window.__utdVenueMap);
  }
  let requestedVenueSort = 'name';
  function renderVenueLeafletMap(){
    if(window.__utdVenueMap){
      window.__utdVenueMap.sort(requestedVenueSort);
      window.__utdVenueMap.map();
      return;
    }
    const panel=document.getElementById('venueLeafletMap');
    if(panel)loadFeaturePanel(panel,loadVenueMapModule,()=>{
      if(currentView==='venues'&&venueViewMode==='map')renderVenueLeafletMap();
    },renderVenueLeafletMap);
  }
  function renderVenueLeafletMapLarge(){
    if(window.__utdVenueMap){window.__utdVenueMap.large();return;}
    const panel=document.getElementById('venueLeafletMapLarge');
    if(panel)loadFeaturePanel(panel,loadVenueMapModule,()=>{
      if(document.getElementById('venueMapModal')?.style.display==='flex')renderVenueLeafletMapLarge();
    },renderVenueLeafletMapLarge);
  }
  function openVenueMapModal(){
    const modal=document.getElementById('venueMapModal');
    if(modal){showModalAnimated(modal);renderVenueLeafletMapLarge();}
  }
  function closeVenueMapModal(){
    const modal=document.getElementById('venueMapModal');
    if(modal)closeModalAnimated(modal);
  }
  function setVenueSort(mode){
    requestedVenueSort=mode;
    if(window.__utdVenueMap)window.__utdVenueMap.sort(mode);
    else if(currentView==='venues'&&venueViewMode==='map')renderVenueLeafletMap();
  }
  function renderVenuesView(){applyVenueMode();}`);
 return {app,file,code};
}
