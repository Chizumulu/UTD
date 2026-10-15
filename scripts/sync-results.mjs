#!/usr/bin/env node
// ===== 경기 결과 자동 취합 (dry-run 기본, 검증된 제안만 --apply) =====
// 종료된 경기의 결과를 취합하고, --apply일 때 안전 조건을 통과한 결과만 data.js에 반영합니다.
//
// 사용법
//   node scripts/sync-results.mjs                    # 실제 API 조회 (Node 18+)
//   node scripts/sync-results.mjs --file test/x.json # 로컬 JSON 으로 테스트
//   node scripts/sync-results.mjs --json             # 기계가 읽는 JSON 출력 (2단계용)
//   옵션: --hours 48 (이 시간보다 오래된 게시물은 안 봄) --pages 10 --limit 50 --data data.js

import fs from 'node:fs';
import vm from 'node:vm';

// ---------- 설정 ----------
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);

const API_URL   = opt('api', 'https://api.chizumulu.net/v1/structured');
const DATA_PATH = opt('data', 'data.js');
const HOURS     = Number(opt('hours', 48));
const MAX_PAGES = Number(opt('pages', 10));
const LIMIT     = Number(opt('limit', 50));
const CURSOR_PARAM = opt('cursor-param', 'cursor'); // ⚠ nextCursor 를 넘기는 파라미터 이름(미확인) — 필요하면 옵션으로 변경

// 종료 상태로 취급할 값. 실제 종료 게시물을 한 번 보고 확정할 것(리포트 맨 아래에 "관측된 status 목록"을 찍어 줌).
const FINISHED_RE = /^(full[_\s-]?time|ft|finished|final|ended|completed|match[_\s-]?ended)$/i;

// ---------- 유틸 ----------
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\bfc\b/g, '').replace(/\s+/g, ' ').trim();
const upperName = (s) => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// 골 이벤트 판정: API 가 득점 이벤트의 type 을 "goal" 로 통일하지 않고 득점 방식으로 내려주는 경우가 있습니다
// (예: 프리킥 골 → "free_kick"). 그래서 type 이름만 보지 않고, 득점자(role=scorer 등)가 붙어 있는지도 함께 봅니다.
// 경고/교체/하프타임/단순 프리킥 같은 이벤트는 득점자 role 이 없으므로 걸러집니다.
const GOAL_TYPE_RE = /goal|penalt|own/i;
const isGoalEvent = (ev) => GOAL_TYPE_RE.test(ev.type || '') || (ev.players || []).some(p => /scorer|own|pen/i.test(p.role || ''));

// ---------- data.js 읽기 ----------
const dataSrc = fs.readFileSync(DATA_PATH, 'utf8');
const D = vm.runInNewContext(
  dataSrc + '\n;({leagueData,scheduledRounds,roundsData,nameAliases,playerDirectory})',
  { console: { log() {}, warn() {}, error() {} }, setTimeout }
);
const teamByNorm = new Map(D.leagueData.map(t => [norm(t.nameEn), t]));
const aliasOf = (key) => D.nameAliases[key] || key;

