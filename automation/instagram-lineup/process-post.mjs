import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ACCOUNT_ID,USERNAME,selectNewLineups} from './discover.mjs';
import {planLineup} from './plan-lineup.mjs';

const event=JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));
const {postId,cutoff}=event.client_payload??{};
if(!/^\d{5,30}$/.test(String(postId))||!Number.isFinite(cutoff)||cutoff<=0||cutoff>Date.now())throw Error('Invalid discovery event');
const token=process.env.UTD_INSTAGRAM_TOKEN;
const ingest=process.env.LINEUP_INGEST_TOKEN;
if(!token||!ingest)throw Error('Required secrets missing');
const entries=[];
let cursor;
for(let i=0;i<5;i++){
 const url=new URL('https://graph.facebook.com/v27.0/'+ACCOUNT_ID);
 if(cursor&&!/^[\w-]+$/.test(cursor))throw Error('Invalid paging cursor');
 url.searchParams.set('fields','business_discovery.username('+USERNAME+'){username,media.limit(50)'+(cursor?'.after('+cursor+')':'')+'{id,caption,media_type,media_url,permalink,timestamp}}');
 const res=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(45000)});
 if(!res.ok)throw Error('Instagram API HTTP '+res.status);
 const profile=(await res.json()).business_discovery;
 if(profile?.username!==USERNAME||!Array.isArray(profile.media?.data))throw Error('Invalid Instagram response');
 entries.push(...profile.media.data);
 if(entries.some(p=>p.id===String(postId)))break;
 cursor=profile.media.paging?.next&&profile.media.paging?.cursors?.after;
 if(!cursor)break;
}
const post=selectNewLineups(entries,cutoff).find(p=>p.id===String(postId));
if(!post)throw Error('Official new lineup post not found');
const imageUrl=new URL(entries.find(p=>p.id===post.id).media_url);
if(imageUrl.protocol!=='https:'||!imageUrl.hostname.endsWith('.cdninstagram.com'))throw Error('Unexpected image host');
const image=await fetch(imageUrl,{redirect:'error',signal:AbortSignal.timeout(45000)});
if(!image.ok||!['image/jpeg','image/png','image/webp'].includes(image.headers.get('content-type')?.split(';')[0]))throw Error('Image fetch failed');
const chunks=[];let size=0;
for await(const chunk of image.body){size+=chunk.length;if(size>15*1024*1024)throw Error('Image exceeds limit');chunks.push(Buffer.from(chunk));}
const reader=fileURLToPath(new URL('./read-new-card.py',import.meta.url));
const ocr=JSON.parse(execFileSync('/usr/bin/python3',[reader],{input:Buffer.concat(chunks),encoding:'utf8',timeout:900000,maxBuffer:2*1024*1024}));
const proposal=planLineup(await readFile('data.js','utf8'),post,ocr);
const response=await fetch('https://utd.likey00700.workers.dev/admin/lineup-proposal',{method:'POST',headers:{authorization:'Bearer '+ingest,'content-type':'application/json'},body:JSON.stringify(proposal),signal:AbortSignal.timeout(45000)});
if(!response.ok)throw Error('Lineup ingest HTTP '+response.status);
console.log('Lineup proposal accepted for post '+post.id);
