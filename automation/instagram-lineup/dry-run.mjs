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
  const sample = process.argv.includes('--chilumba') ? 'chilumba' :
    process.argv.includes('--chintheche') ? 'chintheche' :
    process.argv.includes('--luviri') ? 'luviri' :
    process.argv.includes('--chihame') ? 'chihame' : 'raiply';
  const dynamic = process.argv.includes('--dynamic');
  const latest = process.argv.includes('--unseen');
  const matches = entry => {
    const caption = entry.caption ?? '';
    if (latest) return entry.media_type === 'IMAGE' && /#STARTING_XI\b/i.test(caption) &&
      !(/(?:라이플리|라이플라이)/.test(caption) && /11월\s*22일/.test(caption)) &&
      !(/치하메/.test(caption) && /11월\s*0?8일/.test(caption)) &&
      !(/루비리/.test(caption) && /10월\s*20일/.test(caption)) &&
      !(/친테체/.test(caption) && /10월\s*11일/.test(caption)) &&
      !(/칠룸바/.test(caption) && /10월\s*0?2일/.test(caption));
    if (sample === 'raiply') return entry.id === sampleId;
    if (!/#STARTING_XI\b/i.test(caption)) return false;
    if (sample === 'chilumba') return /칠룸바/.test(caption) && /10월\s*0?2일/.test(caption);
    if (sample === 'chintheche') return /친테체/.test(caption) && /10월\s*11일/.test(caption);
    return sample === 'luviri' ? /루비리/.test(caption) && /10월\s*20일/.test(caption) :
      /치하메/.test(caption) && /11월\s*0?8일/.test(caption);
  };
  let post;
  let cursor;
  for (let page = 0; page < 5 && !post; page += 1) {
    const after = cursor ? '.after(' + cursor + ')' : '';
    url.searchParams.set('fields', 'business_discovery.username(' + username + '){username,media.limit(50)' + after + '{id,caption,media_type,media_url,permalink}}');
    const result = await request(url, { headers: { Authorization: 'Bearer ' + token } }, 'Meta API');
    const { business_discovery: profile } = await result.json();
    if (profile?.username !== username) throw new Error('Business Discovery did not return the official account');
    post = profile.media?.data?.find(matches);
    cursor = profile.media?.paging?.next && profile.media?.paging?.cursors?.after;
    if (!cursor) break;
  }
  if (!post || post.media_type !== 'IMAGE' || !post.media_url) throw new Error('The sample lineup image was not found in the recent feed');
  const imageUrl = new URL(post.media_url);
  if (imageUrl.protocol !== 'https:' || !imageUrl.hostname.endsWith('.cdninstagram.com')) throw new Error('Unexpected Instagram image host');
  const image = await request(imageUrl, { redirect: 'error' }, 'Instagram image');
  const mime = image.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Unexpected image format');
  const bytes = Buffer.from(await image.arrayBuffer());

  const reader = fileURLToPath(new URL(dynamic ? './locate-card-text.py' : './read-card.py', import.meta.url));
  const output = execFileSync('/usr/bin/python3', [reader, sample], { input: bytes, encoding: 'utf8' });
  return { post, card: JSON.parse(output) };
}

const nameKey = value => String(value ?? '').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

function oneEditApart(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  if (a.length > b.length) [a, b] = [b, a];
  let index = 0;
  while (index < a.length && a[index] === b[index]) index += 1;
  return a.slice(index + (a.length === b.length ? 1 : 0)) === b.slice(index + 1);
}

