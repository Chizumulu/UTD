import postcss from 'postcss';
import {createHash} from 'node:crypto';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {minifyCss,cssSignature} from './minify-pages-assets.mjs';
import {featureOwner,policies} from './feature-css-policy.mjs';

const markerPrefix='#utd-club-css-slot-';
const kinds=Object.keys(policies);
const bytes=s=>({raw:Buffer.byteLength(s),gzip:gzipSync(s).length,brotli:brotliCompressSync(s).length});
function owner(node){
 if(node.type==='rule'){
  if(!node.nodes?.every(n=>n.type==='decl'||n.type==='comment'))return null;
  const owners=node.selectors.map(featureOwner);
  return owners[0]&&owners.every(k=>k===owners[0])?owners[0]:null;
 }
 if(node.type==='atrule'&&['media','supports','container'].includes(node.name)){
  const owners=(node.nodes||[]).filter(n=>n.type!=='comment').map(owner);
  return owners[0]&&owners.every(k=>k===owners[0])?owners[0]:null;
 }
 return null;
}
export function reconstructFeatureCss(critical,assets){
 const groups=new Map();
 for(const asset of Object.values(assets)){
  let group=null;
  for(const n of postcss.parse(asset.css).nodes){
   if(n.type==='rule'&&n.selector.startsWith(markerPrefix)){
    if(groups.has(n.selector))throw Error('Duplicate CSS slot '+n.selector);
    group=[];groups.set(n.selector,group);
   }else{
    if(!group)throw Error('Missing CSS slot in '+asset.file);
    group.push(n.clone());
   }
  }
 }
 const rebuilt=postcss.root();
 for(const n of postcss.parse(critical).nodes){
  if(n.type==='rule'&&groups.has(n.selector)){
   for(const item of groups.get(n.selector))rebuilt.append(item);
   groups.delete(n.selector);
  }else rebuilt.append(n.clone());
 }
 if(groups.size)throw Error('Unused feature CSS slots: '+[...groups.keys()]);
 return rebuilt.toString();
}
export async function splitFeatureCss(source){
 const root=postcss.parse(source),critical=postcss.root();
 const entries=Object.fromEntries(kinds.map(k=>[k,{root:postcss.root(),slots:0,rules:0}]));
 for(let i=0;i<root.nodes.length;){
  const n=root.nodes[i],kind=owner(n);
  if(!kind){critical.append(n.clone());i++;continue;}
  const entry=entries[kind],selector=markerPrefix+kind+'-'+entry.slots++;
  if(source.includes(selector+'{')||source.includes(selector+' '))throw Error('Reserved slot collision '+selector);
  const placeholder=postcss.rule({selector});
  placeholder.append(postcss.decl({prop:'--utd-club-slot',value:'0'}));
  critical.append(placeholder.clone());entry.root.append(placeholder.clone());
  while(i<root.nodes.length&&owner(root.nodes[i])===kind){entry.root.append(root.nodes[i++].clone());entry.rules++;}
 }
 const initial=await minifyCss(critical.toString()),assets={};
 for(const kind of kinds){
  const e=entries[kind];
  if(!e.rules||!e.slots)throw Error('No safe rules found for '+kind);
  const css=await minifyCss(e.root.toString()),file='feature-'+kind+'.css';
  assets[kind]={file,css,url:file+'?v='+createHash('sha256').update(css).digest('hex').slice(0,16),slots:e.slots,rules:e.rules,size:bytes(css)};
 }
 if(cssSignature(reconstructFeatureCss(initial,assets))!==cssSignature(source))throw Error('Feature CSS cascade reconstruction mismatch');
 const before=bytes(await minifyCss(source)),after=bytes(initial);
 for(const k of ['raw','gzip','brotli'])if(after[k]>=before[k])throw Error('No initial feature CSS savings in '+k);
 return {critical:initial,assets,metrics:{before,after,assets:Object.fromEntries(kinds.map(k=>[k,{slots:assets[k].slots,rules:assets[k].rules,...assets[k].size}]))}};
}
