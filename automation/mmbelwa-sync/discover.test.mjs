import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyCompetition,discoverFromSource,discover} from './discover.mjs';
const source=readFileSync('data.js','utf8');
const item=(text,match,code)=>({rawUpdateId:'synthetic-test-only',latestObservation:{text},structured:{competition:{code},matches:match?[match]:[]}});
const match={homeTeam:'Likoma Utd',awayTeam:'Chizumulu United FC',status:'scheduled',dateText:'2026-12-01',timeText:'15:00',venue:'Test Ground'};
test('registered teams and aliases are read from current source without writing',()=>{
 const result=discoverFromSource(source,[item("NRFA M'mbelwa Cup",match)]);
 assert.equal(result.mode,'read_only');
 assert.ok(result.registeredTeams>=47);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].home,'Likoma United FC');
 assert.equal(result.candidates[0].away,'Chizumulu United FC');
 assert.equal(result.candidates[0].reason,result.registeredRounds?'fixture_requires_review':'draw_not_registered');
 assert.equal(readFileSync('data.js','utf8'),source);
});
test('competition isolation',()=>{
 assert.equal(classifyCompetition(item('M’mbelwa Warriors FC vs Chizumulu United',match)),'not_identified');
 assert.equal(classifyCompetition(item('Presidential FA Cup',match,'presidential_fa_cup')),'conflict_or_other');
 assert.equal(classifyCompetition(item('MMBELWA CUP #CINRFALeagueOne',match)),'conflict_or_other');
 assert.equal(classifyCompetition(item('MMBELWA CUP',match,'nrfa_league_one')),'conflict_or_other');
 assert.equal(classifyCompetition(item('MMBELWA CUP',match,'new_unverified_code')),'code_requires_review');
 assert.equal(classifyCompetition(item('M’mbelwa Cup draw',null)),'candidate');
 assert.equal(classifyCompetition({structured:{competition:{conflict:true,code:'mmbelwa_cup'}}}),'conflict_or_other');
});
test('announcements, duplicate snapshots and unknown team are held for review',()=>{
 const a=item('MMBELWA CUP',match,'mmbelwa_cup');
 const r=discoverFromSource(source,[a,a,item('Mmbelwa Cup draw',null),item('Mmbelwa Cup',{...match,homeTeam:'Unknown Test Club'})]);
 assert.equal(r.candidates.length,3);
 assert.ok(r.candidates.some(x=>x.reason==='announcement_requires_review'));
 assert.ok(r.candidates.some(x=>x.reason==='team_requires_review'));
});
test('even populated brackets cannot enable writes',()=>{
 const cup={id:'mmbelwaCup',rounds:[{matches:[{home:'A',away:'B'}]}],regionalQualifiers:[{groups:[{teams:[{en:'A',ko:'A'},{en:'B',ko:'B'}]}]}]};
 const r=discover([item('Mmbelwa Cup',{homeTeam:'A',awayTeam:'B',status:'finished',homeScore:2,awayScore:1})],cup);
 assert.equal(r.candidates[0].reason,'fixture_requires_review');
 assert.equal(cup.rounds[0].matches[0].homeScore,undefined);
});
