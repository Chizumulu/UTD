import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const writers=['scorer-approval','cup-scorer-approval','cup-sync','fixture-date-sync','forfeit-approval','instagram-lineup-approved','youtube-highlights'];
test('all known production data writers share a non-cancelling bounded queue',()=>{
 for(const name of writers){
  const yaml=readFileSync('.github/workflows/'+name+'.yml','utf8');
  const indent=name==='youtube-highlights'?'    ':'';
  const expected=indent+'concurrency:\n'+indent+'  group: approved-scorer-proposals-main\n'+indent+'  queue: max';
  assert.ok(yaml.includes(expected),name+' must use shared writer queue');
 }
});
test('YouTube validation does not hold the publication lock',()=>{
 const yaml=readFileSync('.github/workflows/youtube-highlights.yml','utf8');
 const [before,publish]=yaml.split('\n  publish:');
 assert.ok(publish);
 assert.ok(!before.includes('group: approved-scorer-proposals-main'));
 assert.ok(publish.includes('group: approved-scorer-proposals-main'));
});
