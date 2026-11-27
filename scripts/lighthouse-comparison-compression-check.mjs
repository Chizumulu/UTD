import {get} from 'node:http';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliDecompressSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const [port,output]=process.argv.slice(2);
if(!/^\d+$/.test(port??'')||!output)throw Error('Usage: compression-check port output');
const fetchRaw=(path,encoding)=>new Promise((resolve,reject)=>{
 const req=get({hostname:'127.0.0.1',port,path,headers:{'Accept-Encoding':encoding}},res=>{
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);
 });req.setTimeout(15000,()=>req.destroy(Error('HTTP probe timeout')));req.on('error',reject);
});
const result={port:Number(port),assets:{}};
for(const path of ['/UTD/','/UTD/app.js?v=probe','/UTD/style.css?v=probe','/UTD/data.js?v=probe','/UTD/a11y.js?v=probe']){
 const raw=await fetchRaw(path,'identity');
 assert.equal(raw.status,200);assert.equal(raw.headers['content-encoding'],undefined);
 const row={raw:raw.body.length,sha256:createHash('sha256').update(raw.body).digest('hex')};
 for(const [enc,accept,decode] of [['br','gzip, br',brotliDecompressSync],['gzip','gzip',gunzipSync]]){
  const response=await fetchRaw(path,accept);
  assert.equal(response.status,200);assert.equal(response.headers['content-encoding'],enc);
  assert.equal(response.headers.vary,'Accept-Encoding');
  assert.equal(Number(response.headers['content-length']),response.body.length);
  assert.deepEqual(decode(response.body),raw.body);
  row[enc]=response.body.length;
 }
 result.assets[path]=row;
 console.log('Compression verified '+port+' '+path+' raw='+row.raw+' gzip='+row.gzip+' br='+row.br);
}
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
