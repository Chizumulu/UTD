// Read-only FA Cup matching. Pass the resolved faCup2627 object from getCups().
export function normalizeTeam(value) {
  const key = String(value ?? '').normalize('NFKD').toLowerCase()
    .replace(/[\u0300-\u036f]/g,'').replace(/['’]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\bfootball club\b|\bfc\b/g,'')
    .replace(/\butd\b/g,'united').replace(/\s+/g,' ').trim();
  return ({'mafu fc':'mafu stars','mafu':'mafu stars','mzwawa':'mzwazwa'})[key] ?? key;
}
const cupSignal = /\bpresidential[\s_-]*fa[\s_-]*cup\b/i;
const cupCode = /^(?:presidential_fa_cup|fam_presidential_fa_cup|fa_cup_presidential)$/i;
const leagueSignal = /#(?:cinrfaleagueone|nrfadivisionleague2)\b|\bnrfa\s+(?:division\s+)?league\s*(?:one|two|1|2)\b/i;
function eligible(item, m) {
  const s = item.structured;
  const codes = [s?.competition?.code,m.competitionCode].filter(Boolean);
  if (s?.competition?.conflict || codes.some(c=>!cupCode.test(c))) return false;
  const raw = item.latestObservation?.text ?? '';
  if (leagueSignal.test(raw)) return false;
  return codes.some(c=>cupCode.test(c)) || cupSignal.test(m.competition ?? '') || cupSignal.test(raw);
}
function roundKey(value) {
  const s = String(value ?? '').toLowerCase().replace(/[-–]/g,' ');
  if (/play\s*offs?/.test(s)) {
    if (/\b(?:1st|first|1)\b/.test(s)) return 'p1';
    if (/\b(?:2nd|second|2)\b/.test(s)) return 'p2';
  }
  if (/regional|region/.test(s)) {
    if (/\b(?:1st|first|1)\b/.test(s)) return 'r1';
    if (/\b(?:2nd|second|2)\b/.test(s)) return 'r2';
  }
  if (/round of 32/.test(s)) return '32';
  if (/round of 16/.test(s)) return '16';
  if (/quarter\s*final/.test(s)) return 'qf';
  if (/semi\s*final/.test(s)) return 'sf';
  if (/^final$/.test(s.trim())) return 'f';
  return null;
}
function regionKey(value) {
  const s=String(value??'').toLowerCase();
  const hits=[['north',/\b(?:nrfa|north(?:ern)?)\b/],['south',/\b(?:srfa|south(?:ern)?)\b/],['central',/\b(?:crfa|central)\b/],['east',/\b(?:erfa|east(?:ern)?)\b/]].filter(([,re])=>re.test(s));
  return hits.length===1?hits[0][0]:hits.length>1?'conflict':null;
}
function unresolved(m, side) {
  return !m[side] || /\bwinner\b|\btbd\b|\//i.test(m[side]);
}
export function matchCupItems(items, cup) {
  if (cup?.id !== 'faCup2627') throw new Error('Expected faCup2627');
  const fixtures = (cup.rounds ?? []).flatMap((r,ri)=>(r.matches??[]).map((m,mi)=>({
    m, ri, mi, key:m.id??('round:'+ri+':match:'+mi),
    round:roundKey(r.labelEn),
    // Current data labels unqualified regional rounds as northern.
    region:regionKey(m.region??r.region??r.labelEn)??(m.id?.startsWith('north-')||['p1','p2','r1','r2'].includes(roundKey(r.labelEn))?'north':null)
  })));
  const matched=[], skipped=[], seen=new Set();
  for (const item of items??[]) {
    const s=item.structured;
    if (!s?.matches?.length) { skipped.push({source:item.rawUpdateId,reason:'no_structured_matches'}); continue; }
    for (const m of s.matches) {
      const source=item.rawUpdateId, index=m.index;
      const skip=reason=>skipped.push({source,index,reason});
      if (!eligible(item,m)) { skip('not_fa_cup_or_conflict'); continue; }
      const h=normalizeTeam(m.homeTeam), a=normalizeTeam(m.awayTeam);
      if (!h||!a||h===a) { skip('missing_or_invalid_teams'); continue; }
      const rk=roundKey(m.roundText), region=regionKey([m.roundText,m.competitionGroupText,m.competition].join(' '));
      const candidates=fixtures.filter(f=>{
        if (unresolved(f.m,'home')||unresolved(f.m,'away')) return false;
        if (rk&&f.round!==rk) return false;
        if (region&&region!==f.region) return false;
        const x=normalizeTeam(f.m.home), y=normalizeTeam(f.m.away);
        return (x===h&&y===a)||(x===a&&y===h);
      });
      if (candidates.length!==1) { skip(candidates.length?'ambiguous_match':'no_confirmed_fixture'); continue; }
      const f=candidates[0], reversed=normalizeTeam(f.m.home)!==h;
      // Normalize score orientation to the existing bracket, not physical home/away.
      const scores=reversed?[m.awayScore,m.homeScore]:[m.homeScore,m.awayScore];
      const penalty=typeof m.pso==='string'&&m.pso.match(/^(\d+)\s*:\s*(\d+)$/);
      const pso=penalty?(reversed?[Number(penalty[2]),Number(penalty[1])]:[Number(penalty[1]),Number(penalty[2])]):m.pso??null;
      const signature=JSON.stringify([f.key,m.status,m.dateText,m.timeText,m.venue,...scores,pso,m.forfeit??null,m.resultType??null]);
      if(seen.has(signature)) { skip('duplicate'); continue; }
      seen.add(signature);
      matched.push({source,index,fixtureId:f.key,roundIndex:f.ri,matchIndex:f.mi,reversed,bracketScores:scores,match:m});
    }
  }
  return {matched,skipped};
}
