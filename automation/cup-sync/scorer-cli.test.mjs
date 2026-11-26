import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {locate} from './sync-cup.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'utd-cup-test-'));
const dataPath = path.join(dir, 'data.js');
const proposalPath = path.join(dir, 'proposal.json');

try {
    const source = 'const cupTournaments = ' + JSON.stringify([{
        id:'faCup2627',
        rounds:[{matches:[{
            id:'cli-test',
            home:'Chizumulu United FC',
            away:'Chilumba Barracks FC',
            date:'2026-11-29',
            homeScore:2,
            awayScore:1
        }]}]
    }]) + ';';

    const proposal = {
        competition:'faCup2627',
        fixtureId:'cli-test',
        home:'Chizumulu United FC',
        away:'Chilumba Barracks FC',
        date:'2026-11-29',
        homeScore:2,
        awayScore:1,
        goals:[{side:'home',name:'Gift Gilbert',count:2}]
    };

    fs.writeFileSync(dataPath, source);
    fs.writeFileSync(proposalPath, JSON.stringify(proposal));

    function run() {
        const r = spawnSync(process.execPath, [
            'automation/cup-sync/apply-approved-scorers.mjs'
        ], {
            env:{
                ...process.env,
                DATA_PATH:dataPath,
                PROPOSAL_PATH:proposalPath
            },
            encoding:'utf8'
        });

        assert.equal(r.status, 0, r.stderr || String(r.error));
    }

    run();

    const first = fs.readFileSync(dataPath,'utf8');

    assert.deepEqual(
        locate(first).cup.rounds[0].matches[0].chizumuluScorers,
        [{name:'Gift Gilbert',count:2}]
    );

    console.log('PASS 1: Windows CLI execution');
    console.log('PASS 2: Scorers saved to temporary file');

    run();

    assert.equal(fs.readFileSync(dataPath,'utf8'),first);
    console.log('PASS 3: Repeated execution is idempotent');

    console.log('ALL 3 CLI TESTS PASSED');
} finally {
    fs.rmSync(dir,{recursive:true,force:true});
}
