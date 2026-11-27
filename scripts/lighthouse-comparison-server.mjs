import {createServer} from 'node:http';
import {readFileSync,statSync,realpathSync} from 'node:fs';
import {resolve,relative,extname,sep} from 'node:path';
import {gzipSync,brotliCompressSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const compressible=new Set(['.html','.js','.mjs','.css','.json','.svg','.txt','.xml','.webmanifest']);
export function encoding(header='',canCompress=true){
 const q=new Map();
 for(const item of header.toLowerCase().split(',')){
  const [name,...params]=item.trim().split(';');
  if(!name)continue;
  const value=params.map(x=>x.trim()).find(x=>x.startsWith('q='));
  const n=value===undefined?1:Number(value.slice(2));
  q.set(name,Number.isFinite(n)&&n>=0&&n<=1?n:0);
 }
 const quality=name=>q.get(name)??(name==='identity'?(q.get('*')===0?0:1):(q.get('*')??0));
 // Prefer compression when accepted; respect relative quality of compressed encodings.
 const options=canCompress?['br','gzip']:[];
 const best=options.filter(x=>quality(x)>0).sort((a,b)=>quality(b)-quality(a))[0];
 if(best&&(!q.has('identity')||quality(best)>=quality('identity')))return best;
 return quality('identity')>0?'identity':best??null;
}
export function staticServer(directory){
 const root=realpathSync(directory),cache=new Map();
 const inside=file=>{const r=relative(root,file);return r!== '..'&&!r.startsWith('..'+sep)&&!r.startsWith(sep);};
 return createServer((req,res)=>{
  const fail=status=>{res.writeHead(status,{'Cache-Control':'no-store'});res.end();};
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return fail(405);}
  let pathname,file;
  try{
   pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(pathname.includes('\0')||pathname.includes('\\'))return fail(400);
   file=resolve(root,'.'+pathname);
   if(!inside(file))return fail(403);
   if(statSync(file).isDirectory()){
    if(!pathname.endsWith('/')){res.writeHead(301,{Location:new URL(req.url,'http://localhost').pathname+'/'+new URL(req.url,'http://localhost').search});return res.end();}
    file=resolve(file,'index.html');
   }
   file=realpathSync(file);
   if(!inside(file))return fail(403);
   if(!statSync(file).isFile())return fail(404);
  }catch(error){return fail(error instanceof URIError?400:404);}
  const ext=extname(file).toLowerCase(),eligible=compressible.has(ext);
  const chosen=encoding(req.headers['accept-encoding'],eligible);
  if(!chosen)return fail(406);
  let asset=cache.get(file);
  if(!asset){asset={identity:readFileSync(file)};cache.set(file,asset);}
  if(!asset[chosen])asset[chosen]=chosen==='br'?brotliCompressSync(asset.identity):gzipSync(asset.identity);
  const body=asset[chosen],headers={'Content-Type':types[ext]??'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store','Vary':'Accept-Encoding'};
  if(chosen!=='identity')headers['Content-Encoding']=chosen;
  res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [directory,port]=process.argv.slice(2);
 if(!directory||!/^\d+$/.test(port??'')||Number(port)<1||Number(port)>65535)throw Error('Usage: lighthouse-comparison-server.mjs directory port');
 staticServer(directory).listen(Number(port),'127.0.0.1',()=>console.log('Compressed Pages server listening on '+port));
}
