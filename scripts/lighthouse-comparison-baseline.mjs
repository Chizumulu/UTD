import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const plan=JSON.parse(readFileSync(new URL('./lighthouse-comparison-baseline.json',import.meta.url),'utf8'));
const read=(dir,name)=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createBaseline({comparison,diagnostics,histories,environment,plan:referencePlan=plan}){
 if(comparison.base!==referencePlan.historical||comparison.head!==referencePlan.reference||comparison.runs!==referencePlan.runs)throw Error('Baseline revision or run count mismatch');
 if(diagnostics.base!==comparison.base||diagnostics.head!==comparison.head||diagnostics.runs!==comparison.runs)throw Error('Diagnostic revision mismatch');
 const profiles={};
 let attempts=0,rejected=0;
 for(const profile of referencePlan.profiles){
  const sides={};
  for(const side of ['before','after']){
   const stats=comparison.reliability?.[profile]?.[side];
   if(!stats||Object.values(stats.stats).some(s=>s.count!==referencePlan.runs))throw Error('Missing valid samples: '+profile+' '+side);
   for(let index=1;index<=referencePlan.runs;index++){
    const key=profile+'-'+side+'-'+index;
    const history=histories[key],report=diagnostics.samples?.[key];
    if(!report||report.lighthouseVersion!==referencePlan.lighthouse)throw Error('Unexpected Lighthouse version: '+key);
    if(comparison.blocking?.[key]?.leaks!==0)throw Error('Missing blocking evidence: '+key);
    if(!Array.isArray(history)||history.length<1||history.length>3||history.some((h,i)=>h.attempt!==i+1||h.status!==(i===history.length-1?'accepted':'rejected')))throw Error('Invalid attempt history: '+key);
    attempts+=history.length;rejected+=history.length-1;
   }
   sides[side]={reliability:stats.status,noisy:stats.noisy,stats:stats.stats,diagnostics:diagnostics.profiles[profile][side]};
  }
  profiles[profile]={historical:sides.before,reference:sides.after,comparison:comparison.profiles[profile]};
 }
 const warnings=Object.entries(profiles).flatMap(([profile,sides])=>['historical','reference'].filter(side=>sides[side].reliability!=='within-heuristic').map(side=>profile+' '+side+': '+sides[side].reliability));
 return {schemaVersion:1,id:referencePlan.id,status:warnings.length?'measured-with-variability-warning':'measured',historical:comparison.base,reference:comparison.head,runsPerGroup:referencePlan.runs,validReports:referencePlan.runs*referencePlan.profiles.length*2,attempts,rejected,retries:rejected,environment,warnings,profiles,assets:comparison.assets};
}
export function baselineMarkdown(result){
 const fmt=v=>Number.isFinite(v)?Number(v.toFixed(2)):'—';
 const lines=['# 1-H-3-5 fixed performance reference','','Status: '+result.status,'Historical: '+result.historical,'Reference: '+result.reference,'Valid reports: '+result.validReports+'; attempts: '+result.attempts+'; retries: '+result.retries+'; rejected: '+result.rejected,'','Warnings: '+(result.warnings.join('; ')||'none'),''];
 for(const [profile,sides] of Object.entries(result.profiles)){
  lines.push('## '+profile,'','| Metric | Historical median | Reference median | Reference min | Reference max | Range % |','|---|---:|---:|---:|---:|---:|');
  for(const [key,s] of Object.entries(sides.reference.stats))lines.push('| '+key+' | '+fmt(sides.historical.stats[key].median)+' | '+fmt(s.median)+' | '+fmt(s.min)+' | '+fmt(s.max)+' | '+fmt(s.rangePercent)+' |');
  lines.push('');
 }
 lines.push('This is a fixed lab reference, not production field data. Variability warnings are retained, not filtered out. Future comparisons should use the reference SHA, not the historical SHA, and the same measurement protocol.');
 return lines.join('\n')+'\n';
}
export function saveBaseline(dir){
 const comparison=read(dir,'comparison.json'),diagnostics=read(dir,'diagnostics.json'),environment=read(dir,'environment.json'),histories={};
 for(const profile of plan.profiles)for(const side of ['before','after'])for(let i=1;i<=plan.runs;i++){
  const name=profile+'-'+side+'-'+i;histories[name]=read(dir,join('attempts',name,'history.json'));
 }
 const result=createBaseline({comparison,diagnostics,histories,environment});
 result.evidenceSha256=Object.fromEntries(['comparison.json','diagnostics.json','environment.json','compression-8081.json','compression-8082.json'].map(name=>[name,sha(readFileSync(join(dir,name)))]));
 writeFileSync(join(dir,'baseline.json'),JSON.stringify(result,null,2)+'\n');
 writeFileSync(join(dir,'baseline.md'),baselineMarkdown(result));
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)saveBaseline(process.argv[2]);
