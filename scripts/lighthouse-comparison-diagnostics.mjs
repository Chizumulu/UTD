// Lighthouse 12 diagnostics. Optional audits are never substituted with zero.
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=v=>typeof v==='string'?v:null;
const sum=(values)=>values.length&&values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;
const list=(report,id)=>{
 const audit=report.audits?.[id];
 return audit&&audit.scoreDisplayMode!=='error'&&audit.scoreDisplayMode!=='notApplicable'&&Array.isArray(audit.details?.items)?audit.details.items:null;
};
const value=(report,id,key)=>num(report.audits?.[id]?.details?.[key]);
const canonical=url=>{
 if(typeof url!=='string')return null;
 try{const u=new URL(url);if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return u.pathname;return u.protocol==='data:'?'data:':u.origin+u.pathname;}catch{return url;}
};
const nodeInfo=node=>node&&typeof node==='object'?{selector:str(node.selector),snippet:str(node.snippet),nodeLabel:str(node.nodeLabel),path:str(node.path)}:null;
const walk=(v,fn)=>{if(!v||typeof v!=='object')return;fn(v);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,fn);};
function nodes(items){
 if(items===null)return null;
 const result=[];
 walk(items,x=>{if(x.type==='node'||x.selector&&x.snippet){const n=nodeInfo(x);if(n&&!result.some(y=>JSON.stringify(y)===JSON.stringify(n)))result.push(n);}});
 return result;
}
function resourceRows(report,id){
 const items=list(report,id);
 return items===null?null:items.map(x=>({url:canonical(x.url),totalBytes:num(x.totalBytes),wastedBytes:num(x.wastedBytes),wastedMs:num(x.wastedMs),wastedPercent:num(x.wastedPercent)}));
}
export function diagnose(report){
 const cpu=list(report,'mainthread-work-breakdown')?.map(x=>({group:str(x.group??x.groupLabel),durationMs:num(x.duration)}))??null;
 const js=list(report,'bootup-time')?.map(x=>({url:canonical(x.url),totalMs:num(x.total),scriptingMs:num(x.scripting),scriptParseCompileMs:num(x.scriptParseCompile)}))??null;
 const css=resourceRows(report,'unused-css-rules');
 const cssTotal=css===null?null:css.length?sum(css.map(x=>x.totalBytes)):null;
 const cssWaste=value(report,'unused-css-rules','overallSavingsBytes')??(css===null?null:css.length?sum(css.map(x=>x.wastedBytes)):0);
 const lcpLegacy=list(report,'largest-contentful-paint-element');
 const lcpInsight=list(report,'lcp-breakdown-insight');
 const phases=[];
 walk(lcpLegacy??[],x=>{if(typeof x.phase==='string')phases.push({phase:x.phase,durationMs:num(x.timing),percent:str(x.percent)});});
 walk(lcpInsight??[],x=>{if(typeof x.phase==='string')phases.push({phase:x.phase,durationMs:num(x.duration??x.timing),percent:str(x.percent)});});
 const network=list(report,'network-requests');
 const groups=new Map();
 for(const x of network??[]){
  const type=str(x.resourceType)??'Unknown';
  const g=groups.get(type)??{type,requests:0,transferSizes:[],resourceSizes:[]};
  g.requests++;g.transferSizes.push(num(x.transferSize));g.resourceSizes.push(num(x.resourceSize));groups.set(type,g);
 }
 const networkByType=network===null?null:[...groups.values()].map(g=>({type:g.type,requests:g.requests,transferBytes:sum(g.transferSizes),resourceBytes:sum(g.resourceSizes)}));
 const render=resourceRows(report,'render-blocking-resources');
 const images={};
 for(const id of ['uses-optimized-images','modern-image-formats','uses-responsive-images','offscreen-images','image-delivery-insight']){
  const rows=resourceRows(report,id);if(rows!==null)images[id]={rows,savingsBytes:value(report,id,'overallSavingsBytes')};
 }
 const clsLegacy=list(report,'layout-shift-elements');
 const clsInsight=list(report,'cls-culprits-insight');
 return {lighthouseVersion:str(report.lighthouseVersion),cpu,js,css:{rows:css,listedBytes:cssTotal,wastedBytes:cssWaste,listedWastePercent:cssTotal>0&&cssWaste!==null?cssWaste/cssTotal*100:null},lcp:{elements:nodes(lcpInsight??lcpLegacy),phases,legacyDetails:lcpLegacy,insightDetails:lcpInsight,discoveryDetails:list(report,'lcp-discovery-insight')},renderBlocking:{rows:render,savingsMs:value(report,'render-blocking-resources','overallSavingsMs'),insightDetails:list(report,'render-blocking-insight')},images,cls:{elements:nodes(clsInsight??clsLegacy),legacyDetails:clsLegacy,insightDetails:clsInsight},networkByType};
}
const med=values=>{const s=values.slice().sort((a,b)=>a-b);const i=Math.floor(s.length/2);return s.length?s.length%2?s[i]:(s[i-1]+s[i])/2:null;};
function stat(values){const present=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(v));return {median:med(present),available:present.length,samples:values.length};}
// Aggregate only observed rows. Absence in an opportunity list is not proof of zero waste.
function aggregateRows(samples,get,key,fields){
 const lists=samples.map(get),keys=new Set(lists.flatMap(rows=>(rows??[]).map(x=>x[key]).filter(x=>x!==null&&x!==undefined)));
 return {available:lists.filter(x=>x!==null).length,samples:samples.length,rows:[...keys].map(k=>{
  const values=lists.map(rows=>rows===null?null:rows.filter(x=>x[key]===k));
  return {key:k,...Object.fromEntries(fields.map(field=>[field,stat(values.map(rows=>rows?.length?sum(rows.map(x=>x[field]??null)):null))]))};
 })};
}
export function aggregateDiagnostics(samples){
 return {cpu:aggregateRows(samples,x=>x.cpu,'group',['durationMs']),js:aggregateRows(samples,x=>x.js,'url',['totalMs','scriptingMs','scriptParseCompileMs']),css:aggregateRows(samples,x=>x.css.rows,'url',['totalBytes','wastedBytes']),cssWaste:stat(samples.map(x=>x.css.wastedBytes)),cssListedWastePercent:stat(samples.map(x=>x.css.listedWastePercent)),lcpPhases:aggregateRows(samples,x=>x.lcp.phases.length?x.lcp.phases:null,'phase',['durationMs']),lcpElements:samples.map(x=>x.lcp.elements),renderBlocking:aggregateRows(samples,x=>x.renderBlocking.rows,'url',['wastedMs']),renderSavings:stat(samples.map(x=>x.renderBlocking.savingsMs)),network:aggregateRows(samples,x=>x.networkByType,'type',['requests','transferBytes','resourceBytes']),clsElements:samples.map(x=>x.cls.elements),imageSavings:Object.fromEntries([...new Set(samples.flatMap(x=>Object.keys(x.images)))].map(id=>[id,stat(samples.map(x=>x.images[id]?.savingsBytes??null))]))};
}
const fmt=s=>s?.median===null||s===undefined?'—':Number(s.median.toFixed(2))+' ('+s.available+'/'+s.samples+')';
const safe=s=>String(s??'—').replace(/[\r\n|]/g,' ').replace(/[<>]/g,'').slice(0,240);
export function diagnosticMarkdown(groups){
 const lines=['# Lighthouse bottleneck diagnostics','','Values are medians of observed rows, with coverage (available/total). Missing audits/rows are not zero. Opportunity savings overlap and must not be summed. CSS ratio covers listed opportunity resources, not all loaded CSS. LCP phase timings are Lighthouse audit estimates, not an independent trace.',''];
 for(const [profile,sides] of Object.entries(groups)){
  lines.push('## '+profile,'');
  const before=sides.before,after=sides.after;
  for(const [title,key,field,unit] of [['CPU groups','cpu','durationMs','ms'],['JavaScript execution','js','totalMs','ms'],['Unused CSS by URL','css','wastedBytes','bytes'],['LCP phases','lcpPhases','durationMs','ms'],['Render-blocking resources','renderBlocking','wastedMs','ms'],['Network transfer by type','network','transferBytes','bytes']]){
   const a=before[key],b=after[key],keys=[...new Set([...a.rows,...b.rows].map(x=>x.key))];
   const find=(g,k)=>g.rows.find(x=>x.key===k)?.[field];
   keys.sort((x,y)=>Math.max(find(b,y)?.median??0,find(a,y)?.median??0)-Math.max(find(b,x)?.median??0,find(a,x)?.median??0));
   lines.push('### '+title+' ('+unit+')','','Audit coverage: '+a.available+'/'+a.samples+' before; '+b.available+'/'+b.samples+' after.','');
   if(!keys.length){lines.push('No observed rows (inspect audit coverage).','');continue;}
   lines.push('| Item | Before | After | Delta (same full coverage only) |','|---|---:|---:|---:|');
   for(const k of keys.slice(0,12)){
    const x=find(a,k),y=find(b,k),delta=x?.median!=null&&y?.median!=null&&x.available===x.samples&&y.available===y.samples?Number((y.median-x.median).toFixed(2)):'—';
    lines.push('| '+safe(k)+' | '+fmt(x)+' | '+fmt(y)+' | '+delta+' |');
   }
   lines.push('');
  }
  lines.push('CSS wasted bytes: '+fmt(before.cssWaste)+' → '+fmt(after.cssWaste),'','CSS listed waste %: '+fmt(before.cssListedWastePercent)+' → '+fmt(after.cssListedWastePercent),'','Render-blocking savings estimate (ms): '+fmt(before.renderSavings)+' → '+fmt(after.renderSavings),'');
  for(const [label,key] of [['LCP elements','lcpElements'],['CLS elements','clsElements']]){
   lines.push('### '+label,'');
   for(const side of ['before','after']){
    const samples=sides[side][key];const counts=new Map();
    for(const sample of samples)for(const selector of new Set((sample??[]).map(x=>x.selector??x.nodeLabel).filter(Boolean)))counts.set(selector,(counts.get(selector)??0)+1);
    lines.push(side+': '+([...counts].map(([k,n])=>safe(k)+' ('+n+'/'+samples.length+')').slice(0,8).join('; ')||'No observed nodes')+'.','');
   }
  }
  lines.push('### Image opportunities (estimated bytes, not additive)','','| Audit | Before | After |','|---|---:|---:|');
  for(const id of new Set([...Object.keys(before.imageSavings),...Object.keys(after.imageSavings)]))lines.push('| '+safe(id)+' | '+fmt(before.imageSavings[id])+' | '+fmt(after.imageSavings[id])+' |');
  lines.push('');
 }
 return lines.join('\n')+'\n';
}
