import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retrySample,execute} from './lighthouse-comparison-retry.mjs';
import {validateReport,spread,metrics,blockedPatterns} from './lighthouse-comparison.mjs';
function report(){
 const r={runWarnings:[],configSettings:{blockedUrlPatterns:[...blockedPatterns]},categories:{performance:{score:0.6}},audits:{}};
 for(const [key,path] of Object.entries(metrics))if(key!=='score')r.audits[path[1]]={numericValue:100};
 r.audits['network-requests']={details:{items:[{url:'http://127.0.0.1/UTD/',statusCode:200}]}};
 return r;
}
test('rejects timeout, runtime errors, incomplete metrics and blocked leaks',()=>{
 const r=report();
 assert.equal(validateReport(r).score,60);
 for(const warning of ['The page loaded too slowly to finish within the time limit.','The page load timed out. Results may be incomplete.']){
  assert.throws(()=>validateReport({...r,runWarnings:[warning]}),/Incomplete/);
 }
 assert.throws(()=>validateReport({...r,runtimeError:{message:'NO_FCP'}}),/NO_FCP/);
 assert.equal(validateReport({...r,runWarnings:['Some third-party resources were blocked.']}).score,60);
 delete r.audits['largest-contentful-paint'];
 assert.throws(()=>validateReport(r),/lcp/);
});
test('retries invalid and failed attempts, accepts first valid sample even when slow',async()=>{
 const history=[];
 const r=await retrySample(async attempt=>{
  if(attempt===1)throw Error('process failed');
  const r=report();
  if(attempt===2)r.runWarnings=['Page load timed out'];
  else r.audits['largest-contentful-paint'].numericValue=50000;
  return {report:r};
 },{onAttempt:x=>history.push(x)});
 assert.equal(r.report.audits['largest-contentful-paint'].numericValue,50000);
 assert.deepEqual(history.map(x=>x.status),['rejected','rejected','accepted']);
});
test('exhausted attempts fail, no invalid sample is accepted',async()=>{
 const history=[];
 await assert.rejects(retrySample(async()=>{throw Error('timeout');},{maxAttempts:3,onAttempt:x=>history.push(x)}),/No valid/);
 assert.equal(history.length,3);
});
test('process runner handles exit and hard timeout',async()=>{
 await execute(process.execPath,['-e','process.exit(0)']);
 await assert.rejects(execute(process.execPath,['-e','process.exit(7)']),/exited 7/);
 await assert.rejects(execute(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:150}),/timeout/);
});
test('variability includes min max median population SD and zero handling',()=>{
 assert.deepEqual(spread([10,20,30]),{count:3,min:10,max:30,median:20,standardDeviation:Math.sqrt(200/3),rangePercent:100});
 assert.equal(spread([0,0,0]).rangePercent,0);
 assert.equal(spread([0,0,1]).rangePercent,null);
});
