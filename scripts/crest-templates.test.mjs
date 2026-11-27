import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyResponsiveCrests} from './crest-templates.mjs';

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
