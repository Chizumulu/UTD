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
