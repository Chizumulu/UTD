import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePrPlan} from './lighthouse-comparison-pr-plan.mjs';
const baseline='a'.repeat(40),candidate='b'.repeat(40),head='c'.repeat(40);
const plan={schemaVersion:1,branch:'perf/example',baseline,candidate,runs:5};
test('pinned deployed revision and five paired samples',()=>{
 assert.deepEqual(resolvePrPlan(plan,plan.branch,head),{BASE_INPUT:baseline,HEAD_INPUT:candidate,RUNS:'5'});
});
test('candidate can explicitly be the current PR head',()=>{
 assert.equal(resolvePrPlan({...plan,candidate:'head'},plan.branch,head).HEAD_INPUT,head);
});
test('unrelated branches keep historical benchmark defaults',()=>{
 assert.equal(resolvePrPlan(plan,'other',head),null);
 assert.equal(resolvePrPlan(null,'other',head),null);
});
test('reject invalid refs, counts, schema and same revision',()=>{
 for(const bad of [{baseline:'main'},{candidate:'main'},{runs:2},{schemaVersion:2},{candidate:baseline},{candidate:'head'}]){
  assert.throws(()=>resolvePrPlan({...plan,...bad},plan.branch,baseline));
 }
});
