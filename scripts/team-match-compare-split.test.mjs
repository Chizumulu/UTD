import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitTeamMatchCompare} from './team-match-compare-split.mjs';

test('comparison renderers split independently with shared helpers and routing retained',async()=>{
  const source=readFileSync('app.js','utf8');
  const {app,assets}=await splitTeamMatchCompare(source);
  assert.deepEqual(assets.map(a=>a.file),['team-compare.js','match-compare.js']);
  for(const a of assets){
    new Script(a.code);
    assert.ok(app.includes(a.file+'?v='+createHash('sha256').update(a.code).digest('hex').slice(0,16)));
  }
  new Script(app);
  for(const name of ['tcResultHtml','tcSnapshot','matchRelatedHtml','renderMatchCompareLoaded']) assert.ok(!app.includes('function '+name+'('),name);
  for(const name of ['renderTeamCompareView','openMatchCompareModal','closeMatchCompareModal','mcGetOwnBaseline','mcTitleImpactApplicable','aiPredictionBlockHtml','cupMatchPredictionHtml','mcStatRow','priorMeetingsSectionHtml']) assert.ok(app.includes('function '+name+'('),name);
  assert.match(app,/if \(token !== matchCompareLoadToken\) return/);
  assert.match(app,/\+\+matchCompareLoadToken;/);
  const before=await minifyJs(source),after=await minifyJs(app);
  const savings=gzipSync(before).length-gzipSync(after).length;
  assert.ok(savings>0);
  console.log('Team/match comparison initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional assets: '+assets.map(a=>a.file+' '+Buffer.byteLength(a.code)).join(', '));
  await assert.rejects(()=>splitTeamMatchCompare('bad'));
});
