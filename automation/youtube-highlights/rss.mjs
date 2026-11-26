export const CHANNEL = 'UC5JtIP2gExbPDMbNMFr3aHA';
export const PREFIX = 'youtube-highlight:v1:';
const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m,k) => {
  if(k[0]==='#') { const n=k[1].toLowerCase()==='x'?parseInt(k.slice(2),16):Number(k.slice(1)); return n>0&&n<=0x10ffff?String.fromCodePoint(n):m; }
  return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[k]??m;
});
export function parseFeed(xml) {
  if(!/<feed\b/.test(xml)) throw Error('Invalid YouTube Atom feed');
  const field=(entry,tag)=>decode(entry.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>'))?.[1]??'');
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].map(([,e])=>({
    id:field(e,'yt:videoId'), channel:field(e,'yt:channelId'), title:field(e,'title'), published:field(e,'published')
  })).filter(v=>/^[\w-]{11}$/.test(v.id)&&v.channel===CHANNEL&&Number.isFinite(Date.parse(v.published)));
}
export function eligible(v, cutoff) {
  return Date.parse(v.published)>cutoff && /하이라이트/.test(v.title) && /치주물루|chizumulu\s+united/i.test(v.title);
}
const log=(event,extra={})=>console.log(JSON.stringify({event:'youtube_highlight_'+event,...extra}));
export async function scanYoutubeHighlights(env) {
  if(env.YOUTUBE_HIGHLIGHTS_ENABLED!=='true') return;
  try {
    const kv=env.APPROVALS;
    let cutoff=await kv.get(PREFIX+'cutoff');
    if(!cutoff){ cutoff=String(Date.now()); await kv.put(PREFIX+'cutoff',cutoff); log('initialized',{cutoff:new Date(Number(cutoff)).toISOString()}); }
    if(!Number.isFinite(Number(cutoff))) throw Error('Invalid cutoff');
    try {
      const res=await fetch('https://www.youtube.com/feeds/videos.xml?channel_id='+CHANNEL,{cache:'no-store'});
      if(!res.ok) throw Error('RSS HTTP '+res.status);
      for(const v of parseFeed(await res.text())) {
        if(!eligible(v,Number(cutoff))) continue;
        const key=PREFIX+'pending:'+v.id;
        if(!await kv.get(PREFIX+'done:'+v.id)&&!await kv.get(key)) await kv.put(key,JSON.stringify(v));
      }
    } catch(e){log('rss_failed',{error:String(e)});}
    if(!env.GITHUB_TOKEN||env.GITHUB_REPOSITORY!=='Chizumulu/UTD') throw Error('GitHub settings missing');
    const base='https://api.github.com/repos/Chizumulu/UTD';
    const headers={authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json','content-type':'application/json','user-agent':'utd-youtube-highlights'};
    const data=await fetch(base+'/contents/data.js?ref=main',{headers:{...headers,accept:'application/vnd.github.raw+json'}});
    if(!data.ok) throw Error('data.js HTTP '+data.status);
    const source=await data.text();
    let cursor; let dispatched=0;
    do {
      const page=await kv.list({prefix:PREFIX+'pending:',cursor,limit:100});
      for(const key of page.keys){
        const v=await kv.get(key.name,'json'); if(!v)continue;
        if(source.includes('watch?v='+v.id)||source.includes('youtu.be/'+v.id)){
          await kv.put(PREFIX+'done:'+v.id,'1');await kv.delete(key.name);log('confirmed',{id:v.id});continue;
        }
        if(v.nextAttempt>Date.now())continue;
        const response=await fetch(base+'/dispatches',{method:'POST',headers,body:JSON.stringify({event_type:'youtube-highlight-discovered',client_payload:{video:v}})});
        v.nextAttempt=Date.now()+30*60*1000;
        await kv.put(key.name,JSON.stringify(v));
        log(response.ok?'dispatched':'dispatch_failed',{id:v.id,status:response.status});
        if(++dispatched>=5)return;
      }
      cursor=page.list_complete?undefined:page.cursor;
    }while(cursor);
    log('scan_completed',{dispatched});
  }catch(e){log('scan_failed',{error:String(e)});}
}
