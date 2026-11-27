// Read-only discovery; no media URLs or credentials are persisted or dispatched.
export const ACCOUNT_ID='17841454923295450';
export const USERNAME='chizumuluutd';
export const PREFIX='instagram-lineup:v1:';
export function selectNewLineups(entries,cutoff,now=Date.now()){
 if(!Number.isFinite(cutoff)||cutoff<=0||cutoff>now)throw Error('Invalid Instagram discovery cutoff');
 const seen=new Set(),result=[];
 for(const p of entries??[]){
  const id=String(p?.id??''),time=Date.parse(p?.timestamp??'');
  if(!/^\d{5,30}$/.test(id)||seen.has(id)||!Number.isFinite(time)||time<=cutoff||time>now)continue;
  if(p.media_type!=='IMAGE'||!/#STARTING_XI\b/i.test(p.caption??''))continue;
  let link;try{link=new URL(p.permalink);}catch{continue;}
  if(link.protocol!=='https:'||!['www.instagram.com','instagram.com'].includes(link.hostname)||!/^\/p\/[\w-]+\/?$/.test(link.pathname))continue;
  seen.add(id);
  result.push({id,timestamp:p.timestamp,caption:p.caption,permalink:link.origin+link.pathname});
 }
 return result.sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
}
export async function fetchLineupFeed(token,{fetcher=fetch,maxPages=5,cutoff=0}={}){
 if(!token)throw Error('Instagram token missing');
 const posts=[],seen=new Set();let cursor;
 for(let i=0;i<maxPages;i++){
  const url=new URL('https://graph.facebook.com/v27.0/'+ACCOUNT_ID);
  const after=cursor?'.after('+cursor+')':'';
  if(cursor&&!/^[\w-]+$/.test(cursor))throw Error('Invalid Instagram paging cursor');
  url.searchParams.set('fields','business_discovery.username('+USERNAME+'){username,media.limit(50)'+after+'{id,caption,media_type,permalink,timestamp}}');
  const res=await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw Error('Instagram API HTTP '+res.status);
  const profile=(await res.json()).business_discovery;
  if(profile?.username!==USERNAME||!Array.isArray(profile.media?.data))throw Error('Invalid Instagram feed');
  posts.push(...profile.media.data);
  const next=profile.media.paging?.next&&profile.media.paging?.cursors?.after;
  if(!next)return posts;
  const oldest=Math.min(...profile.media.data.map(p=>Date.parse(p.timestamp)));
  if(cutoff>0&&oldest<=cutoff)return posts;
  if(seen.has(next))throw Error('Repeated Instagram cursor');
  seen.add(next);cursor=next;
 }
 throw Error('Instagram pagination limit reached before cutoff; refusing incomplete scan');
}
export async function discoverLineups(env,{now=Date.now(),fetcher=fetch}={}){
 if(env.INSTAGRAM_LINEUP_ENABLED!=='true')return {enabled:false};
 const kv=env.APPROVALS;
 if(!kv)throw Error('Instagram discovery KV unavailable');
 let raw=await kv.get(PREFIX+'cutoff');
 if(raw===null){
  // Initialize only after an authenticated API request succeeds.
  await fetchLineupFeed(env.UTD_INSTAGRAM_TOKEN,{fetcher,cutoff:now});
  await kv.put(PREFIX+'cutoff',String(now));
  return {enabled:true,initialized:true,cutoff:new Date(now).toISOString(),queued:0};
 }
 const cutoff=Number(raw);
 if(!Number.isFinite(cutoff)||cutoff<=0||cutoff>now)throw Error('Invalid persisted Instagram cutoff');
 const posts=await fetchLineupFeed(env.UTD_INSTAGRAM_TOKEN,{fetcher,cutoff});
 let queued=0;
 for(const post of selectNewLineups(posts,cutoff,now)){
  const key=PREFIX+'pending:'+post.id;
  if(await kv.get(PREFIX+'done:'+post.id)||await kv.get(key))continue;
  await kv.put(key,JSON.stringify(post));
  queued++;
 }
 return {enabled:true,initialized:false,queued,checked:posts.length};
}

export async function scanInstagramLineups(env){
 if(env.INSTAGRAM_LINEUP_ENABLED!=='true')return;
 try{
  const summary=await discoverLineups(env);
  console.log(JSON.stringify({event:'instagram_lineup_scan',...summary}));
  if(summary.initialized)return;
  if(env.GITHUB_REPOSITORY!=='Chizumulu/UTD'||!env.GITHUB_TOKEN)throw Error('Missing GitHub dispatch configuration');
  const kv=env.APPROVALS;
  let cursor, count=0, failed=false;
  do{
   const page=await kv.list({prefix:PREFIX+'pending:',cursor,limit:100});
   for(const k of page.keys){
    const p=await kv.get(k.name,'json');if(!p)continue;
    if(await kv.get(PREFIX+'done:'+p.id)||await kv.get('match:lineup:'+p.id)){
     await kv.put(PREFIX+'done:'+p.id,'1');await kv.delete(k.name);continue;
    }
    if(p.nextAttempt>Date.now())continue;
    const res=await fetch('https://api.github.com/repos/Chizumulu/UTD/dispatches',{method:'POST',headers:{authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','user-agent':'utd-instagram-lineup'},body:JSON.stringify({event_type:'instagram-lineup-discovered',client_payload:{postId:p.id,cutoff:Number(await kv.get(PREFIX+'cutoff'))}})});
    p.nextAttempt=Date.now()+ (res.ok?60:10)*60000;
    await kv.put(k.name,JSON.stringify(p));
    console.log(JSON.stringify({event:'instagram_lineup_dispatch',postId:p.id,status:res.status}));
    if(!res.ok)failed=true;
    if(++count>=3)return {ok:!failed};
   }
   cursor=page.list_complete?undefined:page.cursor;
  }while(cursor);
  return {ok:!failed};
 }catch(e){console.error(JSON.stringify({event:'instagram_lineup_scan_failed',error:String(e)}));return {ok:false};}
}
