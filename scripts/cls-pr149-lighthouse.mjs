import {auditSample} from './lighthouse-comparison-retry.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [dir,flagsPath]=process.argv.slice(2);
mkdirSync(dir,{recursive:true});
const rows=[];
try {
 for(const profile of ['mobile','desktop']) for(let index=1;index<=5;index++) for(const side of (index%2?['before','after']:['after','before'])){
  await auditSample({dir,flagsPath,profile,side,index,port:side==='before'?8081:8082});
  const r=JSON.parse(readFileSync(join(dir,profile+'-'+side+'-'+index+'.json'),'utf8'));
  const metrics={score:r.categories.performance.score*100};
  for(const key of ['cumulative-layout-shift','largest-contentful-paint','first-contentful-paint','total-blocking-time','speed-index','mainthread-work-breakdown','bootup-time','total-byte-weight'])metrics[key]=r.audits[key].numericValue;
  const diagnostics = Object.fromEntries(['largest-contentful-paint-element','lcp-breakdown-insight','lcp-discovery-insight','network-requests','critical-request-chains','render-blocking-insight','long-tasks','bootup-time','mainthread-work-breakdown'].filter(key=>r.audits[key]).map(key=>[key,r.audits[key].details ?? null]));
  writeFileSync(join(dir,profile+'-'+side+'-'+index+'-diagnostics.json'),JSON.stringify(diagnostics,null,2));
  rows.push({profile,side,index,metrics});
 }
} finally {
 const median=a=>{a.sort((x,y)=>x-y);return (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
 const groups={};
 for(const profile of ['mobile','desktop'])for(const side of ['before','after']){
  const a=rows.filter(r=>r.profile===profile&&r.side===side);
  groups[profile+'-'+side]={n:a.length,median:a.length?Object.fromEntries(Object.keys(a[0].metrics).map(k=>[k,median(a.map(r=>r.metrics[k]))])):{}};
 }
 writeFileSync(join(dir,'summary.json'),JSON.stringify({rows,groups},null,2));
 console.log(JSON.stringify(groups));
}
