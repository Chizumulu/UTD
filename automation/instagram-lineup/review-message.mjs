// Keep the existing four WhatsApp template variables and three buttons.
export function validateReviewMatches(p){
 const matches=p.reviewMatches??[];
 const players=[...p.starters,...p.bench];
 if(!Array.isArray(matches)||matches.length>players.length)return false;
 const seen=new Set();
 for(const m of matches){
  if(!m||!Number.isInteger(m.slot)||m.slot<0||m.slot>=players.length||seen.has(m.slot)||players[m.slot].number!==m.number||
   !['fallback-exact-name','fallback-near-name','fallback-combined-evidence'].includes(m.method)||
   !Number.isFinite(m.nameSimilarity)||m.nameSimilarity<0||m.nameSimilarity>1||
   !Number.isFinite(m.score)||m.score<0||m.score>1)return false;
  seen.add(m.slot);
 }
 return true;
}
export function lineupMessageValues(p,confirmation=false){
 if(!validateReviewMatches(p))throw Error('Invalid lineup review metadata');
 const reviews=new Map((p.reviewMatches??[]).map(m=>[m.slot,m]));
 const labels={'fallback-exact-name':'이름 일치·번호 보정','fallback-near-name':'유사 이름','fallback-combined-evidence':'이름·번호 추정'};
 const fmt=(players,offset)=>players.map((x,i)=>{
  const m=reviews.get(i+offset);
  if(x.unresolved)return (x.pos?x.pos+' ':'')+'❓ 미확인 (슬롯 '+(i+offset+1)+')';
  return (x.pos?x.pos+' ':'')+x.number+' '+x.nameKo+(m?' [⚠ '+labels[m.method]+' '+Math.round(m.nameSimilarity*100)+'%]':'');
 }).join(', ');
 return [(confirmation?'2차 확인 · ':'')+p.matchDate+' '+p.home+' vs '+p.away+' (포메이션 확인 필요'+(reviews.size?' · 추정/보정 '+reviews.size+'명 확인':'')+((p.unresolvedSlots??[]).length?' · 미확인 '+p.unresolvedSlots.length+'명: 수정 '+p.id+' 슬롯번호 등번호':'')+')',fmt(p.starters,0),fmt(p.bench,p.starters.length),p.id];
}

export function validatePartialLineup(p){
 const players=[...p.starters,...p.bench],unknown=p.unresolvedSlots??[];
 if(!Array.isArray(unknown)||unknown.length>3)return false;
 const indexes=players.flatMap((x,i)=>x?.unresolved===true?[i]:[]);
 if(indexes.length!==unknown.length||unknown.some((x,i)=>x?.slot!==indexes[i]))return false;
 if(players.some(x=>x?.unresolved&&(x.number!==null||x.nameKo!=='미확인')))return false;
 if(!unknown.length)return true;
 const roster=p.correctionRoster;
 return Array.isArray(roster)&&roster.length>0&&roster.length<=100&&roster.every(x=>Number.isInteger(x.number)&&x.number>0&&x.number<100&&typeof x.nameKo==='string'&&x.nameKo.trim().length>0&&x.nameKo.length<=80);
}
export function correctLineupSlot(p,slot,number){
 if(!validatePartialLineup(p)||!(p.unresolvedSlots??[]).some(x=>x.slot===slot))throw Error('미확인 슬롯만 수정 가능');
 const players=[...p.starters,...p.bench];
 const hits=(p.correctionRoster??[]).filter(x=>x.number===number);
 if(hits.length!==1||players.some(x=>x.number===number))throw Error('선수단 번호가 없거나 중복됨');
 const previous=players[slot];
 players[slot]={number,nameKo:hits[0].nameKo,...(previous.pos?{pos:previous.pos}:{})};
 return {...p,starters:players.slice(0,11),bench:players.slice(11),unresolvedSlots:p.unresolvedSlots.filter(x=>x.slot!==slot),state:'held',needsReview:true};
}
