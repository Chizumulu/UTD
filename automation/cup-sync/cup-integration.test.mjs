import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

import {syncCup,locate} from './sync-cup.mjs';
import {planCupScorers} from './plan-scorers.mjs';
import {applyApprovedScorers} from './apply-approved-scorers.mjs';

const source = 'const cupTournaments = ' + JSON.stringify([{
    id:'faCup2627',
    rounds:[
        {labelEn:'Play-off 1',matches:[]},
        {labelEn:'Play-off Second Round',matches:[]},
        {
            labelEn:'First Round - Regional',
            matches:[
                {home:'Mzwazwa FC',away:'Embangweni United FC'},
                {home:'Bwabwa FC',away:'Mzuzu City Hammers FC'},
                {home:'Songwe Border United FC',away:'Raiply FC'},
                {
                    home:'Chizumulu United FC',
                    away:'Chilumba Barracks FC'
                }
            ]
        }
    ]
}]) + ';';

const match = {
    index:0,
    homeTeam:'Chizumulu United FC',
    awayTeam:'Chilumba Barracks FC',
    status:'scheduled',
    roundText:'NRFA First Round',
    dateText:'SUN 29-11-2026',
    timeText:'3:00pm',
    venue:'Majaliro Ground',
    competitionCode:null
};

function item(id,m,code=null){
    return {
        rawUpdateId:id,
        latestObservation:{text:'#PresidentialFACup'},
        structured:{
            competition:{code,conflict:false},
            matches:[m]
        }
    };
}

const fixture = cup => cup.rounds[2].matches[3];

const scheduled = syncCup(source,[item(9001,match)]);

assert.equal(fixture(scheduled.cup).date,'2026-11-29');
console.log('PASS 1: Schedule date');

assert.equal(fixture(scheduled.cup).time,'15:00');
console.log('PASS 2: Kickoff time');

assert.equal(fixture(scheduled.cup).venueEn,'Majaliro Ground');
assert.equal(fixture(scheduled.cup).venueType,'away');
console.log('PASS 3: Away venue classification');

const finalMatch = {
    ...match,
    status:'full_time',
    homeScore:2,
    awayScore:1,
    events:[
        {
            type:'goal',
            team:'Chizumulu United FC',
            minute:25,
            players:[{role:'scorer',name:'Gift Gilbert'}]
        },
        {
            type:'goal',
            team:'Chizumulu United FC',
            minute:67,
            players:[{role:'scorer',name:'Gift Gilbert'}]
        },
        {
            type:'goal',
            team:'Chilumba Barracks FC',
            minute:80,
            players:[{role:'scorer',name:'Opponent Player'}]
        }
    ]
};

const api = [item(9002,finalMatch)];

const completed = syncCup(scheduled.source,api);

assert.equal(fixture(completed.cup).homeScore,2);
assert.equal(fixture(completed.cup).awayScore,1);
console.log('PASS 4: Final score applied');

const snapshot = JSON.parse(JSON.stringify(completed.cup));

const planned = planCupScorers(api,snapshot);

assert.equal(planned.proposals.length,1);
const p = planned.proposals[0];

assert.equal(p.fixtureId,'round:2:match:3');
console.log('PASS 5: Scorer proposal generated');

assert.deepEqual(p.goals,[
    {name:'Gift Gilbert',count:2,side:'home'}
]);
console.log('PASS 6: Chizumulu scorers only');

assert.equal(p.dispatchType,'cup-scorer-proposal-approved');
console.log('PASS 7: Cup dispatch routing');

const worker = fs.readFileSync(
    'automation/scorer-approval/worker.js','utf8'
);

const lines = worker.split(/\r?\n/).filter(
    line => line.includes('const fixture=cup.rounds.flatMap')
);

assert.equal(lines.length,1);

const found = vm.runInNewContext(
    lines[0].trim()+'\nfixture;',
    {cup:snapshot,p}
);

assert.equal(found.home,'Chizumulu United FC');
assert.equal(found.away,'Chilumba Barracks FC');
console.log('PASS 8: Worker fixture lookup');

const approved = applyApprovedScorers(completed.source,p);

assert.deepEqual(
    fixture(locate(approved).cup).chizumuluScorers,
    [{name:'Gift Gilbert',count:2}]
);
console.log('PASS 9: Approved scorers saved');

assert.equal(applyApprovedScorers(approved,p),approved);
console.log('PASS 10: Duplicate approval prevented');

assert.equal(syncCup(approved,api).source,approved);
console.log('PASS 11: Repeated sync preserves scorers');

const league = syncCup(source,[
    item(9003,finalMatch,'nrfa_league_one')
]);

assert.equal(league.source,source);
console.log('PASS 12: League result cannot modify cup');

const incomplete = planCupScorers([
    item(9004,{
        ...finalMatch,
        events:[finalMatch.events[0]]
    })
],snapshot);

assert.equal(incomplete.proposals.length,0);
console.log('PASS 13: Incomplete scorer report blocked');

const forfeited = syncCup(scheduled.source,[
    item(9005,{
        ...finalMatch,
        homeScore:3,
        awayScore:0,
        forfeit:true
    })
]);

assert.equal(forfeited.source,scheduled.source);
console.log('PASS 14: Automatic forfeit result blocked');

console.log('ALL 14 INTEGRATION TESTS PASSED');
