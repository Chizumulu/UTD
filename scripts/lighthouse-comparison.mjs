import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

export const metrics = {
 score:['categories','performance','score'],
 fcp:['audits','first-contentful-paint','numericValue'],
 lcp:['audits','largest-contentful-paint','numericValue'],
 tbt:['audits','total-blocking-time','numericValue'],
 cls:['audits','cumulative-layout-shift','numericValue'],
 speedIndex:['audits','speed-index','numericValue'],
 jsExecution:['audits','bootup-time','numericValue'],
 mainThread:['audits','mainthread-work-breakdown','numericValue'],
 transfer:['audits','total-byte-weight','numericValue']
};
export function median(values){
 if(!values.length||values.some(x=>!Number.isFinite(x)))throw Error('Missing or invalid metric');
 const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;
}
export function extract(report){
 if(report.runtimeError)throw Error(report.runtimeError.message||'Lighthouse runtime error');
 const result={};
 for(const [name,path] of Object.entries(metrics)){
  const v=path.reduce((x,k)=>x?.[k],report);
  if(!Number.isFinite(v))throw Error('Missing Lighthouse metric: '+name);
  result[name]=name==='score'?v*100:v;
 }
 const requests=report.audits?.['network-requests']?.details?.items;
 if(!Array.isArray(requests))throw Error('Missing network requests');
 result.requests=requests.length;
 return result;
}
export function compare(before,after){
 if(before.length!==after.length||before.length<1)throw Error('Unbalanced benchmark samples');
 return Object.fromEntries(Object.keys(before[0]).map(key=>{
  const a=median(before.map(x=>x[key])),b=median(after.map(x=>x[key]));
  return [key,{before:a,after:b,delta:b-a,percent:a===0?null:(b-a)/a*100,beforeSamples:before.map(x=>x[key]),afterSamples:after.map(x=>x[key])}];
 }));
}
export function sizes(dir){
 const out={};
 for(const name of readdirSync(dir).filter(x=>/\.(js|css)$/.test(x)).sort()){
  const bytes=readFileSync(join(dir,name));
  out[name]={raw:bytes.length,gzip:gzipSync(bytes).length,brotli:brotliCompressSync(bytes).length};
 }
 return out;
}
export function markdown(result){
 const fmt=x=>x===null?'—':Number(x.toFixed(2)).toString();
 const lines=['# UTD Lighthouse comparison','','Baseline: `'+result.base+'`','Candidate: `'+result.head+'`','', 'Cold browser profiles; local static Pages builds; alternating run order. Lighthouse simulated throttling. Score is 0–100; times are ms; transfer is bytes. Positive delta = increase.',''];
 for(const [profile,rows] of Object.entries(result.profiles)){
  lines.push('## '+profile,'','| Metric | Baseline median | Candidate median | Delta | Delta % |','|---|---:|---:|---:|---:|');
  for(const [key,r] of Object.entries(rows))lines.push('| '+key+' | '+fmt(r.before)+' | '+fmt(r.after)+' | '+fmt(r.delta)+' | '+fmt(r.percent)+' |');
  lines.push('');
 }
 lines.push('## Build asset sizes (bytes)','','| Asset | Encoding | Baseline | Candidate | Delta |','|---|---|---:|---:|---:|');
 for(const name of [...new Set([...Object.keys(result.assets.before),...Object.keys(result.assets.after)])].sort()){
  for(const kind of ['raw','gzip','brotli']){
   const a=result.assets.before[name]?.[kind]??0,b=result.assets.after[name]?.[kind]??0;
   lines.push('| '+name+' | '+kind+' | '+a+' | '+b+' | '+(b-a)+' |');
  }
 }
 lines.push('', 'Asset inventory is not initial transfer size. Missing asset = zero in that build. INP and field Core Web Vitals are not measured.');
 return lines.join('\n')+'\n';
}
export function summarize({dir,base,head,beforeDir,afterDir,runs}){
 const profiles={};
 for(const profile of ['mobile','desktop']){
  const read=side=>Array.from({length:runs},(_,i)=>extract(JSON.parse(readFileSync(join(dir,profile+'-'+side+'-'+(i+1)+'.json'),'utf8'))));
  profiles[profile]=compare(read('before'),read('after'));
 }
 const result={base,head,runs,profiles,assets:{before:sizes(beforeDir),after:sizes(afterDir)}};
 mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'comparison.json'),JSON.stringify(result,null,2)+'\n');
 writeFileSync(join(dir,'comparison.md'),markdown(result));
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [dir,base,head,beforeDir,afterDir,count]=process.argv.slice(2);
 const runs=Number(count);
 if(!dir||!base||!head||!beforeDir||!afterDir||!Number.isInteger(runs)||runs<1)throw Error('Usage: lighthouse-comparison.mjs results base head beforeDir afterDir runs');
 summarize({dir,base,head,beforeDir,afterDir,runs});
}
