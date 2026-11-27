// Conservative deployment-only minification. Source files are never changed.
import { minify } from 'terser';
import postcss from 'postcss';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// Keep data.js byte-identical for publication receipts. Leave analytics,
// service workers, push and optional feature scripts outside this first pass.
export const JS_FILES = ['app.js', 'a11y.js'];
export const CSS_FILES = ['style.css'];

export async function minifyJs(source) {
  const result = await minify(source, {
    compress: false,
    mangle: false,
    module: false,
    toplevel: false,
    format: { comments: /^!|@license|@preserve/i, ascii_only: false, semicolons: true }
  });
  if (typeof result.code !== 'string' || !result.code.length) throw Error('Empty minified JavaScript');
  return result.code;
}

// Only change parser-owned formatting. Preserve all selectors, declaration
// values, at-rule parameters, cascade order, and comments (including licenses).
// Check the complete parsed tree, ignoring formatting metadata only.
export function cssSignature(css) {
  function visit(node) {
    const {type,selector,name,params,prop,value,important,text,nodes}=node;
    return {type,selector,name,params,prop,value,important,text,nodes:nodes?.map(visit)};
  }
  return JSON.stringify(visit(postcss.parse(css)));
}
export async function minifyCss(source) {
  const root=postcss.parse(source);
  root.walk(node=>{
    // Raw selector/value/params representations may include meaningful tokens.
    // Do not touch them, custom-property values, or comment text.
    if(typeof node.raws.before==='string' && /^\s*$/.test(node.raws.before))node.raws.before='';
    if(typeof node.raws.after==='string' && /^\s*$/.test(node.raws.after))node.raws.after='';
    if(node.type==='decl' && /^\s*:\s*$/.test(node.raws.between||''))node.raws.between=':';
    if((node.type==='rule'||node.type==='atrule') && /^\s+$/.test(node.raws.between||''))node.raws.between='';
  });
  root.raws.after='';
  const css=root.toString();
  if (!css.length || cssSignature(css)!==cssSignature(source)) throw Error('CSS structural integrity check failed');
  return css;
}

export async function minifyPagesAssets(output) {
  const results = [];
  for (const [files,transform] of [[JS_FILES,minifyJs],[CSS_FILES,minifyCss]]) {
    for (const file of files) {
      const path = join(output,file);
      const original = readFileSync(path,'utf8');
      const optimized = await transform(original);
      const before = Buffer.byteLength(original), after = Buffer.byteLength(optimized);
      const gzipBefore = gzipSync(original).length, gzipAfter = gzipSync(optimized).length;
      const applied = after < before && gzipAfter <= gzipBefore;
      if (applied) writeFileSync(path,optimized);
      results.push({file,before,after:applied?after:before,gzipBefore,gzipAfter:applied?gzipAfter:gzipBefore,applied});
    }
  }
  console.log('Pages minification (bytes): '+JSON.stringify(results));
  return results;
}
