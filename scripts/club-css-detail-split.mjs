import postcss from 'postcss';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {minifyCss,cssSignature} from './minify-pages-assets.mjs';

const kinds=['analysis','other'];
const markerPrefix='#utd-club-css-slot-';
const marker=(kind,index)=>markerPrefix+kind+'-'+index;
const size=s=>({raw:Buffer.byteLength(s),gzip:gzipSync(s).length,brotli:brotliCompressSync(s).length});

// Select only complete rules/conditional groups. Mixed selectors and shared
// feature classes stay in the initial stylesheet. The marker is an inert
// selector: the runtime inserts deferred rules BEFORE it in the same sheet.
function ownerOfSelector(selector){
 const s=selector.trim().replace(/^:root\[data-theme=["']dark["']\]\s+/,'');
 if(/^#otherTeamFullBody(?:$|[\s.:#>\[])/.test(s))return 'other';
 if(/^#tiSection-analysis(?:$|[\s.:#>\[])/.test(s)||/^\.ta-[\w-]+(?:$|[\s.:#>+~\[])/.test(s)||/^#taSec[\w-]+(?:$|[\s.:#>\[])/.test(s)||s==='.ti-section-title[id^="taSec"]')return 'analysis';
 return null;
}
function ownerOf(node){
 if(node.type==='rule'){
  if(!node.nodes?.every(n=>n.type==='decl'||n.type==='comment'))return null;
  const owners=node.selectors.map(ownerOfSelector);
  return owners[0]&&owners.every(k=>k===owners[0])?owners[0]:null;
 }
 if(node.type==='atrule'&&['media','supports','container'].includes(node.name)){
  const owners=(node.nodes||[]).filter(n=>n.type!=='comment').map(ownerOf);
  return owners[0]&&owners.every(k=>k===owners[0])?owners[0]:null;
 }
 return null;
}
export async function splitClubDetailCss(source){
 if(source.includes(markerPrefix))throw Error('Reserved club stylesheet slot selector already present');
 const root=postcss.parse(source),critical=postcss.root();
 const groups=new Map(),assets=Object.fromEntries(kinds.map(k=>[k,{root:postcss.root(),slots:0,rules:0}]));
 for(let i=0;i<root.nodes.length;){
  const n=root.nodes[i],kind=ownerOf(n);
  if(!kind){critical.append(n.clone());i++;continue;}
  const entry=assets[kind],slot=marker(kind,entry.slots++);
  const placeholder=postcss.rule({selector:slot});
  placeholder.append(postcss.decl({prop:'--utd-club-slot',value:'0'}));
  critical.append(placeholder.clone());entry.root.append(placeholder.clone());
  const run=[];
  while(i<root.nodes.length&&ownerOf(root.nodes[i])===kind){
   const item=root.nodes[i++];
   run.push(item.clone());entry.root.append(item.clone());entry.rules++;
  }
  groups.set(slot,run);
 }
 // Rebuild from the actual generated slot map, not the original node list.
 const rebuilt=postcss.root();
 for(const n of critical.nodes){
  if(n.type==='rule'&&groups.has(n.selector)){for(const item of groups.get(n.selector))rebuilt.append(item.clone());}
  else rebuilt.append(n.clone());
 }
 if(cssSignature(rebuilt.toString())!==cssSignature(source))throw Error('Club CSS slot reconstruction changed original cascade');
 const initial=await minifyCss(critical.toString());
 const before=size(await minifyCss(source)),after=size(initial);
 for(const k of ['raw','gzip','brotli'])if(after[k]>=before[k])throw Error('Club detail CSS split does not improve '+k);
 const output={};
 for(const kind of kinds){
  const entry=assets[kind];
  if(!entry.slots||!entry.rules)throw Error('Empty club CSS group '+kind);
  const css=await minifyCss(entry.root.toString()),file='club-'+kind+'.css';
  output[kind]={file,css,url:file+'?v='+createHash('sha256').update(css).digest('hex').slice(0,16),slots:entry.slots,rules:entry.rules,size:size(css)};
 }
 return {critical:initial,assets:output,metrics:{before,after,assets:Object.fromEntries(kinds.map(k=>[k,{slots:output[k].slots,rules:output[k].rules,...output[k].size}]))}};
}
