export const workerFetch=(...args)=>globalThis.fetch(...args);
// Worker-compatible timeout with fixed, sanitized error categories.
export async function requestJson(url,options,fetcher=workerFetch,timeout=15000){
 const controller=new AbortController();
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeout);
 try{
  const response=await fetcher(url,{...options,signal:controller.signal});
  let body=null;
  try{body=await response.json()}catch(e){if(timedOut)throw e}
  return {response,body};
 }catch(e){
  return {error:timedOut?'timeout':e instanceof TypeError&&/illegal invocation|incompatible receiver/i.test(String(e.message))?'illegal_invocation':e instanceof TypeError?'request_error':'transport_error'};
 }finally{clearTimeout(timer)}
}
