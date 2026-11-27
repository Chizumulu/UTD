import {test} from 'node:test';
import assert from 'node:assert/strict';
import {KEY,monitorCron,assess,healthResponse} from './health.mjs';
function fake(){let value=null;return {get:async()=>value,put:async(k,v)=>{assert.equal(k,KEY);value=JSON.parse(v);}};}
test('tracks thrown and reported errors, disabled tasks, recovery',async()=>{
 const env={APPROVALS:fake()};let fail=true;
 const tasks=[{name:'league',enabled:true,run:async()=>{if(fail)throw Error('secret');}},{name:'cup',enabled:true,run:async()=>({ok:!fail})},{name:'instagram',enabled:false,run:()=>{throw Error('never');}}];
 for(let i=1;i<=3;i++){
  const r=await monitorCron(env,tasks,{now:()=>1000*i});
  assert.equal(r.checks[0].consecutiveFailures,i);
  assert.equal(r.checks[1].consecutiveFailures,i);
  assert.equal(r.checks[2].status,'disabled');
  assert.equal(assess(r,1000*i).ok,i<3);
  assert.ok(!JSON.stringify(r).includes('secret'));
 }
 fail=false;
 const r=await monitorCron(env,tasks,{now:()=>4000});
 assert.equal(assess(r,4000).ok,true);
 assert.equal(r.checks[0].consecutiveFailures,0);
 assert.equal(assess(r,4000+41*60000).status,'stale');
});
test('public endpoint disabled, uninitialized and healthy',async()=>{
 const env={APPROVALS:fake()};
 assert.equal((await healthResponse(env)).status,503);
 env.HEALTH_MONITOR_ENABLED='true';
 assert.equal((await healthResponse(env)).status,503);
 await monitorCron(env,[{name:'league',enabled:true,run:async()=>{}}]);
 assert.equal((await healthResponse(env)).status,200);
});