export function resolveSlot(slot, squad) {
  const votes = Object.entries(slot.votes).map(([number, count]) => [Number(number), count])
    .sort((a, b) => b[1] - a[1]);
  const names = [...new Set(slot.names.map(nameKey).filter(Boolean))];
  const rosterNumbers = predicate => [...new Set(squad.filter(player =>
    [player.nameKo, ...(player.aliasesKo ?? [])].some(name => names.some(read => predicate(read, nameKey(name))))
  ).map(player => player.number))];
  const exact = rosterNumbers((read, name) => read === name);
  const fuzzy = exact.length ? [] : rosterNumbers((read, name) =>
    read.length >= 4 && name.length >= 4 && oneEditApart(read, name));
  const candidates = exact.length ? exact : fuzzy;
  if (candidates.length > 1) return { number: null, method: 'ambiguous-name' };
  if (candidates.length === 1) {
    const [number] = candidates;
    if (votes.some(([read]) => read === number)) {
      return { number, method: exact.length ? 'name-and-number' : 'near-name-and-number' };
    }
    if (!votes.length) {
      return { number, method: exact.length ? 'exact-name-only' : 'near-name-only' };
    }
    if (exact.length && String(number).length === 2 &&
        votes.some(([read]) => oneEditApart(String(read), String(number)))) {
      return { number, method: 'exact-name-digit-correction' };
    }
    if (!exact.length && String(number).length === 2 &&
        votes.some(([read]) => String(read).length === 1 && String(number).includes(String(read))) &&
        votes.every(([, count]) => count === 1)) {
      return { number, method: 'near-name-partial-number' };
    }
    // A unique exact name can be compared with the reference in this dry run.
    if (exact.length) return { number, method: 'exact-name-number-conflict' };
    return { number: null, method: 'name-number-conflict' };
  }
  if (votes[0] && votes[0][1] >= 2 && votes[0][1] > (votes[1]?.[1] ?? 0) &&
      squad.some(player => player.number === votes[0][0])) {
    return { number: votes[0][0], method: 'number-only' };
  }
  return { number: null, method: 'ambiguous-number' };
}

export function classifyDynamic(card, squad) {
  const toHangul = value => String(value).replace(/[^가-힣]/g, '');
  const roster = squad.flatMap(player => [player.nameKo, ...(player.aliasesKo ?? [])]
    .map(name => ({ number: player.number, key: toHangul(name), name }))
    .filter(entry => entry.key.length >= 4));
  function candidates(text, allowClipped = false) {
    const haystack = toHangul(text);
    // The letters may be split across several OCR words on a card.
    const exact = roster.filter(player => haystack.includes(player.key));
    const near = exact.length ? exact : roster.filter(player => oneEditApart(haystack, player.key));
    // Allow one clipped edge syllable plus one OCR error for a long, unique name.
    const matches = near.length || !allowClipped || haystack.length < 5 ? near :
      roster.filter(player => player.key.length === haystack.length + 1 &&
        [player.key.slice(1), player.key.slice(0, -1)].some(edge => oneEditApart(haystack, edge)));
    const numbers = [...new Set(matches.map(player => player.number))];
    return numbers.length === 1 ? matches[0] : null;
  }
  const starters = new Map();
  for (const line of card.starterText) {
    const player = candidates(line, true);
    if (player) starters.set(player.number, { votes: {}, names: [player.name] });
  }
  const bench = new Map();
  for (const block of card.benchText) {
    for (const match of block.matchAll(/(?<![0-9])([1-9][0-9]?)\s*[.,:]\s*([^\n0-9]+)/g)) {
      const player = candidates(match[2]);
      if (!player || player.number !== Number(match[1])) continue;
      bench.set(player.number, { votes: { [player.number]: 2 }, names: [player.name] });
    }
  }
  console.log(JSON.stringify({
    dynamicOcr: card, starterNumbers: [...starters.keys()], benchNumbers: [...bench.keys()]
  }, null, 2));
  if (!bench.size || [...bench.keys()].some(number => starters.has(number))) {
    throw new Error('Could not separate starters and bench without overlap');
  }
  return { starters: [...starters.values()], bench: [...bench.values()], captain: null };
}

export function compare(source, post, card) {
  const { roundsData, matchLineups, squadData } = runInNewContext(source + '\n;({ roundsData, matchLineups, squadData })', {}, { timeout: 1000 });
  if (card.starterText) card = classifyDynamic(card, squadData);
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
  const players = readings.map(slot => resolveSlot(slot, squadData));
  const diagnostics = readings.map((slot, i) => ({
    slot: i < card.starters.length ? 'starter ' + (i + 1) : 'bench ' + (i - card.starters.length + 1),
    ...slot,
    ...players[i]
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
  if (!same(starters, numbers(recorded.starters)) || !same(bench, [...(recorded.subsUnused ?? []), ...numbers(recorded.subsIn ?? [])])) {
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
