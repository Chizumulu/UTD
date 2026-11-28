// Diagnostic-only 2x2 experiment; never used by production Pages builds.
import assert from 'node:assert/strict';
import {cpSync,readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {optimizeFallbackScan,compactInlineFontCss} from './design-preserved-runtime.mjs';
const [base,both,out]=process.argv.slice(2);
const arms=['control','font','cpu','both'];
const files=root=>{const result=[];const walk=dir=>{for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())walk(p);else result.push(relative(root,p))}};walk(root);return result.sort()};
const read=(root,p)=>readFileSync(join(root,p));
const version=b=>createHash('sha256').update(b).digest('hex').slice(0,16);
const originalApp=read(base,'app.js'),changedApp=Buffer.from(optimizeFallbackScan(originalApp.toString()));
const oldHtml=read(base,'index.html').toString(),v0=version(originalApp),v1=version(changedApp);
assert.notEqual(v0,v1);assert.equal(oldHtml.split(v0).length-1,2);
const inventory=files(base);assert.deepEqual(files(both),inventory);
const results=[];
for(const arm of arms){
 const root=join(out,arm,'UTD');mkdirSync(root,{recursive:true});cpSync(base,root,{recursive:true});
 const cpu=arm==='cpu'||arm==='both',font=arm==='font'||arm==='both';
 const html=cpu?oldHtml.replaceAll(v0,v1):oldHtml;
 const compact=font?await compactInlineFontCss(html):{html,metrics:null};
 if(font)assert.equal(compact.metrics.applied,true,'Font-only experiment did not apply');
 writeFileSync(join(root,'app.js'),cpu?changedApp:originalApp);
 writeFileSync(join(root,'index.html'),compact.html);
 assert.deepEqual(files(root),inventory);
 for(const name of inventory){
  if(['app.js','index.html'].includes(name))continue;
  assert.ok(read(base,name).equals(read(root,name)),arm+' unexpected change '+name);
 }
 if(arm==='both'){
  for(const name of inventory){
   if(name==='publication.json'){const a=JSON.parse(read(root,name)),b=JSON.parse(read(both,name));delete a.commit;delete b.commit;assert.deepEqual(a,b);}
   else assert.ok(read(root,name).equals(read(both,name)),'Combined variant does not match verified second batch: '+name);
  }
 }
 results.push({arm,files:inventory.length,appBytes:read(root,'app.js').length,htmlBytes:read(root,'index.html').length,font:compact.metrics,appHash:version(read(root,'app.js')),htmlHash:version(read(root,'index.html'))});
}
writeFileSync(join(out,'variants.json'),JSON.stringify(results,null,2));
console.log('Factorial variant gate: '+JSON.stringify(results));
