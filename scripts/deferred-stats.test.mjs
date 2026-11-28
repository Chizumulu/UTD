import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { deferOptionalStats } from './deferred-stats.mjs';
test('optional statistics preserve values and memoize on demand', () => {
 const data = readFileSync('data.js','utf8');
 const app = readFileSync('app.js','utf8');
 const out = deferOptionalStats(data,app);
 const names = ['multiGoalGamesData','goalsByPositionData','assistsByPositionData','playerGoalTimelines'];
 const context = {console};
 const original = runInNewContext(data+'\nJSON.stringify(['+names.join(',')+'])',context);
 const actual = runInNewContext(out.data+'\nif (!['+names.join(',')+'].every(v=>v===undefined)) throw Error("eager");\nJSON.stringify(['+names.map(n=>'getDeferred_'+n+'()').join(',')+'])',{console});
 assert.equal(actual,original);
 for(const n of names) assert.ok(out.app.includes('getDeferred_'+n+'()'));
});
