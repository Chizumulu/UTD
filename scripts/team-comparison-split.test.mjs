import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitTeamComparison} from './team-comparison-split.mjs';

test('team and match comparison renderers isolated while shared previews remain synchronous',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitTeamComparison(source);
 assert.equal(file,'team-comparison.js');
 for(const name of ['tcResultHtml','mcStatRow','priorMeetingsSectionHtml','matchRelatedHtml']){
  assert.ok(!app.includes('function '+name+'('),name);
  assert.ok(code.includes('function '+name+'('),name);
 }
 for(const name of ['getTeamCompareSnapshot','mcFormDotsHtml','mcAiProbBarHtml','cupMatchPredictionHtml','aiPredictionBlockHtml','mcTitleImpactApplicable','mcGetOwnBaseline','openMatchCompareModal','renderTeamCompareView','closeMatchCompareModal'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.ok(code.includes('renderMatchCompareModal'));
 assert.ok(code.includes('drawTeamCompareView'));
 assert.ok(app.includes('request === matchComparisonRequest'));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Team comparison initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitTeamComparison('bad'));
});
