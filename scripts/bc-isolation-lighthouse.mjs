import {auditSample} from './lighthouse-comparison-retry.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [dir,profile,flagsPath]=process.argv.slice(2);
const groups=['A','B','C','D','E'];
if(!['mobile','desktop'].includes(profile))throw Error('Invalid profile');
mkdirSync(dir,{recursive:true});
const rows=[];
const keys=['largest-contentful-paint','first-contentful-paint','total-blocking-time','cumulative-layout-shift','bootup-time','mainthread-work-breakdown','total-byte-weight','speed-index'];
try {
 for(let index=1;index<=8;index++){
  const order=groups.map((_,i)=>groups[(i+index-1)%5]);
  if(index%2===0)order.reverse();
  for(const side of order){
   await auditSample({dir,profile,side,index,port:8081+groups.indexOf(side),flagsPath});
   const r=JSON.parse(readFileSync(join(dir,profile+'-'+side+'-'+index+'.json'),'utf8'));
   const metrics={score:r.categories.performance.score*100};
   for(const key of keys)metrics[key]=r.audits[key].numericValue;
   if(Object.values(metrics).some(v=>!Number.isFinite(v)))throw Error('Invalid metric');
   rows.push({profile,side,index,metrics});
  }
 }
}finally{
 const median=a=>{a.sort((x,y)=>x-y);return (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2};
 const summary=Object.fromEntries(groups.map(g=>{const a=rows.filter(r=>r.side===g);return [g,{n:a.length,median:a.length?Object.fromEntries(Object.keys(a[0].metrics).map(k=>[k,median(a.map(r=>r.metrics[k]))])):{}}]}));
 writeFileSync(join(dir,'summary.json'),JSON.stringify({rows,summary},null,2));
 console.log(JSON.stringify(summary));
}
if(rows.length!==40)throw Error('Expected 40 valid samples per profile');
