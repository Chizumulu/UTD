import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {locate,resolveCupParticipants} from './sync-cup.mjs';
import {parse} from 'acorn';
import {normalizeTeam} from './match-fixtures.mjs';

const CHI='chizumulu united';
const prop=(n,k)=>n?.properties?.find(p=>!p.computed&&(p.key.name??p.key.value)===k)?.value;
const val=(n,k)=>prop(n,k)?.value;
export function applyApprovedScorers(source,p){
 if(p?.competition!=='faCup2627'||!p.fixtureId||!Array.isArray(p.goals)||!p.goals.length)throw Error('Invalid cup proposal');
 const side=normalizeTeam(p.home)===CHI?'home':normalizeTeam(p.away)===CHI?'away':null;
 if(!side||p.goals.some(g=>g.side!==side||typeof g.name!=='string'||!g.name.trim()||!Number.isSafeInteger(g.count)||g.count<1))throw Error('Invalid Chizumulu goals');
 if(!Number.isSafeInteger(p.homeScore)||!Number.isSafeInteger(p.awayScore)||p.homeScore<0||p.awayScore<0||p.goals.reduce((n,g)=>n+g.count,0)!==p[side+'Score'])throw Error('Score mismatch');
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
 const decl=ast.body.flatMap(n=>n.declarations??[]).find(n=>n.id.name==='cupTournaments');
 const cup=decl?.init?.elements?.find(n=>val(n,'id')==='faCup2627');
 const resolved=resolveCupParticipants(locate(source).cup);
 const matches=[];
 for(const [ri,r] of (prop(cup,'rounds')?.elements??[]).entries())for(const [mi,m] of (prop(r,'matches')?.elements??[]).entries()){
  if((val(m,'id')??('round:'+ri+':match:'+mi))===p.fixtureId&&normalizeTeam(resolved.rounds[ri]?.matches?.[mi]?.home)===normalizeTeam(p.home)&&normalizeTeam(resolved.rounds[ri]?.matches?.[mi]?.away)===normalizeTeam(p.away)&&val(m,'date')===p.date&&val(m,'homeScore')===p.homeScore&&val(m,'awayScore')===p.awayScore)matches.push(m);
 }
 if(matches.length!==1)throw Error('No unique verified cup fixture');
 const m=matches[0];
 if(val(m,'forfeit')||val(m,'postponed')||/^(forfeit|walk[ _-]?over|awarded)$/i.test(val(m,'resultType')??''))throw Error('Administrative result');
 const goals=p.goals.map(g=>({name:g.name.trim(),count:g.count})).sort((a,b)=>a.name.localeCompare(b.name));
 const existing=prop(m,'chizumuluScorers');
 if(existing){
  let old;try{old=JSON.parse(source.slice(existing.start,existing.end))}catch{throw Error('Existing scorers require manual review')}
  if(JSON.stringify(old)===JSON.stringify(goals))return source;
  throw Error('Existing scorers conflict');
 }
 const last=m.properties.at(-1);
 const tail=source.slice(last.end,m.end-1);
 const separator=/^\s*,/.test(tail)?'':',';
 return source.slice(0,m.end-1)+separator+' chizumuluScorers: '+JSON.stringify(goals)+' '+source.slice(m.end-1);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.env.DATA_PATH||'data.js';
 const source=fs.readFileSync(path,'utf8');
 const p=JSON.parse(fs.readFileSync(process.env.PROPOSAL_PATH||'work/scorer-proposal.json','utf8'));
 const updated=applyApprovedScorers(source,p);
 if(updated!==source){parse(updated,{ecmaVersion:'latest'});fs.writeFileSync(path,updated);}
}
