import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BASE,readSeoData,activeFixtures,generateSeo,writeSeo} from './seo-pages.mjs';
const source=readFileSync('data.js','utf8');
test('production data generates unique crawlable pages',()=>{
 const d=readSeoData(source), rows=activeFixtures(d), pages=generateSeo(d);
 assert.ok(rows.length>100);
 assert.ok(pages.size>20);
 for(const p of ['matches/','league/','teams/','players/','cup/'])assert.ok(pages.has(p));
 for(const [path,html] of pages){
  assert.ok(html.includes('<link rel="canonical" href="'+BASE+path+'">'));
  assert.match(html,/<h1>[^<]+<\/h1>/);
  for(const [,url] of html.matchAll(/href="https:\/\/chizumulu\.github\.io\/UTD\/([^"]*)"/g)){
   if(url.endsWith('/')||!url)assert.ok(!url||pages.has(url),'broken internal link '+url);
  }
 }
});
test('stable fixture URL across reschedule, score update and escaping',()=>{
 const d=readSeoData(source),m=activeFixtures(d).find(m=>m.homeEn==='Chizumulu United FC'&&m.kickoffDate);
 const key='matches/2026-27/'+m.fixtureId+'/';
 const rows=d.roundsData[m.round]||d.scheduledRounds[m.round];
 const actual=rows.find(r=>r.fixtureId===m.fixtureId&&!r.movedToWeek);
 assert.ok(actual);
 actual.homeKo='<script>alert(1)</script>';actual.kickoffDate='2026-12-22';actual.homeScore=4;actual.awayScore=2;
 const html=generateSeo(d).get(key);
 assert.match(html,/4 : 2/);assert.match(html,/2026-12-22/);
 assert.ok(!html.includes('<script>alert(1)</script>'));
});
test('deployment output contains sitemap and real HTML at every URL',()=>{
 const out=mkdtempSync(join(tmpdir(),'utd-seo-'));
 try{
  writeFileSync(join(out,'index.html'),'<!doctype html><html><body>Existing SPA</body></html>');
  const count=writeSeo(out,source);
  const sitemap=readFileSync(join(out,'sitemap.xml'),'utf8');
  const paths=[...sitemap.matchAll(/<loc>https:\/\/chizumulu\.github\.io\/UTD\/([^<]*)<\/loc>/g)].map(x=>x[1]);
  assert.equal(paths.length,count+1);
  assert.equal(new Set(paths).size,paths.length);
  for(const p of paths)assert.ok(existsSync(join(out,p,'index.html')));
  assert.equal(readFileSync(join(out,'index.html'),'utf8'),'<!doctype html><html><body>Existing SPA</body></html>');
  assert.ok(!sitemap.includes('<lastmod>'));
 }finally{rmSync(out,{recursive:true,force:true});}
});

test('generated landing pages use one direct tag and a relative content-versioned analytics script',()=>{
 const pages=generateSeo(readSeoData(source),{analyticsVersion:'test-version'});
 for(const [path,html] of pages){
  const prefix='../'.repeat(path.split('/').filter(Boolean).length);
  assert.equal((html.match(/gtag\("config","G-N6GC687TZD"\)/g)||[]).length,1);
  assert.ok(html.includes('src="'+prefix+'utd-analytics.js?v=test-version" data-utd-seo="'+path+'"'),path);
  assert.ok(!html.includes('GTM-T7RRHPMN'));
 }
});
