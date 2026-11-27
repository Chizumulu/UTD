import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitClubExtras} from './club-extras-split.mjs';

test('club extras isolated and modal and tab entry points retained',async()=>{
 const source=readFileSync('app.js','utf8');
 const sponsorCssUrl='club-sponsors.css?v=0123456789abcdef';
 const {app,file,code}=await splitClubExtras(source,sponsorCssUrl);
 assert.ok(app.includes("loadOptionalAsset('"+sponsorCssUrl+"',null,true)"));
 assert.ok(app.includes('loadFeaturePanel(panel,loadClubSponsors,'));
 assert.equal(file,'club-extras.js');
 new Script(app);new Script(code);
 assert.ok(!app.includes('function getAllPostponedMatches('));
 assert.ok(!app.includes('ti-sponsor-grid-featured'));
 for(const name of ['renderTeamStoryTab','renderTeamStaffTab','openPostponedMatchesModal','closePostponedMatchesModal','renderPostponedMatchesModal'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 assert.ok(!app.includes('renderTeamStoryTab();\n    renderSquadView();'));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Club extras initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitClubExtras(source,'bad'),/Invalid sponsor CSS URL/);
 await assert.rejects(()=>splitClubExtras('bad',sponsorCssUrl),/Expected unique club extras source/);
});
