// OCR matching uses only current roster and image evidence, never historical lineups.
const normalize=v=>String(v??'').normalize('NFKC').replace(/^\s*\d{1,2}\s*[.,:]\s*/,'').replace(/[^\p{L}]/gu,'').toLowerCase();
const jamo=v=>Array.from(v.normalize('NFD'));
function distance(a,b){
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=0;i<a.length;i++){
  const next=[i+1];
  for(let j=0;j<b.length;j++)next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1)));
  row=next;
 }
 return row[b.length];
}
export function resolveProductionSlot(slot,squad){
 const rawNames=slot.names??[];
 const names=[...new Set(rawNames.map(normalize).filter(s=>s.length>=4))];
 const votes=Object.entries(slot.votes??{}).map(([n,count])=>[Number(n),Number(count)]).filter(([n,c])=>Number.isInteger(n)&&n>0&&n<100&&c>0).sort((a,b)=>b[1]-a[1]);
 const candidates=squad.filter(p=>Number.isInteger(p.number)&&p.nameKo).map(p=>{
  let best=Infinity,exact=false;
  for(const ref of [p.nameKo,...(p.aliasesKo??[])].map(normalize).filter(s=>s.length>=4)){
   for(const name of names){
    const a=jamo(name),b=jamo(ref);
    const d=distance(a,b)/Math.max(a.length,b.length);
    if(d<best)best=d;
    if(name===ref)exact=true;
   }
  }
  return {number:p.number,best,exact,votes:votes.find(([n])=>n===p.number)?.[1]??0};
 }).sort((a,b)=>a.best-b.best);
 const best=candidates[0],other=candidates.find(c=>c.number!==best?.number);
 if(!best||!Number.isFinite(best.best)||best.best>0.24||other&&other.best-best.best<0.075)return {number:null,method:'ambiguous-name'};
 const top=votes[0]?.[1]??0;
 const margin=other?other.best-best.best:1;
 // Bench text sometimes includes the printed number in the name crop.
 const inline=rawNames.filter(raw=>{
  const m=String(raw).match(/^\s*[|\[•·ㆍ]*\s*(\d{1,2})\s*[.,:]\s*/);
  if(!m||Number(m[1])!==best.number)return false;
  const name=normalize(String(raw).slice(m[0].length));
  const ref=normalize(squad.find(p=>p.number===best.number)?.nameKo);
  return name.length>=4&&distance(jamo(name),jamo(ref))/Math.max(jamo(name).length,jamo(ref).length)<=0.15;
 });
 if(inline.length&&margin>=0.12&&(best.exact||best.votes>=1||new Set(inline).size>=2))
  return {number:best.number,method:'inline-number-and-name',distance:best.best};
 if(best.votes>=1&&margin>=0.15&&(best.exact||best.best<=0.16&&String(best.number).length===2&&votes.some(([n])=>n!==best.number&&String(n).length===2&&distance(Array.from(String(n)),Array.from(String(best.number)))===1)))
  return {number:best.number,method:'name-supported-low-vote',distance:best.best};
 if(best.votes>=5&&best.votes===top&&best.best<=0.24&&margin>=0.12)
  return {number:best.number,method:'dominant-number-and-name',distance:best.best};
 if(best.votes>=2&&best.votes>=top*0.45&&best.best<=0.20)return {number:best.number,method:best.exact?'name-and-number':'jamo-and-number',distance:best.best};
 // Only correct one missing or substituted digit if the name is unambiguous.
 const target=String(best.number);
 const nearDigits=votes.filter(([n])=>distance(Array.from(String(n)),Array.from(target))===1);
 const nearVotes=nearDigits.reduce((sum,[,c])=>sum+c,0);
 // A repeated jersey digit can collapse into one character during OCR.
 const repeatedDigit=target.length===2&&target[0]===target[1]&&votes.length===1&&String(votes[0][0])===target[0]&&votes[0][1]>=3;
 const correctionLimit=repeatedDigit?0.15:0.09;
 if(target.length===2&&nearVotes>=2&&best.best<=correctionLimit&&(!other||other.best-best.best>=0.15)&&!votes.some(([n,c])=>n!==best.number&&c>nearVotes))
  return {number:best.number,method:'name-supported-digit-correction',distance:best.best};
 return {number:null,method:'insufficient-cross-evidence',candidate:best.number,distance:best.best};
}

// Fallback only: never overrides an accepted primary match.
export function resolveFallbackSlot(slot,squad){
 const names=[...new Set((slot.names??[]).map(normalize).filter(n=>n.length>=4))];
 const votes=Object.entries(slot.votes??{}).map(([n,c])=>[Number(n),Number(c)]).filter(([n,c])=>Number.isInteger(n)&&n>0&&n<100&&c>0);
 const total=votes.reduce((s,[,c])=>s+c,0);
 const candidates=squad.filter(p=>Number.isInteger(p.number)&&p.nameKo).map(p=>{
  const ref=jamo(normalize(p.nameKo));
  const similarity=Math.max(0,...names.map(n=>1-distance(jamo(n),ref)/Math.max(jamo(n).length,ref.length)));
  const exact=votes.find(([n])=>n===p.number)?.[1]??0;
  const near=votes.filter(([n])=>distance(Array.from(String(n)),Array.from(String(p.number)))===1).reduce((s,[,c])=>s+c,0);
  const numberScore=total?(exact+0.4*near)/total:0;
  return {number:p.number,similarity,exact,numberScore,score:0.65*similarity+0.35*numberScore};
 });
 const byName=[...candidates].sort((a,b)=>b.similarity-a.similarity);
 const first=byName[0],second=byName[1];
 const margin=first?first.similarity-(second?.similarity??0):0;
 const result=(p,method)=>({number:p.number,method,distance:1-p.similarity,score:p.score,review:true});
 if(first&&first.similarity===1&&margin>=0.10)return result(first,'fallback-exact-name');
 if(first&&first.similarity>=0.85&&margin>=0.15)return result(first,'fallback-near-name');
 const ranked=[...candidates].sort((a,b)=>b.score-a.score);
 const p=ranked[0],next=ranked[1];
 if(p&&p.similarity>=0.45&&p.exact>=3&&p.numberScore>=0.65&&p.score>=0.57&&p.score-(next?.score??0)>=0.10&&!byName.some(q=>q.number!==p.number&&q.similarity>=0.85))
  return result(p,'fallback-combined-evidence');
 return {number:null,method:'fallback-manual-review',candidate:p?.number??null,score:p?.score??0};
}
