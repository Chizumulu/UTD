// Deployment-only startup changes. Do not move route restoration, language,
// notice ordering, or PWA initialization to an asynchronous task.
const initialBlock="    renderLeagueTable();\n    renderMainMiniTable();\n    renderNextMatchStrip();\n    renderHomeMatchCards();\n    renderPromoRaceStrip();\n    renderNextMatchPreviewCard();\n    initSpotlightCards();\n    startLeagueLiveTicker();";
const replacement="    // The full league table is hidden at startup and rendered by showView('leagueRank').\n    renderNextMatchStrip();\n    renderMainMiniTable();\n    renderHomeMatchCards();\n    // renderNextMatchStrip already renders the promotion ticker.\n    renderNextMatchPreviewCard();\n    initSpotlightCards();\n    startLeagueLiveTicker();";
export function prioritizeInitialRender(app){
 if(app.split(initialBlock).length!==2)throw Error('Expected exact startup block once');
 const labelWrite = "      el.innerHTML = isKorean ? el.getAttribute('data-ko') : el.getAttribute('data-en');";
 const startup = app.indexOf("document.addEventListener('DOMContentLoaded', function() {");
 if(startup < 0) throw Error('Missing startup listener');
 const prefix = app.slice(0,startup);
 const suffix = app.slice(startup);
 if(!suffix.includes(labelWrite)) throw Error('Missing startup label assignment');
 if(process.env.UTD_PERF_GROUP && !['F'].includes(process.env.UTD_PERF_GROUP)) return app.replace(initialBlock,replacement);
 return (prefix + suffix.replace(labelWrite, "      const localized = isKorean ? el.getAttribute('data-ko') : el.getAttribute('data-en');\n      if (localized !== null && el.innerHTML === localized) return;\n      el.innerHTML = localized;")).replace(initialBlock,replacement);
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
 // Replace the dynamic stylesheet insertion with the same final hashed URL.
 if(process.env.UTD_PERF_GROUP && !['D','F'].includes(process.env.UTD_PERF_GROUP)) return html.replace(anchor,match=>match+'\n'+tags);
 const dynamicStyle = /<script>document\.write\('<link rel="stylesheet" href="style\.css\?v=' \+ window\.ASSET_VERSIONS\.style \+ '">'\);<\/script>/g;
 if([...html.matchAll(dynamicStyle)].length!==1)throw Error('Expected unique dynamic stylesheet');
 return html.replace(dynamicStyle, '<link rel="stylesheet" href="style.css?v='+versions.style+'">').replace(anchor,match=>match+'\n'+tags);
}

// Preserve parser-blocking execution order and the early hero's loading-state guard.
// Use exactly the same content-hashed URLs as the preloads.
export function staticStartupScripts(html, versions) {
 if(process.env.UTD_PERF_GROUP) return html;
 const original = "<script>\n  document.write('<script src=\"data.js?v=' + window.ASSET_VERSIONS.data + '\"><\\/script>');\n  document.write('<script src=\"app.js?v=' + window.ASSET_VERSIONS.app + '\"><\\/script>');\n  document.write('<script src=\"lang-ny.js?v=002\"><\\/script>');\n  document.write('<script src=\"a11y.js?v=' + window.ASSET_VERSIONS.a11y + '\"><\\/script>');\n</script>";
 if(html.split(original).length !== 2) throw Error('Expected unique startup script block');
 for(const key of ['data','app','a11y']) if(!/^[a-f0-9]{16}$/.test(versions[key]||'')) throw Error('Missing startup asset version: '+key);
 return html.replace(original, ['data.js?v='+versions.data,'app.js?v='+versions.app,'lang-ny.js?v=002','a11y.js?v='+versions.a11y].map(src=>'<script src="'+src+'"></script>').join('\n'));
}
