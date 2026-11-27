// Conservative deployment-only minification. Source files are never changed.
import { minify } from 'terser';
import postcss from 'postcss';
import cssnano from 'cssnano';
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

// Disable CSS restructuring and semantic normalization. Only remove
// comments and normalize whitespace using a parser, never a regex.
export async function minifyCss(source) {
  const result = await postcss([cssnano({preset:['default',{
    discardComments:{removeAll:false},
    normalizeWhitespace:true,
    // All other default transformations explicitly disabled.
    calc:false,colormin:false,convertValues:false,discardDuplicates:false,
    discardEmpty:false,discardOverridden:false,mergeLonghand:false,mergeRules:false,
    minifyFontValues:false,minifyGradients:false,minifyParams:false,minifySelectors:false,
    normalizeCharset:false,normalizeDisplayValues:false,normalizePositions:false,
    normalizeRepeatStyle:false,normalizeString:false,normalizeTimingFunctions:false,
    normalizeUnicode:false,normalizeUrl:false,orderedValues:false,reduceInitial:false,
    reduceTransforms:false,svgo:false,uniqueSelectors:false,rawCache:false
  } ]})]).process(source,{from:undefined,map:false});
  if (!result.css.length) throw Error('Empty minified CSS');
  return result.css;
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
