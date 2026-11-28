import { applyResponsiveCrests, applyStaticCrests } from './crest-templates.mjs';
import { minifyPagesAssets } from './minify-pages-assets.mjs';
import { splitCupView } from './cup-view-split.mjs';
import { splitPredictionView } from './prediction-view-split.mjs';
import { splitClubExtras } from './club-extras-split.mjs';
import { splitClubSponsorCss } from './club-css-split.mjs';
import { splitClubDetailCss } from './club-css-detail-split.mjs';
import { wireClubDetailCss } from './club-css-detail-runtime.mjs';
import { splitFeatureCss } from './feature-css-split.mjs';
import { wireFeatureViewCss } from './feature-css-view-runtime.mjs';
import { wireFeatureModalCss } from './feature-css-modal-runtime.mjs';
import { splitArchiveView } from './archive-view-split.mjs';
import { splitVenueMap } from './venue-map-split.mjs';
import { splitMatchDetail } from './match-detail-split.mjs';
import { splitPlayerModals } from './player-modal-split.mjs';
import { splitTeamMatchCompare } from './team-match-compare-split.mjs';
import { splitSeasonCompare } from './season-compare-split.mjs';
import { splitStandingsExport } from './standings-export-split.mjs';
import { renderEarlyHero } from './early-hero.mjs';
import { optimizeAppLayout } from './app-layout.mjs';
import { prioritizeInitialRender, preloadInitialAssets } from './initial-render.mjs';
import { optimizeExternalScripts } from './external-script-delivery.mjs';
import { optimizeFontDelivery } from './font-delivery.mjs';
import { writeSeo, readSeoData } from './seo-pages.mjs';
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
execFileSync('python3', ['scripts/optimize-player-png.py', output], {stdio:'inherit'});
const manifest = JSON.parse(readFileSync(join(output,'crest-manifest.json'),'utf8'));
const appPath = join(output,'app.js');
// Reserve only the rows that the current published data will actually render.
// Use the existing mobile row sizing, not a measured aggregate pixel offset.
const initialPanelData = readSeoData(readFileSync('data.js','utf8'));
const initialClub = initialPanelData.leagueData.find(t => t.nameEn === 'Chizumulu United FC' || t.nameKo === '치주물루 유나이티드 FC');
const initialCup = initialPanelData.cupTournaments.some(Boolean);
// SEO extraction returns raw team declarations, not the computed .played field.
// Reuse the official fixture collector verbatim to keep forfeits, postponements
// and duplicate fixtures consistent with runtime standings.
const rawData = readFileSync('data.js','utf8');
const collector = rawData.match(/^function collectPlayedMatches\(\) \{[\s\S]*?^\}/m);
if (!collector) throw Error('Official played-match collector missing');
const { runInNewContext } = await import('node:vm');
const initialPlayed = initialClub ? runInNewContext(collector[0] +
  '\ncollectPlayedMatches().filter(m => m.homeEn === club || m.awayEn === club).length',
  {scheduledRounds:initialPanelData.scheduledRounds,roundsData:initialPanelData.roundsData,club:initialClub.nameEn},
  {timeout:1000,contextCodeGeneration:{strings:false,wasm:false}}) : 0;
const initialPromo = !!initialClub && initialPanelData.leagueData.length >= 2 &&
  initialPlayed < (initialPanelData.leagueData.length - 1) * 2;
