import { applyResponsiveCrests, applyStaticCrests } from './crest-templates.mjs';
import { minifyPagesAssets } from './minify-pages-assets.mjs';
import { prioritizeInitialRender, preloadInitialAssets } from './initial-render.mjs';
import { optimizeExternalScripts } from './external-script-delivery.mjs';
import { optimizeFontDelivery } from './font-delivery.mjs';
import { writeSeo } from './seo-pages.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [output] = process.argv.slice(2);
if (!output) throw new Error('Usage: node scripts/build-pages.mjs <output-directory>');

const versionFiles = {
  style: 'style.css',
  data: 'data.js',
  app: 'app.js',
  report: 'report.js',
  archive: 'archive-2526.js',
  predictWorker: 'predict-worker.js',
  pathfinderEngine: 'pathfinder-engine.js',
  teamAnalysis: 'team-analysis.js',
  poster: 'poster.js',
  travelAnalysis: 'travel-analysis.js',
  venueMatrix: 'venue-matrix.js',
  venueRoutes: 'venue-routes.js',
  a11y: 'a11y.js'
};
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(file => file === '.nojekyll' || file.startsWith('fonts/') || /^[^./][^/]*$/.test(file));
const publishedFiles = new Set(files);

// Copy source assets first, then optimize only the deployment artifact.
for (const file of files) {
  const destination = join(output, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(file, destination);
}
execFileSync('python3', ['scripts/generate-crest-assets.py', output], {stdio:'inherit'});
const manifest = JSON.parse(readFileSync(join(output,'crest-manifest.json'),'utf8'));
const appPath = join(output,'app.js');
writeFileSync(appPath, prioritizeInitialRender(applyResponsiveCrests(readFileSync(appPath,'utf8'), manifest)));
await minifyPagesAssets(output);
for (const file of ['app.js','a11y.js']) execFileSync(process.execPath,['--check',join(output,file)],{stdio:'inherit'});

function assetVersion(file) {
  if (!publishedFiles.has(file)) throw new Error(`Asset is missing from the Pages artifact: ${file}`);
  return createHash('sha256').update(readFileSync(join(output,file))).digest('hex').slice(0, 16);
}

const source = readFileSync('index.html', 'utf8');
const versionBlock = /window\.ASSET_VERSIONS\s*=\s*\{[^}]*\}/;
const block = source.match(versionBlock);
if (!block) throw new Error('window.ASSET_VERSIONS was not found in index.html');

const updatedBlock = block[0].replace(/\b(\w+):\s*'[^']*'/g, (_, key) => {
  if (!Object.hasOwn(versionFiles, key)) throw new Error(`Missing asset mapping: ${key}`);
  return `${key}: '${assetVersion(versionFiles[key])}'`;
});
const html = source.replace(versionBlock, updatedBlock).replace(
  /((?:src|href)=["'](?:\.\/)?([\w.-]+\.(?:js|css))\?v=)[\w.-]+/g,
  (_, prefix, file) => prefix + assetVersion(file)
);

const fontCss = readFileSync(join(output,'fonts/pretendard/pretendardvariable-dynamic-subset.css'),'utf8');
writeFileSync(join(output,'index.html'),preloadInitialAssets(optimizeExternalScripts(optimizeFontDelivery(applyStaticCrests(html,manifest),fontCss)),{style:assetVersion('style.css'),data:assetVersion('data.js'),app:assetVersion('app.js')}));

writeSeo(output, readFileSync('data.js', 'utf8'), {analyticsVersion:assetVersion('utd-analytics.js')});

// Public deployment receipt contains only repository revision and public asset digest.
writeFileSync(join(output,'publication.json'),JSON.stringify({version:1,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dataSha256:createHash('sha256').update(readFileSync(join(output,'data.js'))).digest('hex')})+'\n');
