// Read-only match result watchdog. Malawi local time is UTC+02:00.
const H=3600000;
const root="https://raw.githubusercontent.com/Chizumulu/UTD/main/";
const terminal=/^(full[_ -]?time|ft|finished|final|ended|completed|match[_ -]?ended)$/i;
const excluded=/postpon|cancel|abandon|suspend|tbd/i;
const norm=x=>String(x??"").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
function team(x){const t=norm(x).replace(/\b(fc|sc|afc|club|football)\b/g," ").replace(/\s+/g," ").trim();return ({"vision academy":"vision s academy","mafu":"mafu stars","chibavi rs":"chibavi real stars"})[t]??t;}
const pair=(a,b)=>[team(a),team(b)].sort().join("|");
const score=x=>Number.isInteger(x)&&x>=0;
function dateOf(x){const s=String(x??"");const m=s.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):s.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]??"";}
export function kickoff(date,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date??"")||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time??""))return NaN;
 const t=Date.parse(date+"T"+time+":00+02:00");
 return Number.isFinite(t)&&new Date(t+2*H).toISOString().slice(0,10)===date?t:NaN;
}
export function leagueFixtures(source){
 const rows=[];
 for(const section of ["roundsData","scheduledRounds"]){
  const start=source.indexOf("const "+section+" = {"),end=source.indexOf("\n};",start);
  if(start<0||end<0)throw Error("Missing league section "+section);
  for(const [row] of source.slice(start,end).matchAll(/\{[^{}]*\}/g)){
   const str=k=>row.match(new RegExp("\\b"+k+"\\s*:\\s*[\"']([^\"']+)[\"']"))?.[1];
   const num=k=>{const v=row.match(new RegExp("\\b"+k+"\\s*:\\s*(\\d+)\\b"));return v?Number(v[1]):null;};
   const home=str("homeEn"),away=str("awayEn");
   if(!home||!away)continue;
   rows.push({competition:"nrfa_league_one",id:str("fixtureId"),home,away,homeKo:str("homeKo"),awayKo:str("awayKo"),date:str("kickoffDate"),time:str("kickoffTime"),homeScore:num("homeScore"),awayScore:num("awayScore"),excluded:/\b(postponed|cancelled|canceled|abandoned)\s*:\s*true\b/i.test(row)||excluded.test(str("status")??"")});
  }
 }
 if(!rows.length)throw Error("No league fixtures parsed");
 return rows;
}
export function cupFixtures(cup){
 if(cup?.id!=="faCup2627"||!Array.isArray(cup.rounds))throw Error("Invalid cup snapshot");
 return cup.rounds.flatMap((r,i)=>(r.matches??[]).map((f,j)=>({...f,id:f.id??"round:"+i+":match:"+j,competition:"faCup2627",excluded:f.postponed===true||f.cancelled===true||f.canceled===true||f.abandoned===true||excluded.test(f.status??"")})));
}
export function candidates(fixtures,now,start){
 const out=new Map();
 for(const f of fixtures){
  const t=kickoff(f.date,f.time);
  if(f.excluded||!f.home||!f.away||!f.id||!Number.isFinite(t)||t<start||now-t<4*H||now-t>7*24*H)continue;
  const key=f.competition+":"+f.id+":"+f.date+":"+f.time;
  // A scored duplicate must suppress an unscored copy.
  const old=out.get(key);
  if(old&&score(old.homeScore)&&score(old.awayScore))continue;
  out.set(key,{...f,key,t,stage:[24,12,4].find(h=>now-t>=h*H)});
 }
 return [...out.values()].filter(f=>!(score(f.homeScore)&&score(f.awayScore)));
}
function matches(f,m,competition){
 const code=String(competition??"").toLowerCase();
 const right=f.competition==="nrfa_league_one"?code==="nrfa_league_one":/^(fa_cup|presidential_fa_cup|facup2627|presidential_cup)$/.test(code);
 return right&&pair(f.home,f.away)===pair(m.homeTeam,m.awayTeam)&&f.date===dateOf(m.dateText);
}
export async function classify(f,items,kv){
 const hits=[];
 for(const item of items)for(const m of item.structured?.matches??[]){
  if(matches(f,m,m.competitionCode||item.structured?.competition?.code))hits.push(m);
 }
 if(hits.length&&hits.every(m=>excluded.test(m.status??"")))return null;
 const final=hits.filter(m=>terminal.test(m.status??"")&&score(m.homeScore)&&score(m.awayScore));
 if(!final.length)return "API 최근 조회 범위에서 확정 결과 미확인";
 for(const m of final){
  const stable=String(m.matchId||m.match_id||m.fixtureId||m.id||"").trim();
  const keys=f.competition==="faCup2627"?["cup:"+f.id+"|"+f.date]:[...(stable?["id:"+stable.toLowerCase()]:[]),norm(m.homeTeam)+"|"+norm(m.awayTeam)+"|"+f.date,norm(m.awayTeam)+"|"+norm(m.homeTeam)+"|"+f.date];
  for(const key of keys){
   const id=await kv.get("match:"+key);
   if(!id)continue;
   const raw=await kv.get("proposal:"+id);
   if(!raw)continue;
   const p=JSON.parse(raw);
   if(!p.state||["pending","held","awaiting_confirmation"].includes(p.state))return "WhatsApp 승인 또는 검토 대기";
   if(["approved","dispatching"].includes(p.state))return "승인 이후 사이트 반영 대기 또는 실패 가능";
   if(p.state==="rejected")return "기존 제안 거절됨";
  }
 }
 return "API 확정 결과 존재, 사이트 미반영 (처리 상태 확인 필요)";
}
export async function sendAlert(f,reason,env){
 const base=new URL(env.WHATSAPP_GRAPH_URL);
 if(base.protocol!=="https:"||base.hostname!=="graph.facebook.com")throw Error("Invalid WhatsApp Graph URL");
 const clean=x=>String(x).replace(/\s+/g," ").trim().slice(0,500);
 const values=[f.competition==="faCup2627"?"FA컵":"NRFA League One",(f.homeKo??f.home)+" vs "+(f.awayKo??f.away),new Date(f.t+9*H).toISOString().slice(0,16).replace("T"," ")+" KST",f.stage+"시간 이상",reason];
 const res=await fetch(base.href.replace(/\/$/,"")+"/"+encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)+"/messages",{method:"POST",headers:{Authorization:"Bearer "+env.WHATSAPP_ACCESS_TOKEN,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:env.WHATSAPP_ADMIN_WA_ID,type:"template",template:{name:env.MATCH_MISSING_TEMPLATE_NAME,language:{code:env.MATCH_MISSING_TEMPLATE_LANGUAGE||"ko"},components:[{type:"body",parameters:values.map(x=>({type:"text",text:clean(x)}))}]}})});
 if(!res.ok)throw Error("Missing alert WhatsApp HTTP "+res.status);
 const body=await res.json();if(!body.messages?.[0]?.id)throw Error("Missing alert not acknowledged");
}
export async function scanMissingMatches(env,{now=Date.now(),fetcher=fetch,send=sendAlert}={}){
 if(env.MATCH_MISSING_ENABLED!=="true")return;
 const kv=env.APPROVALS;
 try{
  const start=Date.parse(env.MATCH_MISSING_START_AT??"");
  if(!Number.isFinite(start)||!/(Z|[+-]\d{2}:\d{2})$/.test(env.MATCH_MISSING_START_AT??""))throw Error("Explicit MATCH_MISSING_START_AT required");
  const [a,b,c]=await Promise.all([root+"data.js",root+"automation/cup-sync/cup-snapshot.json","https://api.chizumulu.net/v1/structured?limit=40"].map(url=>fetcher(url,{cache:"no-store"})));
  if(!a.ok||!b.ok||!c.ok)throw Error("Match monitor source unavailable");
  const [source,cup,api]=await Promise.all([a.text(),b.json(),c.json()]);
  if(!Array.isArray(api.items))throw Error("Invalid structured API");
  let sent=0,detected=0;
  for(const f of candidates([...leagueFixtures(source),...cupFixtures(cup)],now,start)){
   const key="missing-match:"+f.key;
   const previous=Number(await kv.get(key)||0);
   if(previous>=f.stage)continue;
   const reason=await classify(f,api.items,kv);
   if(!reason)continue;
   detected++;
   console.log(JSON.stringify({event:"match_missing_detected",fixtureId:f.id,stage:f.stage,reason}));
   if(!env.MATCH_MISSING_TEMPLATE_NAME)continue;
   await send(f,reason,env);
   await kv.put(key,String(f.stage),{expirationTtl:14*86400});sent++;
  }
  console.log(JSON.stringify({event:"match_missing_scan_completed",detected,sent}));
 }catch(e){console.error(JSON.stringify({event:"match_missing_scan_failed",error:e.message??String(e)}));}
}
