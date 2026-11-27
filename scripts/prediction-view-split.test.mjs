import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import {minifyJs} from './minify-pages-assets.mjs';
import {splitPredictionView} from './prediction-view-split.mjs';

test('prediction view isolated while worker, cache and shared match helpers remain',async()=>{
 const source=readFileSync('app.js','utf8');
 const {app,file,code}=await splitPredictionView(source);
 assert.equal(file,'prediction-view.js');
 new Script(app);new Script(code);
 for(const name of ['renderPredictMySummary','renderRankLines','renderWhatIf','renderRankProbMatrix','renderScenarioTable','renderAiAutoCorrection','renderAiTeamCorrections','renderAiDCCorrection','renderXgScatterPlot'])assert.ok(!app.includes('function '+name+'('),name);
 for(const name of ['renderPredictions','drawPredictionTable','setPredictTab','renderAiTrackRecord','renderWhatIfQuick','requestPredictWorker','runMonteCarloSimulationAsync','wiFixtures','wiLoadTitleScenarios','wiSimulateFixture','sixPointerInfo','wiDeltaChip'])assert.ok(app.includes('function '+name+'('),name);
 assert.ok(app.includes('let predictionCache = null;'));
 assert.ok(app.includes(file+'?v='+createHash('sha256').update(code).digest('hex').slice(0,16)));
 const before=await minifyJs(source),after=await minifyJs(app);
 const savings=gzipSync(before).length-gzipSync(after).length;
 assert.ok(savings>0);
 console.log('Prediction view initial app bytes saved: '+(Buffer.byteLength(before)-Buffer.byteLength(after))+'; gzip bytes saved: '+savings+'; optional asset bytes: '+Buffer.byteLength(code));
 await assert.rejects(()=>splitPredictionView('bad'));
});
