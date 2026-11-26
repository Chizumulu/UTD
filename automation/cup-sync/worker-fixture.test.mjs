import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parse} from 'acorn';

const source = fs.readFileSync(
    'automation/scorer-approval/worker.js','utf8'
);

parse(source,{
    ecmaVersion:'latest',
    sourceType:'module'
});

const lines = source.split(/\r?\n/).filter(
    line => line.includes('const fixture=cup.rounds.flatMap')
);

assert.equal(lines.length,1);

const code = lines[0].trim() + '\nfixture;';

const cup = {
    rounds:[
        {matches:[
            {id:'north-playoff-1',home:'Emazwini FC'}
        ]},
        {matches:[]},
        {matches:[
            {home:'Mzwazwa FC'},
            {home:'Bwabwa FC'},
            {home:'Songwe Border United FC'},
            {
                home:'Chizumulu United FC',
                away:'Chilumba Barracks FC'
            }
        ]}
    ]
};

function find(fixtureId) {
    return vm.runInNewContext(code,{
        cup,p:{fixtureId}
    });
}

assert.equal(find('north-playoff-1').home,'Emazwini FC');
console.log('PASS 1: Explicit fixture ID');

assert.equal(find('round:2:match:3').home,'Chizumulu United FC');
console.log('PASS 2: Chizumulu fallback fixture ID');

assert.equal(find('round:2:match:3').away,'Chilumba Barracks FC');
console.log('PASS 3: Correct opponent');

assert.equal(find('round:2:match:0').home,'Mzwazwa FC');
console.log('PASS 4: Zero-based match index');

assert.equal(find('round:99:match:99'),undefined);
console.log('PASS 5: Out-of-range fixture rejected');

assert.equal(find('invalid-id'),undefined);
console.log('PASS 6: Invalid fixture ID rejected');

console.log('ALL 6 WORKER TESTS PASSED');
