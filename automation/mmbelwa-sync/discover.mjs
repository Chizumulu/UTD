import {readSeoData} from '../../scripts/seo-pages.mjs';
import {normalizeTeam} from '../cup-sync/match-fixtures.mjs';

const norm=value=>String(value??'').normalize('NFKD').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const cupName=value=>/\bmmbelwa cup\b/.test(norm(value));
const otherName=value=>/\bpresidential fa cup\b|\bnrfa (?:division )?league (?:one|two|1|2)\b|\b(?:ci)?nrfaleague(?:one|two)\b|\bnrfadivisionleague2\b/.test(norm(value));
export function classifyCompetition(item,match={}){
 const s=item?.structured??{};
 const fields=[s.competition?.code,match.competitionCode].filter(Boolean);
 const labels=[match.competition,s.competition?.name,item?.latestObservation?.text].filter(Boolean);
 if(s.competition?.conflict||fields.some(otherName)||labels.some(otherName))return 'conflict_or_other';
 // Unknown code is not treated as proof; explicit cup name is discovery evidence only.
 const named=labels.some(cupName)||fields.some(cupName);
 if(!named)return 'not_identified';
 if(fields.some(c=>!cupName(c)&&!['unknown','other','unclassified'].includes(norm(c))))return 'code_requires_review';
 return 'candidate';
}
export function buildRegistry(cup){
 const map=new Map();
 for(const region of cup.regionalQualifiers??[])for(const group of region.groups??[])for(const t of group.teams??[]){
  if(!t.en||!t.ko)throw Error('Invalid registered team');
  for(const name of [t.en,...(t.aliases??[])]){
   const k=normalizeTeam(name);
   if(!k)throw Error('Empty team alias');
   const old=map.get(k)??new Map();
   old.set(t.en,{en:t.en,ko:t.ko});map.set(k,old);
  }
 }
 return map;
}
function resolve(registry,name){
 const hits=registry.get(normalizeTeam(name));
 return hits?.size===1?[...hits.values()][0]:null;
}
export function discover(items,cup){
 if(cup?.id!=='mmbelwaCup'||!Array.isArray(cup.rounds)||!Array.isArray(items))throw Error('Expected Mmbelwa Cup and API items');
 const registry=buildRegistry(cup);
 const candidates=[],seen=new Set(),counts={};
 const count=k=>counts[k]=(counts[k]??0)+1;
 for(const item of items){
  const matches=item?.structured?.matches;
  const list=Array.isArray(matches)&&matches.length?matches:[null];
  for(const m of list){
   const status=classifyCompetition(item,m??{});
   count(status);
   if(!['candidate','code_requires_review'].includes(status))continue;
   const home=m?resolve(registry,m.homeTeam):null,away=m?resolve(registry,m.awayTeam):null;
   const source=String(item.rawUpdateId??'');
   const row={source,competitionCode:String(m?.competitionCode??item.structured?.competition?.code??''),classification:status,round:m?.roundText??null,home:home?.en??null,away:away?.en??null,rawHome:m?.homeTeam??null,rawAway:m?.awayTeam??null,date:m?.dateText??null,time:m?.timeText??null,venue:m?.venue??null,status:m?.status??null,homeScore:m?.homeScore??null,awayScore:m?.awayScore??null,reason:!m?'announcement_requires_review':!home||!away||home.en===away.en?'team_requires_review':!cup.rounds.length?'draw_not_registered':'fixture_requires_review'};
   const key=JSON.stringify(row);
   if(!seen.has(key)){seen.add(key);candidates.push(row);}
  }
 }
 return {mode:'read_only',cupId:cup.id,registeredTeams:new Set([...registry.values()].flatMap(m=>[...m.keys()])).size,registeredRounds:cup.rounds.length,counts,candidates};
}
export function discoverFromSource(source,items){
 const cup=readSeoData(source).cupTournaments.find(c=>c.id==='mmbelwaCup');
 return discover(items,cup);
}
