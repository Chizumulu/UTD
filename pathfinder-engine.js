// =====================================================================
// Path Finder Engine — "우승/잔류까지 가장 쉬운 경로 · 가장 안전한 경로"
// =====================================================================
//
// 설계 메모 (왜 이렇게 짰는지)
// ---------------------------------------------------------------------
// 1) 대진이 확인된 잔여 경기는 예정 일정과 완료 라운드 기록을 함께 사용합니다.
//    연기된 경기는 새 편성으로 대체하고, 새 날짜가 없으면 일정 미정으로 남깁니다.
//    대진 자체가 아직 없는 경기 수는 시즌 경기 수와 현재 소화 경기 수로 계산합니다.
//
// 2) 안전 경로는 맞대결 동시 반영 후 경쟁팀별 최대 승점으로 검증합니다.
//    상대 결과를 포함한 경로는 실제 대진에 배정한 결과 조합을 예시로 제공합니다.
//
// 3) 이 파일은 아직 어떤 기존 파일도 건드리지 않은 "순수 로직"입니다. DOM이나
//    렌더링에는 전혀 관여하지 않고, app.js/data.js가 이미 만들어둔 데이터 구조
//    (leagueData, scheduledRounds, roundsData, SEASON_TOTAL_ROUNDS)와 기존
//    getRankedTeams() 결과물의 형태(team.pts, team.played, team.nameEn, ...)를
//    그대로 입력으로 받는 것을 전제로 짰습니다. 실제로 붙일 때는 app.js 안에
//    있는 getRankedTeams()/getMagicNumberContext() 결과를 그대로 넘기면 됩니다.
// =====================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PathFinderEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 라운드 키(roundN) 정렬 유틸 ----
  function roundNumber(key) {
    return parseInt(String(key).replace('round', ''), 10);
  }

  function sortedRoundKeys(roundsObj) {
    return Object.keys(roundsObj || {})
      .filter(k => Number.isFinite(roundNumber(k)))
      .sort((a, b) => roundNumber(a) - roundNumber(b));
  }

  function isPlayed(match) {
    return typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
  }

  function isBye(match) {
    return !!(match.byeKo || match.byeEn);
  }

  function collectLeagueFixtures(scheduledRounds, roundsData) {
    const rows = [];
    const idsByPair = new Map();
    for (const source of [scheduledRounds, roundsData]) {
      for (const key of sortedRoundKeys(source)) {
        for (const match of source[key] || []) {
          if (isBye(match) || !match.homeEn || !match.awayEn) continue;
          const pair = JSON.stringify([match.homeEn, match.awayEn]);
          rows.push({ key, match, pair });
          if (match.fixtureId) {
            if (!idsByPair.has(pair)) idsByPair.set(pair, new Set());
            idsByPair.get(pair).add(match.fixtureId);
          }
        }
      }
    }
    const byFixture = new Map();
    const priority = ({ match }) => match.movedToWeek ? 0 : isPlayed(match) ? 3 : match.movedFromWeek ? 2 : 1;
    for (const row of rows) {
      const ids = idsByPair.get(row.pair);
      // 홈·원정이 같은 대진은 시즌에 한 번입니다. ID가 없는 이전 기록만 대진으로 보완합니다.
      const id = row.match.fixtureId || (ids?.size === 1 ? ids.values().next().value : null);
      const identity = id ? 'id:' + id : 'pair:' + row.pair;
      const existing = byFixture.get(identity);
      if (!existing || priority(row) > priority(existing) ||
          (priority(row) === priority(existing) && roundNumber(row.key) >= roundNumber(existing.key))) {
        byFixture.set(identity, row);
      }
    }
    return Array.from(byFixture.values());
  }

  function remainingFixturesFor(teamEn, leagueFixtures) {
    const fixtures = [];
    for (const { key, match } of leagueFixtures) {
      if (isPlayed(match) && !match.movedToWeek) continue;
      const isHome = match.homeEn === teamEn;
      if (!isHome && match.awayEn !== teamEn) continue;
      const schedulePending = !!(match.postponed || match.movedToWeek || !match.kickoffDate);
      fixtures.push({
        round: roundNumber(key),
        roundKey: key,
        opponentEn: isHome ? match.awayEn : match.homeEn,
        opponentKo: isHome ? match.awayKo : match.homeKo,
        venue: isHome ? 'home' : 'away',
        schedulePending,
        resultPending: !!(match.pendingResult && !match.movedToWeek),
        kickoffDate: schedulePending ? null : match.kickoffDate,
        kickoffTime: schedulePending ? null : match.kickoffTime || null
      });
    }
    return fixtures.sort((a, b) =>
      Number(a.schedulePending) - Number(b.schedulePending) ||
      (a.kickoffDate || '').localeCompare(b.kickoffDate || '') ||
      (a.kickoffTime || '').localeCompare(b.kickoffTime || '') ||
      a.round - b.round);
  }

  function getRemainingFixtures(teamEn, scheduledRounds, roundsData) {
    return remainingFixturesFor(teamEn, collectLeagueFixtures(scheduledRounds, roundsData));
  }

  // ---- 팀의 "남은 경기 수" 전체(스케줄이 아직 안 나온 경기 포함) ----
  function getTotalRemainingGames(team, seasonGames) {
    return Math.max(0, seasonGames - team.played);
  }

  // ---- 상대의 최대 도달 가능 승점 (기존 매직넘버와 동일한 가정: 전승) ----
  function maxPossiblePoints(team, seasonGames) {
    return team.pts + Math.max(0, seasonGames - team.played) * 3;
  }

  // ---- 상대의 최소(가장 비관적/우리에게 유리한) 도달 승점: 남은 경기 전패 ----
  function minPossiblePoints(team) {
    return team.pts; // 이 이상 더 못 딴다고 가정 (남은 경기 전부 패배)
  }

  // ---- 필요 승점을 "몇 승 몇 무"로 환산 ----
  // 승리(3점) 단위로만 올림 처리하면 실제보다 더 많은 승수를 요구하게 되는
  // 경우가 있습니다(예: 남은 목표가 1점이면 무승부 1번으로 충분한데도 무조건
  // 1승이 필요하다고 나오고, 4점이면 1승+1무로 충분한데도 2승이 필요하다고
  // 나옵니다). 나머지(points % 3)가 1일 때만 무승부 1경기로 승리 1경기를
  // 대체할 수 있고, 나머지가 2일 때는 대체가 불가능해 그대로 올림해야 합니다
  // (예: 2점 필요 → 무승부 2번이 아니라 그냥 1승이 더 적은 경기 수로 충분).
  //
  // 주의: 여기서 나온 {wins, draws} 조합도 목표 달성의 "한 가지 예시"일 뿐,
  // 유일한 답은 아닙니다(4점 필요 시 "1승+1무" 대신 "2승"도 가능). 프론트에서
  // 표시할 때는 이 조합을 "반드시 이래야 한다"가 아니라 "이 정도면 충분한
  // 예시 시나리오"로 안내하는 것이 정확합니다.
  function resultsNeededFor(points, remainingGames) {
    if (points <= 0) return { wins: 0, draws: 0, gamesNeeded: 0 };
    const remainder = points % 3;
    let wins, draws;
    if (remainder === 0) {
      wins = points / 3;
      draws = 0;
    } else if (remainder === 1) {
      wins = (points - 1) / 3;
      draws = 1;
    } else {
      // remainder === 2: 무승부로 채우면 오히려 더 많은 경기가 필요해지므로
      // (2점 필요 시 무승부 2번 vs 승리 1번) 그냥 올림한 승수를 그대로 씁니다.
      wins = Math.ceil(points / 3);
      draws = 0;
    }
    const gamesNeeded = wins + draws;
    return gamesNeeded <= remainingGames
      ? { wins: wins, draws: draws, gamesNeeded: gamesNeeded }
      : null; // null = 남은 경기 수만으론 이번 시즌 확정 불가
  }

  // ---- 목표 순위 슬롯 보정 ----
  // title(우승·승격)이면 "상위 slots위 안에 들어야 승격"(slots 생략 시 1위 = 기존 우승),
  // safety면 "상위 slots위 안에 들어야 잔류(=강등 안 당함)".
  // slots가 없거나(undefined/NaN) 상대 팀 수보다 크면 범위 안으로 보정해서
  // 아래 정렬 배열의 인덱스가 undefined가 되는 것을 막습니다.
  // 주의: title 모드에서 넘기는 값은 승격팀 수(LEAGUE_RULES.promote)입니다.
  function resolveSlot(mode, slots, opponentCount) {
    const s = Number.isFinite(slots) ? Math.floor(slots) : 1;
    return Math.min(Math.max(s, 1), opponentCount);
  }

  // ---- 라이벌 결정 (안전 경로용: 기존 매직넘버 로직과 동일) ----
  // "최대 도달 가능 승점"이 slot번째로 높은 팀. 상대가 전승한다는 최악의 가정에서
  // 우리가 넘어야 할 팀입니다. 상대 팀이 하나도 없으면 null.
  // mode: 'title' | 'safety'
  function pickRival(team, rankedTeams, seasonGames, mode, safeSlots) {
    const opponents = rankedTeams.filter(t => t.nameEn !== team.nameEn);
    if (opponents.length === 0) return null;
    const slot = resolveSlot(mode, safeSlots, opponents.length);
    return opponents.slice()
      .sort((a, b) => maxPossiblePoints(b, seasonGames) - maxPossiblePoints(a, seasonGames))
      [slot - 1];
  }

  // ---- 라이벌 결정 (쉬운 경로용) ----
  // 쉬운 경로는 "상대들이 남은 경기에서 더 이상 승점을 못 딴다"는 낙관적 가정이므로,
  // 그때 실제로 우리 앞을 막는 팀은 "최대 승점이 높은 팀"이 아니라 "현재 승점이
  // slot번째로 높은 팀"입니다. (예: A는 현재 40점·잔여 1경기, B는 현재 45점·잔여 0경기
  // 라면 최대 승점 기준으로는 A(43)가 아니라 B(45)가 더 높지만, 어느 쪽이든 '현재 승점'이
  // 가장 높은 B가 우리가 넘어야 할 최소 기준선입니다.) 동점이면 최대 승점이 높은 팀을
  // 앞에 둡니다.
  function pickEasiestRival(team, rankedTeams, seasonGames, mode, safeSlots) {
    const opponents = rankedTeams.filter(t => t.nameEn !== team.nameEn);
    if (opponents.length === 0) return null;
    const slot = resolveSlot(mode, safeSlots, opponents.length);
    return opponents.slice()
      .sort((a, b) =>
        (b.pts - a.pts) ||
        (maxPossiblePoints(b, seasonGames) - maxPossiblePoints(a, seasonGames)))
      [slot - 1];
  }

  // 우리 팀과 특정 상대가 "아직 안 치른 직접 맞대결" 수
  function countHeadToHead(remainingFixtures, rivalEn) {
    return remainingFixtures.filter(fx => fx.opponentEn === rivalEn).length;
  }

  // ---- 라이벌의 남은 알려진 경기 = "의존도 경기" ----
  // 우리 목표(안전 경로 기준 승점)는 "라이벌이 남은 경기를 전부 이긴다"는 가정
  // 위에 서 있으므로, 라이벌의 그 경기들 하나하나가 "안 이기면 우리에게 유리해지는"
  // 카드입니다. 다만 우리와의 직접 맞대결은 이미 우리 쪽 must-win 목록에 들어있는
  // 같은 경기이므로 중복 표시하지 않도록 제외합니다.
  function getRivalDependencyFixtures(rivalEn, ourTeamEn, leagueFixtures) {
    return remainingFixturesFor(rivalEn, leagueFixtures)
      .filter(fx => fx.opponentEn !== ourTeamEn)
      .map(fx => Object.assign({ favorableResult: 'DRAW_OR_LOSS', pointSwing: 3 }, fx));
  }

  // =====================================================================
  // 메인 진입점
  // =====================================================================
  // 입력:
  //   teamEn            - 대상 팀 nameEn (예: "Chizumulu United FC")
  //   mode               - 'title' | 'safety'
  //   rankedTeams        - getRankedTeams('all') 결과 그대로 (team.pts/played/nameEn 필요)
  //   scheduledRounds    - data.js의 scheduledRounds 그대로
  //   seasonGames        - (팀 수-1)*2, 기존 getMagicNumberContext().seasonGames
  //   safeSlots          - mode='safety'면 잔류 슬롯(getMagicNumberContext().safeSlots),
  //                        mode='title'이면 승격팀 수(LEAGUE_RULES.promote, 생략하면 1)
  //   roundsData         - 완료 라운드 기록 (미완료 연기 경기와 재편성 후 결과도 포함)
  //
  // 출력: { mode, rival, remainingGames, safest: {...}, easiest: {...} }
  function rankFits(points, rivals, slots) {
    return Array.from(rivals.values()).filter(value => value >= points).length < slots;
  }

  function findPlan(fixtures, preferred, remaining, rivalEn, test) {
    const combinations = [];
    for (let wins = 0; wins <= remaining; wins++) {
      for (let draws = 0; draws + wins <= remaining; draws++) {
        combinations.push({ wins, draws, gamesNeeded: wins + draws, points: wins * 3 + draws });
      }
    }
    combinations.sort((a, b) => a.points - b.points || a.gamesNeeded - b.gamesNeeded);
    for (const results of combinations) {
      for (const order of [preferred, fixtures]) {
        const selected = new Map(order.slice(0, results.gamesNeeded).map((fx, i) =>
          [fx, i < results.wins ? 'WIN' : 'WIN_OR_DRAW']));
        const outcome = test(results.points, selected);
        if (!outcome) continue;
        const shortfall = results.gamesNeeded - selected.size;
        return {
          pointsNeeded: results.points, resultsNeeded: results,
          mustWinFixtures: fixtures.filter(fx => selected.has(fx)).map(fx => ({
            ...fx, requiredResult: selected.get(fx), isHeadToHead: fx.opponentEn === rivalEn
          })),
          shortfall, note: shortfall ? 'NEEDS_FUTURE_UNSCHEDULED_RESULTS' : null,
          ...outcome
        };
      }
    }
    return { pointsNeeded: null, resultsNeeded: null, mustWinFixtures: [], shortfall: null, note: null };
  }

  function buildOpponentExample(opponents, matches, strategy) {
    const points = new Map(opponents.map(t => [t.nameEn, t.pts]));
    const outcomes = matches.map(({ key, match }) => {
      const home = points.get(match.homeEn), away = points.get(match.awayEn);
      const result = strategy === 'D' ? 'D' : strategy === 'balance' ? (home <= away ? 'H' : 'A') : strategy;
      points.set(match.homeEn, home + (result === 'H' ? 3 : result === 'D' ? 1 : 0));
      points.set(match.awayEn, away + (result === 'A' ? 3 : result === 'D' ? 1 : 0));
      return { round: roundNumber(key), homeEn: match.homeEn, awayEn: match.awayEn, homeKo: match.homeKo, awayKo: match.awayKo, result };
    });
    return { points, outcomes };
  }

  function computePathFinder(teamEn, mode, rankedTeams, scheduledRounds, seasonGames, safeSlots, roundsData) {
    const team = rankedTeams.find(t => t.nameEn === teamEn);
    if (!team) return null;

    const rival = pickRival(team, rankedTeams, seasonGames, mode, safeSlots);
    const easiestRival = pickEasiestRival(team, rankedTeams, seasonGames, mode, safeSlots);
    if (!rival || !easiestRival) return null; // 비교할 상대 팀이 없음
    const leagueFixtures = collectLeagueFixtures(scheduledRounds, roundsData);
    const remainingFixtures = remainingFixturesFor(teamEn, leagueFixtures);
    const remainingGames = getTotalRemainingGames(team, seasonGames);

    const opponents = rankedTeams.filter(t => t.nameEn !== teamEn);
    const slots = resolveSlot(mode, safeSlots, opponents.length);
    const open = leagueFixtures.filter(({ match }) => match.movedToWeek || !isPlayed(match));
    const counts = new Map(rankedTeams.map(t => [t.nameEn, 0]));
    for (const { match } of open) {
      for (const name of [match.homeEn, match.awayEn]) counts.set(name, (counts.get(name) || 0) + 1);
    }
    const fullSchedule = counts.size === rankedTeams.length &&
      rankedTeams.every(t => counts.get(t.nameEn) === getTotalRemainingGames(t, seasonGames));
    const maxPoints = new Map(opponents.map(t => [t.nameEn,
      t.pts + 3 * Math.max(getTotalRemainingGames(t, seasonGames), counts.get(t.nameEn))]));
    const preferred = remainingFixtures.slice().sort((a, b) =>
      (maxPoints.get(b.opponentEn) || 0) - (maxPoints.get(a.opponentEn) || 0));
    // 맞대결은 우리 예상 결과에 따라 상대의 최대 승점에서도 같은 경기 몫을 조정합니다.
    const safest = findPlan(remainingFixtures, preferred, remainingGames, rival.nameEn, (gain, selected) => {
      const ceilings = new Map(maxPoints);
      for (const [fx, result] of selected) {
        if (ceilings.has(fx.opponentEn)) ceilings.set(fx.opponentEn,
          ceilings.get(fx.opponentEn) - (result === 'WIN' ? 3 : 2));
      }
      return rankFits(team.pts + gain, ceilings, slots) ? {} : null;
    });

    // 실제 대진의 경기마다 결과를 하나씩 배정한 조합에 한해 예시를 반환합니다.
    const other = open.filter(({ match }) => match.homeEn !== teamEn && match.awayEn !== teamEn);
    const examples = fullSchedule ? ['D', 'balance', 'H', 'A'].map(strategy =>
      buildOpponentExample(opponents, other, strategy)) : [];
    const easiest = findPlan(remainingFixtures, preferred, remainingGames, easiestRival.nameEn, (gain, selected) => {
      for (const { points, outcomes } of examples) {
        const final = new Map(points);
        for (const fx of remainingFixtures) {
          const result = selected.get(fx);
          const earned = result === 'WIN' ? 0 : result === 'WIN_OR_DRAW' ? 1 : 3;
          final.set(fx.opponentEn, final.get(fx.opponentEn) + earned);
        }
        if (rankFits(team.pts + gain, final, slots)) return { opponentOutcomes: outcomes };
      }
      return null;
    });
    if (!fullSchedule) easiest.note = 'INCOMPLETE_SCHEDULE';

    // 라이벌 의존도 경기
    const rivalDependencyFixtures = getRivalDependencyFixtures(rival.nameEn, teamEn, leagueFixtures);
    const easiestRivalDependencyFixtures = getRivalDependencyFixtures(easiestRival.nameEn, teamEn, leagueFixtures);

    return {
      mode: mode,
      team: { nameEn: team.nameEn, nameKo: team.nameKo, pts: team.pts, played: team.played },
      rival: { nameEn: rival.nameEn, nameKo: rival.nameKo, pts: rival.pts, played: rival.played },
      headToHeadRemaining: countHeadToHead(remainingFixtures, rival.nameEn),
      remainingGames: remainingGames,
      remainingKnownFixtures: remainingFixtures,
      safest,
      easiest: {
        // 쉬운 경로의 기준 팀(현재 승점 기준). 안전 경로의 rival과 다를 수 있음.
        rival: { nameEn: easiestRival.nameEn, nameKo: easiestRival.nameKo, pts: easiestRival.pts, played: easiestRival.played },
        headToHeadRemaining: countHeadToHead(remainingFixtures, easiestRival.nameEn),
        rivalDependencyFixtures: easiestRivalDependencyFixtures,
        ...easiest
      },
      rivalDependencyFixtures: rivalDependencyFixtures
    };
  }

  return {
    computePathFinder: computePathFinder,
    // 아래는 개별 단위 테스트/디버깅 및 향후 확장을 위해 함께 export
    getRemainingFixtures: getRemainingFixtures,
    maxPossiblePoints: maxPossiblePoints,
    minPossiblePoints: minPossiblePoints,
    resultsNeededFor: resultsNeededFor,
    pickRival: pickRival,
    pickEasiestRival: pickEasiestRival
  };
}));
