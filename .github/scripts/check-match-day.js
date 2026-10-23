// .github/scripts/check-match-day.js
// 5분마다 실행되어, "치주물루 유나이티드 FC"의 킥오프가 앞으로 1시간 이내로 다가왔는지
// data.js에서 직접 확인하고, 아직 알리지 않은 경기라면 OneSignal로 킥오프 1시간 전 푸시를 보냅니다.
//
// - 대기(sleep) 없이 즉시 발송하므로 Actions 타임아웃 위험이 없습니다.
// - "킥오프까지 60분 이내 & 아직 미발송"이면 발송하는 방식이라, GitHub cron이 지연되거나
//   몇 번 건너뛰어도 킥오프 전까지만 한 번은 알림이 나갑니다(놓치지 않음).
// - 발송 기록(.kickoff-reminder-state.json)을 남겨 같은 경기에 두 번 보내지 않습니다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUR_TEAM_EN = 'Chizumulu United FC';
const OUR_TEAM_KO = '치주물루 유나이티드 FC';

// 킥오프 몇 분 전부터 알림 대상이 되는지
const REMINDER_LEAD_MINUTES = 60;

// data.js의 kickoffDate/kickoffTime은 말라위 표준시(CAT, UTC+2, 서머타임 없음) 기준입니다.
// (앱의 formatKickoff()도 CAT → KST를 +7시간으로 표시합니다.)
const KICKOFF_UTC_OFFSET_HOURS = 2;

const STATE_PATH = path.join(process.cwd(), '.kickoff-reminder-state.json');
const STATE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_SIGNAL_URL = 'https://onesignal.com/api/v1/notifications';

// 테스트용: NOW_MS(현재시각 ms)로 시각을 고정하고, DRY_RUN=1이면 실제로 발송하지 않습니다.
function nowMs() {
  const override = Number(process.env.NOW_MS);
  return Number.isFinite(override) && override > 0 ? override : Date.now();
}

// data.js는 브라우저용 스크립트라 module.exports가 없으므로,
// vm 샌드박스에서 그대로 실행한 뒤 scheduledRounds만 꺼내옵니다.
function loadScheduledRounds(dataJsPath) {
  const code = fs.readFileSync(dataJsPath, 'utf8');
  const sandbox = {
    console,
    window: {},
    document: { addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'data.js' });
  vm.runInContext(
    'this.__scheduledRounds = typeof scheduledRounds !== "undefined" ? scheduledRounds : {};',
    sandbox
  );
  return sandbox.__scheduledRounds;
}

// kickoffDate/kickoffTime(CAT)을 실제 UTC 시각(Date 객체)으로 변환합니다.
function kickoffToDate(kickoffDate, kickoffTime) {
  const [y, mo, d] = kickoffDate.split('-').map(Number);
  const [h, mi] = kickoffTime.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - KICKOFF_UTC_OFFSET_HOURS, mi, 0));
}

function stateRead() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return { sent: (parsed && parsed.sent) || {} };
  } catch (_) {
    return { sent: {} };
  }
}

