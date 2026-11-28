// Deployment-only: render the actual next-match card as soon as app.js has
// executed, without waiting for unrelated scripts or DOMContentLoaded.
// Keep the existing initialization and route restoration in their original order.
export function renderEarlyHero(app){
 const replace=(before,after)=>{
  if(app.split(before).length!==2)throw Error('Expected unique early hero source: '+before.slice(0,100));
  app=app.replace(before,()=>after);
 };
 replace("  function renderNextMatchStrip() {\n    nmpDetachCard();\n    try { renderNextMatchStripInner(); } finally { nmpPlaceCard(); }",
 "  function renderNextMatchStrip(reuseEarlyHero = false) {\n    nmpDetachCard();\n    try { if (!reuseEarlyHero) renderNextMatchStripInner(); } finally { nmpPlaceCard(); }");
 replace("  // ===== 초기 실행 (App Init) =====\n  document.addEventListener('DOMContentLoaded', function() {",
 "  let earlyHero = null;\n  // ===== 초기 실행 (App Init) =====\n  document.addEventListener('DOMContentLoaded', function() {");
 replace("    renderNextMatchStrip();\n    renderMainMiniTable();\n    renderHomeMatchCards();",
 "    const hero = document.getElementById('nextMatchStrip');\n    const reuseEarlyHero = !!(earlyHero && !location.hash && earlyHero.lang === isKorean && hero === earlyHero.node && hero.firstElementChild === earlyHero.first && !hero.hasAttribute('aria-busy'));\n    earlyHero = null;\n    renderNextMatchStrip(reuseEarlyHero);\n    renderMainMiniTable();\n    renderHomeMatchCards();");
 // At EOF all app-level const/let dependencies have been initialized.
 return app+"\n// Early home hero: deep links retain the original startup path.\nif (document.readyState === 'loading' && !location.hash) {\n  const hero = document.getElementById('nextMatchStrip');\n  if (hero) {\n    try {\n      nmpDetachCard();\n      try { renderNextMatchStripInner(); } finally { nmpPlaceCard(); }\n      if (NMC_NARROW_MQ && NMC_NARROW_MQ.matches) {\n        renderCupHeroPanel();\n        nmcPlacePromo();\n        renderPromoRaceStrip();\n      }\n      if (window.matchMedia('(min-width: 1200px)').matches) {\n        renderCupHeroPanel();\n        nmcPlacePromo();\n        renderPromoRaceStrip();\n        renderMainMiniTable();\n        renderHomeMatchCards();\n      }\n      if (hero.firstElementChild && !hero.hasAttribute('aria-busy')) {\n        earlyHero = {node:hero, first:hero.firstElementChild, lang:isKorean};\n        if (typeof performance.mark === 'function') performance.mark('utd-hero-ready');\n      }\n    } catch (error) { console.warn('Early hero fallback:', error); }\n  }\n}\n";
}
