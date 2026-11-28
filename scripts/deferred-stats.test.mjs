import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { deferOptionalStats, splitOptionalData, assertNoOptionalDataReference } from './deferred-stats.mjs';
test('optional statistics preserve values and memoize on demand', () => {
 const data = readFileSync('data.js','utf8');
 const app = readFileSync('app.js','utf8');
 const out = deferOptionalStats(data,app);
 const names = ['multiGoalGamesData','goalsByPositionData','assistsByPositionData','playerGoalTimelines'];
 const context = {console};
 const original = runInNewContext(data+'\nJSON.stringify(['+names.join(',')+'])',context);
 const actual = runInNewContext(out.data+'\nif (!['+names.join(',')+'].every(v=>v===undefined)) throw Error("eager");\nJSON.stringify(['+names.map(n=>'getDeferred_'+n+'()').join(',')+'])',{console});
 assert.equal(actual,original);
 const memoized = runInNewContext(out.data+'\n'+names.map(n=>'getDeferred_'+n+'() === getDeferred_'+n+'()').join(' && '),{console});
 assert.equal(memoized,true,'Repeated access must reuse cached statistics');
 for(const n of names) assert.ok(out.app.includes('getDeferred_'+n+'()'));
});

test('optional literals preserve original values without initial allocation', () => {
 const raw = readFileSync('data.js','utf8');
 const out = splitOptionalData(raw);
 for (const name of ['extraVenues','teamSponsors']) {
   assert.equal(runInNewContext(out.data+'\n'+'typeof '+name,{console}),'undefined');
   const expected = runInNewContext(raw+'\nJSON.stringify('+name+')',{console});
   assert.equal(runInNewContext(out[name]+'\nJSON.stringify('+name+')'),expected);
   assert.throws(()=>splitOptionalData(raw+'\nconsole.log('+name+');'),/Unexpected shared reference/);
   assert.throws(()=>assertNoOptionalDataReference('const shared = '+name+';',name),/Unexpected shared reference/);
 }
});
