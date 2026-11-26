import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {selectNewLineups,discoverLineups,PREFIX} from './discover.mjs';
import {matchFixture,validateCandidates,planLineup} from './plan-lineup.mjs';
import {applyApprovedLineup} from './apply-lineup.mjs';

const source=await readFile(new URL('../../data.js',import.meta.url),'utf8');
const data=runInNewContext(source+'\n;({roundsData,scheduledRounds,squadData,matchLineups,cupTournaments,cupMatchLineups})',{}, {timeout:3000});
const club='Chizumulu United FC';
const fixture=Object.entries(data.scheduledRounds).flatMap(([round,rows])=>rows.map(f=>({round,f}))).find(({round,f})=>f.fixtureId&&f.kickoffDate&&!f.postponed&&!f.forfeit&&f.homeScore==null&&f.awayScore==null&&[f.homeEn,f.awayEn].includes(club)&&!data.matchLineups[round]?.starters?.length);
assert.ok(fixture,'A scheduled UTD fixture without recorded lineup is required');
const {f,round}=fixture;
const date=new Date(f.kickoffDate+'T12:00:00Z');
const opponent=f.homeEn===club?f.awayKo:f.homeKo;
const post={id:'18000000000000123',caption:'#STARTING_XI NRFA League One\n'+(date.getUTCMonth()+1)+'월 '+date.getUTCDate()+'일\n🆚 '+opponent,timestamp:date.toISOString(),media_type:'IMAGE',permalink:'https://www.instagram.com/p/testfixture/'};
const now=date.getTime()+60000,cutoff=now-120000;
const squad=data.squadData.filter(p=>Number.isInteger(p.number)&&p.number>0&&p.number<100&&p.nameKo);
const roster=squad.filter((p,i)=>squad.findIndex(q=>q.number===p.number)===i).slice(0,14);
assert.equal(roster.length,14);
const slot=p=>({votes:{[p.number]:3},names:[p.nameKo]});
const card={layout:'fixture-test',starters:roster.slice(0,11).map(slot),bench:roster.slice(11).map(slot),captain:null};
const ocr={status:'candidates',candidates:[card]};
test('new posts only; duplicate IDs, old posts and unrelated posts excluded',()=>{
 const older={...post,id:'18000000000000124',timestamp:new Date(cutoff).toISOString()};
 const unrelated={...post,id:'18000000000000125',caption:'Other post'};
 assert.deepEqual(selectNewLineups([post,post,older,unrelated],cutoff,now).map(p=>p.id),[post.id]);
 assert.throws(()=>selectNewLineups([post],NaN,now));
});
test('KV baseline and repeat scans do not duplicate pending posts',async()=>{
 const memory=new Map();
 const env={INSTAGRAM_LINEUP_ENABLED:'true',UTD_INSTAGRAM_TOKEN:'fake-token',APPROVALS:{get:async k=>memory.get(k)??null,put:async(k,v)=>memory.set(k,v)}};
 const fetcher=async()=>Response.json({business_discovery:{username:'chizumuluutd',media:{data:[post]}}});
 const first=await discoverLineups(env,{now:cutoff,fetcher});
 assert.equal(first.initialized,true);
 assert.equal(memory.has(PREFIX+'pending:'+post.id),false);
 assert.equal((await discoverLineups(env,{now,fetcher})).queued,1);
 assert.equal((await discoverLineups(env,{now,fetcher})).queued,0);
});
test('league fixture match and wrong opponent rejected',()=>{
 assert.equal(matchFixture(data,post).round,round);
 assert.throws(()=>matchFixture(data,{...post,caption:post.caption.replace(opponent,'Unknown opponent')}));
});
test('FA Cup match requires unique dated fixture',()=>{
 const c={id:'faCup2627',rounds:[{matches:[{id:'cup-test',home:club,homeKo:'치주물루',away:'Test FC',awayKo:'테스트 FC',date:f.kickoffDate}]}]};
 const p={...post,caption:'#STARTING_XI FA컵\n'+(date.getUTCMonth()+1)+'월 '+date.getUTCDate()+'일\n🆚 테스트 FC'};
 assert.equal(matchFixture({...data,cupTournaments:[c]},p).fixtureId,'cup-test');
 c.rounds[0].matches.push({...c.rounds[0].matches[0]});
 assert.throws(()=>matchFixture({...data,cupTournaments:[c]},p));
});
test('OCR candidate requires 11 starters, corroboration and unique numbers',()=>{
 assert.equal(validateCandidates(ocr,data.squadData).starters.length,11);
 assert.throws(()=>validateCandidates({status:'review_required'},data.squadData));
 assert.throws(()=>validateCandidates({...ocr,candidates:[{...card,bench:[card.starters[0]]}]},data.squadData));
});
test('approved announcement preserves historical data and is idempotent',()=>{
 const proposal=planLineup(source,post,ocr);
 assert.throws(()=>applyApprovedLineup(source,proposal));
 const approved={...proposal,state:'approved',approvedAt:new Date(now).toISOString()};
 const patched=applyApprovedLineup(source,approved);
 assert.ok(patched.startsWith(source.trimEnd()));
 const after=runInNewContext(patched+'\n;({matchLineups,cupMatchLineups,announcedMatchLineups})',{}, {timeout:3000});
 assert.equal(JSON.stringify(after.matchLineups),JSON.stringify(data.matchLineups));
 assert.equal(JSON.stringify(after.cupMatchLineups),JSON.stringify(data.cupMatchLineups));
 assert.equal(Object.values(after.announcedMatchLineups)[0].starters.length,11);
 assert.equal(applyApprovedLineup(patched,approved),patched);
});

