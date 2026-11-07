#!/usr/bin/env node
// 구장 ↔ 구장 "실제 도로 거리/시간" 전체 표(매트릭스)를 OSRM table API로 한 번에 받아 venue-matrix.js 로 저장합니다.
// (사이트의 "구단 위치 > 원정거리 × 성적 분석" 카드가 이 파일을 읽습니다. 구장이 바뀌거나 추가되면 다시 실행해서 덮어쓰세요.)
// (fetch-venue-routes.js 는 항구→구장만 받지만, 이 스크립트는 모든 구장 쌍을 받습니다. 요청은 딱 1번입니다.)
//
// 사용법 (Node 18+, 인터넷 연결된 본인 컴퓨터에서 data.js 가 있는 폴더에서):
//   node fetch-venue-matrix.js
//   node fetch-venue-matrix.js --data data.js --out venue-matrix.js
// 결과 venue-matrix.js 를 사이트 폴더에 두고 index.html 의 ASSET_VERSIONS.venueMatrix 값을 올리면 됩니다.
// (--out 을 .json 으로 주면 순수 JSON 으로 저장합니다.)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OSRM_BASE = process.env.OSRM_BASE || 'https://router.project-osrm.org';
const PORT = { nameEn: 'Nkhata Bay Port', lat: -11.607396054564349, lng: 34.3006527790571 };

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const dataPath = path.resolve(argVal('--data', 'data.js'));
const outPath = path.resolve(argVal('--out', 'venue-matrix.js'));
const keyOf = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

function extractConst(src, name) {
  const start = src.indexOf(`const ${name} = [`);
  if (start < 0) return [];
  const end = src.indexOf('\n];', start);
  const code = src.slice(start, end + 3).replace(`const ${name} =`, `__out =`);
  const ctx = { __out: null };
  vm.runInNewContext(code, ctx);
  return ctx.__out;
}

function collectVenues(src) {
  const map = new Map();
  const add = (v) => {
    if (!v || typeof v.lat !== 'number') return;
    const k = keyOf(v.lat, v.lng);
    if (!map.has(k)) map.set(k, { key: k, lat: v.lat, lng: v.lng, nameEn: v.nameEn });
  };
  extractConst(src, 'leagueData').forEach(t => {
    if (t.nameEn === 'Chizumulu United FC') return; // 섬 구장은 도로망 밖
    add(t.venue);
    (t.venueHistory || []).forEach(h => add(h.venue));
  });
  extractConst(src, 'extraVenues').forEach(e => add(e.venue));
  return [...map.values()];
}

(async () => {
  const venues = collectVenues(fs.readFileSync(dataPath, 'utf8'));
  const pts = [{ key: 'port', ...PORT }, ...venues];
  console.log(`지점 ${pts.length}곳 (항구 포함) — 서버: ${OSRM_BASE}`);
  const coords = pts.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/table/v1/driving/${coords}?annotations=distance,duration`;
  const res = await fetch(url, { headers: { 'User-Agent': 'chizumulu-fansite-matrix-builder' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (j.code !== 'Ok') throw new Error('OSRM: ' + j.code);

  const out = { generated: new Date().toISOString().slice(0, 10), source: 'OSRM table (driving, 최단시간 경로)',
    points: pts.map(p => ({ key: p.key, nameEn: p.nameEn, lat: p.lat, lng: p.lng })),
    distanceKm: j.distances.map(r => r.map(d => d == null ? null : Math.round(d / 100) / 10)),
    durationMin: j.durations.map(r => r.map(d => d == null ? null : Math.round(d / 60))) };
  const json = JSON.stringify(out, null, 1);
  const body = /\.json$/i.test(outPath) ? json :
`// 자동 생성 파일 — scripts/fetch-venue-matrix.js 로 만든 값입니다. 직접 고치지 마세요.
// 생성일: ${out.generated} · 출처: ${out.source}
// points[i]: 구장(key = 위도,경도 소수 5자리) · distanceKm[i][j]/durationMin[i][j]: i번 지점 → j번 지점 도로 거리(km)/시간(분). 0번은 은카타베이 항구.
const venueMatrix = ${json};
`;
  fs.writeFileSync(outPath, body);
  const nulls = out.distanceKm.flat().filter(v => v == null).length;
  console.log(`저장 완료: ${outPath}${nulls ? `  ⚠ 경로를 못 찾은 쌍 ${nulls}개` : ''}`);
})().catch(e => { console.error(e); process.exit(1); });