// 기존 경기 데이터에서 팀별 득점자 이름을 모읍니다.
// 선수 이름 fuzzy matching은 같은 팀 후보 안에서만 수행합니다.
const scorerHistory = new Map();
function scorerLabelName(label) {
  return String(label || '').replace(/\s*\([^)]*\)\s*/g, '').trim();
}
function addScorerHistory(teamName, label) {
  const name = upperName(scorerLabelName(label));
  if (!name || name === '없음' || name.includes('이름 미확인')) return;
  const key = norm(teamName);
  if (!scorerHistory.has(key)) scorerHistory.set(key, new Set());
  scorerHistory.get(key).add(aliasOf(name));
}
for (const rounds of [D.roundsData, D.scheduledRounds]) {
  for (const list of Object.values(rounds)) for (const f of list || []) {
    if (!f.homeEn || !f.awayEn) continue;
    String(f.scorersHome || '').split(',').forEach(n => addScorerHistory(f.homeEn, n));
    String(f.scorersAway || '').split(',').forEach(n => addScorerHistory(f.awayEn, n));
  }
}
function resolveScorerName(rawName, teamName, matchSeen, issues) {
  const raw = upperName(rawName);
  const direct = aliasOf(raw);
  if (direct !== raw) issues.push(`이름 보정(nameAliases): ${raw} → ${direct}`);
  const history = scorerHistory.get(norm(teamName)) || new Set();
  if (history.has(direct)) return direct;
  const pool = new Set([...history, ...matchSeen].map(aliasOf));
  const candidates = [...pool].map(name => ({ name, distance: lev(raw, name) }))
    .filter(x => x.distance > 0 && x.distance <= 2)
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  if (candidates.length && (!candidates[1] || candidates[0].distance < candidates[1].distance)) {
    issues.push(`이름 철자 보정(같은 팀 기존 득점자): ${raw} → ${candidates[0].name}`);
    return candidates[0].name;
  }
  if (candidates.length) {
    issues.push(`이름 후보가 여러 명이라 확인 필요: ${raw} → ${candidates.filter(x => x.distance === candidates[0].distance).map(x => x.name).join(' / ')}`);
    return raw;
  }
  issues.push(`신규 득점자: ${raw} (같은 팀 기존 득점자 기록에서 일치 항목 없음)`);
  return direct;
}

// ---------- API 조회 ----------
async function fetchItems() {
  const fileArg = opt('file', null);
  if (fileArg) return JSON.parse(fs.readFileSync(fileArg, 'utf8')).items || [];
  const cutoff = Date.now() - HOURS * 3600 * 1000;
  const items = [];
  let cursor = null;
  for (let p = 0; p < MAX_PAGES; p++) {
    const url = new URL(API_URL);
    url.searchParams.set('limit', String(LIMIT));
    if (cursor) url.searchParams.set(CURSOR_PARAM, cursor);
    const res = await fetch(url, { headers: { 'user-agent': 'chizumulu-results-sync/1.0' } });
    if (!res.ok) { warn(`API 응답 오류 ${res.status} (page ${p + 1}) — 여기까지 모은 데이터로 진행합니다.`); break; }
    const json = await res.json();
    if (!Array.isArray(json.items)) throw new Error('API 응답 형식이 예상과 다릅니다 (items 배열 없음) — 형식 변경 의심');
    items.push(...json.items);
    const oldest = json.items.length ? Date.parse(json.items[json.items.length - 1].sourceTimestamp) : 0;
    if (!json.nextCursor || oldest < cutoff) break;
    cursor = json.nextCursor;
  }
  return items.filter(it => Date.parse(it.sourceTimestamp) >= cutoff);
}

const globalWarnings = [];
function warn(msg) { globalWarnings.push(msg); }

// ---------- 경기별 취합 ----------
// 한 경기 = 홈팀+원정팀(정규화). 게시물을 시간순으로 훑으며 (a) 가장 최근 스코어/상태, (b) 득점 이벤트(중복 제거)를 모읍니다.
function aggregate(items) {
  const seenStatuses = new Set();
  const games = new Map();
  const sorted = [...items].sort((a, b) => Date.parse(a.sourceTimestamp) - Date.parse(b.sourceTimestamp));
  for (const it of sorted) {
    const matches = it.structured?.matches;
    if (!Array.isArray(matches)) continue;
    for (const m of matches) {
      if (!m.homeTeam || !m.awayTeam) continue;
      seenStatuses.add(m.status);
      const key = norm(m.homeTeam) + '|' + norm(m.awayTeam);
      const g = games.get(key) || { key, homeRaw: m.homeTeam, awayRaw: m.awayTeam, goals: new Map(), posts: 0, statusHistory: [] };
      g.posts++;
      g.last = { status: m.status, homeScore: m.homeScore, awayScore: m.awayScore, at: it.sourceTimestamp, id: it.rawUpdateId };
      if (m.dateText) g.dateText = m.dateText;
      if (g.statusHistory[g.statusHistory.length - 1] !== m.status) g.statusHistory.push(m.status);
      for (const ev of (m.events || [])) {
        if (!isGoalEvent(ev)) continue;
        if (ev.homeScore == null || ev.awayScore == null) continue;
        // 같은 골이 여러 게시물에 중복되므로 "골 직후 스코어"를 고유키로 삼습니다. (예: 0-1, 0-2 ...)
        const gk = `${ev.homeScore}-${ev.awayScore}`;
        const prev = g.goals.get(gk);
        // 선수 정보가 있는 쪽을 우선 유지
        if (!prev || ((ev.players || []).length > (prev.players || []).length)) g.goals.set(gk, { ...ev, postId: it.rawUpdateId });
      }
      games.set(key, g);
    }
  }
  return { games, seenStatuses };
}

