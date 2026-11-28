import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {featureOwner,policies} from './feature-css-policy.mjs';
import {splitFeatureCss} from './feature-css-split.mjs';
test('shared race and venue selectors never defer',()=>{
 for(const selector of ['.path-finder-card','.path-finder-head','.pf-plan-grid','.pf-fixture-row','.pf-req-win','.pf-kicker','.venue-name',':root[data-theme="dark"] .pf-plan']) assert.equal(featureOwner(selector),null,selector);
 assert.equal(Object.hasOwn(policies,'pathfinder'),false);
});
test('full source CSS split preserves shared rules and cascade',async()=>{
 const css=readFileSync('style.css','utf8');
 const result=await splitFeatureCss(css);
 assert.equal(Object.hasOwn(result.assets,'pathfinder'),false);
 for(const selector of ['.path-finder-card','.pf-plan-grid','.pf-fixture-row']) assert.ok(result.critical.includes(selector),selector);
});
