// =====================================================================
// Path Finder Engine — "우승/잔류까지 가장 쉬운 경로 · 가장 안전한 경로"
// =====================================================================
//
// 설계 메모 (왜 이렇게 짰는지)
// ---------------------------------------------------------------------
// 1) 이 사이트는 scheduledRounds에 "확정 편성된" 라운드만 들어있고(현재 round10~15
//    수준, 시즌 전체 30라운드 중 일부), 나머지 라운드는 아직 대진 자체가 나오지
//    않은 상태입니다. 그래서 "반드시 이겨야 하는 경기(Must-win)" 목록은
//    scheduledRounds에 실제로 존재하는 "알려진 남은 경기"에 한해서만 구체적으로
//    짚어줄 수 있고, 그 너머는 "앞으로 편성될 N경기 중 M승 필요" 식의 집계치로만
//    표현합니다. 새 라운드가 scheduledRounds에 추가될 때마다 이 엔진을 다시
//    돌리면 자동으로 더 구체적인 목록이 나옵니다.
//
// 2) 매직넘버(승점 매직넘버) 로직은 기존 app.js의 getMagicNumberContext /
//    getTeamMagicNumbers와 정확히 같은 가정을 씁니다:
//    "상대가 남은 경기를 전부 이긴다"는 가장 보수적인 가정 + 동률 처리 미정으로
//    인한 +1점. Path Finder는 이 값을 그대로 "안전 경로"의 목표 승점으로 재사용
//    하고, 여기에 "상대가 남은 경기에서 한 경기도 못 딴다"는 정반대의 낙관적
//    가정을 하나 더 만들어서 "쉬운 경로"의 목표 승점으로 씁니다. 그 차이가 곧
//    라이벌 의존도 경기들이 갖는 "가치"입니다.
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

  // ---- 팀 하나가 관련된, scheduledRounds 안의 "아직 안 치른" 경기 목록 ----
  // roundsData(완료 라운드)는 애초에 전부 결과가 있으므로 보지 않아도 되고,
  // scheduledRounds만 보면 됩니다(진행 중 라운드의 이미 끝난 경기는 homeScore/
  // awayScore가 채워져 있으므로 isPlayed()로 걸러집니다).
  function getRemainingFixtures(teamEn, scheduledRounds) {
    const fixtures = [];
    sortedRoundKeys(scheduledRounds).forEach(key => {
      (scheduledRounds[key] || []).forEach(match => {
        if (isBye(match) || isPlayed(match)) return;
        const isHome = match.homeEn === teamEn;
        const isAway = match.awayEn === teamEn;
        if (!isHome && !isAway) return;
        fixtures.push({
          round: roundNumber(key),
          roundKey: key,
          opponentEn: isHome ? match.awayEn : match.homeEn,
          opponentKo: isHome ? match.awayKo : match.homeKo,
          venue: isHome ? 'home' : 'away',
          kickoffDate: match.kickoffDate || null,
          kickoffTime: match.kickoffTime || null
        });
      });
    });
    return fixtures;
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

  // ---- 라이벌 결정 (기존 매직넘버 로직과 동일) ----
  // mode: 'title' | 'safety'
  function pickRival(team, rankedTeams, seasonGames, mode, safeSlots) {
    const opponents = rankedTeams.filter(t => t.nameEn !== team.nameEn);
    if (mode === 'title') {
      return opponents.reduce((best, other) =>
        maxPossiblePoints(other, seasonGames) > maxPossiblePoints(best, seasonGames) ? other : best
      );
    }
    // safety: safeSlots번째로 최대승점이 높은 팀 = 우리가 넘어야 할 강등권 경계선 팀
    return opponents.slice()
      .sort((a, b) => maxPossiblePoints(b, seasonGames) - maxPossiblePoints(a, seasonGames))
      [safeSlots - 1];
  }

  // ---- 남은 알려진 경기 중, 목표 달성에 필요한 결과(승/무)만큼을 예시 경로로 표시 ----
  // 어느 경기에서 어떤 결과를 내야 하는지는 사실 수학적으로는 "어느 조합이든
  // 승점 합만 채우면" 되므로 유일하지 않습니다. 다만 실전에서 쓸모 있으려면
  // 하나의 구체적인 목록이 필요하므로, "가장 이른 라운드부터 순서대로" 필요한
  // 경기 수만큼을 채우는 방식으로 하나의 기준 경로를 제시합니다. 그 중 앞의
  // wins개 경기는 승리가 필요한 경기로, 남은 draws개 경기는 무승부만으로도
  // 충분한 경기로 표시합니다(requiredResult). 상대가 라이벌 팀 본인인 "직접
  // 맞대결"은 승점 스윙이 두 배(우리 +3, 상대는 승점 못 얻음)이므로 별도 표시.
  //
  // isActuallyMandatory: 필요한 경기 수(gamesNeeded)가 "이 시즌 남은 전체
  // 경기 수(remainingGames)"와 정확히 같아서 단 한 경기도 미끄러질 여유가
  // 없는 경우에만 true입니다. 이때만 "이 경기들은 진짜로 다 이겨야 한다"고
  // 말할 수 있고, 그 외에는 아래 목록이 여러 유효한 경로 중 하나의 예시일
  // 뿐이므로 프론트에서 "필수(Must-Win)"보다 "가장 빠른 조기 확정 시나리오"
  // 같은 톤으로 안내하는 것이 정확합니다.
  function buildMustWinPlan(remainingFixtures, resultsNeeded, rivalEn, remainingGames) {
    if (resultsNeeded === null) {
      return {
        fixtures: [],
        shortfall: null,
        note: 'NOT_CLINCHABLE_BY_RESULTS_ALONE',
        isActuallyMandatory: false
      };
    }
    const gamesNeeded = resultsNeeded.gamesNeeded;
    const known = remainingFixtures.slice(0, gamesNeeded).map((fx, idx) => Object.assign({
      isHeadToHead: fx.opponentEn === rivalEn,
      requiredResult: idx < resultsNeeded.wins ? 'WIN' : 'WIN_OR_DRAW'
    }, fx));
    const shortfall = Math.max(0, gamesNeeded - remainingFixtures.length);
    const isActuallyMandatory = shortfall === 0 && gamesNeeded === remainingGames;
    return {
      fixtures: known,
      shortfall: shortfall,
      note: shortfall > 0 ? 'NEEDS_FUTURE_UNSCHEDULED_RESULTS' : null,
      isActuallyMandatory: isActuallyMandatory
    };
  }

  // ---- 라이벌의 남은 알려진 경기 = "의존도 경기" ----
  // 우리 목표(안전 경로 기준 승점)는 "라이벌이 남은 경기를 전부 이긴다"는 가정
  // 위에 서 있으므로, 라이벌의 그 경기들 하나하나가 "안 이기면 우리에게 유리해지는"
  // 카드입니다. 다만 우리와의 직접 맞대결은 이미 우리 쪽 must-win 목록에 들어있는
  // 같은 경기이므로 중복 표시하지 않도록 제외합니다.
  function getRivalDependencyFixtures(rivalEn, ourTeamEn, scheduledRounds) {
    return getRemainingFixtures(rivalEn, scheduledRounds)
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
  //   safeSlots          - 기존 getMagicNumberContext().safeSlots (mode='safety'일 때만 사용)
  //
  // 출력: { mode, rival, remainingGames, safest: {...}, easiest: {...} }
  function computePathFinder(teamEn, mode, rankedTeams, scheduledRounds, seasonGames, safeSlots) {
    const team = rankedTeams.find(t => t.nameEn === teamEn);
    if (!team) return null;

    const rival = pickRival(team, rankedTeams, seasonGames, mode, safeSlots);
    const remainingFixtures = getRemainingFixtures(teamEn, scheduledRounds);
    const remainingGames = getTotalRemainingGames(team, seasonGames);

    // 안전 경로: 라이벌이 남은 경기를 전부 이긴다고 가정 (기존 매직넘버와 동일)
    const safestPointsNeeded = Math.max(0, maxPossiblePoints(rival, seasonGames) - team.pts + 1);
    const safestResults = resultsNeededFor(safestPointsNeeded, remainingGames);
    const safestPlan = buildMustWinPlan(remainingFixtures, safestResults, rival.nameEn, remainingGames);

    // 쉬운 경로: 라이벌이 남은 경기를 전부 못 딴다고 가정 (가장 낙관적인 하한)
    const easiestPointsNeeded = Math.max(0, minPossiblePoints(rival) - team.pts + 1);
    const easiestResults = resultsNeededFor(easiestPointsNeeded, remainingGames);
    const easiestPlan = buildMustWinPlan(remainingFixtures, easiestResults, rival.nameEn, remainingGames);

    // 라이벌 의존도 경기 (쉬운 경로가 안전 경로보다 실제로 덜 요구할 때만 의미 있음)
    const rivalDependencyFixtures = getRivalDependencyFixtures(rival.nameEn, teamEn, scheduledRounds);

    return {
      mode: mode,
      team: { nameEn: team.nameEn, nameKo: team.nameKo, pts: team.pts, played: team.played },
      rival: { nameEn: rival.nameEn, nameKo: rival.nameKo, pts: rival.pts, played: rival.played },
      remainingGames: remainingGames,
      remainingKnownFixtures: remainingFixtures,
      safest: {
        pointsNeeded: safestPointsNeeded,
        resultsNeeded: safestResults, // { wins, draws, gamesNeeded } | null
        mustWinFixtures: safestPlan.fixtures,
        shortfall: safestPlan.shortfall,
        note: safestPlan.note,
        isActuallyMandatory: safestPlan.isActuallyMandatory
      },
      easiest: {
        pointsNeeded: easiestPointsNeeded,
        resultsNeeded: easiestResults, // { wins, draws, gamesNeeded } | null
        mustWinFixtures: easiestPlan.fixtures,
        shortfall: easiestPlan.shortfall,
        note: easiestPlan.note,
        isActuallyMandatory: easiestPlan.isActuallyMandatory
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
    pickRival: pickRival
  };
}));
