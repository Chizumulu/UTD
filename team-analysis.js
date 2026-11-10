// =====================================================================
// Team Analysis — 구단정보 "전력분석" 탭
// =====================================================================
//
// 구성 (위에서 아래 순서 = 화면 순서)
//   1) 상대 유형별 성적      : 현재 순위 기준 상위/중위/하위권 상대 + 홈/원정 성적
//   2) 득점 패턴            : 도움 → 득점 연결 그래프 + (app.js 카드) 최강 콤비·합작률·전체 콤비 표·포지션별 득점/도움
//   3) 상대별 한 장 리포트   : 상대 하나를 골라 폼·득실·득점원·맞대결을 한 카드로
//   4) 교체 활용 현황        : 교체 투입 선수의 득점·도움, 교체 인원별 성적 + (app.js 카드) 선발 대비 교체 비율
//   5) 선발 조합·포메이션    : 포메이션별 성적, 포지션별 주전 고정도, 라인업 변동, 유닛 조합
//                            + (app.js 카드) 핵심 선수 영향도, 선발 조합 효과
//
// 설계 메모
// ---------------------------------------------------------------------
// - pathfinder-engine.js 와 같은 방식의 "순수 로직" 파일입니다. app.js 의 전역(leagueData,
//   roundsData, matchLineups ...)을 직접 읽지 않고, 아래 ctx 로 전부 넘겨받습니다.
//     ctx = {
//       myEn,            // 우리 팀 영문명 ('Chizumulu United FC')
//       isKorean,        // 화면 언어
//       rankedTeams,     // getRankedTeams('all') 결과 (nameEn/nameKo/pts/played/won/drawn/goalsFor/goalsAgainst)
//       roundsData, scheduledRounds, matchLineups, squadData,
//       topScorers,      // topScorersData (득점 순위, teamEn 포함)
//       assistCombos,    // (선택) data.js computeAssistCombos() 결과. 있으면 득점 네트워크가 이 값을 그대로 씁니다
//                        //   → 구단정보 다른 화면과 합작 수치가 항상 같고, 방출 선수 statKey('F9')도 구분됩니다
//       extraSections,   // (선택) { scoring, subs, lineup } app.js 가 만든 카드 HTML. 각 섹션 바로 아래에 붙습니다
//       roundLabel       // (roundKey) => "16주차" 같은 화면용 이름 (없으면 N주차)
//     }
// - 기록이 없는 항목은 0으로 채우지 않고 "기록 없음"으로 구분합니다. 라인업 이미지에 교체
//   정보가 없어서 subsIn 이 비어 있는 경기는 "교체가 없었다"가 아니라 "미입력"일 수 있습니다.
// - 몰수 경기(forfeit)는 내용 없는 3:0이므로 성적·득실 통계에서 제외하고 각주로만 알립니다.
// - 라운드 키(roundN)가 연기경기주차 때문에 화면 주차 번호와 다를 수 있어서, 화면에 찍는
//   주차 이름은 항상 ctx.roundLabel 로 만듭니다.
// =====================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TeamAnalysis = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------------
  // 공통 유틸
  // ---------------------------------------------------------------------
  function rn(key) { return parseInt(String(key).replace('round', ''), 10); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function sortedKeys(obj) {
    return Object.keys(obj || {})
      .filter(function (k) { return isFinite(rn(k)); })
      .sort(function (a, b) { return rn(a) - rn(b); });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function fmt2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function pct(n) { return Math.round(n * 100) + '%'; }
  function shortTeam(name) { return String(name || '').replace(/\s*FC$/i, '').trim(); }
  // 선수 식별 키: 방출 선수는 'F9' 같은 statKey, 현역은 등번호. 번호만 쓰면 방출 F9 와 현역 9번이 합쳐집니다.
  function refOf(p) { return p.statKey || p.number; }
  function isRef(v) { return isNum(v) || (typeof v === 'string' && v !== ''); }
  function cmpRef(a, b) {
    var na = isNum(a), nb = isNum(b);
    if (na && nb) return a - b;
    if (na !== nb) return na ? -1 : 1;   // 현역(번호) 먼저, 방출(F키) 뒤
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }
  function sortedNums(arr) { return arr.slice().sort(cmpRef); }

  function lang(ctx) { return function (ko, en) { return ctx.isKorean ? ko : en; }; }
  function roundName(ctx, key) {
    return typeof ctx.roundLabel === 'function'
      ? ctx.roundLabel(key)
      : (lang(ctx)(rn(key) + '주차', 'Week ' + rn(key)));
  }

  // 경기 수가 이 값 미만이면 "표본 적음" 표시를 붙이고 문장을 단정적으로 쓰지 않습니다.
  var SMALL_SAMPLE = 5;
  function smallBadge(ctx, n) {
    return n < SMALL_SAMPLE
      ? ' <span class="ta-badge" title="' + esc(lang(ctx)('경기 수가 ' + SMALL_SAMPLE + '경기 미만이라 우연의 영향이 큽니다', 'Fewer than ' + SMALL_SAMPLE + ' games — results are noisy')) + '">' + lang(ctx)('표본 적음', 'Small sample') + '</span>'
      : '';
  }
  // 상대 유형 중 가장 강한/고전한 유형 (경기 2 이상인 유형만 비교)
  function tierExtremes(data) {
    var played = data.tiers.tiers.filter(function (x) { return x.agg.g >= 2; });
    if (played.length < 2) return null;
    var best = played.slice().sort(function (a, b) { return b.agg.ppg - a.agg.ppg; })[0];
    var worst = played.slice().sort(function (a, b) { return a.agg.ppg - b.agg.ppg; })[0];
    if (best === worst || best.agg.ppg === worst.agg.ppg) return null;
    return { best: best, worst: worst, small: Math.min(best.agg.g, worst.agg.g) < SMALL_SAMPLE };
  }

  function resOf(gf, ga) { return gf > ga ? 'W' : (gf < ga ? 'L' : 'D'); }

  function aggregate(list) {
    var a = { g: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
    list.forEach(function (x) {
      a.g++; a.gf += x.gf; a.ga += x.ga;
      if (x.res === 'W') a.w++; else if (x.res === 'D') a.d++; else a.l++;
    });
    a.pts = a.w * 3 + a.d;
    a.ppg = a.g ? a.pts / a.g : 0;
    a.eff = a.g ? a.pts / (a.g * 3) : 0;
    a.gfpg = a.g ? a.gf / a.g : 0;
    a.gapg = a.g ? a.ga / a.g : 0;
    return a;
  }

  // ---------------------------------------------------------------------
  // 경기 목록 만들기
  // ---------------------------------------------------------------------
  // roundsData(완료 라운드) + scheduledRounds(진행 중 라운드에서 이미 스코어가 들어온 경기)
  // 에서 "결과가 있는 경기"를 전부 모읍니다. 같은 roundKey 가 두 곳에 있으면 roundsData 우선.
  function collectPlayedMatches(ctx) {
    var out = [];
    var seen = {};
    [ctx.roundsData, ctx.scheduledRounds].forEach(function (src) {
      sortedKeys(src).forEach(function (key) {
        if (seen[key]) return;
        var played = false;
        (src[key] || []).forEach(function (m) {
          if (m.byeKo || m.byeEn) return;
          if (!isNum(m.homeScore) || !isNum(m.awayScore)) return;
          played = true;
          out.push({ roundKey: key, round: rn(key), m: m });
        });
        if (played || src === ctx.roundsData) seen[key] = true;
      });
    });
    return out;
  }

  function gameFromMatch(entry, teamEn) {
    var m = entry.m;
    var home = m.homeEn === teamEn, away = m.awayEn === teamEn;
    if (!home && !away) return null;
    var gf = home ? m.homeScore : m.awayScore;
    var ga = home ? m.awayScore : m.homeScore;
    return {
      roundKey: entry.roundKey, round: entry.round, home: home,
      oppEn: home ? m.awayEn : m.homeEn,
      oppKo: home ? m.awayKo : m.homeKo,
      gf: gf, ga: ga, res: resOf(gf, ga),
      forfeit: !!m.forfeit, date: m.kickoffDate || null
    };
  }

  function buildGames(ctx, teamEn, withLineups) {
    var games = [];
    collectPlayedMatches(ctx).forEach(function (e) {
      var g = gameFromMatch(e, teamEn);
      if (g) games.push(g);
    });
    if (withLineups) {
      var perKey = {};
      games.forEach(function (g) { perKey[g.roundKey] = (perKey[g.roundKey] || 0) + 1; });
      games.forEach(function (g) {
        var lu = (ctx.matchLineups || {})[g.roundKey];
        if (!lu) return;
        // 같은 주차에 우리 경기가 둘(예: 연기경기주차)이면 상대 이름으로 짝을 맞춥니다.
        if (lu.opponentKo === g.oppKo || (perKey[g.roundKey] === 1 && !g.forfeit)) g.lineup = lu;
      });
    }
    return games;
  }

  function rankInfo(ctx) {
    var map = {};
    var list = ctx.rankedTeams || [];
    list.forEach(function (t, i) { map[t.nameEn] = i + 1; });
    // 상대 유형은 우리 팀을 뺀 팀들로 3등분합니다(우리가 상위권이어도 상위권 상대가 줄어들지 않게).
    var others = list.filter(function (t) { return t.nameEn !== ctx.myEn; });
    var n = others.length;
    var third = Math.ceil(n / 3);
    var pos = {};   // 우리 팀을 뺀 순번
    others.forEach(function (t, i) { pos[t.nameEn] = i + 1; });
    function tierOf(en) {
      var r = pos[en];
      if (!r) return null;
      if (r <= third) return 'top';
      if (r > n - third) return 'bottom';
      return 'mid';
    }
    // 화면에 찍는 순위 범위는 실제 리그 순위(우리 팀 자리 포함)로 보여줍니다.
    function rangeOf(key) {
      var ranks = others.filter(function (t) { return tierOf(t.nameEn) === key; })
        .map(function (t) { return map[t.nameEn]; });
      return ranks.length ? { from: Math.min.apply(null, ranks), to: Math.max.apply(null, ranks), n: ranks.length } : null;
    }
    return { map: map, total: list.length, othersTotal: n, third: third, tierOf: tierOf, rangeOf: rangeOf };
  }

  // ---------------------------------------------------------------------
  // 선수 이름 표시 (등번호 → 이름)
  // ---------------------------------------------------------------------
  function makeNamer(ctx) {
    var byNum = {};
    (ctx.squadData || []).forEach(function (p) { byNum[p.number] = p; });
    // 방출 선수는 'F'+번호 키로 별도 등록해 같은 번호의 현역 선수와 이름이 섞이지 않게 합니다.
    (ctx.formerSquadData || []).forEach(function (p) { byNum['F' + p.number] = p; });
    // 라인업에만 나오는 선수(방출 등)도 이름을 찾도록 라인업 이름을 보조로 씁니다.
    Object.keys(ctx.matchLineups || {}).forEach(function (k) {
      var lu = ctx.matchLineups[k];
      (lu.starters || []).concat(lu.subsIn || []).forEach(function (p) {
        var k = p.statKey || p.number;   // 방출 선수는 'F9' 같은 statKey 로 현역 선수와 구분
        if (!byNum[k] && p.nameKo) byNum[k] = { number: p.number, nameKo: p.nameKo, nameEn: p.nameEn };
      });
    });
    var firstKo = {};
    Object.keys(byNum).forEach(function (n) {
      var f = String(byNum[n].nameKo || '').split(/\s+/)[0];
      firstKo[f] = (firstKo[f] || 0) + 1;
    });
    return function (num, full) {
      var p = byNum[num];
      if (!p) return '#' + num;
      if (ctx.isKorean) {
        var ko = String(p.nameKo || '#' + num);
        var f = ko.split(/\s+/)[0];
        return (full || firstKo[f] > 1) ? ko : f;
      }
      var en = String(p.nameEn || p.nameKo || '#' + num);
      return full ? en : en.split(/\s+/)[0];
    };
  }

  // =====================================================================
  // 1) 상대 유형별 성적
  // =====================================================================
  function computeOpponentTiers(ctx, games) {
    var ri = rankInfo(ctx);
    var real = games.filter(function (g) { return !g.forfeit; });
    var forfeits = games.length - real.length;
    var tiers = ['top', 'mid', 'bottom'].map(function (key) {
      var list = real.filter(function (g) { return ri.tierOf(g.oppEn) === key; });
      var rg = ri.rangeOf(key) || { from: 0, to: 0, n: 0 };
      return { key: key, from: rg.from, to: rg.to, teams: rg.n, list: list, agg: aggregate(list) };
    });
    return {
      tiers: tiers,
      home: aggregate(real.filter(function (g) { return g.home; })),
      away: aggregate(real.filter(function (g) { return !g.home; })),
      all: aggregate(real),
      forfeits: forfeits,
      rank: ri
    };
  }

  // =====================================================================
  // 2) 득점 패턴 네트워크
  // =====================================================================
  function playersOf(lu) { return (lu.starters || []).concat(lu.subsIn || []); }

  // 원형 배치는 노드가 많으면 라벨이 겹칩니다. 이 값을 넘으면 상위 NETWORK_TOP_N 명만 그리고 나머지는 "기타"로 묶습니다.
  var NETWORK_MAX_NODES = 15;
  var NETWORK_TOP_N = 12;
  var OTHER_KEY = '__other';

  function groupNetworkNodes(nw) {
    if (nw.nodes.length <= NETWORK_MAX_NODES) return { nodes: nw.nodes, edges: nw.edges, grouped: 0, total: nw.nodes.length };
    var kept = nw.nodes.slice(0, NETWORK_TOP_N);      // nodes 는 (득점+도움) 순으로 이미 정렬돼 있음
    var rest = nw.nodes.slice(NETWORK_TOP_N);
    var keepSet = {};
    kept.forEach(function (nd) { keepSet[nd.number] = true; });
    var other = { number: OTHER_KEY, label: '+' + rest.length, other: true, members: rest.length, goals: 0, assists: 0, unassisted: 0 };
    rest.forEach(function (nd) { other.goals += nd.goals; other.assists += nd.assists; other.unassisted += nd.unassisted; });
    var merged = {};
    nw.edges.forEach(function (e) {
      var f = keepSet[e.from] ? e.from : OTHER_KEY, t = keepSet[e.to] ? e.to : OTHER_KEY;
      if (f === OTHER_KEY && t === OTHER_KEY) return;   // 기타 안에서 오간 연결은 그리지 않음
      var k = f + '>' + t;
      if (!merged[k]) merged[k] = { from: f, to: t, count: 0 };
      merged[k].count += e.count;
    });
    var edges = Object.keys(merged).map(function (k) { return merged[k]; }).sort(function (a, b) { return b.count - a.count; });
    return { nodes: kept.concat([other]), edges: edges, grouped: rest.length, total: nw.nodes.length };
  }

  function computeScoringNetwork(ctx) {
    var edges = {};       // 'a>b' → { from, to, count }
    var unassisted = {};  // scorer → count
    var goalsBy = {}, assistsBy = {}, receivedBy = {};
    var totalGoals = 0, assisted = 0;
    var shared = ctx.assistCombos || null;   // data.js computeAssistCombos() 결과(있으면 합작 수치의 단일 출처)
    Object.keys(ctx.matchLineups || {}).forEach(function (key) {
      var lu = ctx.matchLineups[key];
      playersOf(lu).forEach(function (p) {
        var who = p.statKey || p.number;   // 방출 선수('F9')가 같은 번호의 현역 선수와 합쳐지지 않도록
        (p.goals || []).forEach(function (g, i) {
          totalGoals++;
          goalsBy[who] = (goalsBy[who] || 0) + 1;
          if (shared) return;
          var a = (p.assists || [])[i];
          if (isRef(a)) {
            assisted++;
            assistsBy[a] = (assistsBy[a] || 0) + 1;
            receivedBy[who] = (receivedBy[who] || 0) + 1;
            var k = a + '>' + who;
            if (!edges[k]) edges[k] = { from: a, to: who, count: 0 };
            edges[k].count++;
          } else {
            unassisted[who] = (unassisted[who] || 0) + 1;
          }
        });
      });
    });
    if (shared) {
      assisted = shared.assistedGoals || 0;
      (shared.combos || []).forEach(function (c) {
        edges[c.from + '>' + c.to] = { from: c.from, to: c.to, count: c.count };
        assistsBy[c.from] = (assistsBy[c.from] || 0) + c.count;
        receivedBy[c.to] = (receivedBy[c.to] || 0) + c.count;
      });
      Object.keys(goalsBy).forEach(function (n) {
        unassisted[n] = Math.max(0, goalsBy[n] - (receivedBy[n] || 0));
      });
    }
    var nodeSet = {};
    Object.keys(goalsBy).forEach(function (n) { nodeSet[n] = true; });
    Object.keys(assistsBy).forEach(function (n) { nodeSet[n] = true; });
    var nodes = Object.keys(nodeSet).map(function (n) {
      return {
        number: /^\d+$/.test(n) ? Number(n) : n,       // 'F9' 같은 키는 문자열 그대로
        label: String(n).replace(/^F/, ''),            // 화면에는 등번호만
        goals: goalsBy[n] || 0, assists: assistsBy[n] || 0,
        unassisted: unassisted[n] || 0
      };
    }).sort(function (a, b) {
      return (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals ||
        (Number(a.label) - Number(b.label)) || String(a.number).localeCompare(String(b.number));
    });
    var edgeList = Object.keys(edges).map(function (k) { return edges[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    return {
      nodes: nodes, edges: edgeList,
      totalGoals: totalGoals, assisted: assisted,
      unassistedTotal: totalGoals - assisted
    };
  }

  // 득점 시간(분) 입력률. 라인업의 goals 항목은 "8'", "45+3'" 처럼 쓰고, 모르면 "-" 입니다.
  var GOAL_TIME_MIN_SHARE = 0.6;   // 이 비율 이상 입력돼야 시간대 분포를 보여줍니다.
  var GOAL_BANDS = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75], [76, 999]];
  function parseGoalMinute(v) {
    var m = /^\s*(\d{1,3})(?:\s*\+\s*\d+)?\s*'?\s*$/.exec(String(v == null ? '' : v));
    return m ? parseInt(m[1], 10) : null;
  }
  function computeGoalTimes(ctx) {
    var total = 0, timed = 0, bands = GOAL_BANDS.map(function () { return 0; });
    var missing = {};   // roundKey → 시간이 빠진 골 수
    Object.keys(ctx.matchLineups || {}).forEach(function (key) {
      playersOf(ctx.matchLineups[key]).forEach(function (p) {
        (p.goals || []).forEach(function (g) {
          total++;
          var m = parseGoalMinute(g);
          if (m === null || m < 1) { missing[key] = (missing[key] || 0) + 1; return; }
          timed++;
          for (var i = 0; i < GOAL_BANDS.length; i++) {
            if (m >= GOAL_BANDS[i][0] && m <= GOAL_BANDS[i][1]) { bands[i]++; break; }
          }
        });
      });
    });
    var missingKeys = Object.keys(missing).sort(function (a, b) { return rn(a) - rn(b); });
    return { total: total, timed: timed, share: total ? timed / total : 0, bands: bands, missingKeys: missingKeys, ready: total > 0 && timed / total >= GOAL_TIME_MIN_SHARE };
  }

  // =====================================================================
  // 3) 상대별 한 장 리포트
  // =====================================================================
  function leagueGoalAverages(ctx) {
    var goals = 0, teamGames = 0, blanks = 0;
    collectPlayedMatches(ctx).forEach(function (e) {
      if (e.m.forfeit) return;
      goals += e.m.homeScore + e.m.awayScore;
      teamGames += 2;
      if (e.m.homeScore === 0) blanks++;
      if (e.m.awayScore === 0) blanks++;
    });
    // 한 경기에서 한 팀이 무득점이면 상대는 무실점이므로, 리그 전체로는 무득점 비율 = 무실점 비율입니다.
    return {
      gpg: teamGames ? goals / teamGames : 0,
      csRate: teamGames ? blanks / teamGames : 0,
      ftsRate: teamGames ? blanks / teamGames : 0
    };
  }

  function nextFixtureAgainst(ctx, oppEn) {
    var keys = sortedKeys(ctx.scheduledRounds);
    for (var i = 0; i < keys.length; i++) {
      var list = ctx.scheduledRounds[keys[i]] || [];
      for (var j = 0; j < list.length; j++) {
        var m = list[j];
        if (m.byeKo || m.byeEn || m.postponed) continue;
        if (isNum(m.homeScore) && isNum(m.awayScore)) continue;
        var meHome = m.homeEn === ctx.myEn, meAway = m.awayEn === ctx.myEn;
        if (!meHome && !meAway) continue;
        var opp = meHome ? m.awayEn : m.homeEn;
        if (oppEn && opp !== oppEn) continue;
        return {
          roundKey: keys[i], oppEn: opp, oppKo: meHome ? m.awayKo : m.homeKo,
          meHome: meHome, date: m.kickoffDate || null, time: m.kickoffTime || null
        };
      }
    }
    return null;
  }

  function computeOpponentReport(ctx, oppEn, myGames) {
    var team = (ctx.rankedTeams || []).filter(function (t) { return t.nameEn === oppEn; })[0];
    if (!team) return null;
    var ri = rankInfo(ctx);
    var all = buildGames(ctx, oppEn, false);
    var real = all.filter(function (g) { return !g.forfeit; });
    var recent = real.slice(-5);
    var agg = aggregate(real);
    var home = aggregate(real.filter(function (g) { return g.home; }));
    var away = aggregate(real.filter(function (g) { return !g.home; }));
    var cs = real.filter(function (g) { return g.ga === 0; }).length;
    var fts = real.filter(function (g) { return g.gf === 0; }).length;
    var scorers = (ctx.topScorers || [])
      .filter(function (s) { return s.teamEn === oppEn; })
      .slice(0, 3);
    var h2h = myGames.filter(function (g) { return g.oppEn === oppEn; });
    var next = nextFixtureAgainst(ctx, oppEn);
    var tierKey = ri.tierOf(oppEn);
    var tierAgg = aggregate(myGames.filter(function (g) {
      return !g.forfeit && ri.tierOf(g.oppEn) === tierKey;
    }));
    return {
      team: team, rank: ri.map[oppEn], total: ri.total, tierKey: tierKey,
      agg: agg, home: home, away: away, recent: recent,
      cleanSheets: cs, failedToScore: fts,
      scorers: scorers, h2h: h2h, next: next,
      forfeits: all.length - real.length,
      myTierAgg: tierAgg,
      league: leagueGoalAverages(ctx)
    };
  }

  // =====================================================================
  // 4) 교체 활용 현황 (인과가 아니라 서술: 뒤지는 경기에서 교체를 더 쓰는 경향이 섞여 있음)
  // =====================================================================
  function computeSubstitutions(ctx, games) {
    var withLu = games.filter(function (g) { return g.lineup && !g.forfeit; });
    var perPlayer = {};
    var inMin = { first: 0, second: 0, unknown: 0 };
    var totalGoals = 0, subGoals = 0, subAssists = 0, subApps = 0;
    var recordedGames = 0;
    var buckets = { none: [], unknown: [], few: [], many: [] };

    withLu.forEach(function (g) {
      var lu = g.lineup;
      var subs = lu.subsIn || [];
      var subSet = {};
      subs.forEach(function (s) { subSet[refOf(s)] = s; });
      // 교체 0명은 벤치 명단(subsUnused)이 입력돼 있을 때만 "0명 확정"으로 봅니다. 둘 다 비어 있으면 미입력.
      var confirmedNone = subs.length === 0 && (lu.subsUnused || []).length > 0;
      if (subs.length || confirmedNone) recordedGames++;
      buckets[subs.length === 0 ? (confirmedNone ? 'none' : 'unknown') : (subs.length <= 3 ? 'few' : 'many')].push(g);
      subs.forEach(function (s) {
        subApps++;
        var sk = refOf(s);
        var pp = perPlayer[sk] || (perPlayer[sk] = { key: sk, number: s.number, apps: 0, goals: 0, assists: 0 });
        pp.apps++;
        pp.goals += (s.goals || []).length;
        if (/전반/.test(s.inMin || '')) inMin.first++;
        else if (/후반/.test(s.inMin || '')) inMin.second++;
        else inMin.unknown++;
      });
      playersOf(lu).forEach(function (p) {
        (p.goals || []).forEach(function (_, i) {
          totalGoals++;
          if (subSet[refOf(p)]) subGoals++;
          var a = (p.assists || [])[i];
          if (isRef(a) && subSet[a]) {
            subAssists++;
            perPlayer[a].assists++;
          }
        });
      });
    });

    var players = Object.keys(perPlayer).map(function (k) { return perPlayer[k]; })
      .sort(function (a, b) {
        return (b.goals + b.assists) - (a.goals + a.assists) || b.apps - a.apps || cmpRef(a.key, b.key);
      });
    return {
      matches: withLu.length, recordedGames: recordedGames, subApps: subApps,
      avgSubs: recordedGames ? subApps / recordedGames : 0,
      totalGoals: totalGoals, subGoals: subGoals, subAssists: subAssists,
      inMin: inMin, players: players,
      buckets: {
        none: aggregate(buckets.none), unknown: aggregate(buckets.unknown), few: aggregate(buckets.few), many: aggregate(buckets.many)
      }
    };
  }

  // =====================================================================
  // 5) 선발 조합·포메이션
  // =====================================================================
  var POS_ORDER = ['GK', 'LB', 'LWB', 'LCB', 'CB', 'RCB', 'RB', 'RWB', 'CDM', 'LDM', 'RDM',
    'LCM', 'CM', 'RCM', 'LM', 'RM', 'CAM', 'LW', 'RW', 'LF', 'RF', 'SS', 'CF', 'ST'];
  var UNIT_POS = {
    def: ['GK', 'LB', 'LWB', 'LCB', 'CB', 'RCB', 'RB', 'RWB'],
    mid: ['CDM', 'LDM', 'RDM', 'LCM', 'CM', 'RCM', 'LM', 'RM', 'CAM'],
    att: ['LW', 'RW', 'LF', 'RF', 'SS', 'CF', 'ST']
  };

  function computeLineupAnalysis(ctx, games) {
    var withLu = games.filter(function (g) { return g.lineup && !g.forfeit; });
    var seq = withLu.slice().sort(function (a, b) { return a.round - b.round; });

    // 포메이션별 성적
    var byForm = {};
    withLu.forEach(function (g) {
      var f = g.lineup.formation || '-';
      (byForm[f] = byForm[f] || []).push(g);
    });
    var formations = Object.keys(byForm).map(function (f) {
      return { formation: f, agg: aggregate(byForm[f]) };
    }).sort(function (a, b) { return b.agg.g - a.agg.g; });

    // 포지션별 주전 고정도
    var slotMap = {};
    withLu.forEach(function (g) {
      (g.lineup.starters || []).forEach(function (p) {
        var s = slotMap[p.pos] || (slotMap[p.pos] = { pos: p.pos, total: 0, by: {} });
        s.total++;
        var pk = refOf(p);
        s.by[pk] = (s.by[pk] || 0) + 1;
      });
    });
    var slots = Object.keys(slotMap).map(function (pos) {
      var s = slotMap[pos];
      var players = Object.keys(s.by).map(function (n) { var k = /^\d+$/.test(n) ? Number(n) : n; return { key: k, count: s.by[n] }; })
        .sort(function (a, b) { return b.count - a.count || cmpRef(a.key, b.key); });
      return { pos: pos, total: s.total, players: players, share: players[0].count / s.total };
    }).sort(function (a, b) {
      var ia = POS_ORDER.indexOf(a.pos), ib = POS_ORDER.indexOf(b.pos);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    // 직전 경기 대비 선발 변경 인원
    var changes = [];
    for (var i = 0; i < seq.length; i++) {
      var cur = (seq[i].lineup.starters || []).map(refOf);
      var item = { game: seq[i], changes: null, ins: [], outs: [] };
      if (i > 0) {
        var prev = (seq[i - 1].lineup.starters || []).map(refOf);
        item.ins = cur.filter(function (n) { return prev.indexOf(n) < 0; });
        item.outs = prev.filter(function (n) { return cur.indexOf(n) < 0; });
        item.changes = item.ins.length;
      }
      changes.push(item);
    }
    var compared = changes.filter(function (c) { return c.changes !== null; });
    var stable = compared.filter(function (c) { return c.changes <= 2; }).map(function (c) { return c.game; });
    var shuffled = compared.filter(function (c) { return c.changes >= 3; }).map(function (c) { return c.game; });

    // 베스트 11 반복
    var xiMap = {};
    seq.forEach(function (g) {
      var key = sortedNums((g.lineup.starters || []).map(refOf)).join(',');
      (xiMap[key] = xiMap[key] || []).push(g);
    });
    var repeatXI = Object.keys(xiMap).map(function (k) { return xiMap[k]; })
      .sort(function (a, b) { return b.length - a.length; })[0] || [];

    // 유닛(수비/중원/공격) 조합
    function unitCombos(posList) {
      var map = {};
      withLu.forEach(function (g) {
        var nums = (g.lineup.starters || [])
          .filter(function (p) { return posList.indexOf(p.pos) >= 0; })
          .map(refOf);
        if (!nums.length) return;
        var key = sortedNums(nums).join(',');
        (map[key] = map[key] || { nums: sortedNums(nums), list: [] }).list.push(g);
      });
      return Object.keys(map).map(function (k) {
        return { nums: map[k].nums, agg: aggregate(map[k].list) };
      }).sort(function (a, b) { return b.agg.g - a.agg.g || b.agg.ppg - a.agg.ppg; });
    }

    return {
      matches: withLu.length, formations: formations, slots: slots,
      changes: changes,
      avgChanges: compared.length
        ? compared.reduce(function (s, c) { return s + c.changes; }, 0) / compared.length : 0,
      stableAgg: aggregate(stable), shuffledAgg: aggregate(shuffled),
      repeatXI: repeatXI,
      units: { def: unitCombos(UNIT_POS.def), mid: unitCombos(UNIT_POS.mid), att: unitCombos(UNIT_POS.att) }
    };
  }

  // =====================================================================
  // 전체 계산
  // =====================================================================
  function compute(ctx) {
    var games = buildGames(ctx, ctx.myEn, true);
    return {
      games: games,
      tiers: computeOpponentTiers(ctx, games),
      network: computeScoringNetwork(ctx),
      goalTimes: computeGoalTimes(ctx),
      subs: computeSubstitutions(ctx, games),
      lineup: computeLineupAnalysis(ctx, games)
    };
  }

  // =====================================================================
  // 렌더링 (HTML 문자열)
  // =====================================================================
  var CHIP_CLASS = { W: 'ta-chip-w', D: 'ta-chip-d', L: 'ta-chip-l' };

  function resText(ctx, r) {
    var T = lang(ctx);
    return r === 'W' ? T('승', 'W') : (r === 'D' ? T('무', 'D') : T('패', 'L'));
  }
  function record(ctx, a) {
    var T = lang(ctx);
    return T(a.w + '승 ' + a.d + '무 ' + a.l + '패', a.w + 'W ' + a.d + 'D ' + a.l + 'L');
  }
  function resultChip(ctx, g, withOpp) {
    var T = lang(ctx);
    var opp = ctx.isKorean ? g.oppKo : g.oppEn;
    var title = (g.home ? T('홈', 'H') : T('원정', 'A')) + ' ' + shortTeam(opp) + ' ' + g.gf + '-' + g.ga;
    return '<span class="ta-chip ' + CHIP_CLASS[g.res] + '" title="' + esc(title) + '">' +
      (withOpp ? '<span class="ta-chip-opp">' + esc(shortTeam(opp)) + '</span>' : '') +
      '<span class="ta-chip-main">' + resText(ctx, g.res) +
      (withOpp ? ' ' + g.gf + '-' + g.ga : '') + '</span></span>';
  }
  // 제목은 바로 위 sectionTitle 이 이미 보여주므로 카드 안에서는 다시 찍지 않습니다(title 인자는 호환용).
  // 표는 좁은 화면에서 카드 폭을 밀어내지 않도록 가로 스크롤 래퍼로 감쌉니다.
  function wrapTables(html) {
    return String(html).replace(/<table class="ta-table">/g, '<div class="ta-table-wrap"><table class="ta-table">').replace(/<\/table>/g, '</table></div>');
  }
  function card(title, body, note) {
    return '<div class="ti-card ta-card">' + wrapTables(body) +
      (note ? '<div class="ta-note">' + note + '</div>' : '') + '</div>';
  }
  function sectionTitle(text, id) {
    if (!id) return '<div class="ti-section-title">' + text + '</div>';
    return '<div class="ti-section-title ta-sec-title" id="' + id + '"><span>' + text + '</span>' +
      '<button type="button" class="ta-top-link" data-target="taSummary" aria-label="' + esc(lang(CUR_CTX)('요약으로 돌아가기', 'Back to summary')) + '">' + lang(CUR_CTX)('↑ 요약', '↑ Summary') + '</button></div>';
  }
  var CUR_CTX = { isKorean: true };   // sectionTitle 이 언어를 알 수 있게 render() 가 채워 둡니다
  function empty(msg) { return '<div class="ta-empty">' + msg + '</div>'; }
  function bar(ratio, cls) {
    return '<span class="ta-bar"><span class="ta-bar-fill ' + (cls || '') + '" style="width:' +
      Math.max(0, Math.min(100, Math.round(ratio * 100))) + '%"></span></span>';
  }

  // ---- 1) ----
  function renderTiers(ctx, data) {
    var T = lang(ctx);
    var t = data.tiers;
    if (!t.all.g) return card(T('상대 유형별 성적', 'Results by Opponent Level'), empty(T('아직 집계할 경기가 없습니다.', 'No matches to analyse yet.')));
    var tierName = { top: T('상위권', 'Top'), mid: T('중위권', 'Middle'), bottom: T('하위권', 'Bottom') };
    var rows = t.tiers.map(function (x) {
      var a = x.agg;
      var range = !x.from ? '' : (x.from === x.to ? T(x.from + '위', '#' + x.from) : T(x.from + '~' + x.to + '위', '#' + x.from + '-' + x.to));
      if (!a.g) {
        return '<div class="ta-tier-row"><div class="ta-tier-head"><b>' + tierName[x.key] + '</b> <span class="ta-dim">' + range + '</span></div>' +
          '<div class="ta-dim">' + T('아직 맞붙은 경기가 없습니다.', 'No matches yet.') + '</div></div>';
      }
      return '<div class="ta-tier-row">' +
        '<div class="ta-tier-head"><b>' + tierName[x.key] + '</b> <span class="ta-dim">' + range + '</span>' +
        '<span class="ta-tier-rec">' + T(a.g + '경기 · ', a.g + ' played · ') + record(ctx, a) + smallBadge(ctx, a.g) + '</span></div>' +
        '<div class="ta-tier-bar">' + bar(a.eff, x.key === 'top' ? 'ta-fill-top' : '') +
        '<span class="ta-tier-ppg">' + fmt2(a.ppg) + '<small> ' + T('점/경기', 'pts/g') + '</small></span></div>' +
        '<div class="ta-tier-goals">' + T('득점 ', 'GF ') + a.gf + ' (' + fmt1(a.gfpg) + ') · ' + T('실점 ', 'GA ') + a.ga + ' (' + fmt1(a.gapg) + ')</div>' +
        '<div class="ta-chips">' + x.list.map(function (g) { return resultChip(ctx, g, true); }).join('') + '</div>' +
        '</div>';
    }).join('');

    var insight = '';
    var ex = tierExtremes(data);
    if (ex) {
      var bn = tierName[ex.best.key], wn = tierName[ex.worst.key];
      var bp = fmt2(ex.best.agg.ppg), wp = fmt2(ex.worst.agg.ppg);
      insight = '<div class="ta-insight">' + (ex.small
        ? T('유형별 경기 수가 적어 참고용입니다. 지금까지는 ' + bn + ' 상대에게 가장 좋은 성적(' + bp + '점/경기), ' + wn + ' 상대에게 가장 부진한 성적(' + wp + '점/경기)을 냈습니다.',
            'Small samples, so indicative only: so far the best return is against ' + bn + ' teams (' + bp + ' pts/g) and the weakest against ' + wn + ' teams (' + wp + ' pts/g).')
        : T('가장 강한 상대 유형은 ' + bn + '(' + bp + '점/경기), 가장 고전한 유형은 ' + wn + '(' + wp + '점/경기)입니다.',
            'Best against ' + bn + ' (' + bp + ' pts/g); toughest against ' + wn + ' (' + wp + ' pts/g).')) + '</div>';
    }

    var note = T('상대 구분은 현재 리그 순위 기준이며, 우리 팀을 뺀 ' + t.rank.othersTotal + '팀을 3등분했습니다.', 'Opponents are grouped by current league rank, splitting the ' + t.rank.othersTotal + ' other teams into thirds (our own team excluded).') +
      (t.forfeits ? ' ' + T('몰수 경기 ' + t.forfeits + '경기는 제외했습니다.', t.forfeits + ' forfeit match(es) excluded.') : '');
    return card(T('상대 유형별 성적', 'Results by Opponent Level'), rows + insight, note);
  }

  // ---- 2) ----
  function renderNetwork(ctx, data) {
    var T = lang(ctx);
    var title = T('득점 패턴 네트워크', 'Scoring Network');
    var nw = data.network;
    if (!nw.totalGoals) return card(title, empty(T('라인업에 기록된 골이 아직 없습니다.', 'No goals recorded in lineups yet.')));
    var baseName = makeNamer(ctx);
    var view = groupNetworkNodes(nw);
    var name = function (k, full) { return k === OTHER_KEY ? T('기타 ' + view.grouped + '명', 'Others (' + view.grouped + ')') : baseName(k, full); };
    var W = 460, H = 400, cx = W / 2, cy = H / 2 - 4, R = 124;
    var n = view.nodes.length;
    var pos = {};
    view.nodes.forEach(function (nd, i) {
      var ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      nd.r = 11 + 3 * Math.sqrt(nd.goals + nd.assists);
      nd.x = cx + R * Math.cos(ang); nd.y = cy + R * Math.sin(ang); nd.ang = ang;
      pos[nd.number] = nd;
    });
    var maxGoals = Math.max.apply(null, view.nodes.filter(function (x) { return !x.other; }).map(function (x) { return x.goals; }));

    var edgesSvg = view.edges.map(function (e) {
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return '';
      var dx = b.x - a.x, dy = b.y - a.y;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var px = -dy / len, py = dx / len;
      var qx = mx + (cx - mx) * 0.4 + px * 14, qy = my + (cy - my) * 0.4 + py * 14;
      function unit(x, y) { var l = Math.sqrt(x * x + y * y) || 1; return [x / l, y / l]; }
      var us = unit(qx - a.x, qy - a.y), ue = unit(b.x - qx, b.y - qy);
      var sx = a.x + us[0] * (a.r + 1), sy = a.y + us[1] * (a.r + 1);
      var ex = b.x - ue[0] * (b.r + 4), ey = b.y - ue[1] * (b.r + 4);
      var sw = Math.min(6, 1.6 + (e.count - 1) * 1.6);
      return '<path class="ta-edge" data-from="' + e.from + '" data-to="' + e.to + '" d="M' + sx.toFixed(1) + ' ' + sy.toFixed(1) +
        ' Q' + qx.toFixed(1) + ' ' + qy.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1) +
        '" stroke-width="' + sw.toFixed(1) + '" marker-end="url(#taArrow)"><title>' +
        esc(name(e.from) + ' → ' + name(e.to) + ' ×' + e.count) + '</title></path>';
    }).join('');

    var nodesSvg = view.nodes.map(function (nd) {
      var cos = Math.cos(nd.ang), sin = Math.sin(nd.ang);
      var anchor = cos > 0.3 ? 'start' : (cos < -0.3 ? 'end' : 'middle');
      var lx = nd.x, ly, subDy = 13;
      if (anchor === 'middle') {
        // 위/아래에 놓인 노드는 라벨이 원과 겹치지 않도록 원 바깥으로 충분히 밀어냅니다.
        ly = sin > 0 ? nd.y + nd.r + 15 : nd.y - nd.r - 17;
      } else {
        // 좌/우 노드는 원 옆에 수평으로 붙이고, 이름+도움 두 줄이 원의 세로 중앙에 오게 맞춥니다.
        lx = nd.x + (cos > 0 ? 1 : -1) * (nd.r + 7);
        ly = nd.y - 1;
      }
      var top = !nd.other && nd.goals === maxGoals && maxGoals > 0;
      var sub = nd.goals + T('골 ', 'G ') + nd.assists + T('도움', 'A');
      return '<g class="ta-node' + (top ? ' ta-node-top' : '') + '" data-n="' + nd.number + '" tabindex="0" role="button" aria-label="' + esc(name(nd.number, true) + ' ' + sub) + '">' +
        '<circle cx="' + nd.x.toFixed(1) + '" cy="' + nd.y.toFixed(1) + '" r="' + nd.r.toFixed(1) + '"></circle>' +
        '<text class="ta-node-num" x="' + nd.x.toFixed(1) + '" y="' + (nd.y + 3.5).toFixed(1) + '" text-anchor="middle">' + nd.label + '</text>' +
        '<text class="ta-node-label" x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + anchor + '">' + esc(name(nd.number)) + '</text>' +
        '<text class="ta-node-sub" x="' + lx.toFixed(1) + '" y="' + (ly + subDy).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(sub) + '</text>' +
        '</g>';
    }).join('');

    var svg = '<svg class="ta-network" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(T('도움에서 득점으로 이어지는 연결 그래프', 'Assist-to-goal connection graph')) + '">' +
      '<defs><marker id="taArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ta-arrow"></path></marker></defs>' +
      edgesSvg + nodesSvg + '</svg>';

    var chips = '<div class="ta-tiles ta-tiles-3">' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('기록된 골', 'Goals') + '</div><div class="ta-tile-value">' + nw.totalGoals + '</div></div>' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('도움 연결', 'Assisted') + '</div><div class="ta-tile-value">' + nw.assisted + '</div></div>' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('도움 없음/미기록', 'No assist') + '</div><div class="ta-tile-value">' + nw.unassistedTotal + '</div></div></div>';

    var groupNote = view.grouped
      ? '<div class="ta-note">' + T('득점·도움에 관여한 선수 ' + view.total + '명 중 상위 ' + NETWORK_TOP_N + '명만 표시하고 나머지 ' + view.grouped + '명은 "기타"로 묶었습니다.',
          'Showing the top ' + NETWORK_TOP_N + ' of ' + view.total + ' involved players; the other ' + view.grouped + ' are grouped as "Others".') + '</div>'
      : '';
    var hint = '<div class="ta-note ta-hint">' + T('선수를 누르면 그 선수와 이어진 연결만 강조됩니다. 화살표는 도움을 준 선수에서 골을 넣은 선수 방향이고, 굵을수록 합작이 많습니다.',
      'Tap a player to highlight their links. Arrows point from the assister to the scorer; thicker means more combinations.') + '</div>';

    return card(title, chips + '<div class="ta-network-wrap">' + svg + '</div>' + groupNote + hint,
      T('라인업에 골·도움이 입력된 경기 기준입니다. 최강 콤비·합작률은 아래 카드에서 볼 수 있습니다.',
        'Based on matches with goals and assists entered in the lineups. Top duos and duo rates are in the card below.'));
  }

  // ---- 2-b) 득점 시간대 ----
  function renderGoalTimes(ctx, data) {
    var T = lang(ctx);
    var gt = data.goalTimes;
    if (!gt.total) return '';
    var head = '<div class="ta-subtitle ta-subtitle-first">' + T('득점 시간대', 'Goal Timing') + ' <span class="ta-dim">' + T('시간 입력 ' + gt.timed + '/' + gt.total + '골', 'time entered for ' + gt.timed + '/' + gt.total + ' goals') + '</span></div>';
    if (!gt.ready) {
      var names = gt.missingKeys.slice(0, 6).map(function (k) { return roundName(ctx, k); }).join(', ') + (gt.missingKeys.length > 6 ? T(' 외 ' + (gt.missingKeys.length - 6) + '경기', ' +' + (gt.missingKeys.length - 6) + ' more') : '');
      var prog = '<div class="ta-progress" role="img" aria-label="' + esc(T('시간 입력률 ' + pct(gt.share) + ', 목표 ' + pct(GOAL_TIME_MIN_SHARE), 'Time entry ' + pct(gt.share) + ', target ' + pct(GOAL_TIME_MIN_SHARE))) + '">' +
        '<span class="ta-progress-fill" style="width:' + Math.round(gt.share * 100) + '%"></span>' +
        '<span class="ta-progress-mark" style="left:' + Math.round(GOAL_TIME_MIN_SHARE * 100) + '%"></span></div>' +
        '<div class="ta-progress-legend"><span>' + pct(gt.share) + '</span><span>' + T('목표 ' + pct(GOAL_TIME_MIN_SHARE) + ' 이상이면 분포 표시', 'Shown once ' + pct(GOAL_TIME_MIN_SHARE) + '+') + '</span></div>';
      return '<div class="ti-card ta-card ta-card-compact">' + head + prog +
        '<div class="ta-note">' + T('아직 시간 입력이 부족해 분포는 숨겨 두었습니다. ', 'Not enough goal times yet, so the distribution is hidden. ') +
        (names ? T('시간 미입력 골이 있는 경기: ', 'Matches with untimed goals: ') + esc(names) + '.' : '') + '</div></div>';
    }
    var max = Math.max.apply(null, gt.bands) || 1;
    var rows = GOAL_BANDS.map(function (b, i) {
      var label = b[1] === 999 ? T('76분~', '76+') : T(b[0] + '~' + b[1] + '분', b[0] + '-' + b[1] + "'");
      return '<div class="ta-slot"><span class="ta-slot-pos">' + label + '</span>' + bar(gt.bands[i] / max) + '<span class="ta-slot-others">' + gt.bands[i] + T('골', '') + '</span></div>';
    }).join('');
    return card('', head + rows, T('시간이 입력된 ' + gt.timed + '골 기준이며, 전·후반 추가시간 골은 각각 45분·90분대에 넣었습니다. 시간 미입력 골 ' + (gt.total - gt.timed) + '개는 제외했습니다.',
      'Based on the ' + gt.timed + ' goals with a time; stoppage-time goals count in the 45th/90th-minute band. ' + (gt.total - gt.timed) + ' untimed goals excluded.'));
  }

  // ---- 3) ----
  var selectedOpp = null;

  function defaultOpponent(ctx) {
    var nx = nextFixtureAgainst(ctx, null);
    if (nx) return nx.oppEn;
    var others = (ctx.rankedTeams || []).filter(function (t) { return t.nameEn !== ctx.myEn; });
    return others.length ? others[0].nameEn : null;
  }

  function reportInsights(ctx, r) {
    var T = lang(ctx);
    var out = [];
    var a = r.agg;
    if (!a.g) return out;
    var lg = r.league;
    if (r.recent.length >= 3) {
      var ra = aggregate(r.recent);
      out.push(T('최근 ' + ra.g + '경기 ' + record(ctx, ra) + ' (경기당 ' + fmt1(ra.gfpg) + '득점 ' + fmt1(ra.gapg) + '실점).',
        'Last ' + ra.g + ': ' + record(ctx, ra) + ' (' + fmt1(ra.gfpg) + ' scored, ' + fmt1(ra.gapg) + ' conceded per game).'));
    }
    if (a.gapg <= lg.gpg - 0.3) out.push(T('실점이 경기당 ' + fmt1(a.gapg) + '골로 리그 평균(' + fmt1(lg.gpg) + ')보다 적은 단단한 수비입니다.',
      'Solid defence: ' + fmt1(a.gapg) + ' conceded per game vs league average ' + fmt1(lg.gpg) + '.'));
    else if (a.gapg >= lg.gpg + 0.3) out.push(T('실점이 경기당 ' + fmt1(a.gapg) + '골로 리그 평균(' + fmt1(lg.gpg) + ')보다 많아 수비가 흔들립니다.',
      'Leaky: ' + fmt1(a.gapg) + ' conceded per game vs league average ' + fmt1(lg.gpg) + '.'));
    if (a.gfpg >= lg.gpg + 0.3) out.push(T('경기당 ' + fmt1(a.gfpg) + '골로 리그 평균(' + fmt1(lg.gpg) + ')을 웃도는 공격력입니다.',
      'Strong attack: ' + fmt1(a.gfpg) + ' scored per game vs league average ' + fmt1(lg.gpg) + '.'));
    else if (a.gfpg <= lg.gpg - 0.3) out.push(T('경기당 ' + fmt1(a.gfpg) + '골로 리그 평균(' + fmt1(lg.gpg) + ')보다 득점이 적습니다.',
      'Low-scoring: ' + fmt1(a.gfpg) + ' per game vs league average ' + fmt1(lg.gpg) + '.'));
    if (r.scorers.length && a.gf >= 4) {
      var s0 = r.scorers[0];
      var share = s0.goals / a.gf;
      if (share >= 0.4) out.push(T((ctx.isKorean ? s0.nameKo : s0.nameEn) + ' 한 명이 팀 득점의 ' + pct(share) + '(' + s0.goals + '골)를 책임집니다.',
        (ctx.isKorean ? s0.nameKo : s0.nameEn) + ' accounts for ' + pct(share) + ' of the team\'s goals (' + s0.goals + ').'));
    }
    if (r.next) {
      var oppVenue = r.next.meHome ? r.away : r.home;
      var oppAt = r.next.meHome ? T('원정', 'away') : T('홈', 'home');
      if (oppVenue.g >= 2) out.push(T('다음 경기에서 상대는 ' + oppAt + ' 경기 ' + record(ctx, oppVenue) + '(경기당 ' + fmt2(oppVenue.ppg) + '점)입니다.',
        'In the next meeting they play ' + oppAt + ': ' + record(ctx, oppVenue) + ' (' + fmt2(oppVenue.ppg) + ' pts/g).'));
    }
    if (r.myTierAgg.g >= 2) {
      var tn = { top: T('상위권', 'top-third'), mid: T('중위권', 'mid-table'), bottom: T('하위권', 'bottom-third') }[r.tierKey];
      out.push(T('우리는 이번 시즌 ' + tn + ' 상대에게 ' + record(ctx, r.myTierAgg) + '(경기당 ' + fmt2(r.myTierAgg.ppg) + '점)입니다.',
        'We are ' + record(ctx, r.myTierAgg) + ' (' + fmt2(r.myTierAgg.ppg) + ' pts/g) against ' + tn + ' opponents this season.'));
    }
    return out;
  }

  function renderOpponentReportBody(ctx, myGames, oppEn) {
    var T = lang(ctx);
    var r = computeOpponentReport(ctx, oppEn, myGames);
    if (!r) return empty(T('팀 정보를 찾을 수 없습니다.', 'Team not found.'));
    var t = r.team, a = r.agg, lg = r.league;
    var oppName = ctx.isKorean ? t.nameKo : t.nameEn;
    var gd = (t.goalsFor || 0) - (t.goalsAgainst || 0);

    var head = '<div class="ta-rep-head"><div class="ta-rep-rank">' + r.rank + '<small>' + T('위', '') + '</small></div>' +
      '<div class="ta-rep-title"><b>' + esc(oppName) + '</b><div class="ta-dim">' +
      T((t.pts || 0) + '점 · ' + record(ctx, { w: t.won || 0, d: t.drawn || 0, l: Math.max(0, (t.played || 0) - (t.won || 0) - (t.drawn || 0)) }) + ' · 득실 ' + (gd > 0 ? '+' : '') + gd,
        (t.pts || 0) + ' pts · ' + record(ctx, { w: t.won || 0, d: t.drawn || 0, l: Math.max(0, (t.played || 0) - (t.won || 0) - (t.drawn || 0)) }) + ' · GD ' + (gd > 0 ? '+' : '') + gd) +
      '</div></div></div>';

    var next = r.next ? '<div class="ta-next">' + T('다음 맞대결', 'Next meeting') + ': <b>' + esc(roundName(ctx, r.next.roundKey)) + '</b> · ' +
      (r.next.meHome ? T('홈', 'Home') : T('원정', 'Away')) +
      (r.next.date ? ' · ' + esc(r.next.date) + (r.next.time ? ' ' + esc(r.next.time) : '') : ' · ' + T('일정 미정', 'TBD')) + '</div>' : '';

    var form = r.recent.length
      ? '<div class="ta-subtitle">' + T('최근 ' + r.recent.length + '경기', 'Last ' + r.recent.length) + '</div><div class="ta-chips">' +
        r.recent.map(function (g) { return resultChip(ctx, g, true); }).join('') + '</div>'
      : '';

    function stat(label, value, sub) {
      return '<div class="ta-tile"><div class="ta-tile-label">' + label + '</div><div class="ta-tile-value">' + value + '</div>' +
        (sub ? '<div class="ta-tile-sub">' + sub + '</div>' : '') + '</div>';
    }
    var lgTxt = T('리그 평균 ', 'League avg ');
    var stats = a.g ? '<div class="ta-tiles ta-tiles-4">' +
      stat(T('경기당 득점', 'Goals/g'), fmt1(a.gfpg), lgTxt + fmt1(lg.gpg)) +
      stat(T('경기당 실점', 'Conceded/g'), fmt1(a.gapg), lgTxt + fmt1(lg.gpg)) +
      stat(T('무실점 경기', 'Clean sheets'), r.cleanSheets + '<small>/' + a.g + '</small>', lgTxt + pct(lg.csRate)) +
      stat(T('무득점 경기', 'Blanked'), r.failedToScore + '<small>/' + a.g + '</small>', lgTxt + pct(lg.ftsRate)) + '</div>' : '';

    function venueRow(label, v, hi) {
      return '<div class="ta-venue-row' + (hi ? ' ta-venue-hi' : '') + '"><span>' + label + (hi ? ' <em>' + T('다음 경기', 'next') + '</em>' : '') + '</span><span>' +
        (v.g ? record(ctx, v) + ' · ' + fmt2(v.ppg) + T('점/경기', ' pts/g') : '-') + '</span></div>';
    }
    var venue = '<div class="ta-subtitle">' + T('홈/원정 성적', 'Home / Away') + '</div>' +
      venueRow(T('홈', 'Home'), r.home, r.next && r.next.meHome === false) +
      venueRow(T('원정', 'Away'), r.away, r.next && r.next.meHome === true);

    var scorers = r.scorers.length
      ? '<div class="ta-subtitle">' + T('주요 득점원', 'Top Scorers') + '</div><ul class="ta-list ta-list-plain">' +
        r.scorers.map(function (s) {
          return '<li>' + esc(ctx.isKorean ? s.nameKo : s.nameEn) + '<span class="ta-count">' + s.goals + T('골', ' goals') + '</span></li>';
        }).join('') + '</ul>' : '';

    var h2h = r.h2h.length
      ? '<div class="ta-subtitle">' + T('이번 시즌 맞대결', 'Head to Head This Season') + '</div><div class="ta-chips">' +
        r.h2h.map(function (g) {
          return '<span class="ta-chip ' + CHIP_CLASS[g.res] + '"><span class="ta-chip-opp">' + esc(roundName(ctx, g.roundKey)) + ' · ' + (g.home ? T('홈', 'H') : T('원정', 'A')) + '</span><span class="ta-chip-main">' +
            resText(ctx, g.res) + ' ' + g.gf + '-' + g.ga + (g.forfeit ? ' ' + T('(몰수)', '(forf.)') : '') + '</span></span>';
        }).join('') + '</div>' : '';

    var ins = reportInsights(ctx, r);
    var insHtml = ins.length ? '<div class="ta-subtitle">' + T('분석 포인트', 'Key Points') + '</div><ul class="ta-bullets">' +
      ins.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';

    return head + next + form + stats + venue + scorers + h2h + insHtml +
      (r.forfeits ? '<div class="ta-note">' + T('상대의 몰수 경기 ' + r.forfeits + '경기는 통계에서 제외했습니다.', r.forfeits + ' forfeit match(es) of this team excluded.') + '</div>' : '');
  }

  function renderOpponentReport(ctx, data) {
    var T = lang(ctx);
    var title = T('상대별 한 장 리포트', 'Opponent Scouting Report');
    var others = (ctx.rankedTeams || []).filter(function (t) { return t.nameEn !== ctx.myEn; });
    if (!others.length) return card(title, empty(T('비교할 팀이 없습니다.', 'No teams to compare.')));
    var valid = others.some(function (t) { return t.nameEn === selectedOpp; });
    if (!valid) selectedOpp = defaultOpponent(ctx);
    var nx = nextFixtureAgainst(ctx, null);
    var ri = rankInfo(ctx);
    var opts = others.map(function (t) {
      var label = ri.map[t.nameEn] + T('위 ', '. ') + (ctx.isKorean ? t.nameKo : t.nameEn) + (nx && nx.oppEn === t.nameEn ? T(' (다음 경기)', ' (next)') : '');
      return '<option value="' + esc(t.nameEn) + '"' + (t.nameEn === selectedOpp ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    var select = '<label class="ta-select-wrap"><span class="ta-dim">' + T('상대 팀', 'Opponent') + '</span>' +
      '<select class="ta-select" id="taOpponentSelect">' + opts + '</select></label>';
    return card(title, select + '<div id="taOpponentReport">' + renderOpponentReportBody(ctx, data.games, selectedOpp) + '</div>',
      T('확정된 경기 결과 기준입니다.', 'Based on confirmed match results.'));
  }

  // ---- 4) ----
  function renderSubstitutions(ctx, data) {
    var T = lang(ctx);
    var title = T('교체 활용 현황', 'Substitution Usage');
    var s = data.subs;
    if (!s.matches) return card(title, empty(T('라인업이 입력된 경기가 없습니다.', 'No lineup data yet.')));
    if (!s.recordedGames) return card(title, empty(T('교체 투입이 기록된 경기가 아직 없습니다.', 'No substitutions recorded yet.')));
    var name = makeNamer(ctx);
    var share = s.totalGoals ? s.subGoals / s.totalGoals : 0;

    var tiles = '<div class="ta-tiles ta-tiles-4">' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('교체 기록 경기', 'Games w/ subs') + '</div><div class="ta-tile-value">' + s.recordedGames + '<small>/' + s.matches + '</small></div></div>' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('경기당 교체 인원', 'Subs / game') + '</div><div class="ta-tile-value">' + fmt1(s.avgSubs) + '</div></div>' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('교체 선수 득점', 'Sub goals') + '</div><div class="ta-tile-value">' + s.subGoals + '<small>/' + s.totalGoals + '</small></div><div class="ta-tile-sub">' + (s.totalGoals ? pct(share) : '-') + '</div></div>' +
      '<div class="ta-tile"><div class="ta-tile-label">' + T('교체 선수 도움', 'Sub assists') + '</div><div class="ta-tile-value">' + s.subAssists + '</div></div></div>';

    function subRow(p) {
      return '<tr><td>' + esc(name(p.key, true)) + '</td><td>' + p.apps + '</td><td>' + p.goals + '</td><td>' + p.assists + '</td></tr>';
    }
    var SHOW = 5, listed = s.players.slice(0, 12);
    var rows = listed.slice(0, SHOW).map(subRow).join('');
    var extra = listed.slice(SHOW);
    var table = '<div class="ta-subtitle">' + T('교체 출전 선수', 'Players Used as Subs') + '</div>' +
      '<table class="ta-table"><thead><tr><th>' + T('선수', 'Player') + '</th><th>' + T('교체 출전', 'Apps') + '</th><th>' + T('득점', 'G') + '</th><th>' + T('도움', 'A') + '</th></tr></thead><tbody>' + rows + '</tbody>' +
      (extra.length ? '<tbody id="taSubsMore" hidden>' + extra.map(subRow).join('') + '</tbody>' : '') + '</table>' +
      (extra.length ? '<button type="button" class="ta-more-btn" data-more="taSubsMore" aria-expanded="false" data-more-label="' + esc(T('나머지 ' + extra.length + '명 보기', 'Show ' + extra.length + ' more')) + '" data-less="' + esc(T('접기', 'Show less')) + '">' + T('나머지 ' + extra.length + '명 보기', 'Show ' + extra.length + ' more') + '</button>' : '');

    var b = s.buckets;
    function bRow(label, a) {
      return '<tr><td>' + label + (a.g ? smallBadge(ctx, a.g) : '') + '</td><td>' + a.g + '</td><td>' + (a.g ? record(ctx, a) : '-') + '</td><td>' + (a.g ? fmt2(a.ppg) : '-') + '</td><td>' + (a.g ? a.gf + '-' + a.ga : '-') + '</td></tr>';
    }
    var bucketTable = '<div class="ta-subtitle">' + T('교체 인원별 성적', 'Results by Number of Subs') + '</div>' +
      '<table class="ta-table"><thead><tr><th>' + T('교체 인원', 'Subs') + '</th><th>' + T('경기', 'P') + '</th><th>' + T('전적', 'Record') + '</th><th>' + T('점/경기', 'Pts/g') + '</th><th>' + T('득실', 'GF-GA') + '</th></tr></thead><tbody>' +
      bRow(T('0명 (확정)', '0 (confirmed)'), b.none) + (b.unknown.g ? bRow(T('미입력', 'Not entered'), b.unknown) : '') + bRow(T('1~3명', '1-3'), b.few) + bRow(T('4명 이상', '4+'), b.many) + '</tbody></table>';

    var mins = s.inMin;
    var minsTxt = '<div class="ta-note">' + T('투입 시점: 전반 ' + mins.first + ' · 후반 ' + mins.second + ' · 시각 미기록 ' + mins.unknown,
      'Entry time: 1st half ' + mins.first + ' · 2nd half ' + mins.second + ' · unknown ' + mins.unknown) + '</div>';

    var caution = '<div class="ta-note ta-caution">' + T('교체 인원별 성적은 단순 비교입니다. 뒤지고 있는 경기에서 교체를 더 쓰는 경향이 섞여 있어, 교체가 결과를 바꿨다는 뜻으로 읽을 수 없습니다.',
      'Results by number of subs is a plain comparison. Teams tend to use more subs when trailing, so it does not show that subs changed the result.') + '</div>';
    return card(title, tiles + table + bucketTable + caution + minsTxt,
      T('"0명"은 교체 투입은 없고 남은 벤치 명단이 입력된 경기이며, 둘 다 비어 있으면 "미입력"으로 따로 셉니다. 경기 수가 적어 참고용으로 보세요.',
        '"0" means no substitutes came on and the unused-bench list is entered; if both are empty the game is counted as "Not entered". Small sample — treat as indicative.'));
  }

  // ---- 5) ----
  function renderLineups(ctx, data) {
    var T = lang(ctx);
    var title = T('선발 조합·포메이션', 'Starting XI & Formation');
    var L = data.lineup;
    if (!L.matches) return card(title, empty(T('라인업이 입력된 경기가 없습니다.', 'No lineup data yet.')));
    var name = makeNamer(ctx);

    var formTable;
    if (L.formations.length === 1) {
      // 한 가지뿐이면 표 대신 한 줄로 접고, 2종류 이상이 입력되면 아래 표가 펼쳐집니다.
      var f0 = L.formations[0], a0 = f0.agg;
      formTable = '<div class="ta-subtitle">' + T('포메이션', 'Formation') + '</div>' +
        '<div class="ta-insight">' + T('기록된 ' + a0.g + '경기 모두 <b>' + esc(f0.formation) + '</b> — ' + record(ctx, a0) + ' · ' + fmt2(a0.ppg) + '점/경기 · 득실 ' + a0.gf + '-' + a0.ga + '. 다른 포메이션이 입력되면 비교표가 펼쳐집니다.',
          'All ' + a0.g + ' recorded matches used <b>' + esc(f0.formation) + '</b> — ' + record(ctx, a0) + ' · ' + fmt2(a0.ppg) + ' pts/g · GF-GA ' + a0.gf + '-' + a0.ga + '. A comparison table appears once other formations are entered.') + '</div>';
    } else {
      var formRows = L.formations.map(function (f) {
        var a = f.agg;
        return '<tr><td><b>' + esc(f.formation) + '</b></td><td>' + a.g + smallBadge(ctx, a.g) + '</td><td>' + record(ctx, a) + '</td><td>' + fmt2(a.ppg) + '</td><td>' + a.gf + '-' + a.ga + '</td></tr>';
      }).join('');
      formTable = '<div class="ta-subtitle">' + T('포메이션별 성적', 'Results by Formation') + '</div>' +
        '<table class="ta-table"><thead><tr><th>' + T('포메이션', 'Formation') + '</th><th>' + T('경기', 'P') + '</th><th>' + T('전적', 'Record') + '</th><th>' + T('점/경기', 'Pts/g') + '</th><th>' + T('득실', 'GF-GA') + '</th></tr></thead><tbody>' + formRows + '</tbody></table>';
    }

    var slotRows = L.slots.map(function (s) {
      var main = s.players[0];
      var others = s.players.slice(1, 3).map(function (p) { return esc(name(p.key)) + ' ' + p.count; }).join(', ');
      return '<div class="ta-slot"><span class="ta-slot-pos">' + esc(s.pos) + '</span><span class="ta-slot-main">' + esc(name(main.key, true)) +
        ' <small>' + main.count + '/' + s.total + '</small></span>' + bar(s.share) + '<span class="ta-slot-others">' + others + '</span></div>';
    }).join('');
    var slots = '<div class="ta-subtitle">' + T('포지션별 주전 고정도', 'Position Regulars') + '</div>' + slotRows;

    var chips = L.changes.map(function (c) {
      var g = c.game;
      return '<span class="ta-chip ' + CHIP_CLASS[g.res] + '" title="' + esc(roundName(ctx, g.roundKey) + ' ' + shortTeam(ctx.isKorean ? g.oppKo : g.oppEn)) + '">' +
        '<span class="ta-chip-opp">' + esc(roundName(ctx, g.roundKey)) + '</span><span class="ta-chip-main">' +
        (c.changes === null ? T('첫 기록', 'first') : T('변경 ' + c.changes, 'Δ' + c.changes)) + '</span></span>';
    }).join('');
    var last = L.changes[L.changes.length - 1];
    var lastTxt = last && last.changes !== null
      ? '<div class="ta-insight">' + T('가장 최근 경기(' + roundName(ctx, last.game.roundKey) + ')는 직전 경기보다 선발 ' + last.changes + '명이 바뀌었습니다',
          'Latest match (' + roundName(ctx, last.game.roundKey) + '): ' + last.changes + ' change(s) to the starting XI') +
        (last.ins.length ? T(' — 투입: ', ' — in: ') + esc(last.ins.map(function (n) { return name(n, true); }).join(', ')) : '') +
        (last.outs.length ? T(' / 제외: ', ' / out: ') + esc(last.outs.map(function (n) { return name(n, true); }).join(', ')) : '') + '.</div>'
      : '';
    var stab = (L.stableAgg.g || L.shuffledAgg.g)
      ? '<table class="ta-table"><thead><tr><th>' + T('직전 대비', 'vs previous') + '</th><th>' + T('경기', 'P') + '</th><th>' + T('전적', 'Record') + '</th><th>' + T('점/경기', 'Pts/g') + '</th></tr></thead><tbody>' +
        '<tr><td>' + T('변경 0~2명 (안정)', '0-2 changes (stable)') + '</td><td>' + L.stableAgg.g + '</td><td>' + (L.stableAgg.g ? record(ctx, L.stableAgg) : '-') + '</td><td>' + (L.stableAgg.g ? fmt2(L.stableAgg.ppg) : '-') + '</td></tr>' +
        '<tr><td>' + T('변경 3명 이상', '3+ changes') + '</td><td>' + L.shuffledAgg.g + '</td><td>' + (L.shuffledAgg.g ? record(ctx, L.shuffledAgg) : '-') + '</td><td>' + (L.shuffledAgg.g ? fmt2(L.shuffledAgg.ppg) : '-') + '</td></tr></tbody></table>'
      : '';
    var change = '<div class="ta-subtitle">' + T('라인업 변동', 'Lineup Rotation') + ' <span class="ta-dim">' + T('평균 ' + fmt1(L.avgChanges) + '명 변경', 'avg ' + fmt1(L.avgChanges) + ' changes') + '</span></div>' +
      '<div class="ta-chips ta-chips-sm">' + chips + '</div>' +
      '<div class="ta-note ta-hint">' + T('칩 색은 경기 결과(초록 승 · 회색 무 · 빨강 패), 숫자는 직전 경기 대비 바뀐 선발 인원입니다.', 'Chip colour is the result (green win · grey draw · red loss); the number is starters changed vs the previous match.') + '</div>' + lastTxt + stab;

    var unitName = { def: T('수비라인 (GK+포백)', 'Defence (GK + back four)'), mid: T('중원', 'Midfield'), att: T('공격진', 'Attack') };
    var units = ['def', 'mid', 'att'].map(function (k) {
      var list = L.units[k].filter(function (u, i) { return i < 3 && (u.agg.g >= 2 || i === 0); });
      if (!list.length) return '';
      return '<div class="ta-unit"><div class="ta-unit-title">' + unitName[k] + '</div>' + list.map(function (u) {
        return '<div class="ta-unit-row"><span class="ta-unit-names">' + esc(u.nums.map(function (n) { return name(n); }).join(' · ') ) + '</span>' +
          '<span class="ta-unit-stat">' + u.agg.g + T('경기', 'P') + ' · ' + record(ctx, u.agg) + ' · ' + T('득 ', 'GF ') + u.agg.gf + T(' 실 ', ' GA ') + u.agg.ga + '</span></div>';
      }).join('') + '</div>';
    }).join('');
    var unitsHtml = '<div class="ta-subtitle">' + T('가장 자주 함께 선 조합', 'Most-Used Units') + '</div>' + units;

    var rx = L.repeatXI;
    var xi = '<div class="ta-note">' + (rx.length >= 2
      ? T('선발 11명이 완전히 같았던 경기는 최대 ' + rx.length + '번(' + rx.map(function (g) { return roundName(ctx, g.roundKey); }).join(', ') + ')입니다.',
          'The identical XI was used at most ' + rx.length + ' times (' + rx.map(function (g) { return roundName(ctx, g.roundKey); }).join(', ') + ').')
      : T('선발 11명이 완전히 같았던 경기는 없습니다.', 'No two matches used the identical XI.')) + '</div>';

    return card(title, formTable + slots + change + unitsHtml + xi,
      T('라인업이 입력된 ' + L.matches + '경기 기준이며, 포지션 표기(LCB/RCB 등)는 입력된 라인업 그대로입니다.',
        'Based on the ' + L.matches + ' matches with lineups; position labels are as entered.'));
  }

  // ---- 맨 위 요약 + 섹션 이동 칩 ----
  function renderSummary(ctx, data) {
    var T = lang(ctx);
    var name = makeNamer(ctx);
    var rows = [];
    function add(label, valueHtml) {
      rows.push('<div class="ta-sum-row"><span class="ta-sum-label">' + label + '</span><span class="ta-sum-value">' + valueHtml + '</span></div>');
    }
    var tierName = { top: T('상위권', 'Top'), mid: T('중위권', 'Middle'), bottom: T('하위권', 'Bottom') };
    var ex = tierExtremes(data);
    add(T('가장 강한 상대 유형', 'Best opponent level'), ex
      ? '<b>' + tierName[ex.best.key] + '</b> <span class="ta-dim">' + fmt2(ex.best.agg.ppg) + T('점/경기 · ', ' pts/g · ') + ex.best.agg.g + T('경기', ' games') + '</span>' + smallBadge(ctx, ex.best.agg.g)
      : '<span class="ta-dim">' + T('비교할 경기가 아직 부족합니다', 'Not enough games to compare yet') + '</span>');

    var e = data.network.edges[0];
    add(T('최강 콤비', 'Top combo'), e && e.count >= 2
      ? '<b>' + esc(name(e.from) + ' → ' + name(e.to)) + '</b> <span class="ta-dim">' + e.count + T('골', ' goals') + '</span>'
      : '<span class="ta-dim">' + T('반복된 콤비가 아직 없습니다', 'No repeated combo yet') + '</span>');

    var f = data.lineup.formations[0];
    add(T('주 포메이션', 'Main formation'), f
      ? '<b>' + esc(f.formation) + '</b> <span class="ta-dim">' + f.agg.g + '/' + data.lineup.matches + T('경기', ' games') + '</span>'
      : '<span class="ta-dim">-</span>');

    add(T('평균 선발 변경', 'Avg. XI changes'), data.lineup.matches > 1
      ? '<b>' + fmt1(data.lineup.avgChanges) + T('명', '') + '</b> <span class="ta-dim">' + T('직전 경기 대비', 'vs previous match') + '</span>'
      : '<span class="ta-dim">-</span>');

    var chips = [
      ['taSecTiers', T('상대 유형', 'Opponents')], ['taSecScoring', T('득점', 'Scoring')],
      ['taSecReport', T('리포트', 'Scouting')], ['taSecSubs', T('교체', 'Subs')], ['taSecLineup', T('선발', 'Lineup')]
    ].map(function (c) {
      return '<button type="button" class="ta-nav-chip" data-target="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    return '<div class="ti-card ta-card ta-summary" id="taSummary"><div class="ta-sum-title">' + T('핵심 요약', 'Key Takeaways') + '</div>' + rows.join('') +
      '<div class="ta-nav">' + chips + '</div></div>';
  }

  // ---- 전체 ----
  function render(ctx) {
    CUR_CTX = ctx;
    var T = lang(ctx);
    var data = compute(ctx);
    var x = ctx.extraSections || {};
    return renderSummary(ctx, data) +
      sectionTitle(T('상대 유형별 성적', 'Results by Opponent Level'), 'taSecTiers') + renderTiers(ctx, data) +
      sectionTitle(T('득점 패턴', 'Scoring Patterns'), 'taSecScoring') + renderNetwork(ctx, data) + renderGoalTimes(ctx, data) + (x.scoring || '') +
      sectionTitle(T('상대별 한 장 리포트', 'Opponent Scouting Report'), 'taSecReport') + renderOpponentReport(ctx, data) +
      sectionTitle(T('교체 활용 현황', 'Substitution Usage'), 'taSecSubs') + renderSubstitutions(ctx, data) + (x.subs || '') +
      sectionTitle(T('선발 조합·포메이션', 'Starting XI & Formation'), 'taSecLineup') + renderLineups(ctx, data) + (x.lineup || '');
  }

  // ---------------------------------------------------------------------
  // 이벤트 연결 (render 결과를 DOM에 넣은 뒤 호출)
  // ---------------------------------------------------------------------
  function bind(rootEl, ctx) {
    if (!rootEl) return;
    var reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(rootEl.querySelectorAll('.ta-nav-chip, .ta-top-link'), function (b) {
      b.addEventListener('click', function () {
        var t = rootEl.querySelector('#' + b.getAttribute('data-target'));
        if (t && t.scrollIntoView) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
    });
    Array.prototype.forEach.call(rootEl.querySelectorAll('.ta-more-btn'), function (b) {
      b.addEventListener('click', function () {
        var tb = rootEl.querySelector('#' + b.getAttribute('data-more'));
        if (!tb) return;
        var open = tb.hasAttribute('hidden');
        if (open) tb.removeAttribute('hidden'); else tb.setAttribute('hidden', '');
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
        b.textContent = open ? b.getAttribute('data-less') : b.getAttribute('data-more-label');
      });
    });
    var sel = rootEl.querySelector('#taOpponentSelect');
    if (sel) {
      sel.addEventListener('change', function () {
        selectedOpp = sel.value;
        var box = rootEl.querySelector('#taOpponentReport');
        if (box) box.innerHTML = renderOpponentReportBody(ctx, buildGames(ctx, ctx.myEn, true), selectedOpp);
      });
    }
    var svg = rootEl.querySelector('.ta-network');
    if (svg) {
      var pinned = null;
      var nodes = svg.querySelectorAll('.ta-node');
      var edges = svg.querySelectorAll('.ta-edge');
      var apply = function (n) {
        if (n == null) {
          svg.classList.remove('ta-focus');
          Array.prototype.forEach.call(nodes, function (g) { g.classList.remove('ta-on'); });
          Array.prototype.forEach.call(edges, function (e) { e.classList.remove('ta-on'); });
          return;
        }
        svg.classList.add('ta-focus');
        var linked = {}; linked[n] = true;
        Array.prototype.forEach.call(edges, function (e) {
          var on = e.getAttribute('data-from') === String(n) || e.getAttribute('data-to') === String(n);
          e.classList.toggle('ta-on', on);
          if (on) { linked[e.getAttribute('data-from')] = true; linked[e.getAttribute('data-to')] = true; }
        });
        Array.prototype.forEach.call(nodes, function (g) { g.classList.toggle('ta-on', !!linked[g.getAttribute('data-n')]); });
      };
      Array.prototype.forEach.call(nodes, function (g) {
        var n = g.getAttribute('data-n');
        g.addEventListener('mouseenter', function () { if (pinned == null) apply(n); });
        g.addEventListener('mouseleave', function () { if (pinned == null) apply(null); });
        var toggle = function () { pinned = (pinned === n) ? null : n; apply(pinned); };
        g.addEventListener('click', toggle);
        g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
      });
    }
  }

  return {
    render: render,
    bind: bind,
    compute: compute,
    // 단위 테스트/디버깅용
    _buildGames: buildGames,
    _computeOpponentReport: computeOpponentReport
  };
}));
