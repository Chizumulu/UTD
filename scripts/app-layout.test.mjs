import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {optimizeAppLayout} from './app-layout.mjs';
const app=optimizeAppLayout(readFileSync('app.js','utf8'));
test('scroll fade batches geometry reads before writes and deduplicates frames',()=>{
 const start=app.indexOf('  const scrollFadeUpdaters = [];');
 const end=app.indexOf('  // ===== Spotlight',start);
 assert.ok(start>=0&&end>start);
 const events=[],frames=[],timers=[],listeners={};
 function scroller(id,width,client,left){
  const o={addEventListener:(n,fn)=>listeners[id+n]=fn};
  for(const [key,value] of Object.entries({scrollWidth:width,clientWidth:client,scrollLeft:left}))Object.defineProperty(o,key,{get(){events.push('read:'+id);return value}});
  return o;
 }
 function wrap(id){
  const set=new Set();
  return {classList:{contains:k=>set.has(k),toggle(k,v){events.push('write:'+id);if(v)set.add(k);else set.delete(k)}},set};
 }
 const a=scroller('a',200,100,0),b=scroller('b',200,100,100),wa=wrap('a'),wb=wrap('b');
 const nodes={a,b,wa,wb};
 const context={document:{getElementById:id=>nodes[id]},window:{addEventListener(){}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},setTimeout:fn=>timers.push(fn)};
 vm.createContext(context);
 vm.runInContext(app.slice(start,end)+"\nregisterScrollFadeHint('a','wa');registerScrollFadeHint('b','wb');refreshScrollFadeHints();",context);
 assert.equal(frames.length,1);
 assert.equal(events.length,0);
 frames.shift()();
 assert.deepEqual([...wa.set],['show-right']);
 assert.deepEqual([...wb.set],['show-left']);
 assert.ok(events.lastIndexOf('read:b')<events.indexOf('write:a'));
 events.length=0;
 listeners.ascroll();listeners.bscroll();timers.forEach(fn=>fn());
 assert.equal(frames.length,1);
 frames.shift()();
 assert.ok(events.every(e=>e.startsWith('read:')));
});
test('title widths are reused and indicator geometry is measured before style writes',()=>{
 const title=app.slice(app.indexOf('  function equalizeTitleLines()'),app.indexOf('  // ===== 언어 전환',app.indexOf('  function equalizeTitleLines()')));
 assert.equal((title.match(/getBoundingClientRect\(\)/g)||[]).length,2);
 const indicator=app.slice(app.indexOf('  function updateSegIndicator('),app.indexOf('  function setActiveTeamInfoButton('));
 assert.match(indicator,/const top = activeBtn.offsetTop, height = activeBtn.offsetHeight;\s+indicator.style.transform/);
 assert.match(indicator,/const left = b.offsetLeft, top = b.offsetTop, height = b.offsetHeight;\s+indicator.style.transform/);
});
