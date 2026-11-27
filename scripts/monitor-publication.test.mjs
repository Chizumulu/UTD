import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {classify,validManifest} from './monitor-publication.mjs';
import {readFileSync} from 'node:fs';
const now=Date.parse('2026-11-27T10:00:00Z'),hour=3600000;
const run={id:42,run_attempt:1,status:'completed',conclusion:'success',created_at:new Date(now-2*hour).toISOString(),updated_at:new Date(now-2*hour).toISOString()};
const receipt={version:1,runId:'42',runAttempt:'1',branch:'main',commit:'a'.repeat(40),dataSha256:'b'.repeat(64)};
test('normal, failed and delayed approval runs',()=>{
 assert.equal(classify(run,receipt,null,true,now),'verified');
 assert.equal(classify(run,receipt,null,false,now),'publication_unverified');
 assert.equal(classify(run,null,null,false,now),'receipt_missing');
 assert.equal(classify({...run,conclusion:'failure'},null,null,false,now),'run_failed');
 assert.equal(classify({...run,status:'queued'},null,null,false,now),'run_delayed');
 assert.equal(classify({...run,status:'queued',created_at:new Date(now-hour).toISOString()},null,null,false,now),'pending');
 assert.equal(classify({...run,run_attempt:2},receipt,null,true,now),'receipt_missing');
});
test('manual review is preserved and merge requires deployment evidence',()=>{
 const r={...receipt,branch:'automation/lineup-42'};
 assert.equal(classify(run,r,null,false,now),'pr_missing');
 assert.equal(classify(run,r,{state:'open'},false,now),'awaiting_review');
 assert.equal(classify(run,r,{state:'open'},false,now+25*hour),'pr_review_overdue');
 assert.equal(classify(run,r,{state:'closed'},false,now),'pr_closed_unmerged');
 const merged={state:'closed',merged_at:new Date(now-15*60000).toISOString()};
 assert.equal(classify(run,r,merged,false,now),'pending');
 assert.equal(classify(run,r,merged,true,now),'verified');
 assert.equal(classify(run,r,merged,false,now+hour),'publication_unverified');
});
test('checksum proves the actual downloaded asset matches the manifest',()=>{
 const bytes=Buffer.from('public data');
 const m={version:1,commit:'a'.repeat(40),dataSha256:createHash('sha256').update(bytes).digest('hex')};
 assert.ok(validManifest(m,bytes));
 assert.ok(!validManifest(m,Buffer.from('stale data')));
 assert.ok(!validManifest({...m,commit:'bad'},bytes));
});
test('all four approval workflows capture receipts',()=>{
 for(const name of ['scorer-approval','cup-scorer-approval','forfeit-approval','instagram-lineup-approved']){
  const text=readFileSync('.github/workflows/'+name+'.yml','utf8');
  assert.match(text,/node scripts\/publication-receipt\.mjs/);
  assert.match(text,/name: publication-receipt/);
 }
});
