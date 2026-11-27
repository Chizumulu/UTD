import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import postcss from 'postcss';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {minifyJs,minifyCss,minifyPagesAssets,JS_FILES,CSS_FILES} from './minify-pages-assets.mjs';

test('classic-script globals and behavior survive minification',async()=>{
 const source='// comment\nconst leagueName = "NRFA";\nfunction showView(name) { return leagueName + ":" + name; }\nwindow.openMatch = showView;';
 const result=await minifyJs(source);
 const ctx={window:{}};
 vm.createContext(ctx);
 vm.runInContext(result,ctx);
 assert.equal(ctx.window.openMatch('home'),'NRFA:home');
 assert.equal(vm.runInContext('leagueName',ctx),'NRFA');
 assert.equal(vm.runInContext('showView("cup")',ctx),'NRFA:cup');
 assert.ok(result.length<source.length);
});
test('CSS cascade order, custom property tokens and declarations survive',async()=>{
 const source='/* comment */\n.a { --gap: 1px 2px; width: calc(100% - 2px); color: red; }\n@media (min-width: 800px) { .a { color: blue; } }\n.a { color: green; }';
 const result=await minifyCss(source);
 const signature=css=>{const nodes=[];postcss.parse(css).walk(n=>{if(n.type==='rule')nodes.push(['rule',n.selector]);if(n.type==='atrule')nodes.push(['at',n.name,n.params]);if(n.type==='decl')nodes.push(['decl',n.prop,n.value,!!n.important]);});return nodes;};
 assert.deepEqual(signature(result),signature(source));
 assert.ok(result.length<source.length);
});
test('deployment-only minification preserves data and does not increase gzip bytes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'utd-minify-'));
 try{
  for(const file of [...JS_FILES,...CSS_FILES,'data.js'])writeFileSync(join(dir,file),readFileSync(file));
  const before=readFileSync(join(dir,'data.js'));
  const results=await minifyPagesAssets(dir);
  assert.equal(results.length,3);
  assert.ok(results.some(r=>r.applied),'expected at least one smaller asset');
  for(const r of results){assert.ok(r.after<=r.before);assert.ok(r.gzipAfter<=r.gzipBefore);}
  for(const file of JS_FILES)new vm.Script(readFileSync(join(dir,file),'utf8'));
  for(const file of CSS_FILES)postcss.parse(readFileSync(join(dir,file),'utf8'));
  assert.deepEqual(readFileSync(join(dir,'data.js')),before);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
