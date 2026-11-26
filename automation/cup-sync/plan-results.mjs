import {detectForfeit} from '../forfeit-approval/detect-forfeit.mjs';
import {matchCupItems} from './match-fixtures.mjs';
import {parseDate} from './plan-schedule.mjs';
const score=n=>Number.isSafeInteger(n)&&n>=0;
const finalStatus=new Set(['full_time','finished','ended']);
export function planResults(items,cup){
 // Keep scorer-bearing snapshots distinct from score-only reports.
 const snapshots=(items??[]).flatMap(item=>matchCupItems([item],cup).matched);
 const hasScorerEvidence=new Set(snapshots.filter(h=>finalStatus.has(h.match.status)&&!detectForfeit(h.match)&&!h.match.forfeit&&!/^(forfeit|walk[ _-]?over|awarded)$/i.test(h.match.resultType??'')).map(h=>JSON.stringify([h.fixtureId,parseDate(h.match.dateText),h.bracketScores])));
 const {matched,skipped}=matchCupItems(items,cup);
 const held=[...skipped],proposals=[],groups=new Map();
 for(const hit of matched){
  const m=hit.match, f=cup.rounds[hit.roundIndex].matches[hit.matchIndex];
  const hold=reason=>held.push({source:hit.source,fixtureId:hit.fixtureId,reason});
  if(!finalStatus.has(m.status)){hold('not_final');continue;}
  const date=parseDate(m.dateText);
  if(!date|| (f.date&&f.date!==date)){hold('missing_or_conflicting_result_date');continue;}
  const [a,b]=hit.bracketScores;
  if(!score(a)||!score(b)){hold('invalid_score');continue;}
  const suspect=detectForfeit(m);
  if(suspect&&(suspect.explicit||!hasScorerEvidence.has(JSON.stringify([hit.fixtureId,date,hit.bracketScores])))){hold('possible_forfeit_requires_approval');continue;}
  // Penalty schema is provisional until verified against a real FA Cup result.
  const fields={homeScore:a,awayScore:b,...(!f.date?{date}:{})};
  if(a===b){
   const p=typeof m.pso==='string'&&m.pso.match(/^(\d+)\s*:\s*(\d+)$/);
   if(!p){hold('draw_without_verified_shootout');continue;}
   let x=Number(p[1]),y=Number(p[2]);
   if(!score(x)||!score(y)||x===y){hold('invalid_shootout');continue;}
   if(hit.reversed)[x,y]=[y,x];
   fields.pso=x+':'+y;
  }else if(m.pso!=null&&m.pso!==''){hold('unexpected_shootout');continue;}
  if(f.postponed||f.forfeit||m.forfeit||/^(forfeit|walk[ _-]?over|awarded)$/i.test(m.resultType??'')){hold('special_result_requires_review');continue;}
  const winnerSide=a>b?'home':a<b?'away':Number(fields.pso.split(':')[0])>Number(fields.pso.split(':')[1])?'home':'away';
  const g=groups.get(hit.fixtureId)??[];
  g.push({hit,f,fields,winnerSide});groups.set(hit.fixtureId,g);
 }
 for(const [fixtureId,g] of groups){
  const first=g[0],{fields,f,winnerSide,hit}=first;
  if(g.some(x=>JSON.stringify(x.fields)!==JSON.stringify(fields))||Object.entries(fields).some(([k,v])=>f[k]!=null&&f[k]!==''&&f[k]!==v)||(!fields.pso&&f.pso)){
   held.push({fixtureId,reason:'conflicting_result_requires_review'});continue;
  }
  const changes=Object.fromEntries(Object.entries(fields).filter(([k,v])=>f[k]!==v));
  if(!Object.keys(changes).length)continue;
  const winner=f[winnerSide],advance=[];
  if(f.id)for(const [ri,r] of cup.rounds.entries())for(const [mi,next] of (r.matches??[]).entries()){
   if(next.awayWinnerOf===f.id){
    if(!next.away||/\bwinner\b|\btbd\b|\//i.test(next.away))advance.push({roundIndex:ri,matchIndex:mi,side:'away',team:winner});
    else if(next.away!==winner)held.push({fixtureId,reason:'confirmed_qualifier_conflict',roundIndex:ri,matchIndex:mi});
   }
  }
  proposals.push({fixtureId,roundIndex:hit.roundIndex,matchIndex:hit.matchIndex,changes,winner,regularOutcome:fields.homeScore===fields.awayScore?'draw':winnerSide,advance,sources:g.map(x=>x.hit.source)});
 }
 return {proposals,held};
}
