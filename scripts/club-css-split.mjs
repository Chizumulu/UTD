import postcss from 'postcss';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {minifyCss,cssSignature} from './minify-pages-assets.mjs';

// Only the contiguous sponsor block is eligible; fail closed on source drift.
export async function splitClubSponsorCss(source){
 const root=postcss.parse(source);
 const starts=root.nodes.filter(n=>n.type==='comment'&&n.text.includes('팀 스폰서 탭'));
 const ends=root.nodes.filter(n=>n.type==='rule'&&n.selector==='.ti-lightbox');
 if(starts.length!==1||ends.length!==1)throw Error('Sponsor CSS boundaries changed');
 const first=root.index(starts[0]),last=root.index(ends[0]);
 if(last<=first)throw Error('Invalid sponsor CSS boundaries');
 const block=root.nodes.slice(first,last);
 const club=postcss.root();
 function verify(n,inKeyframes=false){
  if(n.type==='comment')return;
  if(n.type==='atrule'){
   const keyframes=n.name==='keyframes'&&n.params==='tiSponsorIn';
   if(!keyframes&&n.name!=='media')throw Error('Unexpected sponsor at-rule '+n.name);
   if(!n.nodes?.length)throw Error('Empty sponsor at-rule');
   for(const child of n.nodes)verify(child,keyframes);
   return;
  }
  if(n.type!=='rule'||!n.nodes?.every(d=>d.type==='decl'||d.type==='comment'))throw Error('Unexpected sponsor rule');
  if(inKeyframes){
   if(!/^(from|to)$/.test(n.selector))throw Error('Unexpected sponsor keyframe');
  }else if(!n.selectors.every(s=>/^\.ti-sponsor-[\w-]+(?:$|[\s.:#>+~\[])/.test(s))){
   throw Error('Non-sponsor selector '+n.selector);
  }
 }
 for(const n of block){verify(n);club.append(n.clone());}
 const remaining=root.clone();
 for(let i=last-1;i>=first;i--)remaining.nodes[i].remove();
 // Reject sponsor-specific selectors outside the extracted block.
 remaining.walkRules(r=>{if(/\.ti-sponsor-|tiSponsorIn/.test(r.selector))throw Error('Sponsor selector outside block: '+r.selector)});
 remaining.walkDecls(d=>{if(/\btiSponsorIn\b/.test(d.value))throw Error('Sponsor animation outside block')});
 const rebuilt=remaining.clone();
 for(let i=0;i<block.length;i++)rebuilt.insertBefore(rebuilt.nodes[first+i],block[i].clone());
 if(cssSignature(rebuilt.toString())!==cssSignature(source))throw Error('CSS reconstruction failed');
 const full=await minifyCss(source),critical=await minifyCss(remaining.toString()),optional=await minifyCss(club.toString());
 const size=s=>({raw:Buffer.byteLength(s),gzip:gzipSync(s).length,brotli:brotliCompressSync(s).length});
 const before=size(full),after=size(critical),deferred=size(optional);
 if(after.raw>=before.raw||after.gzip>=before.gzip||after.brotli>=before.brotli)throw Error('Sponsor split did not reduce initial CSS');
 const file='club-sponsors.css',url=file+'?v='+createHash('sha256').update(optional).digest('hex').slice(0,16);
 return {critical,optional,file,url,metrics:{before,after,deferred}};
}
