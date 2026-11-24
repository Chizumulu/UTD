import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

function readFixtures(source) {
  new vm.Script(source, { filename: 'data.js' });
  const declarations = ['leagueData', 'scheduledRounds', 'roundsData'].map(name => {
    const end = name === 'leagueData' ? '\\]' : '\\}';
    const declaration = source.match(new RegExp('^const ' + name + ' = [\\s\\S]*?^' + end + '[ \\t]*;', 'm'));
    if (!declaration) throw new Error(`data.js에서 ${name} 선언을 찾을 수 없습니다.`);
    return declaration[0];
  });
  const { leagueData, scheduledRounds, roundsData } = vm.runInNewContext(
    declarations.join('\n') + '\n;({leagueData, scheduledRounds, roundsData})',
    Object.create(null), { filename: 'data.js', timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }
  );
  const rows = Object.entries({ ...scheduledRounds, ...roundsData }).flatMap(([round, fixtures]) =>
    fixtures.filter(fixture => !fixture.byeEn && !fixture.byeKo).map(fixture => ({ ...fixture, round }))
  );
  return { teams: new Set(leagueData.map(team => team.nameEn)), rows };
}

function dateIsValid(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function fixtureLabel(row) {
  return `${row.round} · ${row.homeKo || row.homeEn || '?'} vs ${row.awayKo || row.awayEn || '?'}`;
}

function validate({ teams, rows }) {
  const issues = new Map();
  const active = new Map();
  const byRoundAndId = new Map(rows.map(row => [`${row.round}:${row.fixtureId}`, row]));
  for (const row of rows) {
    const { fixtureId, homeEn, awayEn, kickoffDate, kickoffTime, homeScore, awayScore, movedFromWeek, movedToWeek } = row;
    const report = (code, value, message) => issues.set(JSON.stringify([code, row.round, fixtureId, homeEn, awayEn, value]),
      `${fixtureLabel(row)} · ${message}`);
    if (!/^[a-z0-9][a-z0-9.-]{0,127}$/.test(fixtureId || '')) report('id', fixtureId, '경기 ID가 없거나 형식이 올바르지 않습니다.');
    for (const team of [homeEn, awayEn]) {
      if (!teams.has(team)) report('team', team, `등록되지 않은 팀 이름입니다 (${team ?? '빈 값'}).`);
    }
    if (homeEn === awayEn) report('same-team', null, '홈·원정 팀이 같습니다.');
    if (kickoffDate != null && !dateIsValid(kickoffDate)) report('date', kickoffDate, `날짜가 올바르지 않습니다 (${kickoffDate}).`);
    if (kickoffTime != null && (typeof kickoffTime !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(kickoffTime))) {
      report('time', kickoffTime, `킥오프 시간이 올바르지 않습니다 (${kickoffTime}).`);
    }
    if (homeScore != null || awayScore != null) {
      if (![homeScore, awayScore].every(score => Number.isInteger(score) && score >= 0)) {
        report('score', [homeScore, awayScore], '홈·원정 스코어를 둘 다 0 이상의 정수로 입력해야 합니다.');
      }
    }
    if (movedToWeek != null) {
      const target = byRoundAndId.get(`round${movedToWeek}:${fixtureId}`);
      if (!target || target.movedFromWeek !== Number(row.round.slice(5))) {
        report('moved-to', movedToWeek, `round${movedToWeek}에 같은 ID와 원래 주차를 가진 재편성 경기가 없습니다.`);
      }
    } else if (fixtureId) {
      if (active.has(fixtureId)) {
        const earlier = active.get(fixtureId);
        report('duplicate', earlier.round, `${earlier.round}와 진행 대상 경기 ID가 중복됩니다 (${fixtureId}).`);
      }
      active.set(fixtureId, row);
    }
    if (movedFromWeek != null) {
      const original = byRoundAndId.get(`round${movedFromWeek}:${fixtureId}`);
      if (!original || original.movedToWeek !== Number(row.round.slice(5))) {
        report('moved-from', movedFromWeek, `round${movedFromWeek}의 원래 일정과 연결이 맞지 않습니다.`);
      }
    }
  }
  return issues;
}

function changesBetween(previous, current) {
  const index = ({ rows }) => new Map(rows.filter(row => !row.movedToWeek).map(row =>
    [row.fixtureId || `${row.homeEn}|${row.awayEn}`, row]));
  const before = index(previous);
  const after = index(current);
  const changes = [];
  for (const [id, row] of after) {
    const old = before.get(id);
    if (!old) {
      changes.push(`${fixtureLabel(row)} · 경기 추가`);
      continue;
    }
    const fields = [
      ['주차', old.round, row.round],
      ['킥오프', [old.kickoffDate, old.kickoffTime].filter(Boolean).join(' '), [row.kickoffDate, row.kickoffTime].filter(Boolean).join(' ')],
      ['상태', old.postponed ? '연기' : '일정 반영', row.postponed ? '연기' : '일정 반영'],
      ['스코어', old.homeScore == null ? '' : `${old.homeScore}:${old.awayScore}`, row.homeScore == null ? '' : `${row.homeScore}:${row.awayScore}`]
    ];
    const edited = fields.filter(([, left, right]) => left !== right)
      .map(([label, left, right]) => `${label} ${left || '미정'} → ${right || '미정'}`);
    if (edited.length) changes.push(`${fixtureLabel(row)} · ${edited.join(' · ')}`);
  }
  for (const [id, row] of before) {
    if (!after.has(id)) changes.push(`${fixtureLabel(row)} · 경기 제거`);
  }
  return changes;
}

function formatList(title, items) {
  const safe = item => item.replace(/[@<>\r\n]/g, ' ').replace(/[\[\]]/g, '');
  const lines = items.slice(0, 30).map(item => '- ' + safe(item));
  if (items.length > 30) lines.push(`- 외 ${items.length - 30}건`);
  return [`## ${title}`, '', ...(lines.length ? lines : ['없음']), ''].join('\n');
}

const [base, outputFile] = process.argv.slice(2);
let errors = [];
let changes = [];
try {
  const current = readFixtures(readFileSync('data.js', 'utf8'));
  let previous = { teams: new Set(), rows: [] };
  if (base && !/^0+$/.test(base)) {
    const source = execFileSync('git', ['show', `${base}:data.js`], { encoding: 'utf8' });
    try { previous = readFixtures(source); } catch { /* 비교 기준이 깨져 있으면 현재 파일만 검증합니다. */ }
  }
  const oldIssues = validate(previous);
  errors = [...validate(current)].filter(([key]) => !oldIssues.has(key)).map(([, issue]) => issue);
  changes = changesBetween(previous, current);
} catch (error) {
  errors = [error.message];
}
const report = [formatList('새로 발견된 오류', errors), formatList('경기 변경 요약', changes)].join('\n');
if (outputFile) writeFileSync(outputFile, report);
console.log(report);
if (errors.length) process.exitCode = 1;
