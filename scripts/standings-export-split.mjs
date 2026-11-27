import {createHash} from 'node:crypto';
import {minifyJs} from './minify-pages-assets.mjs';

// Keep the shared image loader in app.js (match posters also use it).
// Move only the self-contained standings canvas drawing and download code.
export async function splitStandingsExport(app){
 const start='  function drawExportBadge(ctx, img, name, x, y, size, fallbackColor) {';
 const end='  // ===================================================================\n  // ===== 매치데이 포스터 다운로드';
 if(app.split(start).length!==2||app.split(end).length!==2)throw Error('Standings export boundaries changed');
 const from=app.indexOf(start),to=app.indexOf(end);
 if(to<=from)throw Error('Invalid export boundaries');
 const block=app.slice(from,to);
 const fn='async function exportStandingsImage() {';
 if(block.split(fn).length!==2)throw Error('Standings export function changed');
 // The classic script shares the existing app global lexical environment.
 // The public entry point remains in app.js, including toast retry callbacks.
 const code=await minifyJs('(function(){\n'+block.replace(fn,'async function runStandingsImageExport() {')+'\nwindow.__utdStandingsExport=runStandingsImageExport;\n})();');
 const hash=createHash('sha256').update(code).digest('hex').slice(0,16);
 const file='standings-export.js';
 const url=file+'?v='+hash;
 const wrapper="  async function exportStandingsImage() {\n"+
 "    const btn = document.getElementById('exportImgBtn');\n"+
 "    if (btn && btn.disabled) return;\n"+
 "    if (typeof window.__utdStandingsExport === 'function') return window.__utdStandingsExport();\n"+
 "    const label = btn ? btn.querySelector('.lbl') : null;\n"+
 "    const original = label ? label.textContent : '';\n"+
 "    if (btn) btn.disabled = true;\n"+
 "    if (label) label.textContent = isKorean ? '생성 중...' : 'Generating...';\n"+
 "    try {\n"+
 "      await loadOptionalAsset('"+url+"', () => typeof window.__utdStandingsExport === 'function');\n"+
 "    } catch (err) {\n"+
 "      console.error('Standings export load failed:', err);\n"+
 "      if (btn) btn.disabled = false;\n"+
 "      if (label) label.textContent = original;\n"+
 "      showToast(isKorean ? '이미지를 만들지 못했어요' : 'Couldn\\u2019t create the image', { tone: 'error', action: toastRetry(exportStandingsImage) });\n"+
 "      return;\n"+
 "    }\n"+
 "    if (btn) btn.disabled = false;\n"+
 "    if (label) label.textContent = original;\n"+
 "    return window.__utdStandingsExport();\n"+
 "  }\n\n";
 return {app:app.slice(0,from)+wrapper+app.slice(to),file,code};
}
