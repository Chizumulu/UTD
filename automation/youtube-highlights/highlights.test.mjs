import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyHighlight} from './apply.mjs';
import {CHANNEL,parseFeed,eligible} from './rss.mjs';
const source=fs.readFileSync(new URL('../../data.js',import.meta.url),'utf8');
const v={channel:CHANNEL,id:'PL1cSweH95Y',published:'2026-10-03T00:00:00Z',title:'*본영상 미공개 경기* [26/27 치웨미 인베스트먼트 NRFA 리그 1] 11R(순연경기) 치주물루 유나이티드 vs 칠룸바 배럭스 FC 하이라이트'};
test('real postponed 11R fixture maps to round13 without changing existing URL',()=>{
 const r=applyHighlight(source,v); assert.equal(r.rk,'round13'); assert.equal(r.status,'duplicate'); assert.equal(r.source,source);
});
test('missing link is inserted only at round13',()=>{
 const without=source.replace(/^\s*round13:\s*['"]https:\/\/www\.youtube\.com\/watch\?v=PL1cSweH95Y['"],[^\n]*\n/m,'\n');
 assert.notEqual(without,source);
 const r=applyHighlight(without,v); assert.equal(r.status,'updated'); assert.equal(r.rk,'round13'); assert.match(r.source,/round13:\s*"https:\/\/www\.youtube\.com\/watch\?v=PL1cSweH95Y"/);
 assert.equal(applyHighlight(r.source,v).source,r.source);
});
test('protect existing link',()=>assert.throws(()=>applyHighlight(source,{...v,id:'abcdefghijk'}),/Existing highlight protected/));
test('reject mismatched season and competition',()=>{
 assert.throws(()=>applyHighlight(source,{...v,title:v.title.replace('26/27','25/26')}));
 assert.throws(()=>applyHighlight(source,{...v,title:v.title.replace('NRFA 리그 1','FA컵')}));
});
test('RSS channel and cutoff',()=>{
 const xml='<feed><entry><yt:videoId>'+v.id+'</yt:videoId><yt:channelId>'+CHANNEL+'</yt:channelId><title>'+v.title+'</title><published>'+v.published+'</published></entry></feed>';
 const entries=parseFeed(xml); assert.equal(entries.length,1); assert.equal(eligible(entries[0],Date.parse('2026-10-02')),true); assert.equal(eligible(entries[0],Date.parse(v.published)),false);
 assert.equal(parseFeed(xml.replace(CHANNEL,'wrong')).length,0);
});
