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
 const names=[...new Set((slot.names??[]).map(normalize).filter(s=>s.length>=4))];
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
