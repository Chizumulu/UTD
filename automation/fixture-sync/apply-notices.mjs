import fs from 'node:fs';
import { parse } from 'acorn';

const aliases = new Map([['vision academy', 'vision s academy'], ['mafu', 'mafu stars']]);
function team(name) {
  const key = String(name ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/ fc$/, '');
  return aliases.get(key) ?? key;
}
const pair = (home, away) => JSON.stringify([team(home), team(away)]);
const fixtureSubject = /^(.*?)\s+vs\.?\s+(.*?)(?:\s+fixture)?$/i;
function date(value) {
  const match = /^(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(20\d{2})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, weekday, day, month, year] = match;
  const monthIndex = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].indexOf(month.toLowerCase());
  if (monthIndex < 0) return null;
  const parsed = new Date(Date.UTC(Number(year), monthIndex, Number(day)));
  if (parsed.getUTCDate() !== Number(day)) return null;
  if (weekday && parsed.toLocaleDateString('en', { weekday: 'long', timeZone: 'UTC' }).toLowerCase() !== weekday.toLowerCase()) return null;
  return parsed.toISOString().slice(0, 10);
}

export function updateFixtures(source, items, now = Date.now()) {
  const today = new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tree = parse(source, { ecmaVersion: 'latest' });
  const rounds = tree.body.flatMap(node => node.declarations ?? []).find(node => node.id.name === 'scheduledRounds')?.init;
  if (rounds?.type !== 'ObjectExpression') throw new Error('Cannot locate scheduledRounds');
  const fixtures = new Map();
  for (const round of rounds.properties) {
    if (round.value?.type !== 'ArrayExpression') continue;
    for (const entry of round.value.elements) {
      if (entry?.type !== 'ObjectExpression') continue;
      const values = new Map(entry.properties.map(property => [property.key?.name ?? property.key?.value, property.value]));
      const key = pair(values.get('homeEn')?.value, values.get('awayEn')?.value);
      const candidates = fixtures.get(key) ?? [];
      candidates.push(values.get('kickoffDate'));
      fixtures.set(key, candidates);
    }
  }

  const latest = new Map();
  for (const item of items) {
    const published = Date.parse(item.sourceTimestamp);
    const { structured, latestObservation } = item;
    const original = latestObservation?.text ?? '';
    if (!Number.isFinite(published) || published > now || now - published > 48 * 60 * 60 * 1000 ||
        structured?.competition?.code !== 'nrfa_league_one' || structured.competition.conflict ||
        !/fixture\s+(?:re\s*[-–]?\s*schedul\w*|change)/i.test(original)) continue;

    for (const fact of structured.facts ?? []) {
      if (fact.type !== 'notice' || fact.data?.notice_type !== 'schedule_change') continue;
      const subject = fixtureSubject.exec(String(fact.data.subject ?? '').trim());
      if (!subject) continue;
      const key = pair(subject[1], subject[2]);
      const matches = (structured.matches ?? []).filter(match => pair(match.homeTeam, match.awayTeam) === key);
      const next = date(fact.data.new_value);
      const previous = fact.data.old_value ? date(fact.data.old_value) : null;
      const match = matches[0];
      const valid = matches.length === 1 && ['scheduled', 'postponed'].includes(match.status) &&
        (!match.competitionCode || match.competitionCode === 'nrfa_league_one') &&
        next && date(match.dateText) === next && (!fact.data.old_value || previous);
      const existing = latest.get(key);
      if (!existing || published > existing.published) {
        latest.set(key, { published, next, previous, valid });
      } else if (published === existing.published && (!valid || existing.next !== next || existing.previous !== previous)) {
        existing.valid = false;
      }
    }
  }

  const edits = [];
  for (const [key, change] of latest) {
    const candidates = fixtures.get(key);
    const current = candidates?.[0];
    if (!change.valid || candidates?.length !== 1 || current?.type !== 'Literal' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(current.value) || change.next < today ||
        current.value === change.next ||
        (change.previous ? current.value !== change.previous : current.value < today)) continue;
    const quote = source[current.start];
    edits.push({ start: current.start, end: current.end, value: quote + change.next + quote });
    console.log('Schedule change: %s %s to %s', key, current.value, change.next);
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  }
  return source;
}

if (process.argv[2]) {
  const source = fs.readFileSync('data.js', 'utf8');
  const { items } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  if (!Array.isArray(items)) throw new Error('Unexpected fixture API response');
  const updated = updateFixtures(source, items);
  if (updated !== source) fs.writeFileSync('data.js', updated);
}
