import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitArchiveView} from './archive-view-split.mjs';

test('archive view rendering isolated while data and navigation remain in initial app',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitArchiveView(source);
 assert.equal(file,'archive-view.js');
 new Script(app);new Script(code);
 for(const name of ['buildArchiveClubHtml','buildArchiveScorersHtml','buildArchiveMatchesHtml','renderArchiveTeamGrid','archiveLogoHtml'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['openSeasonArchive','exitSeasonArchive','setArchiveMode','setArchiveTab','loadArchiveData','prepareArchiveForView','archiveDataReady','renderArchiveMain','renderArchiveClubs','renderArchive','closeArchiveTeamModal'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.ok(app.includes('if (archiveEntryPending || !archiveDataReady())'));
 assert.ok(app.includes('if (request !== archiveEntryRequest) return;'));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Archive view initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitArchiveView('bad'));
});