function stateWrite(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

// 같은 경기의 중복 발송 방지 키. 킥오프 일시가 바뀌면(일정 변경) 새 경기로 보고 다시 알립니다.
function reminderKey(m) {
  const opponentEn = m.homeEn === OUR_TEAM_EN ? m.awayEn : m.homeEn;
  return `${m.kickoffDate}|${m.kickoffTime}|${opponentEn}`;
}

// 아직 열리지 않았고, 킥오프가 (0, REMINDER_LEAD_MINUTES] 분 안에 있는 치주물루 경기를 모두 찾습니다.
function findDueMatches(scheduledRounds, state, now) {
  const leadMs = REMINDER_LEAD_MINUTES * 60 * 1000;
  const due = [];
  const seen = new Set();
  for (const roundKey of Object.keys(scheduledRounds)) {
    for (const m of scheduledRounds[roundKey]) {
      if (m.byeEn) continue; // 부전승 라운드
      if (m.homeEn !== OUR_TEAM_EN && m.awayEn !== OUR_TEAM_EN) continue;
      if (!m.kickoffDate || !m.kickoffTime) continue;
      if (m.postponed || m.forfeit) continue; // 연기/몰수 경기
      if (typeof m.homeScore === 'number' || typeof m.awayScore === 'number') continue; // 이미 끝난 경기

      const kickoff = kickoffToDate(m.kickoffDate, m.kickoffTime);
      const diff = kickoff.getTime() - now;
      if (!(diff > 0 && diff <= leadMs)) continue;

      const key = reminderKey(m);
      if (seen.has(key) || state.sent[key]) continue;
      seen.add(key);
      due.push({ match: m, kickoff, key, diffMs: diff });
    }
  }
  return due;
}

async function sendOneSignalNotification(match, diffMs) {
  const isHome = match.homeEn === OUR_TEAM_EN;
  const opponentKo = isHome ? match.awayKo : match.homeKo;
  const opponentEn = isHome ? match.awayEn : match.homeEn;
  const venueKo = isHome ? '홈' : '원정';
  const venueEn = isHome ? 'home' : 'away';

  const minutes = Math.max(1, Math.round(diffMs / 60000));
  const whenKo = minutes >= 50 ? '1시간 뒤' : `약 ${minutes}분 뒤`;
  const whenEn = minutes >= 50 ? 'in 1 hour' : `in about ${minutes} min`;

  const contentsKo = `${whenKo} 킥오프! ${venueKo} vs ${opponentKo} 경기가 곧 시작해요 ⚽`;
  const contentsEn = `Kickoff ${whenEn}: ${venueEn} vs ${opponentEn} ⚽`;

  if (process.env.DRY_RUN === '1') {
    console.log('[DRY_RUN] 발송 예정:', contentsKo, '|', contentsEn);
    return;
  }

  const res = await fetch(ONE_SIGNAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { ko: `${OUR_TEAM_KO} 킥오프 예정`, en: 'Kickoff soon' },
      contents: { ko: contentsKo, en: contentsEn },
      url: 'https://chizumulu.github.io/UTD/',
      // 기기가 오프라인이어도 킥오프 이후에 뒤늦게 "곧 시작" 알림이 뜨지 않도록 만료시간을 둡니다.
      ttl: Math.max(60, Math.min(Math.round(diffMs / 1000), REMINDER_LEAD_MINUTES * 60)),
    }),
  });

  if (!res.ok) {
    throw new Error(`OneSignal API error ${res.status}: ${await res.text()}`);
  }
  console.log('알림 발송 완료:', contentsKo);
}

(async () => {
  const dryRun = process.env.DRY_RUN === '1';
  if (!dryRun && (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_API_KEY)) {
    throw new Error('ONESIGNAL_APP_ID and ONESIGNAL_API_KEY secrets are required.');
  }

  const now = nowMs();
  const scheduledRounds = loadScheduledRounds(path.join(process.cwd(), 'data.js')); // 리포지토리 루트 기준
  const state = stateRead();

  // 오래된 발송 기록 정리
  for (const [key, sentAt] of Object.entries(state.sent)) {
    if (now - sentAt > STATE_RETENTION_MS) delete state.sent[key];
  }

  const due = findDueMatches(scheduledRounds, state, now);
  if (due.length === 0) {
    console.log('지금 알릴 치주물루 킥오프(1시간 이내, 미발송)가 없습니다.');
  }

  let failure = null;
  for (const item of due) {
    try {
      await sendOneSignalNotification(item.match, item.diffMs);
      if (!dryRun) state.sent[item.key] = now; // 발송 성공한 경기만 기록
    } catch (err) {
      console.error(err);
      failure = err; // 실패한 경기는 기록하지 않아 다음 실행(5분 뒤)에서 재시도
    }
  }

  // 오류가 있어도 이미 보낸 경기는 기록되도록 상태는 항상 저장합니다.
  if (!dryRun) stateWrite(state);
  if (failure) process.exit(1);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
