import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {readCard,compare} from './dry-run.mjs';
import {resolveProductionSlot as resolveSlot,resolveFallbackSlot} from './resolve-production.mjs';
import {validateCandidates} from './plan-lineup.mjs';

const {post,bytes}=await readCard({raw:true});
const reader=fileURLToPath(new URL('./read-new-card.py',import.meta.url));
const raw=execFileSync('/usr/bin/python3',[reader],{input:bytes,encoding:'utf8',timeout:900000,maxBuffer:2*1024*1024});
const ocr=JSON.parse(raw);
const source=await readFile('data.js','utf8');
const squadData=runInNewContext(source+'\n;squadData',{}, {timeout:3000});
console.log(JSON.stringify({status:ocr.status,reason:ocr.reason,layouts:ocr.candidates?.map(c=>({layout:c.layout,starters:c.starters.map(s=>({...s,...resolveSlot(s,squadData)})),bench:c.bench.map(s=>({...s,...resolveSlot(s,squadData)}))}))},null,2));
// Use exactly the production validator, not a best-of result selected using historical answers.
console.log(JSON.stringify({fallbackDiagnostics:ocr.candidates?.map(c=>({layout:c.layout,slots:[...c.starters,...c.bench].map((slot,i)=>({i,primary:resolveSlot(slot,squadData),fallback:resolveSlot(slot,squadData).number==null?resolveFallbackSlot(slot,squadData):null}))}))}));
const chosen=validateCandidates(ocr,squadData);
console.log(JSON.stringify({selectedLayout:chosen.layout,reviewMatches:chosen.reviewMatches},null,2));
const candidate=ocr.candidates.find(c=>c.layout===chosen.layout);
if(!candidate)throw Error('Selected OCR candidate missing');
// Compare the actual production-selected players, not legacy OCR guesses.
const confirmedSlot=p=>({votes:{[p.number]:3},names:[p.nameKo]});
const result=compare(source,post,{starters:chosen.starters.map(confirmedSlot),bench:chosen.bench.map(confirmedSlot),captain:candidate.captain??null});
console.log(JSON.stringify({status:'passed',layout:chosen.layout,round:result.round,starters:result.starters,bench:result.bench,changes:0},null,2));
