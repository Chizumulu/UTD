// Deployment-only font delivery changes. Keep the licensed source and all
// original WOFF2 subsets unchanged, including rare Korean and Latin glyphs.
const FONT_LINK='<link rel="stylesheet" href="./fonts/pretendard/pretendardvariable-dynamic-subset.css">';
const GOOGLE_LINK='<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">';

export function optimizeFontDelivery(html, css) {
  if (html.split(FONT_LINK).length!==2 || html.split(GOOGLE_LINK).length!==2) {
    throw Error('Expected font stylesheet tags not found exactly once');
  }
  if (/<\/style/i.test(css)) throw Error('Unexpected style closing tag in local font CSS');
  const sourceUrls=[...css.matchAll(/url\(\.\/woff2-dynamic-subset\/(PretendardVariable\.subset\.\d+\.woff2)\)/g)];
  if(sourceUrls.length!==92 || new Set(sourceUrls.map(m=>m[1])).size!==92)throw Error('Unexpected Pretendard subset inventory');
  const inline=css.replace(/url\(\.\/woff2-dynamic-subset\//g,'url(./fonts/pretendard/woff2-dynamic-subset/');
  if ([...inline.matchAll(/url\(/g)].length!==sourceUrls.length) throw Error('Unexpected font URL');
  return html.replace(FONT_LINK,()=>'<style id="utd-pretendard-fonts">\n'+inline+'\n</style>')
    .replace(GOOGLE_LINK,()=>GOOGLE_LINK.replace('rel="stylesheet"','rel="stylesheet" media="print" onload="this.media=\'all\'"')+'\n<noscript>'+GOOGLE_LINK+'</noscript>');
}
