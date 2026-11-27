import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

// Extract only the three cards that belong exclusively to the comparison tab.
// Shared archive data, statistical calculations and scatter chart stay in app.js.
export async function splitSeasonCompare(app){
 const unique=(s)=>{if(app.split(s).length!==2)throw Error('Expected unique compare source: '+s.slice(0,90));return app.indexOf(s)};
 const take=(start,end)=>{
  const a=unique(start),b=unique(end);
  if(b<=a)throw Error('Invalid comparison boundaries');
  const block=app.slice(a,b);
  app=app.slice(0,a)+app.slice(b);
  return block;
 };
 const boards=take('  let prevCompareExpanded = false;','  // ===== 리그 기록: 상단 탭');
 const cards=take('  // ===== 두 시즌 리그 환경 비교 카드','  // ===== SVG 차트 - 공통 헬퍼');
 const code=await minifyJs('(function(){\n'+boards+cards+'\nwindow.togglePrevCompareExpand=togglePrevCompareExpand;\nwindow.__utdSeasonCompare=function(teams){renderSeasonCompareCard();renderPrevCompareBoards();renderLuckChangeCard(teams);};\n})();');
 const file='season-compare.js';
 const url=file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16);
 const replace=(before,after)=>{unique(before);app=app.replace(before,()=>after)};
 const loader="  let seasonCompareTeams = [];\n"+
 "  let seasonComparePending = false;\n"+
 "  function renderSeasonCompareTab() {\n"+
 "    if (archiveMode || currentView !== 'stats' || statsTab !== 'compare') return;\n"+
 "    const panel = document.querySelector('#statsView [data-stats-panel=\"compare\"]');\n"+
 "    if (!panel) return;\n"+
 "    let status = document.getElementById('seasonCompareLoadStatus');\n"+
 "    if (typeof window.__utdSeasonCompare === 'function') {\n"+
 "      if (status) status.remove();\n"+
 "      panel.removeAttribute('aria-busy');\n"+
 "      window.__utdSeasonCompare(seasonCompareTeams);\n"+
 "      return;\n"+
 "    }\n"+
 "    if (!status) {\n"+
 "      status = document.createElement('div');\n"+
 "      status.id = 'seasonCompareLoadStatus';\n"+
 "      status.className = 'report-empty';\n"+
 "      status.setAttribute('role','status');\n"+
 "      panel.prepend(status);\n"+
 "    }\n"+
 "    status.textContent = isKorean ? '불러오는 중…' : 'Loading…';\n"+
 "    panel.setAttribute('aria-busy','true');\n"+
 "    if (seasonComparePending) return;\n"+
 "    seasonComparePending = true;\n"+
 "    loadOptionalAsset('"+url+"', () => typeof window.__utdSeasonCompare === 'function').then(() => {\n"+
 "      seasonComparePending = false;\n"+
 "      panel.removeAttribute('aria-busy');\n"+
 "      status.remove();\n"+
 "      renderSeasonCompareTab();\n"+
 "    }, error => {\n"+
 "      seasonComparePending = false;\n"+
 "      panel.removeAttribute('aria-busy');\n"+
 "      console.error('Season comparison load failed:', error);\n"+
 "      status.textContent = isKorean ? '불러오지 못했어요. ' : 'Could not load this section. ';\n"+
 "      const retry = document.createElement('button');\n"+
 "      retry.type = 'button';\n"+
 "      retry.className = 'rmd-act-btn lbl';\n"+
 "      retry.dataset.ko = '다시 시도'; retry.dataset.en = 'Retry';\n"+
 "      retry.textContent = isKorean ? retry.dataset.ko : retry.dataset.en;\n"+
 "      retry.onclick = renderSeasonCompareTab;\n"+
 "      status.appendChild(retry);\n"+
 "    });\n"+
 "  }\n\n";
 replace("  let statsTab = 'rank';",loader+"  let statsTab = 'rank';");
 replace("    if (panel) playViewEnterAnimation(panel);\n  }\n\n  function selectStatCategory", "    if (tab === 'compare') renderSeasonCompareTab();\n    if (panel) playViewEnterAnimation(panel);\n  }\n\n  function selectStatCategory");
 replace("    renderSeasonCompareCard();\n    renderStatCatNav();\n    renderStatBoard();\n    renderPrevCompareBoards();","    renderStatCatNav();\n    renderStatBoard();");
 replace("    renderScatterPlots(teams);\n    renderLuckChangeCard(teams);\n    renderForfeitMatchesCard();","    renderScatterPlots(teams);\n    seasonCompareTeams = teams;\n    renderSeasonCompareTab();\n    renderForfeitMatchesCard();");
 return {app,file,code};
}
