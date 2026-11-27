import postcss from 'postcss';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Conservative ownership hints, not an extraction allowlist.
export const owners={
 cup:/#cupView\b|#cupViewContent\b|\.cup-[\w-]+/g,
 archive:/#archive(?:View|MainPane|WeeklyPane|ClubsPane)\b|\.archive-[\w-]+/g,
 venue:/#venuesView\b|#venueMapModal\b|\.venue-[\w-]+/g,
 prediction:/#predictView\b|\.predict-[\w-]+|\.wi-[\w-]+/g,
 matchDetail:/#matchDetailModal\b|#matchDetailBody\b|\.mdm-[\w-]+/g,
 players:/#(?:playerModal|squadPlayerModal|fullRecordModal)\b|\.spm-[\w-]+|\.pcard\b/g,
 comparison:/#(?:teamCompareView|matchCompareModal)\b|\.tc-[\w-]+/g,
 seasonCompare:/#statsView\b[^,]*\[data-stats-panel=["']?compare|\.prev-compare-[\w-]+/g,
 report:/#reportView\b|\.report-[\w-]+/g,
 club:/#(?:squadView|myTeamInfoView|otherTeamFullView)\b|\.ti-[\w-]+/g,
 rounds:/#roundsView\b|\.rmc-[\w-]+/g,
 rank:/#leagueRankView\b|#mainTable\b/g,
 scorers:/#scorersView\b/g,
 home:/#(?:rankView|nextMatchStrip|promoRaceStrip|homeRecentStrip|homeUpcomingStrip)\b|\.nmh-[\w-]+|\.nms-[\w-]+/g,
 shared:/\.modal-(?:overlay|content|body|header)\b|\.team-logo\b|\.rmd-act-btn\b|\.report-empty\b|\.app-shell\b|\.app-sidebar\b/g
};
export function selectorOwners(selector){
 // Match branches independently using balanced brackets, strings and parentheses.
 const branches=[];let start=0,depth=0,quote='',escaped=false;
 for(let i=0;i<selector.length;i++){const c=selector[i];if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(quote){if(c===quote)quote='';continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==='('||c==='[')depth++;if(c===')'||c===']')depth--;if(c===','&&depth===0){branches.push(selector.slice(start,i));start=i+1;}}
 branches.push(selector.slice(start));
 const hints=branches.map(branch=>Object.keys(owners).filter(key=>{owners[key].lastIndex=0;return owners[key].test(branch)}));
 const union=[...new Set(hints.flat())];
 return {branches,hints,owners:union,classification:union.length===1&&!hints.some(x=>x.length!==1)?union[0]:union.length?'mixed':'unknown'};
}
const bytes=s=>Buffer.byteLength(s);
const size=s=>({raw:bytes(s),gzip:gzipSync(s).length,brotli:brotliCompressSync(s).length});
export function analyze(css){
 const root=postcss.parse(css),rules=[],groups={},variables={},animations={},selectors={};
 const keyframes=node=>{for(let p=node.parent;p;p=p.parent)if(p.type==='atrule'&&/keyframes$/i.test(p.name))return true;return false;};
 root.walkRules(rule=>{
  if(keyframes(rule))return;
  const o=selectorOwners(rule.selector),start=rule.source.start.offset,end=rule.source.end.offset;
  const ancestors=[];for(let p=rule.parent;p&&p.type!=='root';p=p.parent)ancestors.unshift(p.type==='atrule'?'@'+p.name+' '+p.params:p.selector);
  const declarations=[];
  for(const d of rule.nodes??[]){if(d.type!=='decl')continue;const refs=[...d.value.matchAll(/var\(\s*(--[\w-]+)/g)].map(m=>m[1]);declarations.push({property:d.prop,value:d.value,important:!!d.important,refs});for(const v of refs)(variables[v]??={definitions:[],uses:[]}).uses.push(rules.length);if(d.prop.startsWith('--'))(variables[d.prop]??={definitions:[],uses:[]}).definitions.push(rules.length);if(/^animation(?:-name)?$/.test(d.prop))(animations[d.value]??=[]).push(rules.length);}
  const id=rules.length;const raw=css.slice(start,end);rules.push({id,start,end,line:rule.source.start.line,selector:rule.selector,...o,ancestors,bytes:bytes(raw),declarations});
  (groups[o.classification]??={rules:0,ruleBytes:0,declarations:0}).rules++;groups[o.classification].ruleBytes+=bytes(raw);groups[o.classification].declarations+=declarations.length;
  for(const branch of o.branches)(selectors[branch.trim()]??=[]).push(id);
 });
 const atRules={};root.walkAtRules(a=>{atRules[a.name]=(atRules[a.name]??0)+1});
 return {size:size(css),rules,groups,atRules,variables,animations,repeatedSelectors:Object.entries(selectors).filter(([,ids])=>ids.length>1).map(([selector,ids])=>({selector,ids})),notes:['Rule bytes exclude at-rule wrappers, comments and keyframes; not additive compressed savings.','Ownership is heuristic; mixed/unknown/shared/home rules stay protected.','Animation declarations are raw values, not resolved keyframe references.']};
}
export function mergeRanges(ranges){
 const sorted=ranges.map(r=>({start:r.start,end:r.end})).filter(r=>Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.end>r.start).sort((a,b)=>a.start-b.start),out=[];
 for(const r of sorted){const last=out.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else out.push(r);}return out;
}
export function coverage(css,analysis,samples){
 const union=mergeRanges(samples.flatMap(s=>s.ranges));const classify=(ranges)=>{
  let cursor=0;const used=[],unused=[],partial=[];
  for(const r of analysis.rules){while(cursor<ranges.length&&ranges[cursor].end<=r.start)cursor++;let count=0;for(let j=cursor;j<ranges.length&&ranges[j].start<r.end;j++)count+=Math.max(0,Math.min(r.end,ranges[j].end)-Math.max(r.start,ranges[j].start));if(!count)unused.push(r.id);else if(count>=r.end-r.start)used.push(r.id);else partial.push(r.id);}
  return {used,unused,partial,usedBytes:ranges.reduce((n,r)=>n+bytes(css.slice(r.start,r.end)),0)};
 };
 const result=classify(union),byGroup={};
 for(const [name,g] of Object.entries(analysis.groups)){const rs=analysis.rules.filter(r=>r.classification===name),unused=new Set(result.unused),partial=new Set(result.partial);byGroup[name]={...g,unobservedRules:rs.filter(r=>unused.has(r.id)).length,unobservedRuleBytes:rs.filter(r=>unused.has(r.id)).reduce((n,r)=>n+r.bytes,0),partialRules:rs.filter(r=>partial.has(r.id)).length,unobservedDeclarations:rs.filter(r=>unused.has(r.id)).reduce((n,r)=>n+r.declarations.length,0)};}
 return {samples:samples.map(s=>({...s,...classify(mergeRanges(s.ranges))})),union:result,byGroup,notes:['Coverage reports matched rule ranges, not individual declaration execution. Unobserved declarations are inside wholly unobserved rules, not proven dead CSS.','Offsets are UTF-16; byte counts use UTF-8.','Only successful scenarios with an exact stylesheet text match contribute.']};
}
export function markdown(a,c){
 const lines=['# CSS ownership and browser coverage audit','','Source CSS bytes: '+a.size.raw+'; gzip: '+a.size.gzip+'; Brotli: '+a.size.brotli,'Rules: '+a.rules.length+'; repeated selectors: '+a.repeatedSelectors.length,'','| Group | Rules | Rule bytes | Unobserved rules | Unobserved rule bytes | Declarations in unobserved rules |','|---|---:|---:|---:|---:|---:|'];
 for(const [name,g] of Object.entries(c.byGroup))lines.push('| '+name+' | '+g.rules+' | '+g.ruleBytes+' | '+g.unobservedRules+' | '+g.unobservedRuleBytes+' | '+g.unobservedDeclarations+' |');
 lines.push('','## Browser scenarios','','| Scenario | Used bytes | Unobserved rules | Partial rules |','|---|---:|---:|---:|');
 for(const s of c.samples)lines.push('| '+s.name+' | '+s.usedBytes+' | '+s.unused.length+' | '+s.partial.length+' |');
 return lines.concat('',...a.notes,...c.notes,'').join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [cssPath,samplePath,out]=process.argv.slice(2);const css=readFileSync(cssPath,'utf8'),a=analyze(css),c=coverage(css,a,JSON.parse(readFileSync(samplePath,'utf8')));mkdirSync(out,{recursive:true});writeFileSync(join(out,'ownership.json'),JSON.stringify(a));writeFileSync(join(out,'coverage.json'),JSON.stringify(c));writeFileSync(join(out,'report.md'),markdown(a,c));
}
