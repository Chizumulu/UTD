import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {optimizeFallbackScan,compactInlineFontCss} from './design-preserved-runtime.mjs';
const [base,candidate]=process.argv.slice(2);
const files=root=>{const out=[];const walk=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const p=join(dir,entry.name);if(entry.isDirectory())walk(p);else out.push(relative(root,p))}};walk(root);return out.sort()};
const before=files(base),after=files(candidate);assert.deepEqual(after,before);
const read=(root,name)=>readFileSync(join(root,name));
const oldApp=read(base,'app.js'),newApp=read(candidate,'app.js');
assert.equal(newApp.toString(),optimizeFallbackScan(oldApp.toString()),'Unexpected app mutation');
const version=b=>createHash('sha256').update(b).digest('hex').slice(0,16);
const oldHtml=read(base,'index.html').toString();
const oldVersion=version(oldApp),newVersion=version(newApp);
assert.equal(oldHtml.split(oldVersion).length-1,2,'Unexpected app version references');
const expected=await compactInlineFontCss(oldHtml.replaceAll(oldVersion,newVersion));
assert.equal(read(candidate,'index.html').toString(),expected.html,'Unexpected HTML mutation');
for(const name of before){
 if(['app.js','index.html'].includes(name))continue;
 if(name==='publication.json'){
  const a=JSON.parse(read(base,name)),b=JSON.parse(read(candidate,name));
  delete a.commit;delete b.commit;assert.deepEqual(a,b);
 }else assert.ok(read(base,name).equals(read(candidate,name)),name+' changed');
}
console.log('Design-preserved runtime asset gate: '+JSON.stringify({files:before.length,onlyExpectedChanges:true,font:expected.metrics,appBytesBefore:oldApp.length,appBytesAfter:newApp.length}));
