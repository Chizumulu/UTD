import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {median,extract,compare,sizes,summarize,metrics} from './lighthouse-comparison.mjs';

function report(value){
 const out={categories:{performance:{score:value/100}},audits:{}};
 for(const [key,path] of Object.entries(metrics))if(key!=='score')out.audits[path[1]]={numericValue:value};
 out.audits['network-requests']={details:{items:[{},{}]}};
 return out;
}
test('median uses sorted samples without mutating them',()=>{
 const values=[100,10,20];
 assert.equal(median(values),20);assert.deepEqual(values,[100,10,20]);
 assert.equal(median([4,2]),3);
 assert.throws(()=>median([]));assert.throws(()=>median([NaN]));
});
test('extract refuses failed or incomplete audits and reports score and requests',()=>{
 const r=report(80);
 assert.equal(extract(r).score,80);assert.equal(extract(r).requests,2);
 assert.equal(extract(r).lcp,80);
 assert.throws(()=>extract({...r,runtimeError:{message:'failed'}}),/failed/);
 delete r.audits['largest-contentful-paint'];
 assert.throws(()=>extract(r),/lcp/);
});
test('comparison retains individual samples and handles zero baseline',()=>{
 const result=compare([{lcp:100,cls:0},{lcp:200,cls:0},{lcp:150,cls:0}],[{lcp:100,cls:0},{lcp:90,cls:0},{lcp:80,cls:0}]);
 assert.deepEqual(result.lcp,{before:150,after:90,delta:-60,percent:-40,beforeSamples:[100,200,150],afterSamples:[100,90,80]});
 assert.equal(result.cls.percent,null);
 assert.throws(()=>compare([{lcp:1}],[]));
});
test('summary emits both profiles, raw samples and compressed asset inventory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'utd-lighthouse-'));
 try{
  const beforeDir=join(dir,'before'),afterDir=join(dir,'after');
  mkdirSync(beforeDir);mkdirSync(afterDir);
  writeFileSync(join(beforeDir,'app.js'),'abc'.repeat(100));
  writeFileSync(join(afterDir,'app.js'),'abc'.repeat(50));
  writeFileSync(join(afterDir,'optional.js'),'abc');
  assert.equal(sizes(beforeDir)['app.js'].raw,300);
  assert.ok(sizes(beforeDir)['app.js'].gzip>0);
  assert.ok(sizes(beforeDir)['app.js'].brotli>0);
  for(const profile of ['mobile','desktop'])for(const side of ['before','after'])for(let i=1;i<=3;i++){
   writeFileSync(join(dir,profile+'-'+side+'-'+i+'.json'),JSON.stringify(report(side==='before'?70+i:80+i)));
  }
  const r=summarize({dir,base:'baseline',head:'candidate',beforeDir,afterDir,runs:3});
  assert.equal(r.profiles.mobile.score.delta,10);assert.equal(r.profiles.desktop.score.after,82);
  assert.equal(r.assets.after['app.js'].raw,150);
  const md=readFileSync(join(dir,'comparison.md'),'utf8');
  assert.match(md,/optional\.js/);assert.match(md,/## desktop/);
  assert.equal(JSON.parse(readFileSync(join(dir,'comparison.json'),'utf8')).runs,3);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
