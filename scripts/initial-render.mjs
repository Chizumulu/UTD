// Deployment-only startup changes. Do not move route restoration, language,
// notice ordering, or PWA initialization to an asynchronous task.
const initialBlock="    renderLeagueTable();\n    renderMainMiniTable();\n    renderNextMatchStrip();\n    renderHomeMatchCards();\n    renderPromoRaceStrip();\n    renderNextMatchPreviewCard();\n    initSpotlightCards();\n    startLeagueLiveTicker();";
const replacement="    // The full league table is hidden at startup and rendered by showView('leagueRank').\n    renderNextMatchStrip();\n    renderMainMiniTable();\n    renderHomeMatchCards();\n    // renderNextMatchStrip already renders the promotion ticker.\n    renderNextMatchPreviewCard();\n    initSpotlightCards();\n    startLeagueLiveTicker();";
export function prioritizeInitialRender(app){
 if(app.split(initialBlock).length!==2)throw Error('Expected exact startup block once');
 return app.replace(initialBlock,replacement);
}
// Discover the critical styles and scripts early rather than waiting for
// document.write at the bottom of the HTML. Exact URLs reuse the same fetch.
export function preloadInitialAssets(html,versions){
 const anchor='<head>';
 if(html.split(anchor).length!==2)throw Error('Expected unique head tag');
 const assets=[['style','style.css','style'],['data','data.js','script'],['app','app.js','script']];
 const tags=assets.map(([key,file,as])=>{
  const v=versions[key];
  if(!/^[a-f0-9]{16}$/.test(v||''))throw Error('Missing final asset version: '+key);
  return '<link rel="preload" as="'+as+'" href="'+file+'?v='+v+'">';
 }).join('\n');
 return html.replace(anchor,anchor+'\n'+tags);
}
