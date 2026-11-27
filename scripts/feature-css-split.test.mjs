import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cssSignature} from './minify-pages-assets.mjs';
import {splitClubSponsorCss} from './club-css-split.mjs';
import {splitClubDetailCss} from './club-css-detail-split.mjs';
import {splitFeatureCss,reconstructFeatureCss} from './feature-css-split.mjs';
import {featureOwner,policies} from './feature-css-policy.mjs';

test('integrated CSS assets reconstruct previous base exactly and shrink all initial byte metrics',async()=>{
 const sponsor=await splitClubSponsorCss(readFileSync('style.css','utf8'));
 const detail=await splitClubDetailCss(sponsor.critical);
 const result=await splitFeatureCss(detail.critical);
 assert.deepEqual(Object.keys(result.assets),Object.keys(policies));
 assert.equal(cssSignature(reconstructFeatureCss(result.critical,result.assets)),cssSignature(detail.critical));
 for(const key of ['raw','gzip','brotli'])assert.ok(result.metrics.after[key]<result.metrics.before[key]);
 for(const [kind,a] of Object.entries(result.assets)){
  assert.ok(a.rules>0&&a.slots>0,kind);
  assert.match(a.url,new RegExp('^feature-'+kind+'\\.css\\?v=[a-f0-9]{16}$'));
 }
 console.log('Integrated CSS test metrics: '+JSON.stringify(result.metrics));
});
test('only leading exclusive feature selectors may be moved',()=>{
 for(const selector of ['.round-mode-chip','.round-match-card','.rmc-team','.report-empty','.predict-tab','.wi-run','.cup-toggle-mobile','.cup-match-prediction','.ti-card','.ti-record-card','.modal-content','.team-logo','.app-shell',':root','.shared .tc-card','.ti-sponsor-card','.ta-card','#otherTeamFullBody .ti-card'])assert.equal(featureOwner(selector),null,selector);
 for(const [s,k] of [['.tc-card','teamcompare'],[':root[data-theme="dark"] .tc-card','teamcompare'],['.spm-form-bars','players'],['.pp-card','matchdetail'],['.mc-ai-block','matchcompare'],['.cup-br-team','cup'],['.archive-hl-card','archive'],['.ti-room-item','club'],['.pf-plan-grid','pathfinder'],['#mainTable td','rank']])assert.equal(featureOwner(s),k,s);
});
