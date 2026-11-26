import assert from 'node:assert/strict';
import {resolveCupParticipants} from './sync-cup.mjs';
import {applyApprovedScorers} from './apply-approved-scorers.mjs';

function testWinner(label, fields, expected) {
    const cup = {
        id: 'faCup2627',
        rounds: [
            {matches: [{
                id: 'playoff-test',
                home: 'Emazwini FC',
                away: 'Chandamale FC',
                ...fields
            }]},
            {matches: [{
                home: 'Karonga Pirates FC',
                away: 'Emazwini / Chandamale winner',
                awayWinnerOf: 'playoff-test'
            }]}
        ]
    };

    const resolved = resolveCupParticipants(cup);
    assert.equal(resolved.rounds[1].matches[0].away, expected);
    console.log('PASS: ' + label);
}

const pending = 'Emazwini / Chandamale winner';

testWinner('Normal home win',
    {homeScore:2, awayScore:1}, 'Emazwini FC');

testWinner('Normal away win',
    {homeScore:0, awayScore:2}, 'Chandamale FC');

testWinner('Home forfeit win',
    {homeScore:3, awayScore:0, forfeit:true}, 'Emazwini FC');

testWinner('Away forfeit win',
    {homeScore:0, awayScore:3, forfeit:true}, 'Chandamale FC');

testWinner('Penalty shootout',
    {homeScore:1, awayScore:1, pso:'4:5'}, 'Chandamale FC');

testWinner('Forfeit without score',
    {forfeit:true}, pending);

testWinner('Unfinished fixture without score',
    {}, pending);

testWinner('Postponed match',
    {homeScore:3, awayScore:0, postponed:true}, pending);

testWinner('Draw without penalties',
    {homeScore:1, awayScore:1}, pending);

testWinner('Invalid forfeit penalty result',
    {homeScore:0, awayScore:0, forfeit:true, pso:'5:4'}, pending);

const source = 'const cupTournaments = ' + JSON.stringify([{
    id:'faCup2627',
    rounds:[{matches:[{
        id:'forfeit-test',
        home:'Chizumulu United FC',
        away:'Chilumba Barracks FC',
        date:'2026-11-29',
        homeScore:3,
        awayScore:0,
        forfeit:true
    }]}]
}]) + ';';

assert.throws(() => applyApprovedScorers(source, {
    competition:'faCup2627',
    fixtureId:'forfeit-test',
    home:'Chizumulu United FC',
    away:'Chilumba Barracks FC',
    date:'2026-11-29',
    homeScore:3,
    awayScore:0,
    goals:[{side:'home', name:'Gift Gilbert', count:3}]
}), /Administrative result/);

console.log('PASS: Forfeit scorer approval rejected');
console.log('ALL 11 TESTS PASSED');
