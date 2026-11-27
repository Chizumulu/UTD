import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitSeasonCompare} from './season-compare-split.mjs';

test('comparison-only renderers are isolated, shared calculations and data loader retained',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitSeasonCompare(source);
 assert.equal(file,'season-compare.js');
 for(const name of ['renderSeasonCompareCard','renderPrevCompareBoards','renderLuckChangeCard','togglePrevCompareExpand']){
  assert.ok(!app.includes('function '+name+'('),name);
  assert.ok(code.includes('function '+name+'('),name);
 }
 for(const name of ['loadArchiveData','collectTeamStats','prevSeasonFinalRow','renderScatterPlots','buildStatRowsHtml'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.match(app,/if \(archiveMode \|\| currentView !== 'stats' \|\| statsTab !== 'compare'\) return/);
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Season comparison initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitSeasonCompare('bad'));
});
