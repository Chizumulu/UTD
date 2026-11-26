import assert from 'node:assert/strict';
import {applyApprovedScorers} from './apply-approved-scorers.mjs';
import {locate} from './sync-cup.mjs';

const source = 'const cupTournaments = ' + JSON.stringify([{
    id: 'faCup2627',
    rounds: [
        {
            matches: [{
                id: 'playoff-test',
                home: 'Emazwini FC',
                away: 'Chandamale FC',
                homeScore: 2,
                awayScore: 1
            }]
        },
        {
            matches: [{
                id: 'test-match',
                home: 'Chizumulu United FC',
                away: 'Winner',
                awayWinnerOf: 'playoff-test',
                date: '2026-11-29',
                homeScore: 2,
                awayScore: 1
            }]
        }
    ]
}]) + ';';

const proposal = {
    competition: 'faCup2627',
    fixtureId: 'test-match',
    home: 'Chizumulu United FC',
    away: 'Emazwini FC',
    date: '2026-11-29',
    homeScore: 2,
    awayScore: 1,
    goals: [
        {side: 'home', name: 'Gift Gilbert', count: 2}
    ]
};

const updated = applyApprovedScorers(source, proposal);

assert.deepEqual(
    locate(updated).cup.rounds[1].matches[0].chizumuluScorers,
    [{name: 'Gift Gilbert', count: 2}]
);
console.log('PASS 1: Resolved opponent matching');

assert.equal(applyApprovedScorers(updated, proposal), updated);
console.log('PASS 2: Duplicate approval prevention');

assert.throws(() => applyApprovedScorers(source, {
    ...proposal, away: 'Chandamale FC'
}), /No unique verified cup fixture/);
console.log('PASS 3: Wrong opponent rejected');

assert.throws(() => applyApprovedScorers(source, {
    ...proposal,
    goals: [{side:'home', name:'Gift Gilbert', count:1}]
}), /Score mismatch/);
console.log('PASS 4: Incorrect goal count rejected');

assert.throws(() => applyApprovedScorers(updated, {
    ...proposal,
    goals: [{side:'home', name:'Other Player', count:2}]
}), /Existing scorers conflict/);
console.log('PASS 5: Existing scorer overwrite prevented');

console.log('ALL 5 TESTS PASSED');
