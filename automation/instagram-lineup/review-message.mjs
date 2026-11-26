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
  return (x.pos?x.pos+' ':'')+x.number+' '+x.nameKo+(m?' [⚠ '+labels[m.method]+' '+Math.round(m.nameSimilarity*100)+'%]':'');
 }).join(', ');
 return [(confirmation?'2차 확인 · ':'')+p.matchDate+' '+p.home+' vs '+p.away+' (포메이션 확인 필요'+(reviews.size?' · 추정/보정 '+reviews.size+'명 확인':'')+')',fmt(p.starters,0),fmt(p.bench,p.starters.length),p.id];
}
