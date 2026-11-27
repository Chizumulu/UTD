import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBaseline,baselineMarkdown,plan} from './lighthouse-comparison-baseline.mjs';
function fixture(){
 const comparison={base:plan.historical,head:plan.reference,runs:5,reliability:{},blocking:{},profiles:{},assets:{}};
 const diagnostics={base:plan.historical,head:plan.reference,runs:5,profiles:{},samples:{}},histories={};
 for(const profile of plan.profiles){
  comparison.reliability[profile]={};comparison.profiles[profile]={};diagnostics.profiles[profile]={};
  for(const side of ['before','after']){
   comparison.reliability[profile][side]={status:'within-heuristic',noisy:[],stats:{score:{count:5,median:60,min:58,max:62,rangePercent:6.67}}};
   diagnostics.profiles[profile][side]={};
   for(let i=1;i<=5;i++){
    const k=profile+'-'+side+'-'+i;comparison.blocking[k]={leaks:0};diagnostics.samples[k]={lighthouseVersion:plan.lighthouse};histories[k]=[{attempt:1,status:'accepted'}];
   }
  }
 }
 return {comparison,diagnostics,histories,environment:{chrome:'test'}};
}
test('fixed baseline records all twenty valid reports and provenance',()=>{
 const r=createBaseline(fixture());assert.equal(r.validReports,20);assert.equal(r.attempts,20);assert.equal(r.retries,0);assert.equal(r.status,'measured');assert.equal(r.reference,plan.reference);assert.match(baselineMarkdown(r),/Reference median/);
});
test('preserves rejected attempts and variability warnings',()=>{
 const f=fixture();f.histories['mobile-before-1']=[{attempt:1,status:'rejected'},{attempt:2,status:'accepted'}];f.comparison.reliability.mobile.before.status='high-variability';
 const r=createBaseline(f);assert.equal(r.attempts,21);assert.equal(r.retries,1);assert.equal(r.status,'measured-with-variability-warning');assert.match(r.warnings[0],/mobile historical/);
});
test('rejects wrong revision, incomplete samples, mismatched version and invalid attempt history',()=>{
 let f=fixture();f.comparison.head='wrong';assert.throws(()=>createBaseline(f),/revision/);
 f=fixture();delete f.histories['desktop-after-5'];assert.throws(()=>createBaseline(f),/attempt history/);
 f=fixture();f.comparison.reliability.mobile.after.stats.score.count=4;assert.throws(()=>createBaseline(f),/valid samples/);
 f=fixture();f.diagnostics.samples['mobile-before-1'].lighthouseVersion='13';assert.throws(()=>createBaseline(f),/version/);
 f=fixture();f.comparison.blocking['desktop-before-1'].leaks=1;assert.throws(()=>createBaseline(f),/blocking/);
});
