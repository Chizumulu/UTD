import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {optimizeExternalScripts} from './external-script-delivery.mjs';

const source=readFileSync('index.html','utf8');
const optimized=optimizeExternalScripts(source);
const loader=[...optimized.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var started=false, timer;'));
test('only Clarity and Anime script delivery change',()=>{
 assert.ok(loader);
 assert.match(optimized,/<script async src="https:\/\/cdn\.jsdelivr\.net\/npm\/animejs@4\/lib\/anime\.iife\.min\.js"><\/script>/);
 const original=source.match(/<script type="text\/javascript">\s*\(function\(c,l,a,r,i,t,y\)\{[\s\S]*?\}\)\(window, document, "clarity", "script", "([^"]+)"\);\s*<\/script>/);
 assert.ok(original);
 assert.ok(loader.includes(JSON.stringify(original[1])));
 assert.equal(optimized.replace('<script>'+loader+'</script>',original[0]).replace('<script async src="https://cdn.jsdelivr.net/npm/animejs@4/lib/anime.iife.min.js">','<script src="https://cdn.jsdelivr.net/npm/animejs@4/lib/anime.iife.min.js">'),source);
});
function fixture({idle=true,complete=false}={}){
 const scripts=[],timers=new Map(),docEvents=new Map(),winEvents=new Map(),idleTasks=[];
 let seq=0;
 const w={addEventListener:(name,fn)=>winEvents.set(name,fn)};
 if(idle)w.requestIdleCallback=(fn,opts)=>idleTasks.push({fn,opts});
 const d={readyState:complete?'complete':'loading',head:{appendChild:s=>scripts.push(s)},createElement:tag=>({tag}),addEventListener:(name,fn)=>docEvents.set(name,fn),removeEventListener:name=>docEvents.delete(name)};
 vm.runInNewContext(loader,{window:w,document:d,setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id)});
 return {w,d,scripts,timers,docEvents,winEvents,idleTasks};
}
test('Clarity preserves queued commands and starts once on first interaction',()=>{
 const f=fixture();
 f.w.clarity('event','early-event');
 assert.equal(f.w.clarity.q.length,1);
 assert.equal(f.scripts.length,0);
 const pointer=f.docEvents.get('pointerdown'),keyboard=f.docEvents.get('keydown'),timeout=[...f.timers.values()][0];
 pointer();
 keyboard();timeout.fn();f.winEvents.get('load')();f.idleTasks[0].fn();
 assert.equal(f.scripts.length,1);
 assert.equal(f.scripts[0].async,true);
 assert.match(f.scripts[0].src,/^https:\/\/www\.clarity\.ms\/tag\/[^/]+$/);
 assert.equal(f.w.clarity.q[0][1],'early-event');
 assert.equal(f.docEvents.size,0);
 assert.equal(f.timers.size,0);
});
test('Clarity starts after load and idle, with a five-second fallback',()=>{
 const f=fixture();
 assert.equal(f.scripts.length,0);
 assert.equal([...f.timers.values()][0].ms,5000);
 f.winEvents.get('load')();
 assert.equal(f.scripts.length,0);
 assert.equal(f.idleTasks[0].opts.timeout,2000);
 f.idleTasks[0].fn();
 assert.equal(f.scripts.length,1);
 const stalled=fixture();
 [...stalled.timers.values()][0].fn();
 assert.equal(stalled.scripts.length,1);
 const noIdle=fixture({idle:false});
 noIdle.winEvents.get('load')();
 const next=[...noIdle.timers.values()].find(t=>t.ms===0);
 assert.ok(next);next.fn();
 assert.equal(noIdle.scripts.length,1);
});
