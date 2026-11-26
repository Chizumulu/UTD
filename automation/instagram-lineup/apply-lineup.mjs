import {runInNewContext} from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const readData=source=>runInNewContext(source+'\n;({roundsData,scheduledRounds,squadData,matchLineups,cupTournaments,cupMatchLineups})',{}, {timeout:3000});
const positions=['ST','LW','CAM','RW','LCM','RCM','LB','LCB','RCB','RB','GK'];
export function applyApprovedLineup(source,p){
 if(p?.kind!=='lineup'||p.state!=='approved'||!Number.isFinite(Date.parse(p.approvedAt))||!/^\d{5,30}$/.test(String(p.postId)))throw Error('Approved lineup required');
 if((p.unresolvedSlots??[]).length||[...(p.starters??[]),...(p.bench??[])].some(x=>x?.unresolved||x?.number==null))throw Error('Unresolved lineup cannot be applied');
 const d=readData(source);
 const norm=s=>String(s??'').normalize('NFKC').trim().toLowerCase();
 const matches=(f,h,a,date)=>norm(h)===norm(p.home)&&norm(a)===norm(p.away)&&date===p.matchDate&&!f.postponed&&!f.cancelled&&!f.forfeit&&!['postponed','cancelled'].includes(f.status);
 let fixture,fixtureKey;
 if(p.competition==='league'){
  const hits=[];
  for(const section of [d.roundsData,d.scheduledRounds])for(const [round,rows] of Object.entries(section))for(const f of rows)if(matches(f,f.homeEn,f.awayEn,f.kickoffDate)&&f.fixtureId===p.fixtureId)hits.push({round,f});
  if(hits.length!==1||hits[0].round!==p.round)throw Error('League fixture changed or ambiguous');
  fixture=hits[0].f;fixtureKey='league:'+p.round+':'+p.fixtureId;
  if(d.matchLineups[p.round]?.starters?.length)throw Error('Existing recorded league lineup; manual reconciliation required');
 }else if(p.competition==='faCup2627'){
  const cup=d.cupTournaments.find(c=>c.id===p.competition);
  const hits=[];
  for(const [ri,r] of (cup?.rounds??[]).entries())for(const [mi,f] of (r.matches??[]).entries())if(matches(f,f.home,f.away,f.date)&&(f.id??'round:'+ri+':match:'+mi)===p.fixtureId)hits.push(f);
  if(hits.length!==1)throw Error('Cup fixture changed or ambiguous');
  fixture=hits[0];fixtureKey=p.competition+':'+p.fixtureId;
 }else throw Error('Unsupported competition');
 if(![p.home,p.away].includes('Chizumulu United FC'))throw Error('Not a UTD fixture');
 if(p.formation!=='4-2-3-1'||!Array.isArray(p.starters)||p.starters.length!==11||!Array.isArray(p.bench)||!p.bench.length||p.bench.length>12)throw Error('Invalid lineup shape');
 if(p.starters.some((x,i)=>x.pos!==positions[i]))throw Error('Unexpected position ordering');
 const players=[...p.starters,...p.bench];
 if(new Set(players.map(x=>x.number)).size!==players.length||players.some(x=>!d.squadData.some(y=>y.number===x.number&&norm(y.nameKo)===norm(x.nameKo))))throw Error('Roster conflict');
 const declaration='const announcedMatchLineups = ';
 const existing=source.includes(declaration)?runInNewContext(source+'\n;announcedMatchLineups',{}, {timeout:3000}):{};
 if(existing[fixtureKey]){
  if(existing[fixtureKey].postId===p.postId)return source;
  throw Error('Announced lineup already exists; manual reconciliation required');
 }
 if(Object.values(existing).some(x=>x.postId===p.postId))throw Error('Post already assigned to another fixture');
 const row={competition:p.competition,fixtureId:p.fixtureId,round:p.round??null,date:p.matchDate,home:p.home,away:p.away,formation:p.formation,starters:p.starters.map(x=>({number:x.number,nameKo:x.nameKo,pos:x.pos,...(x.captain===true?{captain:true}:{})})),bench:p.bench.map(x=>({number:x.number,nameKo:x.nameKo})),postId:p.postId,approvedAt:p.approvedAt};
 // Announcements must not populate appearance statistics or subsUnused before kickoff.
 // Append an isolated data block; never rewrite existing data or historical match records.
 const start='// BEGIN AUTOMATED ANNOUNCED LINEUPS',end='// END AUTOMATED ANNOUNCED LINEUPS';
 const block=start+'\n'+declaration+JSON.stringify({...existing,[fixtureKey]:row},null,2)+';\n'+end;
 let next;
 if(source.includes(start)||source.includes(end)){
  const a=source.indexOf(start),b=source.indexOf(end);
  if(a<0||b<a||source.indexOf(start,a+1)!==-1||source.indexOf(end,b+1)!==-1)throw Error('Invalid announcement block');
  next=source.slice(0,a)+block+source.slice(b+end.length);
 }else{
  if(source.includes(declaration))throw Error('Unmanaged announcement declaration');
  next=source.trimEnd()+'\n\n'+block+'\n';
 }
 readData(next);
 return next;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const source=await readFile('data.js','utf8');
 const p=JSON.parse(await readFile(process.argv[2],'utf8'));
 const next=applyApprovedLineup(source,p);
 if(next!==source)await writeFile('data.js',next);
}