// ---------- 득점 이벤트 → 득점자 문자열 ----------
// 득점 후 스코어(h-a)를 순서대로 따라가며 "누가 점수를 얻었는지"를 판정합니다(자책골도 이득 본 팀 기준).
function buildScorers(g, finalHome, finalAway, issues) {
  const evs = [...g.goals.entries()].map(([k, ev]) => ({ h: ev.homeScore, a: ev.awayScore, ev }))
    .sort((x, y) => (x.h + x.a) - (y.h + y.a));
  const perTeam = { home: [], away: [] };
  let ph = 0, pa = 0, chainOk = true;
  for (const { h, a, ev } of evs) {
    const dh = h - ph, da = a - pa;
    if (!((dh === 1 && da === 0) || (dh === 0 && da === 1))) { chainOk = false; issues.push(`득점 이벤트 스코어가 1골씩 이어지지 않음 (${ph}-${pa} → ${h}-${a}): 중간 골 누락 가능`); ph = h; pa = a; continue; }
    const side = dh === 1 ? 'home' : 'away';
    const declared = ev.team ? norm(ev.team) : null;
    const sideTeam = norm(side === 'home' ? g.homeRaw : g.awayRaw);
    const isOwn = /own/i.test(ev.type || '') || (ev.players || []).some(p => /own/i.test(p.role || ''));
    if (declared && !isOwn && declared !== sideTeam) issues.push(`${ev.minuteText || '?'} 득점: 이벤트의 team(${ev.team})과 스코어 변화 방향이 다름 — 자책골 표기 여부 확인`);
    const isPen = /pen/i.test(ev.type || '') || (ev.players || []).some(p => /pen/i.test(p.role || ''));
    const player = (ev.players || []).find(p => /scorer|own|pen|goal/i.test(p.role || '')) || (ev.players || [])[0];
    if (!player) { issues.push(`${ev.minuteText || '?'} 득점자 이름 없음 (스코어 ${h}-${a})`); perTeam[side].push({ name: null, isPen, isOwn, minute: ev.minute }); }
    else perTeam[side].push({ name: player.name, isPen, isOwn, minute: ev.minute });
    ph = h; pa = a;
  }
  if (ph !== finalHome || pa !== finalAway) { chainOk = false; issues.push(`득점 이벤트로 센 스코어(${ph}-${pa})가 최종 스코어(${finalHome}-${finalAway})와 다름 — 득점자 누락 가능`); }

  const seenByTeam = { home: new Set(), away: new Set() };
  const fmt = (list, side) => {
    if (!list.length) return '없음';
    const order = [], map = new Map();
    for (const g1 of list) {
      let key = g1.name ? resolveScorerName(g1.name, side === 'home' ? g.homeRaw : g.awayRaw, seenByTeam[side], issues) : '(이름 미확인)';
      if (g1.name && key === upperName(g1.name)) seenByTeam[side].add(key);
      const k = key + (g1.isOwn ? '#OG' : '');
      if (!map.has(k)) { map.set(k, { key, n: 0, pen: 0, own: g1.isOwn }); order.push(k); }
      const e = map.get(k); e.n++; if (g1.isPen) e.pen++;
    }
    return order.map(k => {
      const e = map.get(k);
      if (e.own) return `${e.key} (자책골)`;
      if (e.n === 1) return e.pen ? `${e.key} (PK)` : e.key;
      if (e.pen === 0) return `${e.key} (${e.n}골)`;
      issues.push(`${e.key}: ${e.n}골 중 PK ${e.pen}골 — 기존 표기 규칙에 정해진 형식이 없어 수동 확인 필요`);
      return `${e.key} (${e.n}골, PK ${e.pen})`;
    }).join(', ');
  };
  const out = { scorersHome: fmt(perTeam.home, 'home'), scorersAway: fmt(perTeam.away, 'away') };
  const needsReview = issues.some(x => /이름 후보가 여러 명|이름 미확인|PK \d+골 중 PK/.test(x));
  return { ...out, chainOk, needsReview };
}

