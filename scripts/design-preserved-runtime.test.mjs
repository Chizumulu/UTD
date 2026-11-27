import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minifyJs,cssSignature} from './minify-pages-assets.mjs';
import {optimizeFontDelivery} from './font-delivery.mjs';
import {optimizeFallbackScan,pendingImageSelector,compactInlineFontCss} from './design-preserved-runtime.mjs';
test('only the named fallback selector changes, including in minified output',async()=>{
 const app=readFileSync('app.js','utf8');
 const source=await minifyJs(app);
 const changed=optimizeFallbackScan(source);
 assert.notEqual(changed,source);
 const literal=JSON.stringify(pendingImageSelector);
 assert.equal(changed.split(literal).length,2);
 const restored=changed.replace(literal,'"img"');
 assert.equal(await minifyJs(restored),source);
 assert.throws(()=>optimizeFallbackScan('function unrelated(){document.querySelectorAll("img").forEach(f)}'));
});
test('font CSS content, licenses, URLs, rules and cascade remain exact',async()=>{
 const html=optimizeFontDelivery(readFileSync('index.html','utf8'),readFileSync('fonts/pretendard/pretendardvariable-dynamic-subset.css','utf8'));
 const result=await compactInlineFontCss(html);
 const re=/<style id="utd-pretendard-fonts">\n([\s\S]*?)\n<\/style>/;
 const a=html.match(re)[1],b=result.html.match(re)[1];
 assert.equal(cssSignature(a),cssSignature(b));
 assert.equal(html.replace(re,''),result.html.replace(re,''));
 assert.equal([...b.matchAll(/@font-face\s*\{/g)].length,92);
 for(const k of ['raw','gzip','brotli'])assert.ok(result.metrics.after[k]<=result.metrics.before[k]);
 console.log('Font formatting test: '+JSON.stringify(result.metrics));
});
