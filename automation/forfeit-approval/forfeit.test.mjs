import test from 'node:test';
import assert from 'node:assert/strict';
import {detectForfeit} from './detect-forfeit.mjs';
import {applyForfeit} from './apply-forfeit.mjs';
const result={status:'finished',homeScore:3,awayScore:0,events:[]};
test('terminal 3-0 and 0-3 without scorers are review candidates',()=>{
 assert.equal(detectForfeit(result).winnerSide,'home');
 assert.equal(detectForfeit({...result,homeScore:0,awayScore:3}).winnerSide,'away');
 assert.equal(detectForfeit(result,'walkover').explicit,true);
});
test('ordinary score, live game, scorer evidence and shootout excluded',()=>{
 for(const m of [{...result,homeScore:2},{...result,status:'live'},{...result,events:[{type:'goal',players:[{role:'scorer',name:'A'}]}]},{...result,scorersHome:'PLAYER A'},{...result,pso:'3:0'}])assert.equal(detectForfeit(m),null);
});
const fixture='const roundsData={}; const scheduledRounds={round1:[{homeEn:"Alpha FC",awayEn:"Beta FC",kickoffDate:"2026-11-29",homeScore:1,awayScore:0,scorersHome:"A"}]};';
const proposal={kind:'forfeit',state:'approved',home:'Alpha FC',away:'Beta FC',matchDate:'2026-11-29',homeScore:3,awayScore:0,goals:[]};
test('approved result updates exactly one fixture and removes scorers',()=>{
 const output=applyForfeit(fixture,proposal);
 assert.match(output,/homeScore:3/);
 assert.match(output,/forfeit: true/);
 assert.match(output,/scorersHome:"없음"/);
 assert.equal(applyForfeit(output,proposal),output);
});
test('reversed orientation is preserved',()=>{
 assert.match(applyForfeit(fixture,{...proposal,home:'Beta FC',away:'Alpha FC'}),/homeScore:0,awayScore:3/);
});
test('unapproved or ambiguous proposals fail closed',()=>{
 assert.throws(()=>applyForfeit(fixture,{...proposal,state:'held'}));
 assert.throws(()=>applyForfeit(fixture,{...proposal,matchDate:'2026-11-30'}));
 assert.throws(()=>applyForfeit(fixture,{...proposal,goals:[{name:'A'}]}));
});
test('completed round correction clears detail records',()=>{
 const source='const roundsData={round1:[{homeEn:"Alpha FC",awayEn:"Beta FC",homeKo:"알파 FC",awayKo:"베타 FC",kickoffDate:"2026-11-29",homeScore:1,awayScore:0}]}; const scheduledRounds={}; const matchDetails={round1:[{match:"알파 1 : 베타 0",scorersHome:"A",scorersAway:"없음"}]};';
 const output=applyForfeit(source,proposal);
 assert.match(output,/알파 3 : 베타 0/);
 assert.match(output,/forfeit: true/);
 assert.doesNotMatch(output,/scorersHome:"A"/);
 assert.equal(applyForfeit(output,proposal),output);
});
