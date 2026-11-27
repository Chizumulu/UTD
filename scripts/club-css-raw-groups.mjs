// Deferred assets are built from complete PostCSS top-level rules. Preserve
// their original source text, including shorthands containing var().
// CSSRule.cssText is not a lossless serialization of pending substitutions.
export function parseDeferredCssGroups(source,kind){
 const prefix='#utd-club-css-slot-'+kind+'-';
 const groups=[];
 let start=0,depth=0,paren=0,bracket=0,quote='';
 function consume(raw){
  const rule=raw.trim();
  if(rule.startsWith(prefix)){
   const match=/^(#utd-club-css-slot-[a-z]+-\d+)\s*\{\s*--utd-club-slot\s*:\s*0\s*;?\s*\}$/.exec(rule);
   if(!match||match[1]!==prefix+groups.length)throw Error('Invalid deferred CSS marker');
   groups.push({id:match[1],rules:[]});
  }else{
   if(!groups.length)throw Error('Deferred CSS has rules before first slot');
   groups.at(-1).rules.push(rule);
  }
 }
 for(let i=0;i<source.length;i++){
  const c=source[i],next=source[i+1];
  if(c==='\\'){if(++i>=source.length)throw Error('Truncated CSS escape');continue;}
  if(quote){if(c===quote)quote='';continue;}
  if(c==='"'||c==="'"){quote=c;continue;}
  if(c==='/'&&next==='*'){
   const end=source.indexOf('*/',i+2);
   if(end<0)throw Error('Unclosed CSS comment');
   i=end+1;continue;
  }
  if(c==='('){paren++;continue;}
  if(c===')'){if(--paren<0)throw Error('Unbalanced CSS parentheses');continue;}
  if(c==='['){bracket++;continue;}
  if(c===']'){if(--bracket<0)throw Error('Unbalanced CSS brackets');continue;}
  if(paren||bracket)continue;
  if(c==='{')depth++;
  else if(c==='}'){
   if(--depth<0)throw Error('Unbalanced CSS block');
   if(depth===0){consume(source.slice(start,i+1));start=i+1;}
  }else if(c===';'&&depth===0)throw Error('Unexpected top-level CSS statement');
 }
 if(depth||paren||bracket||quote||source.slice(start).trim())throw Error('Incomplete deferred CSS');
 if(!groups.length||groups.some(g=>!g.rules.length))throw Error('Empty deferred CSS slot');
 return groups;
}
