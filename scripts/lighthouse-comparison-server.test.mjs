import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request} from 'node:http';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import {encoding,staticServer} from './lighthouse-comparison-server.mjs';
test('negotiates encodings and respects exclusions',()=>{
 assert.equal(encoding('gzip, br'),'br');
 assert.equal(encoding('gzip'),'gzip');
 assert.equal(encoding('br;q=0, gzip;q=0'),'identity');
 assert.equal(encoding('br;q=0.5,gzip;q=1'),'gzip');
 assert.equal(encoding('gzip;q=0.5,identity;q=1'),'identity');
 assert.equal(encoding('identity;q=0,*;q=0'),null);
 assert.equal(encoding('br',false),'identity');
 assert.equal(encoding(),'identity');
});
test('serves identical decoded bytes, MIME, query strings, HEAD and errors',async()=>{
 const root=mkdtempSync(join(tmpdir(),'utd-server-'));
 const source=Buffer.from('const text="한국어";\n'.repeat(200));
 mkdirSync(join(root,'UTD'));
 writeFileSync(join(root,'UTD','app.js'),source);
 writeFileSync(join(root,'UTD','index.html'),'<html>hello</html>');
 writeFileSync(join(root,'UTD','image.webp'),Buffer.from([1,2,3]));
 const server=staticServer(root);
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const get=(path,accept,method='GET')=>new Promise((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{'Accept-Encoding':accept}},res=>{
    const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);
   });req.on('error',reject);req.end();
  });
  for(const [accept,decode] of [['br',brotliDecompressSync],['gzip',gunzipSync],['identity',x=>x]]){
   const r=await get('/UTD/app.js?v=123',accept);
   assert.equal(r.status,200);assert.equal(r.headers['content-encoding'],accept==='identity'?undefined:accept);
   assert.equal(r.headers.vary,'Accept-Encoding');assert.match(r.headers['content-type'],/javascript/);
   assert.equal(Number(r.headers['content-length']),r.body.length);
   assert.deepEqual(decode(r.body),source);
   if(accept!=='identity')assert.ok(r.body.length<source.length);
   const head=await get('/UTD/app.js',accept,'HEAD');
   assert.equal(head.headers['content-length'],r.headers['content-length']);assert.equal(head.body.length,0);
  }
  assert.equal((await get('/UTD/','br')).status,200);
  assert.equal((await get('/UTD','br')).status,301);
  assert.equal((await get('/UTD/image.webp','br')).headers['content-encoding'],undefined);
  assert.equal((await get('/UTD/missing','br')).status,404);
  assert.equal((await get('/UTD/%ZZ','br')).status,400);
  assert.equal((await get('/UTD/app.js','br','POST')).status,405);
  assert.equal((await get('/UTD/app.js','identity;q=0,*;q=0')).status,406);
 }finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
