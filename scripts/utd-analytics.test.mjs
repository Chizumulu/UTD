import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import tracker from '../utd-analytics.js';
const {screenInfo,makeTracker}=tracker;
const create=()=>{
 const events=[];
 const env={location:{origin:'https://chizumulu.github.io',pathname:'/UTD/',search:'?utm_source=test'},document:{referrer:'https://example.com/private?email=private#text',documentElement:{lang:'ko'}},gtag:(...args)=>events.push(args)};
 return {events,env,api:makeTracker(env)};
};
test('screen categories use canonical routes and bounded fields, including both cups',()=>{
 const expected=[
  ['',{},'home'],['league',{},'league'],['rounds/5?q=secret&status=upcoming',{},'rounds/week/round5'],
  ['rounds/month/2026-11?q=secret',{},'rounds/month/2026-11'],['club/chizumulu-united-fc/squad',{},'club/chizumulu-united-fc/squad'],
  ['stats/analysis/attack-defense',{},'stats/analysis'],['predict/model',{},'predict/model'],
  ['compare/team-a/team-b',{},'compare/team-a/team-b'],['match/id/utd-2026.team-a.team-b',{},'match/utd-2026.team-a.team-b'],
  ['cup',{cupId:'faCup2627',cupTab:'schedule'},'cup/faCup2627/schedule'],
  ['cup',{cupId:'mmbelwaCup',cupTab:'teams'},'cup/mmbelwaCup/teams'],
  ['archive/weekly',{},'archive/weekly'],['unknown',{},'home'],
  ['seo/matches/2026-27/utd-2026.team-a.team-b/',{},'seo/match/utd-2026.team-a.team-b'],
  ['seo/teams/chizumulu-united-fc/',{},'seo/chizumulu-united-fc/team']
 ];
 for(const [route,extra,screen_key] of expected)assert.equal(screenInfo({route,...extra}).screen_key,screen_key,route);
});
test('initial deep link and navigation send one custom event per changed screen, including return',()=>{
 const {api,events}=create();
 assert.equal(api.screen({route:'club/chizumulu-united-fc/squad',language:'ko'}),true);
 assert.equal(api.screen({route:'club/chizumulu-united-fc/squad',language:'en'}),false);
 assert.equal(api.screen({route:'rounds/5?q=secret',language:'en'}),true);
 assert.equal(api.screen({route:'rounds/5?q=changed&status=result',language:'en'}),false);
 assert.equal(api.screen({route:'club/chizumulu-united-fc/squad',language:'en'}),true);
 assert.deepEqual(events.map(x=>x[1]),Array(3).fill('utd_screen_view'));
 assert.deepEqual(events.map(x=>x[2].entry_type),['entry','navigation','navigation']);
 assert.ok(events.every(x=>x[2].send_to==='G-N6GC687TZD'&&x[2].page_location==='https://chizumulu.github.io/UTD/'&&x[2].page_referrer==='https://example.com'));
 assert.doesNotMatch(JSON.stringify(events),/secret|changed|private|utm_source|page_view"/);
});
test('actions keep screen context, reject arbitrary values and fail harmlessly with no tag',()=>{
 const {api,events,env}=create();
 api.screen({route:'cup',cupId:'mmbelwaCup',cupTab:'teams',language:'ko'});
 for(const [n,v] of [['utd_player_open','squad'],['utd_highlight_click','youtube'],['utd_poster_download','preview'],['utd_share_complete','clipboard'],['utd_notification_subscribe','web_push'],['utd_notification_unsubscribe','web_push'],['utd_calendar_download','next'],['utd_pwa_install','browser']])assert.equal(api.action(n,v),true);
 assert.equal(api.action('utd_share_complete','https://example.com/secret'),false);
 assert.equal(api.action('unregistered','x'),false);
 assert.equal(events.length,9);
 assert.ok(events.slice(1).every(x=>x[2].competition_id==='mmbelwaCup'&&x[2].screen_tab==='teams'));
 env.gtag=()=>{throw Error('blocked')};
 assert.equal(api.action('utd_pwa_install','browser'),false);
 assert.equal(api.screen({route:'league'}),false);
 delete env.gtag;
 assert.equal(api.screen({route:'league'}),false);
});
test('SPA loads tracker before app and preserves existing analytics tags and explicit hooks',()=>{
 const html=readFileSync('index.html','utf8'),app=readFileSync('app.js','utf8'),push=readFileSync('push-client.js','utf8');
 assert.ok(html.indexOf('utd-analytics.js?v=')<html.indexOf("document.write('<script src=\"app.js?v="));
 assert.match(html,/gtag\('config', 'G-N6GC687TZD'\)/);
 assert.match(html,/GTM-T7RRHPMN/);
 for(const key of ['recordAnalyticsScreen','utd_player_open','utd_highlight_click','utd_poster_download','utd_share_complete','utd_calendar_download','utd_pwa_install'])assert.ok(app.includes(key),key);
 assert.ok(push.includes('utd_notification_subscribe')&&push.includes('utd_notification_unsubscribe'));
 assert.match(app,/trackEvent\('compare_open'/);
});
