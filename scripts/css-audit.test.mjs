import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze,selectorOwners,mergeRanges,coverage,completeness,markdown} from './css-audit.mjs';
test('selector lists preserve functional commas and protect mixed/unknown selectors',()=>{
 assert.equal(selectorOwners('.cup-card:is(.a,.b), .nmh-team').classification,'mixed');
 assert.equal(selectorOwners('.cup-card, .unclassified').classification,'mixed');
 assert.equal(selectorOwners('.cup-card[data-x="a,b"]').classification,'cup');
 assert.equal(selectorOwners('.modal-body').classification,'shared');
});
test('parser tracks wrappers, duplicate selectors, variables and animation declarations',()=>{
 const a=analyze(':root{--x:1}.cup-card{color:var(--x);animation:spin 1s}@media(max-width:600px){.cup-card{color:red!important}}@keyframes spin{from{opacity:0}to{opacity:1}}');
 assert.equal(a.rules.length,3);assert.equal(a.groups.cup.rules,2);assert.equal(a.repeatedSelectors.length,1);assert.deepEqual(a.variables['--x'].definitions,[0]);assert.deepEqual(a.variables['--x'].uses,[1]);assert.equal(a.atRules.keyframes,1);assert.equal(a.rules[2].declarations[0].important,true);
});
test('range union is deduplicated and sorted',()=>assert.deepEqual(mergeRanges([{start:3,end:9},{start:0,end:5},{start:9,end:10}]),[{start:0,end:10}]));
test('coverage distinguishes complete, partial and unobserved rules with unicode offsets',()=>{
 const css='/* 한글 */.cup-a{color:red}.cup-b{color:blue}.venue-a{color:black}',a=analyze(css);
 const [x,y,z]=a.rules;
 assert.equal(css.slice(x.start,x.end),'.cup-a{color:red}');
 const c=coverage(css,a,[{name:'one',ranges:[{start:x.start,end:x.end},{start:y.start,end:y.start+2}]}]);
 assert.deepEqual(c.union.used,[x.id]);assert.deepEqual(c.union.partial,[y.id]);assert.deepEqual(c.union.unused,[z.id]);assert.equal(c.byGroup.venue.unobservedDeclarations,1);
});

test('complete audit requires exact unique manifest matches and no failures',()=>{
 const a={name:'a',ranges:[]},b={name:'b',ranges:[]};
 assert.equal(completeness([a,b],['a','b']).complete,true);
 assert.equal(completeness([a],['a','b']).complete,false);
 assert.deepEqual(completeness([a],['a','b']).missing,['b']);
 assert.equal(completeness([a,a],['a','b']).complete,false);
 assert.equal(completeness([a,b],['a','b'],[{name:'b'}]).complete,false);
 assert.equal(completeness([a,b],['a','c']).complete,false);
 assert.equal(completeness([],[]).complete,false);
});
test('partial report prominently warns against extraction',()=>{
 const css='.cup-a{color:red}',a=analyze(css),c=coverage(css,a,[]);
 c.completeness=completeness([],['desktop/cup'],[{name:'desktop/cup'}]);
 assert.match(markdown(a,c),/INCOMPLETE — PARTIAL COVERAGE; NOT SAFE FOR EXTRACTION/);
 assert.match(markdown(a,c),/Successful: 0\/1; failed: 1/);
 assert.match(markdown(a,c),/Missing: desktop\/cup/);
});
