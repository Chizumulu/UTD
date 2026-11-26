import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
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
export function locate(source){
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
export function resolveCupParticipants(cup){
 const resolved=JSON.parse(JSON.stringify(cup)), winners=new Map();
 for(const round of resolved.rounds)for(const f of round.matches??[]){
  for(const side of ['home','away']){
   const prior=winners.get(f[side+'WinnerOf']);
   if(prior&&(!f[side]||/\bwinner\b|\btbd\b|\//i.test(f[side])))f[side]=prior;
  }
  if(!f.id||f.postponed||f.forfeit||/^(forfeit|walk[ _-]?over|awarded)$/i.test(f.resultType??''))continue;
  const a=f.homeScore,b=f.awayScore;
  if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0)continue;
  let side=a>b?'home':b>a?'away':null;
  if(!side){const p=String(f.pso??'').match(/^(\d+):(\d+)$/);if(p&&Number(p[1])!==Number(p[2]))side=Number(p[1])>Number(p[2])?'home':'away';}
  if(side&&f[side]&&!/\bwinner\b|\btbd\b|\//i.test(f[side]))winners.set(f.id,f[side]);
 }
 return resolved;
}
export function syncCup(source,items){
 const schedule=planSchedule(items,resolveCupParticipants(locate(source).cup));
 source=apply(source,schedule.proposals,['date','time','venueEn','venueType']);
 const results={proposals:[],held:[]};
 for(let i=0;i<locate(source).cup.rounds.length;i++){
  const pass=planResults(items,resolveCupParticipants(locate(source).cup));
  results.held=pass.held;
  if(!pass.proposals.length)break;
  results.proposals.push(...pass.proposals);
  source=apply(source,pass.proposals,['homeScore','awayScore','pso','date']);
 }
 const later=planSchedule(items,resolveCupParticipants(locate(source).cup));
 source=apply(source,later.proposals,['date','time','venueEn','venueType']);
 schedule.proposals.push(...later.proposals);
 // Existing site resolver derives playoff winners from stored scores.
 return {source,cup:resolveCupParticipants(locate(source).cup),schedule,results};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
const path=process.env.DATA_PATH||'data.js';
const input=JSON.parse(fs.readFileSync(process.env.API_PATH||'work/cup-api.json','utf8'));
if(!Array.isArray(input.items))throw Error('Invalid API response');
const source=fs.readFileSync(path,'utf8');
const result=syncCup(source,input.items);
console.log(JSON.stringify({schedule:result.schedule,results:result.results},null,2));
if(process.env.DRY_RUN!=='false')process.exit(0);
fs.writeFileSync(path,result.source);
fs.writeFileSync('automation/cup-sync/cup-snapshot.json',JSON.stringify(result.cup,null,2)+'\n');
}
