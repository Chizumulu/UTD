import {test} from 'node:test';
import assert from 'node:assert/strict';
import {diagnose,aggregateDiagnostics,diagnosticMarkdown} from './lighthouse-comparison-diagnostics.mjs';
const audit=(items,extra={})=>({details:{items,...extra}});
const fixture=(port=8081)=>({lighthouseVersion:'12.8.2',audits:{
 'mainthread-work-breakdown':audit([{group:'scriptEvaluation',duration:150}]),
 'bootup-time':audit([{url:'http://127.0.0.1:'+port+'/UTD/app.js?v=1',total:100,scripting:75,scriptParseCompile:25}]),
 'unused-css-rules':audit([{url:'http://127.0.0.1:'+port+'/UTD/style.css',totalBytes:1000,wastedBytes:800}],{overallSavingsBytes:800}),
 'largest-contentful-paint-element':audit([{node:{type:'node',selector:'.hero',snippet:'<div>'}},{phase:'TTFB',timing:50}]),
 'render-blocking-resources':audit([{url:'http://127.0.0.1:'+port+'/UTD/style.css',wastedMs:200}],{overallSavingsMs:200}),
 'network-requests':audit([{resourceType:'Script',transferSize:20,resourceSize:100},{resourceType:'Script',transferSize:30,resourceSize:150}]),
 'layout-shift-elements':audit([{node:{type:'node',selector:'.card'}}]),
 'uses-responsive-images':audit([{url:'https://example.org/image.png',wastedBytes:100}],{overallSavingsBytes:100})
}});
test('extracts legacy CPU, CSS, LCP, rendering, network and CLS audits',()=>{
 const d=diagnose(fixture());
 assert.equal(d.cpu[0].durationMs,150);assert.equal(d.js[0].url,'/UTD/app.js');
 assert.equal(d.js[0].scriptParseCompileMs,25);assert.equal(d.css.listedWastePercent,80);
 assert.equal(d.lcp.elements[0].selector,'.hero');assert.equal(d.lcp.phases[0].durationMs,50);
 assert.equal(d.renderBlocking.savingsMs,200);assert.equal(d.networkByType[0].transferBytes,50);
 assert.equal(d.cls.elements[0].selector,'.card');assert.equal(d.images['uses-responsive-images'].savingsBytes,100);
});
test('retains nested insight details and node evidence',()=>{
 const d=diagnose({audits:{'lcp-breakdown-insight':audit([{items:[{node:{type:'node',selector:'#hero'}},{phase:'Render delay',duration:45}]}]),'render-blocking-insight':audit([{url:'https://example.org/a.css'}])}});
 assert.equal(d.lcp.elements[0].selector,'#hero');assert.equal(d.lcp.phases[0].durationMs,45);
 assert.equal(d.renderBlocking.insightDetails.length,1);assert.equal(d.css.wastedBytes,null);
});
test('missing and not-applicable audits remain missing rather than zero',()=>{
 const d=diagnose({audits:{'unused-css-rules':{scoreDisplayMode:'notApplicable',details:{items:[]}}}});
 assert.equal(d.cpu,null);assert.equal(d.css.rows,null);assert.equal(d.css.wastedBytes,null);
 assert.equal(d.networkByType,null);assert.equal(aggregateDiagnostics([d]).cssWaste.median,null);
});
test('aggregates equivalent local paths and reports observed-only coverage',()=>{
 const a=diagnose(fixture()),b=diagnose(fixture(8082)),missing=diagnose({});
 const result=aggregateDiagnostics([a,b,missing]);
 assert.equal(result.js.rows.length,1);assert.deepEqual(result.js.rows[0].totalMs,{median:100,available:2,samples:3});
 assert.equal(result.cssWaste.available,2);
 const md=diagnosticMarkdown({mobile:{before:aggregateDiagnostics([a,missing]),after:aggregateDiagnostics([b,b])}});
 assert.match(md,/100 \(1\/2\)/);assert.match(md,/LCP elements/);assert.match(md,/\.hero/);
 assert.match(md,/Missing audits\/rows are not zero/);
});
