import {matchCupItems,normalizeTeam} from './match-fixtures.mjs';
export function parseDate(value){
 const s=String(value??'').trim();
 const m=s.match(/^(?:[a-z]{3,9}[, ]+)?(\d{1,2})[-/ ](\d{1,2}|[a-z]{3,9})[-/ ,]+(\d{4})$/i);
 const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m&&!iso)return null;
 const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 const y=Number(iso?iso[1]:m[3]), d=Number(iso?iso[3]:m[1]), mo=iso?Number(iso[2]):(/^\d+$/.test(m[2])?Number(m[2]):months.indexOf(m[2].slice(0,3).toLowerCase())+1);
 const date=new Date(Date.UTC(y,mo-1,d));
 if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)return null;
 const out=date.toISOString().slice(0,10);
 return out>='2026-11-28'&&out<='2027-03-20'?out:null;
}
export function parseTime(value){
 const m=String(value??'').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
 if(!m)return null;
 let h=Number(m[1]);const min=Number(m[2]), ap=m[3]?.toLowerCase();
 if(min>59||(ap?(h<1||h>12):h>23))return null;
 if(ap)h=h%12+(ap==='pm'?12:0);
 return String(h).padStart(2,'0')+':'+m[2];
}
const venueKey=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function classifyVenue(fixture,venue,registry={}){
 const chi='chizumulu united', teams=[normalizeTeam(fixture.home),normalizeTeam(fixture.away)];
 if(!teams.includes(chi))return null;
 const v=venueKey(venue), opp=teams.find(t=>t!==chi);
 if(!v)return 'unknown';
 const own=(registry[chi]??['Chiteko Community Ground']).map(venueKey);
 const other=[...(registry[opp]??[]),...(opp==='chilumba barracks'?['Majaliro Ground','Chisumbu Ground']:[])].map(venueKey);
 if(own.includes(v)&&other.includes(v))return 'unknown';
 if(own.includes(v))return 'home';
 if(other.includes(v))return 'away';
 if((registry.neutral??[]).map(venueKey).includes(v))return 'neutral';
 return 'unknown';
}
export function planSchedule(items,cup,registry={},now=Date.now()){
 const {matched,skipped}=matchCupItems(items,cup);
 const proposals=[], held=[...skipped], groups=new Map();
 for(const hit of matched){
  const m=hit.match;
  if(m.status!=='scheduled'){held.push({source:hit.source,reason:'not_scheduled'});continue;}
  const date=parseDate(m.dateText),time=parseTime(m.timeText),venue=String(m.venue??'').trim();
  if(!date|| (m.timeText&&!time)){held.push({source:hit.source,reason:'invalid_schedule'});continue;}
  const fields={date,...(time?{time}:{}),...(venue?{venueEn:venue}:{})};
  const f=cup.rounds[hit.roundIndex].matches[hit.matchIndex];
  if(f.homeScore!=null||f.awayScore!=null||f.forfeit||/^(finished|full_time|ended|completed|ft|forfeit)$/i.test(f.status??'')){held.push({source:hit.source,reason:'fixture_already_completed'});continue;}
  const type=venue?classifyVenue(f,venue,registry):null;
  if(type!==null)fields.venueType=type;
  const group=groups.get(hit.fixtureId)??[];
  const item=items.find(i=>i.rawUpdateId===hit.source);
  const published=Date.parse(item?.sourceTimestamp);
  const raw=item?.latestObservation?.text??'';
  const notice=(item?.structured?.facts??[]).filter(x=>x.type==='notice'&&x.data?.notice_type==='schedule_change').map(x=>x.data).filter(x=>{
   const pair=String(x.subject??'').match(/^(.*?)\s+vs\.?\s+(.*?)(?:\s+fixture)?$/i);
   return pair&&[normalizeTeam(pair[1]),normalizeTeam(pair[2])].sort().join('|')===[normalizeTeam(f.home),normalizeTeam(f.away)].sort().join('|');
  });
  const previous=notice.length===1?parseDate(notice[0].old_value):null;
  const authorized=Number.isFinite(published)&&published<=now&&now-published<=172800000&&/fixture\s+(?:re\s*[-–]?\s*schedul\w*|change)/i.test(raw)&&previous===f.date&&previous!==date&&parseDate(notice[0]?.new_value)===date&&date>=new Date(now+7200000).toISOString().slice(0,10);
  group.push({hit,fields,f,authorized});groups.set(hit.fixtureId,group);
 }
 for(const [fixtureId,group] of groups){
  const fields={};let conflict=false;
  for(const g of group)for(const [k,v] of Object.entries(g.fields)){
   if(k in fields&&fields[k]!==v)conflict=true;
   fields[k]=v;
  }
  const f=group[0].f;
  const authorized=!conflict&&group.every(g=>g.authorized);
  if(conflict||Object.entries(fields).some(([k,v])=>f[k]!=null&&f[k]!==''&&f[k]!==v&&!(authorized&&k==='date'))){held.push({fixtureId,reason:'conflicting_schedule_requires_review'});continue;}
  const changes=Object.fromEntries(Object.entries(fields).filter(([k,v])=>f[k]!==v));
  if(Object.keys(changes).length)proposals.push({fixtureId,roundIndex:group[0].hit.roundIndex,matchIndex:group[0].hit.matchIndex,changes,authorizedDateChange:authorized,previousDate:f.date,sources:group.map(g=>g.hit.source)});
 }
 return {proposals,held};
}
