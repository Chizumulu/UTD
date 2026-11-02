// ============================================================================
// 리포트 문장 생성 모듈 (report.js)
// ----------------------------------------------------------------------------
// 주차별 결과 리포트 / 다음 주차 예측 리포트의 "문장을 만드는" 로직 모음입니다.
//   - 문장 뱅크(RESULT_SENTENCES, MILESTONE_SENTENCES 등) · 문단 빌더 · 한국어 조사 보조
//   - 화면에 그리는 render* 함수(renderRoundResultReport 등)는 app.js 에 남아 있습니다.
// 일반(classic) 스크립트라 여기의 함수는 전역으로 선언되고, app.js/data.js 의 전역 값
// (isKorean, wkKo, getRankedTeams, leagueData, REPORT_TEAM_EN/KO 등)은
// "함수가 호출되는 시점"에 참조합니다. 그래서 로드 시점에는 app.js 보다 먼저여도 안전합니다.
// 로드 순서: data.js → poster.js → report.js → app.js → lang-ny.js
// 주의: 영어 문장은 lang-ny.js(치체와어) 의 정규식 규칙이 그대로 매칭하므로, 기존 영어 문구는 바꾸지 마세요.
// ============================================================================

// ===== 주차별 결과 리포트 (AI 자동 생성 리포트) =====
// 진짜 LLM을 호출하지 않고, 이미 계산돼 있는 데이터
// (buildRoundMatches / computeFormGuide / computeStandingsHistory)를
// 문장 뱅크에서 골라 조립하는 "템플릿 조합형" 방식입니다.
// 같은 라운드는 새로고침해도 항상 같은 문장 조합이 나오도록
// 라운드+용도를 시드로 쓰는 간단한 PRNG(mulberry32)를 사용합니다.
// ===================================================================
const REPORT_MIN_MATCHES = 6; // 7경기 중 6경기 이상 스코어가 채워지면 리포트 생성

function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ===== 한국어 기사체용 보조 함수 (조사 자동 선택, 팀명 약칭) =====
// 받침 유무에 따라 을/를, 은/는, 이/가, 와/과를 붙여 "치바비가", "칠룸바 배럭스를"처럼 자연스럽게 씁니다.
function koTrimFC(n) { return String(n || '').replace(/\s*FC$/i, '').trim(); }
function koShort(n) { return koTrimFC(n).split(' ')[0]; }
function koHasBatchim(str) {
  const s0 = String(str || '').trim();
  if (!s0) return false;
  const c = s0.charCodeAt(s0.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) !== 0;
  return false;
}

function koShort(n) { return koTrimFC(n).split(' ')[0]; }
function koHasBatchim(str) {
  const s0 = String(str || '').trim();
  if (!s0) return false;
  const c = s0.charCodeAt(s0.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) !== 0;
  return false;
}

function koHasBatchim(str) {
  const s0 = String(str || '').trim();
  if (!s0) return false;
  const c = s0.charCodeAt(s0.length - 1);
  if (c >= 0xAC00 && c <= 0xD7A3) return ((c - 0xAC00) % 28) !== 0;
  return false;
}

function koWithJosa(n, withB, noB) { const t = koTrimFC(n); return t + (koHasBatchim(t) ? withB : noB); }
function koEulReul(n) { return koWithJosa(n, '을', '를'); }
function koEunNeun(n) { return koWithJosa(n, '은', '는'); }
function koIGa(n) { return koWithJosa(n, '이', '가'); }
function koWaGwa(n) { return koWithJosa(n, '과', '와'); }
// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

function koEulReul(n) { return koWithJosa(n, '을', '를'); }
function koEunNeun(n) { return koWithJosa(n, '은', '는'); }
function koIGa(n) { return koWithJosa(n, '이', '가'); }
function koWaGwa(n) { return koWithJosa(n, '과', '와'); }
// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

function koEunNeun(n) { return koWithJosa(n, '은', '는'); }
function koIGa(n) { return koWithJosa(n, '이', '가'); }
function koWaGwa(n) { return koWithJosa(n, '과', '와'); }
// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

function koIGa(n) { return koWithJosa(n, '이', '가'); }
function koWaGwa(n) { return koWithJosa(n, '과', '와'); }
// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

function koWaGwa(n) { return koWithJosa(n, '과', '와'); }
// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

// 시즌 기록(승/무/패, 득실) 집계: list = computeFormGuide().sequence 일부
function tallyRecord(list) {
  const r = { n: list.length, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  list.forEach(m => {
    if (m.result === 'W') r.w++; else if (m.result === 'D') r.d++; else r.l++;
    r.gf += m.myGoals; r.ga += m.oppGoals;
  });
  return r;
}

// pairs: [[ko, en], [ko, en], ...] 중 시드 기반으로 하나를 고릅니다.
function pickSentence(rng, pairs) {
  if (!pairs || !pairs.length) return { ko: '', en: '' };
  const idx = Math.floor(rng() * pairs.length);
  return { ko: pairs[idx][0], en: pairs[idx][1] };
}

function countPlayedMatchesInRound(roundKey) {
  return buildRoundMatches(roundKey).filter(m =>
    !m.isBye && typeof m.homeScore === 'number' && typeof m.awayScore === 'number'
  ).length;
}

function isReportReadyRound(roundKey) {
  const matches = buildRoundMatches(roundKey);
  // 부전승 주간은 우리 팀 경기가 없으므로, 다른 경기가 충분히(6경기 이상) 끝난 뒤에 만듭니다.
  const myBye = matches.find(m => m.isBye && isMyTeamName(m.teamEn, m.teamKo));
  if (myBye) return countPlayedMatchesInRound(roundKey) >= REPORT_MIN_MATCHES;
  // 그 외에는 우리 팀(치주물루) 경기에 스코어가 있으면 리포트를 만듭니다.
  // 연기됐던 경기가 다른 주차에서 먼저 치러지는 경우처럼, 라운드 전체가 6경기 미만으로만
  // 끝나 있어도 우리 경기 결과는 바로 보여줘야 하기 때문입니다.
  // (순위 스냅샷은 computeStandingsHistory가 부분 라운드도 이미 반영합니다.)
  const myMatch = findMyRoundMatch(matches);
  return !!(myMatch && typeof myMatch.homeScore === 'number' && typeof myMatch.awayScore === 'number');
}

// 리포트를 만들 수 있는(=6경기 이상 채워진) 라운드 중 가장 최신 라운드
function latestReportReadyRoundKey() {
  const keys = allRoundKeysIncludingScheduled();
  for (let i = keys.length - 1; i >= 0; i--) {
    if (isReportReadyRound(keys[i])) return keys[i];
  }
  return null;
}

// list(=computeFormGuide().sequence를 홈/원정 등으로 필터링한 배열)에서
// beforeWeekNum "이전"까지 이어지는 연속 기록(predicate 만족) 길이를 구합니다.
function trailingStreakBefore(list, beforeWeekNum, predicate) {
  let count = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].weekNum >= beforeWeekNum) continue;
    if (predicate(list[i].result)) count++;
    else break;
  }
  return count;
}

