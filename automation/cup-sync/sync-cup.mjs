import fs from 'node:fs';
import {parse} from 'acorn';
import {planSchedule} from './plan-schedule.mjs';
import {planResults} from './plan-results.mjs';
const prop=(n,k)=>n?.properties?.find(p=>!p.computed&&(p.key.name??p.key.value)===k)?.value;
function literal(n){
 if(n.type==='Literal')return n.value;
 if(n.type==='ArrayExpression')return n.elements.map(literal);
 if(n.type==='ObjectExpression')return Object.fromEntries(n.properties.map(p=>{if(p.type!=='Property'||p.computed||p.kind!=='init')throw Error('Unsupported property');return [p.key.name??p.key.value,literal(p.value)];}));
 throw Error('Unsupported cup expression: '+n.type);
}
function locate(source){
 const ast=parse(source,{ecmaVersion:'latest'});
 const d=ast.body.flatMap(n=>n.declarations??[]).find(n=>n.id.name==='cupTournaments');
 const n=d?.init?.elements?.find(n=>prop(n,'id')?.value==='faCup2627');
 if(!n)throw Error('FA Cup missing');
 return {node:n,cup:literal(n)};
}
function apply(source,proposals,allowed){
 const {node,cup}=locate(source), edits=[];
 for(const p of proposals){
  const f=cup.rounds[p.roundIndex]?.matches?.[p.matchIndex];
  const n=prop(prop(node,'rounds').elements[p.roundIndex],'matches').elements[p.matchIndex];
  if(!f||!n||(f.id??('round:'+p.roundIndex+':match:'+p.matchIndex))!==p.fixtureId)throw Error('Fixture changed');
  const additions=[];
  for(const [k,v] of Object.entries(p.changes)){
   if(!allowed.includes(k))throw Error('Unexpected field '+k);
   const old=prop(n,k);
   if(old){if(f[k]!=null&&f[k]!==''&&f[k]!==v)throw Error('Existing value conflict');edits.push({start:old.start,end:old.end,text:JSON.stringify(v)});}
   else additions.push(k+': '+JSON.stringify(v));
  }
  if(additions.length){const last=n.properties.at(-1);edits.push({start:last.end,end:last.end,text:', '+additions.join(', ')});}
 }
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
 return source;
}
export function syncCup(source,items){
 const schedule=planSchedule(items,locate(source).cup);
 source=apply(source,schedule.proposals,['date','time','venueEn','venueType']);
 const results=planResults(items,locate(source).cup);
 source=apply(source,results.proposals,['homeScore','awayScore','pso']);
 // Existing site resolver derives playoff winners from stored scores.
 return {source,cup:locate(source).cup,schedule,results};
}
const path=process.env.DATA_PATH||'data.js';
const input=JSON.parse(fs.readFileSync(process.env.API_PATH||'work/cup-api.json','utf8'));
if(!Array.isArray(input.items))throw Error('Invalid API response');
const source=fs.readFileSync(path,'utf8');
const result=syncCup(source,input.items);
console.log(JSON.stringify({schedule:result.schedule,results:result.results},null,2));
if(process.env.DRY_RUN!=='false')process.exit(0);
fs.writeFileSync(path,result.source);
fs.writeFileSync('automation/cup-sync/cup-snapshot.json',JSON.stringify(result.cup,null,2)+'\n');
