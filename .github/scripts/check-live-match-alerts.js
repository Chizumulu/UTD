// Poll structured match updates for new Chizumulu goals and full-time results.
const fs = require('fs');
const path = require('path');

const TEAM = 'Chizumulu United FC';
const API = 'https://api.chizumulu.net/v1/structured?limit=40';
const STATE_PATH = path.join(process.cwd(), '.match-alert-state.json');
const ONE_SIGNAL_URL = 'https://onesignal.com/api/v1/notifications';

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}
function stateRead() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')); }
  catch (_) { return { fixtures: {} }; }
}
function isOurMatch(match) {
  return normalize(match.homeTeam).includes('chizumulu') || normalize(match.awayTeam).includes('chizumulu');
}
function fixtureId(match) {
  const opponent = normalize(match.homeTeam).includes('chizumulu') ? match.awayTeam : match.homeTeam;
  return normalize(opponent);
}
function eventKey(event) {
  const players = (event.players || []).map(p => normalize(p && p.name)).filter(Boolean).join(',');
  return [event.minuteText || '', event.isHome ? 'home' : (event.isAway ? 'away' : ''), players].join('|');
}
function scoreText(match) {
  const score = match.score || {};
  const home = score.home == null ? '?' : score.home;
  const away = score.away == null ? '?' : score.away;
  return `${match.homeTeam} ${home}–${away} ${match.awayTeam}`;
}
async function notify(titleKo, bodyKo, titleEn, bodyEn) {
  const response = await fetch(ONE_SIGNAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { ko: titleKo, en: titleEn },
      contents: { ko: bodyKo, en: bodyEn },
      url: 'https://chizumulu.github.io/UTD/',
    }),
  });
  if (!response.ok) throw new Error(`OneSignal API error ${response.status}: ${await response.text()}`);
}
async function main() {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_API_KEY) {
    throw new Error('ONESIGNAL_APP_ID and ONESIGNAL_API_KEY secrets are required.');
  }
  const response = await fetch(API);
  if (!response.ok) throw new Error(`Match API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const state = stateRead();
  const now = Date.now();
  let notifications = 0;
  for (const item of data.items || []) {
    const sourceTime = Date.parse(item.sourceTimestamp || '');
    const recent = Number.isFinite(sourceTime) && now - sourceTime <= 10 * 60 * 1000;
    for (const match of (item.structured && item.structured.matches) || []) {
      if (!isOurMatch(match)) continue;
      const id = fixtureId(match);
      if (!id) continue;
      const prior = state.fixtures[id];
      const goalKeys = new Set(prior ? prior.goalKeys || [] : []);
      const goals = (match.events || []).filter(event => String(event.type || '').toLowerCase() === 'goal');
      for (const goal of goals) {
        const key = eventKey(goal);
        if (goalKeys.has(key)) continue;
        goalKeys.add(key);
        // On first observation, only announce a goal reported in the last 10 minutes.
        if (recent) {
          const scorer = (goal.players || []).find(p => /scorer/i.test(String(p.role || '')));
          const minute = goal.minuteText ? `${goal.minuteText} ` : '';
          const name = scorer && scorer.name ? `${scorer.name} ` : '';
          const score = scoreText(match);
          await notify(
            '치주물루 골!', `⚽ ${minute}${name}득점! ${score}`,
            'Chizumulu goal!', `⚽ ${minute}${name}scored. ${score}`
          );
          notifications++;
        }
      }
      const fullTime = String(match.status || '').toLowerCase() === 'full_time';
      const fullTimeSent = prior ? !!prior.fullTimeSent : false;
      if (fullTime && !fullTimeSent && recent) {
        await notify('경기 종료', `치주물루 경기가 끝났습니다. ${scoreText(match)}`,
          'Full time', `Chizumulu match finished. ${scoreText(match)}`);
        notifications++;
      }
      state.fixtures[id] = {
        goalKeys: Array.from(goalKeys).slice(-100),
        fullTimeSent: fullTimeSent || fullTime,
        updatedAt: now,
      };
    }
  }
  for (const [id, fixture] of Object.entries(state.fixtures)) {
    if (now - (fixture.updatedAt || 0) > 48 * 60 * 60 * 1000) delete state.fixtures[id];
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
  console.log(`Live alert check complete; sent ${notifications} notification(s).`);
}
main().catch(error => { console.error(error); process.exit(1); });
