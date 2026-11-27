import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitVenueMap} from './venue-map-split.mjs';

test('venue map and routes isolated; travel analysis and public entry points retained',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitVenueMap(source);
 assert.equal(file,'venue-map.js');
 new Script(app);new Script(code);
 for(const name of ['getVenueEntries','populateVenueMap','decodeRoutePolyline','drawVenueRouteOn','renderVenuesList','highlightVenueMarker'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['renderVenuesView','applyVenueMode','setVenueMode','renderTravelImpactCard','getVenueRouteInfo','renderVenueLeafletMap','renderVenueLeafletMapLarge','openVenueMapModal','closeVenueMapModal','setVenueSort'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Venue map initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitVenueMap('bad'));
});
