// .github/scripts/check-match-day.js
// Hourly GitHub Actions run: find a Chizumulu kickoff 60–120 minutes away,
// then send the reminder at the one-hour mark.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUR_TEAM_EN = 'Chizumulu United FC';
const OUR_TEAM_KO = '치주물루 유나이티드 FC';
const RUN_INTERVAL_MINUTES = 60;

function loadScheduledRounds(dataJsPath) {
  const code = fs.readFileSync(dataJsPath, 'utf8');
  const sandbox = {
    console, window: {},
    document: { addEventListener() {}, getElementById() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'data.js' });
  vm.runInContext('this.__scheduledRounds = typeof scheduledRounds !== "undefined" ? scheduledRounds : {};', sandbox);
  return sandbox.__scheduledRounds;
}

// data.js kickoff times use Africa/Blantyre (UTC+2), with no daylight saving.
function kickoffToDate(date, time) {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 2, mi));
}

function findMatchForReminder(rounds) {
  const now = Date.now();
  const windowMs = RUN_INTERVAL_MINUTES * 60 * 1000;
  for (const roundKey of Object.keys(rounds)) {
    for (const match of rounds[roundKey] || []) {
      if (match.byeEn || (match.homeEn !== OUR_TEAM_EN && match.awayEn !== OUR_TEAM_EN)) continue;
      if (!match.kickoffDate || !match.kickoffTime || match.postponed) continue;
      const kickoff = kickoffToDate(match.kickoffDate, match.kickoffTime);
      const reminderAt = kickoff.getTime() - 60 * 60 * 1000;
      const diff = reminderAt - now;
      if (diff >= 0 && diff < windowMs) return { match, kickoff };
    }
  }
  return null;
}

async function sendReminder(match) {
  const isHome = match.homeEn === OUR_TEAM_EN;
  const opponentKo = isHome ? match.awayKo : match.homeKo;
  const opponentEn = isHome ? match.awayEn : match.homeEn;
  const venueKo = isHome ? '홈' : '원정';
  const url = 'https://onesignal.com/api/v1/notifications';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { ko: `${OUR_TEAM_KO} 경기 1시간 전`, en: 'Chizumulu kickoff in one hour' },
      contents: {
        ko: `${venueKo} 경기 상대는 ${opponentKo}입니다. 킥오프까지 1시간 남았어요 ⚽`,
        en: `Chizumulu vs ${opponentEn} kicks off in one hour.`,
      },
      url: 'https://chizumulu.github.io/UTD/',
    }),
  });
  if (!response.ok) throw new Error(`OneSignal API error ${response.status}: ${await response.text()}`);
  console.log('1시간 전 알림 발송:', opponentKo);
}

(async () => {
  const rounds = loadScheduledRounds(path.join(process.cwd(), 'data.js'));
  const found = findMatchForReminder(rounds);
  if (!found) {
    console.log('이번 실행 구간에는 1시간 전 알림 대상 경기가 없습니다.');
    return;
  }
  await sendReminder(found.match);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
