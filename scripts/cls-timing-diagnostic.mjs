// Observational diagnostic, separate from simulated Lighthouse measurement.
// Capture real layout shift entries, their sources, mutations, font events and
// resource/hero timing. Correlation is not causal proof.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [out]=process.argv.slice(2);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const arms=['control','font','cpu','both'],ports=[8081,8082,8083,8084];
const records=[];
try{
 for(let round=0;round<3;round++)for(let offset=0;offset<4;offset++){
  const i=(offset+round)%4,arm=arms[i],port=ports[i];
  const context=await browser.newContext({viewport:{width:412,height:823},deviceScaleFactor:1.75,isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  try{
   const page=await context.newPage();
   const cdp=await context.newCDPSession(page);
   await cdp.send('Network.enable');
   await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1638.4*1024/8,uploadThroughput:675*1024/8});
   await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.route('**/*',r=>{const host=new URL(r.request().url()).hostname;return /(^|\.)(google-analytics\.com|googletagmanager\.com|clarity\.ms|onesignal\.com)$/.test(host)?r.abort():r.continue()});
   await page.addInitScript(()=>{
    const events=[],shifts=[],critical=[],frames=[]; let dropped=0;
    const add=(kind,detail={})=>{if(events.length<40000)events.push({t:performance.now(),kind,...detail});else dropped++};
    const label=n=>{if(!n)return null;const el=n.nodeType===1?n:n.parentElement;return el?el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().replace(/\s+/g,'.'):''):null};
    const rect=r=>r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
    const selectors=['.app-sidebar','.side-controls','#moreSheetSettings','#mainContent','#nextMatchStrip','#nmCupPanel','#promoRaceStrip','#rankView'];
    const geometry=()=>Object.fromEntries(selectors.map(sel=>{const e=document.querySelector(sel);return [sel,e?{...rect(e.getBoundingClientRect()),hidden:e.hidden,parent:label(e.parentElement),display:getComputedStyle(e).display,marginTop:getComputedStyle(e).marginTop}:null]}));
    const relevant=n=>n?.nodeType===1&&selectors.some(sel=>n.matches(sel)||n.querySelector(sel));
    const record=(kind,detail)=>critical.push({t:performance.now(),kind,...detail});
    for(const [proto,key] of [[Node.prototype,'appendChild'],[Node.prototype,'insertBefore'],[Node.prototype,'removeChild'],[Node.prototype,'replaceChild'],[Element.prototype,'append'],[Element.prototype,'prepend'],[Element.prototype,'remove'],[Element.prototype,'setAttribute'],[Element.prototype,'removeAttribute']]){
      const original=proto[key];if(typeof original!=='function')continue;
      proto[key]=function(...args){
        const direct=this.nodeType===1&&selectors.some(sel=>this.matches(sel));
        const hit=(key==='setAttribute'||key==='removeAttribute')?direct&&['hidden','class','style'].includes(args[0]):direct||args.some(relevant);
        if(!hit)return Reflect.apply(original,this,args);
        const detail={operation:key,target:label(this),nodes:args.filter(x=>x?.nodeType).map(label),attribute:typeof args[0]==='string'?args[0]:null,stack:new Error().stack};
        const result=Reflect.apply(original,this,args);record('dom-operation',detail);return result;
      };
    }
    let previous='';
    const sample=()=>{const g=geometry(),signature=JSON.stringify(g);if(signature!==previous){frames.push({t:performance.now(),geometry:g});previous=signature;}requestAnimationFrame(sample)};
    requestAnimationFrame(sample);
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)shifts.push({t:e.startTime,value:e.value,sources:(e.sources||[]).map(s=>({node:label(s.node),previous:rect(s.previousRect),current:rect(s.currentRect)}))})}).observe({type:'layout-shift',buffered:true});
    new MutationObserver(list=>{for(const m of list){
      const el=m.target.nodeType===1?m.target:m.target.parentElement;
      if(el&&el.closest('header,.app-shell,#mainContent,#nextMatchStrip,#rankView')&&(m.type==='childList'||['class','style','hidden','aria-busy'].includes(m.attributeName)))add('mutation',{node:label(el),type:m.type,attr:m.attributeName,added:m.addedNodes.length,removed:m.removedNodes.length});
      if(el&&(selectors.some(sel=>el.matches(sel))||[...m.addedNodes,...m.removedNodes].some(relevant)))record('critical-mutation',{node:label(el),type:m.type,attr:m.attributeName,oldValue:m.oldValue,added:[...m.addedNodes].map(label),removed:[...m.removedNodes].map(label)});
    }}).observe(document,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','hidden','aria-busy']});
    const observed=new WeakSet(),ro=new ResizeObserver(entries=>{for(const e of entries)add('resize',{node:label(e.target),w:e.contentRect.width,h:e.contentRect.height})});
    const observe=()=>{for(const el of document.querySelectorAll('header,.app-shell,#mainContent,#nextMatchStrip,#rankView,.nmh-meta-line,.nmh-venue'))if(!observed.has(el)){observed.add(el);ro.observe(el)}};
    new MutationObserver(observe).observe(document,{subtree:true,childList:true});
    document.fonts.addEventListener('loading',()=>add('font-loading'));
    for(const type of ['loadingdone','loadingerror'])document.fonts.addEventListener(type,e=>add('font-'+type,{faces:[...e.fontfaces].map(f=>({family:f.family,status:f.status,range:f.unicodeRange}))}));
    document.addEventListener('DOMContentLoaded',()=>{observe();add('dom-content-loaded')});
    window.addEventListener('load',()=>add('load'));
    window.__utdClsDiagnostic=()=>({events,shifts,critical,frames,dropped,marks:performance.getEntriesByType('mark').map(e=>({name:e.name,t:e.startTime})),resources:performance.getEntriesByType('resource').map(e=>({url:e.name,start:e.startTime,end:e.responseEnd,type:e.initiatorType,transfer:e.transferSize}))});
   });
   await page.goto('http://127.0.0.1:'+port+'/UTD/?lang=ko',{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(()=>document.querySelector('#mainMiniTableBody')?.children.length>0,{timeout:30000});
   await page.waitForTimeout(10000);
   const data=await page.evaluate(()=>window.__utdClsDiagnostic());
   let max=0,sum=0,start=0,last=0;
   for(const s of data.shifts.sort((a,b)=>a.t-b.t)){if(!sum||s.t-last>1000||s.t-start>5000){sum=0;start=s.t}sum+=s.value;last=s.t;max=Math.max(max,sum)}
   const attribution=data.shifts.map(s=>({shift:s,operations:data.critical.filter(e=>e.t>=s.t-500&&e.t<=s.t+100),before:data.frames.filter(f=>f.t<s.t).slice(-2),after:data.frames.filter(f=>f.t>=s.t).slice(0,2)}));
   const summary={arm,round:round+1,cls:max,shifts:data.shifts,dropped:data.dropped,criticalCount:data.critical.length,frameCount:data.frames.length};
   records.push(summary);writeFileSync(join(out,arm+'-'+(round+1)+'.json'),JSON.stringify({...summary,...data,attribution},null,2));
   console.log('CLS trace: '+JSON.stringify(summary));
  }finally{await context.close()}
 }
}finally{await browser.close();writeFileSync(join(out,'summary.json'),JSON.stringify(records,null,2))}
