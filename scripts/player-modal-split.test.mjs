import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitPlayerModals} from './player-modal-split.mjs';

test('player modal renderers move to optional asset; shared lifecycle stays',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitPlayerModals(source);
 assert.equal(file,'player-modals.js');
 new Script(app);new Script(code);
 for(const name of ['renderSquadPlayerSeasonChart','renderSquadPlayerAssistRelations','computeSquadPlayerTeamResults','renderSquadPlayerTeamResults','renderPlayerLoaded','renderSquadPlayerLoaded'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['openPlayerModal','openSquadPlayerModal','closePlayerModal','closeSquadPlayerModal','setSquadPlayerComp','openMatchDetail','getNationalFlagSvg'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.match(app,/token !== playerModalTokens\[kind\]/);
 assert.match(app,/pendingSquadComp = squadPlayerCompMode/);
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Player modals initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitPlayerModals('bad'));
});
