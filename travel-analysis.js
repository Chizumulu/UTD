// ============================================================
// 원정거리 ↔ 성적 분석 (Travel Impact) — 구단 위치 화면용 모듈
// ------------------------------------------------------------
// 하는 일
//   1) roundsData + scheduledRounds 에서 "스코어가 채워진 리그 경기"를 전부 모읍니다.
//      → 경기 결과를 입력하면 새로고침만으로 자동 반영됩니다. (이 파일은 고칠 필요 없음)
//   2) 경기마다 원정팀 홈구장 → 경기가 열린 구장 사이의 실제 도로거리(km)를
//      venue-matrix.js(OSRM 구장 간 거리표)에서 찾습니다.
//      - 치주물루(섬)가 끼면: 은카타베이 항구 ↔ 치테코 구장 직선거리(뱃길) + 항구 ↔ 상대 구장 도로거리
//      - 구장은 getTeamVenue(팀, 라운드번호)로 찾아서 구장 변경 이력(venueHistory)도 그대로 반영합니다.
//   3) 거리와 원정팀 성적(승점·득실차·득점·실점)의 상관을 계산합니다.
//      - 단순 상관(Pearson), 전력 보정 효과(두 팀의 평균 득실차 차이를 함께 넣은 회귀),
//        같은 팀 안 비교(원정팀 고정효과 + 홈팀 전력)
//   3-2) 구단별 원정거리 표(치른/남은 원정, 합계·평균·최장·시즌 예상)도 같은 거리표로 계산합니다. (computeClubs / renderClubs)
//   4) 결과를 HTML 문자열로 만들어 돌려줍니다. (app.js의 renderTravelImpactCard가 화면에 꽂아줍니다)
//
// 구장이 새로 생기거나 바뀌면 fetch-venue-matrix.js 를 다시 돌려 venue-matrix.js 를 덮어쓰세요.
// 표에 없는 구장이 낀 경기는 계산에서 빠지고, 카드 맨 아래에 "제외된 경기 N개"로 표시됩니다.
// ============================================================
(function (global) {
  'use strict';

  var MINE_EN = 'Chizumulu United FC';

  // ---------- 수학 도우미 ----------
  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371, rad = function (d) { return d * Math.PI / 180; };
    var a = Math.pow(Math.sin(rad(lat2 - lat1) / 2), 2) +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.pow(Math.sin(rad(lng2 - lng1) / 2), 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function betacf(a, b, x) {
    var MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d;
    for (var m = 1; m <= MAXIT; m++) {
      var m2 = 2 * m;
      var aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      var del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function ibeta(x, a, b) { // 정규화 불완전 베타 함수 I_x(a, b)
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }

  function tTwoSidedP(t, df) { // 양측 p값
    if (!isFinite(t) || df <= 0) return NaN;
    return ibeta(df / (df + t * t), df / 2, 0.5);
  }

  function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }

  function pearson(x, y) {
    var n = x.length;
    if (n < 4) return null;
    var mx = mean(x), my = mean(y), sxx = 0, syy = 0, sxy = 0;
    for (var i = 0; i < n; i++) {
      var dx = x[i] - mx, dy = y[i] - my;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    if (sxx === 0 || syy === 0) return { r: 0, p: 1, n: n };
    var r = sxy / Math.sqrt(sxx * syy);
    r = Math.max(-1, Math.min(1, r));
    var t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
    return { r: r, p: tTwoSidedP(t, n - 2), n: n };
  }

  // 일반 최소제곱(OLS): cols = [열 배열...] (절편은 자동 추가). 첫 번째 열(index 0 = 절편 다음 첫 변수)의 계수/p를 돌려줍니다.
  function ols(y, cols) {
    var n = y.length, k = cols.length + 1;
    if (n - k < 5) return null;
    var X = [];
    for (var i = 0; i < n; i++) {
      var row = [1];
      for (var j = 0; j < cols.length; j++) row.push(cols[j][i]);
      X.push(row);
    }
    // 정규방정식 (X'X) b = X'y 를 가우스-조던으로 풀면서 (X'X)^-1 도 같이 구합니다.
    var A = [];
    for (var a = 0; a < k; a++) {
      var r = [];
      for (var b = 0; b < k; b++) { var s = 0; for (var i2 = 0; i2 < n; i2++) s += X[i2][a] * X[i2][b]; r.push(s); }
      for (var b2 = 0; b2 < k; b2++) r.push(a === b2 ? 1 : 0);
      A.push(r);
    }
    for (var c = 0; c < k; c++) {
      var piv = c;
      for (var r2 = c + 1; r2 < k; r2++) if (Math.abs(A[r2][c]) > Math.abs(A[piv][c])) piv = r2;
      if (Math.abs(A[piv][c]) < 1e-10) return null; // 특이행렬(열이 서로 종속) → 계산 불가
      var tmp = A[c]; A[c] = A[piv]; A[piv] = tmp;
      var pv = A[c][c];
      for (var cc = 0; cc < 2 * k; cc++) A[c][cc] /= pv;
      for (var r3 = 0; r3 < k; r3++) {
        if (r3 === c) continue;
        var f = A[r3][c];
        if (f === 0) continue;
        for (var c2 = 0; c2 < 2 * k; c2++) A[r3][c2] -= f * A[c][c2];
      }
    }
    var inv = A.map(function (row) { return row.slice(k); });
    var Xty = [];
    for (var a2 = 0; a2 < k; a2++) { var sy = 0; for (var i3 = 0; i3 < n; i3++) sy += X[i3][a2] * y[i3]; Xty.push(sy); }
    var beta = [];
    for (var a3 = 0; a3 < k; a3++) { var sb = 0; for (var b3 = 0; b3 < k; b3++) sb += inv[a3][b3] * Xty[b3]; beta.push(sb); }
    var sse = 0;
    for (var i4 = 0; i4 < n; i4++) {
      var pred = 0;
      for (var a4 = 0; a4 < k; a4++) pred += X[i4][a4] * beta[a4];
      sse += (y[i4] - pred) * (y[i4] - pred);
    }
    var df = n - k, s2 = sse / df;
    var se = Math.sqrt(Math.max(0, s2 * inv[1][1]));
    if (!(se > 0)) return null;
    var t = beta[1] / se;
    return { coef: beta[1], se: se, p: tTwoSidedP(t, df), df: df, intercept: beta[0] };
  }

  // ---------- 경기 수집 ----------
  function roundPos(key) { return parseInt(String(key).replace('round', ''), 10); }

  function collectMatches(opts) {
    var out = [], seen = {};
    [opts.roundsData, opts.scheduledRounds].forEach(function (src) {
      if (!src) return;
      Object.keys(src).sort(function (a, b) { return roundPos(a) - roundPos(b); }).forEach(function (k) {
        if (seen[k]) return; // 같은 라운드가 roundsData에 있으면 그쪽 우선
        seen[k] = true;
        (src[k] || []).forEach(function (m) {
          if (m.byeKo || m.byeEn || !m.homeEn || !m.awayEn) return;
          if (m.postponed) return;
          if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
          out.push({ key: k, pos: roundPos(k), homeEn: m.homeEn, awayEn: m.awayEn, homeKo: m.homeKo, awayKo: m.awayKo, hs: m.homeScore, as: m.awayScore, forfeit: !!m.forfeit });
        });
      });
    });
    return out;
  }

  // ---------- 거리 계산 ----------
  function buildDistanceFinder(opts) {
    var mx = opts.matrix, ports = opts.venueRoutes && opts.venueRoutes.port;
    if (!mx || !mx.points || !mx.distanceKm) return null;
    var idx = {};
    mx.points.forEach(function (p, i) { idx[p.key] = i; });
    var keyOf = function (v) { return v.lat.toFixed(5) + ',' + v.lng.toFixed(5); };
    var portLL = ports || (mx.points[0] ? { lat: mx.points[0].lat, lng: mx.points[0].lng } : null);

    return function (awayEn, homeEn, pos) {
      var av = opts.getTeamVenue(awayEn, pos), hv = opts.getTeamVenue(homeEn, pos);
      if (!av || !hv) return null;
      var ia = idx[keyOf(av)], ih = idx[keyOf(hv)];
      if (ia !== undefined && ih !== undefined) {
        return { road: mx.distanceKm[ia][ih], boat: 0, min: mx.durationMin ? mx.durationMin[ia][ih] : null };
      }
      if (!portLL) return null;
      // 섬 구장(치주물루): 뱃길(직선) + 항구↔육지 구장 도로
      if (ia === undefined && awayEn === MINE_EN && ih !== undefined) {
        return { road: mx.distanceKm[0][ih], boat: haversineKm(portLL.lat, portLL.lng, av.lat, av.lng), min: mx.durationMin ? mx.durationMin[0][ih] : null };
      }
      if (ih === undefined && homeEn === MINE_EN && ia !== undefined) {
        return { road: mx.distanceKm[ia][0], boat: haversineKm(portLL.lat, portLL.lng, hv.lat, hv.lng), min: mx.durationMin ? mx.durationMin[ia][0] : null };
      }
      return null; // 표에 없는 구장
    };
  }

  // ---------- 핵심 계산 ----------
  function compute(opts) {
    var find = buildDistanceFinder(opts);
    if (!find) return { ok: false, reason: 'no-matrix' };
    var matches = collectMatches(opts).filter(function (m) { return !m.forfeit; }); // 몰수 경기는 실제 이동·경기가 없으므로 제외
    var rows = [], skipped = 0;
    matches.forEach(function (m) {
      var d = find(m.awayEn, m.homeEn, m.pos);
      if (!d) { skipped++; return; }
      var km = d.road + d.boat;
      m.km = km; m.road = d.road; m.boat = d.boat; m.min = d.min;
      m.gd = m.as - m.hs;
      m.pts = m.as > m.hs ? 3 : (m.as === m.hs ? 1 : 0);
      rows.push(m);
    });
    var res = { ok: true, n: rows.length, skipped: skipped, total: matches.length, rows: rows };
    if (!rows.length) return res;

    // 팀 전력 지표: 해당 경기를 뺀 평균 득실차(경기당)
    var agg = {};
    function add(team, gd) { var a = agg[team] || (agg[team] = { s: 0, c: 0 }); a.s += gd; a.c += 1; }
    rows.forEach(function (r) { add(r.homeEn, r.hs - r.as); add(r.awayEn, r.as - r.hs); });
    function strength(team, gdThis) { var a = agg[team]; return a.c > 1 ? (a.s - gdThis) / (a.c - 1) : 0; }
    rows.forEach(function (r) {
      r.sa = strength(r.awayEn, r.gd);
      r.sh = strength(r.homeEn, -r.gd);
    });

    var km = rows.map(function (r) { return r.km; });
    var km100 = km.map(function (v) { return v / 100; });
    var sd = rows.map(function (r) { return r.sa - r.sh; });
    var sh = rows.map(function (r) { return r.sh; });

    // 원정팀 더미(고정효과) — 원정 경기가 있는 팀만, 기준 팀 1개 제외
    var awayTeams = [];
    rows.forEach(function (r) { if (awayTeams.indexOf(r.awayEn) < 0) awayTeams.push(r.awayEn); });
    var dummies = awayTeams.slice(1).map(function (t) { return rows.map(function (r) { return r.awayEn === t ? 1 : 0; }); });

    var metrics = [
      { id: 'pts', ko: '원정 승점', en: 'Away points', get: function (r) { return r.pts; }, fmt: 2 },
      { id: 'gd', ko: '원정 득실차', en: 'Away goal diff', get: function (r) { return r.gd; }, fmt: 2 },
      { id: 'gf', ko: '원정 득점', en: 'Away goals for', get: function (r) { return r.as; }, fmt: 2 },
      { id: 'ga', ko: '원정 실점', en: 'Away goals against', get: function (r) { return r.hs; }, fmt: 2 }
    ];
    res.metrics = metrics.map(function (m) {
      var y = rows.map(m.get);
      return {
        id: m.id, ko: m.ko, en: m.en,
        simple: pearson(km, y),
        adjusted: ols(y, [km100, sd]),
        within: ols(y, [km100, sh].concat(dummies))
      };
    });

    // 거리 구간별
    var bins = [
      { lo: 0, hi: 50, ko: '50km 미만', en: '< 50 km' },
      { lo: 50, hi: 100, ko: '50~100km', en: '50–100 km' },
      { lo: 100, hi: 200, ko: '100~200km', en: '100–200 km' },
      { lo: 200, hi: Infinity, ko: '200km 이상', en: '200+ km' }
    ];
    res.bins = bins.map(function (b) {
      var g = rows.filter(function (r) { return r.km >= b.lo && r.km < b.hi; });
      return {
        ko: b.ko, en: b.en, n: g.length,
        w: g.filter(function (r) { return r.pts === 3; }).length,
        d: g.filter(function (r) { return r.pts === 1; }).length,
        l: g.filter(function (r) { return r.pts === 0; }).length,
        ppg: g.length ? mean(g.map(function (r) { return r.pts; })) : null,
        gf: g.length ? mean(g.map(function (r) { return r.as; })) : null,
        ga: g.length ? mean(g.map(function (r) { return r.hs; })) : null
      };
    });

    // 산점도 추세선: 거리 → 원정 득실차 (단순 회귀)
    var trend = ols(rows.map(function (r) { return r.gd; }), [km]);
    res.trend = trend ? { slope: trend.coef, intercept: trend.intercept } : null;
    res.avgKm = mean(km);
    res.maxKm = Math.max.apply(null, km);
    res.lastPos = Math.max.apply(null, rows.map(function (r) { return r.pos; }));
    res.verdict = verdict(res);
    return res;
  }

  // 한 줄 결론: 승점·득실차 두 지표의 (전력 보정) p값과 방향으로 판단합니다.
  function verdict(res) {
    if (res.n < 20) return { level: 'few' };
    var get = function (id) { return res.metrics.filter(function (m) { return m.id === id; })[0]; };
    var cands = [get('pts'), get('gd')].map(function (m) { return m && (m.adjusted || m.simple && { coef: m.simple.r, p: m.simple.p }); }).filter(Boolean);
    if (!cands.length) return { level: 'few' };
    var best = cands.reduce(function (a, b) { return b.p < a.p ? b : a; });
    if (best.p < 0.05) return { level: best.coef < 0 ? 'neg-sig' : 'pos-sig' };
    if (best.p < 0.2 && best.coef < 0) return { level: 'neg-trend' };
    return { level: 'none' };
  }

  // ---------- 화면 출력 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fixed(v, d) { return v == null || !isFinite(v) ? '–' : v.toFixed(d); }
  function signed(v, d) { return v == null || !isFinite(v) ? '–' : (v > 0 ? '+' : '') + v.toFixed(d); }
  function pText(p) { return p == null || !isFinite(p) ? '–' : (p < 0.001 ? '<0.001' : p.toFixed(3)); }
  function sigClass(p, coefNeg) {
    if (p == null || !isFinite(p)) return '';
    if (p < 0.05) return coefNeg ? 'ti-sig-neg' : 'ti-sig-pos';
    if (p < 0.1) return 'ti-sig-weak';
    return '';
  }

  var VERDICT_TEXT = {
    few: { ko: '아직 표본이 적어서 판단하기 어려워요.', en: 'Too few matches to judge yet.', cls: 'ti-v-none' },
    none: { ko: '원정거리와 성적 사이에 뚜렷한 관계는 아직 보이지 않아요.', en: 'No clear link between away distance and results yet.', cls: 'ti-v-none' },
    'neg-trend': { ko: '멀리 갈수록 불리한 경향이 있지만, 아직 우연과 구분되지는 않아요.', en: 'Longer trips look worse, but it is not yet distinguishable from chance.', cls: 'ti-v-trend' },
    'neg-sig': { ko: '멀리 갈수록 원정팀 성적이 나빠지는 관계가 통계적으로 유의해요.', en: 'Longer trips are significantly linked to worse away results.', cls: 'ti-v-sig' },
    'pos-sig': { ko: '오히려 멀리 간 원정팀의 성적이 더 좋은 관계가 유의하게 나와요.', en: 'Longer trips are, surprisingly, significantly linked to better away results.', cls: 'ti-v-sig' }
  };

  function headline(res, ko) {
    if (!res.ok || !res.n) return ko ? '데이터 없음' : 'No data';
    var v = VERDICT_TEXT[res.verdict.level];
    return ko ? v.ko : v.en;
  }

  function scatterSvg(res, ko, th) {
    var W = 700, H = 380, m = { top: 16, right: 22, bottom: 62, left: 62 };
    var pw = W - m.left - m.right, ph = H - m.top - m.bottom;
    var xMax = Math.max(100, Math.ceil(res.maxKm / 50) * 50);
    var gMax = Math.max(3, Math.max.apply(null, res.rows.map(function (r) { return Math.abs(r.gd); })));
    gMax = Math.ceil(gMax);
    var X = function (v) { return m.left + (v / xMax) * pw; };
    var Y = function (v) { return m.top + ph / 2 - (v / gMax) * (ph / 2); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (ko ? '원정거리와 원정 득실차 산점도' : 'Away distance vs goal difference scatter plot') + '">';
    s += '<rect x="' + m.left + '" y="' + m.top + '" width="' + pw + '" height="' + ph + '" fill="' + th.backdropCard + '" stroke="' + th.plotBorder + '"/>';
    for (var g = -gMax; g <= gMax; g++) {
      var yy = Y(g);
      s += '<line x1="' + m.left + '" y1="' + yy + '" x2="' + (m.left + pw) + '" y2="' + yy + '" stroke="' + (g === 0 ? th.guideLine : th.gridLine) + '" stroke-width="' + (g === 0 ? 1.4 : 1) + '"' + (g === 0 ? ' stroke-dasharray="5,4"' : '') + '/>';
      if (g % Math.max(1, Math.ceil(gMax / 4)) === 0) s += '<text x="' + (m.left - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="17" fill="' + th.tickLine + '">' + (g > 0 ? '+' : '') + g + '</text>';
    }
    for (var x = 0; x <= xMax; x += 50) {
      s += '<line x1="' + X(x) + '" y1="' + m.top + '" x2="' + X(x) + '" y2="' + (m.top + ph) + '" stroke="' + th.gridLine + '"/>';
      s += '<text x="' + X(x) + '" y="' + (m.top + ph + 22) + '" text-anchor="middle" font-size="17" fill="' + th.tickLine + '">' + x + '</text>';
    }
    s += '<text x="' + (m.left + pw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="17" fill="' + th.tickLine + '">' + (ko ? '원정 이동거리 (km, 편도)' : 'Away trip distance (km, one way)') + '</text>';
    s += '<text transform="translate(16 ' + (m.top + ph / 2) + ') rotate(-90)" text-anchor="middle" font-size="17" fill="' + th.tickLine + '">' + (ko ? '원정팀 득실차' : 'Away goal difference') + '</text>';
    if (res.trend) {
      var y1 = res.trend.intercept, y2 = res.trend.intercept + res.trend.slope * xMax;
      var clamp = function (v) { return Math.max(-gMax, Math.min(gMax, v)); };
      s += '<line x1="' + X(0) + '" y1="' + Y(clamp(y1)) + '" x2="' + X(xMax) + '" y2="' + Y(clamp(y2)) + '" stroke="' + th.xgMineRing + '" stroke-width="2.2" stroke-dasharray="6,4"/>';
    }
    res.rows.forEach(function (r) {
      var col = r.pts === 3 ? th.xgOver : (r.pts === 1 ? th.xgNeutral : th.xgUnder);
      var jy = ((r.homeEn.length * 7 + r.awayEn.length * 3 + r.pos) % 9 - 4) / 40; // 같은 점이 겹치지 않게 아주 약간만 흔듦
      var tip = (ko ? (r.homeKo || r.homeEn) + ' ' + r.hs + '-' + r.as + ' ' + (r.awayKo || r.awayEn) : r.homeEn + ' ' + r.hs + '-' + r.as + ' ' + r.awayEn) + ' · ' + Math.round(r.km) + 'km';
      s += '<circle cx="' + X(r.km) + '" cy="' + Y(r.gd + jy) + '" r="6" fill="' + col + '" fill-opacity="0.62" stroke="' + col + '" stroke-width="1"><title>' + esc(tip) + '</title></circle>';
    });
    s += '</svg>';
    return s;
  }

  function render(res, opts) {
    var ko = !!opts.isKorean, th = opts.theme;
    var t = function (kk, ee) { return ko ? kk : ee; };
    if (!res.ok) {
      return '<div class="ti-empty">' + t('구장 간 거리표(venue-matrix.js)를 불러오지 못했어요.', 'Could not load the venue distance table (venue-matrix.js).') + '</div>';
    }
    if (!res.n) {
      return '<div class="ti-empty">' + t('아직 계산할 경기 결과가 없어요.', 'No match results to analyse yet.') + '</div>';
    }
    var v = VERDICT_TEXT[res.verdict.level];
    var weekLbl = '';
    if (typeof weekLabelKo === 'function' && typeof weekLabelEn === 'function') weekLbl = ko ? weekLabelKo(res.lastPos) : weekLabelEn(res.lastPos);

    var h = '';
    h += '<div class="ti-verdict ' + v.cls + '">' + esc(ko ? v.ko : v.en) + '</div>';
    h += '<div class="ti-meta">' + t('리그 ' + res.n + '경기 반영' + (weekLbl ? ' · ' + weekLbl + '까지' : '') + ' · 평균 원정거리 ' + Math.round(res.avgKm) + 'km (편도, 도로+뱃길)',
      res.n + ' league matches' + (weekLbl ? ' · through ' + weekLbl : '') + ' · avg away trip ' + Math.round(res.avgKm) + ' km (one way, road + boat)') + '</div>';

    // 표·차트는 접어서 보여줍니다(열림 상태는 app.js가 다시 그릴 때 유지해줍니다)
    h += '<details class="ti-more"' + (opts.open ? ' open' : '') + '><summary class="ti-more-sum">' + t('표·차트 자세히 보기', 'Show tables & chart') + '</summary>';

    // 지표별 표
    h += '<div class="ti-table-wrap"><table class="ti-table"><thead><tr>' +
      '<th>' + t('지표', 'Metric') + '</th>' +
      '<th>' + t('단순 상관 r', 'Simple r') + '</th>' +
      '<th>' + t('전력 보정 효과<br><small>100km당</small>', 'Strength-adjusted<br><small>per 100 km</small>') + '</th>' +
      '<th>' + t('같은 팀 안 비교<br><small>100km당</small>', 'Within-team<br><small>per 100 km</small>') + '</th>' +
      '</tr></thead><tbody>';
    res.metrics.forEach(function (m) {
      var cell = function (o, isCoef) {
        if (!o) return '<td class="ti-na">–</td>';
        var val = isCoef ? o.coef : o.r, p = o.p;
        var cls = sigClass(p, val < 0);
        return '<td class="' + cls + '"><b>' + (isCoef ? signed(val, 2) : signed(val, 2)) + '</b><small>p=' + pText(p) + '</small></td>';
      };
      h += '<tr><th scope="row">' + esc(ko ? m.ko : m.en) + '</th>' + cell(m.simple, false) + cell(m.adjusted, true) + cell(m.within, true) + '</tr>';
    });
    h += '</tbody></table></div>';
    h += '<div class="ti-note">' + t(
      '* 승점·득실차·득점은 값이 클수록 좋고, 실점은 클수록 나쁩니다. 음수(−)가 거리가 늘수록 원정팀 승점·득실차가 줄어든다는 뜻이에요. p가 0.05 미만이면 우연이라 보기 어려운 수준입니다.',
      '* Higher points / goal difference / goals for are better; for goals against, higher is worse. A negative value means results drop as the trip gets longer. p < 0.05 is unlikely to be chance.') + '</div>';

    // 구간별
    h += '<div class="ti-sub">' + t('거리 구간별 원정팀 성적', 'Away results by distance band') + '</div>';
    h += '<div class="ti-table-wrap"><table class="ti-table ti-bins"><thead><tr><th>' + t('거리', 'Distance') + '</th><th>' + t('경기', 'Games') + '</th><th>' + t('승/무/패', 'W/D/L') + '</th><th>' + t('경기당 승점', 'Pts/game') + '</th><th>' + t('득점', 'GF') + '</th><th>' + t('실점', 'GA') + '</th></tr></thead><tbody>';
    res.bins.forEach(function (b) {
      h += '<tr><th scope="row">' + esc(ko ? b.ko : b.en) + '</th><td>' + b.n + '</td><td>' + (b.n ? b.w + '/' + b.d + '/' + b.l : '–') + '</td><td>' + fixed(b.ppg, 2) + '</td><td>' + fixed(b.gf, 2) + '</td><td>' + fixed(b.ga, 2) + '</td></tr>';
    });
    h += '</tbody></table></div>';

    // 산점도
    h += '<div class="ti-sub">' + t('거리 vs 원정 득실차', 'Distance vs away goal difference') + '</div>';
    h += '<div class="ti-chart">' + scatterSvg(res, ko, th) + '</div>';
    h += '<div class="ti-legend"><span><i class="ti-dot" style="background:' + th.xgOver + '"></i>' + t('원정승', 'Away win') + '</span><span><i class="ti-dot" style="background:' + th.xgNeutral + '"></i>' + t('무승부', 'Draw') + '</span><span><i class="ti-dot" style="background:' + th.xgUnder + '"></i>' + t('원정패', 'Away loss') + '</span><span><i class="ti-dash" style="border-color:' + th.xgMineRing + '"></i>' + t('추세선', 'Trend') + '</span></div>';

    h += '<div class="ti-foot">' + t(
      '거리는 OSRM 도로 경로(편도) 기준이고, 치주물루가 낀 경기는 항구↔섬 직선 뱃길을 더했습니다. "전력 보정"은 두 팀의 시즌 평균 득실차(해당 경기 제외) 차이를, "같은 팀 안 비교"는 원정팀 고정효과와 홈팀 전력을 함께 통제한 값입니다. 표본이 작을수록 우연의 영향이 크니 참고용으로 봐주세요.',
      'Distances are one-way OSRM road routes; matches involving Chizumulu add the straight-line boat leg. "Strength-adjusted" controls for the gap between both teams\' season goal difference (excluding that match); "within-team" controls for away-team fixed effects and host strength. With small samples, chance matters a lot — treat as indicative.') + '</div>';
    h += '</details>';
    if (opts.assumed && opts.assumed.length) {
      h += '<div class="ti-foot">' + t(
        '※ 가정: ' + opts.assumed.map(function (a) { return esc(a.name) + '은(는) 전 경기를 ' + esc(a.venue) + ' 기준'; }).join(', ') + '으로 계산했습니다.',
        'Assumption: ' + opts.assumed.map(function (a) { return esc(a.name) + ' is treated as playing every match at ' + esc(a.venue); }).join('; ') + '.') + '</div>';
    }
    if (res.skipped) {
      h += '<div class="ti-foot ti-warn">' + t(
        '거리 데이터가 없어 제외된 경기 ' + res.skipped + '개 — 구장이 바뀌었다면 fetch-venue-matrix.js 를 다시 실행해 venue-matrix.js 를 갱신해주세요.',
        res.skipped + ' match(es) excluded for missing distance data — if a venue changed, re-run fetch-venue-matrix.js to refresh venue-matrix.js.') + '</div>';
    }
    return h;
  }

  // ============================================================
  // 구단별 원정거리 정보 표 (원정거리 × 성적 분석 카드 바로 아래)
  // - 치른 원정: 스코어가 채워진 리그 경기(위 분석과 같은 경기, 몰수 경기는 제외)
  // - 남은 원정: 일정은 확정됐지만 아직 스코어가 없는 경기 (연기 후 새 일정 미정 경기도 포함)
  // - 모든 거리는 편도(원정팀 홈구장 → 경기 구장), 치주물루가 낀 경기는 뱃길(항구↔치테코 직선)을 더한 값
  // ============================================================
  var clubSort = { id: 'season', dir: -1 };
  var clubState = null; // 마지막으로 그린 표 (헤더를 눌러 정렬할 때 다시 쓰기 위해 보관)

  function collectUpcoming(opts) {
    var list = [], seen = {}, pending = 0;
    [opts.roundsData, opts.scheduledRounds].forEach(function (src) {
      if (!src) return;
      Object.keys(src).sort(function (a, b) { return roundPos(a) - roundPos(b); }).forEach(function (k) {
        if (seen[k]) return;
        seen[k] = true;
        (src[k] || []).forEach(function (m) {
          if (m.byeKo || m.byeEn || !m.homeEn || !m.awayEn) return;
          if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') return; // 이미 치른 경기
          if (m.movedToWeek) return;                                                       // 다른 주차로 옮겨간 경기(그쪽에서 집계)
          if (m.postponed) pending++;                                                      // 새 일정이 정해지지 않은 연기 경기도 언젠가 치르니 남은 원정에 포함 (개수는 안내용)
          list.push({ key: k, pos: roundPos(k), homeEn: m.homeEn, awayEn: m.awayEn });
        });
      });
    });
    return { list: list, pending: pending };
  }

  function computeClubs(opts) {
    var find = buildDistanceFinder(opts);
    if (!find || !opts.teams) return null;
    var by = {}, order = [];
    opts.teams.forEach(function (t) {
      var c = { nameEn: t.nameEn, nameKo: t.nameKo, logoSrc: t.logoSrc, isMine: t.nameEn === MINE_EN,
        played: 0, km: 0, max: 0, left: 0, leftKm: 0 };
      by[t.nameEn] = c; order.push(c);
    });
    var skipped = 0;
    function addTrip(m, played) {
      var c = by[m.awayEn];
      if (!c) return;
      var d = find(m.awayEn, m.homeEn, m.pos);
      if (!d) { skipped++; return; }
      var km = d.road + d.boat;
      if (played) { c.played++; c.km += km; if (km > c.max) c.max = km; }
      else { c.left++; c.leftKm += km; }
    }
    var forfeits = 0;
    collectMatches(opts).forEach(function (m) {
      if (m.forfeit) { forfeits++; return; } // 몰수승·몰수패는 실제로 이동하지 않았으므로 원정거리에서 제외
      addTrip(m, true);
    });
    var up = collectUpcoming(opts);
    up.list.forEach(function (m) { addTrip(m, false); });
    order.forEach(function (c) {
      c.avg = c.played ? c.km / c.played : null;
      c.season = c.km + c.leftKm;
    });
    return { clubs: order, skipped: skipped, pending: up.pending, forfeits: forfeits };
  }

  var CLUB_COLS = [
    { id: 'name', ko: '구단', en: 'Club' },
    { id: 'played', ko: '치른 원정', en: 'Played', ko2: '경기', en2: 'games' },
    { id: 'km', ko: '실이동 합계', en: 'Total', ko2: 'km', en2: 'km' },
    { id: 'avg', ko: '경기당 평균', en: 'Avg / trip', ko2: 'km', en2: 'km' },
    { id: 'max', ko: '최장 원정', en: 'Longest', ko2: 'km', en2: 'km' },
    { id: 'left', ko: '남은 원정', en: 'Remaining', ko2: '경기', en2: 'games' },
    { id: 'leftKm', ko: '남은 거리', en: 'Km left', ko2: 'km', en2: 'km' },
    { id: 'season', ko: '시즌 예상', en: 'Season est.', ko2: 'km', en2: 'km' }
  ];

  function kmText(v) {
    return v == null || !isFinite(v) ? '–' : v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function shortName(c, ko) { return (ko ? c.nameKo : c.nameEn).replace(/\s*FC\s*$/i, ''); }

  function clubTableHtml(res, o) {
    var ko = !!o.isKorean;
    var t = function (kk, ee) { return ko ? kk : ee; };
    var clubs = res.clubs.slice();
    var sid = clubSort.id, dir = clubSort.dir;
    clubs.sort(function (a, b) {
      var cmp;
      if (sid === 'name') cmp = shortName(a, ko).localeCompare(shortName(b, ko), ko ? 'ko' : 'en');
      else {
        var av = a[sid], bv = b[sid];
        if (av == null && bv == null) cmp = 0;
        else if (av == null) return 1;   // 값이 없는 팀은 항상 맨 아래
        else if (bv == null) return -1;
        else cmp = av - bv;
      }
      if (cmp === 0) cmp = shortName(a, ko).localeCompare(shortName(b, ko), ko ? 'ko' : 'en');
      return cmp * dir;
    });

    var tot = { played: 0, km: 0, max: 0, left: 0, leftKm: 0 };
    res.clubs.forEach(function (c) {
      tot.played += c.played; tot.km += c.km; tot.left += c.left; tot.leftKm += c.leftKm;
      if (c.max > tot.max) tot.max = c.max;
    });
    tot.avg = tot.played ? tot.km / tot.played : null;
    tot.season = tot.km + tot.leftKm;

    var h = '<table class="ti-table ti-club-table"><thead><tr>';
    CLUB_COLS.forEach(function (col) {
      var active = col.id === sid;
      var arrow = active ? (dir > 0 ? ' ▲' : ' ▼') : ' ↕';
      var label = esc(ko ? col.ko : col.en) + (col.ko2 ? '<small>' + esc(ko ? col.ko2 : col.en2) + '</small>' : '');
      h += '<th scope="col" class="' + (col.id === 'name' ? 'ti-club-name' : '') + (active ? ' ti-sorted' : '') + '"' +
        ' aria-sort="' + (active ? (dir > 0 ? 'ascending' : 'descending') : 'none') + '">' +
        '<button type="button" class="ti-sort-btn" title="' + t('눌러서 정렬 (오름차순/내림차순)', 'Click to sort (asc/desc)') + '" onclick="TravelAnalysis.sortClubs(\'' + col.id + '\')">' + label + '<span class="ti-sort-arrow' + (active ? '' : ' ti-sort-idle') + '">' + arrow + '</span></button></th>';
    });
    h += '</tr></thead><tbody>';
    clubs.forEach(function (c) {
      var logo = c.logoSrc ? '<img class="ti-club-logo" src="' + esc(c.logoSrc) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '';
      h += '<tr' + (c.isMine ? ' class="ti-club-mine"' : '') + '>' +
        '<th scope="row" class="ti-club-name"><span class="ti-club-team">' + logo + '<span>' + esc(shortName(c, ko)) + '</span></span></th>' +
        '<td>' + c.played + '</td><td>' + kmText(c.km) + '</td><td>' + kmText(c.avg) + '</td><td>' + (c.played ? kmText(c.max) : '–') + '</td>' +
        '<td>' + c.left + '</td><td>' + kmText(c.leftKm) + '</td><td><b>' + kmText(c.season) + '</b></td></tr>';
    });
    h += '</tbody><tfoot><tr class="ti-club-total"><th scope="row" class="ti-club-name">' + t('전체 합계', 'Total') + '</th>' +
      '<td>' + tot.played + '</td><td>' + kmText(tot.km) + '</td><td>' + kmText(tot.avg) + '</td><td>' + (tot.played ? kmText(tot.max) : '–') + '</td>' +
      '<td>' + tot.left + '</td><td>' + kmText(tot.leftKm) + '</td><td>' + kmText(tot.season) + '</td></tr></tfoot></table>';
    return h;
  }

  function renderClubs(res, opts) {
    var ko = !!opts.isKorean;
    var t = function (kk, ee) { return ko ? kk : ee; };
    if (!res || !res.clubs || !res.clubs.length) {
      return '<div class="ti-empty">' + t('구단별 원정거리를 계산할 데이터가 없어요.', 'No data to calculate club travel distances.') + '</div>';
    }
    clubState = { res: res, opts: { isKorean: ko } };

    var ranked = res.clubs.filter(function (c) { return c.season > 0; }).sort(function (a, b) { return b.season - a.season; });
    var h = '';
    if (ranked.length > 1) {
      var most = ranked[0], least = ranked[ranked.length - 1];
      h += '<div class="ti-meta">' + t(
        '시즌 예상 이동거리가 가장 긴 팀은 ' + esc(shortName(most, true)) + '(' + kmText(most.season) + 'km), 가장 짧은 팀은 ' + esc(shortName(least, true)) + '(' + kmText(least.season) + 'km)예요. 머리글을 누르면 정렬돼요.',
        'Longest projected season travel: ' + esc(shortName(most, false)) + ' (' + kmText(most.season) + ' km); shortest: ' + esc(shortName(least, false)) + ' (' + kmText(least.season) + ' km). Tap a header to sort.') + '</div>';
    }
    h += '<div class="ti-table-wrap ti-club-wrap" id="tiClubTable">' + clubTableHtml(res, clubState.opts) + '</div>';
    h += '<div class="ti-note">' + t(
      '* 거리는 모두 편도(원정팀 홈구장 → 경기 구장)이며 귀환 이동은 포함하지 않았습니다. 치주물루가 낀 경기는 항구↔치테코 구장 뱃길(직선거리)을 더한 값입니다. “남은 원정”은 일정이 확정된 미개최 경기, “시즌 예상”은 지금까지 거리와 남은 거리의 합계예요.',
      '* All distances are one way (away team\'s home venue → match venue); the return trip is not included. Matches involving Chizumulu add the straight-line boat leg (port ↔ Chiteko). "Remaining" counts scheduled matches not yet played; "Season est." = distance so far + remaining.') + '</div>';
    if (res.forfeits) {
      h += '<div class="ti-foot">' + t(
        '※ 몰수승·몰수패 ' + res.forfeits + '경기는 실제로 이동하지 않았으므로 원정거리에서 제외했어요.',
        'Note: ' + res.forfeits + ' forfeited match(es) are excluded because no trip took place.') + '</div>';
    }
    if (res.pending) {
      h += '<div class="ti-foot">' + t(
        '※ 연기된 뒤 새 일정이 정해지지 않은 경기 ' + res.pending + '개도 “남은 원정”에 포함했어요. 일정이 확정되면 자동으로 해당 주차로 옮겨져요.',
        'Note: ' + res.pending + ' postponed match(es) without a new date are included in "Remaining".') + '</div>';
    }
    if (opts.assumed && opts.assumed.length) {
      h += '<div class="ti-foot">' + t(
        '※ 가정: ' + opts.assumed.map(function (a) { return esc(a.name) + '은(는) 전 경기를 ' + esc(a.venue); }).join(', ') + ' 기준으로 계산했습니다.',
        'Assumption: ' + opts.assumed.map(function (a) { return esc(a.name) + ' is treated as playing every match at ' + esc(a.venue); }).join('; ') + '.') + '</div>';
    }
    if (res.skipped) {
      h += '<div class="ti-foot ti-warn">' + t(
        '거리 데이터가 없어 제외된 경기 ' + res.skipped + '개 — 구장이 바뀌었다면 fetch-venue-matrix.js 를 다시 실행해 venue-matrix.js 를 갱신해주세요.',
        res.skipped + ' match(es) excluded for missing distance data — if a venue changed, re-run fetch-venue-matrix.js to refresh venue-matrix.js.') + '</div>';
    }
    return h;
  }

  // 머리글 클릭 → 같은 열이면 오름/내림 전환, 다른 열이면 그 열로 (이름은 가나다순, 숫자는 큰 값부터)
  function sortClubs(id) {
    if (clubSort.id === id) clubSort.dir = -clubSort.dir;
    else { clubSort.id = id; clubSort.dir = id === 'name' ? 1 : -1; }
    var el = typeof document !== 'undefined' && document.getElementById('tiClubTable');
    if (el && clubState) el.innerHTML = clubTableHtml(clubState.res, clubState.opts);
  }

  global.TravelAnalysis = { compute: compute, render: render, headline: headline, computeClubs: computeClubs, renderClubs: renderClubs, sortClubs: sortClubs, _internal: { pearson: pearson, ols: ols, tTwoSidedP: tTwoSidedP } };
})(window);
