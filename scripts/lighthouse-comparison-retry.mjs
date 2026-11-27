import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateReport} from './lighthouse-comparison.mjs';

export async function retrySample(run,{maxAttempts=3,onAttempt=()=>{}}={}){
 if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw Error('Invalid attempt limit');
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  let result;
  try{result=await run(attempt);validateReport(result.report);}
  catch(error){await onAttempt({attempt,status:'rejected',reason:String(error.message??error)});continue;}
  await onAttempt({attempt,status:'accepted'});
  return result;
 }
 throw Error('No valid Lighthouse sample after '+maxAttempts+' attempts');
}
export function execute(command,args,{timeoutMs=90000,spawnFn=spawn}={}){
 return new Promise((resolve,reject)=>{
  const child=spawnFn(command,args,{stdio:'inherit',detached:true});
  let timedOut=false;
  const kill=()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const timer=setTimeout(()=>{timedOut=true;kill();},timeoutMs);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',(code,signal)=>{
   clearTimeout(timer);
   if(timedOut)reject(Error('Lighthouse process timeout after '+timeoutMs+'ms'));
   else if(code!==0){kill();reject(Error('Lighthouse exited '+(code??signal)));}
   else resolve();
  });
 });
}
export async function auditSample({dir,profile,side,index,port,command='./node_modules/.bin/lighthouse',flagsPath,timeoutMs=90000}){
 const name=profile+'-'+side+'-'+index;
 const attemptsDir=join(dir,'attempts',name);
 mkdirSync(attemptsDir,{recursive:true});
 const history=[];
 const save=()=>writeFileSync(join(attemptsDir,'history.json'),JSON.stringify(history,null,2)+'\n');
 const result=await retrySample(async attempt=>{
  const prefix=join(attemptsDir,'attempt-'+attempt);
  console.log('Auditing '+name+' attempt '+attempt);
  const args=['http://127.0.0.1:'+port+'/UTD/?lang=ko',...(profile==='desktop'?['--preset=desktop']:[]),'--only-categories=performance','--throttling-method=simulate','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage','--cli-flags-path='+flagsPath,'--output=json','--output=html','--output-path='+prefix,'--quiet'];
  await execute(command,args,{timeoutMs});
  return {report:JSON.parse(readFileSync(prefix+'.report.json','utf8')),prefix};
 },{onAttempt:entry=>{history.push(entry);save();console.log(name+' attempt '+entry.attempt+' '+entry.status+(entry.reason?': '+entry.reason:''));}});
 copyFileSync(result.prefix+'.report.json',join(dir,name+'.json'));
 copyFileSync(result.prefix+'.report.html',join(dir,name+'.report.html'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [dir,profile,side,index,port,flagsPath]=process.argv.slice(2);
 if(!dir||!['mobile','desktop'].includes(profile)||!['before','after'].includes(side)||!/^\d+$/.test(index??'')||!/^\d+$/.test(port??'')||!flagsPath)throw Error('Usage: lighthouse-comparison-retry.mjs dir profile side index port flagsPath');
 await auditSample({dir,profile,side,index,port,flagsPath});
}
