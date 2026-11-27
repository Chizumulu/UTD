import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitMatchDetail} from './match-detail-split.mjs';

test('match detail renderers isolated with common coordinates, translations and route lifecycle retained',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitMatchDetail(source);
 assert.equal(file,'match-detail.js');
 new Script(app);new Script(code);
 for(const name of ['renderLineupField','renderLineupPitch','renderLineupLeft','renderLineupSubs','renderMatchGoalsPanel','renderLineupHistory','renderMatchCenterSection','buildMatchAssistSummary'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['openMatchDetail','closeMatchDetail','openLinkedFixture','renderLinkedFixtureSummary','dismissLinkedFixtureForNavigation','translateResultSuffix','translateHistScore','formatCompLabel','findOurLineupMatch','setActiveMatchPath'])assert.ok(app.includes('function '+name+'('),name);
 for(const name of ['PITCH_COORDS','LINEUP_PHOTO_EXTS','HIST_TEAM_EN'])assert.ok(app.includes('const '+name+' ='),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.match(app,/token!==matchDetailLoadToken/);
 assert.match(app,/setActiveMatchPath\(findOurLineupMatch\(roundKey,lineup\)\)/);
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Match detail initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitMatchDetail('bad'));
});
