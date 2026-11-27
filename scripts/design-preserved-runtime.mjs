import {minifyCss,cssSignature} from './minify-pages-assets.mjs';
import {gzipSync,brotliCompressSync} from 'node:zlib';

// Same document order and same truthiness test as the original dataset guard.
// Empty data attributes must still be eligible; "false" and "0" are truthy.
export const pendingImageSelector='img:not([data-fallback-listener-added]),img[data-fallback-listener-added=""]';
export function optimizeFallbackScan(app){
 const anchor=/function attachImageFallback\(\)\s*\{\s*document\.querySelectorAll\((["'])img\1\)(?=\.forEach\()/g;
 const matches=[...app.matchAll(anchor)];
 if(matches.length!==1)throw Error('Expected exactly one image fallback scan');
 return app.replace(anchor,m=>m.replace(/(["'])img\1\)$/,()=>JSON.stringify(pendingImageSelector)+')'));
}

const fontPattern=/<style id="utd-pretendard-fonts">\n([\s\S]*?)\n<\/style>/g;
const size=s=>({raw:Buffer.byteLength(s),gzip:gzipSync(s).length,brotli:brotliCompressSync(s).length});
export async function compactInlineFontCss(html){
 const matches=[...html.matchAll(fontPattern)];
 if(matches.length!==1)throw Error('Expected exactly one inline Pretendard stylesheet');
 const original=matches[0][1],compact=await minifyCss(original);
 if(cssSignature(compact)!==cssSignature(original))throw Error('Font rule changed');
 const next=html.replace(matches[0][0],()=>'<style id="utd-pretendard-fonts">\n'+compact+'\n</style>');
 const before=size(html),after=size(next);
 const applied=after.raw<before.raw&&after.gzip<=before.gzip&&after.brotli<=before.brotli;
 return {html:applied?next:html,metrics:{before,after:applied?after:before,applied,faces:92}};
}
