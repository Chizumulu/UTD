// Optimize external script delivery in the Pages artifact only.
// Keep the existing Clarity project and early command queue. GA4/GTM untouched.
export function optimizeExternalScripts(html) {
 const clarity=/<script type="text\/javascript">\s*\(function\(c,l,a,r,i,t,y\)\{[\s\S]*?\}\)\(window, document, "clarity", "script", "([^"]+)"\);\s*<\/script>/g;
 const found=[...html.matchAll(clarity)];
 const anime='<script src="https://cdn.jsdelivr.net/npm/animejs@4/lib/anime.iife.min.js"></script>';
 if(found.length!==1||html.split(anime).length!==2)throw Error('Expected third-party script tags not found exactly once');
 const project=JSON.stringify(found[0][1]);
 const loader='<script>\n(function(w,d){\n'+
  '  w.clarity=w.clarity||function(){(w.clarity.q=w.clarity.q||[]).push(arguments)};\n'+
  '  var started=false, timer;\n'+
  '  function start(){if(started)return;started=true;clearTimeout(timer);d.removeEventListener("pointerdown",start,true);d.removeEventListener("keydown",start,true);var s=d.createElement("script");s.async=true;s.src="https://www.clarity.ms/tag/"+'+project+';d.head.appendChild(s);}\n'+
  '  function afterLoad(){if(w.requestIdleCallback)w.requestIdleCallback(start,{timeout:2000});else setTimeout(start,0);}\n'+
  '  d.addEventListener("pointerdown",start,{capture:true,passive:true});d.addEventListener("keydown",start,{capture:true});\n'+
  '  if(d.readyState==="complete")afterLoad();else w.addEventListener("load",afterLoad,{once:true});\n'+
  '  timer=setTimeout(start,5000);\n'+
  '})(window,document);\n</script>';
 // Anime.js is optional at startup; async preserves later animations without
 // blocking DOMContentLoaded, and existing guards handle early calls/failure.
 return html.replace(found[0][0],()=>loader).replace(anime,anime.replace('<script ','<script async '));
}
