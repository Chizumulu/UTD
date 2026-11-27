import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitCupView} from './cup-view-split.mjs';

test('cup view isolated while shared fixture cards and routes remain',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitCupView(source);
 assert.equal(file,'cup-view.js');
 new Script(app);new Script(code);
 for(const name of ['cupBracketHtml','cupRegionalDrawHtml','cupClusterTablesHtml','cupProgressHtml','cupMyMatchesHtml','cupKrwOf','cupBracketTeamTiers'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['renderCupView','showCupView','setCupMode','setCupTab','selectCup','cupMatchCardHtml','cupAnnouncedLineupHtml','announcedBenchHtml','cupLogoSrc','cupMyVenueType','cupHomeAwayKnown','getSelectedCup','renderCupHeroPanel','listMyCupFixtures'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Cup view initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitCupView('bad'));
});
