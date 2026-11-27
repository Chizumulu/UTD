import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import postcss from 'postcss';
import {splitClubSponsorCss} from './club-css-split.mjs';
import {splitClubDetailCss} from './club-css-detail-split.mjs';
import {wireClubDetailCss} from './club-css-detail-runtime.mjs';
import {cssSignature} from './minify-pages-assets.mjs';

test('actual assets reconstruct the previous deployed CSS in exact original order',async()=>{
 const source=(await splitClubSponsorCss(readFileSync('style.css','utf8'))).critical;
 const r=await splitClubDetailCss(source),slots=new Map();
 for(const [kind,a] of Object.entries(r.assets)){
  assert.match(a.url,new RegExp('^club-'+kind+'\\.css\\?v=[a-f0-9]{16}$'));
  let list;
  for(const n of postcss.parse(a.css).nodes){
   if(n.type==='rule'&&n.selector.startsWith('#utd-club-css-slot-')){
    assert.ok(!slots.has(n.selector));list=[];slots.set(n.selector,list);
   }else{assert.ok(list);list.push(n.clone());}
  }
  assert.ok(a.rules>0&&a.slots>0);
 }
 const rebuilt=postcss.root();
 for(const n of postcss.parse(r.critical).nodes){
  if(n.type==='rule'&&slots.has(n.selector)){for(const item of slots.get(n.selector))rebuilt.append(item.clone());slots.delete(n.selector);}
  else rebuilt.append(n.clone());
 }
 assert.equal(slots.size,0);
 assert.equal(cssSignature(rebuilt.toString()),cssSignature(source));
 for(const key of ['raw','gzip','brotli'])assert.ok(r.metrics.after[key]<r.metrics.before[key],key);
 const app=wireClubDetailCss(readFileSync('app.js','utf8'),r.assets);
 new Script(app);
 assert.match(app,/target\.insertRule\(rule,index\)/);
 assert.match(app,/clubDetailCssFailed\.add\(kind\)/);
 assert.throws(()=>wireClubDetailCss('bad',r.assets),/Expected unique/);
});
test('mixed and shared selectors remain critical',async()=>{
 const source=(await splitClubSponsorCss(readFileSync('style.css','utf8'))).critical+'\n.ta-new, .shared { color: red } @media (max-width: 500px){ .ta-new {color:blue} .shared{color:green} }';
 const r=await splitClubDetailCss(source);
 assert.match(r.critical,/\.ta-new, \.shared/);
 assert.match(r.critical,/\.ta-new\s*\{color:blue/);
 assert.doesNotMatch(r.assets.analysis.css,/\.ta-new/);
 await assert.rejects(splitClubDetailCss(source+'#utd-club-css-slot-analysis-0{color:red}'),/Reserved/);
});
