import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {expiryStatus,checkCredentials,monitorCredentialsIfDue,KEY} from './credentials.mjs';
import {dashboardResponse,dashboardData} from './dashboard.mjs';
const key='synthetic-only-admin-key-12345678901234567890',secret='synthetic-secret-never-return';
const now=Date.parse('2026-11-27T00:00:00Z'),day=86400000;
const env={ADMIN_CENTER_ENABLED:'true',ADMIN_CENTER_TOKEN:key,HEALTH_MONITOR_ENABLED:'true',GITHUB_TOKEN:secret,WHATSAPP_ACCESS_TOKEN:secret,WHATSAPP_GRAPH_URL:'https://graph.facebook.com/v27.0',WHATSAPP_PHONE_NUMBER_ID:'123456789',WHATSAPP_BUSINESS_ACCOUNT_ID:'987654321',META_APP_SECRET:secret};
const req=(path,token,method='GET')=>new Request('https://example.test/admin/dashboard'+path,{method,headers:token?{Authorization:'Bearer '+token}:{}});
test('expiration boundaries and unknown dates',()=>{
 for(const [days,status] of [[-1,'expired'],[0,'expired'],[7,'critical'],[8,'warning'],[30,'warning'],[31,'valid']])assert.equal(expiryStatus(new Date(now+days*day).toISOString(),now).status,status);
 assert.deepEqual(expiryStatus(null,now),{status:'valid',expiresAt:null});
});
test('probes only read approved origins and redact sensitive responses',async()=>{
 const urls=[];
 const r=await checkCredentials(env,{now,fetcher:async(url,opts)=>{
  urls.push(url);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.headers.authorization,'Bearer '+secret);
  if(url.includes('api.github.com/user'))return Response.json({login:'test',secret},{headers:{'github-authentication-token-expiration':new Date(now+6*day).toISOString()}});
  if(url.includes('123456789'))return Response.json({error:{code:190,message:secret}},{status:400});
  return Response.json({data:[{secret}]});
 }});
 assert.equal(urls.length,3);
 assert.deepEqual(r.checks.map(c=>c.status),['critical','auth_failed','valid','disabled']);
 assert.ok(!JSON.stringify(r).includes(secret));
});
test('untrusted Graph URL never receives credentials',async()=>{
 const urls=[];
 await checkCredentials({...env,WHATSAPP_GRAPH_URL:'https://evil.example/v27.0'},{fetcher:async(url)=>{urls.push(url);return Response.json({login:'test'})}});
 assert.deepEqual(urls,['https://api.github.com/user']);
});
test('unauthorized requests never access KV and disabled route stays closed',async()=>{
 const blocked={...env,APPROVALS:{get(){throw Error('must not read')}}};
 for(const token of [undefined,'wrong',secret])for(const path of ['/api','/credentials'])assert.equal((await dashboardResponse(req(path,token),blocked)).status,401);
 assert.equal((await dashboardResponse(req('/api',key),{...blocked,ADMIN_CENTER_TOKEN:''})).status,401);
 assert.equal((await dashboardResponse(req('',key),{...blocked,ADMIN_CENTER_ENABLED:'false'})).status,404);
 assert.equal((await dashboardResponse(req('/api',key,'POST'),blocked)).status,405);
});
test('public shell contains no secrets and uses strict CSP',async()=>{
 for(const path of ['', '.css','.js']){
  const r=await dashboardResponse(req(path),env),body=await r.text();
  assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  assert.ok(!body.includes(secret)&&!body.includes(key));
  if(path==='.js')new vm.Script(body);
 }
});
test('protected reports strip unknown credential fields and exclude secrets',async()=>{
 const current=Date.now();
 const kv={get:async k=>k===KEY?{checkedAt:current,checks:[{name:'github_pat',status:'valid',expiresAt:null,secret},{name:secret,status:secret}]}:null};
 const r=await dashboardResponse(req('/credentials',key),{...env,APPROVALS:kv});
 assert.equal(r.status,200);const body=await r.text();assert.ok(!body.includes(secret));assert.equal(JSON.parse(body).checks.length,1);
 const d=await dashboardData({...env,APPROVALS:kv},{now:current,fetcher:async()=>Response.json({workflow_runs:[{path:'.github/workflows/deploy-pages.yml',head_branch:'main',event:'push',status:'completed',conclusion:'success',created_at:new Date(current).toISOString(),updated_at:new Date(current).toISOString(),secret}]})});
 assert.equal(d.github.rows.find(x=>x.name==='deploy-pages').status,'success');assert.ok(!JSON.stringify(d).includes(secret));
});
test('daily monitor does not write or probe before due',async()=>{
 let writes=0;
 const e={...env,APPROVALS:{get:async()=>({checkedAt:now-1000}),put:async()=>{writes++}}};
 await monitorCredentialsIfDue(e,{now,fetcher:async()=>{throw Error('must not fetch')}});
 assert.equal(writes,0);
});

test('workflow reads use server token only for fixed GitHub origin and redact errors',async()=>{
 const e={...env,APPROVALS:{get:async()=>null}};
 for(const [http,status] of [[401,'auth_failed'],[403,'permission_denied'],[429,'rate_limited'],[500,'unavailable']]){
  const d=await dashboardData(e,{fetcher:async(url,opts)=>{
   assert.equal(new URL(url).origin,'https://api.github.com');
   assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');assert.equal(opts.headers.authorization,'Bearer '+secret);
   return Response.json({message:secret},{status:http});
  }});
  assert.equal(d.github.status,status);assert.equal(d.github.httpStatus,http);
  assert.ok(!JSON.stringify(d).includes(secret));
 }
 const d=await dashboardData({...e,GITHUB_TOKEN:''},{fetcher:async()=>{throw Error('must not call')}});
 assert.equal(d.github.status,'not_configured');
});
