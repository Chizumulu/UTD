import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prioritizeInitialRender,preloadInitialAssets,staticStartupScripts} from './initial-render.mjs';

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
 assert.equal(output.replace(/<head>\n(?:<link rel="preload" as="(?:style|script)" href="[^"]+">\n?){3}/,'<head>'),html.replace('<head>\n','<head>').replace(/<script>document\.write\('<link rel="stylesheet" href="style\.css\?v=' \+ window\.ASSET_VERSIONS\.style \+ '">'\);<\/script>/, '<link rel="stylesheet" href="style.css?v='+versions.style+'">'));
 assert.throws(()=>preloadInitialAssets(html,{...versions,app:'bad'}));
});

test('startup avoids rewriting identical localized markup without changing later language handling',()=>{
 const app=readFileSync('app.js','utf8');
 const updated=prioritizeInitialRender(app);
 const marker='// ===== 초기 실행 (App Init) =====';
 assert.equal(updated.slice(0,updated.indexOf(marker)),app.slice(0,app.indexOf(marker)));
 assert.match(updated.slice(updated.indexOf(marker)),/if \(localized !== null && el.innerHTML === localized\) return;/);
});

test('static startup scripts preserve exact execution order, cache URLs and push scripts',()=>{
 const html=readFileSync('index.html','utf8');
 const versions={style:'1111111111111111',data:'2222222222222222',app:'3333333333333333',a11y:'4444444444444444'};
 const preloaded=preloadInitialAssets(html,versions);
 const output=staticStartupScripts(preloaded,versions);
 const expected=['data.js?v='+versions.data,'app.js?v='+versions.app,'lang-ny.js?v=002','a11y.js?v='+versions.a11y].map(src=>'<script src="'+src+'"></script>').join('\n');
 assert.ok(output.includes(expected));
 assert.equal(output.slice(0,output.indexOf(expected)),preloaded.slice(0,preloaded.indexOf('<script>\n  document.write(\'<script src="data.js')));
 assert.equal(output.slice(output.indexOf(expected)+expected.length),'\n</body>\n</html>\n');
 const hashedLang='5555555555555555';
 const hashed=preloaded.replace('lang-ny.js?v=002','lang-ny.js?v='+hashedLang);
 assert.ok(staticStartupScripts(hashed,{...versions,lang:hashedLang}).includes('<script src="lang-ny.js?v='+hashedLang+'"></script>'));
 assert.throws(()=>staticStartupScripts(preloaded,{...versions,a11y:'bad'}));
});
