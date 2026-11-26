import {normalizeTeam,matchCupItems} from './match-fixtures.mjs';
import {parseDate} from './plan-schedule.mjs';
const CHI='chizumulu united';
// Read-only adapter. Never dispatch to the league workflow.
export function planCupScorers(items,cup){
 const proposals=[],held=[],groups=new Map();
 // Match separately: fixture deduplication intentionally ignores scorer evidence.
 for(const item of items??[]){
  const {matched}=matchCupItems([item],cup);
  for(const hit of matched){
   const m=hit.match, f=cup.rounds[hit.roundIndex].matches[hit.matchIndex];
   const side=normalizeTeam(m.homeTeam)===CHI?'home':normalizeTeam(m.awayTeam)===CHI?'away':null;
   if(!side||!['full_time','finished','ended'].includes(m.status))continue;
   const hold=reason=>held.push({fixtureId:hit.fixtureId,source:hit.source,reason});
   const date=parseDate(m.dateText);
   if(!date||!f.date||f.date!==date||f.homeScore!==hit.bracketScores[0]||f.awayScore!==hit.bracketScores[1]||m.forfeit||f.forfeit){hold('result_not_verified');continue;}
   const expected=m[side+'Score'];
   if(!Number.isSafeInteger(expected)||expected<=0)continue;
   const goals=[],seen=new Set();let uncertain=false;
   for(const e of m.events??[]){
    const type=String(e.type??'').toLowerCase();
    if(/shoot.?out|pso/.test(type+' '+String(e.phase??'')))continue;
    if(!/^(goal|penalty|own.goal)$/.test(type))continue;
    const team=normalizeTeam(e.team);
    if(!team){uncertain=true;continue;}
    if(team!==CHI)continue;
    if(/own.goal/.test(type)||e.ownGoal){uncertain=true;continue;}
    if(type==='penalty'&&!/^(goal|scored|converted|successful)$/i.test(String(e.outcome??e.result??''))){uncertain=true;continue;}
    const players=(e.players??[]).filter(p=>/^(scorer|goalscorer)$/i.test(String(p.role??'')));
    if(players.length!==1){uncertain=true;continue;}
    const p=players[0],name=String(p.name??'').trim(),count=p.count??1;
    if(!name||p.ownGoal||p.isOwnGoal||!Number.isSafeInteger(count)||count<1){uncertain=true;continue;}
    const key=JSON.stringify([name.toLowerCase(),e.minuteText??e.minute??null,count]);
    if(seen.has(key))continue;
    seen.add(key);goals.push({name,count});
   }
   if(uncertain||goals.reduce((n,g)=>n+g.count,0)!==expected){hold('incomplete_or_ambiguous_chizumulu_scorers');continue;}
   const byName=new Map();
   for(const g of goals){const k=g.name.toLowerCase();const old=byName.get(k);byName.set(k,{name:old?.name??g.name,count:(old?.count??0)+g.count});}
   const normalized=[...byName.values()].sort((a,b)=>a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
   const key=hit.fixtureId+'|'+date;
   const candidate={competition:'faCup2627',fixtureId:hit.fixtureId,date,home:f.home,away:f.away,homeScore:f.homeScore,awayScore:f.awayScore,goals:normalized.map(g=>({...g,side:normalizeTeam(f.home)===CHI?'home':'away'})),source:hit.source};
   const group=groups.get(key)??[];group.push(candidate);groups.set(key,group);
  }
 }
 for(const [key,g] of groups){
  const sig=x=>JSON.stringify(x.goals.map(y=>[y.name.toLowerCase(),y.count,y.side]));
  if(g.some(x=>sig(x)!==sig(g[0]))){held.push({key,reason:'conflicting_scorer_reports'});continue;}
  proposals.push({...g[0],approvalKey:'cup:'+key,dispatchType:'cup-scorer-proposal-approved'});
 }
 return {proposals,held};
}
