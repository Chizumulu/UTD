import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {readCard,compare,resolveSlot} from './dry-run.mjs';
import {validateCandidates} from './plan-lineup.mjs';

const {post,bytes}=await readCard({raw:true});
const reader=fileURLToPath(new URL('./read-new-card.py',import.meta.url));
const raw=execFileSync('/usr/bin/python3',[reader],{input:bytes,encoding:'utf8',timeout:240000,maxBuffer:2*1024*1024});
const ocr=JSON.parse(raw);
const source=await readFile('data.js','utf8');
const squadData=runInNewContext(source+'\n;squadData',{}, {timeout:3000});
console.log(JSON.stringify({status:ocr.status,reason:ocr.reason,layouts:ocr.candidates?.map(c=>({layout:c.layout,starters:c.starters.map(s=>({...s,...resolveSlot(s,squadData)})),bench:c.bench.map(s=>({...s,...resolveSlot(s,squadData)}))}))},null,2));
// Use exactly the production validator, not a best-of result selected using historical answers.
const chosen=validateCandidates(ocr,squadData);
const candidate=ocr.candidates.find(c=>c.layout===chosen.layout);
if(!candidate)throw Error('Selected OCR candidate missing');
const result=compare(source,post,candidate);
console.log(JSON.stringify({status:'passed',layout:chosen.layout,round:result.round,starters:result.starters,bench:result.bench,changes:0},null,2));
