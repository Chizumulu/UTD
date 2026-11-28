import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const workflows=['scorer-approval','cup-scorer-approval','forfeit-approval','instagram-lineup-approved'];
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const minutes=60_000;
const hour=60*minutes;
const validReceipt=(r,run)=>r?.version===1&&String(r.runId)===String(run.id)&&String(r.runAttempt)===String(run.run_attempt)&&sha(r.commit)&&digest(r.dataSha256)&&(r.branch==='main'||r.branch===''||/^automation\/(?:scorer-|cup-scorer-|forfeit-recovery-|lineup-)[a-zA-Z0-9-]+$/.test(r.branch));
export function classify(run,receipt,pr,proof,now){
 const age=now-Date.parse(run.created_at);
 const sinceUpdate=now-Date.parse(run.updated_at);
 if(run.status!=='completed')return age>=2*hour?'run_delayed':'pending';
 if(run.conclusion!=='success')return sinceUpdate>=30*minutes?'run_failed':'pending';
 if(!validReceipt(receipt,run))return sinceUpdate>=30*minutes?'receipt_missing':'pending';
 if(receipt.branch.startsWith('automation/')){
  if(!pr)return sinceUpdate>=30*minutes?'pr_missing':'pending';
  if(!pr.merged_at){
   if(pr.state==='closed')return 'pr_closed_unmerged';
   return sinceUpdate>=24*hour?'pr_review_overdue':'awaiting_review';
  }
 }
 const sinceMerge=pr?.merged_at?now-Date.parse(pr.merged_at):sinceUpdate;
 if(proof===true)return 'verified';
 return sinceMerge>=60*minutes?'publication_unverified':'pending';
}
export function validManifest(m,bytes){
 return m?.version===1&&sha(m.commit)&&digest(m.dataSha256)&&(!Object.hasOwn(m,'sourceDataSha256')||digest(m.sourceDataSha256))&&createHash('sha256').update(bytes).digest('hex')===m.dataSha256;
}
// The approval receipt records source bytes; the publication manifest also
// authenticates the actual transformed public asset. Legacy manifests used
// identical source and public bytes.
export function matchesSourceReceipt(receipt,manifest){
 const source=Object.hasOwn(manifest,'sourceDataSha256')?manifest.sourceDataSha256:manifest.dataSha256;
 return digest(source)&&digest(receipt?.dataSha256)&&receipt.dataSha256===source;
}
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',timeout:45_000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const api=path=>JSON.parse(gh('api',path));
const repo='Chizumulu/UTD';
const root='repos/'+repo;
const base='https://chizumulu.github.io/UTD/';
async function getPublication(){
 const stamp=Date.now();
 const options={cache:'no-store',signal:AbortSignal.timeout(20000)};
 const m=await fetch(base+'publication.json?check='+stamp,options);
 if(!m.ok)throw Error('Deployment manifest HTTP '+m.status);
 const manifest=await m.json();
 const r=await fetch(base+'data.js?check='+stamp,options);
 if(!r.ok)throw Error('Public data.js HTTP '+r.status);
 const bytes=Buffer.from(await r.arrayBuffer());
 if(!validManifest(manifest,bytes))throw Error('Deployment manifest and public data.js checksum mismatch');
 return manifest;
}
function ancestor(a,b){
 if(!sha(a)||!sha(b))return false;
 if(a===b)return true;
 const c=api(root+'/compare/'+a+'...'+b);
 return c.status==='ahead'||c.status==='identical';
}
function receiptFor(run){
 const artifacts=api(root+'/actions/runs/'+run.id+'/artifacts?per_page=100').artifacts;
 if(!artifacts.some(a=>a.name==='publication-receipt'&&!a.expired))return null;
 const dir=mkdtempSync(join(tmpdir(),'utd-receipt-'));
 try{
  gh('run','download',String(run.id),'--repo',repo,'--name','publication-receipt','--dir',dir);
  return JSON.parse(readFileSync(join(dir,'publication-receipt.json'),'utf8'));
 }finally{rmSync(dir,{recursive:true,force:true});}
}
function findPR(receipt){
 const rows=api(root+'/pulls?state=all&per_page=100&head='+encodeURIComponent('Chizumulu:'+receipt.branch)+'&base=main');
 return rows.find(p=>p.head.sha===receipt.commit)||null;
}
const incidentPrefix='[UTD 반영 추적] run ';
const errors=new Set(['run_delayed','run_failed','receipt_missing','pr_missing','pr_closed_unmerged','pr_review_overdue','publication_unverified']);
async function main(){
 if(process.env.GITHUB_REPOSITORY!==repo)throw Error('Unexpected repository');
 const start=Date.parse(process.env.PUBLICATION_MONITOR_START_AT||'');
 if(!Number.isFinite(start))throw Error('Set PUBLICATION_MONITOR_START_AT to activation timestamp');
 const now=Date.now();
 const cutoff=new Date(Math.max(start,now-7*24*hour)).toISOString();
 const open=JSON.parse(gh('issue','list','--repo',repo,'--state','open','--limit','100','--search','"UTD 반영 추적" in:title','--json','title,number'));
 const incidents=new Map(open.filter(i=>i.title.startsWith(incidentPrefix)).map(i=>[i.title,i.number]));
 const manifest=await getPublication();
 const current=api(root+'/commits/main').sha;
 if(!ancestor(manifest.commit,current))throw Error('Published commit is not an ancestor of main');
 const report=[];
 for(const workflow of workflows){
  const runs=api(root+'/actions/workflows/'+workflow+'.yml/runs?event=repository_dispatch&per_page=100&created='+encodeURIComponent('>='+cutoff));
  if(runs.total_count>100)throw Error('Approval run scan limit exceeded: '+workflow);
  for(const run of runs.workflow_runs){
   if(Date.parse(run.created_at)<start)continue;
   let receipt=null,pr=null,proof=false;
   if(run.status==='completed'&&run.conclusion==='success'){
    receipt=receiptFor(run);
    if(validReceipt(receipt,run)){
     if(receipt.branch.startsWith('automation/'))pr=findPR(receipt);
     const target=receipt.branch.startsWith('automation/')?pr?.merged_at&&pr.merge_commit_sha:receipt.commit;
     // A squash merge changes SHA; prove the matching PR was merged and deployed.
     if(target&&ancestor(target,manifest.commit)){
      proof=true;
      if(target===manifest.commit&&receipt.branch==='main'&&!matchesSourceReceipt(receipt,manifest))proof=false;
     }
    }
   }
   const status=classify(run,receipt,pr,proof,now);
   const title=incidentPrefix+run.id;
   const issue=incidents.get(title);
   report.push(workflow+' / '+run.id+' / '+status);
   if(errors.has(status)&&!issue){
    gh('issue','create','--repo',repo,'--title',title,'--body','승인 반영 추적에서 확인이 필요합니다.\n\nWorkflow: '+workflow+'\nStatus: '+status+'\nRun: https://github.com/'+repo+'/actions/runs/'+run.id+(pr?'\nPR: '+pr.html_url:'')+'\n\n자동 재승인·강제 병합은 하지 않습니다.');
   }else if(status==='verified'&&issue){
    gh('issue','close',String(issue),'--repo',repo,'--comment','승인 실행의 커밋 또는 병합 커밋이 공개 배포에 포함되고 공개 data.js의 체크섬이 일치함을 확인했습니다.');
   }
  }
 }
 const summary=['## Approval publication tracking','',...report.map(s=>'- '+s),report.length?'':'No eligible recent approvals.'].join('\n')+'\n';
 console.log(summary);
 if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
 if(report.some(s=>errors.has(s.split(' / ').at(-1))))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
