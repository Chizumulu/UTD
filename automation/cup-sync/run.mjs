import fs from 'node:fs';
import vm from 'node:vm';
import {parse} from 'acorn';
import {planSchedule} from './plan-schedule.mjs';
import {planResults} from './plan-results.mjs';
import {planCupScorers} from './plan-scorers.mjs';
const prop=(n,k)=>n?.properties?.find(p=>(p.key.name??p.key.value)===k)?.value;
function locate(source){
 const tree=parse(source,{ecmaVersion:'latest'});
 const cups=tree.body.flatMap(n=>n.declarations??[]).find(n=>n.id.name==='cupTournaments')?.init;
 const node=cups?.elements?.find(n=>prop(n,'id')?.value==='faCup2627');
 if(!node)throw Error('FA Cup not found');
 const context=vm.createContext({});
 vm.runInContext(source,context,{timeout:5000});
 const cup=vm.runInContext("getCups().find(c=>c.id==='faCup2627')",context,{timeout:5000});
 return {node,cup};
}
function apply(source,proposals){
 const {node}=locate(source),edits=[];
 for(const p of proposals){
  const match=prop(prop(node,'rounds').elements[p.roundIndex],'matches').elements[p.matchIndex];
  if(match?.type!=='ObjectExpression')throw Error('Invalid fixture location');
  const additions=[];
  for(const [k,v] of Object.entries(p.changes)){
   if(!['date','time','venueEn','venueType','haConfirmed','homeScore','awayScore','pso'].includes(k))throw Error('Unexpected field '+k);
   const old=prop(match,k);
   if(old){if(old.type!=='Literal')throw Error('Nonliteral field');edits.push([old.start,old.end,JSON.stringify(v)]);}
   else additions.push(k+': '+JSON.stringify(v));
  }
  if(additions.length){const last=match.properties.at(-1);edits.push([last.end,last.end,', '+additions.join(', ')]);}
 }
 for(const [a,b,v] of edits.sort((x,y)=>y[0]-x[0]))source=source.slice(0,a)+v+source.slice(b);
 parse(source,{ecmaVersion:'latest'});
 return source;
}
const args=process.argv.slice(2);
const file=args.find(x=>!x.startsWith('--'));
if(!file)throw Error('Provide API JSON file');
const {items}=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(items))throw Error('Invalid API response');
const original=fs.readFileSync('data.js','utf8');
let source=original;
const schedule=planSchedule(items,locate(source).cup);
for(const p of schedule.proposals)p.changes.haConfirmed=false;
source=apply(source,schedule.proposals);
const results=planResults(items,locate(source).cup);
source=apply(source,results.proposals);
const scorers=planCupScorers(items,locate(source).cup);
console.log(JSON.stringify({schedule,results,scorers,changed:source!==original,dryRun:!args.includes('--apply')},null,2));
if(args.includes('--apply')&&source!==original)fs.writeFileSync('data.js',source);
