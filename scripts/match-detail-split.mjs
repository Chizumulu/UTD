import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

export async function splitMatchDetail(app){
 const unique=s=>{if(app.split(s).length!==2)throw Error('Expected unique match detail source: '+s);return app.indexOf(s)};
 const take=(start,end)=>{const a=unique(start),b=unique(end);if(b<=a)throw Error('Invalid match detail boundaries');const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block};
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const helpers=take('  const POS_ROWS = [','  // ===== 경기장(피치) 보기:');
 const coords=take('  const PITCH_CARD_COORDS = {','  // 카드 사진 파일 확장자 탐색 순서.');
 const renderers=take('  window.ppCardPhotoNext = function (img) {','  // 상대전적 "경기" 표기를 짧게 정리합니다.');
 const detail=take('  function openMatchDetail(roundKey, weekNum) {','  function openLinkedFixture(match, showSummary = false) {');
 const start=detail.indexOf('    const isKo = isKorean;');
 if(start<0)throw Error('Missing detail renderer start');
 const render=detail.slice(start).replace('    activeLinkedFixture = null;\n    setActiveMatchPath(fixture);\n','');
 const code=await minifyJs('(function(){\n'+helpers+coords+renderers+'function renderMatchDetailLoaded(roundKey,weekNum){\nconst lineup=matchLineups[roundKey];\nif(!lineup)return;\n'+render+'\nwindow.__utdMatchDetail=renderMatchDetailLoaded;\n})();');
 const file='match-detail.js',url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 replace('  function openLinkedFixture(match, showSummary = false) {',`  let matchDetailLoadToken = 0;
  function openMatchDetail(roundKey, weekNum) {
    returnToPlayerAfterMatch = null;
    const lineup = matchLineups[roundKey];
    if (!lineup) return;
    const token = ++matchDetailLoadToken;
    activeLinkedFixture = null;
    currentMatchDetailLineup = null;
    setActiveMatchPath(findOurLineupMatch(roundKey,lineup));
    const body = document.getElementById('matchDetailBody');
    const modal = document.getElementById('matchDetailModal');
    body.removeAttribute('aria-busy');
    if (typeof window.__utdMatchDetail === 'function') {
      window.__utdMatchDetail(roundKey,weekNum);
      return;
    }
    document.getElementById('matchDetailTitle').textContent = (isKorean ? wkKo(weekNum) : wkEn(weekNum,'Week',' '));
    const status = document.createElement('div');
    status.className = 'report-empty match-detail-load-status lbl';
    status.setAttribute('role','status');
    status.dataset.ko='불러오는 중…';status.dataset.en='Loading…';
    status.textContent=isKorean?status.dataset.ko:status.dataset.en;
    body.replaceChildren(status);
    body.setAttribute('aria-busy','true');
    showModalAnimated(modal);
    const load = () => {
      loadOptionalAsset('${url}',()=>typeof window.__utdMatchDetail==='function').then(()=>{
        if(token!==matchDetailLoadToken)return;
        body.removeAttribute('aria-busy');
        window.__utdMatchDetail(roundKey,weekNum);
      },error=>{
        if(token!==matchDetailLoadToken)return;
        body.removeAttribute('aria-busy');
        console.error('Match detail load failed:',error);
        status.dataset.ko='불러오지 못했어요.';status.dataset.en='Could not load this section.';
        status.textContent=isKorean?status.dataset.ko:status.dataset.en;
        const retry=document.createElement('button');
        retry.type='button';retry.className='rmd-act-btn lbl';
        retry.dataset.ko='다시 시도';retry.dataset.en='Retry';
        retry.textContent=isKorean?retry.dataset.ko:retry.dataset.en;
        retry.onclick=()=>{
          body.setAttribute('aria-busy','true');
          status.dataset.ko='불러오는 중…';status.dataset.en='Loading…';
          status.textContent=isKorean?status.dataset.ko:status.dataset.en;
          body.replaceChildren(status);load();
        };
        body.replaceChildren(status,retry);
      });
    };
    load();
  }

  function openLinkedFixture(match, showSummary = false) {
    ++matchDetailLoadToken;
    document.getElementById('matchDetailBody')?.removeAttribute('aria-busy');`);
 for(const name of ['dismissLinkedFixtureForNavigation','closeMatchDetail'])replace('  function '+name+'() {','  function '+name+'() {\n    ++matchDetailLoadToken;\n    document.getElementById("matchDetailBody")?.removeAttribute("aria-busy");');
 return {app,file,code};
}
