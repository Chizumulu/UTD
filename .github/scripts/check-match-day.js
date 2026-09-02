// .github/scripts/check-match-day.js
// 1시간마다 실행되어, 앞으로 1시간 안에 "치주물루 유나이티드 FC"의 킥오프가 있는지
// data.js에서 직접 확인합니다. 있으면 정확히 킥오프 시각까지 대기(sleep)한 뒤
// 그 순간 OneSignal로 푸시 알림을 보냅니다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const OUR_TEAM_EN = 'Chizumulu United FC';
const OUR_TEAM_KO = '치주물루 유나이티드 FC';

// 이 스크립트를 실행하는 워크플로우의 cron 간격(분)과 반드시 동일하게 맞춰주세요.
// (간격보다 넓게 잡으면 같은 경기에 알림이 두 번 나갈 수 있습니다.)
const RUN_INTERVAL_MINUTES = 60;

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

// data.js의 kickoffDate/kickoffTime은 한국시간(KST, UTC+9, 서머타임 없음) 기준이라고 가정하고
// 실제 UTC 시각(Date 객체)으로 변환합니다.
function kickoffToDate(kickoffDate, kickoffTime) {
  const [y, mo, d] = kickoffDate.split('-').map(Number);
  const [h, mi] = kickoffTime.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0));
}

// "지금부터 RUN_INTERVAL_MINUTES분 안에 킥오프하는" 치주물루 경기를 찾습니다.
// 창(window)이 실행 간격과 같기 때문에, 매 실행마다 오직 하나의 실행만 각 경기를 담당하게 됩니다.
function findUpcomingMatchInWindow(scheduledRounds) {
  const now = Date.now();
  const windowMs = RUN_INTERVAL_MINUTES * 60 * 1000;
  for (const roundKey of Object.keys(scheduledRounds)) {
    for (const m of scheduledRounds[roundKey]) {
      if (m.byeEn) continue; // 부전승 라운드는 건너뜀
      if (m.homeEn !== OUR_TEAM_EN && m.awayEn !== OUR_TEAM_EN) continue;
      if (!m.kickoffDate || !m.kickoffTime) continue;

      const kickoff = kickoffToDate(m.kickoffDate, m.kickoffTime);
      const diff = kickoff.getTime() - now;
      if (diff >= 0 && diff < windowMs) return { match: m, kickoff };
    }
  }
  return null;
}

function sleepUntil(date) {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendOneSignalNotification(match) {
  const isHome = match.homeEn === OUR_TEAM_EN;
  const opponentKo = isHome ? match.awayKo : match.homeKo;
  const venue = isHome ? '홈' : '원정';
  const contentsKo = `킥오프! ${venue} vs ${opponentKo} 경기가 지금 시작했어요 ⚽`;

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { ko: `${OUR_TEAM_KO} 경기 시작!`, en: 'Kickoff!' },
      contents: { ko: contentsKo, en: `Match kicked off just now vs ${isHome ? match.awayKo : match.homeKo}` },
      url: 'https://chizumulu.github.io/UTD/',
    }),
  });

  if (!res.ok) {
    throw new Error(`OneSignal API error ${res.status}: ${await res.text()}`);
  }
  console.log('알림 발송 완료:', contentsKo);
}

(async () => {
  const dataJsPath = path.join(process.cwd(), 'data.js'); // 리포지토리 루트 기준
  const scheduledRounds = loadScheduledRounds(dataJsPath);
  const found = findUpcomingMatchInWindow(scheduledRounds);

  if (!found) {
    console.log('이번 실행 구간 안에는 예정된 치주물루 킥오프가 없습니다.');
    return;
  }

  const waitMin = Math.round((found.kickoff.getTime() - Date.now()) / 60000);
  console.log(`${found.match.kickoffDate} ${found.match.kickoffTime} 킥오프까지 약 ${waitMin}분 대기합니다...`);
  await sleepUntil(found.kickoff);
  await sendOneSignalNotification(found.match);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
