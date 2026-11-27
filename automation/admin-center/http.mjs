export const workerFetch=(...args)=>globalThis.fetch(...args);
// Worker-compatible timeout with fixed, sanitized error categories.
export async function requestJson(url,options,fetcher=workerFetch,timeout=15000){
 const controller=new AbortController();
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeout);
 try{
  const response=await fetcher(url,{...options,redirect:'manual',signal:controller.signal});
  if(response.type==='opaqueredirect'||response.status===0||(response.status>=300&&response.status<400)){
   try{await response.body?.cancel()}catch{}
   return {error:'redirect_blocked',httpStatus:response.status};
  }
  let body=null;
  try{body=await response.json()}catch(e){if(timedOut)throw e}
  return {response,body};
 }catch(e){
  return {error:timedOut?'timeout':e instanceof TypeError&&/illegal invocation|incompatible receiver/i.test(String(e.message))?'illegal_invocation':e instanceof TypeError&&/invalid redirect|redirect mode/i.test(String(e.message))?'unsupported_redirect':e instanceof TypeError?'request_error':'transport_error'};
 }finally{clearTimeout(timer)}
}
