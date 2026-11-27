import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyResponsiveCrests,applyStaticCrests} from './crest-templates.mjs';

test('production templates retain original source and select responsive assets',()=>{
 const source=readFileSync('app.js','utf8');
 const name='라이플리.webp';
 const variant='crest-assets/0123456789abcdef-64.webp';
 const manifest={[name]:{width:477,height:523,variants:[{src:variant,width:58,height:64}]}};
 const result=applyResponsiveCrests(source,manifest);
 new vm.Script(result);
 const boundary=result.indexOf(source.slice(0,100));
 assert.ok(boundary>0);
 const prefix=result.slice(0,boundary);
 const context={document:{addEventListener(){}}};
 vm.runInNewContext(prefix,context);
 assert.match(context.utdResponsiveCrestAttrs(name,'24px'),/58w/);
 assert.match(context.utdResponsiveCrestAttrs('./'+name,'24px'),/sizes="24px"/);
 assert.equal(context.utdResponsiveCrestAttrs('dd.svg','24px'),'');
 assert.ok(result.includes('src="${team.logoSrc}"'));
 assert.ok(result.includes('utdResponsiveCrestAttrs(team.logoSrc, "24px")'));
});

test('home strips and static NRFA logos receive responsive attributes',()=>{
 const source=readFileSync('app.js','utf8');
 const manifest={'ddds.webp':{width:1000,height:946,variants:[{src:'crest-assets/0123456789abcdef-64.webp',width:64,height:61}]}};
 const result=applyResponsiveCrests(source,manifest);
 assert.equal(result.split('class="team-logo home-match-crest" ${utdResponsiveCrestAttrs(m.oppLogo, "32px")}').length-1,2);
 const html=applyStaticCrests(readFileSync('index.html','utf8'),manifest);
 for(const cls of ['league-logo','archive-hero-logo'])assert.ok(html.includes('class="'+cls+'" srcset="crest-assets/'));
 assert.ok(html.includes('src="./ddds.webp"'));
});
