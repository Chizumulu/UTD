import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitPlayerModals(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique player modal source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid player modal boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const chart=take('  function renderSquadPlayerSeasonChart(', '  // ===== 선수 사진 2종 공통 헬퍼');
 const scorer=take('  function openPlayerModal(key) {','  function closePlayerModal() {');
 const analysis=take('  function renderSquadPlayerAssistRelations(', '  // ===== 스쿼드 선수 통산 기록 모달');
 const squad=take('  function openSquadPlayerModal(identifier) {','  function closeSquadPlayerModal() {');
 const code=await minifyJs('(function(){\n'+chart+analysis+scorer.replace('function openPlayerModal(','function renderPlayerLoaded(')+squad.replace('function openSquadPlayerModal(','function renderSquadPlayerLoaded(')+'\nwindow.__utdPlayerModals={scorer:renderPlayerLoaded,squad:renderSquadPlayerLoaded};\n})();');
 const file='player-modals.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace('  function closePlayerModal() {',`  const playerModalTokens = {scorer:0,squad:0};
  let pendingSquadComp = null;
  function loadPlayerModal(kind, id) {
    const token = ++playerModalTokens[kind];
    const modal = document.getElementById(kind === 'scorer' ? 'playerModal' : 'squadPlayerModal');
    if (!modal) return;
    if (window.__utdPlayerModals) {
      window.__utdPlayerModals[kind](id);
      return;
    }
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    content.querySelector('.player-modal-load-status')?.remove();
    const status = document.createElement('div');
    status.className = 'report-empty player-modal-load-status';
    status.setAttribute('role','status');
    status.textContent = isKorean ? '불러오는 중…' : 'Loading…';
    content.appendChild(status);
    content.setAttribute('aria-busy','true');
    for (const child of content.children) {
      if (child !== status && !child.matches('.close-btn') && !child.querySelector('.close-btn')) {
        child.classList.add('player-modal-loading-hidden');
      }
    }
    showModalAnimated(modal);
    loadOptionalAsset('${url}',()=>!!window.__utdPlayerModals).then(()=>{
      if (token !== playerModalTokens[kind]) return;
      clearPlayerModalLoading(kind);
      window.__utdPlayerModals[kind](id);
      if (kind === 'squad' && pendingSquadComp !== null) {
        const comp = pendingSquadComp; pendingSquadComp = null; setSquadPlayerComp(comp);
      }
    },error=>{
      if (token !== playerModalTokens[kind]) return;
      content.removeAttribute('aria-busy');
      console.error('Player modal load failed:',error);
      status.textContent = isKorean ? '불러오지 못했어요. ' : 'Could not load this section. ';
      const retry = document.createElement('button');
      retry.type='button'; retry.className='rmd-act-btn lbl';
      retry.dataset.ko='다시 시도'; retry.dataset.en='Retry';
      retry.textContent=isKorean?retry.dataset.ko:retry.dataset.en;
      retry.onclick=()=>loadPlayerModal(kind,id);
      status.appendChild(retry);
    });
  }
  function clearPlayerModalLoading(kind) {
    const modal=document.getElementById(kind==='scorer'?'playerModal':'squadPlayerModal');
    const content=modal?.querySelector('.modal-content');
    content?.removeAttribute('aria-busy');
    content?.querySelector('.player-modal-load-status')?.remove();
    content?.querySelectorAll('.player-modal-loading-hidden').forEach(el=>el.classList.remove('player-modal-loading-hidden'));
  }
  function openPlayerModal(key) {
    if (!topScorersData.some(p=>p.key===key)) return;
    loadPlayerModal('scorer',key);
  }
  function closePlayerModal() {
    ++playerModalTokens.scorer;
    clearPlayerModalLoading('scorer');`);
 replace('  function closeSquadPlayerModal() {',`  function openSquadPlayerModal(identifier) {
    const former=typeof formerSquadData !== 'undefined' && Array.isArray(formerSquadData)?formerSquadData:[];
    const num=parseInt(identifier,10), f=/^F(\\d+)$/.exec(String(identifier));
    const valid=(f&&former.some(p=>p.number===parseInt(f[1],10))) ||
      (String(num)===String(identifier)&&[...squadData,...former].some(p=>p.number===num)) ||
      [...squadData,...former].some(p=>p.number==null&&p.nameEn===identifier);
    if (!valid) return;
    pendingSquadComp=null;
    squadPlayerPaneRenderer=null;
    loadPlayerModal('squad',identifier);
  }
  function closeSquadPlayerModal() {
    ++playerModalTokens.squad;
    pendingSquadComp=null;
    squadPlayerPaneRenderer=null;
    clearPlayerModalLoading('squad');`);
 replace('    if (squadPlayerPaneRenderer) squadPlayerPaneRenderer(squadPlayerCompMode);','    if (squadPlayerPaneRenderer) squadPlayerPaneRenderer(squadPlayerCompMode);\n    else if (!window.__utdPlayerModals) pendingSquadComp = squadPlayerCompMode;');
 return {app,file,code};
}