// ---------- data.js 의 어느 경기 줄인지 찾기 ----------
function findFixture(g) {
  const hits = [];
  for (const [roundKey, list] of Object.entries(D.scheduledRounds)) {
    for (const f of list) {
      if (!f.homeEn) continue;
      if (norm(f.homeEn) === norm(g.homeRaw) && norm(f.awayEn) === norm(g.awayRaw)) hits.push({ roundKey, f });
    }
  }
  return hits;
}
function alreadyRecorded(g) {
  for (const rounds of [D.roundsData, D.scheduledRounds]) {
    for (const [roundKey, list] of Object.entries(rounds)) {
      for (const f of list) if (f.homeEn && norm(f.homeEn) === norm(g.homeRaw) && norm(f.awayEn) === norm(g.awayRaw) && f.homeScore != null) return roundKey;
    }
  }
  return null;
}
function proposeLine(fixture, res) {
  const lines = dataSrc.split('\n');
  const start = lines.findIndex(l => /^const scheduledRounds\b/.test(l));
  const cands = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (/^const roundsData\b/.test(l)) break;
    if (l.includes(`homeEn: "${fixture.f.homeEn}"`) && l.includes(`awayEn: "${fixture.f.awayEn}"`)
        && (!fixture.f.kickoffDate || l.includes(`kickoffDate: "${fixture.f.kickoffDate}"`))) cands.push(i);
  }
  if (cands.length !== 1) return { error: `data.js 에서 해당 경기 줄을 ${cands.length}개 찾음 — 자동 수정 불가(수동 확인)` };
  const old = lines[cands[0]];
  const m = old.match(/^(.*?)(\s*)\}(,?)\s*$/);
  if (!m) return { error: '경기 줄의 끝 형식을 해석하지 못함' };
  const add = `, homeScore: ${res.homeScore}, awayScore: ${res.awayScore}, scorersHome: ${JSON.stringify(res.scorersHome)}, scorersAway: ${JSON.stringify(res.scorersAway)}`;
  return { lineNo: cands[0] + 1, old, next: `${m[1]}${add}${m[2]}}${m[3]}` };
}

// ---------- 실행 ----------
const items = await fetchItems();
const { games: allGames, seenStatuses } = aggregate(items);
const report = [];

// 다른 리그 경기 제외: 홈/원정 두 팀 모두 data.js 의 leagueData 에 없으면 우리 리그 경기가 아니므로 조용히 건너뜁니다.
// (한 팀이라도 있는데 대진을 못 찾는 경우는 아래에서 review 로 남겨 이름 표기 불일치를 알아챌 수 있게 합니다.)
const games = new Map();
const excluded = [];
for (const [k, g] of allGames) {
  if (teamByNorm.has(norm(g.homeRaw)) || teamByNorm.has(norm(g.awayRaw))) games.set(k, g);
  else excluded.push(`${g.homeRaw} vs ${g.awayRaw}`);
}

