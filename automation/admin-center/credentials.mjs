// Read-only probes. Never persist upstream bodies, credentials or raw exceptions.
export const KEY='admin-center:v1:credentials';
const DAY=86400000;
export function expiryStatus(value,now=Date.now()){
 const expiresAt=typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 if(!expiresAt)return {status:'valid',expiresAt:null};
 const left=Date.parse(expiresAt)-now;
 return {status:left<=0?'expired':left<=7*DAY?'critical':left<=30*DAY?'warning':'valid',expiresAt};
}
async function probe(name,url,token,validate,fetcher,now){
 if(!token||!url)return {name,status:'not_configured',expiresAt:null};
 try{
  const r=await fetcher(url,{method:'GET',redirect:'error',headers:{authorization:'Bearer '+token,accept:'application/json','user-agent':'UTD-credential-monitor'},signal:AbortSignal.timeout(15000)});
  let body;try{body=await r.json()}catch{}
  const result={name,httpStatus:r.status,expiresAt:null};
  const metaCode=Number(body?.error?.code);
  if(r.status===401||metaCode===190)return {...result,status:'auth_failed'};
  if(r.status===429||(r.status===403&&r.headers.get('x-ratelimit-remaining')==='0'))return {...result,status:'rate_limited'};
  if(r.status===403||[10,200].includes(metaCode))return {...result,status:'permission_denied'};
  if(!r.ok||body?.error)return {...result,status:'probe_failed'};
  if(!validate(body))return {...result,status:'unexpected_response'};
  return {...result,...expiryStatus(r.headers.get('github-authentication-token-expiration'),now)};
 }catch{return {name,status:'unavailable',expiresAt:null}}
}
export async function checkCredentials(env,{fetcher=fetch,now=Date.now()}={}){
 let graph=null;
 try{const u=new URL(env.WHATSAPP_GRAPH_URL);if(u.origin==='https://graph.facebook.com'&&/^\/v\d+\.\d+\/?$/.test(u.pathname)&&!u.username&&!u.password&&!u.search&&!u.hash)graph=u.origin+u.pathname.replace(/\/$/,'')}catch{}
 const id=v=>/^\d{5,30}$/.test(String(v??''))?String(v):null;
 const phone=id(env.WHATSAPP_PHONE_NUMBER_ID),waba=id(env.WHATSAPP_BUSINESS_ACCOUNT_ID);
 const instagram='https://graph.facebook.com/v27.0/17841454923295450?fields=business_discovery.username(chizumuluutd)%7Busername%7D';
 const checks=await Promise.all([
  probe('github_pat','https://api.github.com/user',env.GITHUB_TOKEN,b=>typeof b?.login==='string'&&b.login.length>0,fetcher,now),
  probe('whatsapp_phone',graph&&phone?graph+'/'+phone+'?fields=id':null,env.WHATSAPP_ACCESS_TOKEN,b=>String(b?.id)===phone,fetcher,now),
  probe('whatsapp_templates',graph&&waba?graph+'/'+waba+'/message_templates?fields=name,status,language&limit=1':null,env.WHATSAPP_ACCESS_TOKEN,b=>Array.isArray(b?.data),fetcher,now),
  env.INSTAGRAM_LINEUP_ENABLED==='true'||env.UTD_INSTAGRAM_TOKEN?probe('instagram_token',instagram,env.UTD_INSTAGRAM_TOKEN,b=>b?.business_discovery?.username==='chizumuluutd',fetcher,now):Promise.resolve({name:'instagram_token',status:'disabled',expiresAt:null})
 ]);
 return {version:1,checkedAt:now,checks};
}
export async function monitorCredentialsIfDue(env,{now=Date.now(),fetcher=fetch}={}){
 if(env.ADMIN_CENTER_ENABLED!=='true')return;
 const old=await env.APPROVALS.get(KEY,'json');
 if(Number.isFinite(old?.checkedAt)&&old.checkedAt<=now&&now-old.checkedAt<DAY)return;
 const report=await checkCredentials(env,{now,fetcher});
 await env.APPROVALS.put(KEY,JSON.stringify(report),{expirationTtl:7*86400});
 console.log(JSON.stringify({event:'credential_monitor_completed',...report}));
 return report;
}
