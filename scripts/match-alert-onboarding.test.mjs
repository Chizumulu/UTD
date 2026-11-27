import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('match-alert-onboarding.js','utf8');
function fixture({standalone=false,registered=false,permission='default',never=false,snooze=0,ready='loading'}={}){
 const timers=[],notices=[],events={},mediaEvents={},storage=new Map(),warnings=[];
 if(never)storage.set('utd-match-alerts-prompt-never','1');
 if(snooze)storage.set('utd-match-alerts-prompt-snoozed-until',String(snooze));
 let checks=0,queries=0;
 const media={matches:standalone,addEventListener:(n,fn)=>mediaEvents[n]=fn};
 const navigator={serviceWorker:{}};
 const Notification={permission};
 const window={navigator,Notification,PushManager:function(){},UTD_PUSH_API_URL:'mock',
  matchMedia:()=>{queries++;return media},setTimeout:(fn,ms)=>timers.push({fn,ms}),
  hasRegisteredMatchAlerts:async()=>{checks++;return registered},
  enqueueUtdAutomaticNotice:(...args)=>notices.push(args)};
 const document={readyState:ready,addEventListener:(n,fn)=>events[n]=fn};
 vm.runInNewContext(source,{window,document,navigator,Notification,localStorage:{getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)},console:{warn:(...args)=>warnings.push(args)}});
 return {timers,notices,media,mediaEvents,events,storage,warnings,checks:()=>checks,queries:()=>queries};
}
test('normal browser does not schedule onboarding or query subscription',()=>{
 const f=fixture();
 f.events.DOMContentLoaded();
 assert.equal(f.timers.length,0);
 assert.equal(f.checks(),0);
 assert.equal(f.queries(),1);
});
test('standalone startup and mode change preserve queue priority and run once',async()=>{
 for(const initial of [false,true]){
  const f=fixture({standalone:initial});
  f.events.DOMContentLoaded();
  f.media.matches=true;f.mediaEvents.change();f.mediaEvents.change();
  assert.equal(f.timers.length,1);assert.equal(f.timers[0].ms,1800);
  await f.timers[0].fn();f.mediaEvents.change();
  assert.equal(f.checks(),1);assert.equal(f.queries(),1);
  assert.equal(f.notices.length,1);
  assert.deepEqual(f.notices[0].slice(0,3),['match-alerts',50,0]);
  assert.equal(typeof f.notices[0][3],'function');
  assert.equal(f.warnings.length,0);
 }
});
test('permission, existing subscription and dismiss preferences suppress the prompt',async()=>{
 for(const opts of [{permission:'denied'},{registered:true},{never:true},{snooze:Date.now()+60000}]){
  const f=fixture({standalone:true,ready:'complete',...opts});
  if(f.timers.length)await f.timers[0].fn();
  assert.equal(f.notices.length,0);
  assert.equal(f.checks(),opts.registered?1:0);
 }
});
test('leaving standalone before timer fires allows a later eligible transition',async()=>{
 const f=fixture({standalone:true,ready:'complete'});
 f.media.matches=false;await f.timers[0].fn();assert.equal(f.checks(),0);
 f.media.matches=true;f.mediaEvents.change();
 assert.equal(f.timers.length,2);
 await f.timers[1].fn();assert.equal(f.notices.length,1);
});
