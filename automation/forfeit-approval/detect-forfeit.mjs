// A score without named scorers is a candidate, never a confirmed forfeit.
export function detectForfeit(match, text = '') {
  const status = String(match?.status ?? '').toLowerCase();
  if (!['full_time','finished','ended','forfeit','walkover','awarded'].includes(status)) return null;
  const a = Number(match.homeScore), b = Number(match.awayScore);
  if (!((a === 3 && b === 0) || (a === 0 && b === 3))) return null;
  if (match.pso) return null;
  const events = Array.isArray(match.events) ? match.events : [];
  const evidence = events.some(e => /goal|scor|penalty/i.test(String(e.type ?? '')) ||
    (e.players ?? []).some(p => /scorer|goalscorer/i.test(String(p.role ?? ''))));
  const listed = [match.scorersHome, match.scorersAway, match.homeScorers, match.awayScorers, match.scorers, match.goals]
    .some(v => Array.isArray(v) ? v.length > 0 : typeof v === 'string' && !/^(?:\s*|없음|none|n\/a|-)$/i.test(v));
  if (evidence || listed) return null;
  const explicit = match.forfeit === true || /forfeit|walk[ _-]?over|awarded|failed to show up|몰수[승패]?/i.test(status+' '+String(match.resultType ?? '')+' '+text);
  return { homeScore:a, awayScore:b, winnerSide:a>b?'home':'away', explicit, needsReview:true, reason:explicit?'official_forfeit_signal':'three_goal_result_without_scorers' };
}