test('jamo OCR matching corrects small errors but rejects ambiguous or unsupported names',async()=>{
 const {resolveProductionSlot:resolve}=await import('./resolve-production.mjs');
 const players=[{number:11,nameKo:'해리 바튼'},{number:99,nameKo:'패트릭 지야'},{number:90,nameKo:'마야미코 치우시와'},{number:80,nameKo:'다니엘 스쿠카'}];
 assert.equal(resolve({votes:{1:3},names:['애리 바튼']},players).number,11);
 assert.equal(resolve({votes:{9:4},names:['패트릭 지야']},players).number,99);
 assert.equal(resolve({votes:{30:2},names:['마야미코 치우시와']},players).number,90);
 assert.equal(resolve({votes:{80:6},names:['80. 다니엘 스쿠카']},players).number,80);
 assert.equal(resolve({votes:{80:6},names:['무관한 이름']},players).number,null);
 assert.equal(resolve({votes:{},names:['해리 바튼']},players).number,null);
 assert.equal(resolve({votes:{11:3},names:['해리 바튼']},[...players,{number:12,nameKo:'해리 바튼'}]).number,null);
});

test('additional OCR evidence handles weak digits without accepting unrelated names',async()=>{
 const {resolveProductionSlot:resolve}=await import('./resolve-production.mjs');
 const players=[{number:49,nameKo:'굽부카니 바냐'},{number:4,nameKo:'켈빈 반다'},{number:9,nameKo:'제임스 헤르메스'},{number:80,nameKo:'다니엘 스쿠카'}];
 assert.equal(resolve({votes:{8:6,49:1},names:['굽부카니 바냐']},players).number,49);
 assert.equal(resolve({votes:{},names:['| 4. 켈빈 반다']},players).number,4);
 assert.equal(resolve({votes:{},names:['제임스 헤르메스']},players).number,null);
 assert.equal(resolve({votes:{49:6},names:['무관한 이름']},players).number,null);
});

test('fallback handles exact names, near names and combined digit evidence without changing primary matches',async()=>{
 const {resolveProductionSlot,resolveFallbackSlot}=await import('./resolve-production.mjs');
 const players=[{number:11,nameKo:'해리 바튼'},{number:99,nameKo:'패트릭 지야'},{number:90,nameKo:'마야미코 치우시와'},{number:66,nameKo:'조던 칠와'},{number:9,nameKo:'제임스 헤르메스'},{number:6,nameKo:'벤자민 니렌다'}];
 assert.equal(resolveProductionSlot({votes:{3:2,8:1},names:['패트릭 지야']},players).number,null);
 assert.equal(resolveFallbackSlot({votes:{3:2,8:1},names:['패트릭 지야']},players).number,99);
 assert.equal(resolveFallbackSlot({votes:{1:2,4:1},names:['애리 바튼']},players).number,11);
 assert.equal(resolveFallbackSlot({votes:{},names:['제임스 헤르메스']},players).number,9);
 assert.equal(resolveFallbackSlot({votes:{66:5,6:2},names:['소년 원와','소년 열와']},players).number,66);
 assert.equal(resolveFallbackSlot({votes:{66:5},names:['']},players).number,null);
 assert.equal(resolveFallbackSlot({votes:{11:3},names:['해리 바튼']},[...players,{number:12,nameKo:'해리 바튼'}]).number,null);
 assert.deepEqual(validateCandidates(ocr,data.squadData).reviewMatches,[]);
});

