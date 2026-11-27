import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitStandingsExport} from './standings-export-split.mjs';

test('standings export is isolated and versioned while shared poster loader stays in app',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitStandingsExport(source);
 assert.equal(file,'standings-export.js');
 assert.match(app,/function loadImageForExport\(/);
 assert.match(app,/async function downloadMatchPoster\(/);
 assert.doesNotMatch(app,/function drawExportBadge\(/);
 assert.match(code,/function drawExportBadge\(/);
 assert.match(code,/window\.__utdStandingsExport=runStandingsImageExport/);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Standings export initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitStandingsExport('bad'));
});
