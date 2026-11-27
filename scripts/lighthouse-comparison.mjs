import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

export const blockedPatterns=JSON.parse(readFileSync(new URL('./lighthouse-comparison-flags.json',import.meta.url),'utf8'))['blocked-url-patterns'];
const blockedDomains=['google-analytics.com','googletagmanager.com','clarity.ms','onesignal.com'];
export function verifyBlocking(report){
 const actual=report.configSettings?.blockedUrlPatterns;
 if(!Array.isArray(actual)||blockedPatterns.some(pattern=>!actual.includes(pattern)))throw Error('Lighthouse blocked URL configuration missing or incorrect');
 const requests=report.audits?.['network-requests']?.details?.items;
 if(!Array.isArray(requests))throw Error('Missing network requests');
 const matches=requests.filter(item=>{
  let host;
  try{host=new URL(item.url).hostname.toLowerCase();}catch{return false;}
  return blockedDomains.some(domain=>host===domain||host.endsWith('.'+domain));
 });
 // Blocked attempts may remain in the audit; zero bytes and no HTTP response are not leaks.
 const leaks=matches.filter(item=>(item.transferSize??0)>0||(item.resourceSize??0)>0||(Number(item.statusCode)>=100));
 if(leaks.length)throw Error('Blocked service received a response or bytes: '+leaks.map(item=>new URL(item.url).hostname).join(', '));
 return {patterns:[...blockedPatterns],blockedAttempts:matches.length,leaks:0};
}
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
export function validateReport(report){
 if(!report||typeof report!=='object')throw Error('Missing Lighthouse report');
 if(report.runtimeError)throw Error(report.runtimeError.message||'Lighthouse runtime error');
 const warnings=report.runWarnings??[];
 if(!Array.isArray(warnings))throw Error('Invalid Lighthouse warnings');
 const incomplete=warnings.filter(w=>/timed?\s*out|time\s*limit|timeout|incomplete|unable to reliably|did not finish|did not complete/i.test(String(w)));
 if(incomplete.length)throw Error('Incomplete Lighthouse report: '+incomplete.join('; '));
 const result=extract(report);
 verifyBlocking(report);
 return result;
}
export function spread(values){
 const center=median(values),min=Math.min(...values),max=Math.max(...values);
 const mean=values.reduce((a,b)=>a+b,0)/values.length;
 const standardDeviation=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);
 return {count:values.length,min,max,median:center,standardDeviation,rangePercent:center===0?(max===min?0:null):(max-min)/center*100};
}
export function extract(report){
 if(report.runtimeError)throw Error(report.runtimeError.message||'Lighthouse runtime error');
 const result={};
 for(const [name,path] of Object.entries(metrics)){
  const v=path.reduce((x,k)=>x?.[k],report);
  if(!Number.isFinite(v)||v<0||(name==='score'&&v>1))throw Error('Missing or invalid Lighthouse metric: '+name);
  result[name]=name==='score'?v*100:v;
 }
 const requests=report.audits?.['network-requests']?.details?.items;
 if(!Array.isArray(requests)||requests.length===0)throw Error('Missing network requests');
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
 if(result.reliability){
  lines.push('## Measurement reliability','','Range / median > 30% for FCP, LCP, main thread or JS execution flags high variability (heuristic, not a confidence interval). Valid slow samples are retained.','');
  for(const [profile,sides] of Object.entries(result.reliability))for(const [side,r] of Object.entries(sides)){
   lines.push('### '+profile+' '+side+': '+r.status,'','| Metric | Count | Min | Median | Max | SD | Range % |','|---|---:|---:|---:|---:|---:|---:|');
   for(const [k,v] of Object.entries(r.stats))lines.push('| '+k+' | '+v.count+' | '+fmt(v.min)+' | '+fmt(v.median)+' | '+fmt(v.max)+' | '+fmt(v.standardDeviation)+' | '+fmt(v.rangePercent)+' |');
   lines.push('', 'Flagged metrics: '+(r.noisy.join(', ')||'none'),'');
  }
 }
 if(result.blocking)lines.push('## External request blocking','','Verified '+Object.keys(result.blocking).length+' reports; no successful responses or bytes from configured blocked domains. Other external resources remain enabled.','');
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
 const profiles={},blocking={},reliability={};
 for(const profile of ['mobile','desktop']){
  const read=side=>Array.from({length:runs},(_,i)=>{const name=profile+'-'+side+'-'+(i+1);const report=JSON.parse(readFileSync(join(dir,name+'.json'),'utf8'));const values=validateReport(report);blocking[name]=verifyBlocking(report);return values;});
  const before=read('before'),after=read('after');
  profiles[profile]=compare(before,after);
  reliability[profile]={};
  for(const [side,samples] of [['before',before],['after',after]]){
   const stats=Object.fromEntries(Object.keys(samples[0]).map(k=>[k,spread(samples.map(x=>x[k]))]));
   const noisy=['fcp','lcp','mainThread','jsExecution'].filter(k=>stats[k].rangePercent===null||stats[k].rangePercent>30);
   reliability[profile][side]={stats,noisy,status:runs<3?'insufficient-for-repeatability':noisy.length?'high-variability':'within-heuristic'};
  }
 }
 const result={base,head,runs,profiles,blocking,reliability,assets:{before:sizes(beforeDir),after:sizes(afterDir)}};
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
