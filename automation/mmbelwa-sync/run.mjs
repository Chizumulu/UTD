import {readFileSync,writeFileSync} from 'node:fs';
import {discoverFromSource} from './discover.mjs';
const [output,input]=process.argv.slice(2);
if(!output)throw Error('Output path required');
const data=input?JSON.parse(readFileSync(input,'utf8')):await (async()=>{
 const r=await fetch('https://api.chizumulu.net/v1/structured?limit=40',{signal:AbortSignal.timeout(30000),headers:{accept:'application/json'}});
 if(!r.ok)throw Error('Structured API HTTP '+r.status);
 return r.json();
})();
const result=discoverFromSource(readFileSync('data.js','utf8'),data.items);
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
