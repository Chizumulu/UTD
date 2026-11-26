import {matchCupItems} from '../cup-sync/match-fixtures.mjs';
import {parseDate} from '../cup-sync/plan-schedule.mjs';
import {detectForfeit} from './detect-forfeit.mjs';
export function planCupForfeits(items,cup){
 const groups=new Map();
 for(const item of items??[])for(const hit of matchCupItems([item],cup).matched){
  const m=hit.match,f=cup.rounds[hit.roundIndex].matches[hit.matchIndex],date=parseDate(m.dateText);
  if(!date||f.date!==date||f.forfeit||!['full_time','finished','ended','forfeit','walkover','awarded'].includes(String(m.status).toLowerCase()))continue;
  const key=hit.fixtureId+'|'+date;
  const group=groups.get(key)??[];
  group.push({hit,f,date,signal:detectForfeit(m,item.latestObservation?.text??'')});
  groups.set(key,group);
 }
 const proposals=[];
 for(const [key,g] of groups){
  const {hit,f,date,signal}=g[0];
  if(!signal||g.some(x=>!x.signal||JSON.stringify(x.hit.bracketScores)!==JSON.stringify(hit.bracketScores)))continue;
  const [homeScore,awayScore]=hit.bracketScores;
  if(!((homeScore===3&&awayScore===0)||(homeScore===0&&awayScore===3)))continue;
  proposals.push({kind:'forfeit',competition:'faCup2627',fixtureId:hit.fixtureId,matchDate:date,home:f.home,away:f.away,homeScore,awayScore,goals:[],needsReview:true,reviewWarnings:['FA컵 3:0 또는 0:3, 득점자 없음 — 공식 몰수 여부 확인 필요'],matchKey:'forfeit:cup:'+key});
 }
 return proposals;
}