for (const g of games.values()) {
  const isFinal = FINISHED_RE.test(g.last.status || '');
  const entry = { match: `${g.homeRaw} vs ${g.awayRaw}`, status: g.last.status, score: `${g.last.homeScore}-${g.last.awayScore}`, posts: g.posts, final: isFinal, issues: [], verdict: null };
  if (!isFinal) { entry.verdict = 'skip(진행 중/예정)'; report.push(entry); continue; }

  const done = alreadyRecorded(g);
  if (done) { entry.verdict = `skip(이미 ${done} 에 기록됨)`; report.push(entry); continue; }
  const hits = findFixture(g);
  const open = hits.filter(h => h.f.homeScore == null && !h.f.postponed);
  if (hits.length === 0) { entry.verdict = 'review'; entry.issues.push('data.js 의 scheduledRounds 에서 이 대진을 찾지 못함 (팀 이름 표기 또는 일정 누락)'); report.push(entry); continue; }
  if (open.length !== 1) { entry.verdict = 'review'; entry.issues.push(`scheduledRounds 에서 아직 스코어가 비어 있는 해당 경기가 ${open.length}개 — 자동 선택 불가`); report.push(entry); continue; }

  const hs = g.last.homeScore, as = g.last.awayScore;
  if (!Number.isInteger(hs) || !Number.isInteger(as)) { entry.verdict = 'review'; entry.issues.push('최종 스코어가 숫자가 아님'); report.push(entry); continue; }
  const sc = buildScorers(g, hs, as, entry.issues);
  const res = { homeScore: hs, awayScore: as, scorersHome: sc.scorersHome, scorersAway: sc.scorersAway };
  entry.roundKey = open[0].roundKey; entry.result = res;
  // 득점 합계가 0-0 이면 득점 이벤트가 없는 게 정상
  const hard = !sc.chainOk || sc.needsReview;
  entry.verdict = hard ? 'review' : (entry.issues.length ? 'ok-with-notes' : 'ok');
  entry.issues = [...new Set(entry.issues)];
  // 검토가 필요한 건은 불완전한 줄을 제안하지 않습니다(사람이 확인한 뒤 수동 입력).
  if (!hard) entry.proposal = proposeLine(open[0], res);
  report.push(entry);
}

// --apply는 API 조회가 완전하고, 종료 경기이며, 검증 가능한 유일한 제안만 반영합니다.
if (flag('apply')) {
  const eligible = report.filter(r => r.final && ['ok', 'ok-with-notes'].includes(r.verdict) && r.proposal && !r.proposal.error);
  if (globalWarnings.length) {
    warn('--apply 보류: API 조회 경고가 있어 부분 데이터로는 파일을 수정하지 않았습니다.');
  } else if (eligible.length) {
    const lines = dataSrc.split(/\r?\n/);
    for (const r of eligible) {
      const i = r.proposal.lineNo - 1;
      if (lines[i] !== r.proposal.old) throw new Error(`data.js ${r.proposal.lineNo}번째 줄이 조회 시점과 달라 안전하게 적용할 수 없습니다`);
    }
    for (const r of eligible.sort((a, b) => b.proposal.lineNo - a.proposal.lineNo)) {
      lines[r.proposal.lineNo - 1] = r.proposal.next;
      r.applied = true;
    }
    fs.writeFileSync(DATA_PATH, lines.join(dataSrc.includes('\r\n') ? '\r\n' : '\n'), 'utf8');
  }
}

if (flag('json')) { console.log(JSON.stringify({ report, excluded, seenStatuses: [...seenStatuses], globalWarnings }, null, 2)); process.exit(0); }

// ---------- 사람이 읽는 리포트 ----------
const L = [];
L.push(`조회한 게시물 ${items.length}건 / 우리 리그 경기 ${games.size}개 (다른 리그 ${excluded.length}개 제외)\n`);
for (const r of report) {
  L.push(`■ ${r.match}  [${r.status} ${r.score}]  → ${r.verdict}`);
  if (r.result) {
    L.push(`   라운드: ${r.roundKey}`);
    L.push(`   스코어: ${r.result.homeScore} : ${r.result.awayScore}`);
    L.push(`   홈 득점: ${r.result.scorersHome}`);
    L.push(`   원정 득점: ${r.result.scorersAway}`);
  }
  r.issues.forEach(i => L.push(`   ⚠ ${i}`));
  if (r.proposal) {
    if (r.proposal.error) L.push(`   ✖ ${r.proposal.error}`);
    else { L.push(`   data.js ${r.proposal.lineNo}번째 줄 제안:`); L.push(`   - ${r.proposal.old.trim()}`); L.push(`   + ${r.proposal.next.trim()}`); }
  }
  L.push('');
}
globalWarnings.forEach(w => L.push(`⚠ ${w}`));
L.push(`관측된 status 값: ${[...seenStatuses].join(', ') || '(없음)'}   ← 종료 상태값이 FINISHED_RE 에 맞는지 확인`);
console.log(L.join('\n'));