function ordinalEn(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// 한 라운드에 우리 팀 경기가 둘 이상일 수 있습니다(연기 경기 재편성 등). 결과 리포트는
// "실제로 치른(스코어가 있는)" 경기를 기준으로 해야 하므로, 스코어가 있는 경기를 우선 고르고
// 없으면 첫 번째 경기를 돌려줍니다.
function findMyRoundMatch(matches) {
  const mine = matches.filter(m => !m.isBye &&
    (isMyTeamName(m.homeEn, m.homeKo) || isMyTeamName(m.awayEn, m.awayKo)));
  return mine.find(m => typeof m.homeScore === 'number' && typeof m.awayScore === 'number') || mine[0];
}

function reportTeamByNameEn(nameEn) {
  return leagueData.find(t => t.nameEn === nameEn) || null;
}

// 다른 팀(내 팀 바로 위/아래 순위) 결과가 이번 주 순위 싸움에 어떤 영향을 줬는지
function buildRivalWatch(afterSnap, beforeSnap, matches, rng) {
  if (!afterSnap || !afterSnap.ranks[REPORT_TEAM_EN]) return [];
  const myRank = afterSnap.ranks[REPORT_TEAM_EN];
  const ordered = Object.keys(afterSnap.ranks).sort((a, b) => afterSnap.ranks[a] - afterSnap.ranks[b]);
  const myIdx = ordered.indexOf(REPORT_TEAM_EN);
  const watchEns = [ordered[myIdx - 1], ordered[myIdx + 1]].filter(Boolean);

  return watchEns.map(nameEn => {
    const team = reportTeamByNameEn(nameEn);
    if (!team) return null;
    const match = matches.find(m => !m.isBye && (m.homeEn === nameEn || m.awayEn === nameEn));
    const ptsAfterRival = afterSnap.points[nameEn];
    const ptsBeforeRival = beforeSnap ? beforeSnap.points[nameEn] : ptsAfterRival;
    const rivalGainedPts = ptsAfterRival - ptsBeforeRival;
    const myPtsAfter = afterSnap.points[REPORT_TEAM_EN];
    const myPtsBefore = beforeSnap ? beforeSnap.points[REPORT_TEAM_EN] : myPtsAfter;
    const myPtsGained = myPtsAfter - myPtsBefore;
    const gapAfter = Math.abs(myPtsAfter - ptsAfterRival);
    const isAbove = afterSnap.ranks[nameEn] < myRank;

    let sentence = null;
    if (match) {
      const rivalWon = rivalGainedPts === 3;
      if (isAbove) {
        if (rivalWon && myPtsGained < 3) {
          sentence = pickSentence(rng, [
            [`위 순위 ${koShort(team.nameKo)}도 승리를 거두며 승점 차를 ${gapAfter}점으로 유지했다.`,
             `${team.nameEn} above also won this week, keeping the gap at ${gapAfter} points.`]
          ]);
        } else if (!rivalWon && myPtsGained >= 1) {
          sentence = pickSentence(rng, [
            [`위 순위 ${koIGa(koShort(team.nameKo))} 승점을 놓치면서 치주물루는 승점 차를 ${gapAfter}점까지 좁혔다.`,
             `${team.nameEn} above dropped points, narrowing the gap to ${gapAfter} points.`]
          ]);
        }
      } else {
        if (rivalWon) {
          sentence = pickSentence(rng, [
            [`바로 아래 ${koShort(team.nameKo)}도 승리를 거두며 추격을 이어갔고, 승점 차는 ${gapAfter}점에 불과하다.`,
             `${team.nameEn} below also picked up a win — the chase is on, with just ${gapAfter} points between the sides.`]
          ]);
        } else if (myPtsGained >= 1) {
          sentence = pickSentence(rng, [
            [`아래 순위 ${koShort(team.nameKo)}는 승점을 추가하지 못하면서 추격이 주춤했고, 승점 차는 ${gapAfter}점이다.`,
             `${team.nameEn} below failed to gain ground this week — the gap stands at ${gapAfter} points.`]
          ]);
        }
      }
    }
    return { nameKo: team.nameKo, nameEn: team.nameEn, isAbove, gapAfter, played: !!match, sentence };
  }).filter(Boolean);
}

// 라운드 내 우리 팀 경기 외 "다른 주요 경기"를 문장으로 엮어줍니다.
// hasScores=true면 이미 끝난 라운드(결과), false면 예정 라운드(예측)로 취급합니다.
function buildOtherFixturesParagraph(roundKey, rankSnapshot, excludeEns, hasScores, rng) {
  if (!rankSnapshot) return null;
  const matches = buildRoundMatches(roundKey).filter(m => !m.isBye &&
    !excludeEns.includes(m.homeEn) && !excludeEns.includes(m.awayEn));
  const notable = matches.filter(m => {
    const hr = rankSnapshot[m.homeEn], ar = rankSnapshot[m.awayEn];
    return (hr && hr <= 6) || (ar && ar <= 6);
  }).sort((a, b) => {
    const ra = Math.min(rankSnapshot[a.homeEn] || 99, rankSnapshot[a.awayEn] || 99);
    const rb = Math.min(rankSnapshot[b.homeEn] || 99, rankSnapshot[b.awayEn] || 99);
    return ra - rb;
  }).slice(0, 2);
  if (!notable.length) return null;

  const describe = (m) => {
    const homeName = isKorean ? m.homeKo : m.homeEn;
    const awayName = isKorean ? m.awayKo : m.awayEn;
    if (hasScores && typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
      return isKorean
        ? `${homeName} ${m.homeScore}-${m.awayScore} ${awayName}`
        : `${homeName} ${m.homeScore}-${m.awayScore} ${awayName}`;
    }
    return isKorean ? `${homeName} vs ${awayName}` : `${homeName} vs ${awayName}`;
  };

  const detailTxt = notable.map(describe).join(isKorean ? ', ' : ', ');

  if (hasScores) {
    return pickSentence(rng, [
      [`같은 주차에서는 ${detailTxt} 등의 결과가 나오며 상위권 팀들의 희비가 엇갈렸다.`,
       `Elsewhere in the round, ${detailTxt} added another twist to the picture at the top of the table.`]
    ]);
  }
  return pickSentence(rng, [
    [`같은 주차에서는 ${detailTxt} 경기가 열리는 가운데, 어느 쪽이 승점을 잃더라도 상위권 순위 경쟁에 변수가 될 수 있다.`,
     `Elsewhere that round, ${detailTxt} is also being played, so results across the board could reshape the top of the table.`]
  ]);
}

// 승격/강등 판도에서 이번 경기가 갖는 의미 (1위=승격권, 하위 2팀=강등권 가정)
function buildStakesParagraph(rankSnapshot, myRank, oppRank, totalTeams, rng, isPrediction) {
  if (!rankSnapshot || myRank == null) return null;
  const relegationCut = totalTeams - 2;
  if (myRank === 1 || oppRank === 1) {
    return pickSentence(rng, isPrediction ? [
      [`두 팀 중 한쪽은 리그 선두(승격권) 자리를 놓고 다투는 만큼, 이번 경기는 사실상 승격 경쟁의 분수령이 될 수 있다.`,
       `With top spot — the sole promotion place — on the line for one of these sides, this fixture could prove pivotal in the promotion race.`],
      [`선두 자리가 걸린 경기인 만큼, 승리하는 쪽이 승격 경쟁에서 한 발 더 앞서 나갈 수 있다.`,
       `With the league's top spot at stake, whoever wins here takes a real step forward in the promotion race.`]
    ] : [
      [`이번 결과는 리그 선두(승격권) 다툼에도 곧바로 영향을 미쳤다.`,
       `The result had an immediate knock-on effect at the top of the table, where the single promotion spot is being contested.`]
    ]);
  }
  if (myRank <= 3 && oppRank <= 3) {
    return pickSentence(rng, isPrediction ? [
      [`두 팀 모두 상위권에 자리한 만큼, 이번 경기는 승격 경쟁의 향방을 가를 수 있는 중요한 맞대결이다.`,
       `With both sides sitting near the top of the table, this is a heavyweight clash that could shape the promotion race.`],
      [`상위권끼리의 맞대결인 만큼, 승점 차를 좁히느냐 벌리느냐가 이번 경기 하나로 갈릴 수 있다.`,
       `As a top-of-the-table meeting, this single result could either close the gap or stretch it further apart.`]
    ] : [
      [`상위권 팀 간의 맞대결이었던 만큼, 이번 결과는 승격 경쟁 구도에 곧바로 영향을 미쳤다.`,
       `As a clash between two sides near the top, the result carried real weight for the promotion picture.`]
    ]);
  }
  if (myRank >= relegationCut || oppRank >= relegationCut) {
    return pickSentence(rng, isPrediction ? [
      [`한쪽 팀이 강등권에 걸쳐 있는 만큼, 이번 경기는 잔류를 위한 승점 확보 차원에서도 중요하다.`,
       `With one side sitting in the relegation zone, this match matters just as much for survival as for the table above.`],
      [`강등권과 맞닿은 순위인 만큼, 이번 경기 결과 하나로도 잔류 판도가 크게 흔들릴 수 있다.`,
       `With the relegation zone within touching distance, this single result could swing the survival picture significantly.`]
    ] : [
      [`강등권 경쟁이 걸린 팀이 포함된 경기였던 만큼, 이번 결과는 잔류 싸움에도 영향을 줬다.`,
       `With relegation-threatened opposition involved, the result also had implications at the bottom of the table.`]
    ]);
  }
  return null;
}

// 리그 1위(승격권)와의 승점 차이 문장 (내가 1위면 선두 자리를 강조)
function buildLeaderGapParagraph(myRank, myPts, rng, isPrediction) {
  if (myRank == null) return null;
  const leader = getRankedTeams('all')[0];
  if (!leader) return null;
  if (myRank === 1) {
    return pickSentence(rng, [
      [`현재 승점 ${myPts}점으로 리그 선두(승격권) 자리를 지키고 있다.`,
       `Chizumulu currently top the table on ${myPts} points, holding the sole promotion spot.`]
    ]);
  }
  const gap = leader.pts - myPts;
  return pickSentence(rng, [
    [`선두 ${koWaGwa(koShort(leader.nameKo))}의 승점 차는 ${gap}점이다.`,
     `The gap to league leaders ${leader.nameEn} stands at ${gap} point${gap === 1 ? '' : 's'}.`],
    [isPrediction ? `선두 ${koWaGwa(koShort(leader.nameKo))}는 승점 ${gap}점 차이로, 이번 경기 결과에 따라 격차가 좁혀지거나 더 벌어질 수 있다.` : `이번 결과로 선두 ${koWaGwa(koShort(leader.nameKo))}의 승점 차는 ${gap}점이 되었다.`,
     `Chizumulu trail leaders ${leader.nameEn} by ${gap} point${gap === 1 ? '' : 's'} — a gap that could shrink or grow depending on how this one goes.`]
  ]);
}

// 선두와의 승점 차를 "남은 경기 최대 승점" 산술로 풀어주는 문장 (선두가 아닐 때만)
function buildTitleMathParagraph(myRank) {
  if (myRank == null || myRank === 1) return null;
  const ranked = getRankedTeams('all');
  const leader = ranked[0];
  const me = ranked.find(t => t.nameEn === REPORT_TEAM_EN);
  if (!leader || !me || typeof me.played !== 'number') return null;
  const totalGames = (leagueData.length - 1) * 2;
  const remaining = totalGames - me.played;
  const gap = leader.pts - me.pts;
  if (remaining <= 0 || gap <= 0) return null;
  const maxPts = me.pts + remaining * 3;
  const lKo = koShort(leader.nameKo);
  if (maxPts < leader.pts) {
    return {
      ko: `남은 ${remaining}경기를 모두 승리하더라도 최대 승점이 ${maxPts}점에 그치므로, 이미 승점 ${leader.pts}점을 확보한 ${koEulReul(lKo)} 따라잡는 것은 불가능해졌다.`,
      en: `Even winning all ${remaining} remaining games would cap Chizumulu at ${maxPts} points, so catching ${leader.nameEn} (already on ${leader.pts}) is no longer possible.`
    };
  }
  return {
    ko: `남은 ${remaining}경기를 모두 승리할 경우 최대 승점은 ${maxPts}점으로, 현재 승점 ${leader.pts}점인 ${koWaGwa(lKo)}의 격차(${gap}점)를 좁힐 여지는 남아 있다.`,
    en: `Winning all ${remaining} remaining games would take Chizumulu to ${maxPts} points, so the ${gap}-point gap to ${leader.nameEn} (currently ${leader.pts}) can still be closed.`
  };
}

// 두 팀의 시즌 최다 득점자를 비교하는 문장
function buildTopScorerParagraph(teamAEn, teamAKo, teamBEn, teamBKo, rng) {
  if (typeof topScorersData === 'undefined') return null;
  const topOf = (teamEn) => topScorersData.filter(p => p.teamEn === teamEn).sort((a, b) => b.goals - a.goals)[0] || null;
  const a = topOf(teamAEn);
  const b = topOf(teamBEn);
  if (!a && !b) return null;
  const aName = isKorean ? teamAKo : teamAEn;
  const bName = isKorean ? teamBKo : teamBEn;
  if (a && b) {
    return pickSentence(rng, [
      [`${aName}의 최다 득점자는 ${a.goals}골을 넣은 ${isKorean ? a.nameKo : a.nameEn}, ${bName}은(는) ${b.goals}골의 ${isKorean ? b.nameKo : b.nameEn}가 공격을 이끌고 있다.`,
       `${aName}\u2019s top scorer is ${isKorean ? a.nameKo : a.nameEn} with ${a.goals} goals, while ${isKorean ? b.nameKo : b.nameEn} leads the line for ${bName} with ${b.goals}.`]
    ]);
  }
  const only = a || b;
  const onlyTeamName = a ? aName : bName;
  return pickSentence(rng, [
    [`${onlyTeamName}에서는 ${only.goals}골을 넣은 ${isKorean ? only.nameKo : only.nameEn}가 공격을 이끌고 있다.`,
     `${isKorean ? only.nameKo : only.nameEn} leads the way for ${onlyTeamName} with ${only.goals} goals this season.`]
  ]);
}

// 경기당 득점/실점 평균 비교 문장
function buildGoalAverageParagraph(myTeam, oppTeam, rng) {
  if (!myTeam || !oppTeam || !myTeam.played || !oppTeam.played) return null;
  const myGF = (myTeam.goalsFor / myTeam.played).toFixed(1);
  const myGA = (myTeam.goalsAgainst / myTeam.played).toFixed(1);
  const oppGF = (oppTeam.goalsFor / oppTeam.played).toFixed(1);
  const oppGA = (oppTeam.goalsAgainst / oppTeam.played).toFixed(1);
  const oppName = isKorean ? oppTeam.nameKo : oppTeam.nameEn;
  return pickSentence(rng, [
    [`치주물루는 경기당 평균 ${myGF}득점 ${myGA}실점을 기록 중이며, ${oppName}는 경기당 평균 ${oppGF}득점 ${oppGA}실점을 기록하고 있다.`,
     `Chizumulu are averaging ${myGF} goals scored and ${myGA} conceded per game, compared with ${oppGF} scored and ${oppGA} conceded for ${oppName}.`],
    [`${Number(myGA) < Number(oppGA) ? '치주물루' : oppName}의 수비와 ${Number(myGF) > Number(oppGF) ? '치주물루' : oppName}의 공격이 맞서는 경기로, 경기당 득점은 ${myGF} 대 ${oppGF}, 실점은 ${myGA} 대 ${oppGA}이다.`,
     `It also shapes up as a clash between attack and defense — ${myGF} vs ${oppGF} goals scored per game, and ${myGA} vs ${oppGA} conceded, for Chizumulu and ${oppName} respectively.`]
  ]);
}

// 경기 연기 등으로 다른 팀보다 소화한 경기 수가 적을 때("미소화 경기"),
// 실제 경기 없이도 순위가 오르내릴 수 있다는 맥락을 짚어주는 문장입니다.
function buildGamesInHandParagraph(myTeam, rng, isPrediction) {
  if (!myTeam || typeof myTeam.played !== 'number') return null;
  const ranked = getRankedTeams('all');
  if (!ranked.length) return null;
  const maxPlayed = Math.max(...ranked.map(t => t.played || 0));
  const gamesInHand = maxPlayed - myTeam.played;
  if (gamesInHand <= 0) return null;
  return pickSentence(rng, isPrediction ? [
    [`경기 연기가 이어지며 치주물루는 다른 팀들보다 ${gamesInHand}경기를 덜 치른 상태다. 이번 경기 결과와 별개로, 다른 팀들이 밀린 경기를 소화하는 과정에서 순위가 오르내릴 가능성이 있다.`,
     `With ${gamesInHand} game${gamesInHand === 1 ? '' : 's'} in hand still to play, Chizumulu's position could shift up or down purely on the back of other results, regardless of how this one goes.`],
    [`잇단 일정 연기로 미소화 경기(${gamesInHand}경기)를 남겨두고 있어, 실제 경기 없이도 순위표상 위치가 흔들릴 수 있는 상황이다.`,
     `A backlog of ${gamesInHand} postponed fixture${gamesInHand === 1 ? '' : 's'} means the table position can move even without Chizumulu kicking a ball.`]
  ] : [
    [`이번 결과가 나온 시점에도 치주물루는 여전히 다른 팀들보다 ${gamesInHand}경기를 덜 치른 상태라, 향후 이월 경기 결과에 따라 순위가 다시 조정될 수 있다.`,
     `Even after this result, Chizumulu still have ${gamesInHand} game${gamesInHand === 1 ? '' : 's'} in hand, so the table could still shift once those fixtures are played out.`]
  ]);
}

function buildRoundResultReport(roundKey) {
  if (!roundKey) return null;
  const weekNum = parseInt(roundKey.replace('round', ''), 10);
  const matches = buildRoundMatches(roundKey);
  const myBye = matches.find(m => m.isBye && isMyTeamName(m.teamEn, m.teamKo));
  const myMatch = findMyRoundMatch(matches);

  const history = computeStandingsHistory();
  const afterSnap = history.find(h => h.week === weekNum);
  const beforeSnap = history.find(h => h.week === weekNum - 1);
  const rankAfter = afterSnap ? afterSnap.ranks[REPORT_TEAM_EN] : null;
  const rankBefore = beforeSnap ? beforeSnap.ranks[REPORT_TEAM_EN] : null;
  const ptsAfter = afterSnap ? afterSnap.points[REPORT_TEAM_EN] : null;
  const ptsBefore = beforeSnap ? beforeSnap.points[REPORT_TEAM_EN] : null;

  const rngResult = mulberry32(seedFromString(roundKey + ':result'));
  const rngRival = mulberry32(seedFromString(roundKey + ':rival'));

  // ---- 부전승(BYE) 주간 ----
  if (myBye) {
    return {
      roundKey, weekNum, isBye: true, rankAfter, rankBefore, ptsAfter,
      headline: { ko: `${wkKo(weekNum)}: 이번 주는 부전승 주간`, en: `${wkEn(weekNum, 'Round', ' ')}: Bye week` },
      paragraphs: [pickSentence(rngResult, [
        ['이번 주차는 치주물루의 경기가 없는 부전승 주간이었다. 다른 팀들의 결과를 지켜보며 다음 경기를 준비할 시간이다.',
         'Chizumulu had no fixture this week due to the bye round — a chance to rest up and watch how the rest of the league moved.']
      ])],
      rivalWatch: buildRivalWatch(afterSnap, beforeSnap, matches, rngRival)
    };
  }
  if (!myMatch) return null;
  if (typeof myMatch.homeScore !== 'number' || typeof myMatch.awayScore !== 'number') return null;

  const isHome = isMyTeamName(myMatch.homeEn, myMatch.homeKo);
  const myGoals = isHome ? myMatch.homeScore : myMatch.awayScore;
  const oppGoals = isHome ? myMatch.awayScore : myMatch.homeScore;
  const oppKo = isHome ? myMatch.awayKo : myMatch.homeKo;
  const oppEn = isHome ? myMatch.awayEn : myMatch.homeEn;
  const result = myGoals > oppGoals ? 'W' : (myGoals < oppGoals ? 'L' : 'D');
  const diff = myGoals - oppGoals;
  const scorersRaw = isHome ? myMatch.scorersHome : myMatch.scorersAway;

  // ---- 폼가이드 기반 마일스톤/스트릭 감지 ----
  const guide = (typeof computeFormGuide === 'function') ? computeFormGuide(REPORT_TEAM_EN, REPORT_TEAM_KO) : null;
  const seq = guide ? guide.sequence : [];
  const awaySeq = seq.filter(m => m.homeAway === 'A');
  const homeSeq = seq.filter(m => m.homeAway === 'H');
  const awayBefore = awaySeq.filter(m => m.weekNum < weekNum);

  const milestones = [];
  let awayDroughtLen = 0;
  if (!isHome) {
    const firstAwayWinEver = result === 'W' && awayBefore.length > 0 && awayBefore.every(m => m.result !== 'W');
    const firstAwayGoalEver = myGoals > 0 && awayBefore.length > 0 && awayBefore.every(m => m.myGoals === 0);
    awayDroughtLen = trailingStreakBefore(awaySeq, weekNum, r => r !== 'W');
    if (firstAwayWinEver) milestones.push('firstAwayWin');
    else if (result === 'W' && awayDroughtLen >= 3) milestones.push('awayDroughtBroken');
    if (firstAwayGoalEver) milestones.push('firstAwayGoal');
  } else {
    const homeUnbeatenBefore = trailingStreakBefore(homeSeq, weekNum, r => r === 'W' || r === 'D');
    if ((result === 'W' || result === 'D') && homeUnbeatenBefore >= 4) milestones.push('homeFortress');
  }
  if (oppGoals === 0 && (result === 'W' || result === 'D')) milestones.push('cleanSheet');
  if (guide && guide.currentWinStreak >= 3) milestones.push('winStreak');
  else if (guide && guide.currentUnbeatenStreak >= 4) milestones.push('unbeatenStreak');
  const lossStreakLen = trailingStreakBefore(seq.concat([{ weekNum: weekNum + 1, result }]), weekNum + 1, r => r === 'L');
  if (lossStreakLen >= 3) milestones.push('lossStreak');

  // 멀티골 득점자(N골) 패턴 감지
  let braceScorer = null;
  if (scorersRaw && scorersRaw !== '없음') {
    const m2 = scorersRaw.match(/([^,()]+)\s*\((\d+)골\)/);
    if (m2 && parseInt(m2[2], 10) >= 2) braceScorer = { name: m2[1].trim(), goals: parseInt(m2[2], 10) };
  }

  const resultTag = result === 'W'
    ? (diff >= 3 ? 'winDominant' : (diff === 1 ? 'winClose' : 'winNormal'))
    : result === 'D'
      ? (myGoals >= 2 ? 'drawHighScoring' : 'drawTight')
      : (diff <= -3 ? 'lossHeavy' : (diff === -1 ? 'lossClose' : 'lossNormal'));

  const oppDisp = koTrimFC(oppKo);
  const oppEul = koEulReul(oppKo);
  const oppWa = koWaGwa(oppKo);
  const RESULT_SENTENCES = {
    winDominant: [
      [`${oppEul} 상대로 ${myGoals}-${oppGoals} 대승을 거두며 승점 3점을 추가했다.`, 'Chizumulu were in control from start to finish for a dominant win.'],
      [`${oppDisp}의 골문을 연이어 열며 ${myGoals}-${oppGoals} 완승을 거두고 승점 3점을 확보했다.`, 'A one-sided affair saw the three points secured with ease.']
    ],
    winClose: [
      [`${oppWa}의 접전 끝에 ${myGoals}-${oppGoals}로 승리하며 승점 3점을 확보했다.`, 'A tight one-goal margin was enough to see the game out.'],
      [`${myGoals}-${oppGoals} 한 골 차 신승으로 승점 3점을 가져왔다.`, 'It was a nervy, narrow win, but concentration held to the final whistle.']
    ],
    winNormal: [
      [`${oppEul} 상대로 ${myGoals}-${oppGoals} 승리를 거두며 승점 3점을 추가했다.`, 'A composed performance was enough to secure the three points.'],
      [`${myGoals}-${oppGoals}로 승리하며 승점 3점을 확보하는 데 성공했다.`, 'A balanced contest ultimately swung Chizumulu\u2019s way.']
    ],
    drawHighScoring: [
      [`${oppWa}의 난타전 끝에 ${myGoals}-${oppGoals}로 비기며 승점 1점씩을 나눠 가졌다.`, 'Goals flowed on both sides, but neither side could find a winner.']
    ],
    drawTight: [
      [`${myGoals}-${oppGoals} 무승부를 기록하며 승점 1점을 추가하는 데 그쳤다.`, 'A tightly fought contest ended in a share of the spoils.']
    ],
    lossHeavy: [
      [`${oppEul} 상대로 ${myGoals}-${oppGoals} 대패를 당하며 승점을 얻지 못했다.`, 'It was a heavy, one-sided defeat.']
    ],
    lossClose: [
      [`${oppWa}의 접전 끝에 ${myGoals}-${oppGoals}로 아쉽게 패하며 승점 확보에 실패했다.`, 'A narrow one-goal margin decided the game.']
    ],
    lossNormal: [
      [`${myGoals}-${oppGoals}로 패하며 승점을 추가하지 못했다.`, 'A spirited effort wasn\u2019t enough to avoid defeat.']
    ]
  };

  const paragraphs = [pickSentence(rngResult, RESULT_SENTENCES[resultTag])];

  // 직전 경기와의 대비 ("지난 13주차 칠룸바전 4-0 대승 이후 ...")
  const prevMatch = seq.filter(m => m.weekNum < weekNum && !m.forfeit).slice(-1)[0];
  if (prevMatch) {
    const pScore = `${prevMatch.myGoals}-${prevMatch.oppGoals}`;
    const pDiff = prevMatch.myGoals - prevMatch.oppGoals;
    const pWk = wkKo(prevMatch.weekNum);
    const pOpp = koShort(prevMatch.oppKo);
    const pNounKo = prevMatch.result === 'W' ? (pDiff >= 3 ? '대승' : '승리') : (prevMatch.result === 'D' ? '무승부' : (pDiff <= -3 ? '대패' : '패배'));
    const pNounEn = prevMatch.result === 'W' ? (pDiff >= 3 ? 'a big win' : 'a win') : (prevMatch.result === 'D' ? 'a draw' : (pDiff <= -3 ? 'a heavy defeat' : 'a defeat'));
    const pWkEn = wkEn(prevMatch.weekNum, 'Round', ' ');
    let ko, en;
    if (prevMatch.result === 'W' && result === 'W') {
      ko = `지난 ${pWk} ${pOpp}전 ${pScore} ${pNounKo}에 이어 이번에도 승점 3점을 추가하며 상승세를 이어갔다.`;
      en = `Following ${pNounEn} (${pScore}) against ${prevMatch.oppEn} in ${pWkEn}, Chizumulu took three more points to extend the upturn.`;
    } else if (prevMatch.result === 'W') {
      ko = `지난 ${pWk} ${pOpp}전 ${pScore} ${pNounKo}로 상위권 추격의 발판을 마련했으나, 이번 경기에서는 ${result === 'D' ? '승점 1점을 추가하는 데 그쳐' : '승점을 얻지 못해'} 상승세를 이어가지 못했다.`;
      en = `After ${pNounEn} (${pScore}) against ${prevMatch.oppEn} in ${pWkEn}, Chizumulu ${result === 'D' ? 'picked up only a point' : 'came away empty-handed'} this time and could not carry the momentum forward.`;
    } else if (result === 'W') {
      ko = `지난 ${pWk} ${pOpp}전 ${pScore} ${pNounKo}의 아쉬움을 털어내고 승점 3점을 가져오며 반등에 성공했다.`;
      en = `Chizumulu shrugged off ${pNounEn} (${pScore}) against ${prevMatch.oppEn} in ${pWkEn} and bounced back with three points.`;
    } else {
      ko = `지난 ${pWk} ${pOpp}전 ${pScore} ${pNounKo}에 이어 이번에도 ${result === 'D' ? '승점 1점 확보에 그치며' : '승점을 얻지 못하며'} 반등의 계기를 만들지 못했다.`;
      en = `Following ${pNounEn} (${pScore}) against ${prevMatch.oppEn} in ${pWkEn}, Chizumulu ${result === 'D' ? 'managed just a point' : 'again came up short'} and could not find a turning point.`;
    }
    paragraphs.push({ ko, en });
  }

  // 이번 시즌 홈/원정 누적 성적
  const venueList = (isHome ? homeSeq : awaySeq).filter(m => m.weekNum <= weekNum);
  if (venueList.length >= 3) {
    const vr = tallyRecord(venueList);
    const vKo = isHome ? '홈' : '원정';
    const vEn = isHome ? 'home' : 'away';
    const rWordKo = result === 'W' ? '승리' : (result === 'D' ? '무승부' : '패배');
    const lowScoring = vr.gf / vr.n < 1;
    paragraphs.push({
      ko: `이번 ${rWordKo}로 ${vKo} 성적은 ${vr.w}승 ${vr.d}무 ${vr.l}패가 되었으며, ${vr.n}차례의 ${vKo}경기에서 ${lowScoring ? `단 ${vr.gf}득점에 그치는 등 ${vr.ga}실점을 기록했다` : `${vr.gf}득점 ${vr.ga}실점을 기록 중이다`}.`,
      en: `The ${result === 'W' ? 'win' : (result === 'D' ? 'draw' : 'defeat')} leaves Chizumulu's ${vEn} record at W${vr.w} D${vr.d} L${vr.l}, with ${vr.gf} scored and ${vr.ga} conceded in ${vr.n} ${vEn} games.`
    });
  }

  if (braceScorer) {
    paragraphs.push(pickSentence(rngResult, [
      [`${braceScorer.name} 선수가 ${braceScorer.goals}골을 몰아치며 공격을 이끌었다.`,
       `${braceScorer.name} was the star of the day with a ${braceScorer.goals}-goal haul.`]
    ]));
  }

  if (rankBefore != null && rankAfter != null && rankBefore !== rankAfter) {
    const delta = rankBefore - rankAfter; // 양수면 순위 상승
    if (delta > 0) {
      paragraphs.push(pickSentence(rngResult, [
        [`이에 따라 치주물루는 승점 ${ptsAfter}점으로 순위가 ${rankBefore}위에서 ${rankAfter}위로 ${delta}계단 상승했다.`,
         `The result lifted Chizumulu ${delta} place${delta > 1 ? 's' : ''} up the table, from ${ordinalEn(rankBefore)} to ${ordinalEn(rankAfter)}.`]
      ]));
    } else {
      paragraphs.push(pickSentence(rngResult, [
        [`이에 따라 치주물루는 승점 ${ptsAfter}점으로 ${rankBefore}위에서 ${rankAfter}위로 ${Math.abs(delta)}계단 밀려났다.`,
         `The table now reads ${ordinalEn(rankAfter)}, down ${Math.abs(delta)} place${Math.abs(delta) > 1 ? 's' : ''} from ${ordinalEn(rankBefore)}.`]
      ]));
    }
  } else if (rankBefore != null && rankAfter != null && ptsAfter != null) {
    paragraphs.push({
      ko: `승점 ${ptsAfter}점으로 순위는 ${rankAfter}위를 유지했다.`,
      en: `On ${ptsAfter} points, Chizumulu stay ${ordinalEn(rankAfter)} in the table.`
    });
  }

  const MILESTONE_SENTENCES = {
    firstAwayWin: [['이번 승리는 시즌 첫 원정승으로, 그동안의 원정 부진을 극복할 계기를 마련했다는 점에서 의미가 크다.',
      'This was the first away win of the season — a potential turning point for a side that had leaned heavily on home form.']],
    awayDroughtBroken: [[`원정 ${awayDroughtLen}경기 연속 무승에서 벗어나는 값진 승점 3점이었다.`,
      `This win ended a run of ${awayDroughtLen} away games without a win — a much-needed breakthrough on the road.`]],
    firstAwayGoal: [['이번 시즌 첫 원정 득점이라는 점에서도 의미가 있는 경기였다.',
      'It also marked the team\u2019s first away goal of the season — a psychological boost on unfamiliar turf.']],
    homeFortress: [['홈 무패 행진을 이어가며 상위권 경쟁의 발판을 다졌다.',
      'The unbeaten home run continues — sides that consistently protect home points tend to hold the edge come the business end of the season.']],
    cleanSheet: [['무실점으로 경기를 마치며 수비 안정감을 다시 한번 확인했다.',
      'A clean sheet was kept at the back — and the more clean sheets pile up, the more points tend to follow.']],
    winStreak: [[`${guide ? guide.currentWinStreak : ''}연승을 이어가며 상위권 추격에 속도를 내고 있다.`,
      `That's ${guide ? guide.currentWinStreak : ''} wins in a row — momentum is firmly on Chizumulu's side.`]],
    unbeatenStreak: [[`${guide ? guide.currentUnbeatenStreak : ''}경기 무패 행진을 이어가며 안정적인 흐름을 유지하고 있다.`,
      `The unbeaten run has been extended to ${guide ? guide.currentUnbeatenStreak : ''} games.`]],
    lossStreak: [[`${lossStreakLen}경기 연속 패배로 부진이 길어지고 있어, 흐름을 끊을 반등이 시급한 상황이다.`,
      `This is a ${ordinalEn(lossStreakLen)} straight defeat — a difficult run that needs turning around soon.`]]
  };
  milestones.forEach(tag => {
    if (MILESTONE_SENTENCES[tag]) paragraphs.push(pickSentence(rngResult, MILESTONE_SENTENCES[tag]));
  });

  // ---- 리그 판도(선두 격차), 득점 스탯, 시즌 최다 득점자 비교 ----
  const leaderGapPara = buildLeaderGapParagraph(rankAfter, ptsAfter, rngResult, false);
  if (leaderGapPara) paragraphs.push(leaderGapPara);
  const oppTeamObj = reportTeamByNameEn(oppEn);
  const myTeamObj = reportTeamByNameEn(REPORT_TEAM_EN);
  const titleMathPara = buildTitleMathParagraph(rankAfter);
  if (titleMathPara) paragraphs.push(titleMathPara);
  const goalAvgPara = buildGoalAverageParagraph(myTeamObj, oppTeamObj, rngResult);
  if (goalAvgPara) paragraphs.push(goalAvgPara);
  const topScorerPara = buildTopScorerParagraph(REPORT_TEAM_EN, REPORT_TEAM_KO, oppEn, oppKo, rngResult);
  if (topScorerPara) paragraphs.push(topScorerPara);
  const gamesInHandParaResult = buildGamesInHandParagraph(myTeamObj, rngResult, false);
  if (gamesInHandParaResult) paragraphs.push(gamesInHandParaResult);

  // ---- 같은 라운드 다른 상위권/강등권 경기, 판도에 미치는 의미 ----
  const totalTeamsResult = leagueData.length;
  const stakesPara = buildStakesParagraph(afterSnap ? afterSnap.ranks : null, rankAfter, null, totalTeamsResult, rngResult, false);
  if (stakesPara) paragraphs.push(stakesPara);
  const otherFixturesPara = buildOtherFixturesParagraph(
    roundKey, afterSnap ? afterSnap.ranks : null,
    [REPORT_TEAM_EN, myMatch.homeEn, myMatch.awayEn], true, rngResult
  );
  if (otherFixturesPara) paragraphs.push(otherFixturesPara);

  return {
    roundKey, weekNum, isBye: false, isHome, oppKo, oppEn, myGoals, oppGoals, result,
    rankBefore, rankAfter, ptsBefore, ptsAfter, milestones,
    headline: {
      ko: `${wkKo(weekNum)}: 치주물루 ${myGoals} - ${oppGoals} ${oppKo} (${isHome ? '홈' : '원정'})`,
      en: `${wkEn(weekNum, 'Round', ' ')}: Chizumulu ${myGoals}-${oppGoals} ${oppEn} (${isHome ? 'Home' : 'Away'})`
    },
    paragraphs,
    rivalWatch: buildRivalWatch(afterSnap, beforeSnap, matches, rngRival)
  };
}

// ===================================================================
// ===== 다음 주차 예측 리포트 (AI 자동 생성 리포트) =====
// 결과 리포트 오른쪽(PC 기준)에 나란히 표시되는 카드입니다.
// 아직 열리지 않은 우리 팀(치주물루)의 다음 예정 경기를 computeNextMatchPreview로
// 찾아서, 이미 다른 화면(경기 비교 모달)에서 쓰던 predictSingleMatch +
// aiPredictionBlockHtml(포아송 모델 기반) 그대로 재사용해 예측 내용을 채웁니다.
// ===================================================================
function buildRoundPredictionReport() {
  if (typeof computeNextMatchPreview !== 'function') return null;
  const preview = computeNextMatchPreview(REPORT_TEAM_EN, REPORT_TEAM_KO);
  if (!preview) return null;
  const weekNum = parseInt(preview.roundKey.replace('round', ''), 10);

  if (preview.isBye) {
    return { isBye: true, weekNum, roundKey: preview.roundKey };
  }

  const isHome = preview.homeAway === 'H';
  return {
    isBye: false,
    weekNum,
    roundKey: preview.roundKey,
    homeEn: isHome ? REPORT_TEAM_EN : preview.oppEn,
    homeKo: isHome ? REPORT_TEAM_KO : preview.oppKo,
    awayEn: isHome ? preview.oppEn : REPORT_TEAM_EN,
    awayKo: isHome ? preview.oppKo : REPORT_TEAM_KO,
    oppEn: preview.oppEn,
    oppKo: preview.oppKo,
    homeAway: preview.homeAway,
    kickoffDate: preview.kickoffDate,
    kickoffTime: preview.kickoffTime
  };
}

// ===== 이번 라운드의 "함께 주목할 경기" =====
// 치주물루 순위/승점 바로 위·아래 팀이 같은 라운드에 치르는 경기를 찾아,
// 그 경기 결과가 우리 순위·승점 경쟁에 어떤 영향을 줄 수 있는지와 함께
// AI 예측(aiPredictionBlockHtml)을 그대로 붙여줍니다.
function findWatchFixture(pred) {
  const ranked = getRankedTeams('all');
  const orderedEns = ranked.map(t => t.nameEn);
  const myIdx = orderedEns.indexOf(REPORT_TEAM_EN);
  if (myIdx === -1) return null;

  const rivalInfos = [
    orderedEns[myIdx - 1] ? { nameEn: orderedEns[myIdx - 1], isAbove: true } : null,
    orderedEns[myIdx + 1] ? { nameEn: orderedEns[myIdx + 1], isAbove: false } : null
  ].filter(Boolean);

  const matches = buildRoundMatches(pred.roundKey).filter(m => !m.isBye &&
    m.homeEn !== REPORT_TEAM_EN && m.awayEn !== REPORT_TEAM_EN);

  // 승점(pts)은 getRankedTeams가 계산해서 돌려주는 값에만 들어 있으므로 거기서 찾습니다.
  const rankedAll = getRankedTeams('all');
  for (const rival of rivalInfos) {
    const match = matches.find(m => m.homeEn === rival.nameEn || m.awayEn === rival.nameEn);
    if (match) {
      const rivalTeam = rankedAll.find(t => t.nameEn === rival.nameEn) || null;
      const myTeam = rankedAll.find(t => t.nameEn === REPORT_TEAM_EN) || null;
      const gap = rivalTeam && myTeam ? Math.abs((rivalTeam.pts || 0) - (myTeam.pts || 0)) : null;
      return { match, isAbove: rival.isAbove, rivalNameKo: rivalTeam ? rivalTeam.nameKo : rival.nameEn, rivalNameEn: rival.nameEn, gap };
    }
  }
  return null;
}

// 예측 리포트의 "AI 예측" 블록 아래에 붙는 서술형 문단.
// 결과 리포트(buildRoundResultReport)와 같은 문장 뱅크 조합 방식이며,
// 라운드+용도를 시드로 써서 새로고침해도 같은 문장 조합이 나오도록 합니다.
function buildPredictionReportNarrative(pred, home, away) {
  const rng = mulberry32(seedFromString(pred.roundKey + ':predict-narrative'));
  const paragraphs = [];

  const myIsHome = pred.homeAway === 'H';
  const mySnap = myIsHome ? home : away;
  const oppSnap = myIsHome ? away : home;
  const oppName = isKorean ? pred.oppKo : pred.oppEn;
  const oppNameShort = oppName.split(' ')[0];

  // ---- 순위/승점 비교 ----
  if (mySnap.rank != null && oppSnap.rank != null) {
    const rankDiff = oppSnap.rank - mySnap.rank; // 양수면 내가 더 위 순위
    const ptsDiff = Math.abs((mySnap.team.pts || 0) - (oppSnap.team.pts || 0));
    if (rankDiff > 0) {
      paragraphs.push(pickSentence(rng, [
        [`현재 치주물루는 ${mySnap.rank}위로 ${oppNameShort}(${oppSnap.rank}위)보다 앞서 있으며, 승점 차는 ${ptsDiff}점이다.`,
         `Chizumulu currently sit ${ordinalEn(mySnap.rank)}, above ${oppNameShort} (${ordinalEn(oppSnap.rank)}) by ${ptsDiff} point${ptsDiff === 1 ? '' : 's'}.`]
      ]));
    } else if (rankDiff < 0) {
      paragraphs.push(pickSentence(rng, [
        [`상대 ${koIGa(oppNameShort)} ${oppSnap.rank}위로 치주물루(${mySnap.rank}위)보다 앞서 있는 만큼 순위표상으로는 쉽지 않은 상대이며, 승점 차는 ${ptsDiff}점이다.`,
         `${oppNameShort} sit above Chizumulu in the table (${ordinalEn(oppSnap.rank)} vs ${ordinalEn(mySnap.rank)}), making this a tough test on paper — the gap is ${ptsDiff} point${ptsDiff === 1 ? '' : 's'}.`]
      ]));
    } else {
      paragraphs.push(pickSentence(rng, [
        [`두 팀이 나란히 ${mySnap.rank}위에 자리해 있어, 이번 경기 결과에 따라 순위 변동이 생길 수 있다.`,
         `Both sides are level in the table at ${ordinalEn(mySnap.rank)}, so this result could shuffle the standings either way.`]
      ]));
    }
  }

  // ---- 상대팀 시즌 성적 + 홈/원정 기록 ----
  const oppT = oppSnap.team;
  if (oppT && oppT.played) {
    const oW = oppT.won || 0, oD = oppT.drawn || 0, oL = oppT.played - oW - oD;
    const oRecent = oppSnap.form && oppSnap.form.recentForm ? oppSnap.form.recentForm : [];
    const oR = tallyRecord(oRecent);
    paragraphs.push({
      ko: `상대 ${koEunNeun(oppNameShort)} 이번 시즌 ${oppT.played}경기에서 ${oW}승 ${oD}무 ${oL}패, ${oppT.goalsFor}득점 ${oppT.goalsAgainst}실점, 승점 ${oppT.pts}점으로 ${oppSnap.rank}위에 올라 있다.${oR.n >= 3 ? ` 최근 ${oR.n}경기 성적은 ${oR.w}승 ${oR.d}무 ${oR.l}패다.` : ''}`,
      en: `${oppNameShort} sit ${ordinalEn(oppSnap.rank)} on ${oppT.pts} points (W${oW} D${oD} L${oL}, ${oppT.goalsFor} scored, ${oppT.goalsAgainst} conceded in ${oppT.played} games).${oR.n >= 3 ? ` Their last ${oR.n}: W${oR.w} D${oR.d} L${oR.l}.` : ''}`
    });
  }
  const mySeqAll = (mySnap.form && mySnap.form.sequence) || [];
  const oppSeqAll = (oppSnap.form && oppSnap.form.sequence) || [];
  const myVenue = tallyRecord(mySeqAll.filter(m => m.homeAway === (myIsHome ? 'H' : 'A')));
  const oppVenue = tallyRecord(oppSeqAll.filter(m => m.homeAway === (myIsHome ? 'A' : 'H')));
  if (myVenue.n >= 2) {
    const vKo = myIsHome ? '홈' : '원정';
    const ovKo = myIsHome ? '원정' : '홈';
    const vEn = myIsHome ? 'home' : 'away';
    const ovEn = myIsHome ? 'away' : 'home';
    paragraphs.push({
      ko: `치주물루는 이번 시즌 ${vKo}에서 ${myVenue.w}승 ${myVenue.d}무 ${myVenue.l}패(${myVenue.gf}득점 ${myVenue.ga}실점)를 기록 중이며,${oppVenue.n >= 2 ? ` ${oppNameShort} 역시 ${ovKo}에서 ${oppVenue.w}승 ${oppVenue.d}무 ${oppVenue.l}패에 머물러 있다.` : ' 이번 경기에서 그 흐름을 이어갈 수 있을지가 관건이다.'}`,
      en: `Chizumulu's ${vEn} record this season is W${myVenue.w} D${myVenue.d} L${myVenue.l} (${myVenue.gf} scored, ${myVenue.ga} conceded)${oppVenue.n >= 2 ? `, while ${oppNameShort} are W${oppVenue.w} D${oppVenue.d} L${oppVenue.l} on their ${ovEn} travels.`.replace('on their away travels', 'away from home').replace('on their home travels', 'at home') : '.'}`
    });
  }

  // ---- 최근 폼 비교 ----
  const myStreakTxt = mySnap.form && mySnap.form.recentForm && mySnap.form.recentForm.length
    ? mySnap.form.recentForm.map(m => m.result).join('')
    : null;
  if (myStreakTxt) {
    if (mySnap.form.currentWinStreak >= 2) {
      paragraphs.push(pickSentence(rng, [
        [`최근 ${mySnap.form.currentWinStreak}연승으로 상승세를 타고 있어 이번 경기도 기세를 이어갈지 주목된다.`,
         `Chizumulu head into this one on a ${mySnap.form.currentWinStreak}-game winning streak, looking to keep the momentum going.`],
        [`${mySnap.form.currentWinStreak}연승 행진 중인 만큼, 이 기세를 원정길에서도 이어갈 수 있을지가 관전 포인트다.`,
         `On the back of ${mySnap.form.currentWinStreak} straight wins, the question is whether that momentum can carry over into this fixture.`]
      ]));
    } else if (mySnap.form.currentUnbeatenStreak >= 3) {
      paragraphs.push(pickSentence(rng, [
        [`최근 ${mySnap.form.currentUnbeatenStreak}경기 무패 행진 중이라 자신감 있게 이번 경기를 준비할 수 있다.`,
         `An unbeaten run of ${mySnap.form.currentUnbeatenStreak} games has Chizumulu heading in with confidence.`]
      ]));
    } else {
      const recentResults = mySnap.form.recentForm.map(m => m.result);
      const recentLosses = recentResults.filter(r => r === 'L').length;
      // 승-패를 번갈아 반복하는 이른바 '퐁당퐁당' 흐름 감지 (최근 4경기 이상, 연속된 두 결과가 한 번도 같지 않은 경우)
      const isAlternating = recentResults.length >= 4 &&
        recentResults.slice(-4).every((r, i, arr) => i === 0 || r !== arr[i - 1]);
      if (isAlternating) {
        paragraphs.push(pickSentence(rng, [
          [`승-패를 번갈아 반복하는 이른바 '퐁당퐁당' 흐름이 이어지고 있어, 다음 결과를 쉽게 예측하기 어려운 상황이다.`,
           `Chizumulu have been stuck in a win-lose-win-lose pattern lately, making the next result tough to call.`],
          [`최근 결과가 승패를 오가며 들쭉날쭉한 흐름을 보이고 있어, 이번 경기에서 연속성을 만드는 것이 과제다.`,
           `Results have swung back and forth recently, so building any real consistency is the priority heading into this one.`]
        ]));
      } else if (recentLosses >= 3) {
        paragraphs.push(pickSentence(rng, [
          [`최근 경기 결과가 좋지 않았던 만큼, 이번 경기에서 흐름을 바꿔야 한다.`,
           `Recent results haven\u2019t gone Chizumulu\u2019s way, so this is a chance to turn things around.`],
          [`최근 흐름이 좋지 않은 가운데 맞이하는 경기라, 반등의 계기가 절실하다.`,
           `Chizumulu arrive in poor recent form and badly need a result to arrest the slide.`]
        ]));
      }
    }

  }

  // ---- 상대 전적(이번 시즌) ----
  const h2h = (typeof computeTeamSeasonH2H === 'function')
    ? computeTeamSeasonH2H(REPORT_TEAM_EN, REPORT_TEAM_KO, pred.oppEn, pred.oppKo)
    : null;
  if (h2h) {
    const myScore = h2h.aIsHome ? h2h.aScore : h2h.bScore;
    const oppScore = h2h.aIsHome ? h2h.bScore : h2h.aScore;
    const h2hResult = myScore > oppScore ? 'W' : (myScore < oppScore ? 'L' : 'D');
    const weekLbl = isKorean ? `${wkKo(h2h.weekNum)}` : `${wkEn(h2h.weekNum, 'Round', ' ')}`;
    if (h2hResult === 'W') {
      paragraphs.push(pickSentence(rng, [
        [`이번 시즌 ${weekLbl} 맞대결에서 ${myScore}-${oppScore}로 승리했던 만큼, 상대전적에서는 앞서 있다.`,
         `Chizumulu won the earlier meeting this season ${myScore}-${oppScore} (${weekLbl}), giving them the edge in this rivalry.`]
      ]));
    } else if (h2hResult === 'L') {
      paragraphs.push(pickSentence(rng, [
        [`이번 시즌 ${weekLbl} 맞대결에서는 ${oppScore}-${myScore}로 패했던 만큼, 이번엔 설욕이 필요하다.`,
         `${oppNameShort} won the earlier meeting this season ${oppScore}-${myScore} (${weekLbl}) — Chizumulu will be looking for revenge.`]
      ]));
    } else {
      paragraphs.push(pickSentence(rng, [
        [`이번 시즌 ${weekLbl} 맞대결은 ${myScore}-${oppScore} 무승부로 끝났다.`,
         `The earlier meeting this season (${weekLbl}) finished level, ${myScore}-${oppScore}.`]
      ]));
    }
  } else {
    paragraphs.push(pickSentence(rng, [
      [`이번 시즌 두 팀의 첫 맞대결이다.`,
       `This will be the first meeting between the two sides this season.`]
    ]));
  }

  // ---- 리그 판도(선두 격차), 득점 스탯, 시즌 최다 득점자 비교 ----
  const leaderGapPara = buildLeaderGapParagraph(mySnap.rank, mySnap.team ? mySnap.team.pts : null, rng, true);
  if (leaderGapPara) paragraphs.push(leaderGapPara);
  const goalAvgPara = buildGoalAverageParagraph(mySnap.team, oppSnap.team, rng);
  if (goalAvgPara) paragraphs.push(goalAvgPara);
  const topScorerPara = buildTopScorerParagraph(REPORT_TEAM_EN, REPORT_TEAM_KO, pred.oppEn, pred.oppKo, rng);
  if (topScorerPara) paragraphs.push(topScorerPara);
  const gamesInHandPara = buildGamesInHandParagraph(mySnap.team, rng, true);
  if (gamesInHandPara) paragraphs.push(gamesInHandPara);

  // ---- 홈/원정 이점 ----
  paragraphs.push(pickSentence(rng, myIsHome ? [
    ['홈에서 열리는 경기인 만큼 홈 팬들의 응원이 힘을 보탤 수 있다.',
     'Playing at home, Chizumulu should draw extra energy from the crowd.']
  ] : [
    ['원정 경기인 만큼 낯선 환경을 얼마나 잘 극복하느냐가 관건이다.',
     'On the road, how well Chizumulu handle the away-day challenge will be key.'],
    ['원정에서 얼마나 침착하게 경기를 풀어가는지가 이번 승부의 관건이 될 전망이다.',
     'How composed Chizumulu look away from home is likely to be the deciding factor in this one.']
  ]));

  // ---- 승격/강등 판도, 같은 라운드 다른 경기 ----
  const totalTeamsPred = leagueData.length;
  const stakesPara = buildStakesParagraph(null, mySnap.rank, oppSnap.rank, totalTeamsPred, rng, true);
  if (stakesPara) paragraphs.push(stakesPara);
  const currentRanks = {};
  getRankedTeams('all').forEach((t, idx) => { currentRanks[t.nameEn] = idx + 1; });
  const otherFixturesPara = buildOtherFixturesParagraph(
    pred.roundKey, currentRanks, [REPORT_TEAM_EN, pred.oppEn], false, rng
  );
  if (otherFixturesPara) paragraphs.push(otherFixturesPara);

  // ---- 맨 앞: 직전 경기 연결 문단 ("13주차 칠룸바전에서 4-0 대승을 거둔 이후 ...") ----
  const lastM = mySeqAll.filter(m => !m.forfeit).slice(-1)[0];
  if (lastM) {
    const lDiff = lastM.myGoals - lastM.oppGoals;
    const lScore = `${lastM.myGoals}-${lastM.oppGoals}`;
    const lNounKo = lastM.result === 'W' ? (lDiff >= 3 ? '대승을' : '승리를') : (lastM.result === 'D' ? '무승부를' : (lDiff <= -3 ? '대패를' : '패배를'));
    const lNounEn = lastM.result === 'W' ? (lDiff >= 3 ? 'a big win' : 'a win') : (lastM.result === 'D' ? 'a draw' : (lDiff <= -3 ? 'a heavy defeat' : 'a defeat'));
    const oppShortKo = koShort(pred.oppKo);
    const tailKo = myIsHome ? `${koEulReul(oppShortKo)} 홈으로 불러들인다` : `${oppShortKo} 원정에 나선다`;
    const tailEn = myIsHome ? `host ${pred.oppEn}` : `travel to face ${pred.oppEn}`;
    paragraphs.unshift({
      ko: `${wkKo(lastM.weekNum)} ${koShort(lastM.oppKo)}전에서 ${lScore} ${lNounKo} ${lastM.result === 'W' ? '거둔' : '기록한'} 이후 ${wkKo(pred.weekNum)} 상대로 ${tailKo}.`,
      en: `Following ${lNounEn} (${lScore}) against ${lastM.oppEn} in ${wkEn(lastM.weekNum, 'Round', ' ')}, Chizumulu ${tailEn} in ${wkEn(pred.weekNum, 'Round', ' ')}.`
    });
  }

  return paragraphs;
}
