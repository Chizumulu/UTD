import {existsSync,readFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// Opt-in plan is scoped to one exact PR head branch. Other benchmark PRs
// keep the fixed historical/reference protocol; manual runs keep inputs.
export function resolvePrPlan(plan,headRef,headSha){
 if(!plan||plan.branch!==headRef)return null;
 const sha=/^[a-f0-9]{40}$/;
 if(plan.schemaVersion!==1||!sha.test(plan.baseline)||![1,3,5].includes(plan.runs))throw Error('Invalid Lighthouse PR plan');
 const candidate=plan.candidate==='head'?headSha:plan.candidate;
 if(!sha.test(candidate||'')||candidate===plan.baseline)throw Error('Invalid Lighthouse PR candidate');
 return {BASE_INPUT:plan.baseline,HEAD_INPUT:candidate,RUNS:String(plan.runs)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const file='scripts/lighthouse-pr-plan.json';
 if(process.env.GITHUB_EVENT_NAME==='pull_request'&&existsSync(file)){
  const values=resolvePrPlan(JSON.parse(readFileSync(file,'utf8')),process.env.GITHUB_HEAD_REF,process.env.PR_HEAD_SHA);
  if(values){
   if(!process.env.GITHUB_ENV)throw Error('Missing GitHub environment file');
   appendFileSync(process.env.GITHUB_ENV,Object.entries(values).map(([k,v])=>k+'='+v+'\n').join(''));
   console.log('Explicit Lighthouse PR measurement: '+JSON.stringify(values));
  }
 }
}
