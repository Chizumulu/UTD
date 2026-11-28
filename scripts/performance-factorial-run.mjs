import {auditSample} from './lighthouse-comparison-retry.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const [dir,flagsPath]=process.argv.slice(2);
mkdirSync(dir,{recursive:true});
const arms=['control','font','cpu','both'];
const ports={control:8081,font:8082,cpu:8083,both:8084};
// Balanced Williams sequences: each arm occupies each position equally;
// each ordered adjacent pair appears equally often per four blocks.
const order=[[0,1,3,2],[1,2,0,3],[2,3,1,0],[3,0,2,1]];
const counts={mobile:12,desktop:4};
const schedule=[];
for(const profile of Object.keys(counts))for(let i=1;i<=counts[profile];i++){
 for(const index of order[(i-1)%4]){
  const side=arms[index];schedule.push({profile,side,index:i,port:ports[side]});
 }
}
writeFileSync(join(dir,'schedule.json'),JSON.stringify(schedule,null,2));
for(const item of schedule)await auditSample({dir,flagsPath,...item});
const rows=[];
for(const item of schedule){
 const r=JSON.parse(readFileSync(join(dir,item.profile+'-'+item.side+'-'+item.index+'.json'),'utf8'));
 const a=r.audits;
 const metrics={score:r.categories.performance.score*100,cls:a['cumulative-layout-shift'].numericValue,lcp:a['largest-contentful-paint'].numericValue,fcp:a['first-contentful-paint'].numericValue,tbt:a['total-blocking-time'].numericValue,mainThread:a['mainthread-work-breakdown'].numericValue,jsExecution:a['bootup-time'].numericValue,transfer:a['total-byte-weight'].numericValue};
 for(const v of Object.values(metrics))assert.ok(Number.isFinite(v));
 const shifts=(a['layout-shifts']?.details?.items||[]).map(x=>({selector:x.node?.selector,score:x.score}));
 rows.push({...item,metrics,shifts});
}
const median=xs=>{const a=[...xs].sort((a,b)=>a-b);return(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
const fmt=x=>Number(x.toFixed(5));
const summaries={};
for(const profile of Object.keys(counts)){
 const byArm=Object.fromEntries(arms.map(arm=>[arm,rows.filter(r=>r.profile===profile&&r.side===arm)]));
 const metrics=Object.keys(byArm.control[0].metrics);
 summaries[profile]={arms:Object.fromEntries(arms.map(arm=>{
  const a=byArm[arm];assert.equal(a.length,counts[profile]);
  return [arm,{n:a.length,median:Object.fromEntries(metrics.map(k=>[k,fmt(median(a.map(r=>r.metrics[k])))])),min:Object.fromEntries(metrics.map(k=>[k,fmt(Math.min(...a.map(r=>r.metrics[k])))])),max:Object.fromEntries(metrics.map(k=>[k,fmt(Math.max(...a.map(r=>r.metrics[k])))])),highCls:a.filter(r=>r.metrics.cls>0.1).length,mainContentShifts:a.filter(r=>r.shifts.some(s=>s.selector?.endsWith('div#mainContent'))).length}];
 })),effects:{}};
 for(const k of metrics){
  const d=Array.from({length:counts[profile]},(_,i)=>{
   const value=arm=>byArm[arm][i].metrics[k];const a=value('control'),b=value('font'),c=value('cpu'),e=value('both');
   return {fontOnly:b-a,cpuOnly:c-a,both:e-a,fontMain:((b-a)+(e-c))/2,cpuMain:((c-a)+(e-b))/2,interaction:e-b-c+a};
  });
  summaries[profile].effects[k]=Object.fromEntries(Object.keys(d[0]).map(key=>[key,fmt(median(d.map(x=>x[key])))]));
 }
}
writeFileSync(join(dir,'factorial-summary.json'),JSON.stringify({samples:rows.length,rows,summaries},null,2));
console.log('Factorial summary: '+JSON.stringify({samples:rows.length,summaries}));
