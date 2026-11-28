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
 const anchor=/^<head>[ \t]*$/m;
 if([...html.matchAll(/^<head>[ \t]*$/gm)].length!==1)throw Error('Expected unique head tag');
 const assets=[['style','style.css','style'],['data','data.js','script'],['app','app.js','script']];
 const tags=assets.map(([key,file,as])=>{
  const v=versions[key];
  if(!/^[a-f0-9]{16}$/.test(v||''))throw Error('Missing final asset version: '+key);
  return '<link rel="preload" as="'+as+'" href="'+file+'?v='+v+'">';
 }).join('\n');
 return html.replace(anchor,match=>match+'\n'+tags);
}

 // Keep parser-blocking execution order, but expose resource URLs directly to HTML.
export function staticInitialAssets(html, versions) {
 const style = `<script>document.write('<link rel="stylesheet" href="style.css?v=' + window.ASSET_VERSIONS.style + '">');</script>`;
 const scripts = ['data','app','lang-ny','a11y'];
 const old = '<script>\n'+scripts.map(k => "  document.write('<script src=\""+k+".js?v="+(k==='lang-ny'?"002":"' + window.ASSET_VERSIONS."+k+" + '")+"\"><\\/script>');").join('\n')+'\n</script>';
 for(const anchor of [style,old]) if(html.split(anchor).length!==2) throw Error('Expected unique initial asset loader');
 for(const k of ['style',...scripts]) if(!/^[a-f0-9]{16}$/.test(versions[k]||'')) throw Error('Invalid asset version '+k);
 return html.replace(style,'<link rel="stylesheet" href="style.css?v='+versions.style+'">').replace(old,scripts.map(k=>'<script src="'+k+'.js?v='+versions[k]+'"></script>').join('\n'));
}
