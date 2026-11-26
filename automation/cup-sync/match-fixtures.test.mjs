import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCupItems} from './match-fixtures.mjs';
const cup={id:'faCup2627',rounds:[{labelEn:'Play-off 1',matches:[{id:'north-playoff-1',home:'Emazwini FC',away:'Chandamale FC'}]},{labelEn:'Play-off Second Round',matches:[{home:'Karonga Pirates FC',away:'Emazwini / Chandamale winner'}]}]};
const match={index:0,homeTeam:'Emazwini',awayTeam:'Chandamale FC',status:'scheduled',roundText:'NRFA 1st Playoffs',dateText:'SUN 29-11-2026',timeText:'3:00pm',venue:'Lupaso Ground',competitionCode:null};
const item=(id,m=match,code=null,raw='#PresidentialFACup')=>({rawUpdateId:id,latestObservation:{text:raw},structured:{competition:{code,conflict:false},matches:m?[m]:[]}});
test('644: explicit cup signal and null code',()=>assert.equal(matchCupItems([item(644)],cup).matched[0].fixtureId,'north-playoff-1'));
test('642: missing team names',()=>assert.equal(matchCupItems([item(642,{...match,homeTeam:null,awayTeam:null})],cup).skipped[0].reason,'missing_or_invalid_teams'));
test('636 and 634: no structured matches',()=>assert.equal(matchCupItems([item(636,null),item(634,null)],cup).matched.length,0));
test('league codes override cup signal',()=>assert.equal(matchCupItems([item(1,match,'nrfa_league_one'),item(2,match,'nrfa_league_two')],cup).matched.length,0));
test('duplicate and reversed teams',()=>{const r=matchCupItems([item(1),item(2),item(3,{...match,homeTeam:match.awayTeam,awayTeam:match.homeTeam})],cup);assert.equal(r.skipped[0].reason,'duplicate');assert.equal(r.matched.length,1);assert.equal(r.skipped[1].reason,'duplicate');});
test('unresolved opponent is held',()=>assert.equal(matchCupItems([item(1,{...match,homeTeam:'Karonga Pirates',awayTeam:'Emazwini',roundText:'NRFA 2nd Playoffs'})],cup).matched.length,0));
test('no cup signal or conflicting region is held',()=>assert.equal(matchCupItems([item(1,match,null,'ordinary fixture'),item(2,{...match,roundText:'SRFA 1st Playoffs'})],cup).matched.length,0));

test('reversed result maps scores to bracket order',()=>{const r=matchCupItems([item(1,{...match,homeTeam:match.awayTeam,awayTeam:match.homeTeam,homeScore:1,awayScore:3,status:'full_time'})],cup);assert.deepEqual(r.matched[0].bracketScores,[3,1]);assert.equal(r.matched[0].reversed,true);});
