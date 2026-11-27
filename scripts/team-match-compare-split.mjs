import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

// Keep route state, shared calculations and modal lifecycle in the initial app.
export async function splitTeamMatchCompare(app) {
  const unique = s => {
    if (app.split(s).length !== 2) throw Error('Expected unique compare source: '+s);
    return app.indexOf(s);
  };
  const take = (start,end) => {
    const a=unique(start), b=unique(end);
    if(b<=a) throw Error('Invalid comparison boundaries');
    const block=app.slice(a,b);
    app=app.slice(0,a)+app.slice(b);
    return block;
  };
  const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after);};
  const asset=async(file,source,entry,fn)=>{
    const code=await minifyJs('(function(){\n'+source+'\nwindow.'+entry+'='+fn+';\n})();');
    return {file,code,url:file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)};
  };
  const team=take('  function tcSnapshot(ranked, nameEn) {','  // ===== 날짜 / 시즌 정보 유틸');
  const teamAsset=await asset('team-compare.js',team.replace('function renderTeamCompareView()','function renderTeamCompareLoaded()'),'__utdTeamCompare','renderTeamCompareLoaded');
  const related=take('  function relIsPlayed(m) {','  // 관련 블록 칩 클릭:');
  const modal=take('  function openMatchCompareModal(homeEn, homeKo, awayEn, awayKo, roundKey, played, { cupVenue } = {}) {','  // ===== 전적 비교: 경기 결과');
  const matchAsset=await asset('match-compare.js',related+modal.replace('function openMatchCompareModal(','function renderMatchCompareLoaded('),'__utdMatchCompare','renderMatchCompareLoaded');
  replace('  // ===== 날짜 / 시즌 정보 유틸',`  function renderTeamCompareView() {
    const body = document.getElementById('teamCompareBody');
    if (!body || currentView !== 'teamCompare') return;
    const ranked = getRankedTeams('all');
    const exists = en => ranked.some(t => t.nameEn === en);
    if (!exists(teamCompareA) || !exists(teamCompareB) || teamCompareA === teamCompareB) {
      [teamCompareA, teamCompareB] = tcDefaultTeams();
    }
    if (typeof window.__utdTeamCompare === 'function') {
      window.__utdTeamCompare();
      return;
    }
    loadFeaturePanel(body,
      () => loadOptionalAsset('${teamAsset.url}', () => typeof window.__utdTeamCompare === 'function'),
      renderTeamCompareView);
  }

  // ===== 날짜 / 시즌 정보 유틸`);
  replace('  // ===== 전적 비교: 경기 결과',`  let matchCompareLoadToken = 0;
  function openMatchCompareModal(...args) {
    const token = ++matchCompareLoadToken;
    if (typeof window.__utdMatchCompare === 'function') {
      window.__utdMatchCompare(...args);
      return;
    }
    const modal = document.getElementById('matchCompareModal');
    const body = document.getElementById('matchCompareBody');
    if (!modal || !body) return;
    lastMatchCompareArgs = null;
    body.removeAttribute('aria-busy');
    showModalAnimated(modal);
    const status = document.createElement('p');
    status.className = 'report-empty lbl';
    status.dataset.ko = '불러오는 중…';
    status.dataset.en = 'Loading…';
    status.textContent = isKorean ? status.dataset.ko : status.dataset.en;
    body.replaceChildren(status);
    body.setAttribute('aria-busy','true');
    loadOptionalAsset('${matchAsset.url}', () => typeof window.__utdMatchCompare === 'function').then(() => {
      if (token !== matchCompareLoadToken) return;
      body.removeAttribute('aria-busy');
      window.__utdMatchCompare(...args);
    }, error => {
      if (token !== matchCompareLoadToken) return;
      body.removeAttribute('aria-busy');
      console.error('Match comparison load failed:',error);
      status.dataset.ko = '불러오지 못했어요.';
      status.dataset.en = 'Could not load this section.';
      status.textContent = isKorean ? status.dataset.ko : status.dataset.en;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'rmd-act-btn lbl';
      retry.dataset.ko = '다시 시도';
      retry.dataset.en = 'Retry';
      retry.textContent = isKorean ? retry.dataset.ko : retry.dataset.en;
      retry.onclick = () => openMatchCompareModal(...args);
      body.replaceChildren(status,retry);
    });
  }

  // ===== 전적 비교: 경기 결과`);
  replace('  function closeMatchCompareModal(returnToFixture = true) {','  function closeMatchCompareModal(returnToFixture = true) {\n    ++matchCompareLoadToken;\n    document.getElementById(\'matchCompareBody\')?.removeAttribute(\'aria-busy\');');
  return {app,assets:[teamAsset,matchAsset]};
}
