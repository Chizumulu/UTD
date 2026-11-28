import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prioritizeInitialRender} from './initial-render.mjs';
import {renderEarlyHero} from './early-hero.mjs';
test('early hero is appended only after app dependencies and retains normal startup fallback',()=>{
 const original=prioritizeInitialRender(readFileSync('app.js','utf8'));
 const updated=renderEarlyHero(original);
 const marker='// Early home hero: deep links retain the original startup path.';
 assert.ok(updated.indexOf(marker)>original.lastIndexOf('// ===== 후원 링크'));
 assert.match(updated,/if \(document.readyState === 'loading' && !location.hash\)/);
 assert.match(updated,/if \(!reuseEarlyHero\) renderNextMatchStripInner\(\)/);
 assert.match(updated,/earlyHero\.lang === isKorean/);
 assert.match(updated,/hero\.firstElementChild === earlyHero\.first/);
 assert.match(updated,/renderNextMatchStrip\(reuseEarlyHero\);\s*renderMainMiniTable\(\);/);
 assert.match(updated,/catch \(error\) \{ console.warn\('Early hero fallback:', error\); \}/);
 assert.throws(()=>renderEarlyHero('invalid input'));
});

test('narrow panels use the single deployment early hero path and existing conditions',()=>{
 const source=readFileSync('app.js','utf8');
 assert.doesNotMatch(source,/prepareInitialNarrowHero|initialNarrowHeroReady/);
 const updated=renderEarlyHero(prioritizeInitialRender(source));
 const marker='// Early home hero: deep links retain the original startup path.';
 assert.equal(updated.split(marker).length,2);
 const tail=updated.slice(updated.indexOf(marker));
 assert.match(tail,/if \(NMC_NARROW_MQ && NMC_NARROW_MQ\.matches\) \{\s*renderCupHeroPanel\(\);\s*nmcPlacePromo\(\);\s*renderPromoRaceStrip\(\);/);
 assert.match(tail,/document.readyState === 'loading' && !location.hash/);
 assert.match(updated,/renderNextMatchStrip\(reuseEarlyHero\);/);
});
