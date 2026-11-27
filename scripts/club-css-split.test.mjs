import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {splitClubSponsorCss} from './club-css-split.mjs';
const source=readFileSync('style.css','utf8');
test('real sponsor block is extracted without changing source; all compression metrics improve',async()=>{
 const r=await splitClubSponsorCss(source);
 assert.match(r.url,/^club-sponsors\.css\?v=[a-f0-9]{16}$/);
 assert.match(r.optional,/\.ti-sponsor-grid/);
 assert.match(r.optional,/@keyframes tiSponsorIn/);
 const retained=[...r.critical.matchAll(/\.ti-sponsor-[\w-]+/g)].map(m=>m[0]);
 assert.deepEqual(retained,['.ti-sponsor-card']);
 assert.match(r.critical,/\.ti-sponsor-card\s*\{[^}]*margin:0/);
 assert.doesNotMatch(r.optional,/\.ti-sponsor-card\s*\{[^}]*margin:0/);
 assert.doesNotMatch(r.critical,/@keyframes tiSponsorIn/);
 assert.match(r.critical,/\.ti-lightbox/);
 for(const key of ['raw','gzip','brotli'])assert.ok(r.metrics.after[key]<r.metrics.before[key],key);
 assert.equal(readFileSync('style.css','utf8'),source);
});
test('rejects mixed selectors and sponsor rules outside the block',async()=>{
 await assert.rejects(splitClubSponsorCss(source.replace('.ti-sponsor-grid {','.ti-sponsor-grid, .shared {')),/Non-sponsor selector/);
 await assert.rejects(splitClubSponsorCss(source+'\n.ti-sponsor-extra{color:red}'),/outside block/);
});
