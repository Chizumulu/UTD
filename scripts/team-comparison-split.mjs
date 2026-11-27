import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

// The home hero, schedule inline previews and round-favour simulation share
// helpers with these views: retain those helpers and their synchronous API.
export async function splitTeamComparison(app){
 const unique=(s)=>{if(app.split(s).length!==2)throw Error('Expected unique team comparison source: '+s.slice(0,90));return app.indexOf(s)};
 const take=(start,end)=>{
  const a=unique(start),b=unique(end);
  if(b<=a)throw Error('Invalid comparison boundaries');
  const block=app.slice(a,b);app=app.slice(0,a)+app.slice(b);return block;
 };
 const replace=(a,b)=>{unique(a);app=app.replace(a,()=>b)};
 const history=take('  function mcStatRow(','  // 승/무/패 확률 막대 (홈-무-원정');
 const related=take('  function relIsPlayed(','  // 관련 블록 칩 클릭:');
 const modal=take('  function openMatchCompareModal(homeEn, homeKo, awayEn, awayKo, roundKey, played, { cupVenue } = {}) {','  // ===== 전적 비교: 경기 결과');
 const team=take('  function tcDefaultTeams() {','  // ===== 날짜 / 시즌 정보 유틸');
 const code=await minifyJs('(function(){\n'+history+related+
  modal.replace('function openMatchCompareModal(','function renderMatchCompareModal(')+
  team.replace('function renderTeamCompareView() {','function drawTeamCompareView() {')+
  '\nwindow.__utdTeamComparison={drawTeamCompareView,renderMatchCompareModal,onTeamCompareSelect,swapTeamCompare,openTeamCompareFixture};\n})();');
 const file='team-comparison.js';
 const url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 // Keep route state and the public function in app.js, including the existing
 // route synchronization wrapper. The async completion calls the public entry.
 const teamLoader=[
  '  function loadTeamComparison() {',
  "    return loadOptionalAsset('"+url+"', () => !!window.__utdTeamComparison);",
  '  }',
  "  function renderTeamCompareView() {",
  "    if (archiveMode || currentView !== 'teamCompare') return;",
  "    if (window.__utdTeamComparison) { window.__utdTeamComparison.drawTeamCompareView(); return; }",
  "    const body = document.getElementById('teamCompareBody');",
  "    if (!body) return;",
  "    const controls = ['tcSelectA','tcSelectB','tcSwapBtn'].map(id => document.getElementById(id)).filter(Boolean);",
  "    controls.forEach(el => { el.disabled = true; });",
  "    loadFeaturePanel(body, loadTeamComparison, () => {",
  "      controls.forEach(el => { el.disabled = false; });",
  "      window.renderTeamCompareView();",
  "    }, () => window.renderTeamCompareView());",
  "  }",
  "  function onTeamCompareSelect(side,value) { window.__utdTeamComparison?.onTeamCompareSelect(side,value); }",
  "  function swapTeamCompare() { window.__utdTeamComparison?.swapTeamCompare(); }",
  "  function openTeamCompareFixture() { window.__utdTeamComparison?.openTeamCompareFixture(); }",
  ""
 ].join('\n');
 replace('  // ===== 날짜 / 시즌 정보 유틸',teamLoader+'\n  // ===== 날짜 / 시즌 정보 유틸');
 const modalLoader=[
  '  let matchComparisonRequest = 0;',
  '  let matchComparisonPending = false;',
  '  function openMatchCompareModal(homeEn, homeKo, awayEn, awayKo, roundKey, played, { cupVenue } = {}) {',
  '    const args = [homeEn, homeKo, awayEn, awayKo, roundKey, played, {cupVenue}];',
  '    if (window.__utdTeamComparison) { window.__utdTeamComparison.renderMatchCompareModal(...args); return; }',
  '    if (!getTeamCompareSnapshot(homeEn, homeKo).team || !getTeamCompareSnapshot(awayEn, awayKo).team) return;',
  '    const request = ++matchComparisonRequest;',
  '    matchComparisonPending = true;',
  '    const origin = currentView, fromArchive = archiveMode;',
  '    const modal = document.getElementById("matchCompareModal");',
  '    const body = document.getElementById("matchCompareBody");',
  '    lastMatchCompareArgs = args;',
  '    body.replaceChildren();',
  '    const status = document.createElement("p");',
  '    status.className = "report-empty lbl";',
  '    status.dataset.ko = "불러오는 중…"; status.dataset.en = "Loading…";',
  '    status.textContent = isKorean ? status.dataset.ko : status.dataset.en;',
  '    body.appendChild(status); body.setAttribute("aria-busy","true");',
  '    showModalAnimated(modal);',
  '    const stillCurrent = () => request === matchComparisonRequest && currentView === origin && archiveMode === fromArchive;',
  '    loadTeamComparison().then(() => {',
  '      if (!stillCurrent()) return;',
  '      matchComparisonPending = false;',
  '      body.removeAttribute("aria-busy");',
  '      window.__utdTeamComparison.renderMatchCompareModal(...args);',
  '    }, error => {',
  '      if (!stillCurrent()) return;',
  '      matchComparisonPending = false;',
  '      body.removeAttribute("aria-busy");',
  '      console.error("Match comparison load failed:",error);',
  '      status.dataset.ko = "불러오지 못했어요."; status.dataset.en = "Could not load this section.";',
  '      status.textContent = isKorean ? status.dataset.ko : status.dataset.en;',
  '      const retry = document.createElement("button");',
  '      retry.type = "button"; retry.className = "rmd-act-btn lbl";',
  '      retry.dataset.ko = "다시 시도"; retry.dataset.en = "Retry";',
  '      retry.textContent = isKorean ? retry.dataset.ko : retry.dataset.en;',
  '      retry.onclick = () => openMatchCompareModal(...args);',
  '      body.appendChild(retry);',
  '    });',
  '  }',
  ''
 ].join('\n');
 replace('  // ===== 전적 비교: 경기 결과',modalLoader+'\n  // ===== 전적 비교: 경기 결과');
 replace('  function closeMatchCompareModal(returnToFixture = true) {','  function closeMatchCompareModal(returnToFixture = true) {\n    ++matchComparisonRequest;\n    matchComparisonPending = false;\n    document.getElementById("matchCompareBody")?.removeAttribute("aria-busy");');
 // A pending open must not resurrect a modal after navigation or closure.
 for(const marker of ['  function showView(view) {','  function showCupView() {','  function openSeasonArchive(opts) {','  function closeMatchDetail() {','  function dismissLinkedFixtureForNavigation() {']){
  // clear pending before calling close: close(false) may dismiss the linked fixture.
  replace(marker,marker+'\n    if (matchComparisonPending) closeMatchCompareModal();');
 }
 // During pending load the translated status is updated by the existing .lbl
 // pass; do not issue a second open or suppress the first actual analytics event.
 replace("if (lastMatchCompareArgs && matchCompareModalEl && matchCompareModalEl.style.display === 'flex') {",
 "if (!matchComparisonPending && lastMatchCompareArgs && matchCompareModalEl && matchCompareModalEl.style.display === 'flex') {");
 return {app,file,code};
}
