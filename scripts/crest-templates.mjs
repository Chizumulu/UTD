// Build-time, narrowly scoped responsive attributes for the diagnosed home/league logos.
// Original source URLs, HTML classes and layout remain unchanged.
const targets = [
  { needle: 'class="team-logo" src="${team.logoSrc}" data-en-name="${team.nameEn}" alt="${team.nameEn}"', expr: 'team.logoSrc', sizes: '24px', minimum: 2 },
  { needle: 'src="${nmx.oppLogo}" alt="${nmx.oppEn}"', expr: 'nmx.oppLogo', sizes: '68px', minimum: 1 },
  { needle: 'class="nmc-logo${alt ? \' nmc-logo-alt\' : \'\'}" src="${esc(logo)}"', expr: 'logo', sizes: '24px', minimum: 1 },
  { needle: 'class="nmc-logo nmc-logo-alt" src="${esc(logo)}"', expr: 'logo', sizes: '24px', minimum: 1 },
  { needle: 'class="nmc-logo" src="${esc(logo)}"', expr: 'logo', sizes: '24px', minimum: 1 }
];

export function applyResponsiveCrests(source, manifest) {
  let result = source;
  for (const {needle, expr, sizes, minimum} of targets) {
    const hits = result.split(needle).length - 1;
    if (hits < minimum) throw Error('Responsive crest template changed: ' + needle);
    const replacement = needle.replace('src="', '${utdResponsiveCrestAttrs(' + expr + ', "' + sizes + '")} src="');
    result = result.split(needle).join(replacement);
  }
  const json = JSON.stringify(manifest).replace(/</g, '\\u003c');
  const prelude = `
// Generated responsive crest manifest (deployment only).
const utdResponsiveCrestManifest = ${json};
function utdResponsiveCrestAttrs(original, sizes) {
  if (typeof original !== 'string') return '';
  const key = original.replace(/^\\.\\//, '');
  if (!Object.hasOwn(utdResponsiveCrestManifest, key)) return '';
  const entry = utdResponsiveCrestManifest[key];
  const candidates = entry.variants
    .filter(v => /^crest-assets\\/[a-f0-9]{16}-(64|128|256)\\.webp$/.test(v.src) && Number.isInteger(v.width) && v.width > 0)
    .map(v => v.src + ' ' + v.width + 'w');
  if (!candidates.length) return '';
  candidates.push(encodeURIComponent(key) + ' ' + entry.width + 'w');
  return 'srcset="' + candidates.join(', ') + '" sizes="' + sizes + '"';
}
// If an optimized image fails, retry its existing original src before legacy fallbacks.
document.addEventListener('error', function(event) {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.hasAttribute('srcset')) return;
  const selected = img.currentSrc;
  if (!selected || !/\\/crest-assets\\/[a-f0-9]{16}-(64|128|256)\\.webp(?:$|\\?)/.test(selected)) return;
  event.stopImmediatePropagation();
  img.removeAttribute('srcset');
  img.removeAttribute('sizes');
}, true);
`;
  return prelude + '\n' + result;
}