function releaseInitialPanelRows(app) {
  for (const [name,id] of [['renderCupHeroPanel','nmCupPanel'],['renderPromoRaceStrip','promoRaceStrip']]) {
    const before = 'function '+name+'() {';
    if (app.split(before).length !== 2) throw Error('Expected unique initial panel renderer: '+name);
    app = app.replace(before, before+'\n    document.getElementById("'+id+'")?.removeAttribute("data-initial-panel");');
  }
  return app;
}
function reserveInitialPanelRows(html) {
  // Reserve the desktop match-card row with the existing item geometry, not a
  // fixed pixel height. The runtime renderer replaces these children normally.
  if (initialPlayed > 0) {
    const anchor = '<div class="home-match-strip" id="homeRecentStrip"></div>';
    if (html.split(anchor).length !== 2) throw Error('Expected unique recent match strip');
    const item = '<div class="home-match-item initial-home-match" aria-hidden="true"><span class="team-logo home-match-crest crest-fallback">–</span><span class="home-match-name">——</span><span class="home-match-score">–</span><span class="home-match-result">–</span><span class="home-match-date">——</span></div>';
    html = html.replace(anchor, anchor.replace('</div>', item.repeat(Math.min(5, initialPlayed)) + '</div>'));
    html = html.replace('</head>', '<style>.initial-home-match{display:none!important}@media(min-width:1200px){html:not([data-initial-deep-link]) .initial-home-match{display:flex!important;opacity:.18;pointer-events:none}}</style></head>');
  }

  for (const [id,enabled] of [['nmCupPanel',initialCup],['promoRaceStrip',initialPromo]]) {
    if (!enabled) continue;
    const anchor = 'id="'+id+'"';
    if (html.split(anchor).length !== 2) throw Error('Expected unique initial panel: '+id);
    html = html.replace(anchor,anchor+' data-initial-panel=""');
  }
  // A loading row is not interactive and contains no stale match information.
  // Existing CSS variables control the same row geometry as the real panels.
  const style = '<style>@media(max-width:720px){html:not([data-initial-deep-link]) #nmCupPanel[data-initial-panel][hidden],html:not([data-initial-deep-link]) #promoRaceStrip[data-initial-panel][hidden]{display:block!important;box-sizing:border-box;min-height:var(--m-row-h,32px);margin-top:var(--m-row-gap,6px);margin-bottom:0;padding-block:0;pointer-events:none;}html:not([data-initial-deep-link]) [data-initial-panel][hidden]::before{content:"";display:block;width:45%;height:8px;margin:11px auto;border-radius:4px;background:currentColor;opacity:.12;}}</style>';
  return html.replace('</head>','<script>if(location.hash)document.documentElement.setAttribute("data-initial-deep-link","");</script>'+style+'</head>');
}
const splitExport = await splitStandingsExport(releaseInitialPanelRows(renderEarlyHero(optimizeAppLayout(prioritizeInitialRender(applyResponsiveCrests(readFileSync(appPath,'utf8'), manifest))))));
const splitCompare = await splitSeasonCompare(splitExport.app);
const splitTeamMatch = await splitTeamMatchCompare(splitCompare.app);
const splitPlayers = await splitPlayerModals(splitTeamMatch.app);
const splitDetails = await splitMatchDetail(splitPlayers.app);
const splitVenues = await splitVenueMap(splitDetails.app);
const splitArchive = await splitArchiveView(splitVenues.app);
const sponsorCss = await splitClubSponsorCss(readFileSync(join(output,'style.css'),'utf8'));
const clubDetailCss = await splitClubDetailCss(sponsorCss.critical);
const featureCss = await splitFeatureCss(clubDetailCss.critical);
writeFileSync(join(output,'style.css'),featureCss.critical);
for (const asset of Object.values(featureCss.assets)) writeFileSync(join(output,asset.file),asset.css);
console.log('Integrated feature CSS split (bytes): '+JSON.stringify(featureCss.metrics));
for (const asset of Object.values(clubDetailCss.assets)) writeFileSync(join(output,asset.file),asset.css);
console.log('Club detail CSS split (bytes): '+JSON.stringify(clubDetailCss.metrics));
writeFileSync(join(output,sponsorCss.file),sponsorCss.optional);
console.log('Club sponsor CSS split (bytes): '+JSON.stringify(sponsorCss.metrics));
const splitExtras = await splitClubExtras(splitArchive.app,sponsorCss.url);
const splitPrediction = await splitPredictionView(splitExtras.app);
const splitCup = await splitCupView(splitPrediction.app);
const wiredClubCss = wireClubDetailCss(splitCup.app,{...clubDetailCss.assets,...featureCss.assets});
writeFileSync(appPath,wireFeatureModalCss(wireFeatureViewCss(wiredClubCss,featureCss.assets)));
writeFileSync(join(output,splitCup.file),splitCup.code);
writeFileSync(join(output,splitPrediction.file),splitPrediction.code);
writeFileSync(join(output,splitExtras.file),splitExtras.code);
writeFileSync(join(output,splitArchive.file),splitArchive.code);
writeFileSync(join(output,splitVenues.file),splitVenues.code);
writeFileSync(join(output,splitDetails.file),splitDetails.code);
writeFileSync(join(output,splitPlayers.file),splitPlayers.code);
for (const asset of splitTeamMatch.assets) writeFileSync(join(output,asset.file),asset.code);
writeFileSync(join(output,splitCompare.file),splitCompare.code);
writeFileSync(join(output,splitExport.file),splitExport.code);
await minifyPagesAssets(output);
for (const file of ['app.js','a11y.js',splitExport.file,splitCompare.file,...splitTeamMatch.assets.map(asset=>asset.file),splitPlayers.file,splitDetails.file,splitVenues.file,splitArchive.file,splitExtras.file,splitPrediction.file,splitCup.file]) execFileSync(process.execPath,['--check',join(output,file)],{stdio:'inherit'});

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
writeFileSync(join(output,'index.html'),preloadInitialAssets(optimizeExternalScripts(optimizeFontDelivery(applyStaticCrests(reserveInitialPanelRows(html),manifest),fontCss)),{style:assetVersion('style.css'),data:assetVersion('data.js'),app:assetVersion('app.js')}));

writeSeo(output, readFileSync('data.js', 'utf8'), {analyticsVersion:assetVersion('utd-analytics.js')});

// Public deployment receipt contains only repository revision and public asset digest.
writeFileSync(join(output,'publication.json'),JSON.stringify({version:1,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dataSha256:createHash('sha256').update(readFileSync(join(output,'data.js'))).digest('hex')})+'\n');
