import {runInNewContext} from 'node:vm';
import {resolveProductionSlot,resolveFallbackSlot} from './resolve-production.mjs';
const key=v=>String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'').replace(/fc$/,'').replace('라이플라이','라이플리');
const club=key('Chizumulu United FC');
const positions=['ST','LW','CAM','RW','LCM','RCM','LB','LCB','RCB','RB','GK'];
export function matchFixture(data,post){
 const caption=String(post.caption??'');
 if(!/#STARTING_XI\b/i.test(caption))throw Error('Not a lineup caption');
 const date=/(\d{1,2})월\s*(\d{1,2})일/.exec(caption);
 const opponent=/🆚\uFE0F?\s*([^\r\n]+)/u.exec(caption);
 const published=new Date(post.timestamp);
 if(!date||!opponent||!Number.isFinite(published.getTime()))throw Error('Missing match identifiers');
 const local=new Date(published.getTime()+2*3600000);
 const dates=[local.getUTCFullYear()-1,local.getUTCFullYear(),local.getUTCFullYear()+1].map(y=>y+'-'+date[1].padStart(2,'0')+'-'+date[2].padStart(2,'0')).filter(d=>Math.abs(Date.parse(d+'T12:00:00Z')-published.getTime())<=3*86400000);
 const isCup=/presidential\s*fa\s*cup|대통령배|FA\s*컵/i.test(caption);
 const isLeague=/NRFA\s*(?:리그\s*원|League\s*One|League\s*1)|NRFA\s*리그\s*1/i.test(caption);
 if(isCup===isLeague)throw Error('Ambiguous competition');
 const hits=[];
 function inspect(f,meta,h,a,hko,ako,date){
  if(f.forfeit||f.postponed||f.cancelled||f.movedToWeek!=null||['postponed','cancelled'].includes(f.status)||!dates.includes(date))return;
  const other=key(h)===club?[a,ako]:key(a)===club?[h,hko]:null;
  if(!other||!other.some(n=>key(n)===key(opponent[1])))return;
  hits.push({...meta,matchDate:date,home:h,away:a,opponentKo:other[1]});
 }
 if(isLeague){
  for(const [section,rounds] of Object.entries({roundsData:data.roundsData,scheduledRounds:data.scheduledRounds}))
   for(const [round,fixtures] of Object.entries(rounds??{}))for(const f of fixtures)inspect(f,{competition:'league',section,round,fixtureId:f.fixtureId},f.homeEn,f.awayEn,f.homeKo,f.awayKo,f.kickoffDate);
 }else{
  const cup=data.cupTournaments?.find(c=>c.id==='faCup2627');
  for(const [ri,r] of (cup?.rounds??[]).entries())for(const [mi,f] of (r.matches??[]).entries())inspect(f,{competition:'faCup2627',fixtureId:f.id??'round:'+ri+':match:'+mi,roundIndex:ri,matchIndex:mi},f.home,f.away,f.homeKo,f.awayKo,f.date);
 }
 if(hits.length!==1)throw Error('Expected one matching fixture, found '+hits.length);
 return hits[0];
}
export function validateCandidates(ocr,squad,{allowFallback=true,allowPartial=false}={}){
 if(ocr?.status!=='candidates'||!Array.isArray(ocr.candidates))throw Error('OCR requires manual review');
 const valid=[];
 const fallbackValid=[];
 const partial=[];
 const accepted=new Set(['name-and-number','jamo-and-number','name-supported-digit-correction','inline-number-and-name','name-supported-low-vote','dominant-number-and-name']);
 for(const c of ocr.candidates){
  if(!Array.isArray(c.starters)||c.starters.length!==11||!Array.isArray(c.bench)||!c.bench.length||c.bench.length>12)continue;
  const slots=[...c.starters,...c.bench];
  let resolved=slots.map((slot,i)=>{
   const own=resolveProductionSlot(slot,squad);
   if(accepted.has(own.method)||i>=11||own.candidate==null)return own;
   // Only combine evidence for the same formation slot and same name candidate.
   // Use maximum vote counts, not sums of correlated image crops.
   const merged={votes:{...slot.votes},names:[...slot.names]};
   for(const alternate of ocr.candidates){
    const peer=alternate.starters?.[i];
    if(!peer||alternate.starters.length!==11)continue;
    const match=resolveProductionSlot(peer,squad);
    if((match.number??match.candidate)!==own.candidate)continue;
    for(const [n,count] of Object.entries(peer.votes??{}))merged.votes[n]=Math.max(merged.votes[n]??0,count);
    merged.names.push(...(peer.names??[]));
   }
   const combined=resolveProductionSlot(merged,squad);
   return combined.number===own.candidate?combined:own;
  });
  const primaryComplete=resolved.every(r=>accepted.has(r.method));
  if(!primaryComplete){
   if(!allowFallback)continue;
   resolved=resolved.map((r,i)=>accepted.has(r.method)?r:resolveFallbackSlot(slots[i],squad));

  }
  if(resolved.some(r=>r.number==null)){
   if(!allowPartial)continue;
   const known=resolved.filter(r=>r.number!=null);
   if(known.length<resolved.length-3||known.length<11||new Set(known.map(r=>r.number)).size!==known.length)continue;
   const players=resolved.map((r,i)=>{const p=squad.find(p=>p.number===r.number);return {...(p?{number:p.number,nameKo:p.nameKo}:{number:null,nameKo:'미확인',unresolved:true}),...(i<11?{pos:positions[i]}:{})};});
   partial.push({formation:'4-2-3-1',layout:c.layout,starters:players.slice(0,11),bench:players.slice(11),reviewMatches:resolved.flatMap((r,i)=>r.review?[{slot:i,number:r.number,method:r.method,nameSimilarity:1-r.distance,score:r.score}]:[]),unresolvedSlots:resolved.flatMap((r,i)=>r.number==null?[{slot:i}]:[])});
   continue;
  }
  const reviewMatches=resolved.flatMap((r,i)=>r.review?[{slot:i,number:r.number,method:r.method,nameSimilarity:1-r.distance,score:r.score}]:[]);
  if(new Set(resolved.map(r=>r.number)).size!==resolved.length)continue;
  const players=resolved.map(r=>squad.find(p=>p.number===r.number));
  if(players.some(p=>!p||!p.nameKo))continue;
  if(c.captain!=null&&!players.slice(0,11).some(p=>p.number===c.captain))continue;
  (primaryComplete?valid:fallbackValid).push({reviewMatches,formation:'4-2-3-1',starters:players.slice(0,11).map((p,i)=>({number:p.number,nameKo:p.nameKo,pos:positions[i],...(p.number===c.captain?{captain:true}:{})})),bench:players.slice(11).map(p=>({number:p.number,nameKo:p.nameKo})),layout:c.layout});
 }
 if(!valid.length&&fallbackValid.length){
  const min=Math.min(...fallbackValid.map(v=>v.reviewMatches.length));
  valid.push(...fallbackValid.filter(v=>v.reviewMatches.length===min));
 }
 if(!valid.length&&allowPartial&&partial.length){
  const min=Math.min(...partial.map(p=>p.unresolvedSlots.length));
  const best=partial.filter(p=>p.unresolvedSlots.length===min);
  const sig=p=>JSON.stringify([p.starters,p.bench,p.unresolvedSlots]);
  if(best.every(p=>sig(p)===sig(best[0])))return best[0];
  throw Error('Conflicting partial OCR layouts require manual lineup entry');
 }
 if(!valid.length)throw Error('No fully corroborated OCR candidate');
 const signature=v=>JSON.stringify([v.starters,v.bench.map(p=>p.number).sort((a,b)=>a-b)]);
 if(valid.some(v=>signature(v)!==signature(valid[0])))throw Error('Conflicting OCR layouts');
 return valid[0];
}
export function planLineup(source,post,ocr){
 if(!/^\d{5,30}$/.test(String(post.id)))throw Error('Invalid Instagram post ID');
 const data=runInNewContext(source+'\n;({roundsData,scheduledRounds,squadData,matchLineups,cupTournaments})',{}, {timeout:3000});
 const fixture=matchFixture(data,post);
 if(fixture.competition==='league'&&data.matchLineups[fixture.round]?.starters?.length)throw Error('Existing lineup requires manual review');
 const lineup=validateCandidates(ocr,data.squadData,{allowPartial:true});
 if(lineup.unresolvedSlots?.length)lineup.correctionRoster=data.squadData.filter(p=>Number.isInteger(p.number)&&p.number>0&&p.number<100&&typeof p.nameKo==='string').map(p=>({number:p.number,nameKo:p.nameKo}));
 return {...fixture,...lineup,kind:'lineup',postId:post.id,source:post.permalink,needsReview:true};
}
