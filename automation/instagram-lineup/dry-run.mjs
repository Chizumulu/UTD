import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const accountId = '17841454923295450';
const username = 'chizumuluutd';
const sampleId = '18093005732262078';

async function request(url, options, label) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) });
  } catch {
    throw new Error(label + ' request failed');
  }
  if (!response.ok) throw new Error(label + ' returned HTTP ' + response.status);
  return response;
}

async function readCard() {
  const token = process.env.UTD_INSTAGRAM_TOKEN;
  if (!token) throw new Error('Set UTD_INSTAGRAM_TOKEN in Actions secrets');
  const url = new URL('https://graph.facebook.com/v27.0/' + accountId);
  url.searchParams.set('fields', 'business_discovery.username(' + username + '){username,media.limit(50){id,caption,media_type,media_url,permalink}}');
  const result = await request(url, { headers: { Authorization: 'Bearer ' + token } }, 'Meta API');
  const { business_discovery: profile } = await result.json();
  if (profile?.username !== username) throw new Error('Business Discovery did not return the official account');
  const post = profile.media?.data?.find(entry => entry.id === sampleId);
  if (!post || post.media_type !== 'IMAGE' || !post.media_url) throw new Error('The sample lineup image was not found in the recent feed');
  const imageUrl = new URL(post.media_url);
  if (imageUrl.protocol !== 'https:' || !imageUrl.hostname.endsWith('.cdninstagram.com')) throw new Error('Unexpected Instagram image host');
  const image = await request(imageUrl, { redirect: 'error' }, 'Instagram image');
  const mime = image.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Unexpected image format');
  const bytes = Buffer.from(await image.arrayBuffer());

  const reader = fileURLToPath(new URL('./read-card.py', import.meta.url));
  const output = execFileSync('/usr/bin/python3', [reader], { input: bytes, encoding: 'utf8' });
  return { post, card: JSON.parse(output) };
}

const nameKey = value => String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

export function resolveSlot(slot, squad) {
  const votes = Object.entries(slot.votes).map(([number, count]) => [Number(number), count])
    .sort((a, b) => b[1] - a[1]);
  const names = new Set(slot.names.map(nameKey).filter(Boolean));
  const named = [...new Set(squad.filter(player =>
    [player.nameKo, ...(player.aliasesKo ?? [])].some(name => names.has(nameKey(name)))
  ).map(player => player.number))];
  if (named.length > 1) return null;
  if (named.length === 1) {
    return !votes.length || votes.some(([number]) => number === named[0]) ? named[0] : null;
  }
  return votes[0] && votes[0][1] >= 2 && votes[0][1] > (votes[1]?.[1] ?? 0) &&
    squad.some(player => player.number === votes[0][0]) ? votes[0][0] : null;
}

export function compare(source, post, card) {
  const { roundsData, matchLineups, squadData } = runInNewContext(source + '\n;({ roundsData, matchLineups, squadData })', {}, { timeout: 1000 });
  const caption = post.caption ?? '';
  const date = /(\d{1,2})월\s*(\d{1,2})일/.exec(caption);
  const year = /(20\d{2})-\d{2}.*NRFA League One/i.exec(caption);
  const opponent = /🆚\uFE0F?\s*([^\r\n]+)/u.exec(caption);
  if (!/#STARTING_XI\b/i.test(caption) || !date || !year || !opponent) throw new Error('Caption lacks match identifiers');
  const kickoff = year[1] + '-' + date.slice(1).map(value => value.padStart(2, '0')).join('-');
  const opponentKey = nameKey(opponent[1]).replace('라이플라이', '라이플리');
  const rounds = Object.entries(roundsData).filter(([, fixtures]) => fixtures.some(fixture =>
    fixture.kickoffDate === kickoff &&
    [[fixture.homeEn, fixture.awayKo], [fixture.awayEn, fixture.homeKo]].some(([club, other]) =>
      club === 'Chizumulu United FC' && nameKey(other) === opponentKey)));
  if (rounds.length !== 1) throw new Error('Caption did not match exactly one UTD round');
  const [round] = rounds[0];
  const recorded = matchLineups[round];
  if (!recorded) throw new Error('The sample round has no saved lineup to compare');

  const readings = [...card.starters, ...card.bench];
  const players = readings.map(slot => ({ number: resolveSlot(slot, squadData) }));
  const diagnostics = readings.map((slot, i) => ({
    slot: i < card.starters.length ? 'starter ' + (i + 1) : 'bench ' + (i - card.starters.length + 1),
    ...slot,
    number: players[i].number
  }));
  console.log(JSON.stringify({ round, diagnostics }, null, 2));
  const unresolved = diagnostics.filter(slot => slot.number === null);
  if (unresolved.length) throw new Error('Unresolved OCR: ' + unresolved.map(slot => slot.slot).join(', '));
  if (card.starters.length !== 11 || new Set(players.map(player => player.number)).size !== players.length) {
    throw new Error('Expected 11 distinct starters and no repeated jersey numbers');
  }
  const lineup = players.map(player => {
    const entry = squadData.find(candidate => candidate.number === player.number);
    if (!entry) throw new Error('Unknown jersey number: ' + player.number);
    return entry;
  });

  const numbers = players => players.map(player => player.number);
  const starters = numbers(players.slice(0, card.starters.length));
  const bench = numbers(players.slice(card.starters.length));
  const same = (a, b) => [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
  if (!same(starters, numbers(recorded.starters)) || !same(bench, recorded.subsUnused ?? [])) {
    throw new Error('Detected lineup differs from the saved sample');
  }
  if (card.captain !== null && !starters.includes(card.captain)) throw new Error('Marked captain is outside the starting XI');
  const captain = card.captain ?? [15, 3, 22].find(number => starters.includes(number));
  return {
    round, kickoff, opponent: recorded.opponentKo, source: post.permalink,
    starters: lineup.slice(0, 11).map(({ number, nameKo }) => ({ number, nameKo })),
    bench: lineup.slice(11).map(({ number, nameKo }) => ({ number, nameKo })),
    captain: lineup.find(player => player.number === captain)?.nameKo ?? null,
    captainSource: captain == null ? null : card.captain === null ? 'inferred' : 'official',
    recognition: 'jersey and Korean name OCR checked against the UTD squad',
    changes: 0
  };
}

if (process.argv.includes('--live')) {
  try {
    const { post, card } = await readCard();
    const source = await readFile('data.js', 'utf8');
    console.log(JSON.stringify(compare(source, post, card), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
