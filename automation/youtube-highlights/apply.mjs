import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parse} from 'acorn';
import {CHANNEL} from './rss.mjs';
const key = p => p.key.name ?? p.key.value;
const prop = (n,k) => n?.type==='ObjectExpression' ? n.properties.find(p=>p.type==='Property'&&key(p)===k) : undefined;
const val = (n,k) => prop(n,k)?.value?.value;
const norm = s => String(s??'').normalize('NFKC').toLowerCase().replace(/\bfc\b/g,'').replace(/[^\p{L}\p{N}]/gu,'');
const club = s => ['치주물루','치주물루유나이티드','chizumuluunited'].includes(norm(s));
const same = (name,...aliases) => aliases.some(a=>norm(a)&&norm(name)===norm(a)) || (club(name)&&aliases.some(club));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function applyHighlight(source,video) {
  if(video.channel!==CHANNEL||!/^[A-Za-z0-9_-]{11}$/.test(video.id)||!Number.isFinite(Date.parse(video.published))) throw Error('Invalid video');
  const title=video.title;
  if(!/하이라이트/.test(title)||!/치주물루|chizumulu\s+united/i.test(title)) throw Error('Not a club highlight');
  if(!/\b(?:2026|26)\s*[/–-]\s*(?:2027|27)\b/.test(title)) throw Error('Season not verified');
  if(/FA\s*컵|FA\s*Cup/i.test(title)) return applyCupHighlight(source,video);
  if(!/NRFA/i.test(title)||!/리그\s*(?:1|원)|league\s*(?:one|1)/i.test(title)) throw Error('League not verified');
  const round=title.match(/\b(\d+)\s*R\b/i);
  const pair=title.replace(/^.*\]/,'').replace(/^\s*\d+\s*R\s*(?:\([^)]*\))?\s*/i,'').replace(/\s*하이라이트.*$/,'').trim().split(/\s+vs\.?\s+/i);
  if(pair.length!==2||club(pair[0])===club(pair[1])) throw Error('Teams not verified');
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
  const declarations=new Map(ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).map(d=>[d.id.name,d.init]));
  const highlights=declarations.get('matchHighlights');
  const rounds=declarations.get('roundsData');
  if(highlights?.type!=='ObjectExpression'||rounds?.type!=='ObjectExpression') throw Error('Data schema changed');
  const makeup=declarations.get('MAKEUP_ROUND_KEYS')?.elements?.map(x=>x.value)??[];
  const hits=[];
  for(const p of rounds.properties){
    const rk=key(p); if(!/^round\d+$/.test(rk)||p.value.type!=='ArrayExpression')continue;
    for(const f of p.value.elements){
      if(val(f,'postponed')||val(f,'forfeit')||!Number.isInteger(val(f,'homeScore'))||!Number.isInteger(val(f,'awayScore')))continue;
      if(!same(pair[0],val(f,'homeKo'),val(f,'homeEn'))||!same(pair[1],val(f,'awayKo'),val(f,'awayEn')))continue;
      const id=val(f,'fixtureId'), date=val(f,'kickoffDate');
      if(id!=='utd-2026.'+slug(val(f,'homeEn'))+'.'+slug(val(f,'awayEn'))||!date||!Number.isFinite(Date.parse(date))||Date.parse(date)>Date.parse(video.published))continue;
      const n=Number(rk.slice(5)),regular=n-makeup.filter(k=>Number(k.slice(5))<=n).length;
      if(round&&![n,regular,val(f,'movedFromWeek')].includes(Number(round[1])))continue;
      hits.push({rk,id});
    }
  }
  if(hits.length!==1)throw Error('No unique completed fixture: '+hits.length);
  const {rk,id}=hits[0];
  if(source.includes('watch?v='+video.id)||source.includes('youtu.be/'+video.id))return {source,status:'duplicate',rk,id};
  if(prop(highlights,rk))throw Error('Existing highlight protected: '+rk);
  const url='https://www.youtube.com/watch?v='+video.id;
  const first=highlights.properties[0];
  const at=first?.start??highlights.start+1;
  const updated=source.slice(0,at)+rk+': '+JSON.stringify(url)+(first?',\n  ':'')+source.slice(at);
  parse(updated,{ecmaVersion:'latest',sourceType:'script'});
  return {source:updated,status:'updated',rk,id};
}

function applyCupHighlight(source,video){
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'});
  const decl=new Map(ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).map(d=>[d.id.name,d.init]));
  const cups=decl.get('cupTournaments');
  const cup=cups?.elements?.find(n=>val(n,'id')==='faCup2627');
  if(!cup)throw Error('Cup schema changed');
  const pair=video.title.replace(/^.*\]/,'').replace(/^\s*(?:북부\s*)?(?:지역\s*)?(?:\d+\s*(?:R|라운드)|32강|16강|8강|4강|결승)\s*/i,'').replace(/\s*하이라이트.*$/,'').trim().split(/\s+vs\.?\s+/i);
  if(pair.length!==2||club(pair[0])===club(pair[1]))throw Error('Cup teams not verified');
  const hits=[];
  for(const round of prop(cup,'rounds')?.value?.elements??[]){
    for(const f of prop(round,'matches')?.value?.elements??[]){
      if(val(f,'postponed')||val(f,'forfeit')||!Number.isInteger(val(f,'homeScore'))||!Number.isInteger(val(f,'awayScore')))continue;
      if(!same(pair[0],val(f,'homeKo'),val(f,'home'))||!same(pair[1],val(f,'awayKo'),val(f,'away')))continue;
      const date=val(f,'date');
      if(!date||!Number.isFinite(Date.parse(date))||Date.parse(date)>Date.parse(video.published))continue;
      hits.push({f,id:val(f,'id')??[val(round,'labelEn'),val(f,'home'),val(f,'away'),date].join('|')});
    }
  }
  if(hits.length!==1)throw Error('No unique completed cup fixture: '+hits.length);
  const {f,id}=hits[0];
  const url='https://www.youtube.com/watch?v='+video.id;
  if(source.includes('watch?v='+video.id)||source.includes('youtu.be/'+video.id))return {source,status:'duplicate',id,rk:'faCup2627'};
  if(prop(f,'highlight'))throw Error('Existing cup highlight protected');
  const first=f.properties[0];
  const updated=source.slice(0,first.start)+'highlight: '+JSON.stringify(url)+', '+source.slice(first.start);
  parse(updated,{ecmaVersion:'latest',sourceType:'script'});
  return {source:updated,status:'updated',id,rk:'faCup2627'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const video=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')).client_payload.video;
  const source=fs.readFileSync('data.js','utf8');
  const result=applyHighlight(source,video);
  console.log(JSON.stringify({status:result.status,round:result.rk,fixtureId:result.id}));
  if(result.source!==source)fs.writeFileSync('data.js',result.source);
}
