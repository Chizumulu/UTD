import fs from 'node:fs';
import {parse} from 'acorn';
import {pathToFileURL} from 'node:url';
import {locate,resolveCupParticipants} from '../cup-sync/sync-cup.mjs';
const prop=(n,k)=>n?.properties?.find(p=>p.type==='Property'&&!p.computed&&(p.key.name??p.key.value)===k);
const val=(n,k)=>prop(n,k)?.value?.value;
const norm=s=>String(s??'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim().split(/\s+/).filter(t=>t&&!['fc','sc','afc','football','club'].includes(t)).join(' ');
const same=(a,b)=>Boolean(norm(a)&&norm(a)===norm(b));
const ko=s=>String(s??'').normalize('NFKC').replace(/FC|SC|AFC/gi,'').replace(/[^가-힣a-zA-Z0-9]/g,'');
const sameKo=(a,b)=>Boolean(ko(a)&&ko(b)&&(ko(a).startsWith(ko(b))||ko(b).startsWith(ko(a))));
export function applyForfeit(source,p){
 if(p?.kind!=='forfeit'||p.state!=='approved'||!Array.isArray(p.goals)||p.goals.length||!((p.homeScore===3&&p.awayScore===0)||(p.homeScore===0&&p.awayScore===3))||!/^\d{4}-\d{2}-\d{2}$/.test(p.matchDate??'')||!norm(p.home)||!norm(p.away)||same(p.home,p.away))throw Error('Invalid approved forfeit');
 const ast=parse(source,{ecmaVersion:'latest'}), edits=[];
 const decl=k=>ast.body.flatMap(n=>n.declarations??[]).find(n=>n.id.name===k)?.init;
 function update(n,fields){
  const additions=[];
  for(const [k,v] of Object.entries(fields)){
   const old=prop(n,k);
   if(old){if(source.slice(old.value.start,old.value.end)!==JSON.stringify(v))edits.push({start:old.value.start,end:old.value.end,text:JSON.stringify(v)});}
   else additions.push(k+': '+JSON.stringify(v));
  }
  if(additions.length){const last=n.properties.at(-1);edits.push({start:last.end,end:last.end,text:', '+additions.join(', ')});}
 }
 const hits=[];
 function inspect(n,meta,hk,ak,dk){
  if(!n||val(n,'postponed')||val(n,'cancelled')||val(n,'movedToWeek')!=null||['postponed','cancelled'].includes(val(n,'status')))return;
  const date=val(n,dk);
  if(date!==p.matchDate)return;
  const h=val(n,hk),a=val(n,ak);
  if(same(h,p.home)&&same(a,p.away))hits.push({n,meta,h:p.homeScore,a:p.awayScore});
  else if(same(h,p.away)&&same(a,p.home))hits.push({n,meta,h:p.awayScore,a:p.homeScore});
 }
 if(p.competition==='faCup2627'){
  const {node}=locate(source);
  for(const [ri,r] of prop(node,'rounds').value.elements.entries())for(const [mi,n] of (prop(r,'matches')?.value.elements??[]).entries()){
   if(p.fixtureId&&(val(n,'id')??('round:'+ri+':match:'+mi))!==p.fixtureId)continue;
   inspect(n,{cup:true},'home','away','date');
  }
 }else{
  for(const section of ['roundsData','scheduledRounds'])for(const r of decl(section)?.properties??[]){
   for(const n of r.value.elements??[])inspect(n,{section,round:r.key.name??r.key.value},'homeEn','awayEn','kickoffDate');
  }
 }
 if(hits.length!==1)throw Error('No unique dated fixture: '+hits.length);
 const {n,meta,h,a}=hits[0];
 const oldH=val(n,'homeScore'),oldA=val(n,'awayScore');
 if(meta.cup){
  if((oldH!=null||oldA!=null)&&(oldH!==h||oldA!==a))throw Error('Existing cup result conflict requires manual bracket review');
  update(n,{homeScore:h,awayScore:a,forfeit:true,chizumuluScorers:[],...(prop(n,'pso')?{pso:null}:{})});
 }else{
  update(n,{homeScore:h,awayScore:a,forfeit:true,scorersHome:'없음',scorersAway:'없음'});
  if(meta.section==='roundsData'){
   const details=prop(decl('matchDetails'),meta.round)?.value?.elements??[];
   const targets=details.flatMap(d=>{
    const m=String(val(d,'match')??'').match(/^\s*(.*?)\s+(\d+)\s*:\s*(.*?)\s+(\d+)(?:\s*\(몰수승\))?\s*$/);
    return m&&sameKo(m[1],val(n,'homeKo'))&&sameKo(m[3],val(n,'awayKo'))&&Number(m[2])===oldH&&Number(m[4])===oldA?[{d,m}]:[];
   });
   if(targets.length!==1)throw Error('No unique completed match detail: '+targets.length);
   const {d,m}=targets[0];update(d,{match:m[1]+' '+h+' : '+m[3]+' '+a,scorersHome:'없음',scorersAway:'없음'});
  }
 }
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
 parse(source,{ecmaVersion:'latest'});
 return source;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path=process.env.DATA_PATH||'data.js';
 const p=JSON.parse(fs.readFileSync(process.env.PROPOSAL_PATH||'work/scorer-proposal.json','utf8'));
 const updated=applyForfeit(fs.readFileSync(path,'utf8'),p);
 fs.writeFileSync(path,updated);
 if(p.competition==='faCup2627')fs.writeFileSync('automation/cup-sync/cup-snapshot.json',JSON.stringify(resolveCupParticipants(locate(updated).cup),null,2)+'\n');
}
