import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prioritizeInitialRender,preloadInitialAssets} from './initial-render.mjs';

test('startup renders home cards first without eagerly rendering the hidden full table',()=>{
 const app=readFileSync('app.js','utf8');
 const updated=prioritizeInitialRender(app);
 const init=s=>s.slice(s.indexOf('// ===== 초기 실행 (App Init) ====='),s.indexOf('// ===== 스크롤 힌트'));
 const original=init(app),optimized=init(updated);
 assert.ok(original.includes('renderLeagueTable();'));
 assert.ok(!optimized.includes('renderLeagueTable();'));
 assert.ok(optimized.indexOf('renderNextMatchStrip();')<optimized.indexOf('renderMainMiniTable();'));
 assert.ok(!optimized.includes('renderPromoRaceStrip();'));
 for(const name of ['renderHomeMatchCards','renderNextMatchPreviewCard','initSpotlightCards','startLeagueLiveTicker','startAutomaticNotices','initTabbarAutoHide'])assert.ok(optimized.includes(name+'();'),name);
 assert.equal(updated.slice(updated.indexOf('// ===== 스크롤 힌트')),app.slice(app.indexOf('// ===== 스크롤 힌트')));
 assert.match(updated,/else if \(view === 'leagueRank'\) \{[\s\S]{0,300}renderLeagueTable\(\);/);
});
test('preloads exact hashed assets without rewriting existing script execution',()=>{
 const html=readFileSync('index.html','utf8');
 const versions={style:'1111111111111111',data:'2222222222222222',app:'3333333333333333'};
 const output=preloadInitialAssets(html,versions);
 const tags=[...output.matchAll(/<link rel="preload" as="(style|script)" href="([^"]+)">/g)];
 assert.deepEqual(tags.map(m=>[m[1],m[2]]),[['style','style.css?v='+versions.style],['script','data.js?v='+versions.data],['script','app.js?v='+versions.app]]);
 assert.equal(output.replace(/<head>\n(?:<link rel="preload" as="(?:style|script)" href="[^"]+">\n?){3}/,'<head>'),html.replace('<head>\n','<head>'));
 assert.throws(()=>preloadInitialAssets(html,{...versions,app:'bad'}));
});
