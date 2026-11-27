// Minimal public health report: no credentials, match data or exception text.
export const KEY="health-monitor:v1:cron";
const MAX_AGE=40*60*1000;
export async function monitorCron(env,tasks,{now=Date.now}={}){
 const startedAt=now();
 const results=await Promise.all(tasks.map(async ({name,enabled,run})=>{
  if(!enabled)return {name,status:"disabled"};
  try{const result=await run();return {name,status:result?.ok===false?"failed":"ok"};}
  catch{return {name,status:"failed"};}
 }));
 const finishedAt=now();
 let previous;
 try{previous=await env.APPROVALS.get(KEY,"json");}catch{}
 const checks=results.map(r=>({...r,consecutiveFailures:r.status==="failed"?(previous?.checks?.find(x=>x.name===r.name)?.consecutiveFailures??0)+1:0}));
 const report={startedAt,finishedAt,checks};
 await env.APPROVALS.put(KEY,JSON.stringify(report),{expirationTtl:7*86400});
 console.log(JSON.stringify({event:"automation_health_summary",...report}));
 return report;
}
export function assess(report,now=Date.now()){
 if(!report||!Number.isFinite(report.finishedAt)||!Array.isArray(report.checks)||report.finishedAt>now+60000)return {ok:false,status:"uninitialized",checks:[]};
 const stale=now-report.finishedAt>MAX_AGE;
 const failed=report.checks.some(c=>c.status==="failed"&&c.consecutiveFailures>=3);
 return {ok:!stale&&!failed,status:stale?"stale":failed?"degraded":"ok",finishedAt:report.finishedAt,checks:report.checks.map(({name,status,consecutiveFailures})=>({name,status,consecutiveFailures}))};
}
export async function healthResponse(env){
 if(env.HEALTH_MONITOR_ENABLED!=="true")return Response.json({ok:false,status:"disabled"},{status:503,headers:{"Cache-Control":"no-store"}});
 try{const report=assess(await env.APPROVALS.get(KEY,"json"));return Response.json(report,{status:report.ok?200:503,headers:{"Cache-Control":"no-store"}});}
 catch{return Response.json({ok:false,status:"storage_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
