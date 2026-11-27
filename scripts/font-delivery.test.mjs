import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {optimizeFontDelivery} from './font-delivery.mjs';

test('all licensed font faces, unicode ranges, weights and WOFF2 files survive deployment',()=>{
 const html=readFileSync('index.html','utf8');
 const css=readFileSync('fonts/pretendard/pretendardvariable-dynamic-subset.css','utf8');
 const output=optimizeFontDelivery(html,css);
 const inline=output.match(/<style id="utd-pretendard-fonts">\n([\s\S]*?)\n<\/style>/)?.[1];
 assert.ok(inline);
 assert.equal(inline.replaceAll('url(./fonts/pretendard/woff2-dynamic-subset/','url(./woff2-dynamic-subset/'),css);
 assert.equal([...inline.matchAll(/@font-face\s*\{/g)].length,92);
 for(const m of inline.matchAll(/url\(\.\/(fonts\/[^)]+)\)/g))assert.ok(existsSync(m[1]),m[1]);
 assert.equal(output.includes('href="./fonts/pretendard/pretendardvariable-dynamic-subset.css"'),false);
 assert.match(output,/<link href="https:\/\/fonts\.googleapis\.com\/[^"]+" rel="stylesheet" media="print" onload="this\.media='all'">/);
 assert.match(output,/<noscript><link href="https:\/\/fonts\.googleapis\.com\/[^"]+" rel="stylesheet"><\/noscript>/);
 const preloads=s=>[...s.matchAll(/<link rel="preload" as="font"[^>]+>/g)].map(m=>m[0]);
 assert.deepEqual(preloads(output),preloads(html));
 assert.equal(preloads(output).length,2);
});
