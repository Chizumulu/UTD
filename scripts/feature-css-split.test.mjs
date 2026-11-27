import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cssSignature} from './minify-pages-assets.mjs';
import {splitClubSponsorCss} from './club-css-split.mjs';
import {splitClubDetailCss} from './club-css-detail-split.mjs';
import {splitFeatureCss,reconstructFeatureCss} from './feature-css-split.mjs';
import {featureOwner,policies} from './feature-css-policy.mjs';
import postcss from 'postcss';
import {parseDeferredCssGroups} from './club-css-raw-groups.mjs';

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

test('raw loader preserves every emitted top-level rule for all 18 slot-based assets',async()=>{
 const sponsor=await splitClubSponsorCss(readFileSync('style.css','utf8'));
 const detail=await splitClubDetailCss(sponsor.critical);
 const result=await splitFeatureCss(detail.critical);
 for(const [kind,asset] of Object.entries({...detail.assets,...result.assets})){
  const actual=parseDeferredCssGroups(asset.css,kind);
  const expected=[];
  for(const node of postcss.parse(asset.css).nodes){
   if(node.type==='rule'&&node.selector.startsWith('#utd-club-css-slot-')){
    expected.push({id:node.selector,rules:[]});
   }else expected.at(-1).rules.push(node.toString());
  }
  assert.deepEqual(actual.map(g=>g.id),expected.map(g=>g.id),kind);
  assert.equal(actual.length,asset.slots,kind);
  assert.equal(actual.flatMap(g=>g.rules).length,asset.rules,kind);
  for(let i=0;i<expected.length;i++){
   assert.deepEqual(actual[i].rules.map(cssSignature),expected[i].rules.map(cssSignature),kind+' slot '+i);
  }
 }
});
test('raw scanner retains shorthand, nested media, strings, comments and escaped delimiters',()=>{
 const marker='#utd-club-css-slot-club-0{--utd-club-slot:0}';
 const shorthand='.squad-former-panel{border:1px solid var(--color-border-light);border-top:none}';
 const nested='@media (min-width: 700px){.squad-former-panel[data-x="}"]{content:"{;";background:url("data:image/svg+xml,<svg>{}</svg>");/* } */border:var(--edge)}}';
 const escaped=".x\\{y{color:red}";
 const raw=marker+shorthand+nested+escaped;
 assert.deepEqual(parseDeferredCssGroups(raw,'club'),[{id:'#utd-club-css-slot-club-0',rules:[shorthand,nested,escaped]}]);
 for(const bad of [marker,shorthand+marker,marker+shorthand.slice(0,-1),marker+shorthand+'@import "other.css";',marker+shorthand+marker+shorthand]){
  assert.throws(()=>parseDeferredCssGroups(bad,'club'));
 }
});