test('WhatsApp lineup message marks fallback players in both approval stages and rejects inconsistent metadata',async()=>{
 const {lineupMessageValues,validateReviewMatches}=await import('./review-message.mjs');
 const starters=Array.from({length:11},(_,i)=>({number:i+1,nameKo:'선수'+(i+1),pos:'ST'}));
 const bench=[{number:66,nameKo:'조던 칠와'}];
 const p={id:'test',matchDate:'2026-11-27',home:'치주물루',away:'루비리',starters,bench,reviewMatches:[{slot:1,number:2,method:'fallback-near-name',nameSimilarity:0.89,score:0.67},{slot:11,number:66,method:'fallback-combined-evidence',nameSimilarity:0.5,score:0.615}]};
 assert.equal(validateReviewMatches(p),true);
 const first=lineupMessageValues(p,false),second=lineupMessageValues(p,true);
 assert.equal(first.length,4);
 assert.match(first[0],/추정\/보정 2명 확인/);
 assert.match(first[1],/유사 이름 89%/);
 assert.match(first[2],/이름·번호 추정 50%/);
 assert.match(second[0],/^2차 확인/);
 assert.equal(second[1],first[1]);
 assert.equal(second[2],first[2]);
 assert.equal(validateReviewMatches({...p,reviewMatches:[{...p.reviewMatches[0],number:99}]}),false);
 assert.equal(validateReviewMatches({...p,reviewMatches:[p.reviewMatches[0],p.reviewMatches[0]]}),false);
 assert.equal(validateReviewMatches({...p,reviewMatches:[]}),true);
 assert.doesNotMatch(lineupMessageValues({...p,reviewMatches:[]})[1],/⚠/);
});

test('partial OCR permits isolated unknown slots only in production opt-in mode',()=>{
 const broken={...card,bench:[{votes:{},names:[]},...card.bench.slice(1)]};
 const input={status:'candidates',candidates:[broken]};
 assert.throws(()=>validateCandidates(input,data.squadData));
 const partial=validateCandidates(input,data.squadData,{allowPartial:true});
 assert.equal(partial.unresolvedSlots.length,1);
 assert.equal(partial.bench[0].number,null);
 assert.equal(partial.bench[0].unresolved,true);
});
test('manual lineup corrections only fill unknown slots with unique roster numbers',async()=>{
 const {correctLineupSlot,validatePartialLineup,lineupMessageValues}=await import('./review-message.mjs');
 const full=planLineup(source,post,ocr);
 const p={...full,id:'test',bench:[{number:null,nameKo:'미확인',unresolved:true},...full.bench.slice(1)],unresolvedSlots:[{slot:11}],correctionRoster:roster.map(x=>({number:x.number,nameKo:x.nameKo}))};
 assert.equal(validatePartialLineup(p),true);
 assert.match(lineupMessageValues(p)[2],/미확인 \(슬롯 12\)/);
 assert.throws(()=>correctLineupSlot(p,11,p.starters[0].number));
 assert.throws(()=>correctLineupSlot(p,0,roster[11].number));
 assert.throws(()=>applyApprovedLineup(source,{...p,state:'approved',approvedAt:new Date(now).toISOString()}));
 const fixed=correctLineupSlot(p,11,roster[11].number);
 assert.equal(fixed.unresolvedSlots.length,0);
 assert.equal(fixed.bench[0].number,roster[11].number);
 assert.equal(fixed.state,'held');
 assert.doesNotMatch(lineupMessageValues(fixed)[2],/미확인/);
 assert.ok(applyApprovedLineup(source,{...fixed,state:'approved',approvedAt:new Date(now).toISOString()}).includes('announcedMatchLineups'));
});
