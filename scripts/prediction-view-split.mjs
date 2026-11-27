import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitPredictionView(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique prediction source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid prediction boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const render=take('  function renderPredictions(forceRerun) {','  // ===== 리그 예측: 상단 탭');
 const summary=take('  function seasonRaceLimits(','  // ===== 만약에 시뮬레이터');
 const whatif1=take('  function wiTeamFixtures(','  function wiDeltaChip(');
 const whatif2=take('  function wiResultHtml(','  function wiTitleScenarioState(');
 const rest=take('  function renderWhatIfQuick() {','  // ===================================================================\n\n\n  // ===== 리포트 문장 생성');
 const code=await minifyJs('(function(){\n'+render+summary+whatif1+whatif2+rest+'\nwindow.__utdPredictionView={render:renderPredictions,draw:drawPredictionTable,quick:renderWhatIfQuick,track:renderAiTrackRecord};\n})();');
 const file='prediction-view.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace("  let predictTab = 'outlook';",`  function loadPredictionView(){
    return loadOptionalAsset('${url}',()=>!!window.__utdPredictionView);
  }
  function renderPredictions(forceRerun){
    const panel=document.getElementById('predictTableBody');
    if(window.__utdPredictionView){window.__utdPredictionView.render(forceRerun);return;}
    if(!panel||panel.getAttribute('aria-busy')==='true')return;
    panel.setAttribute('aria-busy','true');
    panel.innerHTML='<tr><td colspan="7" class="predict-loading">'+(isKorean?'불러오는 중…':'Loading…')+'</td></tr>';
    loadPredictionView().then(()=>{
      panel.removeAttribute('aria-busy');
      if(currentView==='predict'&&!archiveMode){renderPredictions(forceRerun);renderAiTrackRecord();}
    }).catch(()=>{
      panel.removeAttribute('aria-busy');
      panel.innerHTML='<tr><td colspan="7" class="predict-loading">'+(isKorean?'불러오지 못했어요.':'Could not load.')+' <button type="button" class="analysis-share" onclick="renderPredictions(true)">'+(isKorean?'다시 시도':'Retry')+'</button></td></tr>';
    });
  }
  function drawPredictionTable(){if(window.__utdPredictionView)window.__utdPredictionView.draw();else if(currentView==='predict'&&!archiveMode)renderPredictions(false);}
  function renderWhatIfQuick(){window.__utdPredictionView?.quick();}
  function renderAiTrackRecord(){window.__utdPredictionView?.track();}
  let predictTab = 'outlook';`);
 return {app,file,code};
}
