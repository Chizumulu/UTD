import vm from 'node:vm';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';

export const BASE='https://chizumulu.github.io/UTD/';
const CLUB='Chizumulu United FC';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const slug=x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const scored=m=>[m.homeScore,m.awayScore].every(n=>Number.isInteger(n)&&n>=0);
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const safeId=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9.-]{0,127}$/.test(x);
const link=(path,label)=>'<a href="'+esc(BASE+path)+'">'+esc(label)+'</a>';
const json=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const matchName=m=>(m.homeKo||m.homeEn)+' vs '+(m.awayKo||m.awayEn);
const status=m=>m.postponed?'연기':m.cancelled||m.canceled?'취소':scored(m)?(m.forfeit?'몰수 판정':'경기 결과'):'결과 미등록';
const score=m=>scored(m)?m.homeScore+' : '+m.awayScore:'–';
const date=m=>validDate(m.kickoffDate)?m.kickoffDate:'일정 미정';
const isClub=m=>m.homeEn===CLUB||m.awayEn===CLUB;

export function readSeoData(source){
 const names=['leagueData','scheduledRounds','roundsData','matchDetails','matchHighlights','squadData','cupTournaments'];
 const arrays=new Set(['leagueData','squadData','cupTournaments']);
 const declarations=names.map(name=>{
  const end=arrays.has(name)?'\\]':'\\}';
  const found=source.match(new RegExp('^const '+name+' = [\\s\\S]*?^'+end+'[ \\t]*;','m'));
  if(!found)throw Error('SEO source declaration missing: '+name);
  return found[0];
 });
 return vm.runInNewContext(declarations.join('\n')+'\n;({'+names.join(',')+'})',Object.create(null),{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
}
export function activeFixtures(d){
 const map=new Map();
 for(const source of [d.scheduledRounds,d.roundsData])for(const [round,rows] of Object.entries(source)){
  for(const m of rows){
   if(m.byeKo||m.byeEn||m.movedToWeek||!m.homeEn||!m.awayEn)continue;
   if(!safeId(m.fixtureId))throw Error('Invalid fixture ID for SEO');
   const old=map.get(m.fixtureId);
   if(old&&old.round!==round)throw Error('Duplicate active fixture '+m.fixtureId);
   map.set(m.fixtureId,{...old,...m,round});
  }
 }
 return [...map.values()].sort((a,b)=>(a.kickoffDate||'9999').localeCompare(b.kickoffDate||'9999')||a.fixtureId.localeCompare(b.fixtureId));
}
function matchPath(m){return 'matches/2026-27/'+m.fixtureId+'/';}
function teamPath(t){return 'teams/'+slug(t.nameEn)+'/';}
function youtube(value){try{const u=new URL(value);return u.protocol==='https:'&&['www.youtube.com','youtube.com','youtu.be'].includes(u.hostname)?u.href:null;}catch{return null;}}
function scorerDetails(d,m){
 if(!scored(m)||m.forfeit)return null;
 if(m.scorersHome||m.scorersAway)return m;
 const h=m.homeKo?.split(' ')[0],a=m.awayKo?.split(' ')[0];
 const hits=(d.matchDetails[m.round]||[]).filter(x=>x.match?.trim()===h+' '+m.homeScore+' : '+a+' '+m.awayScore);
 return hits.length===1?hits[0]:null;
}
function htmlPage(path,title,description,body,schema){
 const canonical=BASE+path;
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(title)+' | 치주물루 유나이티드 팬사이트</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="website"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta property="og:image" content="'+BASE+'og-image.jpg"><meta property="og:locale" content="ko_KR"><link rel="icon" href="'+BASE+'favicon.ico">'+(schema?'<script type="application/ld+json">'+json({'@context':'https://schema.org',...schema})+'</script>':'')+'<style>body{font:16px/1.65 system-ui,sans-serif;margin:0;background:#f5f7fb;color:#172033}main,nav,footer{max-width:900px;margin:auto;padding:18px 22px}header{background:#033990;color:#fff}header a{color:#fff}nav{display:flex;flex-wrap:wrap;gap:18px}a{color:#033990}main{background:white;min-height:45vh}h1{line-height:1.3}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}.scroll{overflow-x:auto}footer{font-size:.9rem} @media(prefers-color-scheme:dark){body,main{background:#161b26;color:#eef2ff}a{color:#a7c8ff}th,td{border-color:#394051}}</style></head><body><header><nav>'+link('','UTD 홈')+' '+link('matches/','경기 일정·결과')+' '+link('league/','리그 기록')+' '+link('teams/','구단')+' '+link('players/','선수단')+' '+link('cup/','FA컵')+'</nav></header><main><h1>'+esc(title)+'</h1>'+body+'</main><footer>치주물루 유나이티드 FC 비공식 팬사이트 · '+link('','기존 UTD 사이트 및 상세 분석 보기')+'</footer></body></html>';
}
const table=(heads,rows)=>'<div class="scroll"><table><thead><tr>'+heads.map(x=>'<th scope="col">'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
function matchTable(rows,paths){return table(['날짜','경기','스코어','상태'],rows.map(m=>[esc(date(m)),paths.has(m.fixtureId)?link(matchPath(m),matchName(m)):esc(matchName(m)),esc(score(m)),esc(status(m))]));}
export function generateSeo(d){
 const pages=new Map(),rows=activeFixtures(d),clubRows=rows.filter(isClub);
 const detailRows=clubRows.filter(m=>validDate(m.kickoffDate)||scored(m));
 const paths=new Set(detailRows.map(m=>m.fixtureId));
 function add(path,title,desc,body,schema){if(pages.has(path))throw Error('Duplicate SEO path '+path);pages.set(path,htmlPage(path,title,desc,body,schema));}
 add('matches/','치주물루 유나이티드 경기 일정 및 결과','2026/27 NRFA 리그 원 치주물루 유나이티드 경기 일정, 결과 및 하이라이트.', '<p>2026/27 NRFA 리그 원 등록 경기. 날짜와 시간은 변경될 수 있습니다.</p>'+matchTable(clubRows,paths));
 for(const m of detailRows){
  const title=matchName(m)+' '+(scored(m)?score(m)+' '+status(m):'경기 일정');
  const desc=date(m)+' · 2026/27 NRFA 리그 원 · '+matchName(m)+' · '+status(m)+(scored(m)?' '+score(m):'');
  const details=scorerDetails(d,m);
  const video=youtube(d.matchHighlights[m.round]);
  let body='<p>'+esc(desc)+'</p><p>'+esc(m.homeEn)+' vs '+esc(m.awayEn)+'</p><dl><dt>경기일 (말라위 현지)</dt><dd>'+esc(date(m))+'</dd><dt>등록 킥오프 시간</dt><dd>'+esc(m.kickoffTime||'미정')+' (현지 기준, 변경 가능)</dd><dt>등록 결과</dt><dd>'+esc(score(m)+' · '+status(m))+'</dd></dl>';
  if(details)body+='<h2>득점 기록</h2><p>'+esc(m.homeKo||m.homeEn)+': '+esc(details.scorersHome||'미등록')+'</p><p>'+esc(m.awayKo||m.awayEn)+': '+esc(details.scorersAway||'미등록')+'</p>';
  if(video&&clubRows.filter(x=>x.round===m.round).length===1&&!m.postponed&&!m.forfeit&&scored(m))body+='<h2>하이라이트</h2><p><a href="'+esc(video)+'">유튜브 경기 하이라이트 보기</a></p>';
  body+='<p>'+link('matches/','전체 경기 일정 및 결과')+'</p>';
  // No event rich-result claims for completed, provisional or forfeited fixtures.
  const schema={'@type':'WebPage',name:title,url:BASE+matchPath(m),description:desc,inLanguage:'ko'};
  add(matchPath(m),title,desc,body,schema);
 }
 add('league/','NRFA 리그 원 경기 기록','2026/27 말라위 NRFA League One 경기 일정 및 결과.', '<p>리그에 등록된 경기 기록입니다. 공식 순위표와 반영 시점이 다를 수 있습니다.</p>'+matchTable(rows,paths)+'<p>'+link('teams/','구단별 경기 기록 보기')+'</p>');
 add('teams/','NRFA 리그 원 참가 구단','2026/27 NRFA League One 참가 구단과 경기 기록.', '<ul>'+d.leagueData.map(t=>'<li>'+link(teamPath(t),t.nameKo)+' · '+esc(t.nameEn)+'</li>').join('')+'</ul>');
 for(const t of d.leagueData){
  const games=rows.filter(m=>m.homeEn===t.nameEn||m.awayEn===t.nameEn);
  add(teamPath(t),t.nameKo+' 경기 일정 및 결과',t.nameEn+' · 2026/27 NRFA 리그 원 경기 기록.', '<p>'+esc(t.nameEn)+'</p><p>등록 홈구장: '+esc(t.venue?.nameKo||t.venue?.nameEn||'미등록')+'</p>'+matchTable(games,paths),{'@type':'SportsTeam',name:t.nameEn,alternateName:t.nameKo,sport:'Soccer',url:BASE+teamPath(t)});
 }
 add('players/','치주물루 유나이티드 선수단','치주물루 유나이티드 FC 등록 선수단과 등번호, 포지션.',table(['등번호','선수','포지션'],d.squadData.map(p=>[esc(p.number??'미정'),esc(p.nameKo+' · '+p.nameEn),esc(p.position)])));
 const cup=d.cupTournaments.find(c=>c.id==='faCup2627');
 if(!cup)throw Error('FA Cup source missing');
 let cupBody='<p>'+esc(cup.descKo)+'</p>';
 for(const r of cup.rounds||[]){
  cupBody+='<h2>'+esc(r.labelKo)+'</h2>'+table(['경기','날짜','스코어'],(r.matches||[]).filter(Boolean).map(m=>[esc((m.homeKo||m.home||'미정')+' vs '+(m.awayKo||m.away||'미정')),esc(validDate(m.date)?m.date:'미정'),esc(scored(m)?score(m)+(m.forfeit?' (몰수)':''):'–')]));
 }
 add('cup/','26/27 대통령배 FA컵 대진 및 결과','말라위 대통령배 FA컵 대회 안내와 등록 대진표, 경기 결과.',cupBody);
 return pages;
}
export function writeSeo(output,source){
 const pages=generateSeo(readSeoData(source));
 for(const [path,html] of pages){const file=join(output,path,'index.html');mkdirSync(dirname(file),{recursive:true});writeFileSync(file,html);}
 const urls=['',...pages.keys()];
 writeFileSync(join(output,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(p=>'  <url><loc>'+esc(BASE+p)+'</loc></url>').join('\n')+'\n</urlset>\n');
 const home=join(output,'index.html');
 const html=readFileSync(home,'utf8');
 if(!html.includes('</body>'))throw Error('Main HTML body missing');
 const nav='<nav aria-label="경기 기록 바로가기" style="text-align:center;padding:12px;font-size:13px">'+['matches/','league/','teams/','players/','cup/'].map((p,i)=>link(p,['치주물루 경기 일정·결과','리그 경기 기록','참가 구단','선수단','FA컵'][i])).join(' · ')+'</nav>';
 writeFileSync(home,html.replace('</body>',nav+'\n</body>'));
 console.log('SEO pages generated: '+pages.size);
 return pages.size;
}
