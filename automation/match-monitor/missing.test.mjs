import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kickoff,leagueFixtures,cupFixtures,candidates,classify,scanMissingMatches} from './missing.mjs';
const H=3600000, t=kickoff('2026-11-29','15:00');
const f={competition:'nrfa_league_one',id:'f1',home:"M'mbelwa Warriors FC",away:'Mafu Stars FC',date:'2026-11-29',time:'15:00'};
test('Malawi kickoff and invalid dates',()=>{
 assert.equal(new Date(t).toISOString(),'2026-11-29T13:00:00.000Z');
 assert.ok(Number.isNaN(kickoff('2026-02-30','15:00')));
});
test('thresholds, exclusions, historic and scored fixtures',()=>{
 for(const h of [4,12,24])assert.equal(candidates([f],t+h*H,t)[0].stage,h);
 assert.equal(candidates([f],t+3*H,t).length,0);
 assert.equal(candidates([f],t+4*H,t+1).length,0);
 assert.equal(candidates([{...f,excluded:true}],t+4*H,t).length,0);
 assert.equal(candidates([f,{...f,homeScore:0,awayScore:0}],t+4*H,t).length,0);
});
test('parse actual league style and cup fixtures',()=>{
 const src='const roundsData = {\n round1: []\n};\nconst scheduledRounds = {\n round2: [{fixtureId:"f1",homeEn:"M\'mbelwa Warriors FC",awayEn:"Mafu Stars FC",kickoffDate:"2026-11-29",kickoffTime:"15:00"}]\n};';
 assert.equal(leagueFixtures(src)[0].home,f.home);
 assert.equal(cupFixtures({id:'faCup2627',rounds:[{matches:[{home:'A',away:'B'}]}]})[0].id,'round:0:match:0');
});
test('classify missing, postponed and pending approval',async()=>{
 const kv={get:async k=>k==='match:id:abc'?'p':k==='proposal:p'?'{"state":"pending"}':null};
 const m={homeTeam:f.home,awayTeam:'Mafu FC',dateText:'SUN-29-11-2026',matchId:'abc',homeScore:1,awayScore:0};
 const items=status=>[{structured:{competition:{code:'nrfa_league_one'},matches:[{...m,status}]}}];
 assert.match(await classify(f,[],kv),/미확인/);
 assert.equal(await classify(f,items('postponed'),kv),null);
 assert.match(await classify(f,items('full_time'),kv),/승인/);
});
test('disabled by default and no network calls',async()=>{
 await scanMissingMatches({}, {fetcher:()=>{throw Error('unexpected fetch');}});
});
