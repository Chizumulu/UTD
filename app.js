  // ===== 전역 상태 (Global State) =====
  let isKorean = true;
  let currentView = 'rank';
  let currentTeamInfoTab = 'overview';
  let statsData = {};
  let currentModalType = null;
  let currentPlayerModalKey = null;
  let currentSquadPlayerModalNumber = null;
  let currentTeamInfoKey = 'Chizumulu United FC';
  let selectedImpactPlayerNumber = null; // 핵심 선수 영향도 카드에서 선택된 선수 (null이면 첫 후보로 자동 선택)
  const otherTeamAccentCache = {};

  // ===== 다크 모드 (Dark Mode) =====
  const THEME_KEY = 'nrfa-theme';

  function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // SVG 차트에서 쓰는 하드코딩 색상은 CSS 변수를 못 쓰므로, 테마별 팔레트를 따로 둡니다.
  function chartTheme() {
    return isDarkTheme() ? {
      quadStrong: '#332c1a', quadAttack: '#15302f', quadDefense: '#1c2440', quadWeak: '#3a1f1f',
      quadStrongLabel: '#e0b84a', quadAttackLabel: '#4fd6d0', quadDefenseLabel: '#7fb3ea', quadWeakLabel: '#e57368',
      plotBorder: '#3a4058', guideLine: '#454c68', tickLine: '#565d7c',
      backdropCard: '#232838', backdropStripe: '#272d42', gridLine: '#333a54', gridBorder: '#3a4058'
    } : {
      quadStrong: '#fff9ec', quadAttack: '#eaf6f6', quadDefense: '#eef2fb', quadWeak: '#fdecea',
      quadStrongLabel: '#c99a2e', quadAttackLabel: '#079696', quadDefenseLabel: '#033990', quadWeakLabel: '#c0392b',
      plotBorder: '#e3e7f0', guideLine: '#c7cede', tickLine: '#b7bdca',
      backdropCard: '#f8f9fd', backdropStripe: '#eef1f8', gridLine: '#e1e5f0', gridBorder: '#dde1ee'
    };
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.title = theme === 'dark'
        ? (isKorean ? '라이트 모드로 전환' : 'Switch to light mode')
        : (isKorean ? '다크 모드로 전환' : 'Switch to dark mode');
    }
  }

  function toggleTheme() {
    const next = isDarkTheme() ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}

    // 하드코딩된 SVG 차트 색상은 테마 변경 시 다시 그려야 반영됩니다.
    if (currentView === 'stats') {
      buildStatsTables();
      if (currentModalType) openModal(currentModalType);
    } else if (currentView === 'predict') {
      renderRankHistoryChart();
    }
  }

  // ===== PWA: "앱으로 저장"(홈 화면에 추가) 버튼 =====
  // 안드로이드/크롬 계열은 beforeinstallprompt 이벤트로 네이티브 설치 팝업을 띄우고,
  // iOS 사파리는 이 API 자체가 없어서 "공유 → 홈 화면에 추가" 안내로 대체합니다.
  let deferredInstallPrompt = null;

  function isStandaloneMode() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  function updateInstallBtnVisibility() {
    const btn = document.getElementById('installAppBtn');
    if (!btn) return;
    if (isStandaloneMode()) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = (deferredInstallPrompt || isIOSDevice()) ? 'inline-flex' : 'none';
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallBtnVisibility();
    maybeShowInstallBanner();
  });

  window.addEventListener('appinstalled', function() {
    deferredInstallPrompt = null;
    updateInstallBtnVisibility();
    hideInstallBanner();
    showShareToast(isKorean ? '✅ 앱이 설치됐어요' : '✅ App installed');
  });

  async function installApp() {
    hideInstallBanner();
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (e) {}
      deferredInstallPrompt = null;
      updateInstallBtnVisibility();
      return;
    }
    if (isIOSDevice()) {
      openIosGuideModal();
      return;
    }
    showShareToast(isKorean ? '이 브라우저에서는 설치를 지원하지 않아요' : 'Install is not supported in this browser');
  }

  function openIosGuideModal() {
    const modal = document.getElementById('iosGuideModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeIosGuideModal() {
    const modal = document.getElementById('iosGuideModal');
    if (modal) modal.style.display = 'none';
  }

  // ===== PWA 설치 유도 배너 =====
  // 사람들이 방문 초반에는 배너를 무시하기 쉬워서, 사이트에 어느 정도
  // 관심을 보인 뒤(재방문 또는 일정 체류 시간 후)에만 배너를 띄워
  // 설치 전환율을 높입니다. 한 번 닫으면 7일간 다시 보이지 않습니다.
  const PWA_VISIT_KEY = 'nrfa-pwa-visit-count';
  const PWA_DISMISS_KEY = 'nrfa-pwa-banner-dismiss-until';
  const PWA_DISMISS_DAYS = 7;
  const PWA_MIN_VISITS = 2;
  const PWA_SHOW_DELAY_MS = 2500;

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function trackPwaVisit() {
    try {
      const count = Number(localStorage.getItem(PWA_VISIT_KEY) || '0') + 1;
      localStorage.setItem(PWA_VISIT_KEY, String(count));
      return count;
    } catch (e) {
      return PWA_MIN_VISITS; // localStorage 접근 불가 시 조건 통과로 처리
    }
  }

  function isInstallBannerDismissed() {
    try {
      const until = localStorage.getItem(PWA_DISMISS_KEY);
      return !!(until && Date.now() < Number(until));
    } catch (e) {
      return false;
    }
  }

  function dismissInstallBanner() {
    hideInstallBanner();
    try {
      const until = Date.now() + PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(PWA_DISMISS_KEY, String(until));
    } catch (e) {}
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;
    banner.classList.remove('show');
    setTimeout(() => { banner.style.display = 'none'; }, 350);
  }

  function showInstallBanner() {
    const banner = document.getElementById('pwaInstallBanner');
    if (!banner) return;
    banner.style.display = 'flex';
    // display 적용 후 다음 프레임에 show 클래스를 붙여야 슬라이드 애니메이션이 재생됩니다.
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));
  }

  let pwaVisitCount = 0;

  function maybeShowInstallBanner() {
    if (isStandaloneMode()) return;
    if (!isMobileDevice()) return; // PC에서는 배너를 띄우지 않습니다.
    if (isInstallBannerDismissed()) return;
    if (!deferredInstallPrompt && !isIOSDevice()) return; // 설치 가능한 환경이 아니면 스킵
    if (pwaVisitCount < PWA_MIN_VISITS) return;
    setTimeout(showInstallBanner, PWA_SHOW_DELAY_MS);
  }

  // leagueData, topScorersData, SEASON_START 등은 data.js 파일에서 불러옵니다.
  // "N주차" 표기는 roundsData/scheduledRounds를 기반으로 자동 계산됩니다(아래 updateSeasonInfo 참고).


  // ===== 화면 전환 (View Switching) =====
  function showView(view) {
    currentView = view;
    const rankView = document.getElementById('rankView');
    const squadView = document.getElementById('squadView');
    const roundsView = document.getElementById('roundsView');
    const statsView = document.getElementById('statsView');
    const scorersView = document.getElementById('scorersView');
    const predictView = document.getElementById('predictView');
    const venuesView = document.getElementById('venuesView');
    const nextMatchStrip = document.getElementById('nextMatchStrip');
    const rankBtn = document.getElementById('viewRankBtn');
    const squadBtn = document.getElementById('viewSquadBtn');
    const roundsBtn = document.getElementById('viewRoundsBtn');
    const statsBtn = document.getElementById('viewStatsBtn');
    const scorersBtn = document.getElementById('viewScorersBtn');
    const predictBtn = document.getElementById('viewPredictBtn');
    const venuesBtn = document.getElementById('viewVenuesBtn');

    rankView.style.display = 'none';
    squadView.style.display = 'none';
    roundsView.style.display = 'none';
    statsView.style.display = 'none';
    scorersView.style.display = 'none';
    predictView.style.display = 'none';
    if (venuesView) venuesView.style.display = 'none';
    if (nextMatchStrip) nextMatchStrip.style.display = 'none';
    rankBtn.classList.remove('active');
    squadBtn.classList.remove('active');
    roundsBtn.classList.remove('active');
    statsBtn.classList.remove('active');
    scorersBtn.classList.remove('active');
    predictBtn.classList.remove('active');
    if (venuesBtn) venuesBtn.classList.remove('active');

    if (view === 'squad') {
      squadView.style.display = '';
      squadBtn.classList.add('active');
      showTeamInfoForKey(currentTeamInfoKey);
    } else if (view === 'rounds') {
      roundsView.style.display = '';
      roundsBtn.classList.add('active');
      renderRoundsView();
    } else if (view === 'stats') {
      statsView.style.display = 'block';
      statsBtn.classList.add('active');
      buildStatsTables();
    } else if (view === 'scorers') {
      scorersView.style.display = '';
      scorersBtn.classList.add('active');
      renderScorersTable();
    } else if (view === 'predict') {
      predictView.style.display = '';
      predictBtn.classList.add('active');
      renderPredictions(false);
      renderRankHistoryChart();
      renderPointsHistoryChart();
      renderMagicNumberStats();
      renderAiTrackRecord();
    } else if (view === 'venues') {
      if (venuesView) venuesView.style.display = '';
      if (venuesBtn) venuesBtn.classList.add('active');
      renderVenuesView();
    } else {
      rankView.style.display = '';
      rankBtn.classList.add('active');
      if (nextMatchStrip) nextMatchStrip.style.display = '';
    }

    refreshScrollFadeHints();
  }

  let predictionCache = null;


  // ===== 경기 예측 / 몬테카를로 시뮬레이션 (Match Projections) =====
  function renderPredictions(forceRerun) {
    const tbody = document.getElementById('predictTableBody');
    const refreshBtn = document.getElementById('predictRefreshBtn');

    if (forceRerun) predictionCache = null;

    if (!predictionCache) {
      tbody.innerHTML = `<tr><td colspan="7" class="predict-loading"><span class="predict-loading-inner"><span class="predict-spinner"></span><span>${isKorean ? '시뮬레이션 실행 중...' : 'Running simulation...'}</span></span></td></tr>`;
      refreshBtn.disabled = true;
      // 브라우저가 로딩 문구를 그려낼 시간을 준 뒤 시뮬레이션 실행 (무거운 계산이 UI를 잠깐 멈출 수 있음)
      setTimeout(() => {
        predictionCache = runMonteCarloSimulation(4000);
        drawPredictionTable();
        refreshBtn.disabled = false;
      }, 30);
    } else {
      drawPredictionTable();
    }
  }

  function drawPredictionTable() {
    if (!predictionCache) return;
    const tbody = document.getElementById('predictTableBody');
    tbody.innerHTML = '';

    document.getElementById('predictMetaRuns').textContent =
      (isKorean ? '시뮬레이션 횟수: ' : 'Simulations: ') + predictionCache.iterations.toLocaleString() + (isKorean ? '회' : '');
    document.getElementById('predictMetaFixtures').textContent =
      (isKorean ? '남은 경기 수: ' : 'Remaining fixtures: ') + predictionCache.remainingFixtureCount;

    predictionCache.results.forEach((r, idx) => {
      const rank = idx + 1;
      const tr = document.createElement('tr');
      if (rank === 1) tr.classList.add('rank-1', 'promo');
      else if (rank === 2) tr.classList.add('rank-2');
      else if (rank === 3) tr.classList.add('rank-3');
      if (rank > predictionCache.results.length - 3) tr.classList.add('releg');
      if (r.nameEn === 'Chizumulu United FC') tr.classList.add('my-team');

      const name = isKorean ? r.nameKo : r.nameEn;

      function barCell(pct, cls) {
        const width = Math.max(pct, pct > 0 ? 3 : 0);
        return `
          <div class="pt-prob-bar-wrap">
            <div class="pt-prob-bar-fill ${cls}" style="width:${width}%;"></div>
            <div class="pt-prob-bar-label">${pct.toFixed(1)}%</div>
          </div>
        `;
      }

      tr.innerHTML = `
        <td class="rank-cell">${rank}</td>
        <td class="pt-team">
          <img class="team-logo" src="${r.logoSrc}" data-en-name="${r.nameEn}" alt="${r.nameEn}">
          <span>${name}</span>
        </td>
        <td class="pt-prob-cell">${barCell(r.championPct, 'champ')}</td>
        <td class="pt-prob-cell">${barCell(r.top3Pct, 'top3')}</td>
        <td class="pt-prob-cell">${barCell(r.bottom3Pct, 'bottom3')}</td>
        <td>${r.avgFinalRank.toFixed(1)}</td>
        <td>${r.avgFinalPts.toFixed(1)}</td>
      `;
      tbody.appendChild(tr);
    });

    attachImageFallback();
    refreshScrollFadeHints();
  }

  // ===== AI 예측 성적표 (Prediction Track Record / Backtest) =====
  // 이미 끝난 모든 경기에 대해, 그 경기 직전까지의 데이터만으로 AI가
  // 예측했다면 어떤 결과가 나왔을지 재계산(computeAiPredictionTrackRecord,
  // data.js)한 뒤 실제 스코어와 비교해서 보여줍니다.
  function renderAiTrackRecord() {
    const summaryEl = document.getElementById('aiTrackSummary');
    const bodyEl = document.getElementById('aiTrackTableBody');
    if (!summaryEl || !bodyEl) return;
    if (typeof computeAiPredictionTrackRecord !== 'function') return;

    const track = computeAiPredictionTrackRecord();
    const s = track.summary;

    function fmtPct(v) { return v.toFixed(1) + '%'; }

    if (!s) {
      summaryEl.innerHTML = `<div class="ai-track-empty lbl" data-en="Not enough completed matches yet to score prediction accuracy." data-ko="아직 적중률을 계산할 만큼 경기가 쌓이지 않았어요.">${isKorean ? '아직 적중률을 계산할 만큼 경기가 쌓이지 않았어요.' : 'Not enough completed matches yet to score prediction accuracy.'}</div>`;
      bodyEl.innerHTML = '';
      return;
    }

    summaryEl.innerHTML = `
      <div class="ai-track-chip">
        <span class="ai-track-chip-val">${fmtPct(s.wdlAccuracyPct)}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Win/Draw/Loss accuracy" data-ko="승무패 적중률">${isKorean ? '승무패 적중률' : 'Win/Draw/Loss accuracy'}</span>
      </div>
      <div class="ai-track-chip">
        <span class="ai-track-chip-val">${fmtPct(s.exactScoreAccuracyPct)}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Exact score accuracy" data-ko="정확한 스코어 적중률">${isKorean ? '정확한 스코어 적중률' : 'Exact score accuracy'}</span>
      </div>
      <div class="ai-track-chip">
        <span class="ai-track-chip-val">${s.avgGoalError.toFixed(2)}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Avg. goal error (xG vs actual)" data-ko="평균 득점 오차(예상-실제)">${isKorean ? '평균 득점 오차(예상-실제)' : 'Avg. goal error (xG vs actual)'}</span>
      </div>
      <div class="ai-track-chip ai-track-chip-n">
        <span class="ai-track-chip-val">${s.n}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Matches scored" data-ko="집계 경기 수">${isKorean ? '집계 경기 수' : 'Matches scored'}</span>
      </div>
    `;

    renderAiAutoCorrection(track, s);

    const wdlLabel = { H: isKorean ? '홈승' : 'Home', D: isKorean ? '무승부' : 'Draw', A: isKorean ? '원정승' : 'Away' };
    const rowsSorted = track.rows.slice().sort((a, b) => b.weekNum - a.weekNum);

    bodyEl.innerHTML = rowsSorted.map(r => {
      const homeName = isKorean ? r.homeKo : r.homeEn;
      const awayName = isKorean ? r.awayKo : r.awayEn;
      const homeShort = homeName.split(' ')[0];
      const awayShort = awayName.split(' ')[0];
      const lowConfTag = r.lowConfidence
        ? `<span class="ai-track-lowconf lbl" data-en="early season" data-ko="개막 초반">${isKorean ? '개막 초반' : 'early season'}</span>`
        : '';

      return `
        <tr class="${r.lowConfidence ? 'ai-track-row-lowconf' : ''}">
          <td class="ai-track-week">${r.weekNum}</td>
          <td class="ai-track-match">${homeShort} vs ${awayShort}${lowConfTag}</td>
          <td class="ai-track-pick">${wdlLabel[r.predictedResult]} · ${r.predictedHomeGoals}-${r.predictedAwayGoals}</td>
          <td class="ai-track-actual">${wdlLabel[r.actualResult]} · ${r.homeScore}-${r.awayScore}</td>
          <td class="ai-track-check"><span class="ai-track-badge ${r.wdlCorrect ? 'ai-track-badge-ok' : 'ai-track-badge-no'}">${r.wdlCorrect ? '✓' : '✗'}</span></td>
          <td class="ai-track-check"><span class="ai-track-badge ${r.exactScoreCorrect ? 'ai-track-badge-ok' : 'ai-track-badge-no'}">${r.exactScoreCorrect ? '✓' : '✗'}</span></td>
          <td class="ai-track-err">${((r.goalErrorHome + r.goalErrorAway) / 2).toFixed(2)}</td>
        </tr>`;
    }).join('');

    refreshScrollFadeHints();
  }

  // ===== AI 자동 보정 (Auto-Correction) 요약 렌더링 =====
  // computeAiPredictionTrackRecord()가 함께 계산해주는 두 가지를 보여줍니다.
  // 1) currentCorrection: 지금 이 순간 앞으로의 예측(경기 예측 카드, 몬테카를로
  //    시뮬레이션)에 실제로 적용되는 홈/원정 보정 계수.
  // 2) summaryCorrected: "만약 자동 보정을 계속 켜뒀다면" 라운드별로 다시 계산한
  //    walk-forward 백테스트 성적 — 위쪽에 이미 표시된 보정 없는 성적(rawSummary)과
  //    나란히 비교해서, 보정이 실제로 도움이 되고 있는지 눈으로 확인할 수 있습니다.
  function renderAiAutoCorrection(track, rawSummary) {
    const corrEl = document.getElementById('aiTrackCorrectionSummary');
    const compEl = document.getElementById('aiTrackCorrectedSummary');
    if (!corrEl || !compEl) return;

    const c = track.currentCorrection;
    const sc = track.summaryCorrected;

    function fmtFactor(f) {
      const pct = Math.round((f - 1) * 100);
      const sign = pct > 0 ? '+' : '';
      return `×${f.toFixed(2)} (${sign}${pct}%)`;
    }
    // invert=true는 "평균 득점 오차"처럼 값이 낮을수록 좋은 지표용입니다
    // (그런 지표는 감소가 초록색 개선 표시가 되어야 합니다).
    function deltaHtml(correctedVal, rawVal, isPct, invert) {
      const diff = correctedVal - rawVal;
      const improved = invert ? diff < -0.05 : diff > 0.05;
      const worsened = invert ? diff > 0.05 : diff < -0.05;
      const cls = improved ? 'ai-track-delta-up' : (worsened ? 'ai-track-delta-down' : 'ai-track-delta-flat');
      const sign = diff > 0 ? '+' : '';
      const txt = isPct ? `${sign}${diff.toFixed(1)}%p` : `${sign}${diff.toFixed(2)}`;
      return `<span class="ai-track-delta ${cls}">${txt}</span>`;
    }

    if (!c || !c.active) {
      const minSamples = (typeof AUTO_CORRECTION_MIN_SAMPLES === 'number') ? AUTO_CORRECTION_MIN_SAMPLES : 8;
      const soFar = c ? c.n : 0;
      const msgKo = `자동 보정은 최소 ${minSamples}경기가 쌓이면 켜져요. 지금까지 ${soFar}경기 집계됨 — 조금만 더 기다려주세요.`;
      const msgEn = `Auto-correction turns on once at least ${minSamples} matches build up (${soFar} so far).`;
      corrEl.innerHTML = `<div class="ai-track-empty lbl" data-en="${msgEn}" data-ko="${msgKo}">${isKorean ? msgKo : msgEn}</div>`;
      compEl.innerHTML = '';
      return;
    }

    corrEl.innerHTML = `
      <div class="ai-track-chip ai-track-chip-correction">
        <span class="ai-track-chip-val">${fmtFactor(c.homeFactor)}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Home goal correction" data-ko="홈 득점 보정">${isKorean ? '홈 득점 보정' : 'Home goal correction'}</span>
      </div>
      <div class="ai-track-chip ai-track-chip-correction">
        <span class="ai-track-chip-val">${fmtFactor(c.awayFactor)}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Away goal correction" data-ko="원정 득점 보정">${isKorean ? '원정 득점 보정' : 'Away goal correction'}</span>
      </div>
      <div class="ai-track-chip ai-track-chip-correction ai-track-chip-n">
        <span class="ai-track-chip-val">${c.n}</span>
        <span class="ai-track-chip-lbl lbl" data-en="Matches used" data-ko="반영 표본 경기 수">${isKorean ? '반영 표본 경기 수' : 'Matches used'}</span>
      </div>
    `;

    if (!sc || !rawSummary) {
      compEl.innerHTML = '';
      return;
    }

    compEl.innerHTML = `
      <div class="ai-track-chip ai-track-chip-corrected">
        <span class="ai-track-chip-val">${sc.wdlAccuracyPct.toFixed(1)}%</span>
        ${deltaHtml(sc.wdlAccuracyPct, rawSummary.wdlAccuracyPct, true)}
        <span class="ai-track-chip-lbl lbl" data-en="W/D/L accuracy w/ correction" data-ko="보정 적용 시 승무패 적중률">${isKorean ? '보정 적용 시 승무패 적중률' : 'W/D/L accuracy w/ correction'}</span>
      </div>
      <div class="ai-track-chip ai-track-chip-corrected">
        <span class="ai-track-chip-val">${sc.exactScoreAccuracyPct.toFixed(1)}%</span>
        ${deltaHtml(sc.exactScoreAccuracyPct, rawSummary.exactScoreAccuracyPct, true)}
        <span class="ai-track-chip-lbl lbl" data-en="Exact score accuracy w/ correction" data-ko="보정 적용 시 정확한 스코어 적중률">${isKorean ? '보정 적용 시 정확한 스코어 적중률' : 'Exact score accuracy w/ correction'}</span>
      </div>
      <div class="ai-track-chip ai-track-chip-corrected">
        <span class="ai-track-chip-val">${sc.avgGoalError.toFixed(2)}</span>
        ${deltaHtml(sc.avgGoalError, rawSummary.avgGoalError, false, true)}
        <span class="ai-track-chip-lbl lbl" data-en="Avg. goal error w/ correction" data-ko="보정 적용 시 평균 득점 오차">${isKorean ? '보정 적용 시 평균 득점 오차' : 'Avg. goal error w/ correction'}</span>
      </div>
    `;
  }

  // ===== 득점 순위 렌더링 (Top Scorers) =====
  // ===== 선수단(스쿼드) 렌더링 (Squad View) =====
  const POSITION_ORDER = ['GK', 'DF', 'MF', 'FW'];
  const POSITION_LABEL = {
    GK: { ko: '골키퍼', en: 'Goalkeepers' },
    DF: { ko: '수비수', en: 'Defenders' },
    MF: { ko: '미드필더', en: 'Midfielders' },
    FW: { ko: '공격수', en: 'Forwards' }
  };

  // ===== 킥오프 일시 포맷 (말라위 표준시 UTC+2 → KST UTC+9 병기) =====
  const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];
  // ===== 득점자 이름을 클릭 가능한 링크로 렌더링 =====
  // scorerText 예: "STEVEN PHIRI, DICKIES NYIRENDA (2골)"
  // topScorersData 에 등록된 선수(=득점 순위표에 있는 선수)는 클릭 시
  // 선수 득점 타임라인 모달이 뜨도록 .player-name-link 로 감싸서 반환합니다.
  function renderScorerNamesHtml(scorerText, isKorean) {
    if (!scorerText || scorerText === '없음') return scorerText;

    return scorerText.split(',').map(rawSegment => {
      const segment = rawSegment.trim();
      if (!segment) return segment;

      const parenMatch = segment.match(/^(.+?)\s*(\([^)]*\))?\s*$/);
      const rawName = (parenMatch ? parenMatch[1] : segment).trim();
      const note = (parenMatch && parenMatch[2]) ? parenMatch[2] : '';

      let key = rawName.toUpperCase();
      if (typeof nameAliases !== 'undefined' && nameAliases[key]) key = nameAliases[key];

      const info = (typeof playerDirectory !== 'undefined') ? playerDirectory[key] : null;
      const displayName = info ? (isKorean ? info.nameKo : info.nameEn) : rawName;
      const noteHtml = note ? ` ${note}` : '';

      const isLinkable = info && topScorersData.some(p => p.key === key);
      if (isLinkable) {
        return `<span class="lbl player-name-link" data-en="${info.nameEn}" data-ko="${info.nameKo}" data-player-key="${key}">${displayName}</span>${noteHtml}`;
      }
      return `${displayName}${noteHtml}`;
    }).join(', ');
  }

  function formatKickoff(nextMatch) {
    if (!nextMatch.kickoffDate || !nextMatch.kickoffTime) return '';
    const [y, mo, d] = nextMatch.kickoffDate.split('-').map(Number);
    const [hh, mm] = nextMatch.kickoffTime.split(':').map(Number);

    const dateObj = new Date(y, mo - 1, d);
    const weekdayKo = WEEKDAY_KO[dateObj.getDay()];
    const weekdayEn = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    // 말라위(CAT, UTC+2) → KST(UTC+9)는 +7시간
    const kstDate = new Date(y, mo - 1, d, hh + 7, mm);
    const kstMo = kstDate.getMonth() + 1;
    const kstD = kstDate.getDate();
    const kstWeekdayKo = WEEKDAY_KO[kstDate.getDay()];
    const kstWeekdayEn = kstDate.toLocaleDateString('en-US', { weekday: 'short' });
    const kstTime = `${String(kstDate.getHours()).padStart(2, '0')}:${String(kstDate.getMinutes()).padStart(2, '0')}`;
    const dayShifted = kstD !== d;

    if (isKorean) {
      if (!dayShifted) {
        return `${mo}.${d}(${weekdayKo}) ${nextMatch.kickoffTime} CAT · ${kstTime} KST`;
      }
      const catTxt = `${mo}.${d}(${weekdayKo}) ${nextMatch.kickoffTime} CAT`;
      const kstTxt = `${kstMo}.${kstD}(${kstWeekdayKo}) ${kstTime} KST`;
      return `${catTxt}<br>${kstTxt}`;
    }
    if (!dayShifted) {
      return `${weekdayEn}, Aug ${d} · ${nextMatch.kickoffTime} CAT / ${kstTime} KST`;
    }
    const catTxt = `${weekdayEn}, Aug ${d} · ${nextMatch.kickoffTime} CAT`;
    const kstTxt = `${kstWeekdayEn}, Aug ${kstD} · ${kstTime} KST`;
    return `${catTxt}<br>${kstTxt}`;
  }

  // ===== 다음 경기 미니 스트립 (메뉴 바 ~ 순위표 사이) =====
  function renderNextMatchStrip() {
    const el = document.getElementById('nextMatchStrip');
    if (!el) return;
    const info = getMyRankedTeam();
    if (!info) { el.innerHTML = ''; return; }
    const t = info.team;
    const preview = (typeof computeNextMatchPreview === 'function')
      ? computeNextMatchPreview(t.nameEn, t.nameKo)
      : null;
    const nextWeek = preview && preview.roundKey
      ? parseInt(preview.roundKey.replace('round', ''), 10)
      : (sortedRoundKeys().length + 1);
    const weekLbl = isKorean ? `${nextWeek}주차` : `WK ${nextWeek}`;

    if (t.nextMatch.isBye) {
      el.innerHTML = `
        <span class="nms-label lbl" data-en="Next" data-ko="다음경기">${isKorean ? '다음경기' : 'Next'}</span>
        <span class="nms-bye lbl" data-en="Bye week — no match this round" data-ko="이번 라운드는 휴식주입니다">${isKorean ? '이번 라운드는 휴식주입니다' : 'Bye week — no match this round'}</span>
        <span class="nms-meta-row"></span>`;
      const liveBarBye = document.getElementById('nextMatchLiveBar');
      if (liveBarBye) liveBarBye.removeAttribute('data-kickoff-utc');
      updateNextMatchLiveBar();
      return;
    }

    const ranked = getRankedTeams('all');
    const oppIdx = ranked.findIndex(rt => rt.nameEn === t.nextMatch.oppEn);
    const oppRank = oppIdx !== -1 ? oppIdx + 1 : null;
    const oppRankTxt = oppRank ? (isKorean ? `${oppRank}위` : `#${oppRank}`) : '';
    const haClass = t.nextMatch.homeAway === 'H' ? 'ha-home' : 'ha-away';
    const oppName = isKorean ? t.nextMatch.oppKo : t.nextMatch.oppEn;
    const oppNameShort = (isKorean ? t.nextMatch.oppKo : t.nextMatch.oppEn).split(' ')[0];
    const kickoffTxt = formatKickoff(t.nextMatch);
    const weatherHtml = matchWeatherPlaceholderHtml(
      t.nextMatch.homeAway === 'H' ? t.nameEn : t.nextMatch.oppEn,
      t.nextMatch.kickoffDate, t.nextMatch.kickoffTime,
      'nms-weather', true
    );

    el.innerHTML = `
      <span class="nms-label lbl" data-en="Next · ${weekLbl}" data-ko="다음경기 · ${weekLbl}">${isKorean ? '다음경기' : 'Next'} · ${weekLbl}</span>
      <span class="nms-match-row">
        <span class="nms-team">
          <img class="team-logo team-logo-sm" src="./dd.svg" alt="Chizumulu United FC">
          <span class="lbl" data-en="Chizumulu United FC" data-ko="치주물루">${isKorean ? '치주물루' : 'Chizumulu'}</span>
        </span>
        <span class="ha-badge ${haClass} nms-ha">${t.nextMatch.homeAway}</span>
        <span class="nms-team">
          <img class="team-logo team-logo-sm opp-logo" data-en-name="${t.nextMatch.oppEn}" data-ko-name="${t.nextMatch.oppKo}" title="${oppName}" src="${t.nextMatch.oppLogo}" alt="${t.nextMatch.oppEn}">
          <span title="${oppName}">${oppNameShort}</span>
          ${oppRankTxt ? `<span class="nms-opp-rank">${oppRankTxt}</span>` : ''}
        </span>
      </span>
      <span class="nms-meta-row">
        ${kickoffTxt ? `<span class="nms-kickoff">${kickoffTxt}</span>` : ''}
        ${weatherHtml}
        <span class="nms-action-group">
          <button class="nms-action-btn" onclick="downloadNextMatchICS()" aria-label="Add to calendar" title="${isKorean ? '캘린더에 추가' : 'Add to calendar'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9H21M7 3V5M17 3V5M6.2 5H17.8C19 5 20 6 20 7.2V18.8C20 20 19 21 17.8 21H6.2C5 21 4 20 4 18.8V7.2C4 6 5 5 6.2 5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </button>
          <button class="nms-action-btn" onclick="shareNextMatch()" aria-label="Share" title="${isKorean ? '공유하기' : 'Share'}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.6 13.5L15.4 17.5M15.4 6.5L8.6 10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="5" r="2.4" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="2.4" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="19" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>
          </button>
        </span>
      </span>`;

    const liveBar = document.getElementById('nextMatchLiveBar');
    if (liveBar) {
      const kickoffMs = kickoffUTCMillis(t.nextMatch.kickoffDate, t.nextMatch.kickoffTime);
      if (kickoffMs) liveBar.setAttribute('data-kickoff-utc', kickoffMs);
      else liveBar.removeAttribute('data-kickoff-utc');
    }
    updateNextMatchLiveBar();
    hydrateWeatherWidgets();
  }

  // ===== 공유하기 (Web Share API + 클립보드 폴백) =====
  function showShareToast(msg, duration) {
    let toast = document.getElementById('shareToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'shareToast';
      toast.className = 'share-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => toast.classList.remove('show'), duration || 2200);
  }

  async function shareContent(title, text, url) {
    const shareUrl = url || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch (e) {
        // 사용자가 공유 시트를 취소한 경우는 조용히 무시합니다.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${shareUrl}`);
      showShareToast(isKorean ? '클립보드에 복사했어요' : 'Copied to clipboard');
    } catch (e) {
      showShareToast(isKorean ? '공유에 실패했어요' : 'Share failed');
    }
  }

  // 현재 순위표 상위 5팀(+내 팀 순위)을 공유합니다.
  function shareRankTable() {
    const ranked = getRankedTeams('all');
    const info = getMyRankedTeam();
    const ptsLabel = isKorean ? '점' : ' pts';
    const lines = ranked.slice(0, 5).map((t, i) => `${i + 1}. ${isKorean ? t.nameKo : t.nameEn} — ${t.pts}${ptsLabel}`);
    let text = (isKorean ? '📊 NRFA 리그 원 순위표 TOP 5\n' : '📊 NRFA League One — Top 5\n') + lines.join('\n');
    if (info && info.rank > 5) {
      text += `\n...\n${info.rank}. ${isKorean ? info.team.nameKo : info.team.nameEn} — ${info.team.pts}${ptsLabel}`;
    }
    shareContent(isKorean ? 'NRFA 리그 원 순위표' : 'NRFA League One Standings', text);
  }

  // 현재 선택된 라운드의 확정된 경기 결과를 공유합니다.
  function shareRoundResults() {
    if (!currentRoundKey) return;
    const weekNum = allRoundKeysIncludingScheduled().indexOf(currentRoundKey) + 1;
    const weekLabel = isKorean ? `${weekNum}주차` : `Week ${weekNum}`;
    const matches = buildRoundMatches(currentRoundKey).filter(m => !m.isBye && !m.isScheduled);
    if (!matches.length) {
      showShareToast(isKorean ? '공유할 결과가 아직 없어요' : 'No results to share yet');
      return;
    }
    const lines = matches.map(m => {
      const home = isKorean ? m.homeKo : m.homeEn;
      const away = isKorean ? m.awayKo : m.awayEn;
      return `${home} ${m.homeScore} : ${m.awayScore} ${away}`;
    });
    const text = (isKorean ? `⚽ NRFA 리그 원 ${weekLabel} 결과\n` : `⚽ NRFA League One ${weekLabel} Results\n`) + lines.join('\n');
    shareContent(isKorean ? `NRFA 리그 원 ${weekLabel} 결과` : `NRFA League One ${weekLabel} Results`, text);
  }

  // 우리 팀(치주물루)의 다음 경기 정보를 공유합니다.
  function shareNextMatch() {
    const info = getMyRankedTeam();
    if (!info || !info.team.nextMatch || info.team.nextMatch.isBye) return;
    const nm = info.team.nextMatch;
    const oppName = isKorean ? nm.oppKo : nm.oppEn;
    const haTxt = nm.homeAway === 'H' ? (isKorean ? '홈' : 'Home') : (isKorean ? '원정' : 'Away');
    const kickoffTxt = formatKickoff(nm).replace(/<br>\s*/g, ' / ');
    const text = isKorean
      ? `⚽ 치주물루 유나이티드 FC 다음 경기\n${haTxt} vs ${oppName}\n${kickoffTxt}`
      : `⚽ Chizumulu United FC — Next Match\n${haTxt} vs ${oppName}\n${kickoffTxt}`;
    shareContent(isKorean ? '치주물루 다음 경기' : 'Chizumulu Next Match', text);
  }

  // ===== 다음 경기 캘린더 등록 (.ics 다운로드) =====
  // 브라우저 알림 대신, 어떤 캘린더 앱(구글/애플/아웃룩)에도 바로 등록 가능한 표준 .ics 파일을 생성합니다.
  function toICSDate(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  function icsEscape(str) {
    return String(str).replace(/([,;])/g, '\\$1');
  }

  function downloadNextMatchICS() {
    const info = getMyRankedTeam();
    if (!info || !info.team.nextMatch || info.team.nextMatch.isBye) return;
    const nm = info.team.nextMatch;
    const startMs = kickoffUTCMillis(nm.kickoffDate, nm.kickoffTime);
    if (!startMs) {
      showShareToast(isKorean ? '경기 일정을 아직 알 수 없어요' : 'Kickoff time not confirmed yet');
      return;
    }
    const endMs = startMs + 2 * 60 * 60 * 1000; // 경기 시간 2시간으로 가정
    const oppName = isKorean ? nm.oppKo : nm.oppEn;
    const haTxt = nm.homeAway === 'H' ? (isKorean ? '홈' : 'Home') : (isKorean ? '원정' : 'Away');
    const summary = isKorean
      ? `[NRFA] 치주물루 유나이티드 FC vs ${oppName} (${haTxt})`
      : `[NRFA] Chizumulu United FC vs ${oppName} (${haTxt})`;
    const description = isKorean
      ? '치주물루 유나이티드 FC 팬사이트에서 등록한 일정입니다.'
      : 'Added from the Chizumulu United FC fan site.';
    const uid = `chizumulu-${nm.kickoffDate}-${nm.kickoffTime}-${nm.oppEn}`.replace(/\s+/g, '').toLowerCase();

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Chizumulu United FC Fan Site//NRFA//KO',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}@chizumulu.github.io`,
      `DTSTAMP:${toICSDate(Date.now())}`,
      `DTSTART:${toICSDate(startMs)}`,
      `DTEND:${toICSDate(endMs)}`,
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `URL:${window.location.href}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chizumulu-next-match.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showShareToast(isKorean ? '캘린더 파일을 내려받았어요' : 'Calendar file downloaded');
  }


  function getMyRankedTeam() {
    const ranked = getRankedTeams('all');
    const idx = ranked.findIndex(t => isMyTeamName(t.nameEn, t.nameKo));
    if (idx === -1) return null;
    return { team: ranked[idx], rank: idx + 1, total: ranked.length };
  }

  function renderTeamInfoHeader() {
    const info = getMyRankedTeam();
    const wrap = document.getElementById('teamInfoQuickStats');
    if (!info || !wrap) return;
    const t = info.team;
    const stats = [
      { ko: '순위', en: 'RANK', value: info.rank + (isKorean ? '위' : ''), highlight: true },
      { ko: '승점', en: 'PTS', value: t.pts },
      { ko: '경기', en: 'PLAYED', value: t.played },
      { ko: '승', en: 'W', value: t.won },
      { ko: '무', en: 'D', value: t.drawn },
      { ko: '패', en: 'L', value: t.lost }
    ];
    wrap.innerHTML = stats.map(s => `
      <div class="ti-stat${s.highlight ? ' ti-stat-highlight' : ''}">
        <span class="ti-stat-value">${s.value}</span>
        <span class="ti-stat-label lbl" data-en="${s.en}" data-ko="${s.ko}">${isKorean ? s.ko : s.en}</span>
      </div>
    `).join('');
  }

  // ===== 다음 경기 카운트다운 (말라위 표준시 CAT = UTC+2 고정, 서머타임 없음) =====
  function kickoffUTCMillis(kickoffDate, kickoffTime) {
    if (!kickoffDate || !kickoffTime) return null;
    const [y, mo, d] = kickoffDate.split('-').map(Number);
    const [hh, mm] = kickoffTime.split(':').map(Number);
    return Date.UTC(y, mo - 1, d, hh - 2, mm, 0);
  }

  function formatCountdownText(diffMs) {
    if (diffMs === null) return '';
    if (diffMs <= 0) return isKorean ? '⚽ 킥오프!' : '⚽ Kickoff!';
    const totalSec = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const clock = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    if (days > 0) {
      return isKorean ? `D-${days} · ${clock}` : `D-${days} · ${clock}`;
    }
    return isKorean ? `오늘 · ${clock} 남음` : `Today · ${clock}`;
  }

  // 화면에 떠 있는 모든 카운트다운 엘리먼트를 1초마다 갱신합니다.
  function updateAllNextMatchCountdowns() {
    document.querySelectorAll('.ti-next-match-countdown[data-kickoff-utc]').forEach(el => {
      const kickoffMs = Number(el.getAttribute('data-kickoff-utc'));
      if (!kickoffMs) return;
      el.textContent = formatCountdownText(kickoffMs - Date.now());
    });
    updateNextMatchLiveBar();
  }

  // ===== 다음 경기 문자중계 링크 바 (킥오프 30분 전 ~ 3시간 후에만 노출) =====
  // 치주물루 다음 경기 기준, data-kickoff-utc(킥오프 UTC ms)를 renderNextMatchStrip()에서
  // nextMatchLiveBar에 심어두고, 매초 이 함수로 현재 시각과 비교해 노출 여부만 갱신합니다.
  const NEXT_MATCH_LIVE_BAR_LEAD_MS = 30 * 60 * 1000;   // 킥오프 30분 전부터
  const NEXT_MATCH_LIVE_BAR_TAIL_MS = 3 * 60 * 60 * 1000; // 킥오프 후 3시간까지
  function updateNextMatchLiveBar() {
    const el = document.getElementById('nextMatchLiveBar');
    if (!el) return;
    const kickoffMs = Number(el.getAttribute('data-kickoff-utc'));
    if (!kickoffMs) {
      el.style.display = 'none';
      return;
    }
    const now = Date.now();
    const inWindow = now >= (kickoffMs - NEXT_MATCH_LIVE_BAR_LEAD_MS) && now <= (kickoffMs + NEXT_MATCH_LIVE_BAR_TAIL_MS);
    el.style.display = inWindow ? '' : 'none';
  }

  // 상대전적(H2H) 요약 한 줄 — computeH2HHistory 결과 하나를 받아 렌더링합니다.
  // 기록이 아예 없으면(예: 진짜 첫 맞대결이 아니라 아직 데이터가 없는 경우까지 포함) 그냥 아무것도 띄우지 않습니다.
  function nextMatchH2HSummaryHtml(h2h) {
    if (!h2h || !h2h.played) return '';
    const gdTxt = h2h.goalDiff > 0 ? `+${h2h.goalDiff}` : `${h2h.goalDiff}`;
    const gdClass = h2h.goalDiff > 0 ? 'gd-pos' : (h2h.goalDiff < 0 ? 'gd-neg' : 'gd-zero');
    const playedTxt = isKorean ? `역대 상대전적 ${h2h.played}경기` : `H2H · ${h2h.played} PLD`;
    return `
      <div class="ti-next-match-h2h">
        <span class="ti-next-match-h2h-played">${playedTxt}</span>
        <span class="ti-next-match-h2h-wdl">
          <b class="ti-h2h-w">${h2h.won}${isKorean ? '승' : 'W'}</b>
          <b class="ti-h2h-d">${h2h.drawn}${isKorean ? '무' : 'D'}</b>
          <b class="ti-h2h-l">${h2h.lost}${isKorean ? '패' : 'L'}</b>
        </span>
        <span class="ti-next-match-h2h-gd ${gdClass}">${isKorean ? '득실차 ' : 'GD '}${gdTxt}</span>
      </div>`;
  }

  // 최근 5경기 폼(computeFormGuide 결과)을 작은 배지 열로 그려줍니다.
  // "다음 경기" 카드에서 우리 팀 vs 다음 상대의 최근 폼을 나란히 비교하는 데 사용합니다.
  function h2hFormDotsHtml(form) {
    const results = form ? form.recentForm.map(m => m.result) : [];
    if (!results.length) {
      return `<span class="ti-h2h-form-empty lbl" data-en="No matches yet" data-ko="경기 기록 없음">${isKorean ? '경기 기록 없음' : 'No matches yet'}</span>`;
    }
    const label = { W: isKorean ? '승' : 'W', D: isKorean ? '무' : 'D', L: isKorean ? '패' : 'L' };
    return results.map(r => `<span class="ti-h2h-form-dot ti-h2h-form-${r.toLowerCase()}">${label[r]}</span>`).join('');
  }

  // "다음 경기" 카드용 각 팀의 최근 폼 배지 한 줄. 해당 팀 컬럼(로고/이름 아래)에
  // 바로 붙여서 보여주므로, 팀 하나의 폼만 계산해서 돌려줍니다.
  function nextMatchTeamFormHtml(nameEn, nameKo) {
    if (typeof computeFormGuide !== 'function') return '';
    const form = computeFormGuide(nameEn, nameKo);
    return `<div class="ti-next-match-team-form">${h2hFormDotsHtml(form)}</div>`;
  }

  // "다음 경기" 카드용 승/무/패 확률 미니 예측 — predictSingleMatch(포아송 기반)를 그대로 써서
  // 홈/원정 팀의 승/무/패 %와 예상 스코어를 스택형 막대 + 텍스트로 보여줍니다.
  // 통계적으로 엄밀한 예측이 아니라 재미 요소이므로 "참고용" 문구를 함께 노출합니다.
  function nextMatchPredictHtml(team, nm) {
    if (typeof predictSingleMatch !== 'function') return '';
    if (!nm.oppEn) return '';

    const homeEn = nm.homeAway === 'H' ? team.nameEn : nm.oppEn;
    const homeKo = nm.homeAway === 'H' ? team.nameKo : nm.oppKo;
    const awayEn = nm.homeAway === 'H' ? nm.oppEn : team.nameEn;
    const awayKo = nm.homeAway === 'H' ? nm.oppKo : team.nameKo;

    let pred;
    try {
      pred = predictSingleMatch(homeEn, homeKo, awayEn, awayKo);
    } catch (e) {
      return '';
    }
    if (!pred) return '';

    const homePct = Math.round(pred.homeWinPct);
    const drawPct = Math.round(pred.drawPct);
    // 반올림 오차로 합이 100을 벗어나지 않도록 원정 승률은 나머지로 계산
    const awayPct = Math.max(0, 100 - homePct - drawPct);

    const homeShort = isKorean ? homeKo.split(' ')[0] : homeEn.split(' ')[0];
    const awayShort = isKorean ? awayKo.split(' ')[0] : awayEn.split(' ')[0];

    const scoreTxt = `${pred.predictedHomeGoals} : ${pred.predictedAwayGoals}`;
    const scoreLabelEn = `Predicted score ${homeShort} ${scoreTxt} ${awayShort}`;
    const scoreLabelKo = `예상 스코어 ${homeShort} ${scoreTxt} ${awayShort}`;

    // AI 예측 성적표에 쌓인 오차 패턴으로 자동 보정이 적용된 경우, 반영됐다는
    // 사실을 짧게 알려줍니다(계수 자체는 트랙레코드 섹션에서 확인 가능).
    const correctionNoteHtml = pred.correctionApplied
      ? `<div class="ti-next-match-predict-correction lbl" data-en="Auto-corrected using past prediction errors" data-ko="지난 예측 오차를 반영해 자동 보정됨">${isKorean ? '지난 예측 오차를 반영해 자동 보정됨' : 'Auto-corrected using past prediction errors'}</div>`
      : '';

    return `
      <div class="ti-next-match-predict">
        <div class="ti-next-match-predict-label lbl" data-en="Match Prediction (fun stat)" data-ko="경기 예측 (참고용)">${isKorean ? '경기 예측 (참고용)' : 'Match Prediction (fun stat)'}</div>
        <div class="ti-next-match-predict-bar">
          <span class="ti-predict-seg ti-predict-home" style="width:${homePct}%" title="${homeShort} ${homePct}%"></span>
          <span class="ti-predict-seg ti-predict-draw" style="width:${drawPct}%" title="${isKorean ? '무' : 'Draw'} ${drawPct}%"></span>
          <span class="ti-predict-seg ti-predict-away" style="width:${awayPct}%" title="${awayShort} ${awayPct}%"></span>
        </div>
        <div class="ti-next-match-predict-pcts">
          <span class="ti-predict-pct ti-predict-pct-home"><b>${homePct}%</b> ${homeShort}</span>
          <span class="ti-predict-pct ti-predict-pct-draw"><b>${drawPct}%</b> ${isKorean ? '무' : 'Draw'}</span>
          <span class="ti-predict-pct ti-predict-pct-away"><b>${awayPct}%</b> ${awayShort}</span>
        </div>
        <div class="ti-next-match-predict-score lbl" data-en="${scoreLabelEn}" data-ko="${scoreLabelKo}">${isKorean ? scoreLabelKo : scoreLabelEn}</div>
        ${correctionNoteHtml}
        <div class="ti-next-match-predict-note lbl" data-en="Based on recent form &amp; goal averages — just for fun, not a real forecast." data-ko="최근 폼과 득점 평균으로 계산한 참고용 수치예요. 통계적으로 정확하진 않아요.">${isKorean ? '최근 폼과 득점 평균으로 계산한 참고용 수치예요. 통계적으로 정확하진 않아요.' : "Based on recent form & goal averages — just for fun, not a real forecast."}</div>
      </div>`;
  }

  // scheduledRounds에서 다음 상대를 자동으로 찾아(computeNextMatchPreview) 홈/원정,
  // 그 상대와의 H2H, 킥오프까지 남은 시간(카운트다운)까지 한 카드로 묶어 보여줍니다.
  function nextMatchOpponentHtml(team, myRank) {
    const preview = (typeof computeNextMatchPreview === 'function')
      ? computeNextMatchPreview(team.nameEn, team.nameKo)
      : null;
    const nm = preview || team.nextMatch;

    if (!nm || nm.isBye) {
      return `
        <div class="ti-next-match ti-next-bye">
          <span class="lbl" data-en="Bye week — no match this round" data-ko="이번 라운드는 휴식주입니다">${isKorean ? '이번 라운드는 휴식주입니다' : 'Bye week — no match this round'}</span>
        </div>`;
    }
    const ranked = getRankedTeams('all');
    const oppIdx = ranked.findIndex(rt => rt.nameEn === nm.oppEn);
    const oppRank = oppIdx !== -1 ? oppIdx + 1 : null;
    const rankBadge = (r) => r ? `<span class="ti-next-match-rank">${isKorean ? r + '위' : '#' + r}</span>` : '';

    const haClass = nm.homeAway === 'H' ? 'ha-home' : 'ha-away';
    const oppName = isKorean ? nm.oppKo : nm.oppEn;
    const nextWeek = nm.roundKey ? parseInt(nm.roundKey.replace('round', ''), 10) : (sortedRoundKeys().length + 1);
    const kickoffTxt = formatKickoff(nm);
    const nextMatchHomeEn = nm.homeAway === 'H' ? team.nameEn : nm.oppEn;
    const nextMatchVenue = getTeamVenue(nextMatchHomeEn);
    const nextMatchVenueName = nextMatchVenue ? (isKorean ? nextMatchVenue.nameKo : nextMatchVenue.nameEn) : '';

    const kickoffMs = kickoffUTCMillis(nm.kickoffDate, nm.kickoffTime);
    const countdownHtml = kickoffMs
      ? `<div class="ti-next-match-countdown" data-kickoff-utc="${kickoffMs}">${formatCountdownText(kickoffMs - Date.now())}</div>`
      : '';
    const h2hHtml = isMyTeamName(team.nameEn, team.nameKo) ? nextMatchH2HSummaryHtml(nm.h2h) : '';
    // 승/무/패 확률 미니 예측도 우리 팀(치주물루) 카드에서만, 상대가 이번 시즌 리그 소속일 때만 보여줍니다.
    const predictHtml = (isMyTeamName(team.nameEn, team.nameKo) && leagueData.some(t => t.nameEn === nm.oppEn))
      ? nextMatchPredictHtml(team, nm)
      : '';

    // 상대가 이번 시즌 리그 소속일 때만(=폼 데이터가 있을 때만) 두 팀의 최근 폼을
    // 각자 자신의 팀 컬럼(로고/이름 아래)에 붙여서 보여줍니다. 우리 팀 카드에서만 노출합니다.
    const oppIsCurrentLeagueTeam = leagueData.some(t => t.nameEn === nm.oppEn);
    const showFormBadges = isMyTeamName(team.nameEn, team.nameKo) && oppIsCurrentLeagueTeam;
    const myFormHtml = showFormBadges ? nextMatchTeamFormHtml(team.nameEn, team.nameKo) : '';
    const oppFormHtml = showFormBadges ? nextMatchTeamFormHtml(nm.oppEn, nm.oppKo) : '';

    // 라운드 카드의 rmc-compare-btn과 동일한 "전적 비교" 버튼을 다음 경기 카드에도 동일하게 노출합니다.
    const nextMatchHomeKo = nm.homeAway === 'H' ? team.nameKo : nm.oppKo;
    const nextMatchAwayEn = nm.homeAway === 'H' ? nm.oppEn : team.nameEn;
    const nextMatchAwayKo = nm.homeAway === 'H' ? nm.oppKo : team.nameKo;
    const escAttr = (s) => String(s || '').replace(/'/g, "\\'");
    const compareBtnHtml = `<button type="button" class="rmc-compare-btn ti-next-match-compare-btn lbl" data-en="Compare Teams" data-ko="전적 비교" onclick="openMatchCompareModal('${escAttr(nextMatchHomeEn)}', '${escAttr(nextMatchHomeKo)}', '${escAttr(nextMatchAwayEn)}', '${escAttr(nextMatchAwayKo)}', '${escAttr(nm.roundKey)}')">⚖️ ${isKorean ? '전적 비교' : 'Compare Teams'}</button>`;

    // 우리 팀(치주물루)의 다음 경기 카드에서만 킥오프 현지 날씨 예보를 함께 보여줍니다.
    const weatherHtml = isMyTeamName(team.nameEn, team.nameKo)
      ? matchWeatherPlaceholderHtml(nextMatchHomeEn, nm.kickoffDate, nm.kickoffTime, 'ti-next-match-weather')
      : '';

    return `
      <div class="ti-next-match">
        <div class="ti-next-match-label lbl" data-en="Next Match · Week ${nextWeek}" data-ko="다음 경기 · ${nextWeek}주차">${isKorean ? `다음 경기 · ${nextWeek}주차` : `Next Match · Week ${nextWeek}`}</div>
        <div class="ti-next-match-body">
          <div class="ti-next-match-team">
            <img class="team-logo" src="${team.logoSrc}" alt="${team.nameEn}">
            <span class="lbl" data-en="${team.nameEn}" data-ko="${team.nameKo}">${isKorean ? team.nameKo : team.nameEn}</span>
            ${rankBadge(myRank)}
            ${myFormHtml}
          </div>
          <div class="ti-next-match-vs">
            <span class="ha-badge ${haClass}">${nm.homeAway}</span>
            <span class="ti-next-match-vs-text">VS</span>
          </div>
          <div class="ti-next-match-team">
            <img class="team-logo" data-en-name="${nm.oppEn}" data-ko-name="${nm.oppKo}" src="${nm.oppLogo}" alt="${nm.oppEn}">
            <span class="lbl" data-en="${nm.oppEn}" data-ko="${nm.oppKo}">${oppName}</span>
            ${rankBadge(oppRank)}
            ${oppFormHtml}
          </div>
        </div>
        ${kickoffTxt ? `<div class="ti-next-match-kickoff">${kickoffTxt}</div>` : ''}
        ${nextMatchVenueName ? `<div class="ti-next-match-venue">🏟️ ${nextMatchVenueName}</div>` : ''}
        ${weatherHtml}
        ${countdownHtml}
        ${predictHtml}
        ${h2hHtml}
        ${compareBtnHtml}
      </div>`;
  }

  // 홈 vs 원정 스플릿 카드 — computeHomeAwaySplit()(HOME_ADVANTAGE 로직 재사용)를 기반으로
  // 우리 팀의 실제 홈/원정 성적과, 같은 배율로 계산한 '평균 상대 기준' 기대 득점을 보여줍니다.
  function renderHomeAwaySplitCard(t) {
    if (typeof computeHomeAwaySplit !== 'function') return '';
    const split = computeHomeAwaySplit(t.nameEn, t.nameKo);
    const { home, away, expectedHomeGoals, expectedAwayGoals, homeAdvantageMultiplier } = split;

    const gdClass = (v) => v > 0 ? 'gd-pos' : (v < 0 ? 'gd-neg' : 'gd-zero');
    const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1);

    const sideHtml = (side, haLabel, haClass) => `
      <div class="ti-ha-col">
        <div class="ti-ha-col-label">
          <span class="ha-badge ${haClass}">${haLabel}</span>
          <span class="lbl" data-en="${haLabel === 'H' ? 'Home' : 'Away'}" data-ko="${haLabel === 'H' ? '홈' : '원정'}">${isKorean ? (haLabel === 'H' ? '홈' : '원정') : (haLabel === 'H' ? 'Home' : 'Away')}</span>
        </div>
        <div class="ti-ha-wdl">${side.won}-${side.drawn}-${side.lost}</div>
        <div class="ti-ha-sub lbl" data-en="${side.played} played" data-ko="${side.played}경기">${isKorean ? `${side.played}경기` : `${side.played} played`}</div>
        <div class="ti-ha-metrics">
          <div class="ti-ha-metric">
            <span class="ti-ha-metric-value">${side.ppg.toFixed(2)}</span>
            <span class="ti-ha-metric-label lbl" data-en="PTS/GAME" data-ko="경기당 승점">${isKorean ? '경기당 승점' : 'PTS/GAME'}</span>
          </div>
          <div class="ti-ha-metric">
            <span class="ti-ha-metric-value ${gdClass(side.gd)}">${side.gd}</span>
            <span class="ti-ha-metric-label lbl" data-en="GOAL DIFF" data-ko="득실차">${isKorean ? '득실차' : 'GOAL DIFF'}</span>
          </div>
        </div>
        <div class="ti-ha-goals lbl" data-en="${fmt1(side.gpg)} scored / ${fmt1(side.gapg)} conceded per game" data-ko="경기당 득점 ${fmt1(side.gpg)} · 실점 ${fmt1(side.gapg)}">${isKorean ? `경기당 득점 ${fmt1(side.gpg)} · 실점 ${fmt1(side.gapg)}` : `${fmt1(side.gpg)} scored / ${fmt1(side.gapg)} conceded per game`}</div>
      </div>`;

    const noteKo = `몬테카를로 예측에 쓰는 홈 보정계수(${homeAdvantageMultiplier}배)를 그대로 적용하면, 평균적인 상대를 만났을 때 기대 득점은 홈 ${fmt1(expectedHomeGoals)}골 · 원정 ${fmt1(expectedAwayGoals)}골이에요.`;
    const noteEn = `Using the same home-advantage multiplier (${homeAdvantageMultiplier}x) as the Monte Carlo predictor, expected goals vs an average opponent are ${fmt1(expectedHomeGoals)} at home and ${fmt1(expectedAwayGoals)} away.`;

    return `
      <div class="ti-card ti-ha-split-card">
        <div class="ti-card-title lbl" data-en="Home vs Away" data-ko="홈 vs 원정">${isKorean ? '홈 vs 원정' : 'Home vs Away'}</div>
        <div class="ti-ha-split-grid">
          ${sideHtml(home, 'H', 'ha-home')}
          ${sideHtml(away, 'A', 'ha-away')}
        </div>
        <div class="ti-ha-note lbl" data-en="${noteEn}" data-ko="${noteKo}">${isKorean ? noteKo : noteEn}</div>
      </div>`;
  }

  // 폼 가이드 카드 마크업 — 우리 팀 뿐 아니라 다른 팀에도 재사용할 수 있도록
  // team만 인자로 받는 형태로 뽑아둡니다 (computeFormGuide 자체가 nameEn/nameKo를 받는 범용 함수라 그대로 활용).
  // ===== 휴식 라운드(bye) 전후 승점 흐름 계산 =====
  // roundsData(완료된 라운드) + scheduledRounds(아직 안 옮겨졌지만 스코어는 채워진 라운드)를
  // 라운드 순서대로 훑어서 이 팀의 경기 결과(W/D/L) 시퀀스를 만들고, 그 안에서 휴식 라운드를
  // 찾아 앞 구간(before)/뒤 구간(after)으로 나눕니다.
  function computeByeWeekFlow(nameEn, nameKo) {
    const merged = {};
    Object.keys(roundsData || {}).forEach(k => { merged[k] = roundsData[k]; });
    Object.keys(scheduledRounds || {}).forEach(k => { if (!merged[k]) merged[k] = scheduledRounds[k]; });

    const allRoundKeys = Object.keys(merged).sort((a, b) =>
      parseInt(a.replace('round', ''), 10) - parseInt(b.replace('round', ''), 10));
    // 휴식 라운드가 '실제로 지난' 경우만 흐름 계산에 넣습니다. scheduledRounds에는
    // 아직 열리지 않은 미래 라운드까지 미리 채워져 있을 수 있어서, 결과가 하나도
    // 없는(=아직 안 지난) 라운드는 걸러내야 미래 휴식주가 미리 표시되지 않습니다.
    const roundKeys = allRoundKeys.filter(k => roundHasAnyResult(k));

    const timeline = [];
    roundKeys.forEach(key => {
      const roundNum = parseInt(key.replace('round', ''), 10);
      const matches = merged[key] || [];
      for (const m of matches) {
        if (m.byeEn === nameEn || m.byeKo === nameKo) {
          timeline.push({ round: roundNum, type: 'bye' });
          return;
        }
        if (m.homeEn === nameEn || m.awayEn === nameEn) {
          // 연기(postponed)되었거나 아직 스코어가 없는 예정 경기는 결과 시퀀스에 넣지 않습니다.
          if (m.postponed || typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;
          const isHome = m.homeEn === nameEn;
          const my = isHome ? m.homeScore : m.awayScore;
          const opp = isHome ? m.awayScore : m.homeScore;
          const result = my > opp ? 'W' : (my < opp ? 'L' : 'D');
          timeline.push({
            round: roundNum, type: 'match', result,
            opponentEn: isHome ? m.awayEn : m.homeEn,
            opponentKo: isHome ? m.awayKo : m.homeKo
          });
          return;
        }
      }
    });

    const byeIdx = timeline.findIndex(e => e.type === 'bye');
    if (byeIdx === -1) {
      // 이번 시즌 아직 휴식 라운드를 치르지 않은 팀: scheduledRounds에 예정된 휴식 라운드가
      // 있으면 안내용으로 그 주차만 알려줍니다.
      let upcomingBye = null;
      allRoundKeys.forEach(key => {
        const roundNum = parseInt(key.replace('round', ''), 10);
        (merged[key] || []).forEach(m => {
          if (!upcomingBye && (m.byeEn === nameEn || m.byeKo === nameKo)) upcomingBye = roundNum;
        });
      });
      return { hasBye: false, upcomingBye };
    }

    const before = timeline.slice(0, byeIdx).filter(e => e.type === 'match');
    const after = timeline.slice(byeIdx + 1).filter(e => e.type === 'match');

    function summarize(games) {
      let won = 0, drawn = 0, lost = 0, points = 0;
      games.forEach(g => {
        if (g.result === 'W') { won += 1; points += 3; }
        else if (g.result === 'D') { drawn += 1; points += 1; }
        else { lost += 1; }
      });
      return { games, played: games.length, won, drawn, lost, points, ppg: games.length ? points / games.length : 0 };
    }

    return { hasBye: true, byeRound: timeline[byeIdx].round, before: summarize(before), after: summarize(after) };
  }

  // 휴식 전/후 폼을 하나의 누적 승점 흐름 SVG + 전/후 요약 카드로 그립니다.
  // 차트는 가독성을 위해 휴식 전 최근 5경기 + 휴식 라운드 + 휴식 후 최대 8경기만 표시하고,
  // 요약 숫자(경기당 승점 등)는 휴식 전/후 전체 경기를 기준으로 계산합니다.
  function renderByeWeekFlowCard(t) {
    const flow = (typeof computeByeWeekFlow === 'function') ? computeByeWeekFlow(t.nameEn, t.nameKo) : null;
    if (!flow) return '';

    const titleHtml = `<summary class="ti-card-title ti-bye-flow-toggle lbl" data-en="Bye Week Flow" data-ko="휴식 주간 전후 흐름">${isKorean ? '휴식 주간 전후 흐름' : 'Bye Week Flow'}</summary>`;

    if (!flow.hasBye) {
      const bodyKo = flow.upcomingBye
        ? `${flow.upcomingBye}주차에 휴식 라운드가 예정되어 있어요. 그 전후 경기가 쌓이면 여기에 흐름이 표시됩니다.`
        : '이번 시즌 휴식 라운드 일정이 아직 없어요.';
      const bodyEn = flow.upcomingBye
        ? `This team's bye is scheduled for round ${flow.upcomingBye}. The flow will appear here once matches on both sides are played.`
        : 'No bye round is scheduled for this team yet.';
      return `
        <details class="ti-card ti-bye-flow-card">
          ${titleHtml}
          <div class="ti-bye-flow-empty lbl" data-en="${bodyEn}" data-ko="${bodyKo}">${isKorean ? bodyKo : bodyEn}</div>
        </details>`;
    }

    const resultColor = (r) => r === 'W' ? 'var(--color-teal)' : (r === 'D' ? 'var(--color-neutral-mid)' : 'var(--color-red)');

    const beforeWindow = flow.before.games.slice(-5);
    const afterWindow = flow.after.games.slice(0, 8);
    const entries = [
      ...beforeWindow.map(g => ({ type: 'match', round: g.round, result: g.result })),
      { type: 'bye', round: flow.byeRound },
      ...afterWindow.map(g => ({ type: 'match', round: g.round, result: g.result }))
    ];

    const n = entries.length;
    const marginL = 44, marginR = 24;
    const plotW = Math.max(260, (n - 1) * 62);
    const W = marginL + plotW + marginR;
    const top = 26, plotH = 120, bottom = 46;
    const H = top + plotH + bottom;

    let cum = 0;
    const cumValues = entries.map(e => {
      if (e.type === 'match') cum += e.result === 'W' ? 3 : (e.result === 'D' ? 1 : 0);
      return cum;
    });
    const cumMax = Math.max(1, Math.max.apply(null, cumValues));

    const xAt = (i) => n > 1 ? marginL + (i * plotW) / (n - 1) : marginL + plotW / 2;
    const yAt = (v) => top + plotH - (v / cumMax) * plotH;
    const byeIndex = entries.findIndex(e => e.type === 'bye');

    let linesSvg = '';
    for (let i = 1; i < n; i++) {
      const x1 = xAt(i - 1), y1 = yAt(cumValues[i - 1]);
      const x2 = xAt(i), y2 = yAt(cumValues[i]);
      const isByeSegment = (i - 1 === byeIndex || i === byeIndex);
      linesSvg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${isByeSegment ? 'var(--color-text-faint)' : 'var(--color-teal-dark)'}" stroke-width="2" stroke-linecap="round"${isByeSegment ? ' stroke-dasharray="4 3"' : ''}/>`;
    }

    let pointsSvg = '', ticksSvg = '';
    entries.forEach((e, i) => {
      const x = xAt(i), y = yAt(cumValues[i]);
      if (e.type === 'bye') {
        pointsSvg += `<line x1="${x.toFixed(1)}" y1="10" x2="${x.toFixed(1)}" y2="${(top + plotH + 6).toFixed(1)}" stroke="var(--color-gold-strong)" stroke-width="1" stroke-dasharray="3 3"/>`;
        pointsSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="var(--color-surface)" stroke="var(--color-gold-strong)" stroke-width="2"/>`;
        ticksSvg += `<text x="${x.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="800" fill="var(--color-gold-strong)">${isKorean ? '휴식' : 'Bye'}</text>`;
      } else {
        pointsSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${resultColor(e.result)}"/>`;
        ticksSvg += `<text x="${x.toFixed(1)}" y="${(H - 8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="var(--color-text-faint)">${isKorean ? e.round + '주' : 'R' + e.round}</text>`;
      }
    });

    const chartSvg = `
      <svg class="ti-bye-flow-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
        <title>${isKorean ? '휴식 주간 전후 누적 승점 흐름' : 'Cumulative points before and after the bye week'}</title>
        ${linesSvg}${pointsSvg}${ticksSvg}
      </svg>`;

    const legendHtml = `
      <div class="ti-bye-flow-legend">
        <span><i class="ti-bye-dot" style="background:var(--color-teal)"></i>${isKorean ? '승' : 'W'}</span>
        <span><i class="ti-bye-dot" style="background:var(--color-neutral-mid)"></i>${isKorean ? '무' : 'D'}</span>
        <span><i class="ti-bye-dot" style="background:var(--color-red)"></i>${isKorean ? '패' : 'L'}</span>
        <span><i class="ti-bye-dot ti-bye-dot-hollow"></i>${isKorean ? '휴식' : 'Bye'}</span>
      </div>`;

    const delta = flow.after.played > 0 ? (flow.after.ppg - flow.before.ppg) : null;
    let deltaHtml = '';
    if (delta !== null) {
      const up = delta > 0.001, down = delta < -0.001;
      const cls = up ? 'ti-bye-flow-delta-up' : (down ? 'ti-bye-flow-delta-down' : 'ti-bye-flow-delta-flat');
      const arrow = up ? '▲' : (down ? '▼' : '—');
      const txtKo = up ? '휴식 후 폼 상승' : (down ? '휴식 후 폼 하락' : '휴식 전후 비슷');
      const txtEn = up ? 'Form improved after the bye' : (down ? 'Form dipped after the bye' : 'Form roughly unchanged');
      const sign = delta >= 0 ? '+' : '';
      deltaHtml = `<div class="ti-bye-flow-delta ${cls} lbl" data-en="${txtEn} (${sign}${delta.toFixed(2)})" data-ko="${txtKo} (${sign}${delta.toFixed(2)})">${arrow} ${sign}${delta.toFixed(2)}</div>`;
    }

    function sideCardHtml(labelHtml, side, extraHtml) {
      const formHtml = side.games.slice(-6).map(g =>
        `<span class="form-badge form-${g.result.toLowerCase()}">${g.result}</span>`
      ).join('');
      return `
        <div class="ti-bye-flow-col">
          <div class="ti-bye-flow-col-label">${labelHtml}</div>
          <div class="form-cell">${formHtml || `<span class="ti-bye-flow-nogames lbl" data-en="No matches yet" data-ko="경기 기록 없음">${isKorean ? '경기 기록 없음' : 'No matches yet'}</span>`}</div>
          <div class="ti-bye-flow-ppg">${side.ppg.toFixed(2)}<span class="ti-bye-flow-ppg-label lbl" data-en="PTS/GAME" data-ko="경기당 승점">${isKorean ? '경기당 승점' : 'PTS/GAME'}</span></div>
          ${extraHtml || ''}
        </div>`;
    }

    const beforeLabelKo = `휴식 전 ${flow.before.played}경기`, beforeLabelEn = `${flow.before.played} before bye`;
    const afterLabelKo = `휴식 후 ${flow.after.played}경기`, afterLabelEn = `${flow.after.played} after bye`;

    return `
      <details class="ti-card ti-bye-flow-card">
        ${titleHtml}
        <div class="ti-bye-flow-svg-wrap">${chartSvg}</div>
        ${legendHtml}
        <div class="ti-bye-flow-summary">
          ${sideCardHtml(`<span class="lbl" data-en="${beforeLabelEn}" data-ko="${beforeLabelKo}">${isKorean ? beforeLabelKo : beforeLabelEn}</span>`, flow.before, '')}
          ${sideCardHtml(`<span class="lbl" data-en="${afterLabelEn}" data-ko="${afterLabelKo}">${isKorean ? afterLabelKo : afterLabelEn}</span>`, flow.after, deltaHtml)}
        </div>
      </details>`;
  }

  function buildFormGuideCardHtml(t) {
    const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : 'gd-zero');

    // roundsData 순서대로 해당 팀의 W/D/L을 훑어서 최근 폼 + 역대 연승/무패 기록을 계산합니다.
    const guide = (typeof computeFormGuide === 'function') ? computeFormGuide(t.nameEn, t.nameKo) : null;
    const recentForm = guide ? guide.recentForm.map(m => m.result) : t.form;

    let formHtml = '';
    recentForm.forEach(f => {
      const fClass = f === 'W' ? 'form-w' : (f === 'D' ? 'form-d' : 'form-l');
      formHtml += `<span class="form-badge ${fClass}">${f}</span>`;
    });

    // 지금까지 이어지고 있는 연승/무패 행진이 2경기 이상이면 작은 배지로 강조합니다.
    let currentStreakHtml = '';
    if (guide) {
      if (guide.currentWinStreak >= 2) {
        const txt = isKorean ? `${guide.currentWinStreak}연승 중` : `${guide.currentWinStreak}-game win streak`;
        currentStreakHtml = `<span class="ti-streak-live ti-streak-live-win lbl" data-en="${guide.currentWinStreak}-game win streak" data-ko="${guide.currentWinStreak}연승 중">${txt}</span>`;
      } else if (guide.currentUnbeatenStreak >= 2) {
        const txt = isKorean ? `${guide.currentUnbeatenStreak}경기 무패 중` : `Unbeaten in ${guide.currentUnbeatenStreak}`;
        currentStreakHtml = `<span class="ti-streak-live ti-streak-live-unbeaten lbl" data-en="Unbeaten in ${guide.currentUnbeatenStreak}" data-ko="${guide.currentUnbeatenStreak}경기 무패 중">${txt}</span>`;
      }
    }

    // 최다 연승/무패 기록은 "N연승 (3~7주차)"처럼 기록이 세워진 구간까지 함께 보여줍니다.
    function streakRangeLabel(streak) {
      if (!streak || streak.count === 0) return isKorean ? '기록 없음' : 'No streak yet';
      const weekLbl = (w) => isKorean ? `${w}주차` : `Wk ${w}`;
      return streak.startWeek === streak.endWeek
        ? weekLbl(streak.startWeek)
        : `${weekLbl(streak.startWeek)}~${weekLbl(streak.endWeek).replace(/^Wk /, '')}`;
    }

    const streakGuideHtml = guide ? `
      <div class="ti-streak-row">
        <div class="ti-streak-item">
          <span class="ti-streak-value">${guide.longestWinStreak.count}${isKorean ? '연승' : 'W'}</span>
          <span class="ti-streak-label lbl" data-en="Longest Win Streak" data-ko="역대 최다 연승">${isKorean ? '역대 최다 연승' : 'Longest Win Streak'}</span>
          <span class="ti-streak-sub">${streakRangeLabel(guide.longestWinStreak)}</span>
        </div>
        <div class="ti-streak-item">
          <span class="ti-streak-value">${guide.longestUnbeatenStreak.count}${isKorean ? '경기' : ''}</span>
          <span class="ti-streak-label lbl" data-en="Longest Unbeaten Run" data-ko="역대 최다 무패">${isKorean ? '역대 최다 무패' : 'Longest Unbeaten Run'}</span>
          <span class="ti-streak-sub">${streakRangeLabel(guide.longestUnbeatenStreak)}</span>
        </div>
      </div>` : '';

    return `
      <div class="ti-card ti-form-card">
        <div class="ti-form-card-head">
          <div class="ti-card-title lbl" data-en="Form Guide" data-ko="폼 가이드">${isKorean ? '폼 가이드' : 'Form Guide'}</div>
          ${currentStreakHtml}
        </div>
        <div class="form-cell ti-form-badges">${formHtml}</div>
        ${streakGuideHtml}
        <div class="ti-mini-stats">
          <div class="ti-mini-stat">
            <span class="ti-mini-num">${t.goalsFor}</span>
            <span class="ti-mini-label lbl" data-en="Goals For" data-ko="득점">${isKorean ? '득점' : 'Goals For'}</span>
          </div>
          <div class="ti-mini-stat">
            <span class="ti-mini-num">${t.goalsAgainst}</span>
            <span class="ti-mini-label lbl" data-en="Goals Against" data-ko="실점">${isKorean ? '실점' : 'Goals Against'}</span>
          </div>
          <div class="ti-mini-stat">
            <span class="ti-mini-num ${gdClass}">${t.gd}</span>
            <span class="ti-mini-label lbl" data-en="Goal Diff" data-ko="득실차">${isKorean ? '득실차' : 'Goal Diff'}</span>
          </div>
        </div>
      </div>`;
  }

  function renderTeamInfoOverview() {
    const el = document.getElementById('teamInfoOverviewTab');
    if (!el) return;
    const info = getMyRankedTeam();
    if (!info) { el.innerHTML = ''; return; }
    const t = info.team;

    const formGuideHtml = buildFormGuideCardHtml(t);
    const homeAwayHtml = renderHomeAwaySplitCard(t);
    const byeFlowHtml = renderByeWeekFlowCard(t);

    el.innerHTML = `
      <div class="ti-overview-grid">
        ${formGuideHtml}
        ${homeAwayHtml}
        ${byeFlowHtml}
      </div>
    `;
    attachImageFallback();
  }

  function renderTeamAwardsTab() {
    const el = document.getElementById('teamInfoAwardsTab');
    if (!el) return;
    el.innerHTML = renderTeamAwardsCard();
    attachImageFallback();
  }

  // 등번호로 선수 정보를 찾아 얼굴 사진이 들어간 수상 카드 마크업을 반환
  function awardPlayerHtml(number, badgeText) {
    const sq = squadData.find(p => p.number === number);
    if (!sq) return '';
    const name = isKorean ? sq.nameKo : sq.nameEn;
    const photo = sq.photoSrc
      ? `<img class="ti-award-card-photo" src="${sq.photoSrc}" alt="${sq.nameEn}">`
      : `<div class="ti-award-card-photo ti-award-card-photo-placeholder">⭐</div>`;
    return `
      <div class="ti-award-card-item" data-player-number="${sq.number}">
        <div class="ti-award-card-badge">${badgeText}</div>
        ${photo}
        <div class="ti-award-card-number">#${sq.number}</div>
        <div class="ti-award-card-name lbl" data-en="${sq.nameEn}" data-ko="${sq.nameKo}">${name}</div>
      </div>`;
  }

  const MONTH_LABELS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function formatAwardMonth(ymKey) {
    const [y, m] = ymKey.split('-').map(Number);
    return isKorean ? `${m}월` : MONTH_LABELS_EN[m - 1];
  }

  // 골키퍼 개인 무실점(클린시트) 기록 카드 마크업 — 독립된 카드로, 스태프 카드 위에 노출합니다.
  // computeGoalkeeperRecords()가 없거나 기록이 하나도 없으면 빈 문자열을 반환합니다.
  function renderGoalkeeperRecordCard() {
    const records = (typeof computeGoalkeeperRecords === 'function') ? computeGoalkeeperRecords() : [];
    if (!records.length) return '';

    const cardsHtml = records.map(r => {
      const csRate = r.appearances > 0 ? Math.round((r.cleanSheets / r.appearances) * 100) : 0;
      const sq = squadData.find(p => p.number === r.number);
      const photo = sq && sq.photoSrc
        ? `<img class="ti-gk-card-photo" src="${sq.photoSrc}" alt="${sq.nameEn || r.nameKo}">`
        : `<div class="ti-gk-card-photo ti-gk-card-photo-placeholder">🧤</div>`;

      return `
        <div class="ti-gk-card-item" data-player-number="${r.number}">
          <div class="ti-gk-card-number">#${r.number}</div>
          ${photo}
          <div class="ti-gk-card-name lbl" data-en="${sq ? sq.nameEn : r.nameKo}" data-ko="${r.nameKo}">${r.nameKo}</div>
          <div class="ti-gk-card-stats">
            <span class="ti-gk-stat"><b>${r.appearances}</b><small class="lbl" data-en="APP" data-ko="출전">${isKorean ? '출전' : 'APP'}</small></span>
            <span class="ti-gk-stat ti-gk-stat-cs"><b>${r.cleanSheets}</b><small class="lbl" data-en="CS" data-ko="무실점">${isKorean ? '무실점' : 'CS'}</small></span>
            <span class="ti-gk-stat"><b>${r.goalsConceded}</b><small class="lbl" data-en="CONC" data-ko="실점">${isKorean ? '실점' : 'CONC'}</small></span>
            <span class="ti-gk-stat"><b>${csRate}%</b><small class="lbl" data-en="CS RATE" data-ko="무실점률">${isKorean ? '무실점률' : 'CS RATE'}</small></span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="ti-card ti-gk-card">
        <div class="ti-card-title lbl" data-en="Goalkeeper Clean Sheets" data-ko="골키퍼 무실점 기록">${isKorean ? '골키퍼 무실점 기록' : 'Goalkeeper Clean Sheets'}</div>
        <div class="ti-gk-card-note lbl" data-en="Based on starting appearances" data-ko="선발 출전 기준">${isKorean ? '선발 출전 기준' : 'Based on starting appearances'}</div>
        <div class="ti-gk-card-row">${cardsHtml}</div>
      </div>`;
  }

  // 맨 오브 더 매치 / 이달의 선수 카드 렌더링 (teamAwards 기반)
  function renderTeamAwardsCard() {
    if (typeof teamAwards === 'undefined') return '';


    const motmKeys = Object.keys(teamAwards.motm || {})
      .filter(key => (teamAwards.motm[key] || []).length)
      .sort((a, b) => {
        const na = parseInt(a.replace('round', ''), 10);
        const nb = parseInt(b.replace('round', ''), 10);
        return nb - na; // 최신 라운드 먼저
      });

    // 라운드별로 여러 명이 공동 수상할 수 있으므로, 선수 1명당 카드 1개로 펼쳐서
    // 최신 라운드가 맨 왼쪽에 오도록 좌우 나열합니다.
    const motmHtml = motmKeys.map(key => {
      const weekNum = parseInt(key.replace('round', ''), 10);
      const weekLabel = isKorean ? `${weekNum}주차` : `Wk ${weekNum}`;
      return teamAwards.motm[key].map(number => awardPlayerHtml(number, weekLabel)).join('');
    }).join('');

    const potmKeys = Object.keys(teamAwards.playerOfTheMonth || {}).sort().reverse();
    const potmHtml = potmKeys.map(ymKey => {
      const [, mNum] = ymKey.split('-').map(Number);
      const monthLabel = isKorean ? `${mNum}월` : MONTH_LABELS_EN[mNum - 1];
      return awardPlayerHtml(teamAwards.playerOfTheMonth[ymKey], monthLabel);
    }).join('');

    const gotmKeys = Object.keys(teamAwards.goalOfTheMonth || {}).sort().reverse();
    const gotmHtml = gotmKeys.map(ymKey => {
      const [, mNum] = ymKey.split('-').map(Number);
      const monthLabel = isKorean ? `${mNum}월` : MONTH_LABELS_EN[mNum - 1];
      return awardPlayerHtml(teamAwards.goalOfTheMonth[ymKey], monthLabel);
    }).join('');

    if (!motmHtml && !potmHtml && !gotmHtml) return '';

    return `
      <div class="ti-card ti-awards-card">
        <div class="ti-card-title lbl" data-en="Awards" data-ko="수상 정보">${isKorean ? '수상 정보' : 'Awards'}</div>
        ${potmHtml ? `
          <div class="ti-award-group">
            <div class="ti-award-group-title lbl" data-en="Player of the Month" data-ko="이달의 선수">${isKorean ? '이달의 선수' : 'Player of the Month'}</div>
            <div class="ti-award-card-row ti-award-card-row-compact">${potmHtml}</div>
          </div>` : ''}
        ${gotmHtml ? `
          <div class="ti-award-group">
            <div class="ti-award-group-title lbl" data-en="Goal of the Month" data-ko="이달의 골">${isKorean ? '이달의 골' : 'Goal of the Month'}</div>
            <div class="ti-award-card-row ti-award-card-row-compact">${gotmHtml}</div>
          </div>` : ''}
        ${motmHtml ? `
          <div class="ti-award-group">
            <div class="ti-award-group-title lbl" data-en="Man of the Match" data-ko="맨 오브 더 매치">${isKorean ? '맨 오브 더 매치' : 'Man of the Match'}</div>
            <div class="ti-award-card-row ti-award-card-row-scroll">${motmHtml}</div>
          </div>` : ''}
      </div>`;
  }

  // 스태프 명단 카드 렌더링 (staffData 기반)
  function renderTeamStaffCard() {
    if (typeof staffData === 'undefined' || !staffData.length) return '';

    const rowsHtml = staffData.map(s => {
      const peopleHtml = s.people.map(p => {
        const name = isKorean ? p.nameKo : (p.nameEn || p.nameKo);
        return `<span class="ti-staff-person">${name}</span>`;
      }).join('');
      return `
        <div class="ti-staff-row">
          <span class="ti-staff-role lbl" data-en="${s.roleEn}" data-ko="${s.roleKo}">${isKorean ? s.roleKo : s.roleEn}</span>
          <span class="ti-staff-people">${peopleHtml}</span>
        </div>`;
    }).join('');

    return `
      <div class="ti-card ti-staff-card">
        <div class="ti-card-title lbl" data-en="Staff" data-ko="스태프">${isKorean ? '스태프' : 'Staff'}</div>
        ${rowsHtml}
      </div>`;
  }

  // 기록 카드 마크업 — 우리 팀(치주물루) 뿐 아니라 다른 팀에도 그대로 재사용할 수 있도록
  // team/rank/total을 인자로 받는 형태로 뽑아둡니다.
  // ===== 공격/수비 지수 (리그 평균 대비 득점력·실점력, 100% = 리그 평균) =====
  // xG처럼 슈팅 데이터가 없어도, 골 데이터만으로 "리그 평균 대비 이 팀 공격/수비가
  // 얼마나 강한지"를 한눈에 비교할 수 있는 지수입니다. getRankedTeams('all')로 리그
  // 전체 팀의 경기당 득점을 평균 내서 기준선(100%)을 잡고, 그 대비 비율(%)로 표시합니다.
  function computeLeagueAvgGoalsPerGame() {
    const teams = (typeof getRankedTeams === 'function') ? getRankedTeams('all') : [];
    let goals = 0, games = 0;
    teams.forEach(t => { goals += (t.goalsFor || 0); games += (t.played || 0); });
    return games > 0 ? goals / games : 0;
  }

  function indexClass(idx) {
    if (idx === null) return 'idx-avg';
    if (idx > 105) return 'idx-good';
    if (idx < 95) return 'idx-bad';
    return 'idx-avg';
  }

  function buildRecordCardHtml(t, rank, total) {
    const gpg = t.played > 0 ? (t.goalsFor / t.played).toFixed(1) : '0.0';
    const gapg = t.played > 0 ? (t.goalsAgainst / t.played).toFixed(1) : '0.0';
    const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : 'gd-zero');
    const { home, away } = computeHomeAwayRecord(t.nameEn, t.nameKo);
    const homeAwayValue = (rec) => `${rec.won}/${rec.played}${isKorean ? '승' : ' W'}`;

    const leagueAvgGpg = computeLeagueAvgGoalsPerGame();
    const played = t.played || 0;
    const gfPerGame = played > 0 ? t.goalsFor / played : 0;
    const gaPerGame = played > 0 ? t.goalsAgainst / played : 0;
    const attackIndex = (played > 0 && leagueAvgGpg > 0) ? Math.round((gfPerGame / leagueAvgGpg) * 100) : null;
    const defensePerfect = played > 0 && t.goalsAgainst === 0;
    const defenseIndex = (played > 0 && leagueAvgGpg > 0 && !defensePerfect)
      ? Math.round((leagueAvgGpg / gaPerGame) * 100) : null;

    const attackValue = attackIndex !== null
      ? `<span class="${indexClass(attackIndex)}">${attackIndex}%</span>` : '-';
    const defenseValue = defensePerfect
      ? `<span class="idx-good lbl" data-en="Perfect" data-ko="무실점">${isKorean ? '무실점' : 'Perfect'}</span>`
      : (defenseIndex !== null ? `<span class="${indexClass(defenseIndex)}">${defenseIndex}%</span>` : '-');

    const rows = [
      { ko: '승점', en: 'PTS', value: `<span class="pts">${t.pts}</span>` },
      { ko: '경기', en: 'PLAYED', value: t.played },
      { ko: '승-무-패', en: 'W-D-L', value: `${t.won}-${t.drawn}-${t.lost}` },
      { ko: '홈 성적', en: 'HOME RECORD', value: homeAwayValue(home) },
      { ko: '원정 성적', en: 'AWAY RECORD', value: homeAwayValue(away) },
      { ko: '득점', en: 'GOALS FOR', value: t.goalsFor },
      { ko: '실점', en: 'GOALS AGAINST', value: t.goalsAgainst },
      { ko: '득실차', en: 'GOAL DIFF', value: `<span class="${gdClass}">${t.gd}</span>` },
      { ko: '경기당 득점', en: 'GOALS / GAME', value: gpg },
      { ko: '경기당 실점', en: 'CONCEDED / GAME', value: gapg },
      { ko: '공격 지수', en: 'ATTACK INDEX', value: attackValue },
      { ko: '수비 지수', en: 'DEFENSE INDEX', value: defenseValue },
      { ko: '무실점 경기', en: 'CLEAN SHEETS', value: t.cleanSheets },
      { ko: '무득점 경기', en: 'FAILED TO SCORE', value: t.failedToScore }
    ];

    return `
      <div class="ti-record-card">
        <div class="ti-record-rank">
          <span class="ti-record-rank-num">${rank}</span>
          <span class="ti-record-rank-label lbl" data-en="of ${total} teams" data-ko="위 (총 ${total}팀)">${isKorean ? `위 (총 ${total}팀)` : `of ${total} teams`}</span>
        </div>
        <div class="ti-record-grid">
          ${rows.map(r => `
            <div class="ti-record-item">
              <span class="ti-record-item-label lbl" data-en="${r.en}" data-ko="${r.ko}">${isKorean ? r.ko : r.en}</span>
              <span class="ti-record-item-value">${r.value}</span>
            </div>
          `).join('')}
        </div>
        ${(attackIndex !== null || defenseIndex !== null || defensePerfect) ? `
        <div class="ti-record-index-note lbl" data-en="Attack/Defense Index — 100% is the league average; higher is stronger" data-ko="공격/수비 지수 — 100%가 리그 평균, 높을수록 강함">${isKorean ? '공격/수비 지수 — 100%가 리그 평균, 높을수록 강함' : 'Attack/Defense Index — 100% is the league average; higher is stronger'}</div>` : ''}
      </div>
    `;
  }

  function renderTeamRecordTab() {
    const el = document.getElementById('teamInfoRecordTab');
    if (!el) return;
    const info = getMyRankedTeam();
    if (!info) { el.innerHTML = ''; return; }
    el.innerHTML = buildRecordCardHtml(info.team, info.rank, info.total);
  }

  // 상대전적(H2H) 탭 렌더링 — h2hHistory(data.js에서 roundsData + matchLineups의
  // recentHistory를 합쳐 계산)를 상대팀별 카드로 보여줍니다.
  function renderTeamH2HTab() {
    const el = document.getElementById('teamInfoH2hTab');
    if (!el) return;

    const list = (typeof computeH2HHistory === 'function') ? computeH2HHistory() : [];
    if (!list.length) { el.innerHTML = ''; return; }

    const cardsHtml = list.map(rec => {
      const gdClass = rec.goalDiff > 0 ? 'gd-pos' : (rec.goalDiff < 0 ? 'gd-neg' : 'gd-zero');
      const logoImg = rec.logoSrc
        ? `<img class="team-logo team-logo-sm" src="${rec.logoSrc}" data-en-name="${rec.nameEn}" alt="${rec.nameEn}">`
        : `<span class="ti-h2h-noimg">${(rec.nameKo || rec.nameEn || '?').charAt(0)}</span>`;
      const playedLabel = isKorean ? `${rec.played}경기` : `${rec.played} PLD`;

      return `
        <div class="ti-h2h-card">
          <div class="ti-h2h-card-top">
            ${logoImg}
            <span class="ti-h2h-name lbl" data-en="${rec.nameEn}" data-ko="${rec.nameKo}">${isKorean ? rec.nameKo : rec.nameEn}</span>
          </div>
          <div class="ti-h2h-wdl">
            <span class="ti-h2h-wdl-item ti-h2h-w"><b>${rec.won}</b><small class="lbl" data-en="W" data-ko="승">${isKorean ? '승' : 'W'}</small></span>
            <span class="ti-h2h-wdl-item ti-h2h-d"><b>${rec.drawn}</b><small class="lbl" data-en="D" data-ko="무">${isKorean ? '무' : 'D'}</small></span>
            <span class="ti-h2h-wdl-item ti-h2h-l"><b>${rec.lost}</b><small class="lbl" data-en="L" data-ko="패">${isKorean ? '패' : 'L'}</small></span>
          </div>
          <div class="ti-h2h-stats">
            <span class="ti-h2h-played">${playedLabel}</span>
            <span class="ti-h2h-gd ${gdClass}">${rec.goalDiff}</span>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="ti-h2h-grid">${cardsHtml}</div>`;
    attachImageFallback();
  }

  // 유튜브 링크(watch?v=, youtu.be, embed)에서 11자리 영상 ID만 뽑아냅니다.
  function extractYoutubeId(url) {
    if (!url) return null;
    const patterns = [
      /youtu\.be\/([\w-]{11})/,
      /[?&]v=([\w-]{11})/,
      /youtube\.com\/embed\/([\w-]{11})/
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }

  // HTML 특수문자를 이스케이프합니다(유튜브 API에서 온 영상 제목을 속성/텍스트에 안전하게 넣기 위함).
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // teamYoutubeChannel(data.js)에 설정된 채널의 "최신 업로드 영상"을 YouTube Data API v3로
  // 가져옵니다. localStorage에 12시간 동안 캐시해서(하루 최대 2번만 API 호출) API 사용량을 아낍니다.
  async function fetchTeamYoutubeChannelVideos() {
    if (typeof teamYoutubeChannel === 'undefined' || !teamYoutubeChannel.apiKey || !teamYoutubeChannel.uploadsPlaylistId) {
      return null;
    }

    const cacheKey = 'tiYoutubeChannelCache_' + teamYoutubeChannel.uploadsPlaylistId;
    const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간 = 하루 2회 갱신
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached && Array.isArray(cached.videos) && (Date.now() - cached.ts) < CACHE_TTL_MS) {
          return cached.videos;
        }
      }
    } catch (e) { /* 캐시 읽기 실패는 무시하고 새로 받아옵니다 */ }

    const maxResults = teamYoutubeChannel.maxResults || 15;
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(teamYoutubeChannel.uploadsPlaylistId)}&maxResults=${maxResults}&key=${encodeURIComponent(teamYoutubeChannel.apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('YouTube API 요청 실패: ' + res.status);
    const data = await res.json();

    const videos = (data.items || [])
      .filter(item => item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId)
      .map(item => {
        const videoId = item.snippet.resourceId.videoId;
        const thumbs = item.snippet.thumbnails || {};
        const thumb = thumbs.medium || thumbs.high || thumbs.default;
        return {
          videoId,
          title: item.snippet.title || '',
          publishedAt: item.snippet.publishedAt || '',
          thumbSrc: thumb ? thumb.url : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        };
      });

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), videos }));
    } catch (e) { /* 저장 실패(용량 등)는 무시 */ }

    return videos;
  }

  // ===== 구단 유튜브 코너(상대전적 ↔ 경기결과 사이) =====
  // teamYoutubeChannel(data.js)에 지정된 채널의 최신 영상 15개를 가져와 썸네일 카드로
  // 보여줍니다. 카드 목록을 이어붙여(2배) 우→좌로 끊김 없이 자동으로 흐르게 하고,
  // 클릭하면 새 탭에서 해당 유튜브 영상이 열립니다.
  async function renderTeamYoutubeTab() {
    const el = document.getElementById('teamInfoYoutubeTab');
    if (!el) return;

    const channelLinkEl = document.getElementById('tiYoutubeChannelLink');
    if (channelLinkEl) {
      if (typeof teamYoutubeChannel !== 'undefined' && teamYoutubeChannel.channelId) {
        channelLinkEl.href = `https://www.youtube.com/channel/${encodeURIComponent(teamYoutubeChannel.channelId)}`;
        channelLinkEl.style.display = '';
      } else {
        channelLinkEl.style.display = 'none';
      }
    }

    if (typeof teamYoutubeChannel === 'undefined' || !teamYoutubeChannel.apiKey) {
      el.innerHTML = `<div class="ti-yt-empty lbl" data-en="Add a YouTube Data API key in data.js (teamYoutubeChannel.apiKey) to show the channel's latest videos." data-ko="data.js의 teamYoutubeChannel.apiKey에 YouTube Data API 키를 넣으면 채널 최신 영상이 표시됩니다.">${isKorean ? 'data.js의 teamYoutubeChannel.apiKey에 YouTube Data API 키를 넣으면 채널 최신 영상이 표시됩니다.' : "Add a YouTube Data API key in data.js (teamYoutubeChannel.apiKey) to show the channel's latest videos."}</div>`;
      return;
    }

    el.innerHTML = `<div class="ti-yt-empty lbl" data-en="Loading latest videos..." data-ko="최신 영상을 불러오는 중...">${isKorean ? '최신 영상을 불러오는 중...' : 'Loading latest videos...'}</div>`;

    let videos;
    try {
      videos = await fetchTeamYoutubeChannelVideos();
    } catch (e) {
      el.innerHTML = `<div class="ti-yt-empty lbl" data-en="Could not load the channel's videos." data-ko="채널 영상을 불러오지 못했습니다.">${isKorean ? '채널 영상을 불러오지 못했습니다.' : "Could not load the channel's videos."}</div>`;
      return;
    }

    if (!videos || !videos.length) { el.innerHTML = ''; return; }

    // 최신 업로드 순(좌) → 오래된 순(우)으로 정렬되도록 publishedAt 기준 내림차순 정렬을 보장합니다.
    videos = videos.slice().sort((a, b) => {
      const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tb - ta;
    });

    const cardHtml = videos.map(v => {
      const title = escapeHtml(v.title);
      const dateLabel = v.publishedAt
        ? new Date(v.publishedAt).toLocaleDateString(isKorean ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';
      return `
        <a class="ti-yt-card" href="https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}" target="_blank" rel="noopener noreferrer" aria-label="${title}">
          <div class="ti-yt-thumb-wrap">
            <img class="ti-yt-thumb" src="${v.thumbSrc}" alt="${title}" loading="lazy">
            <span class="ti-yt-play-badge">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.55)"/><path d="M10 8.5L16 12L10 15.5V8.5Z" fill="white"/></svg>
            </span>
          </div>
          <div class="ti-yt-meta">
            <span class="ti-yt-opponent" title="${title}">${title}</span>
            ${dateLabel ? `<span class="ti-yt-round">${dateLabel}</span>` : ''}
          </div>
        </a>`;
    }).join('');

    // 카드 목록을 두 번 이어붙여서 자동 스크롤이 절반 지점을 돌 때 이음매 없이 이어지도록 합니다.
    el.innerHTML = `
      <div class="ti-yt-marquee">
        <div class="ti-yt-track">${cardHtml}${cardHtml}</div>
      </div>`;
    attachImageFallback();

    const marqueeEl = el.querySelector('.ti-yt-marquee');
    const trackEl = el.querySelector('.ti-yt-track');
    if (marqueeEl && trackEl) initYoutubeMarqueeScroll(marqueeEl, trackEl);
  }

  // ===== 구단 유튜브 코너: 우→좌 자동 흐름(느린 속도) + 마우스/터치 드래그 스크롤 =====
  // 카드가 오른쪽(신규 진입)에서 왼쪽(퇴장)으로 흐르며, 새 영상(작은 x)부터 오래된 영상(큰 x)
  // 순으로 지나가도록, 콘텐츠를 2배로 이어붙인 트랙에서 scrollLeft를 0에서 시작해 서서히
  // 늘려갑니다(=시각적으로 왼쪽으로 흐름). 절반 지점(halfWidth)에 도달하면 다시 처음 위치로
  // 점프해 무한 루프를 흉내냅니다. 사용자가 마우스로 드래그하거나 손가락으로 스와이프하면
  // 자동 흐름을 잠시 멈추고 자유롭게 좌우로 스크롤할 수 있습니다.
  function initYoutubeMarqueeScroll(marqueeEl, trackEl) {
    const DURATION_SECONDS = 60; // 기존 42s보다 느리게
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let userInteracting = false;
    let hovering = false;
    let lastTime = null;
    let rafId = null;

    function getHalfWidth() {
      return trackEl.scrollWidth / 2;
    }

    function placeAtStart() {
      // 맨 앞(x=0, 최신 영상)에서 시작해야 "새 영상부터" 우→좌로 흐릅니다.
      marqueeEl.scrollLeft = 0;
    }
    // 레이아웃 확정 후 맨 앞(최신 영상) 지점에서 시작
    requestAnimationFrame(placeAtStart);

    function step(timestamp) {
      if (!prefersReducedMotion && !userInteracting && !hovering) {
        if (lastTime == null) lastTime = timestamp;
        const dt = (timestamp - lastTime) / 1000;
        const halfWidth = getHalfWidth();
        if (halfWidth > 0) {
          const speed = halfWidth / DURATION_SECONDS; // px/sec
          // scrollLeft를 증가시켜 콘텐츠가 우→좌로 흐르게 하고(오른쪽에서 새 카드가 들어와
          // 왼쪽으로 빠져나감), 새 영상(작은 x)부터 오래된 영상(큰 x) 순으로 지나가게 합니다.
          marqueeEl.scrollLeft += speed * dt;
        }
      } else {
        lastTime = timestamp;
      }
      lastTime = timestamp;
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);

    // 이음매 없는 무한 루프: 경계에 가까워지면 반대쪽 대응 지점으로 점프
    marqueeEl.addEventListener('scroll', () => {
      const halfWidth = getHalfWidth();
      if (halfWidth <= 0) return;
      if (marqueeEl.scrollLeft <= 0) {
        marqueeEl.scrollLeft += halfWidth;
      } else if (marqueeEl.scrollLeft >= halfWidth * 2 - marqueeEl.clientWidth) {
        marqueeEl.scrollLeft -= halfWidth;
      }
    });

    // 마우스 호버 시 일시 정지(기존 동작 유지)
    marqueeEl.addEventListener('mouseenter', () => { hovering = true; });
    marqueeEl.addEventListener('mouseleave', () => { hovering = false; lastTime = null; });

    // 터치 스와이프: 브라우저 네이티브 스크롤을 사용하고, 터치 중에는 자동 흐름만 멈춥니다.
    marqueeEl.addEventListener('touchstart', () => { userInteracting = true; }, { passive: true });
    marqueeEl.addEventListener('touchend', () => { userInteracting = false; lastTime = null; }, { passive: true });
    marqueeEl.addEventListener('touchcancel', () => { userInteracting = false; lastTime = null; }, { passive: true });

    // 마우스 드래그로 좌우 스크롤 (데스크톱)
    let isDown = false, startX = 0, startScroll = 0, dragMoved = false;
    marqueeEl.addEventListener('mousedown', (e) => {
      isDown = true;
      userInteracting = true;
      dragMoved = false;
      startX = e.pageX;
      startScroll = marqueeEl.scrollLeft;
      marqueeEl.classList.add('ti-yt-dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 3) dragMoved = true;
      marqueeEl.scrollLeft = startScroll - dx;
    });
    function endDrag() {
      if (!isDown) return;
      isDown = false;
      userInteracting = false;
      lastTime = null;
      marqueeEl.classList.remove('ti-yt-dragging');
    }
    window.addEventListener('mouseup', endDrag);
    marqueeEl.addEventListener('mouseleave', endDrag);

    // 드래그 후 발생하는 클릭(영상 링크 이동)을 방지
    trackEl.addEventListener('click', (e) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
      }
    }, true);
  }

  // 특정 팀(nameEn/nameKo)이 치른 "이미 끝난 경기" 카드 목록을 만듭니다.
  // 원래 우리 팀(치주물루) 결과 탭 전용 로직이었으나, 다른 구단 화면에서도
  // 그대로 재사용할 수 있도록 대상 팀을 인자로 받는 형태로 뽑아뒀습니다.
  function buildTeamPastResultsHtml(teamEn, teamKo) {
    const isMine = isMyTeamName(teamEn, teamKo);
    const roundKeys = completedRoundKeysIncludingScheduled();
    const totalRounds = roundKeys.length;

    let html = '';

    roundKeys.slice().reverse().forEach((key, revIdx) => {
      const weekNum = totalRounds - revIdx;
      const matches = buildRoundMatches(key);
      const teamMatch = matches.find(m => !m.isBye && (
        (m.homeEn === teamEn || m.homeKo === teamKo) ||
        (m.awayEn === teamEn || m.awayKo === teamKo)
      ));
      const teamBye = matches.find(m => m.isBye && (m.teamEn === teamEn || m.teamKo === teamKo));
      if (!teamMatch && !teamBye) return;

      const weekLabel = isKorean ? `${weekNum}주차` : `Week ${weekNum}`;

      if (teamBye) {
        html += `
          <div class="round-match-card round-bye-card">
            <span class="ti-result-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</span>
            <span class="round-bye-badge lbl" data-en="BYE" data-ko="휴식주">${isKorean ? '휴식주' : 'BYE'}</span>
          </div>`;
        return;
      }

      // 연기(postponed)되었거나 스코어가 아직 없는 경기는 "결과"가 아니므로
      // 무승부 등으로 잘못 표시하지 않고 연기 배지만 보여줍니다.
      if (teamMatch.isScheduled) {
        const m = teamMatch;
        const homeName = isKorean ? m.homeKo : m.homeEn;
        const awayName = isKorean ? m.awayKo : m.awayEn;
        html += `
          <div class="round-match-card round-match-scheduled">
            <span class="ti-result-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</span>
            <span class="rmc-pending-badge lbl" data-en="${m.postponed ? 'Postponed' : 'Upcoming'}" data-ko="${m.postponed ? '경기 연기' : '경기 시작 전'}">${isKorean ? (m.postponed ? '경기 연기' : '경기 시작 전') : (m.postponed ? 'Postponed' : 'Upcoming')}</span>
            <div class="rmc-teams">
              <div class="rmc-team rmc-home"><span class="lbl" data-en="${m.homeEn}" data-ko="${m.homeKo}">${homeName}</span></div>
              <div class="rmc-team rmc-away"><span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span></div>
            </div>
          </div>`;
        return;
      }

      const m = teamMatch;
      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;
      const isDraw = m.homeScore === m.awayScore;
      const isHomeTeam = (m.homeEn === teamEn || m.homeKo === teamKo);
      const result = isDraw ? 'D' : ((isHomeTeam && homeWin) || (!isHomeTeam && awayWin) ? 'W' : 'L');
      const resultClass = result === 'W' ? 'form-w' : (result === 'D' ? 'form-d' : 'form-l');
      const resultLabelKo = result === 'W' ? '승' : (result === 'D' ? '무' : '패');
      const resultLabel = isKorean ? resultLabelKo : result;
      const homeLogo = getTeamLogo(m.homeEn);
      const awayLogo = getTeamLogo(m.awayEn);
      const homeName = isKorean ? m.homeKo : m.homeEn;
      const awayName = isKorean ? m.awayKo : m.awayEn;
      const noneLabel = isKorean ? '득점자 없음' : 'No scorers';
      const scorersHomeText = (m.scorersHome === '없음' || !m.scorersHome) ? noneLabel : renderScorerNamesHtml(m.scorersHome, isKorean);
      const scorersAwayText = (m.scorersAway === '없음' || !m.scorersAway) ? noneLabel : renderScorerNamesHtml(m.scorersAway, isKorean);

      html += `
        <div class="round-match-card${isMine ? ' my-team' : ''}">
          <div class="ti-result-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</div>
          <span class="form-badge ${resultClass} ti-result-badge">${resultLabel}</span>
          <div class="rmc-teams">
            <div class="rmc-team rmc-home${homeWin ? ' rmc-winner' : ''}">
              ${homeLogo ? `<img class="team-logo-sm" src="${homeLogo}" alt="${m.homeEn}">` : ''}
              <span class="lbl" data-en="${m.homeEn}" data-ko="${m.homeKo}">${homeName}</span>
            </div>
            <div class="rmc-score">
              <span class="rmc-score-num${homeWin ? ' rmc-score-win' : ''}">${m.homeScore}</span>
              <span class="rmc-score-sep">:</span>
              <span class="rmc-score-num${awayWin ? ' rmc-score-win' : ''}">${m.awayScore}</span>
            </div>
            <div class="rmc-team rmc-away${awayWin ? ' rmc-winner' : ''}">
              <span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span>
              ${awayLogo ? `<img class="team-logo-sm" src="${awayLogo}" alt="${m.awayEn}">` : ''}
            </div>
          </div>
          <div class="rmc-scorers">
            <div class="rmc-scorers-col">
              <span class="rmc-scorers-icon">⚽</span>
              <span class="rmc-scorers-text">${scorersHomeText}</span>
            </div>
            <div class="rmc-scorers-col rmc-scorers-col-away">
              <span class="rmc-scorers-text">${scorersAwayText}</span>
              <span class="rmc-scorers-icon">⚽</span>
            </div>
          </div>
          ${venueCaptionHtml(m.homeEn)}
          ${(isMine && (matchLineups[key] || matchHighlights[key])) ? `
          <div class="rmc-btn-row">
            ${matchLineups[key] ? `<button class="rmc-detail-btn lbl" data-en="View Details" data-ko="상세보기" onclick="openMatchDetail('${key}', ${weekNum})">${isKorean ? '상세보기' : 'View Details'}</button>` : ''}
            ${matchHighlights[key] ? `<a class="rmc-highlight-btn lbl" data-en="Watch Highlights" data-ko="하이라이트 보기" href="${matchHighlights[key]}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              ${isKorean ? '하이라이트 보기' : 'Watch Highlights'}
            </a>` : ''}
          </div>` : ''}
        </div>`;
    });

    return html;
  }

  function renderTeamResultsTab() {
    const el = document.getElementById('teamInfoResultsTab');
    if (!el) return;
    const info = getMyRankedTeam();

    let html = '';
    if (info) {
      html += `<div class="ti-next-mini">${nextMatchOpponentHtml(info.team, info.rank)}</div>`;
      html += buildTeamPastResultsHtml(info.team.nameEn, info.team.nameKo);
    }

    el.innerHTML = `<div class="round-match-list ti-results-list">${html}</div>`;
    attachImageFallback();
    hydrateWeatherWidgets();
  }

  function scrollToTeamInfoSection(tab) {
    currentTeamInfoTab = tab;
    setActiveTeamInfoButton(tab);
    const sectionEl = document.getElementById('tiSection-' + tab);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function setActiveTeamInfoButton(tab) {
    const buttons = {
      overview: 'tiOverviewBtn',
      record: 'tiRecordBtn',
      squad: 'tiSquadBtn',
      scorers: 'tiScorersBtn',
      awards: 'tiAwardsBtn',
      h2h: 'tiH2hBtn',
      youtube: 'tiYoutubeBtn',
      results: 'tiResultsBtn'
    };
    Object.keys(buttons).forEach(key => {
      const btnEl = document.getElementById(buttons[key]);
      if (btnEl) btnEl.classList.toggle('active', key === tab);
    });
  }

  let teamInfoScrollObserver = null;
  function setupTeamInfoScrollSpy() {
    if (teamInfoScrollObserver) {
      teamInfoScrollObserver.disconnect();
      teamInfoScrollObserver = null;
    }
    const sections = ['overview', 'record', 'squad', 'scorers', 'awards', 'h2h', 'youtube', 'results']
      .map(tab => ({ tab, el: document.getElementById('tiSection-' + tab) }))
      .filter(s => s.el);
    if (sections.length === 0) return;

    const tabBar = document.getElementById('teamInfoTabBar');
    const tabBarHeight = tabBar ? tabBar.getBoundingClientRect().height : 0;

    teamInfoScrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const tab = entry.target.id.replace('tiSection-', '');
          currentTeamInfoTab = tab;
          setActiveTeamInfoButton(tab);
        }
      });
    }, {
      root: null,
      rootMargin: `-${Math.ceil(tabBarHeight + 10)}px 0px -70% 0px`,
      threshold: 0
    });

    sections.forEach(s => teamInfoScrollObserver.observe(s.el));
  }

  function renderTeamSponsors() {
    const el = document.getElementById('teamSponsorsCard');
    if (!el) return;
    if (typeof sponsorData === 'undefined') { el.innerHTML = ''; return; }

    const main = (sponsorData.main || [])[0];
    const kit = (sponsorData.kit || [])[0];
    const general = sponsorData.general || [];

    if (!main && !kit && !general.length) { el.innerHTML = ''; return; }

    const mainHtml = main ? `
      <div class="team-sponsor-block main">
        <span class="team-sponsor-tag lbl" data-en="Main Sponsor" data-ko="메인 스폰서">${isKorean ? '메인 스폰서' : 'Main Sponsor'}</span>
        <img class="team-sponsor-logo-img main" src="${main.logo}" alt="${main.name || (isKorean ? '메인 스폰서' : 'Main Sponsor')}" loading="lazy">
        ${main.name ? `<span class="team-sponsor-name">${main.name}</span>` : ''}
      </div>` : '';

    const kitHtml = kit ? `
      <div class="team-sponsor-block kit">
        <span class="team-sponsor-tag lbl" data-en="Kit Sponsor" data-ko="키트 스폰서">${isKorean ? '키트 스폰서' : 'Kit Sponsor'}</span>
        <img class="team-sponsor-logo-img kit" src="${kit.logo}" alt="${kit.name || (isKorean ? '키트 스폰서' : 'Kit Sponsor')}" loading="lazy">
        ${kit.name ? `<span class="team-sponsor-name">${kit.name}</span>` : ''}
      </div>` : '';

    const generalHtml = general.length ? `
      <div class="team-sponsor-general-section">
        <div class="team-sponsor-general-label lbl" data-en="Sponsors" data-ko="일반 스폰서">${isKorean ? '일반 스폰서' : 'Sponsors'}</div>
        <div class="team-sponsor-general-grid">
          ${general.map(g => `<img class="team-sponsor-general-logo" src="${g.logo}" alt="${g.name || ''}" loading="lazy">`).join('')}
        </div>
      </div>` : '';

    el.innerHTML = `
      <div class="team-sponsors-title lbl" data-en="Sponsors" data-ko="스폰서">${isKorean ? '스폰서' : 'Sponsors'}</div>
      <div class="team-sponsor-top-row">
        ${mainHtml}
        ${kitHtml}
      </div>
      ${generalHtml}
    `;
    attachImageFallback();
  }

  function renderTeamInfoView() {
    renderTeamInfoHeader();
    renderTeamInfoOverview();
    renderTeamRecordTab();
    const magicTarget = document.getElementById('teamInfoMagicNumber');
    const mine = getMyRankedTeam();
    if (magicTarget) magicTarget.innerHTML = mine ? buildTeamMagicNumberHtml(mine.team, getRankedTeams('all')) : '';
    renderTeamPointsHistoryChart('teamInfoPointsHistorySvg', mine ? mine.team : null);
    renderTeamH2HTab();
    renderTeamStaffTab();
    renderSquadView();
    renderTeamScorersTab();
    renderTeamAwardsTab();
    renderTeamYoutubeTab();
    renderTeamResultsTab();
    setActiveTeamInfoButton(currentTeamInfoTab);
    setupTeamInfoScrollSpy();
  }

  // ===== 팀별 득점 순위 카드 (재사용 가능한 빌더) =====
  // topScorersData(리그 전체 득점 순위, computeTopScorers로 자동 계산됨) 중
  // 해당 팀 소속 선수만 골 수 내림차순으로 걸러서, 1~3위까지 카드로 만듭니다.
  // 동률이면 같은 순위로 표시하고, 순위 안에 여러 명이면 전부 표시합니다
  // (예: 2위가 2명이면 1,2,2위까지만 노출되고 3위는 없음).
  // 치주물루(선수단↔상대전적 사이)와 다른 팀들(다음경기 앞) 양쪽에서 공유합니다.
  function buildTeamScorerCardsHtml(nameEn, nameKo) {
    const teamScorers = topScorersData
      .filter(p => p.teamEn === nameEn || p.teamKo === nameKo)
      .slice()
      .sort((a, b) => b.goals - a.goals);

    if (teamScorers.length === 0) {
      return `<div class="ti-card" style="text-align:center; color:var(--color-text-faint);">
        ${isKorean ? '아직 득점 기록이 없습니다.' : 'No scorer data yet.'}
      </div>`;
    }

    let displayRank = 1;
    let prevGoals = null;
    let tierCount = 0; // 지금까지 등장한 "골 수 그룹"의 개수 (동률은 한 그룹으로 취급)
    const cards = [];
    teamScorers.forEach((player, idx) => {
      if (idx > 0 && player.goals !== prevGoals) {
        displayRank = idx + 1;
        tierCount++;
      }
      prevGoals = player.goals;
      if (idx === 0) tierCount = 1;
      if (tierCount > 3) return; // 골 수 상위 3개 그룹까지만 (그룹 내 동률은 전부 포함)

      const playerName = isKorean ? player.nameKo : player.nameEn;
      const goalsLabel = isKorean ? '골' : (player.goals === 1 ? 'GOAL' : 'GOALS');
      const photo = player.photoSrc
        ? `<img class="ti-scorer-card-photo" src="${player.photoSrc}" alt="${player.nameEn}">`
        : `<div class="ti-scorer-card-photo ti-scorer-card-photo-placeholder">⚽</div>`;

      cards.push(`
        <div class="ti-scorer-card rank-${displayRank} player-name-link" data-en="${player.nameEn}" data-ko="${player.nameKo}" data-player-key="${player.key}">
          <div class="ti-scorer-card-rank">${displayRank}</div>
          ${photo}
          <div class="ti-scorer-card-name lbl" data-en="${player.nameEn}" data-ko="${player.nameKo}">${playerName}</div>
          <div class="ti-scorer-card-goals">${player.goals}<span class="ti-scorer-card-goals-label">${goalsLabel}</span></div>
        </div>
      `);
    });

    return `<div class="ti-scorer-card-row">${cards.join('')}</div>`;
  }

  // ===== 출전 기록 카드 (선발 최다 / 교체 최다 / 벤치 대기 최다 / 교체 비율) =====
  // squadPlayerStats(matchLineups로부터 자동 계산)를 바탕으로 4가지 "출전 스타일" 랭킹을
  // 뽑아서 보여줍니다. 라운드 데이터가 쌓일수록(matchLineups에 라운드를 추가할 때마다)
  // 자동으로 갱신됩니다.
  function computeAppearanceLeaders() {
    const MIN_APPS_FOR_RATIO = 3; // 표본이 너무 적은 선수는 교체 비율 랭킹에서 제외
    const rows = squadData.map(p => {
      const s = squadPlayerStats[p.number] || { starts: 0, subApps: 0, appearances: 0, unusedCount: 0 };
      const subRatio = s.appearances > 0 ? (s.subApps / s.appearances) : 0;
      return {
        number: p.number, nameKo: p.nameKo, nameEn: p.nameEn,
        starts: s.starts, subApps: s.subApps, unusedCount: s.unusedCount,
        appearances: s.appearances, subRatio
      };
    });

    const byDescThenNum = (key) => (a, b) => (b[key] - a[key]) || (a.number - b.number);

    return {
      starters: rows.filter(r => r.starts > 0).sort(byDescThenNum('starts')).slice(0, 3),
      subs: rows.filter(r => r.subApps > 0).sort(byDescThenNum('subApps')).slice(0, 3),
      bench: rows.filter(r => r.unusedCount > 0).sort(byDescThenNum('unusedCount')).slice(0, 3),
      subRatio: rows.filter(r => r.appearances >= MIN_APPS_FOR_RATIO && r.subApps > 0)
        .sort(byDescThenNum('subRatio')).slice(0, 3)
    };
  }

  function appearanceLeaderRowsHtml(list, valueFn) {
    if (!list.length) {
      return `<div class="ti-appear-empty lbl" data-en="No data yet" data-ko="아직 데이터가 없습니다">${isKorean ? '아직 데이터가 없습니다' : 'No data yet'}</div>`;
    }
    const rankClass = ['rank-1', 'rank-2', 'rank-3'];
    return `<div class="ti-appear-mini-row">${list.map((r, idx) => {
      const name = isKorean ? r.nameKo : (r.nameEn || r.nameKo);
      const sq = squadData.find(p => p.number === r.number);
      const photo = sq && sq.photoSrc
        ? `<img class="ti-appear-mini-photo" src="${sq.photoSrc}" alt="${r.nameEn || r.nameKo}">`
        : `<div class="ti-appear-mini-photo ti-appear-mini-photo-placeholder">👤</div>`;
      return `
        <div class="ti-appear-mini-card ${rankClass[idx] || ''} lineup-squad-link" data-player-number="${r.number}">
          <span class="ti-appear-mini-rank">${idx + 1}</span>
          ${photo}
          <span class="ti-appear-mini-num">#${r.number}</span>
          <span class="ti-appear-mini-name lbl" data-en="${r.nameEn || r.nameKo}" data-ko="${r.nameKo}">${name}</span>
          <span class="ti-appear-mini-value">${valueFn(r)}</span>
        </div>`;
    }).join('')}</div>`;
  }

  function renderAppearanceStatsCard() {
    const leaders = computeAppearanceLeaders();
    const gameSuffix = (n) => isKorean ? `${n}경기` : `${n}`;

    const blocks = [
      {
        titleKo: '선발 출전 최다', titleEn: 'Most Starts',
        subKo: '붙박이 주전', subEn: 'Regular starter',
        rows: appearanceLeaderRowsHtml(leaders.starters, r => gameSuffix(r.starts))
      },
      {
        titleKo: '교체 출전 최다', titleEn: 'Most Sub Appearances',
        subKo: '조커 / 슈퍼서브', subEn: 'Super sub',
        rows: appearanceLeaderRowsHtml(leaders.subs, r => gameSuffix(r.subApps))
      },
      {
        titleKo: '벤치 대기 최다', titleEn: 'Most Unused on Bench',
        subKo: '벤치를 뜨겁게 달구는 중', subEn: 'Warming the bench',
        rows: appearanceLeaderRowsHtml(leaders.bench, r => gameSuffix(r.unusedCount))
      },
      {
        titleKo: '선발 대비 교체 비율', titleEn: 'Sub Appearance Rate',
        subKo: `출전 ${3}경기 이상 기준`, subEn: '3+ appearances',
        rows: appearanceLeaderRowsHtml(leaders.subRatio, r => `${Math.round(r.subRatio * 100)}%`)
      }
    ];

    const blocksHtml = blocks.map(b => `
      <div class="ti-appear-block">
        <div class="ti-appear-block-head">
          <span class="ti-appear-block-title lbl" data-en="${b.titleEn}" data-ko="${b.titleKo}">${isKorean ? b.titleKo : b.titleEn}</span>
          <span class="ti-appear-block-sub lbl" data-en="${b.subEn}" data-ko="${b.subKo}">${isKorean ? b.subKo : b.subEn}</span>
        </div>
        <div class="ti-appear-block-rows">${b.rows}</div>
      </div>`).join('');

    return `
      <div class="ti-card ti-appear-card">
        <div class="ti-card-title lbl" data-en="Appearance Stats" data-ko="출전 기록">${isKorean ? '출전 기록' : 'Appearance Stats'}</div>
        <div class="ti-gk-card-note lbl" data-en="Based on lineup data entered so far" data-ko="지금까지 입력된 라인업 데이터 기준">${isKorean ? '지금까지 입력된 라인업 데이터 기준' : 'Based on lineup data entered so far'}</div>
        <div class="ti-appear-grid">${blocksHtml}</div>
      </div>`;
  }

  // ===== 포지션별 득점 기여도 카드 (도넛 차트) =====
  // goalsByPositionData(data.js에서 topScorersData + squadData로 자동 계산됨)를
  // conic-gradient 기반 도넛 차트 + 범례로 보여줍니다.
  const POSITION_COLOR = {
    FW: 'var(--color-navy)',
    MF: 'var(--color-teal)',
    DF: 'var(--color-gold-strong)',
    GK: 'var(--color-neutral-mid)'
  };

  function renderGoalsByPositionCard() {
    const data = (typeof goalsByPositionData !== 'undefined') ? goalsByPositionData : { totalGoals: 0, groups: [] };
    if (!data.totalGoals || !data.groups.length) {
      return `
        <div class="ti-card ti-position-card">
          <div class="ti-card-title lbl" data-en="Goals by Position" data-ko="포지션별 득점 기여도">${isKorean ? '포지션별 득점 기여도' : 'Goals by Position'}</div>
          <div class="ti-appear-empty lbl" data-en="No goal data yet" data-ko="아직 득점 데이터가 없습니다">${isKorean ? '아직 득점 데이터가 없습니다' : 'No goal data yet'}</div>
        </div>`;
    }

    let cursor = 0;
    const stops = data.groups.map((g, idx) => {
      const color = POSITION_COLOR[g.position] || 'var(--color-text-faint)';
      const start = cursor;
      const isLast = idx === data.groups.length - 1;
      cursor += g.pct;
      const end = isLast ? 100 : cursor;
      return `${color} ${start}% ${end}%`;
    }).join(', ');

    const legendHtml = data.groups.map(g => {
      const label = isKorean ? g.labelKo : g.labelEn;
      const topPlayer = g.players[0];
      const topName = topPlayer ? (isKorean ? topPlayer.nameKo : topPlayer.nameEn) : '';
      return `
        <div class="ti-pos-legend-item">
          <i class="ti-pos-legend-dot" style="background:${POSITION_COLOR[g.position] || 'var(--color-text-faint)'}"></i>
          <div class="ti-pos-legend-main">
            <span class="ti-pos-legend-label lbl" data-en="${g.labelEn}" data-ko="${g.labelKo}">${label}</span>
            ${topName ? `<span class="ti-pos-legend-top">${isKorean ? '최다 득점: ' : 'Top scorer: '}${topName} (${topPlayer.goals}${isKorean ? '골' : ''})</span>` : ''}
          </div>
          <div class="ti-pos-legend-value">
            <b>${g.goals}</b><span class="ti-pos-legend-pct">${g.pct}%</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="ti-card ti-position-card">
        <div class="ti-card-title lbl" data-en="Goals by Position" data-ko="포지션별 득점 기여도">${isKorean ? '포지션별 득점 기여도' : 'Goals by Position'}</div>
        <div class="ti-gk-card-note lbl" data-en="Share of team goals scored by each position" data-ko="포지션별로 팀 득점에 기여한 비중">${isKorean ? '포지션별로 팀 득점에 기여한 비중' : 'Share of team goals scored by each position'}</div>
        <div class="ti-pos-body">
          <div class="ti-pos-donut" style="background: conic-gradient(${stops});">
            <div class="ti-pos-donut-hole">
              <b>${data.totalGoals}</b>
              <span class="lbl" data-en="Goals" data-ko="골">${isKorean ? '골' : 'Goals'}</span>
            </div>
          </div>
          <div class="ti-pos-legend">${legendHtml}</div>
        </div>
      </div>`;
  }

  // ===== 핵심 선수 출전/결장 영향도 카드 (With & Without Stats) =====
  // computeKeyPlayerImpactCandidates()/computeKeyPlayerImpact()(data.js)로 계산된
  // "선발 출전 시" vs "결장(미출전) 시" 팀 성적을 선수 선택 칩과 함께 보여줍니다.
  function impactStatColHtml(titleKo, titleEn, group, accentClass) {
    const wdlLabel = { W: isKorean ? '승' : 'W', D: isKorean ? '무' : 'D', L: isKorean ? '패' : 'L' };
    return `
      <div class="ti-impact-col ${accentClass}">
        <div class="ti-impact-col-head lbl" data-en="${titleEn}" data-ko="${titleKo}">${isKorean ? titleKo : titleEn}</div>
        <div class="ti-impact-col-matches">${group.matches}${isKorean ? '경기' : ' matches'}</div>
        <div class="ti-impact-wdl">
          <span class="ti-impact-wdl-w">${group.wins}${wdlLabel.W}</span>
          <span class="ti-impact-wdl-d">${group.draws}${wdlLabel.D}</span>
          <span class="ti-impact-wdl-l">${group.losses}${wdlLabel.L}</span>
        </div>
        <div class="ti-impact-winrate">${group.winRate}%<span class="lbl" data-en=" win rate" data-ko=" 승률">${isKorean ? ' 승률' : ' win rate'}</span></div>
        <div class="ti-impact-avg-row">
          <div class="ti-impact-avg-item">
            <b>${group.goalsForAvg}</b>
            <span class="lbl" data-en="Goals/gm" data-ko="경기당 득점">${isKorean ? '경기당 득점' : 'Goals/gm'}</span>
          </div>
          <div class="ti-impact-avg-item">
            <b>${group.goalsAgainstAvg}</b>
            <span class="lbl" data-en="Conceded/gm" data-ko="경기당 실점">${isKorean ? '경기당 실점' : 'Conceded/gm'}</span>
          </div>
        </div>
      </div>`;
  }

  function renderKeyPlayerImpactCard() {
    const candidates = (typeof computeKeyPlayerImpactCandidates === 'function') ? computeKeyPlayerImpactCandidates() : [];
    if (!candidates.length) {
      return `
        <div class="ti-card ti-impact-card" id="teamInfoImpactCard">
          <div class="ti-card-title lbl" data-en="Key Player Impact" data-ko="핵심 선수 영향도">${isKorean ? '핵심 선수 영향도' : 'Key Player Impact'}</div>
          <div class="ti-appear-empty lbl" data-en="Not enough lineup data yet" data-ko="아직 비교할 만큼 라인업 데이터가 쌓이지 않았습니다">${isKorean ? '아직 비교할 만큼 라인업 데이터가 쌓이지 않았습니다' : 'Not enough lineup data yet'}</div>
        </div>`;
    }

    if (selectedImpactPlayerNumber === null || !candidates.some(c => c.number === selectedImpactPlayerNumber)) {
      selectedImpactPlayerNumber = candidates[0].number;
    }
    const current = candidates.find(c => c.number === selectedImpactPlayerNumber);

    const chipsHtml = candidates.map(c => {
      const name = isKorean ? c.nameKo : c.nameEn;
      const isActive = c.number === selectedImpactPlayerNumber;
      const photo = c.photoSrc
        ? `<img class="ti-impact-chip-photo" src="${c.photoSrc}" alt="${c.nameEn}">`
        : `<div class="ti-impact-chip-photo ti-impact-chip-photo-placeholder">👤</div>`;
      const scoreSign = c.impactScore > 0 ? '+' : '';
      const scoreClass = c.impactScore > 0 ? 'ti-impact-chip-score-pos' : (c.impactScore < 0 ? 'ti-impact-chip-score-neg' : '');
      return `
        <div class="ti-impact-chip${isActive ? ' ti-impact-chip-active' : ''}" data-player-number="${c.number}">
          ${photo}
          <span class="ti-impact-chip-name lbl" data-en="${c.nameEn}" data-ko="${c.nameKo}">${name}</span>
          <span class="ti-impact-chip-score ${scoreClass}">${scoreSign}${c.impactScore}</span>
        </div>`;
    }).join('');

    return `
      <div class="ti-card ti-impact-card" id="teamInfoImpactCard">
        <div class="ti-card-title lbl" data-en="Key Player Impact" data-ko="핵심 선수 영향도">${isKorean ? '핵심 선수 영향도' : 'Key Player Impact'}</div>
        <div class="ti-gk-card-note lbl" data-en="Ranked by impact — points/game with the player starting vs. not featuring at all" data-ko="영향력(선발 출전 시·결장 시 경기당 승점 차이) 높은 순">${isKorean ? '영향력(선발 출전 시·결장 시 경기당 승점 차이) 높은 순' : 'Ranked by impact — points/game with the player starting vs. not featuring at all'}</div>
        <div class="ti-impact-chip-row">${chipsHtml}</div>
        <div class="ti-impact-compare">
          ${impactStatColHtml('선발 출전 시', 'Starting', current.impact.with, 'ti-impact-col-with')}
          <div class="ti-impact-vs">VS</div>
          ${impactStatColHtml('결장 시', 'Absent', current.impact.without, 'ti-impact-col-without')}
        </div>
      </div>`;
  }

  document.addEventListener('click', function(event) {
    const chip = event.target.closest('.ti-impact-chip');
    if (chip && chip.dataset.playerNumber) {
      selectedImpactPlayerNumber = parseInt(chip.dataset.playerNumber, 10);
      const el = document.getElementById('teamInfoImpactCard');
      if (el) el.outerHTML = renderKeyPlayerImpactCard();
    }
  });

  // ===== 치주물루 팀 정보 페이지의 "득점 순위" 섹션 (선수단 ↔ 상대전적 사이) =====
  function renderTeamScorersTab() {
    const el = document.getElementById('teamInfoScorersTab');
    if (!el) return;
    el.innerHTML = buildTeamScorerCardsHtml('Chizumulu United FC', '치주물루 유나이티드 FC')
      + renderGoalkeeperRecordCard()
      + renderAppearanceStatsCard()
      + renderGoalsByPositionCard()
      + renderKeyPlayerImpactCard();
  }

  function renderTeamStaffTab() {
    const el = document.getElementById('teamInfoStaffTab');
    if (!el) return;
    el.innerHTML = renderTeamStaffCard();
  }

  function renderSquadView() {
    const wrap = document.getElementById('squadGroups');
    wrap.innerHTML = '';

    POSITION_ORDER.forEach(pos => {
      const players = squadData
        .filter(p => p.position === pos)
        .slice()
        .sort((a, b) => a.number - b.number);
      if (players.length === 0) return;

      const group = document.createElement('div');
      group.className = 'squad-group';

      const label = POSITION_LABEL[pos];
      const title = document.createElement('div');
      title.className = 'squad-group-title';
      title.innerHTML = `<span class="lbl" data-en="${label.en}" data-ko="${label.ko}">${isKorean ? label.ko : label.en}</span><span class="squad-group-count">${players.length}</span>`;
      group.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'squad-card-grid';

      players.forEach(p => {
        const card = document.createElement('div');
        card.className = 'squad-card';
        card.dataset.playerNumber = p.number;

        let badge = '';
        if (p.isCaptain) {
          badge = `<span class="squad-band squad-band-c" title="${isKorean ? '주장' : 'Captain'}">C</span>`;
        } else if (p.isViceCaptain) {
          badge = `<span class="squad-band squad-band-vc" title="${isKorean ? '부주장' : 'Vice-Captain'}">VC</span>`;
        }

        const playerName = isKorean ? p.nameKo : p.nameEn;

        const photo = p.photoSrc
          ? `<img class="squad-card-photo" src="${p.photoSrc}" alt="${p.nameEn}">`
          : `<div class="squad-card-photo squad-card-photo-placeholder">${p.number}</div>`;

        card.innerHTML = `
          <div class="squad-card-number">${p.number}</div>
          ${photo}
          <div class="squad-card-body">
            <div class="squad-card-name lbl" data-en="${p.nameEn}" data-ko="${p.nameKo}">${playerName}</div>
            <div class="squad-card-pos">${pos}</div>
          </div>
          ${badge}
        `;
        grid.appendChild(card);
      });

      group.appendChild(grid);
      wrap.appendChild(group);
    });
  }


  // ===== 라운드별 경기결과 렌더링 (Round Results View) =====
  let currentRoundKey = null;

  function getTeamLogo(nameEn) {
    const team = leagueData.find(t => t.nameEn === nameEn);
    return team ? team.logoSrc : '';
  }

  function sortedRoundKeys() {
    return Object.keys(roundsData).sort((a, b) => {
      const na = parseInt(a.replace('round', ''), 10);
      const nb = parseInt(b.replace('round', ''), 10);
      return na - nb;
    });
  }

  function allRoundKeysIncludingScheduled() {
    const keys = new Set([...Object.keys(roundsData), ...Object.keys(scheduledRounds || {})]);
    return Array.from(keys).sort((a, b) => {
      const na = parseInt(a.replace('round', ''), 10);
      const nb = parseInt(b.replace('round', ''), 10);
      return na - nb;
    });
  }

  function buildRoundMatches(roundKey) {
    if (roundsData[roundKey]) {
      const matches = roundsData[roundKey];
      const details = matchDetails[roundKey] || [];
      let detailIdx = 0;
      return matches.map(m => {
        if (m.byeKo || m.byeEn) {
          return { isBye: true, teamKo: m.byeKo, teamEn: m.byeEn };
        }
        // 연기(postponed)되었거나 스코어가 없는 경기는 matchDetails에 애초에
        // 항목이 존재하지 않으므로, detailIdx를 소비하지 않고 건너뜁니다.
        // (그렇지 않으면 이후 경기들의 득점자가 한 칸씩 밀려서 엉뚱하게 매칭됩니다.)
        if (m.postponed || typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') {
          return {
            isBye: false, isScheduled: !!m.postponed,
            homeKo: m.homeKo, homeEn: m.homeEn, awayKo: m.awayKo, awayEn: m.awayEn,
            homeScore: m.homeScore, awayScore: m.awayScore,
            postponed: m.postponed,
            scorersHome: undefined, scorersAway: undefined
          };
        }
        const d = details[detailIdx] || {};
        detailIdx++;
        return {
          isBye: false, isScheduled: false,
          homeKo: m.homeKo, homeEn: m.homeEn, awayKo: m.awayKo, awayEn: m.awayEn,
          homeScore: m.homeScore, awayScore: m.awayScore,
          scorersHome: d.scorersHome, scorersAway: d.scorersAway
        };
      });
    }
    const scheduled = (scheduledRounds && scheduledRounds[roundKey]) || [];
    return scheduled.map(m => {
      if (m.byeKo || m.byeEn) {
        return { isBye: true, teamKo: m.byeKo, teamEn: m.byeEn };
      }
      // 라운드가 통째로 끝나기 전이라도, 개별 경기에 homeScore/awayScore가
      // 미리 채워져 있으면(=그 경기만 먼저 끝난 경우) 완료된 경기로 표시합니다.
      if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
        return {
          isBye: false, isScheduled: false,
          homeKo: m.homeKo, homeEn: m.homeEn, awayKo: m.awayKo, awayEn: m.awayEn,
          homeScore: m.homeScore, awayScore: m.awayScore,
          scorersHome: m.scorersHome, scorersAway: m.scorersAway
        };
      }
      return {
        isBye: false, isScheduled: true,
        homeKo: m.homeKo, homeEn: m.homeEn, awayKo: m.awayKo, awayEn: m.awayEn,
        kickoffDate: m.kickoffDate, kickoffTime: m.kickoffTime, postponed: m.postponed
      };
    });
  }

  function isMyTeamName(nameEn, nameKo) {
    return nameEn === 'Chizumulu United FC' || nameKo === '치주물루 유나이티드 FC';
  }

  // roundKey가 완전히 끝난 라운드(roundsData)이거나, 아직 scheduledRounds에 있어도
  // 그 안에 스코어가 채워진 경기가 하나라도 있으면 true를 반환합니다.
  function roundHasAnyResult(roundKey) {
    if (roundsData[roundKey]) return true;
    const scheduled = (scheduledRounds && scheduledRounds[roundKey]) || [];
    return scheduled.some(m => !m.byeKo && !m.byeEn && typeof m.homeScore === 'number' && typeof m.awayScore === 'number');
  }

  // "라운드별 결과"에서 기본으로 보여줄 라운드: 결과가 하나라도 들어온 라운드 중 가장 최신 것.
  // (라운드가 통째로 끝나지 않았어도, 그 주차 경기 중 하나라도 스코어가 있으면 그 주차를 기본으로 보여줍니다.)
  function latestRoundWithResult() {
    const keys = allRoundKeysIncludingScheduled();
    for (let i = keys.length - 1; i >= 0; i--) {
      if (roundHasAnyResult(keys[i])) return keys[i];
    }
    return keys[0] || null;
  }

  // 화면을 열었을 때 기본으로 보여줄 라운드.
  // 가장 최근에 결과가 들어온 라운드가 이미 통째로 끝나(roundsData로 옮겨져) 있고
  // 그다음 주차가 존재하면, 이제는 그 다음 주차를 기본으로 보여줍니다.
  // (예: 7주차가 완전히 끝나면 8주차가 아직 시작 전이어도 바로 뜹니다.)
  // 다음 주차가 아직 없거나, 최신 라운드가 아직 부분적으로만 끝난 경우엔 그대로 그 라운드를 보여줍니다.
  function defaultDisplayRoundKey() {
    const keys = allRoundKeysIncludingScheduled();
    const latest = latestRoundWithResult();
    if (!latest) return keys[0] || null;
    if (roundsData[latest]) {
      const idx = keys.indexOf(latest);
      const next = keys[idx + 1];
      if (next) return next;
    }
    return latest;
  }

  // roundsData(완전히 끝나 옮겨진 라운드) + scheduledRounds에 남아있어도 이미
  // 결과가 채워진 라운드(예: 다음 라운드가 시작되기 전까지 순위변동 비교를 위해
  // 잠시 scheduledRounds에 남아있는 완료 라운드)까지 모두 포함해서, 실제로 결과가
  // 있는 라운드만 순서대로 반환합니다. 팀별 홈/원정 성적, 팀 결과 목록 등
  // "이미 끝난 경기는 전부 보여줘야 하는" 화면에서 sortedRoundKeys() 대신 이걸 씁니다.
  function completedRoundKeysIncludingScheduled() {
    return allRoundKeysIncludingScheduled().filter(roundHasAnyResult);
  }

  // 완료된 라운드를 훑어서 홈/원정 각각의 (승수/경기수)를 계산합니다.
  function computeHomeAwayRecord(nameEn, nameKo) {
    const home = { played: 0, won: 0 };
    const away = { played: 0, won: 0 };
    completedRoundKeysIncludingScheduled().forEach(key => {
      buildRoundMatches(key).forEach(m => {
        if (m.isBye) return;
        const isHome = m.homeEn === nameEn || m.homeKo === nameKo;
        const isAway = m.awayEn === nameEn || m.awayKo === nameKo;
        if (isHome) {
          home.played++;
          if (m.homeScore > m.awayScore) home.won++;
        } else if (isAway) {
          away.played++;
          if (m.awayScore > m.homeScore) away.won++;
        }
      });
    });
    return { home, away };
  }

  // 홈팀 nameEn 으로 leagueData 에서 구장 정보를 찾아줍니다 (경기는 홈팀 구장에서 열림)
  function getTeamVenue(nameEn) {
    const team = leagueData.find(t => t.nameEn === nameEn);
    return (team && team.venue) ? team.venue : null;
  }

  function venueCaptionHtml(homeEn) {
    const venue = getTeamVenue(homeEn);
    if (!venue) return '';
    const venueName = isKorean ? venue.nameKo : venue.nameEn;
    return `<div class="rmc-venue">🏟️ ${venueName}</div>`;
  }

  // ===== 경기 예정일 현지(구장) 날씨 예보 =====
  // Open-Meteo(무료, API 키 불필요)로 홈 구장 좌표 + 킥오프 날짜/시간 기준
  // 예보를 가져옵니다. 우리 팀(치주물루) 다음 경기에서만 사용합니다.
  const weatherFetchCache = {};

  function weatherCodeInfo(code) {
    const map = {
      0: { emoji: '☀️', ko: '맑음', en: 'Clear' },
      1: { emoji: '🌤️', ko: '대체로 맑음', en: 'Mostly clear' },
      2: { emoji: '⛅', ko: '부분 흐림', en: 'Partly cloudy' },
      3: { emoji: '☁️', ko: '흐림', en: 'Overcast' },
      45: { emoji: '🌫️', ko: '안개', en: 'Fog' },
      48: { emoji: '🌫️', ko: '안개', en: 'Fog' },
      51: { emoji: '🌦️', ko: '약한 이슬비', en: 'Light drizzle' },
      53: { emoji: '🌦️', ko: '이슬비', en: 'Drizzle' },
      55: { emoji: '🌧️', ko: '강한 이슬비', en: 'Dense drizzle' },
      61: { emoji: '🌦️', ko: '약한 비', en: 'Light rain' },
      63: { emoji: '🌧️', ko: '비', en: 'Rain' },
      65: { emoji: '🌧️', ko: '강한 비', en: 'Heavy rain' },
      71: { emoji: '🌨️', ko: '약한 눈', en: 'Light snow' },
      73: { emoji: '🌨️', ko: '눈', en: 'Snow' },
      75: { emoji: '🌨️', ko: '강한 눈', en: 'Heavy snow' },
      80: { emoji: '🌦️', ko: '약한 소나기', en: 'Light showers' },
      81: { emoji: '🌧️', ko: '소나기', en: 'Rain showers' },
      82: { emoji: '⛈️', ko: '강한 소나기', en: 'Violent showers' },
      95: { emoji: '⛈️', ko: '뇌우', en: 'Thunderstorm' },
      96: { emoji: '⛈️', ko: '뇌우(우박 동반)', en: 'Thunderstorm w/ hail' },
      99: { emoji: '⛈️', ko: '강한 뇌우(우박 동반)', en: 'Severe thunderstorm' }
    };
    return map[code] || { emoji: '🌡️', ko: '날씨 정보', en: 'Weather' };
  }

  async function fetchKickoffWeather(lat, lng, dateStr, timeStr) {
    const cacheKey = `${lat},${lng},${dateStr},${timeStr}`;
    if (weatherFetchCache[cacheKey]) return weatherFetchCache[cacheKey];
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,weathercode&timezone=Africa%2FBlantyre&start_date=${dateStr}&end_date=${dateStr}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather fetch failed');
      const data = await res.json();
      const hh = String(timeStr).split(':')[0].padStart(2, '0');
      const targetTime = `${dateStr}T${hh}:00`;
      const idx = data.hourly && data.hourly.time ? data.hourly.time.indexOf(targetTime) : -1;
      if (idx === -1) throw new Error('no matching forecast hour (too far in the future)');
      const result = {
        temp: data.hourly.temperature_2m[idx],
        precip: data.hourly.precipitation_probability[idx],
        code: data.hourly.weathercode[idx]
      };
      weatherFetchCache[cacheKey] = result;
      return result;
    } catch (e) {
      return null;
    }
  }

  // 날씨 위젯의 "자리"만 먼저 그리고, 실제 값은 비동기로 채워 넣습니다.
  // extraClass로 넣은 컨텍스트(팀정보/라운드뷰/메인 스트립)에 따라 위젯 스타일을 살짝 다르게 줄 수 있고,
  // compact=true면 이모지+기온만 아주 간단히 보여줍니다(메인화면 다음경기 스트립용).
  function matchWeatherPlaceholderHtml(homeEn, dateStr, timeStr, extraClass, compact) {
    const venue = getTeamVenue(homeEn);
    if (!venue || typeof venue.lat !== 'number' || typeof venue.lng !== 'number' || !dateStr || !timeStr) return '';
    return `<span class="match-weather${extraClass ? ' ' + extraClass : ''}" data-pending="1" data-lat="${venue.lat}" data-lng="${venue.lng}" data-date="${dateStr}" data-time="${timeStr}"${compact ? ' data-compact="1"' : ''}>
      <span class="mw-loading lbl" data-en="Loading weather…" data-ko="날씨 불러오는 중…">${compact ? '' : (isKorean ? '날씨 불러오는 중…' : 'Loading weather…')}</span>
    </span>`;
  }

  // 화면에 방금 그려 넣은 날씨 위젯 자리(.match-weather[data-pending])를 찾아 실제로 채웁니다.
  function hydrateWeatherWidgets() {
    document.querySelectorAll('.match-weather[data-pending="1"]').forEach(el => {
      el.removeAttribute('data-pending');
      const lat = el.getAttribute('data-lat');
      const lng = el.getAttribute('data-lng');
      const dateStr = el.getAttribute('data-date');
      const timeStr = el.getAttribute('data-time');
      const compact = el.getAttribute('data-compact') === '1';
      fetchKickoffWeather(lat, lng, dateStr, timeStr).then(w => {
        if (!el.isConnected) return;
        if (!w) {
          el.innerHTML = compact ? '' : `<span class="mw-unavailable lbl" data-en="Forecast not available yet" data-ko="아직 예보가 나오지 않았어요">${isKorean ? '아직 예보가 나오지 않았어요' : 'Forecast not available yet'}</span>`;
          return;
        }
        const info = weatherCodeInfo(w.code);
        if (compact) {
          el.innerHTML = `<span class="mw-emoji">${info.emoji}</span><span class="mw-temp">${Math.round(w.temp)}°C</span>`;
          return;
        }
        const condTxt = isKorean ? info.ko : info.en;
        el.innerHTML = `
          <span class="mw-emoji">${info.emoji}</span>
          <span class="mw-temp">${Math.round(w.temp)}°C</span>
          <span class="mw-cond lbl" data-en="${info.en}" data-ko="${info.ko}">${condTxt}</span>
          <span class="mw-precip">💧 ${w.precip}%</span>
        `;
      });
    });
  }

  function renderRoundsView() {
    const tabBar = document.getElementById('roundTabBar');
    const roundKeys = allRoundKeysIncludingScheduled();

    if (!currentRoundKey || !(roundsData[currentRoundKey] || (scheduledRounds && scheduledRounds[currentRoundKey]))) {
      currentRoundKey = defaultDisplayRoundKey();
    }

    tabBar.innerHTML = '';
    let activeBtn = null;
    roundKeys.forEach((key, idx) => {
      const weekNum = idx + 1;
      const btn = document.createElement('button');
      const isActive = key === currentRoundKey;
      btn.className = 'round-tab-btn' + (isActive ? ' active' : '');
      btn.innerHTML = `<span class="lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${isKorean ? weekNum + '주차' : 'Week ' + weekNum}</span>`;
      btn.onclick = () => { currentRoundKey = key; renderRoundsView(); };
      if (isActive) activeBtn = btn;
      tabBar.appendChild(btn);
    });
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    const listEl = document.getElementById('roundMatchList');
    listEl.innerHTML = '';

    const matches = buildRoundMatches(currentRoundKey)
      .slice()
      .sort((a, b) => {
        const aMine = a.isBye ? isMyTeamName(a.teamEn, a.teamKo) : (isMyTeamName(a.homeEn, a.homeKo) || isMyTeamName(a.awayEn, a.awayKo));
        const bMine = b.isBye ? isMyTeamName(b.teamEn, b.teamKo) : (isMyTeamName(b.homeEn, b.homeKo) || isMyTeamName(b.awayEn, b.awayKo));
        return (bMine ? 1 : 0) - (aMine ? 1 : 0);
      });

    matches.forEach(m => {
      if (m.isBye) {
        const card = document.createElement('div');
        card.className = 'round-match-card round-bye-card';
        const logo = getTeamLogo(m.teamEn);
        const teamName = isKorean ? m.teamKo : m.teamEn;
        card.innerHTML = `
          ${logo ? `<img class="team-logo-sm" src="${logo}" alt="${m.teamEn}">` : ''}
          <span class="lbl" data-en="${m.teamEn}" data-ko="${m.teamKo}">${teamName}</span>
          <span class="round-bye-badge lbl" data-en="BYE" data-ko="휴식주">${isKorean ? '휴식주' : 'BYE'}</span>
        `;
        listEl.appendChild(card);
        return;
      }

      const mine = isMyTeamName(m.homeEn, m.homeKo) || isMyTeamName(m.awayEn, m.awayKo);
      const homeLogo = getTeamLogo(m.homeEn);
      const awayLogo = getTeamLogo(m.awayEn);
      const homeName = isKorean ? m.homeKo : m.homeEn;
      const awayName = isKorean ? m.awayKo : m.awayEn;

      if (m.isScheduled) {
        const kickoffTxt = formatKickoff({ kickoffDate: m.kickoffDate, kickoffTime: m.kickoffTime });
        const card = document.createElement('div');
        card.className = 'round-match-card round-match-scheduled' + (mine ? ' my-team' : '');
        card.innerHTML = `
          <div class="rmc-teams">
            <div class="rmc-team rmc-home">
              ${homeLogo ? `<img class="team-logo-sm" src="${homeLogo}" alt="${m.homeEn}">` : ''}
              <span class="lbl" data-en="${m.homeEn}" data-ko="${m.homeKo}">${homeName}</span>
            </div>
            <div class="rmc-score rmc-score-pending">
              <span class="rmc-pending-badge lbl" data-en="${m.postponed ? 'Postponed' : 'Upcoming'}" data-ko="${m.postponed ? '경기 연기' : '경기 시작 전'}">${isKorean ? (m.postponed ? '경기 연기' : '경기 시작 전') : (m.postponed ? 'Postponed' : 'Upcoming')}</span>
            </div>
            <div class="rmc-team rmc-away">
              <span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span>
              ${awayLogo ? `<img class="team-logo-sm" src="${awayLogo}" alt="${m.awayEn}">` : ''}
            </div>
          </div>
          ${kickoffTxt ? `<div class="rmc-kickoff">${kickoffTxt}</div>` : ''}
          ${venueCaptionHtml(m.homeEn)}
          ${mine ? matchWeatherPlaceholderHtml(m.homeEn, m.kickoffDate, m.kickoffTime, 'rmc-weather') : ''}
          <button type="button" class="rmc-compare-btn lbl" data-en="Compare Teams" data-ko="전적 비교">⚖️ ${isKorean ? '전적 비교' : 'Compare Teams'}</button>
        `;
        listEl.appendChild(card);
        const compareBtn = card.querySelector('.rmc-compare-btn');
        if (compareBtn) {
          compareBtn.addEventListener('click', () => {
            openMatchCompareModal(m.homeEn, m.homeKo, m.awayEn, m.awayKo, currentRoundKey);
          });
        }
        return;
      }

      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;

      const noneLabel = isKorean ? '득점자 없음' : 'No scorers';
      const scorersHomeText = (m.scorersHome === '없음' || !m.scorersHome) ? noneLabel : renderScorerNamesHtml(m.scorersHome, isKorean);
      const scorersAwayText = (m.scorersAway === '없음' || !m.scorersAway) ? noneLabel : renderScorerNamesHtml(m.scorersAway, isKorean);

      const card = document.createElement('div');
      card.className = 'round-match-card' + (mine ? ' my-team' : '');
      card.innerHTML = `
        <div class="rmc-teams">
          <div class="rmc-team rmc-home${homeWin ? ' rmc-winner' : ''}">
            ${homeLogo ? `<img class="team-logo-sm" src="${homeLogo}" alt="${m.homeEn}">` : ''}
            <span class="lbl" data-en="${m.homeEn}" data-ko="${m.homeKo}">${homeName}</span>
          </div>
          <div class="rmc-score">
            <span class="rmc-score-num${homeWin ? ' rmc-score-win' : ''}">${m.homeScore}</span>
            <span class="rmc-score-sep">:</span>
            <span class="rmc-score-num${awayWin ? ' rmc-score-win' : ''}">${m.awayScore}</span>
          </div>
          <div class="rmc-team rmc-away${awayWin ? ' rmc-winner' : ''}">
            <span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span>
            ${awayLogo ? `<img class="team-logo-sm" src="${awayLogo}" alt="${m.awayEn}">` : ''}
          </div>
        </div>
        <div class="rmc-scorers">
          <div class="rmc-scorers-col">
            <span class="rmc-scorers-icon">⚽</span>
            <span class="rmc-scorers-text">${scorersHomeText}</span>
          </div>
          <div class="rmc-scorers-col rmc-scorers-col-away">
            <span class="rmc-scorers-text">${scorersAwayText}</span>
            <span class="rmc-scorers-icon">⚽</span>
          </div>
        </div>
        ${venueCaptionHtml(m.homeEn)}
      `;
      listEl.appendChild(card);
    });

    attachImageFallback();
    hydrateWeatherWidgets();
  }


  // ===== 연기된 경기 모아보기 (Postponed Matches Modal) =====
  // roundsData(완전히 끝난 라운드)와 scheduledRounds(진행 중/예정 라운드)를 모두 훑어서
  // postponed: true로 표시된 경기를 전부 모읍니다. 라운드 전체가 끝나 roundsData로
  // 옮겨진 뒤에도, 그 안에 postponed 경기가 남아있으면 계속 이 목록에 표시됩니다.
  // 결과가 확정되면(=homeScore/awayScore가 채워지면) postponed 플래그도 함께
  // 지워주면 이 목록에서 자동으로 빠집니다.
  function getAllPostponedMatches() {
    const roundKeys = allRoundKeysIncludingScheduled();
    const list = [];
    roundKeys.forEach((key, idx) => {
      const matches = roundsData[key] || (scheduledRounds && scheduledRounds[key]) || [];
      matches.forEach(m => {
        if (!m.postponed || m.byeKo || m.byeEn) return;
        list.push({
          weekNum: idx + 1,
          homeKo: m.homeKo, homeEn: m.homeEn,
          awayKo: m.awayKo, awayEn: m.awayEn
        });
      });
    });
    return list;
  }

  function renderPostponedMatchesModal() {
    const body = document.getElementById('postponedMatchesBody');
    if (!body) return;
    const list = getAllPostponedMatches();

    if (!list.length) {
      body.innerHTML = `
        <div class="postponed-empty lbl" data-en="No postponed matches right now." data-ko="현재 연기된 경기가 없어요.">${isKorean ? '현재 연기된 경기가 없어요.' : 'No postponed matches right now.'}</div>
      `;
      return;
    }

    body.innerHTML = list.map(m => {
      const weekLabel = isKorean ? `${m.weekNum}주차` : `Week ${m.weekNum}`;
      const homeLogo = getTeamLogo(m.homeEn);
      const awayLogo = getTeamLogo(m.awayEn);
      const homeName = isKorean ? m.homeKo : m.homeEn;
      const awayName = isKorean ? m.awayKo : m.awayEn;
      return `
        <div class="postponed-match-row">
          <span class="postponed-week-badge lbl" data-en="Week ${m.weekNum}" data-ko="${m.weekNum}주차">${weekLabel}</span>
          <div class="postponed-match-teams">
            <div class="postponed-match-team">
              ${homeLogo ? `<img class="team-logo-sm" src="${homeLogo}" alt="${m.homeEn}">` : ''}
              <span class="lbl" data-en="${m.homeEn}" data-ko="${m.homeKo}">${homeName}</span>
            </div>
            <span class="postponed-vs">vs</span>
            <div class="postponed-match-team postponed-match-team-away">
              <span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span>
              ${awayLogo ? `<img class="team-logo-sm" src="${awayLogo}" alt="${m.awayEn}">` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    attachImageFallback();
  }

  function openPostponedMatchesModal() {
    renderPostponedMatchesModal();
    const modal = document.getElementById('postponedMatchesModal');
    if (modal) modal.style.display = 'flex';
  }

  function closePostponedMatchesModal() {
    const modal = document.getElementById('postponedMatchesModal');
    if (modal) modal.style.display = 'none';
  }


  // ===== 득점 순위표 렌더링 (Top Scorers Table) =====
  function renderScorersTable() {
    const tbody = document.getElementById('scorersTableBody');
    tbody.innerHTML = '';

    const sorted = topScorersData.slice().sort((a, b) => (b.goals - a.goals) || playerMineFirst(a, b));

    let displayRank = 1;
    let prevGoals = null;

    sorted.forEach((player, idx) => {
      if (idx > 0) {
        if (player.goals !== prevGoals) {
          displayRank = idx + 1;
        }
      }
      prevGoals = player.goals;

      const playerName = isKorean ? player.nameKo : player.nameEn;
      const teamName = isKorean ? player.teamKo : player.teamEn;

      const tr = document.createElement('tr');
      if (player.teamEn === 'Chizumulu United FC' || player.teamKo === '치주물루 유나이티드 FC') {
        tr.classList.add('my-team');
      }

      // 팀 정보 탭의 선수단 카드와 동일한 조건: photoSrc 가 있으면 사진을, 없으면 표시하지 않습니다.
      const scorerPhoto = player.photoSrc
        ? `<img class="scorer-player-photo" src="${player.photoSrc}" alt="${player.nameEn}">`
        : '';

      tr.innerHTML = `
        <td class="rank-cell">${displayRank}</td>
        <td class="team">
          ${scorerPhoto}
          <span class="lbl player-name-link" data-en="${player.nameEn}" data-ko="${player.nameKo}" data-player-key="${player.key}">${playerName}</span>
        </td>
        <td class="team">
          ${player.teamLogo ? `<img class="team-logo" src="${player.teamLogo}" alt="${player.teamEn}">` : ''}
          <span class="lbl" data-en="${player.teamEn}" data-ko="${player.teamKo}">${teamName}</span>
        </td>
        <td class="pts">${player.goals}</td>
      `;
      tbody.appendChild(tr);
    });

    if (sorted.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" style="padding:24px; color:var(--color-text-faint);">${isKorean ? '득점 데이터가 아직 없습니다.' : 'No scorer data yet.'}</td>`;
      tbody.appendChild(tr);
    }

    refreshScrollFadeHints();
  }


  // 순위표 필터 상태: 'all' | 'home' | 'away'
  let currentRankFilter = 'all';

  // roundsData(라운드별 홈/원정 결과)를 홈 경기만 또는 원정 경기만으로
  // 걸러서 팀별 경기수/승무패/득실/최근 폼을 다시 계산합니다.
  // (전체 순위는 leagueData에 이미 계산되어 있으므로 그대로 사용)
  function computeLocationStandings(filterType) {
    const state = {};
    leagueData.forEach(t => {
      state[t.nameEn] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, form: [] };
    });

    // roundsData(완전히 끝나 옮겨진 라운드)뿐 아니라 scheduledRounds에 남아있어도
    // 이미 스코어가 채워진 라운드(예: 아직 다음 라운드로 넘어가지 않아 scheduledRounds에
    // 머물러 있는 현재 라운드)까지 합쳐야, 홈/원정 분할 기록이 '전체' 순위표와
    // 동일한 시점의 최신 결과를 반영합니다.
    const merged = {};
    Object.keys(roundsData || {}).forEach(k => { merged[k] = roundsData[k]; });
    Object.keys(scheduledRounds || {}).forEach(k => { if (!merged[k]) merged[k] = scheduledRounds[k]; });

    const roundKeys = Object.keys(merged).sort((a, b) => {
      const na = parseInt(a.replace('round', ''), 10);
      const nb = parseInt(b.replace('round', ''), 10);
      return na - nb;
    });

    roundKeys.forEach(roundKey => {
      (merged[roundKey] || []).forEach(m => {
        if (m.byeKo || m.byeEn) return;
        if (!m.homeEn || !m.awayEn) return;
        // 연기(postponed)되었거나 아직 스코어가 없는 예정 경기는 집계에서 제외합니다.
        if (m.postponed || typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

        const wantHome = filterType === 'home';
        const teamName = wantHome ? m.homeEn : m.awayEn;
        const s = state[teamName];
        if (!s) return;

        const myScore = wantHome ? m.homeScore : m.awayScore;
        const oppScore = wantHome ? m.awayScore : m.homeScore;

        s.played += 1;
        s.gf += myScore;
        s.ga += oppScore;

        let result;
        if (myScore > oppScore) { s.won += 1; result = 'W'; }
        else if (myScore < oppScore) { s.lost += 1; result = 'L'; }
        else { s.drawn += 1; result = 'D'; }

        s.form.push(result);
      });
    });

    return leagueData.map(team => {
      const s = state[team.nameEn];
      return {
        nameKo: team.nameKo,
        nameEn: team.nameEn,
        logoSrc: team.logoSrc,
        nextMatch: team.nextMatch,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.gf,
        goalsAgainst: s.ga,
        form: s.form.slice(-5)
      };
    });
  }

  // 승점·득실차 계산 후 정렬된 순위표를 반환 (테이블 렌더링과 이미지 내보내기가 공용으로 사용)
  function getRankedTeams(filterType) {
    const filter = filterType || currentRankFilter;
    const baseData = filter === 'all'
      ? leagueData
      : computeLocationStandings(filter);

    const processedData = baseData.map(team => {
      team.pts = (team.won * 3) + (team.drawn * 1);
      team.gd = team.goalsFor - team.goalsAgainst;
      return team;
    });

    processedData.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // 승점·득실차·득점까지 완전히 동률이면, 그 동률 그룹 안에서는
      // 치주물루 유나이티드를 맨 위로 올려줍니다.
      return teamMineFirst(a, b);
    });

    return processedData;
  }

  // ===== 순위 변동(전주 대비) 계산 =====
  // - "이전 순위"는 가장 최근에 '완전히' 끝난 라운드(roundsData) 시점 기준 순위입니다.
  //   (computeStandingsHistory가 라운드별로 쌓아둔 스냅샷 중, 진행 중인 라운드의
  //    부분 결과 스냅샷은 제외하고 마지막 "완료 라운드" 스냅샷만 사용합니다.)
  // - 아직 완료된 라운드가 하나도 없는 시즌 첫 주에는 비교 대상이 없으므로 null을 반환합니다.
  function getPreviousRoundRanks() {
    const completed = sortedRoundKeys().length;
    if (completed === 0) return null;
    const history = computeStandingsHistory();
    // history[0]은 1라운드 종료 시점, history[completed-1]은 가장 최근 완료 라운드 종료 시점입니다.
    // (진행 중인 라운드의 부분 결과로 추가된 마지막 스냅샷은 여기서 쓰지 않습니다.)
    const snapshot = history[completed - 1];
    return snapshot ? snapshot.ranks : null;
  }

  // 지금 진행 중인 라운드(scheduledRounds의 다음 라운드) 안에서, 이미 스코어가
  // 입력되어 "그 주차 경기를 치른" 팀들만 골라 이름(nameEn) 집합으로 반환합니다.
  // 순위 변동 표시는 이 집합에 포함된 팀에게만 보여주고, 나머지 팀은 해당 라운드
  // 경기 결과가 들어올 때까지 잠시 숨깁니다. 새 라운드가 시작되면 이 집합은
  // 자동으로 다시 빈 상태에서 시작되므로 별도의 리셋 로직이 필요 없습니다.
  function getCurrentRoundPlayedTeams() {
    const completed = sortedRoundKeys().length;
    const currentKey = 'round' + (completed + 1);
    const matches = (scheduledRounds && scheduledRounds[currentKey]) || [];
    const played = new Set();
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
        played.add(m.homeEn);
        played.add(m.awayEn);
      }
    });
    return played;
  }

  // 가장 최근에 '완전히' 끝난 라운드(roundsData의 마지막 라운드)에서 실제로 경기를
  // 치른 팀들만 이름(nameEn) 집합으로 반환합니다. n주차가 아직 시작 전일 때
  // n-1주차 순위변동표를 그대로 보여주기 위한 fallback 용도로 사용됩니다.
  function getLastCompletedRoundPlayedTeams() {
    const keys = sortedRoundKeys();
    const lastKey = keys[keys.length - 1];
    if (!lastKey) return new Set();
    const matches = roundsData[lastKey] || [];
    const played = new Set();
    matches.forEach(m => {
      if (m.byeKo || m.byeEn) return;
      if (typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
        played.add(m.homeEn);
        played.add(m.awayEn);
      }
    });
    return played;
  }

  // 순위 변동 표시에 쓸 "이전 순위"와 "표시 대상 팀"을 한 번에 계산합니다.
  // - n주차(다음 라운드) 경기가 이미 하나라도 입력됐다면: 기존처럼 n-1주차 종료
  //   시점 대비, 이번 라운드에 경기를 치른 팀만 변동을 보여줍니다.
  // - n주차 경기가 아직 하나도 입력되지 않았다면(=라운드 시작 전): 화면이 텅 비지
  //   않도록, 방금 끝난 n-1주차의 순위변동표(= n-2주차 종료 시점 대비 n-1주차
  //   종료 시점)를 그대로 이어서 보여줍니다.
  function getRankChangeDisplayData() {
    const completed = sortedRoundKeys().length;
    if (completed === 0) return { previousRanks: null, playedTeams: new Set() };

    const currentPlayedTeams = getCurrentRoundPlayedTeams();
    if (currentPlayedTeams.size > 0) {
      return { previousRanks: getPreviousRoundRanks(), playedTeams: currentPlayedTeams };
    }

    // n주차가 아직 시작 전: n-1주차 변동표로 fallback (비교 대상이 없는 시즌
    // 1주차 종료 직후라면 여전히 표시할 게 없으므로 빈 상태를 반환합니다)
    if (completed < 2) return { previousRanks: null, playedTeams: new Set() };
    const history = computeStandingsHistory();
    const snapshot = history[completed - 2];
    return {
      previousRanks: snapshot ? snapshot.ranks : null,
      playedTeams: getLastCompletedRoundPlayedTeams()
    };
  }

  // ===== 순위표 필터 전환 (전체 / 홈 / 원정) =====
  function setRankFilter(filterType) {
    if (currentRankFilter === filterType) return;
    currentRankFilter = filterType;
    document.querySelectorAll('.rank-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filterType);
    });
    // 홈/원정 분할표에서는 순위 변동 열 자체를 숨깁니다(전주 순위와 비교할 기준이 없음).
    const table = document.getElementById('mainTable');
    if (table) table.classList.toggle('hide-rank-change', filterType !== 'all');
    renderLeagueTable();
  }

  // ===== 매직넘버 (팀별 우승 / 잔류 확정) =====
  // 상대 팀이 남은 경기를 모두 이긴다는 가장 보수적인 가정으로 계산합니다.
  // 따라서 '매직넘버 N점'은 우리 팀의 승점 획득과 상대의 승점 손실을 합쳐 N점이 더
  // 필요하다는 뜻입니다. 동률 순위결정 기준이 확정되지 않았으므로 반드시 +1점을 둡니다.
  function getMagicNumberContext(rankedTeams) {
    const teamCount = rankedTeams.length;
    if (teamCount < 2) return null;

    const seasonRounds = (typeof SEASON_TOTAL_ROUNDS === 'number')
      ? SEASON_TOTAL_ROUNDS
      : (teamCount % 2 ? teamCount * 2 : (teamCount - 1) * 2);
    const seasonGames = (teamCount - 1) * 2;
    const completedRoundNumbers = Object.keys(roundsData || {})
      .concat(Object.keys(scheduledRounds || {}).filter(key => {
        const matches = scheduledRounds[key] || [];
        return matches.some(match => !match.byeEn && typeof match.homeScore === 'number' && typeof match.awayScore === 'number');
      }))
      .map(key => parseInt(key.replace('round', ''), 10))
      .filter(Number.isFinite);
    const currentRound = completedRoundNumbers.length ? Math.max.apply(null, completedRoundNumbers) : 0;
    const remainingRounds = Math.max(0, seasonRounds - currentRound);
    const maxPoints = team => team.pts + Math.max(0, seasonGames - team.played) * 3;
    return { remainingRounds, seasonGames, maxPoints, safeSlots: teamCount - 3 };
  }

  function getTeamMagicNumbers(team, rankedTeams, context) {
    const opponents = rankedTeams.filter(other => other.nameEn !== team.nameEn);
    const titleRival = opponents.reduce((best, other) => context.maxPoints(other) > context.maxPoints(best) ? other : best);
    const safetyThreshold = opponents.slice().sort((a, b) => context.maxPoints(b) - context.maxPoints(a))[context.safeSlots - 1];
    const numberAgainst = rival => Math.max(0, context.maxPoints(rival) - team.pts + 1);
    const remainingGames = Math.max(0, context.seasonGames - team.played);
    const winsNeeded = number => {
      if (number === 0) return 0;
      const wins = Math.ceil(number / 3);
      return wins <= remainingGames ? wins : null; // 남은 경기를 전승해도 승점만으로는 부족한 경우 null
    };
    const title = { number: numberAgainst(titleRival), rival: titleRival };
    const safety = { number: numberAgainst(safetyThreshold), rival: safetyThreshold };
    title.wins = winsNeeded(title.number);
    safety.wins = winsNeeded(safety.number);
    return { remainingGames, title, safety };
  }

  function magicNumberText(entry) {
    return entry.number === 0 ? (isKorean ? '확정' : 'CLINCHED') : (isKorean ? `${entry.number}점 남음` : `${entry.number} PTS LEFT`);
  }

  // 승점 매직넘버를 "최소 몇 승이면 확정"으로 환산한 배지 텍스트.
  // 이미 확정됐거나(0), 남은 경기를 전승해도 승점만으로 부족한 경우(null)에는 표시하지 않습니다.
  function magicNumberWinsText(entry) {
    if (entry.number === 0) return '';
    if (entry.wins === null) return isKorean ? '승점만으로는 이번 시즌 확정 불가' : 'Not clinchable by wins alone this season';
    return isKorean ? `최소 ${entry.wins}승이면 확정` : `Clinch with ${entry.wins} more win${entry.wins > 1 ? 's' : ''}`;
  }

  function buildTeamMagicNumberHtml(team, rankedTeams) {
    const context = getMagicNumberContext(rankedTeams);
    if (!context) return '';
    const numbers = getTeamMagicNumbers(team, rankedTeams, context);
    const name = isKorean ? team.nameKo : team.nameEn;
    const titleWinsMsg = magicNumberWinsText(numbers.title);
    const safetyWinsMsg = magicNumberWinsText(numbers.safety);
    const titleWinsHtml = titleWinsMsg ? `<span class="magic-number-wins${numbers.title.wins === null ? ' magic-number-wins-na' : ''}">${titleWinsMsg}</span>` : '';
    const safetyWinsHtml = safetyWinsMsg ? `<span class="magic-number-wins${numbers.safety.wins === null ? ' magic-number-wins-na' : ''}">${safetyWinsMsg}</span>` : '';
    return `<section class="team-magic-number-card"><div class="team-magic-number-head"><div><span class="magic-number-kicker">SEASON RACE</span><h3>${isKorean ? '매직넘버' : 'MAGIC NUMBER'}</h3></div><span class="magic-number-rounds">${isKorean ? `남은 ${context.remainingRounds}R · ${numbers.remainingGames}경기` : `${context.remainingRounds} rounds left · ${numbers.remainingGames} games`}</span></div><div class="magic-number-grid"><div class="magic-number-item title-race"><span class="magic-number-label">${isKorean ? '우승 확정' : 'TITLE CLINCH'}</span><strong>${magicNumberText(numbers.title)}</strong>${titleWinsHtml}<small>${isKorean ? `${numbers.title.rival.nameKo}의 최대 승점 기준` : `vs ${numbers.title.rival.nameEn}'s maximum`}</small></div><div class="magic-number-item safety-race"><span class="magic-number-label">${isKorean ? '잔류 확정' : 'SAFETY CLINCH'}</span><strong>${magicNumberText(numbers.safety)}</strong>${safetyWinsHtml}<small>${isKorean ? `12위 보장 기준 · ${numbers.safety.rival.nameKo}` : `Top-12 guarantee · ${numbers.safety.rival.nameEn}`}</small></div></div><p class="magic-number-note">${isKorean ? `${name}의 승점 획득과 경쟁 팀의 승점 손실을 합친 보수적 수치입니다.` : `A conservative combined total of ${name}'s points gained and rivals' points dropped.`}</p></section>`;
  }

  function renderMagicNumberStats() {
    const tbody = document.getElementById('magicNumberStatsBody');
    if (!tbody) return;
    const ranked = getRankedTeams('all');
    const context = getMagicNumberContext(ranked);
    if (!context) { tbody.innerHTML = ''; return; }
    tbody.innerHTML = ranked.map((team, index) => {
      const numbers = getTeamMagicNumbers(team, ranked, context);
      return `<tr><td>${index + 1}</td><td class="magic-number-stats-team"><img class="team-logo team-logo-sm" src="${team.logoSrc}" alt="">${isKorean ? team.nameKo : team.nameEn}</td><td>${numbers.remainingGames}</td><td class="magic-number-title-value">${magicNumberText(numbers.title)}</td><td class="magic-number-safety-value">${magicNumberText(numbers.safety)}</td></tr>`;
    }).join('');
    attachImageFallback();
    refreshScrollFadeHints();
  }

  // ===== 팀 순위 렌더링 (League Table) =====
  function renderLeagueTable() {
    const processedData = getRankedTeams();

    // 순위 변동 표시는 '전체' 순위표 기준으로만 의미가 있으므로(홈/원정 분할표는
    // 전주 순위와 직접 비교할 대상이 없음) 필터가 'all'일 때만 계산합니다.
    const showRankChange = currentRankFilter === 'all';
    const rankChangeData = showRankChange ? getRankChangeDisplayData() : null;
    const previousRanks = rankChangeData ? rankChangeData.previousRanks : null;
    const playedTeams = rankChangeData ? rankChangeData.playedTeams : null;

    const tbody = document.getElementById('leagueTableBody');
    tbody.innerHTML = '';

    processedData.forEach((team, index) => {
      const rank = index + 1;
      let trClass = '';
      
      if (rank === 1) trClass += 'rank-1 promo ';
      else if (rank === 2) trClass += 'rank-2 ';
      else if (rank === 3) trClass += 'rank-3 ';
      else if (rank >= processedData.length - 2) trClass += 'releg ';
      
      if (team.nameEn === 'Chizumulu United FC' || team.nameKo === '치주물루 유나이티드 FC') {
        trClass += 'my-team ';
      }

      const tr = document.createElement('tr');
      if(trClass.trim() !== '') tr.className = trClass.trim();

      const name = isKorean ? team.nameKo : team.nameEn;
      
      let formHtml = '';
      team.form.slice(-5).forEach(f => {
        let fClass = f === 'W' ? 'form-w' : (f === 'D' ? 'form-d' : 'form-l');
        formHtml += `<span class="form-badge ${fClass}">${f}</span>`;
      });

      let nextMatchHtml = '';
      if (team.nextMatch.isBye) {
        const byeText = isKorean ? '휴식' : 'BYE';
        nextMatchHtml = `<span class="bye-text lbl" data-en="BYE" data-ko="휴식">${byeText}</span>`;
      } else {
        const haClass = team.nextMatch.homeAway === 'H' ? 'ha-home' : 'ha-away';
        const oppName = isKorean ? team.nextMatch.oppKo : team.nextMatch.oppEn;
        const isHome = team.nextMatch.homeAway === 'H';
        const compareHomeEn = isHome ? team.nameEn : team.nextMatch.oppEn;
        const compareHomeKo = isHome ? team.nameKo : team.nextMatch.oppKo;
        const compareAwayEn = isHome ? team.nextMatch.oppEn : team.nameEn;
        const compareAwayKo = isHome ? team.nextMatch.oppKo : team.nameKo;
        const compareArgs = `'${compareHomeEn.replace(/'/g, "\\'")}', '${compareHomeKo.replace(/'/g, "\\'")}', '${compareAwayEn.replace(/'/g, "\\'")}', '${compareAwayKo.replace(/'/g, "\\'")}'`;
        nextMatchHtml = `
          <span class="next-opp-inner next-opp-clickable" onclick="event.stopPropagation(); openMatchCompareModal(${compareArgs})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();openMatchCompareModal(${compareArgs})}" title="${isKorean ? '전적 비교 보기' : 'View head-to-head'}">
            <span class="ha-badge ${haClass}">${team.nextMatch.homeAway}</span>
            <img class="team-logo team-logo-sm opp-logo" data-en-name="${team.nextMatch.oppEn}" data-ko-name="${team.nextMatch.oppKo}" title="${oppName}" src="${team.nextMatch.oppLogo}" alt="${team.nextMatch.oppEn}">
          </span>
        `;
      }

      const gdClass = team.gd > 0 ? 'gd-pos' : (team.gd < 0 ? 'gd-neg' : 'gd-zero');

      // 순위 변동 셀: 이번 라운드에 이미 경기를 치른 팀만 전주 대비 변동을 보여주고,
      // 아직 이번 라운드 경기 결과가 없는 팀은 빈 칸으로 둡니다(결과가 들어오면 표시됨).
      let rankChangeHtml = '';
      if (showRankChange && playedTeams && playedTeams.has(team.nameEn)) {
        const prevRank = previousRanks ? previousRanks[team.nameEn] : undefined;
        if (typeof prevRank === 'number') {
          const diff = prevRank - rank; // 양수면 순위 상승(숫자가 작아짐)
          if (diff > 0) {
            rankChangeHtml = `<span class="rank-change rank-change-up"><span class="rank-change-arrow">▲</span>${diff}</span>`;
          } else if (diff < 0) {
            rankChangeHtml = `<span class="rank-change rank-change-down"><span class="rank-change-arrow">▼</span>${Math.abs(diff)}</span>`;
          } else {
            rankChangeHtml = `<span class="rank-change rank-change-same">-</span>`;
          }
        }
      }

      tr.innerHTML = `
        <td class="rank-cell">${rank}</td>
        <td class="rank-change-cell">${rankChangeHtml}</td>
        <td class="team team-clickable" onclick="goToTeamInfo('${team.nameEn.replace(/'/g, "\\'")}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToTeamInfo('${team.nameEn.replace(/'/g, "\\'")}')}">
          <img class="team-logo" src="${team.logoSrc}" data-en-name="${team.nameEn}" alt="${team.nameEn}">
          <span class="lbl" data-en="${team.nameEn}" data-ko="${team.nameKo}">${name}</span>
        </td>
        <td>${team.played}</td>
        <td>${team.won}</td>
        <td>${team.drawn}</td>
        <td>${team.lost}</td>
        <td>${team.goalsFor}</td>
        <td>${team.goalsAgainst}</td>
        <td class="${gdClass}">${team.gd}</td>
        <td class="pts">${team.pts}</td>
        <td class="form-cell">${formHtml}</td>
        <td class="next-opp-cell">${nextMatchHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    attachImageFallback();
    refreshScrollFadeHints();
  }

  // ===== 순위표 이미지로 내보내기 (Export Standings as PNG) =====
  function loadImageForExport(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function drawExportBadge(ctx, img, name, x, y, size, fallbackColor) {
    const r = 6;
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, size, size, r); else ctx.rect(x, y, size, size);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      ctx.fillStyle = fallbackColor;
      ctx.fillRect(x, y, size, size);
      const initials = name.replace(/\s+FC$/i, '').replace(/\s+Academy$/i, '').trim()
        .split(' ').map(w => w[0]).filter(Boolean).join('').substring(0, 2).toUpperCase();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 ' + Math.round(size * 0.42) + 'px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials, x + size / 2, y + size / 2 + 1);
    }
    ctx.restore();
  }

  async function exportStandingsImage() {
    const btn = document.getElementById('exportImgBtn');
    const btnLabel = btn ? btn.querySelector('.lbl') : null;
    const originalLabel = btnLabel ? btnLabel.textContent : '';
    if (btn) btn.disabled = true;
    if (btnLabel) btnLabel.textContent = isKorean ? '생성 중...' : 'Generating...';

    try {
      const teams = getRankedTeams();
      const cs = getComputedStyle(document.documentElement);
      const cvar = (name, fallback) => {
        const v = cs.getPropertyValue(name).trim();
        return v || fallback;
      };
      const dark = isDarkTheme();

      const colors = {
        surface: cvar('--color-surface', dark ? '#1e2230' : '#ffffff'),
        stripe: cvar('--color-bg-stripe', dark ? '#262b3c' : '#f7f9fc'),
        textDark: cvar('--color-text-darkest', dark ? '#f4f5fa' : '#1b2333'),
        textMuted: cvar('--color-text-muted', dark ? '#9aa2ba' : '#6b7385'),
        navy: cvar('--color-navy', '#033990'),
        navyLight: cvar('--color-navy-light', '#0450c4'),
        teal: cvar('--color-teal', '#079696'),
        tealDark: cvar('--color-teal-dark', dark ? '#4fd6d0' : '#05716f'),
        gold: cvar('--color-gold-strong', '#d9a441'),
        green: cvar('--color-green', '#2e7d32'),
        red: cvar('--color-red', '#c0392b'),
        border: cvar('--color-border-light', dark ? '#323850' : '#edeff5'),
        myTeamBg1: cvar('--color-bg-myteam-1', dark ? '#16302f' : '#eaf6f6'),
        myTeamBg2: cvar('--color-bg-myteam-2', dark ? '#1a3634' : '#f2fbfb'),
        rankBg: cvar('--color-bg-rank-highlight', dark ? '#2c2818' : '#fff9ec')
      };

      // 팀 로고 미리 로드 (실패한 로고는 이니셜 배지로 대체하여 캔버스 오염 방지)
      const logos = await Promise.all(teams.map(t => loadImageForExport(t.logoSrc)));

      const scale = 2; // 레티나 해상도 대응
      const width = 1000;
      const headerH = 118;
      const colHeadH = 40;
      const rowH = 52;
      const footerH = 54;
      const height = headerH + colHeadH + rowH * teams.length + footerH;

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);

      // 배경
      ctx.fillStyle = colors.surface;
      ctx.fillRect(0, 0, width, height);

      // 헤더 (네이비 그라데이션 배너)
      const headGrad = ctx.createLinearGradient(0, 0, width, headerH);
      headGrad.addColorStop(0, colors.navy);
      headGrad.addColorStop(1, colors.navyLight);
      ctx.fillStyle = headGrad;
      ctx.fillRect(0, 0, width, headerH);

      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '800 15px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.fillText(isKorean ? '치웨미 인베스트먼트' : 'CHIWEMI INVESTMENT', 24, 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 27px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.fillText(isKorean ? 'NRFA 리그 원' : 'NRFA LEAGUE ONE', 24, 67);

      const weekText = (document.getElementById('weekLabel') || {}).textContent || '';
      const dateText = (document.getElementById('dateLabel') || {}).textContent || '';
      const filterLabel = currentRankFilter === 'home' ? (isKorean ? '홈 경기' : 'HOME')
        : currentRankFilter === 'away' ? (isKorean ? '원정 경기' : 'AWAY')
        : '';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 13px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.fillText([weekText, dateText, filterLabel].filter(Boolean).join('  ·  '), 24, 92);

      ctx.textAlign = 'right';
      ctx.font = '700 13px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(isKorean ? '26/27 시즌' : '26/27 Season', width - 24, 34);

      // 컬럼 좌표
      const cols = { rank: 24, team: 64, p: 580, w: 625, d: 665, l: 705, gd: 750, pts: 815, form: 865 };

      // 컬럼 헤더
      let y = headerH;
      ctx.fillStyle = colors.stripe;
      ctx.fillRect(0, y, width, colHeadH);
      ctx.fillStyle = colors.textMuted;
      ctx.font = '700 11px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.textBaseline = 'middle';
      const headY = y + colHeadH / 2;
      ctx.textAlign = 'left';
      ctx.fillText(isKorean ? '순위' : 'RANK', cols.rank, headY);
      ctx.fillText(isKorean ? '팀' : 'TEAMS', cols.team, headY);
      ctx.textAlign = 'center';
      ctx.fillText(isKorean ? '경기' : 'P', cols.p, headY);
      ctx.fillText(isKorean ? '승' : 'W', cols.w, headY);
      ctx.fillText(isKorean ? '무' : 'D', cols.d, headY);
      ctx.fillText(isKorean ? '패' : 'L', cols.l, headY);
      ctx.fillText(isKorean ? '득실' : 'GD', cols.gd, headY);
      ctx.fillText(isKorean ? '승점' : 'PTS', cols.pts, headY);
      ctx.textAlign = 'left';
      ctx.fillText(isKorean ? '최근 5경기' : 'FORM', cols.form, headY);

      y += colHeadH;

      // 데이터 행
      teams.forEach((team, idx) => {
        const rank = idx + 1;
        const rowY = y + idx * rowH;
        const isMine = team.nameEn === 'Chizumulu United FC' || team.nameKo === '치주물루 유나이티드 FC';
        const isTop3 = rank <= 3;
        const isReleg = rank >= teams.length - 2;

        if (isMine) {
          const g = ctx.createLinearGradient(0, 0, width, 0);
          g.addColorStop(0, colors.myTeamBg1);
          g.addColorStop(1, colors.myTeamBg2);
          ctx.fillStyle = g;
        } else if (isTop3) {
          const g = ctx.createLinearGradient(0, 0, width, 0);
          g.addColorStop(0, colors.rankBg);
          g.addColorStop(0.6, colors.surface);
          ctx.fillStyle = g;
        } else {
          ctx.fillStyle = idx % 2 === 1 ? colors.stripe : colors.surface;
        }
        ctx.fillRect(0, rowY, width, rowH);

        // 좌측 강조 바 (승격/강등/내 팀)
        if (isMine) {
          ctx.fillStyle = colors.teal;
          ctx.fillRect(0, rowY, 4, rowH);
        } else if (rank === 1) {
          ctx.fillStyle = colors.green;
          ctx.fillRect(0, rowY, 4, rowH);
        } else if (isReleg) {
          ctx.fillStyle = colors.red;
          ctx.fillRect(0, rowY, 4, rowH);
        }

        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rowY + rowH);
        ctx.lineTo(width, rowY + rowH);
        ctx.stroke();

        const midY = rowY + rowH / 2;

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = '800 15px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
        ctx.fillStyle = rank === 1 ? colors.gold : (rank <= 3 ? colors.textDark : colors.textMuted);
        ctx.fillText(String(rank), cols.rank, midY);

        const logoSize = 28;
        const teamName = isKorean ? team.nameKo : team.nameEn;
        drawExportBadge(ctx, logos[idx], teamName, cols.team, midY - logoSize / 2, logoSize, colors.navy);
        ctx.font = (isMine ? '800 ' : '700 ') + '14px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
        ctx.fillStyle = isMine ? colors.tealDark : colors.textDark;
        ctx.fillText(teamName, cols.team + logoSize + 10, midY);

        ctx.textAlign = 'center';
        ctx.font = '600 13px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
        ctx.fillStyle = colors.textDark;
        ctx.fillText(String(team.played), cols.p, midY);
        ctx.fillText(String(team.won), cols.w, midY);
        ctx.fillText(String(team.drawn), cols.d, midY);
        ctx.fillText(String(team.lost), cols.l, midY);

        ctx.font = '700 13px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
        ctx.fillStyle = team.gd > 0 ? colors.green : (team.gd < 0 ? colors.red : colors.textMuted);
        ctx.fillText((team.gd > 0 ? '+' : '') + team.gd, cols.gd, midY);

        ctx.font = '800 15px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
        ctx.fillStyle = colors.navy;
        ctx.fillText(String(team.pts), cols.pts, midY);

        ctx.textAlign = 'left';
        const formSize = 16;
        (team.form || []).slice(-5).forEach((f, i) => {
          const fx = cols.form + i * (formSize + 4);
          ctx.fillStyle = f === 'W' ? colors.green : (f === 'D' ? colors.textMuted : colors.red);
          ctx.beginPath();
          ctx.arc(fx + formSize / 2, midY, formSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 9px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(f, fx + formSize / 2, midY + 1);
          ctx.textAlign = 'left';
        });
      });

      // 푸터 (범례 + 워터마크)
      const footerY = y + rowH * teams.length;
      ctx.fillStyle = colors.stripe;
      ctx.fillRect(0, footerY, width, footerH);

      ctx.font = '600 11px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.textBaseline = 'middle';
      const legendY = footerY + 20;
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.green;
      ctx.beginPath(); ctx.arc(24, legendY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors.textMuted;
      ctx.fillText(isKorean ? '승격' : 'Promotion', 34, legendY);

      ctx.fillStyle = colors.red;
      ctx.beginPath(); ctx.arc(112, legendY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = colors.textMuted;
      ctx.fillText(isKorean ? '강등' : 'Relegation', 122, legendY);

      ctx.textAlign = 'right';
      ctx.fillStyle = colors.textMuted;
      ctx.fillText(isKorean ? '치주물루 유나이티드 팬 에디션' : 'Chizumulu United Fan Edition', width - 24, legendY + 20);

      canvas.toBlob((blob) => {
        if (!blob) {
          if (btn) btn.disabled = false;
          if (btnLabel) btnLabel.textContent = originalLabel;
          alert(isKorean ? '이미지 생성에 실패했습니다. 다시 시도해주세요.' : 'Failed to generate image. Please try again.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeWeek = weekText.replace(/[^\w가-힣]+/g, '') || 'standings';
        a.href = url;
        a.download = `NRFA_${safeWeek}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        if (btn) btn.disabled = false;
        if (btnLabel) btnLabel.textContent = originalLabel;
      }, 'image/png');
    } catch (err) {
      console.error('순위표 이미지 생성 실패:', err);
      if (btn) btn.disabled = false;
      if (btnLabel) btnLabel.textContent = originalLabel;
      alert(isKorean ? '이미지 생성에 실패했습니다. 다시 시도해주세요.' : 'Failed to generate image. Please try again.');
    }
  }

  // 완전 동률일 때 치주물루 유나이티드(팀 또는 소속 선수)를 동률 그룹의
  // 맨 위로 올려주는 공용 타이브레이커 함수들
  function teamMineFirst(a, b) {
    const aMine = a.nameEn === 'Chizumulu United FC';
    const bMine = b.nameEn === 'Chizumulu United FC';
    if (aMine && !bMine) return -1;
    if (bMine && !aMine) return 1;
    return 0;
  }

  function playerMineFirst(a, b) {
    const aMine = a.teamEn === 'Chizumulu United FC';
    const bMine = b.teamEn === 'Chizumulu United FC';
    if (aMine && !bMine) return -1;
    if (bMine && !aMine) return 1;
    return 0;
  }


  // ===== 연속 기록 (Streaks) =====
  // roundsData(완료된 라운드) + scheduledRounds 안에서 스코어가 이미 채워진 경기(=라운드가
  // 통째로 끝나지 않았어도 개별 경기가 먼저 끝난 경우)까지 모두 시간순으로 훑어서
  // 팀별 경기 결과 로그(승/무/패, 득점, 실점)를 만듭니다.
  function buildTeamMatchLog() {
    const log = {};
    leagueData.forEach(t => { log[t.nameEn] = []; });

    const roundKeys = Object.keys(roundsData).sort((a, b) => {
      const na = parseInt(a.replace('round', ''), 10);
      const nb = parseInt(b.replace('round', ''), 10);
      return na - nb;
    });

    function addMatch(m) {
      if (m.byeKo || m.byeEn) return;
      if (!m.homeEn || !m.awayEn) return;
      if (typeof m.homeScore !== 'number' || typeof m.awayScore !== 'number') return;

      if (log[m.homeEn]) {
        log[m.homeEn].push({
          result: m.homeScore > m.awayScore ? 'W' : (m.homeScore < m.awayScore ? 'L' : 'D'),
          gf: m.homeScore,
          ga: m.awayScore
        });
      }
      if (log[m.awayEn]) {
        log[m.awayEn].push({
          result: m.awayScore > m.homeScore ? 'W' : (m.awayScore < m.homeScore ? 'L' : 'D'),
          gf: m.awayScore,
          ga: m.homeScore
        });
      }
    }

    roundKeys.forEach(roundKey => {
      roundsData[roundKey].forEach(addMatch);
    });

    // 아직 통째로 roundsData에 옮겨지지 않은(=진행 중인) 라운드라도,
    // 그 안에 스코어가 채워진 경기는 완료된 경기이므로 함께 반영합니다.
    if (typeof scheduledRounds !== 'undefined' && scheduledRounds) {
      const scheduledKeys = Object.keys(scheduledRounds).sort((a, b) => {
        const na = parseInt(a.replace('round', ''), 10);
        const nb = parseInt(b.replace('round', ''), 10);
        return na - nb;
      });
      scheduledKeys.forEach(roundKey => {
        if (roundsData[roundKey]) return; // 이미 roundsData로 옮겨진 라운드는 중복 처리하지 않음
        scheduledRounds[roundKey].forEach(addMatch);
      });
    }

    return log;
  }

  // 경기 로그의 맨 뒤(가장 최근 경기)부터 조건을 만족하는 동안 카운트를 늘려
  // "현재까지 이어지고 있는" 연속 기록을 구합니다.
  function trailingStreak(matches, predicate) {
    let count = 0;
    for (let i = matches.length - 1; i >= 0; i--) {
      if (predicate(matches[i])) count += 1;
      else break;
    }
    return count;
  }

  // ===== 팀 기록 통계 (Team Records / Stats) =====
  function collectTeamStats() {
    const matchLog = buildTeamMatchLog();

    // 리그 평균 경기당 득점 (공격/수비 지수의 기준선 = 100%)
    let totalGoals = 0, totalGames = 0;
    leagueData.forEach(t => { totalGoals += (t.goalsFor || 0); totalGames += (t.played || 0); });
    const leagueAvgGpg = totalGames > 0 ? totalGoals / totalGames : 0;

    return leagueData.map(team => {
      const pts = (team.won * 3) + (team.drawn * 1);
      const denom = Math.pow(team.goalsFor, 1.072388) + Math.pow(team.goalsAgainst, 1.127248);
      const pythagPoints = (team.played > 0 && denom > 0)
        ? (Math.pow(team.goalsFor, 1.122777) / denom) * 2.499973 * team.played
        : 0;

      const matches = matchLog[team.nameEn] || [];
      const winStreak = trailingStreak(matches, m => m.result === 'W');
      const lossStreak = trailingStreak(matches, m => m.result === 'L');
      const drawStreak = trailingStreak(matches, m => m.result === 'D');
      const unbeatenStreak = trailingStreak(matches, m => m.result !== 'L');
      const scoringStreak = trailingStreak(matches, m => m.gf > 0);
      const concedingStreak = trailingStreak(matches, m => m.ga > 0);

      // 공격/수비 지수: 리그 평균 경기당 득점을 100%로 놓고, 이 팀의 득점력/수비력이
      // 평균 대비 몇 %인지를 나타냅니다. 두 지표 모두 "높을수록 강함"으로 방향을 통일했습니다.
      const gfPerGame = team.played > 0 ? team.goalsFor / team.played : 0;
      const gaPerGame = team.played > 0 ? team.goalsAgainst / team.played : 0;
      const attackIndex = (team.played > 0 && leagueAvgGpg > 0) ? (gfPerGame / leagueAvgGpg) * 100 : 0;
      const defensePerfect = team.played > 0 && team.goalsAgainst === 0;
      const defenseIndex = defensePerfect
        ? 999 // 무실점 팀은 항상 최상위로 정렬되도록 큰 값을 부여 (표시할 때는 "무실점" 배지로 대체)
        : ((team.played > 0 && leagueAvgGpg > 0) ? (leagueAvgGpg / gaPerGame) * 100 : 0);

      return {
        nameKo: team.nameKo,
        nameEn: team.nameEn,
        logoSrc: team.logoSrc,
        played: team.played,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalsForPerGame: team.played > 0 ? team.goalsFor / team.played : 0,
        goalsAgainstPerGame: team.played > 0 ? team.goalsAgainst / team.played : 0,
        matchHistory: matches,
        cleanSheets: team.cleanSheets,
        failedToScore: team.failedToScore,
        pts: pts,
        ppg: team.played > 0 ? pts / team.played : 0,
        pythagPoints: pythagPoints,
        pythagDiff: pts - pythagPoints,
        attackIndex: attackIndex,
        defenseIndex: defenseIndex,
        defensePerfect: defensePerfect,
        winStreak: winStreak,
        lossStreak: lossStreak,
        drawStreak: drawStreak,
        unbeatenStreak: unbeatenStreak,
        scoringStreak: scoringStreak,
        concedingStreak: concedingStreak
      };
    });
  }

  function renderStatsTable(tbodyId, teams, statType) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';

    let displayRank = 1;
    let prevValue = null;

    teams.forEach(function(team, idx) {
      let currentValue;
      if (statType === 'goalsFor') currentValue = team.goalsForPerGame;
      else if (statType === 'goalsAgainst') currentValue = team.goalsAgainstPerGame;
      else if (statType === 'cs') currentValue = team.cleanSheets;
      else if (statType === 'fts') currentValue = team.failedToScore;
      else if (statType === 'ppg') currentValue = team.ppg;
      else if (statType === 'pythag') currentValue = team.pythagPoints;
      else if (statType === 'attackIdx') currentValue = team.attackIndex;
      else if (statType === 'defenseIdx') currentValue = team.defenseIndex;
      else if (statType === 'streakWin') currentValue = team.winStreak;
      else if (statType === 'streakLoss') currentValue = team.lossStreak;
      else if (statType === 'streakDraw') currentValue = team.drawStreak;
      else if (statType === 'streakUnbeaten') currentValue = team.unbeatenStreak;
      else if (statType === 'streakScoring') currentValue = team.scoringStreak;
      else if (statType === 'streakConceding') currentValue = team.concedingStreak;

      if (idx > 0) {
          if (currentValue !== prevValue) {
              displayRank = idx + 1;
          }
      }
      prevValue = currentValue;

      const tr = document.createElement('tr');
      
      if (team.nameEn === 'Chizumulu United FC' || team.nameKo === '치주물루 유나이티드 FC') {
        tr.classList.add('my-team');
      }

      const name = isKorean ? team.nameKo : team.nameEn;
      const rankTd = document.createElement('td');
      rankTd.className = 'rank-cell';
      rankTd.textContent = displayRank;
      const teamTd = document.createElement('td');
      teamTd.className = 'team';
      if (team.logoSrc) {
        const img = document.createElement('img');
        img.className = 'team-logo';
        img.src = team.logoSrc;
        img.alt = name;
        teamTd.appendChild(img);
      }
      teamTd.appendChild(document.createTextNode(name));
      tr.appendChild(rankTd);
      tr.appendChild(teamTd);

      if (statType === 'goalsFor') {
        const valTd1 = document.createElement('td');
        valTd1.className = 'stat-val';
        valTd1.textContent = team.goalsFor;
        tr.appendChild(valTd1);
        const valTd2 = document.createElement('td');
        valTd2.className = 'stat-val';
        valTd2.style.color = 'var(--color-text-faint)';
        valTd2.textContent = team.goalsForPerGame.toFixed(2);
        tr.appendChild(valTd2);
      } else if (statType === 'goalsAgainst') {
        const valTd1 = document.createElement('td');
        valTd1.className = 'stat-val';
        valTd1.textContent = team.goalsAgainst;
        tr.appendChild(valTd1);
        const valTd2 = document.createElement('td');
        valTd2.className = 'stat-val';
        valTd2.style.color = 'var(--color-text-faint)';
        valTd2.textContent = team.goalsAgainstPerGame.toFixed(2);
        tr.appendChild(valTd2);
      } else if (statType === 'cs') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.cleanSheets;
        tr.appendChild(valTd);
      } else if (statType === 'fts') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.failedToScore;
        tr.appendChild(valTd);
      } else if (statType === 'ppg') {
        const valTd1 = document.createElement('td');
        valTd1.className = 'stat-val';
        valTd1.textContent = team.pts;
        tr.appendChild(valTd1);
        const valTd2 = document.createElement('td');
        valTd2.className = 'stat-val';
        valTd2.style.color = 'var(--color-text-faint)';
        valTd2.textContent = team.ppg.toFixed(2);
        tr.appendChild(valTd2);
      } else if (statType === 'pythag') {
        const valTd1 = document.createElement('td');
        valTd1.className = 'stat-val';
        valTd1.textContent = team.pythagPoints.toFixed(1);
        tr.appendChild(valTd1);
        const valTd2 = document.createElement('td');
        valTd2.className = 'stat-val';
        const diff = team.pythagDiff;
        valTd2.style.color = diff > 0.05 ? 'var(--color-teal)' : (diff < -0.05 ? 'var(--color-red)' : 'var(--color-text-faint)');
        valTd2.textContent = (diff > 0 ? '+' : '') + diff.toFixed(1);
        tr.appendChild(valTd2);
      } else if (statType === 'attackIdx') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = `${Math.round(team.attackIndex)}%`;
        valTd.style.color = team.attackIndex > 105 ? 'var(--color-teal)' : (team.attackIndex < 95 ? 'var(--color-red)' : 'var(--color-text-faint)');
        tr.appendChild(valTd);
      } else if (statType === 'defenseIdx') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        if (team.defensePerfect) {
          valTd.textContent = isKorean ? '무실점' : 'Perfect';
          valTd.style.color = 'var(--color-teal)';
        } else {
          valTd.textContent = `${Math.round(team.defenseIndex)}%`;
          valTd.style.color = team.defenseIndex > 105 ? 'var(--color-teal)' : (team.defenseIndex < 95 ? 'var(--color-red)' : 'var(--color-text-faint)');
        }
        tr.appendChild(valTd);
      } else if (statType === 'streakWin') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.winStreak;
        tr.appendChild(valTd);
      } else if (statType === 'streakLoss') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.lossStreak;
        tr.appendChild(valTd);
      } else if (statType === 'streakDraw') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.drawStreak;
        tr.appendChild(valTd);
      } else if (statType === 'streakUnbeaten') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.unbeatenStreak;
        tr.appendChild(valTd);
      } else if (statType === 'streakScoring') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.scoringStreak;
        tr.appendChild(valTd);
      } else if (statType === 'streakConceding') {
        const valTd = document.createElement('td');
        valTd.className = 'stat-val';
        valTd.textContent = team.concedingStreak;
        tr.appendChild(valTd);
      }

      tbody.appendChild(tr);
    });
  }

  function buildStatsTables() {
    const teams = collectTeamStats();
    statsData.goalsFor = teams.slice().sort(function(a, b) { return (b.goalsForPerGame - a.goalsForPerGame) || teamMineFirst(a, b); });
    statsData.goalsAgainst = teams.slice().sort(function(a, b) { return (a.goalsAgainstPerGame - b.goalsAgainstPerGame) || teamMineFirst(a, b); });
    statsData.cs = teams.slice().sort(function(a, b) { return (b.cleanSheets - a.cleanSheets) || teamMineFirst(a, b); });
    statsData.fts = teams.slice().sort(function(a, b) { return (b.failedToScore - a.failedToScore) || teamMineFirst(a, b); });
    statsData.ppg = teams.slice().sort(function(a, b) { return (b.ppg - a.ppg) || teamMineFirst(a, b); });
    statsData.pythag = teams.slice().sort(function(a, b) { return (b.pythagPoints - a.pythagPoints) || teamMineFirst(a, b); });
    statsData.attackIdx = teams.slice().sort(function(a, b) { return (b.attackIndex - a.attackIndex) || teamMineFirst(a, b); });
    statsData.defenseIdx = teams.slice().sort(function(a, b) { return (b.defenseIndex - a.defenseIndex) || teamMineFirst(a, b); });
    statsData.streakWin = teams.slice().sort(function(a, b) { return (b.winStreak - a.winStreak) || teamMineFirst(a, b); });
    statsData.streakLoss = teams.slice().sort(function(a, b) { return (b.lossStreak - a.lossStreak) || teamMineFirst(a, b); });
    statsData.streakDraw = teams.slice().sort(function(a, b) { return (b.drawStreak - a.drawStreak) || teamMineFirst(a, b); });
    statsData.streakUnbeaten = teams.slice().sort(function(a, b) { return (b.unbeatenStreak - a.unbeatenStreak) || teamMineFirst(a, b); });
    statsData.streakScoring = teams.slice().sort(function(a, b) { return (b.scoringStreak - a.scoringStreak) || teamMineFirst(a, b); });
    statsData.streakConceding = teams.slice().sort(function(a, b) { return (b.concedingStreak - a.concedingStreak) || teamMineFirst(a, b); });

    renderStatsTable('scoreBody', statsData.goalsFor.slice(0, 5), 'goalsFor');
    renderStatsTable('concedeBody', statsData.goalsAgainst.slice(0, 5), 'goalsAgainst');
    renderStatsTable('csBody', statsData.cs.slice(0, 5), 'cs');
    renderStatsTable('ftsBody', statsData.fts.slice(0, 5), 'fts');
    renderStatsTable('ppgBody', statsData.ppg.slice(0, 5), 'ppg');
    renderStatsTable('pythagBody', statsData.pythag.slice(0, 5), 'pythag');
    renderStatsTable('attackIdxBody', statsData.attackIdx.slice(0, 5), 'attackIdx');
    renderStatsTable('defenseIdxBody', statsData.defenseIdx.slice(0, 5), 'defenseIdx');
    renderStatsTable('streakWinBody', statsData.streakWin.slice(0, 5), 'streakWin');
    renderStatsTable('streakLossBody', statsData.streakLoss.slice(0, 5), 'streakLoss');
    renderStatsTable('streakDrawBody', statsData.streakDraw.slice(0, 5), 'streakDraw');
    renderStatsTable('streakUnbeatenBody', statsData.streakUnbeaten.slice(0, 5), 'streakUnbeaten');
    renderStatsTable('streakScoringBody', statsData.streakScoring.slice(0, 5), 'streakScoring');
    renderStatsTable('streakConcedingBody', statsData.streakConceding.slice(0, 5), 'streakConceding');
    renderMagicNumberStats();

    renderScatterPlot(teams);
  }


  // ===== SVG 차트 - 공통 헬퍼 (Chart Helpers) =====
  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }


  // ===== SVG 차트 - 공격/수비 산점도 (Scatter Plot) =====
  // 각 팀의 "이전 라운드까지의" 누적 경기당 득점/실점을 라운드 순서대로 계산합니다.
  // (마지막 한 경기는 현재 위치이므로 제외하고, 너무 난잡해지지 않도록 직전 3경기까지만 궤적으로 씁니다)
  const TRAIL_MAX_STEPS = 3;

  // 팀마다 구분되는 궤적 색상 팔레트 (leagueData 순서 기준으로 고정 배정)
  const TEAM_TRAIL_COLORS = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
    '#17b8c7', '#f032e6', '#9acd32', '#fa8072', '#469990',
    '#b19cd9', '#c2872b', '#4a4ae8', '#8a8a8a'
  ];
  function teamTrailColor(idx) { return TEAM_TRAIL_COLORS[idx % TEAM_TRAIL_COLORS.length]; }

  // 팀 로고를 클릭하면 해당 팀의 궤적만 강조 표시 (다시 클릭하면 해제)
  let scatterTeamsCache = null;
  let scatterHighlightIdx = null;
  function toggleScatterHighlight(idx) {
    scatterHighlightIdx = (scatterHighlightIdx === idx) ? null : idx;
    if (scatterTeamsCache) renderScatterPlot(scatterTeamsCache);
  }
  function computeTeamTrailStats(team) {
    const log = team.matchHistory || [];
    if (log.length < 2) return [];
    const trail = [];
    let cumGF = 0, cumGA = 0;
    for (let i = 0; i < log.length - 1; i++) {
      cumGF += log[i].gf;
      cumGA += log[i].ga;
      const played = i + 1;
      trail.push({ gf: cumGF / played, ga: cumGA / played });
    }
    return trail.slice(-TRAIL_MAX_STEPS);
  }

  function renderScatterPlot(teams) {
    const svg = document.getElementById('scatterSvg');
    if (!svg) return;
    scatterTeamsCache = teams;
    svg.innerHTML = '';

    const W = 700, H = 520;
    const margin = { top: 26, right: 26, bottom: 56, left: 56 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    const maxGF = Math.max.apply(null, teams.map(t => t.goalsForPerGame).concat([0.5]));
    const maxGA = Math.max.apply(null, teams.map(t => t.goalsAgainstPerGame).concat([0.5]));
    const domainY = Math.ceil(maxGF * 1.2 * 5) / 5;
    const domainX = Math.ceil(maxGA * 1.2 * 5) / 5;

    const avgGF = teams.reduce((s, t) => s + t.goalsForPerGame, 0) / teams.length;
    const avgGA = teams.reduce((s, t) => s + t.goalsAgainstPerGame, 0) / teams.length;

    function xPos(v) { return margin.left + (v / domainX) * plotW; }
    function yPos(v) { return margin.top + plotH - (v / domainY) * plotH; }

    const avgX = xPos(avgGA);
    const avgY = yPos(avgGF);

    const ct = chartTheme();

    // quadrant background rects
    const quads = [
      { x: margin.left, y: margin.top, w: avgX - margin.left, h: avgY - margin.top, fill: ct.quadStrong, labelColor: ct.quadStrongLabel,
        ko: '강팀', en: 'STRONG', lx: margin.left + (avgX - margin.left) / 2, ly: margin.top + 18 },
      { x: avgX, y: margin.top, w: margin.left + plotW - avgX, h: avgY - margin.top, fill: ct.quadAttack, labelColor: ct.quadAttackLabel,
        ko: '공격형', en: 'ATTACKING', lx: avgX + (margin.left + plotW - avgX) / 2, ly: margin.top + 18 },
      { x: margin.left, y: avgY, w: avgX - margin.left, h: margin.top + plotH - avgY, fill: ct.quadDefense, labelColor: ct.quadDefenseLabel,
        ko: '수비형', en: 'DEFENSIVE', lx: margin.left + (avgX - margin.left) / 2, ly: margin.top + plotH - 10 },
      { x: avgX, y: avgY, w: margin.left + plotW - avgX, h: margin.top + plotH - avgY, fill: ct.quadWeak, labelColor: ct.quadWeakLabel,
        ko: '약팀', en: 'WEAK', lx: avgX + (margin.left + plotW - avgX) / 2, ly: margin.top + plotH - 10 }
    ];

    quads.forEach(q => {
      if (q.w <= 0 || q.h <= 0) return;
      svg.appendChild(svgEl('rect', { x: q.x, y: q.y, width: q.w, height: q.h, fill: q.fill }));
    });

    // plot border
    svg.appendChild(svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, fill: 'none', stroke: ct.plotBorder, 'stroke-width': 1.5 }));

    // average guide lines
    svg.appendChild(svgEl('line', { x1: avgX, y1: margin.top, x2: avgX, y2: margin.top + plotH, stroke: ct.guideLine, 'stroke-width': 1.4, 'stroke-dasharray': '5,4' }));
    svg.appendChild(svgEl('line', { x1: margin.left, y1: avgY, x2: margin.left + plotW, y2: avgY, stroke: ct.guideLine, 'stroke-width': 1.4, 'stroke-dasharray': '5,4' }));

    // quadrant labels
    quads.forEach(q => {
      if (q.w <= 0 || q.h <= 0) return;
      const t = svgEl('text', { x: q.lx, y: q.ly, 'text-anchor': 'middle', class: 'scatter-quad-label' });
      t.setAttribute('fill', q.labelColor);
      t.textContent = isKorean ? q.ko : q.en;
      svg.appendChild(t);
    });

    // axis ticks
    const stepsX = 5, stepsY = 5;
    for (let i = 0; i <= stepsX; i++) {
      const v = (domainX / stepsX) * i;
      const x = xPos(v);
      svg.appendChild(svgEl('line', { x1: x, y1: margin.top + plotH, x2: x, y2: margin.top + plotH + 5, stroke: ct.tickLine, 'stroke-width': 1 }));
      const t = svgEl('text', { x: x, y: margin.top + plotH + 18, 'text-anchor': 'middle', class: 'scatter-tick-label' });
      t.textContent = v.toFixed(1);
      svg.appendChild(t);
    }
    for (let i = 0; i <= stepsY; i++) {
      const v = (domainY / stepsY) * i;
      const y = yPos(v);
      svg.appendChild(svgEl('line', { x1: margin.left - 5, y1: y, x2: margin.left, y2: y, stroke: ct.tickLine, 'stroke-width': 1 }));
      const t = svgEl('text', { x: margin.left - 9, y: y + 3, 'text-anchor': 'end', class: 'scatter-tick-label' });
      t.textContent = v.toFixed(1);
      svg.appendChild(t);
    }

    // axis titles
    const xTitle = svgEl('text', { x: margin.left + plotW / 2, y: H - 10, 'text-anchor': 'middle', class: 'scatter-axis-label' });
    xTitle.textContent = isKorean ? '경기당 실점 →' : 'Goals Against / Game →';
    svg.appendChild(xTitle);

    const yTitle = svgEl('text', { x: 14, y: margin.top + plotH / 2, 'text-anchor': 'middle', class: 'scatter-axis-label', transform: `rotate(-90 14 ${margin.top + plotH / 2})` });
    yTitle.textContent = isKorean ? '경기당 득점 →' : 'Goals For / Game →';
    svg.appendChild(yTitle);

    // data points
    const points = teams.map((team, idx) => {
      const isMine = team.nameEn === 'Chizumulu United FC' || team.nameKo === '치주물루 유나이티드 FC';
      let ringColor;
      if (team.goalsAgainstPerGame <= avgGA && team.goalsForPerGame > avgGF) ringColor = '#c99a2e';
      else if (team.goalsAgainstPerGame > avgGA && team.goalsForPerGame > avgGF) ringColor = '#079696';
      else if (team.goalsAgainstPerGame <= avgGA && team.goalsForPerGame <= avgGF) ringColor = '#033990';
      else ringColor = '#c0392b';

      const shortName = (isKorean ? team.nameKo : team.nameEn).split(' ')[0];
      const labelText = isMine ? '⭐ ' + shortName : shortName;
      const charW = isKorean ? 10.5 : 6.3;
      const labelW = labelText.length * charW + 4;

      return {
        team, idx, isMine, ringColor, labelText, labelW, labelH: 12,
        trailColor: teamTrailColor(idx),
        r: isMine ? 12 : 10,
        cx: xPos(team.goalsAgainstPerGame),
        cy: yPos(team.goalsForPerGame)
      };
    });

    // separate dots that sit too close together (near-duplicate stats)
    for (let iter = 0; iter < 120; iter++) {
      let moved = false;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j];
          let dx = b.cx - a.cx, dy = b.cy - a.cy;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r + 4;
          if (dist < minDist) {
            moved = true;
            if (dist < 0.01) { dx = 0.6; dy = 0.6; dist = Math.sqrt(dx * dx + dy * dy); }
            const push = (minDist - dist) / 2 + 0.3;
            const ux = dx / dist, uy = dy / dist;
            a.cx -= ux * push; a.cy -= uy * push;
            b.cx += ux * push; b.cy += uy * push;
          }
        }
      }
      if (!moved) break;
    }

    points.forEach(p => {
      p.lx = p.cx + p.r + 5;
      p.ly = p.cy + 3.5;
    });

    // simple iterative label declutter (push apart overlapping label boxes)
    for (let iter = 0; iter < 80; iter++) {
      let moved = false;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i], b = points[j];
          const ax1 = a.lx - 2, ax2 = a.lx + a.labelW, ay1 = a.ly - 9, ay2 = a.ly + 3;
          const bx1 = b.lx - 2, bx2 = b.lx + b.labelW, by1 = b.ly - 9, by2 = b.ly + 3;
          const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
          const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
          if (overlapX > 0 && overlapY > 0) {
            moved = true;
            const push = Math.min(overlapY, 6) / 2 + 0.4;
            if (a.ly <= b.ly) { a.ly -= push; b.ly += push; }
            else { a.ly += push; b.ly -= push; }
          }
        }
      }
      if (!moved) break;
    }

    const defs = svgEl('defs', {});
    svg.appendChild(defs);

    // 태풍 경로처럼: 이전 라운드까지의 위치를 흐린 점 + 옅은 선으로 먼저 그려서
    // 실제 팀 로고/현재 위치 마커보다 아래(뒤)에 깔리도록 합니다.
    const trailGroup = svgEl('g', { class: 'scatter-trail-group' });
    svg.appendChild(trailGroup);
    // 강조된 팀이 있으면 그 팀의 궤적을 맨 마지막에 그려서 다른 궤적 위로 올라오게 합니다.
    const trailOrder = scatterHighlightIdx === null
      ? points
      : points.slice().sort((a, b) => (a.idx === scatterHighlightIdx ? 1 : 0) - (b.idx === scatterHighlightIdx ? 1 : 0));
    trailOrder.forEach(p => {
      const trailStats = computeTeamTrailStats(p.team);
      if (!trailStats.length) return;
      const isSelected = scatterHighlightIdx === p.idx;
      const isDimmed = scatterHighlightIdx !== null && !isSelected;
      const lineW = isSelected ? 3 : 1.5;
      const dotR = isSelected ? 4.2 : 3.2;
      const opacityMul = isDimmed ? 0.22 : 1;
      const opacityBoost = isSelected ? 0.28 : 0;

      const trailPts = trailStats.map(pt => ({ cx: xPos(pt.ga), cy: yPos(pt.gf) }));
      trailPts.push({ cx: p.cx, cy: p.cy }); // 현재 위치로 이어붙여서 궤적을 완성
      const n = trailPts.length;

      for (let i = 0; i < n - 1; i++) {
        const t = (i + 1) / n; // 0(과거)~1(현재 직전)
        trailGroup.appendChild(svgEl('line', {
          x1: trailPts[i].cx.toFixed(1), y1: trailPts[i].cy.toFixed(1),
          x2: trailPts[i + 1].cx.toFixed(1), y2: trailPts[i + 1].cy.toFixed(1),
          stroke: p.trailColor, 'stroke-width': lineW, 'stroke-linecap': 'round',
          opacity: (Math.min(1, 0.1 + t * 0.32 + opacityBoost) * opacityMul).toFixed(2)
        }));
      }
      trailPts.slice(0, -1).forEach((pt, i) => {
        const t = (i + 1) / n;
        trailGroup.appendChild(svgEl('circle', {
          cx: pt.cx.toFixed(1), cy: pt.cy.toFixed(1), r: dotR,
          fill: p.trailColor, opacity: (Math.min(1, 0.16 + t * 0.34 + opacityBoost) * opacityMul).toFixed(2)
        }));
      });
    });

    // 강조된 팀의 마커를 맨 나중에 그려서 다른 마커 위로 올라오게 합니다.
    const markerOrder = scatterHighlightIdx === null
      ? points
      : points.slice().sort((a, b) => (a.idx === scatterHighlightIdx ? 1 : 0) - (b.idx === scatterHighlightIdx ? 1 : 0));

    markerOrder.forEach(p => {
      const isSelected = scatterHighlightIdx === p.idx;
      const isDimmed = scatterHighlightIdx !== null && !isSelected;

      const g = svgEl('g', { class: 'scatter-marker-group', opacity: isDimmed ? '0.35' : '1' });
      g.style.cursor = 'pointer';
      const clipId = 'scatterClip-' + p.idx;

      const clipPath = svgEl('clipPath', { id: clipId });
      clipPath.appendChild(svgEl('circle', { cx: p.cx, cy: p.cy, r: p.r - 1.5 }));
      defs.appendChild(clipPath);

      // selected 팀 강조용 헤일로
      if (isSelected) {
        g.appendChild(svgEl('circle', {
          cx: p.cx, cy: p.cy, r: p.r + 4.5, fill: 'none',
          stroke: p.trailColor, 'stroke-width': 2.5, opacity: '0.55'
        }));
      }

      // white backdrop behind logo (covers transparent-background logos)
      g.appendChild(svgEl('circle', { cx: p.cx, cy: p.cy, r: p.r - 1.5, fill: '#fff' }));

      const img = svgEl('image', {
        x: p.cx - p.r + 1.5, y: p.cy - p.r + 1.5, width: (p.r - 1.5) * 2, height: (p.r - 1.5) * 2,
        'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice'
      });
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', p.team.logoSrc);
      img.setAttribute('href', p.team.logoSrc);

      img.addEventListener('error', function handleErr() {
        img.removeEventListener('error', handleErr);
        const cleanName = (p.team.nameEn || 'Team').replace(/\s+FC$/i, '').replace(/\s+Academy$/i, '').trim();
        const initials = cleanName.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
        const fallback = `https://placehold.co/40x40/033990/FFFFFF?text=${initials}`;
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', fallback);
        img.setAttribute('href', fallback);
      });

      const ring = svgEl('circle', {
        cx: p.cx, cy: p.cy, r: p.r - 1, fill: 'none',
        stroke: isSelected ? p.trailColor : p.ringColor, 'stroke-width': isSelected ? 3.5 : (p.isMine ? 3 : 2)
      });

      const title = svgEl('title', {});
      const name = isKorean ? p.team.nameKo : p.team.nameEn;
      title.textContent = `${name} — ${isKorean ? '경기당 득점' : 'GF/g'}: ${p.team.goalsForPerGame.toFixed(2)}, ${isKorean ? '경기당 실점' : 'GA/g'}: ${p.team.goalsAgainstPerGame.toFixed(2)}` +
        (isKorean ? ' (클릭해서 궤적 강조)' : ' (click to highlight trail)');

      g.appendChild(img);
      g.appendChild(ring);
      g.appendChild(title);
      g.addEventListener('click', () => toggleScatterHighlight(p.idx));
      svg.appendChild(g);

      if (Math.abs(p.ly - (p.cy + 3.5)) > 4 || Math.abs(p.lx - (p.cx + p.r + 5)) > 4) {
        svg.appendChild(svgEl('line', {
          x1: p.cx + p.r, y1: p.cy, x2: p.lx - 2, y2: p.ly - 3,
          stroke: ct.guideLine, 'stroke-width': 0.8
        }));
      }

      const label = svgEl('text', {
        x: p.lx, y: p.ly,
        class: p.isMine ? 'scatter-dot-label-mine' : 'scatter-dot-label',
        opacity: isDimmed ? '0.4' : '1'
      });
      label.textContent = p.labelText;
      svg.appendChild(label);
    });
  }

  // ===== 구단 위치 (Club Venues Map — Leaflet / OpenStreetMap) =====
  let venueLeafletMap = null;
  let venueMarkersByIdx = {};
  let venueLeafletMapLarge = null;
  let venueMarkersByIdxLarge = {};

  // 두 좌표 간 직선거리 (Haversine, km 단위)
  function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function getHomeVenue() {
    const mineTeam = leagueData.find(t => t.nameEn === 'Chizumulu United FC');
    return (mineTeam && mineTeam.venue) ? mineTeam.venue : null;
  }

  function formatDistanceLabel(team, homeVenue, isMine) {
    if (isMine) return isKorean ? '홈' : 'Home';
    if (!homeVenue || !team.venue) return '';
    const km = haversineDistanceKm(homeVenue.lat, homeVenue.lng, team.venue.lat, team.venue.lng);
    return `${Math.round(km).toLocaleString()}km`;
  }

  function renderVenuesView() {
    renderVenueLeafletMap();
    renderVenuesList();
  }

  // 마커 구성 로직을 map 인스턴스별로 공유합니다 (기본 지도 / 확대보기 모달 지도 공용)
  function populateVenueMap(mapInstance, markerStore) {
    const teams = leagueData.filter(t => t.venue && typeof t.venue.lat === 'number' && typeof t.venue.lng === 'number');
    if (teams.length === 0) return;

    const homeVenue = getHomeVenue();

    // 기존 마커 정리 후 다시 그리기 (언어 전환 시 팝업 텍스트 갱신 목적)
    Object.values(markerStore).forEach(m => mapInstance.removeLayer(m));
    Object.keys(markerStore).forEach(k => delete markerStore[k]);

    const bounds = [];
    teams.forEach(team => {
      const idx = leagueData.indexOf(team);
      const isMine = team.nameEn === 'Chizumulu United FC';
      const teamName = isKorean ? team.nameKo : team.nameEn;
      const venueName = isKorean ? team.venue.nameKo : team.venue.nameEn;
      const distLabel = formatDistanceLabel(team, homeVenue, isMine);
      const shortTeamName = isKorean ? team.nameKo.split(' ')[0] : team.nameEn.split(' ')[0];

      const icon = L.divIcon({
        className: 'venue-leaflet-icon' + (isMine ? ' venue-leaflet-icon-mine' : ''),
        html: `<div class="venue-pin-wrap">` +
          `<div class="venue-pin"><img src="${team.logoSrc}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('venue-pin-noimg')"></div>` +
          `<div class="venue-pin-name${isMine ? ' venue-pin-name-mine' : ''}">${shortTeamName}</div>` +
          `</div>`,
        iconSize: [64, 54],
        iconAnchor: [32, 17],
        popupAnchor: [0, -20]
      });

      const marker = L.marker([team.venue.lat, team.venue.lng], { icon }).addTo(mapInstance);
      const distPopupLine = (!isMine && homeVenue)
        ? `<br><span class="venue-popup-distance">${isKorean ? '치주물루로부터 ' : 'From Chizumulu: '}${distLabel}</span>`
        : '';
      marker.bindPopup(
        `<div class="venue-popup"><strong>${teamName}</strong><br>${venueName}<br>` +
        `<span class="venue-popup-coords">${team.venue.lat.toFixed(5)}, ${team.venue.lng.toFixed(5)}</span>${distPopupLine}</div>`
      );
      marker.on('click', () => highlightVenueMarker(idx, 'map', markerStore, mapInstance));
      markerStore[idx] = marker;
      bounds.push([team.venue.lat, team.venue.lng]);
    });

    if (bounds.length > 0) {
      mapInstance.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
    }
  }

  function renderVenueLeafletMap() {
    const mapEl = document.getElementById('venueLeafletMap');
    if (!mapEl || typeof L === 'undefined') return;

    if (!venueLeafletMap) {
      venueLeafletMap = L.map('venueLeafletMap', { scrollWheelZoom: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      }).addTo(venueLeafletMap);
    }

    populateVenueMap(venueLeafletMap, venueMarkersByIdx);

    // 탭이 숨겨진 상태에서 초기화됐을 수 있으므로, 보여진 뒤 크기를 다시 계산
    setTimeout(() => { if (venueLeafletMap) venueLeafletMap.invalidateSize(); }, 60);
  }

  // ===== 구단 위치 지도 크게 보기 모달 =====
  function renderVenueLeafletMapLarge() {
    const mapEl = document.getElementById('venueLeafletMapLarge');
    if (!mapEl || typeof L === 'undefined') return;

    if (!venueLeafletMapLarge) {
      venueLeafletMapLarge = L.map('venueLeafletMapLarge', { scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      }).addTo(venueLeafletMapLarge);
    }

    populateVenueMap(venueLeafletMapLarge, venueMarkersByIdxLarge);
  }

  function openVenueMapModal() {
    const modal = document.getElementById('venueMapModal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderVenueLeafletMapLarge();
    setTimeout(() => { if (venueLeafletMapLarge) venueLeafletMapLarge.invalidateSize(); }, 80);
  }

  function closeVenueMapModal() {
    const modal = document.getElementById('venueMapModal');
    if (modal) modal.style.display = 'none';
  }

  function highlightVenueMarker(idx, source, markerStore, mapInstance) {
    markerStore = markerStore || venueMarkersByIdx;
    mapInstance = mapInstance || venueLeafletMap;
    document.querySelectorAll('.venue-list-item.active').forEach(el => el.classList.remove('active'));
    const listRow = document.querySelector('.venue-list-item[data-venue-idx="' + idx + '"]');
    if (listRow) {
      listRow.classList.add('active');
      if (source === 'map') listRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const marker = markerStore[idx];
    if (marker && mapInstance) {
      mapInstance.flyTo(marker.getLatLng(), Math.max(mapInstance.getZoom(), 11), { duration: 0.6 });
      if (source === 'list') marker.openPopup();
    }
  }

  function renderVenuesList() {
    const wrap = document.getElementById('venuesList');
    if (!wrap) return;
    wrap.innerHTML = '';

    const homeVenue = getHomeVenue();
    const teams = leagueData.filter(t => t.venue).slice().sort((a, b) => {
      const an = isKorean ? a.nameKo : a.nameEn;
      const bn = isKorean ? b.nameKo : b.nameEn;
      return an.localeCompare(bn);
    });

    teams.forEach(team => {
      const idx = leagueData.indexOf(team);
      const row = document.createElement('div');
      row.className = 'venue-list-item';
      row.setAttribute('data-venue-idx', idx);
      const teamName = isKorean ? team.nameKo : team.nameEn;
      const venueName = isKorean ? team.venue.nameKo : team.venue.nameEn;
      const isMine = team.nameEn === 'Chizumulu United FC';
      const distLabel = formatDistanceLabel(team, homeVenue, isMine);
      row.innerHTML = `
        <img class="team-logo venue-list-logo" src="${team.logoSrc}" data-en-name="${team.nameEn}" alt="${team.nameEn}">
        <div class="venue-list-text">
          <span class="venue-list-team lbl" data-en="${team.nameEn}" data-ko="${team.nameKo}">${teamName}</span>
          <span class="venue-list-ground lbl" data-en="${team.venue.nameEn}" data-ko="${team.venue.nameKo}">${venueName}</span>
        </div>
        <div class="venue-list-meta">
          <span class="venue-list-coords">${team.venue.lat.toFixed(4)}, ${team.venue.lng.toFixed(4)}</span>
          ${distLabel ? `<span class="venue-list-distance${isMine ? ' venue-list-distance-mine' : ''}">${distLabel}</span>` : ''}
        </div>
      `;
      row.addEventListener('click', () => highlightVenueMarker(idx, 'list'));
      wrap.appendChild(row);
    });

    attachImageFallback();
  }

  const RANK_HIST_COLORS = [
    '#e63946', '#f4a261', '#e9c46a', '#8ab17d', '#2a9d8f',
    '#3fc4c4', '#118ab2', '#5b5fc7', '#9b5de5', '#f15bb5',
    '#ef476f', '#ff7f51', '#8d6a4f', '#6c7a89', '#495867'
  ];

  function straightPath(coords) {
    if (coords.length === 0) return '';
    return coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
  }

  let rankHistHighlighted = null;
  let pointsHistHighlighted = null;


  // ===== SVG 차트 - 주차별 순위 변동 (Rank History Chart) =====
  // renderRankHistoryChart()가 하던 일을 역할별로 나눈 헬퍼 함수들입니다:
  //   computeRankHistDimensions  - 차트 크기/좌표 변환 함수 계산
  //   drawRankHistBackdrop       - 배경 카드 + 짝수 순위 줄무늬
  //   drawRankHistGridlines      - 가로(순위)/세로(주차) 격자선 + 라벨 + 테두리
  //   drawRankHistAxisTitles     - X/Y축 제목
  //   addRankHistGlowFilter      - 강조 시 사용하는 그림자(glow) 필터 정의
  //   buildRankHistTeamLines     - 팀별 좌표/색상 데이터 계산 (DOM 없음)
  //   drawRankHistTeamLine       - 팀 한 명 분의 선/점/로고/약어를 그림
  //   applyRankHistHighlight     - 특정 팀 강조 표시 on/off
  //   buildRankHistLegend        - 하단 팀 칩(legend) 생성 + 클릭 핸들러

  function computeRankHistDimensions(history) {
    const teamCount = leagueData.length;
    const weekCount = history.length;
    const W = 820, H = 40 + teamCount * 34;
    const margin = { top: 26, right: 118, bottom: 42, left: 42 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;
    const logoColX = margin.left + plotW + 26;

    function xPos(week) {
      return weekCount > 1
        ? margin.left + ((week - 1) / (weekCount - 1)) * plotW
        : margin.left + plotW / 2;
    }
    function yPos(rank) {
      return margin.top + ((rank - 1) / (teamCount - 1)) * plotH;
    }

    return { teamCount, weekCount, W, H, margin, plotW, plotH, logoColX, xPos, yPos };
  }

  function drawRankHistBackdrop(svg, dims) {
    const { margin, plotW, plotH, teamCount, yPos } = dims;
    const ct = chartTheme();

    // 둥근 배경 카드
    svg.appendChild(svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, rx: 10, fill: ct.backdropCard }));

    // 홀수 순위 줄에 옅은 배경 (가독성용 줄무늬)
    const rowH = teamCount > 1 ? plotH / (teamCount - 1) : plotH;
    for (let r = 1; r <= teamCount; r++) {
      if (r % 2 === 0) continue;
      const yTop = yPos(r) - rowH / 2;
      svg.appendChild(svgEl('rect', {
        x: margin.left, y: Math.max(margin.top, yTop), width: plotW,
        height: Math.min(rowH, margin.top + plotH - Math.max(margin.top, yTop)),
        fill: ct.backdropStripe
      }));
    }
  }

  function drawRankHistGridlines(svg, dims) {
    const { margin, plotW, plotH, teamCount, weekCount, xPos, yPos } = dims;
    const ct = chartTheme();

    // 가로 순위 격자선 + 좌측 순위 숫자
    for (let r = 1; r <= teamCount; r++) {
      const y = yPos(r);
      svg.appendChild(svgEl('line', { x1: margin.left, y1: y, x2: margin.left + plotW, y2: y, stroke: ct.gridLine, 'stroke-width': 1 }));
      const t = svgEl('text', { x: margin.left - 10, y: y + 4, 'text-anchor': 'end', class: 'rank-hist-week-label' });
      t.textContent = r;
      svg.appendChild(t);
    }

    // 세로 주차 격자선 + 하단 주차 라벨
    for (let w = 1; w <= weekCount; w++) {
      const x = xPos(w);
      svg.appendChild(svgEl('line', { x1: x, y1: margin.top, x2: x, y2: margin.top + plotH, stroke: ct.gridLine, 'stroke-width': 1, 'stroke-dasharray': '3,4' }));
      const t = svgEl('text', { x: x, y: margin.top + plotH + 20, 'text-anchor': 'middle', class: 'rank-hist-week-label' });
      t.textContent = isKorean ? `${w}주` : `W${w}`;
      svg.appendChild(t);
    }

    // 플롯 테두리
    svg.appendChild(svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, rx: 10, fill: 'none', stroke: ct.gridBorder, 'stroke-width': 1.5 }));
  }

  function drawRankHistAxisTitles(svg, dims) {
    const { margin, plotW, plotH, H } = dims;

    const yTitle = svgEl('text', { x: 12, y: margin.top + plotH / 2, 'text-anchor': 'middle', class: 'rank-hist-axis-label', transform: `rotate(-90 12 ${margin.top + plotH / 2})` });
    yTitle.textContent = isKorean ? '순위 →' : 'Rank →';
    svg.appendChild(yTitle);

    const xTitle = svgEl('text', { x: margin.left + plotW / 2, y: H - 6, 'text-anchor': 'middle', class: 'rank-hist-axis-label' });
    xTitle.textContent = isKorean ? '주차 →' : 'Week →';
    svg.appendChild(xTitle);
  }

  function addRankHistGlowFilter(defs) {
    const glow = svgEl('filter', { id: 'rankHistGlow', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    glow.innerHTML = '<feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#000" flood-opacity="0.28"/>';
    defs.appendChild(glow);
  }

  // 팀별 색상 + 주차별 (x, y) 좌표를 계산합니다. DOM을 건드리지 않는 순수 데이터 계산 단계입니다.
  function buildRankHistTeamLines(history, dims) {
    const { xPos, yPos } = dims;
    let colorCursor = 0;
    return leagueData.map((team) => {
      const isMine = team.nameEn === 'Chizumulu United FC';
      const color = isMine ? '#0454e0' : RANK_HIST_COLORS[colorCursor++ % RANK_HIST_COLORS.length];
      const coords = history.map(h => ({
        week: h.week,
        rank: h.ranks[team.nameEn],
        x: xPos(h.week),
        y: yPos(h.ranks[team.nameEn])
      }));
      return { team, color, isMine, coords };
    });
  }

  // 팀 한 명 분의 연결선, 순위선, 주차별 점, 로고, 구단 약어를 그립니다.
  function drawRankHistTeamLine(lineGroup, defs, tl, tlIdx, logoColX) {
    const lastCoord = tl.coords[tl.coords.length - 1];

    // 마지막 점에서 로고 칼럼까지 이어지는 얇은 연결선
    const connector = svgEl('line', {
      x1: lastCoord.x, y1: lastCoord.y, x2: logoColX, y2: lastCoord.y,
      stroke: tl.color, 'stroke-width': tl.isMine ? 2.4 : 1.6, 'stroke-dasharray': '2,3', opacity: 0.75
    });
    connector.classList.add('rank-hist-line');
    connector.dataset.teamKey = tl.team.nameEn;
    lineGroup.appendChild(connector);
    tl.connectorEl = connector;

    // 주차별 순위를 잇는 선
    const pathD = straightPath(tl.coords);
    const path = svgEl('path', { d: pathD, stroke: tl.color, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    path.classList.add('rank-hist-line');
    if (tl.isMine) path.classList.add('highlighted');
    path.dataset.teamKey = tl.team.nameEn;
    lineGroup.appendChild(path);
    tl.pathEl = path;

    // 주차별 점(dot)
    tl.dotEls = tl.coords.map((c) => {
      const dot = svgEl('circle', { cx: c.x, cy: c.y, r: tl.isMine ? 5 : 3.6, fill: tl.color, stroke: '#fff', 'stroke-width': 1.6 });
      dot.classList.add('rank-hist-dot');
      dot.dataset.teamKey = tl.team.nameEn;
      const title = svgEl('title', {});
      const name = isKorean ? tl.team.nameKo : tl.team.nameEn;
      const weekLabel = isKorean ? `${c.week}주차` : `Week ${c.week}`;
      const rankLabel = isKorean ? `${c.rank}위` : `Rank ${c.rank}`;
      title.textContent = `${name} — ${weekLabel}: ${rankLabel}`;
      dot.appendChild(title);
      lineGroup.appendChild(dot);
      return dot;
    });

    // 로고 칼럼: 마지막 순위 자리에 구단 로고 배치
    const r = tl.isMine ? 14 : 12;
    const g = svgEl('g', {});
    g.dataset.teamKey = tl.team.nameEn;
    g.classList.add('rank-hist-dot');

    const clipId = 'rankHistClip-' + tlIdx;
    const clipPath = svgEl('clipPath', { id: clipId });
    clipPath.appendChild(svgEl('circle', { cx: logoColX, cy: lastCoord.y, r: r - 2 }));
    defs.appendChild(clipPath);

    g.appendChild(svgEl('circle', { cx: logoColX, cy: lastCoord.y, r: r - 2, fill: '#fff' }));

    const img = svgEl('image', {
      x: logoColX - r + 2, y: lastCoord.y - r + 2, width: (r - 2) * 2, height: (r - 2) * 2,
      'clip-path': `url(#${clipId})`, preserveAspectRatio: 'xMidYMid slice'
    });
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', tl.team.logoSrc);
    img.setAttribute('href', tl.team.logoSrc);
    img.addEventListener('error', function handleErr() {
      img.removeEventListener('error', handleErr);
      const cleanName = (tl.team.nameEn || 'Team').replace(/\s+FC$/i, '').replace(/\s+Academy$/i, '').trim();
      const initials = cleanName.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
      const fallback = `https://placehold.co/40x40/033990/FFFFFF?text=${initials}`;
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', fallback);
      img.setAttribute('href', fallback);
    });

    const ring = svgEl('circle', { cx: logoColX, cy: lastCoord.y, r: r - 1, fill: 'none', stroke: tl.color, 'stroke-width': tl.isMine ? 3 : 2 });

    const title = svgEl('title', {});
    const name = isKorean ? tl.team.nameKo : tl.team.nameEn;
    title.textContent = `${name} — ${isKorean ? '현재' : 'Current'}: ${lastCoord.rank}${isKorean ? '위' : ''}`;

    g.appendChild(img);
    g.appendChild(ring);
    g.appendChild(title);
    lineGroup.appendChild(g);
    tl.logoEl = g;

    // 로고 오른쪽에 구단 약어 표시
    const shortName = (isKorean ? tl.team.nameKo : tl.team.nameEn).split(' ')[0];
    const abbrText = svgEl('text', {
      x: logoColX + r + 5, y: lastCoord.y + 4,
      class: tl.isMine ? 'rank-hist-abbr-mine rank-hist-dot' : 'rank-hist-abbr rank-hist-dot'
    });
    abbrText.dataset.teamKey = tl.team.nameEn;
    abbrText.textContent = shortName;
    abbrText.style.fill = tl.color;
    lineGroup.appendChild(abbrText);
    tl.abbrEl = abbrText;
  }

  // teamKey가 있으면 해당 팀 선/점/로고/칩만 강조하고 나머지는 흐리게, null이면 전체 강조 해제
  function applyRankHistHighlight(teamLines, teamKey) {
    teamLines.forEach(tl => {
      const active = !teamKey || tl.team.nameEn === teamKey;
      tl.pathEl.classList.toggle('dimmed', !active);
      tl.pathEl.classList.toggle('highlighted', !!teamKey && active);
      tl.connectorEl.classList.toggle('dimmed', !active);
      tl.pathEl.style.filter = (teamKey && active) ? 'url(#rankHistGlow)' : '';
      tl.dotEls.forEach(d => d.classList.toggle('dimmed', !active));
      tl.logoEl.classList.toggle('dimmed', !active);
      tl.abbrEl.classList.toggle('dimmed', !active);
    });
    document.querySelectorAll('.rank-hist-chip').forEach(chip => {
      const active = !teamKey || chip.dataset.teamKey === teamKey;
      chip.classList.toggle('dimmed', !active);
    });
  }

  // legend chips: 클릭하면 해당 팀 선만 강조, 다시 클릭하면 해제
  function buildRankHistLegend(legendEl, teamLines) {
    teamLines.forEach(tl => {
      const chip = document.createElement('div');
      chip.className = 'rank-hist-chip';
      chip.dataset.teamKey = tl.team.nameEn;
      const dot = document.createElement('span');
      dot.className = 'chip-dot';
      dot.style.background = tl.color;
      const label = document.createElement('span');
      label.textContent = (isKorean ? tl.team.nameKo : tl.team.nameEn).replace(/\s*FC$/i, '');
      chip.appendChild(dot);
      chip.appendChild(label);
      chip.addEventListener('click', () => {
        rankHistHighlighted = rankHistHighlighted === tl.team.nameEn ? null : tl.team.nameEn;
        applyRankHistHighlight(teamLines, rankHistHighlighted);
      });
      legendEl.appendChild(chip);
    });
  }

  function renderRankHistoryChart() {
    const svg = document.getElementById('rankHistorySvg');
    const legendEl = document.getElementById('rankHistLegend');
    if (!svg || !legendEl) return;
    svg.innerHTML = '';
    legendEl.innerHTML = '';

    const history = computeStandingsHistory();
    if (!history.length) return;

    const dims = computeRankHistDimensions(history);
    svg.setAttribute('viewBox', `0 0 ${dims.W} ${dims.H}`);

    drawRankHistBackdrop(svg, dims);
    drawRankHistGridlines(svg, dims);
    drawRankHistAxisTitles(svg, dims);

    const defs = svgEl('defs', {});
    svg.appendChild(defs);
    addRankHistGlowFilter(defs);

    const teamLines = buildRankHistTeamLines(history, dims);

    const lineGroup = svgEl('g', {});
    svg.appendChild(lineGroup);
    teamLines.forEach((tl, tlIdx) => drawRankHistTeamLine(lineGroup, defs, tl, tlIdx, dims.logoColX));

    buildRankHistLegend(legendEl, teamLines);
    applyRankHistHighlight(teamLines, rankHistHighlighted);
  }

  // ===== SVG 차트 - 라운드별 누적 승점 추이 =====
  // computeStandingsHistory()의 동일 스냅샷(points)을 사용하므로, 경기 결과가
  // 갱신되면 순위 변동 그래프와 함께 자동으로 최신 상태로 다시 그려집니다.
  function pointsHistoryColor(team, colorIndex) {
    return team.nameEn === 'Chizumulu United FC' ? '#0454e0' : RANK_HIST_COLORS[colorIndex % RANK_HIST_COLORS.length];
  }

  function renderPointsHistorySvg(svg, teams, legendEl) {
    if (!svg) return;
    svg.innerHTML = '';
    if (legendEl) legendEl.innerHTML = '';
    const history = computeStandingsHistory();
    if (!history.length || !teams.length) return;

    const compact = teams.length === 1;
    const W = compact ? 700 : 820;
    const H = compact ? 300 : 410;
    const margin = { top: 24, right: 22, bottom: 42, left: 46 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;
    const rawMax = Math.max.apply(null, teams.flatMap(team => history.map(h => (h.points && h.points[team.nameEn]) || 0)));
    const maxPts = Math.max(3, Math.ceil(rawMax / 3) * 3);
    const xPos = index => history.length > 1 ? margin.left + (index / (history.length - 1)) * plotW : margin.left + plotW / 2;
    const yPos = points => margin.top + plotH - (points / maxPts) * plotH;
    const ct = chartTheme();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.appendChild(svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, rx: 10, fill: ct.backdropCard }));

    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxPts / 5) * i);
      const y = yPos(value);
      svg.appendChild(svgEl('line', { x1: margin.left, y1: y, x2: margin.left + plotW, y2: y, stroke: ct.gridLine, 'stroke-width': 1 }));
      const label = svgEl('text', { x: margin.left - 9, y: y + 4, 'text-anchor': 'end', class: 'rank-hist-week-label' });
      label.textContent = value;
      svg.appendChild(label);
    }
    history.forEach((h, index) => {
      const x = xPos(index);
      svg.appendChild(svgEl('line', { x1: x, y1: margin.top, x2: x, y2: margin.top + plotH, stroke: ct.gridLine, 'stroke-width': 1, 'stroke-dasharray': '3,4' }));
      const label = svgEl('text', { x, y: margin.top + plotH + 20, 'text-anchor': 'middle', class: 'rank-hist-week-label' });
      label.textContent = isKorean ? `${h.week}주` : `W${h.week}`;
      svg.appendChild(label);
    });
    svg.appendChild(svgEl('rect', { x: margin.left, y: margin.top, width: plotW, height: plotH, rx: 10, fill: 'none', stroke: ct.gridBorder, 'stroke-width': 1.5 }));
    const yTitle = svgEl('text', { x: 13, y: margin.top + plotH / 2, 'text-anchor': 'middle', class: 'rank-hist-axis-label', transform: `rotate(-90 13 ${margin.top + plotH / 2})` });
    yTitle.textContent = isKorean ? '누적 승점 →' : 'Points →';
    svg.appendChild(yTitle);

    let colorIndex = 0;
    const lines = teams.map(team => {
      const color = pointsHistoryColor(team, colorIndex++);
      const coords = history.map((h, index) => ({ week: h.week, points: (h.points && h.points[team.nameEn]) || 0, x: xPos(index) }));
      coords.forEach(c => { c.y = yPos(c.points); });
      return { team, color, coords };
    });
    lines.forEach(line => {
      const path = svgEl('path', { d: straightPath(line.coords), stroke: line.color, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', class: 'points-hist-line' });
      path.dataset.teamKey = line.team.nameEn;
      svg.appendChild(path);
      line.dots = line.coords.map(c => {
        const dot = svgEl('circle', { cx: c.x, cy: c.y, r: compact ? 4.5 : 3.5, fill: line.color, stroke: '#fff', 'stroke-width': 1.4, class: 'points-hist-dot' });
        dot.dataset.teamKey = line.team.nameEn;
        const title = svgEl('title', {});
        title.textContent = `${isKorean ? line.team.nameKo : line.team.nameEn} — ${isKorean ? `${c.week}주차` : `Week ${c.week}`}: ${c.points}${isKorean ? '점' : ' pts'}`;
        dot.appendChild(title);
        svg.appendChild(dot);
        return dot;
      });
      line.path = path;
    });
    const applyHighlight = teamKey => {
      lines.forEach(line => {
        const active = !teamKey || line.team.nameEn === teamKey;
        line.path.classList.toggle('dimmed', !active);
        line.path.classList.toggle('highlighted', !!teamKey && active);
        line.dots.forEach(dot => dot.classList.toggle('dimmed', !active));
      });
      if (legendEl) legendEl.querySelectorAll('.points-hist-chip').forEach(chip => chip.classList.toggle('dimmed', !!teamKey && chip.dataset.teamKey !== teamKey));
    };
    if (legendEl) {
      lines.forEach(line => {
        const chip = document.createElement('div');
        chip.className = 'rank-hist-chip points-hist-chip';
        chip.dataset.teamKey = line.team.nameEn;
        chip.innerHTML = `<span class="chip-dot" style="background:${line.color}"></span><span>${(isKorean ? line.team.nameKo : line.team.nameEn).replace(/\s*FC$/i, '')}</span>`;
        chip.addEventListener('click', () => {
          pointsHistHighlighted = pointsHistHighlighted === line.team.nameEn ? null : line.team.nameEn;
          applyHighlight(pointsHistHighlighted);
        });
        legendEl.appendChild(chip);
      });
      applyHighlight(pointsHistHighlighted);
    }
  }

  function renderPointsHistoryChart() {
    renderPointsHistorySvg(document.getElementById('pointsHistorySvg'), leagueData, document.getElementById('pointsHistLegend'));
  }

  function renderTeamPointsHistoryChart(svgId, team) {
    renderPointsHistorySvg(document.getElementById(svgId), team ? [team] : [], null);
  }


  // ===== 통계 상세 모달 (Stat Detail Modal) =====

  // 모달 종류별 설정. 새 통계 항목을 추가하려면 이 객체에 항목만 추가하면 됩니다.
  // (statsData의 key와 동일한 이름을 사용)
  const MODAL_CONFIG = {
    goalsFor: {
      titleKo: "경기당 득점 (전체)", titleEn: "GOALS PER GAME (Full List)",
      header1Ko: "총 득점", header1En: "TOTAL",
      header2Ko: "경기당", header2En: "PER GAME",
    },
    goalsAgainst: {
      titleKo: "경기당 실점 (전체)", titleEn: "GOALS CONCEDED PER GAME (Full List)",
      header1Ko: "총 실점", header1En: "TOTAL",
      header2Ko: "경기당", header2En: "PER GAME",
    },
    cs: {
      titleKo: "무실점 경기수 (전체)", titleEn: "CLEAN SHEETS (Full List)",
      header1Ko: "무실점", header1En: "CLEAN SHEETS",
      // header2 없음 (단일 컬럼 통계)
    },
    fts: {
      titleKo: "무득점 경기수 (전체)", titleEn: "FAILED TO SCORE (Full List)",
      header1Ko: "무득점", header1En: "FAILED TO SCORE",
    },
    ppg: {
      titleKo: "경기당 승점 (전체)", titleEn: "POINTS PER GAME (Full List)",
      header1Ko: "승점", header1En: "PTS",
      header2Ko: "경기당", header2En: "PPG",
    },
    pythag: {
      titleKo: "피타고리안 승점 (전체)", titleEn: "PYTHAGOREAN POINTS (Full List)",
      header1Ko: "기대 승점", header1En: "EXPECTED",
      header2Ko: "실제 대비", header2En: "+/-",
    },
    attackIdx: {
      titleKo: "공격 지수 (전체)", titleEn: "ATTACK INDEX (Full List)",
      header1Ko: "공격 지수", header1En: "ATTACK INDEX",
    },
    defenseIdx: {
      titleKo: "수비 지수 (전체)", titleEn: "DEFENSE INDEX (Full List)",
      header1Ko: "수비 지수", header1En: "DEFENSE INDEX",
    },
    streakWin: {
      titleKo: "연승 (전체)", titleEn: "WINNING STREAK (Full List)",
      header1Ko: "연승", header1En: "STREAK",
    },
    streakLoss: {
      titleKo: "연패 (전체)", titleEn: "LOSING STREAK (Full List)",
      header1Ko: "연패", header1En: "STREAK",
    },
    streakDraw: {
      titleKo: "연속 무승부 (전체)", titleEn: "DRAWING STREAK (Full List)",
      header1Ko: "연무", header1En: "STREAK",
    },
    streakUnbeaten: {
      titleKo: "무패 행진 (전체)", titleEn: "UNBEATEN STREAK (Full List)",
      header1Ko: "무패", header1En: "STREAK",
    },
    streakScoring: {
      titleKo: "연속 득점 (전체)", titleEn: "SCORING STREAK (Full List)",
      header1Ko: "연속 득점", header1En: "STREAK",
    },
    streakConceding: {
      titleKo: "연속 실점 (전체)", titleEn: "CONCEDING STREAK (Full List)",
      header1Ko: "연속 실점", header1En: "STREAK",
    },
  };

  function openModal(type) {
    const config = MODAL_CONFIG[type];
    if (!config) return;

    currentModalType = type;
    const modal = document.getElementById('statModal');
    const title = document.getElementById('modalTitle');
    const header1 = document.getElementById('modalStatHeader1');
    const header2 = document.getElementById('modalStatHeader2');

    title.textContent = isKorean ? config.titleKo : config.titleEn;
    header1.textContent = isKorean ? config.header1Ko : config.header1En;

    const hasHeader2 = config.header2Ko !== undefined;
    header2.style.display = hasHeader2 ? '' : 'none';
    if (hasHeader2) {
      header2.textContent = isKorean ? config.header2Ko : config.header2En;
    }

    renderStatsTable('modalTableBody', statsData[type], type);
    modal.style.display = 'flex';
  }

  function closeModal() {
    currentModalType = null;
    document.getElementById('statModal').style.display = 'none';
  }

  // ===== 선수 득점 타임라인 모달 (Player Goal Timeline Modal) =====
  function openPlayerModal(key) {
    const player = topScorersData.find(p => p.key === key);
    if (!player) return;

    currentPlayerModalKey = key;

    const timeline = (playerGoalTimelines[key] || []).slice();

    document.getElementById('playerModalLogo').src = player.teamLogo;
    document.getElementById('playerModalLogo').alt = player.teamEn;
    document.getElementById('playerModalName').textContent = isKorean ? player.nameKo : player.nameEn;
    document.getElementById('playerModalTeam').textContent = isKorean ? player.teamKo : player.teamEn;
    document.getElementById('playerModalTotalGoals').textContent = player.goals;
    document.getElementById('playerModalMatches').textContent = timeline.length;

    const listEl = document.getElementById('playerTimeline');
    listEl.innerHTML = '';

    timeline.forEach(entry => {
      const weekLabel = isKorean ? `${entry.weekNum}주차` : `Week ${entry.weekNum}`;
      const oppName = isKorean ? entry.oppKo : entry.oppEn;
      const haClass = entry.homeAway === 'H' ? 'ha-home' : 'ha-away';
      const scoreLine = entry.homeAway === 'H'
        ? `${entry.homeScore} : ${entry.awayScore}`
        : `${entry.awayScore} : ${entry.homeScore}`;
      const pkTag = entry.isPk ? `<span class="timeline-pk-tag">PK</span>` : '';
      const goalsLabel = isKorean ? `${entry.goals}골` : (entry.goals > 1 ? `${entry.goals} goals` : `${entry.goals} goal`);

      const row = document.createElement('div');
      row.className = 'timeline-row';
      row.innerHTML = `
        <div class="timeline-round">
          <span class="timeline-round-label">${weekLabel}</span>
        </div>
        <div class="timeline-match">
          <span class="ha-badge ${haClass}">${entry.homeAway}</span>
          ${entry.oppLogo ? `<img class="team-logo team-logo-sm" src="${entry.oppLogo}" alt="${entry.oppEn}">` : ''}
          <span class="timeline-opp-name">${oppName}</span>
          <span class="timeline-score">${scoreLine}</span>
        </div>
        <div class="timeline-goals">
          <span class="timeline-goals-badge">${goalsLabel}</span>
          ${pkTag}
        </div>
      `;
      listEl.appendChild(row);
    });

    if (timeline.length === 0) {
      listEl.innerHTML = `<div class="timeline-empty">${isKorean ? '득점 기록이 없습니다.' : 'No goal records.'}</div>`;
    }

    attachImageFallback();
    document.getElementById('playerModal').style.display = 'flex';
  }

  function closePlayerModal() {
    currentPlayerModalKey = null;
    document.getElementById('playerModal').style.display = 'none';
  }

  document.addEventListener('click', function(event) {
    const link = event.target.closest('.player-name-link');
    if (link && link.dataset.playerKey) {
      openPlayerModal(link.dataset.playerKey);
    }
  });

  // ===== 스쿼드 선수 통산 기록 모달 (Squad Player Career Stats Modal) =====
  function openSquadPlayerModal(number) {
    const num = parseInt(number, 10);
    const player = squadData.find(p => p.number === num);
    if (!player) return;

    currentSquadPlayerModalNumber = num;
    const stats = squadPlayerStats[num] || {
      appearances: 0, starts: 0, subApps: 0, goals: 0,
      captainCount: 0, motmCount: 0, history: []
    };

    document.getElementById('squadPlayerModalPhoto').src = player.photoSrc || '';
    document.getElementById('squadPlayerModalPhoto').alt = player.nameEn;
    document.getElementById('squadPlayerModalPhoto').style.display = player.photoSrc ? '' : 'none';
    document.getElementById('squadPlayerModalName').textContent = isKorean ? player.nameKo : player.nameEn;
    const posLabel = POSITION_LABEL[player.position] ? (isKorean ? POSITION_LABEL[player.position].ko : POSITION_LABEL[player.position].en) : player.position;
    document.getElementById('squadPlayerModalPos').textContent = `#${player.number} · ${posLabel}`;

    document.getElementById('squadPlayerModalApps').textContent = stats.appearances;
    document.getElementById('squadPlayerModalGoals').textContent = stats.goals;
    document.getElementById('squadPlayerModalStarts').textContent = `${stats.starts} / ${stats.subApps}`;
    document.getElementById('squadPlayerModalMotm').textContent = stats.motmCount;

    const noteEl = document.getElementById('squadPlayerModalCaptainNote');
    if (stats.captainCount > 0) {
      noteEl.style.display = '';
      noteEl.innerHTML = isKorean
        ? `🎖️ 주장 선발 출전 <b>${stats.captainCount}</b>회`
        : `🎖️ Started as captain <b>${stats.captainCount}</b> time(s)`;
    } else {
      noteEl.style.display = 'none';
      noteEl.innerHTML = '';
    }

    const listEl = document.getElementById('squadPlayerTimeline');
    listEl.innerHTML = '';

    stats.history.slice().reverse().forEach(entry => {
      const weekLabel = isKorean ? `${entry.weekNum}주차` : `Week ${entry.weekNum}`;
      const roleLabel = entry.wasStarter
        ? (isKorean ? '선발' : 'Start')
        : (isKorean ? '교체' : 'Sub');
      const goalsTag = entry.goals > 0
        ? `<span class="timeline-goals-badge">${isKorean ? entry.goals + '골' : (entry.goals > 1 ? entry.goals + ' goals' : entry.goals + ' goal')}</span>`
        : '';
      const capTag = entry.isCaptain ? `<span class="timeline-pk-tag">${isKorean ? 'C' : 'C'}</span>` : '';
      const motmTag = entry.wasMotm ? `<span class="timeline-pk-tag">MOTM</span>` : '';

      const row = document.createElement('div');
      row.className = 'timeline-row';
      row.innerHTML = `
        <div class="timeline-round">
          <span class="timeline-round-label">${weekLabel}</span>
        </div>
        <div class="timeline-match">
          <span class="ha-badge ${entry.wasStarter ? 'ha-home' : 'ha-away'}">${roleLabel}</span>
          <span class="timeline-opp-name">vs ${entry.opponentKo}</span>
          <span class="timeline-score">${entry.result}</span>
        </div>
        <div class="timeline-goals">
          ${goalsTag}
          ${capTag}
          ${motmTag}
        </div>
      `;
      listEl.appendChild(row);
    });

    if (stats.history.length === 0) {
      listEl.innerHTML = `<div class="timeline-empty">${isKorean ? '출전 기록이 없습니다.' : 'No appearance records.'}</div>`;
    }

    attachImageFallback();
    document.getElementById('squadPlayerModal').style.display = 'flex';
  }

  function closeSquadPlayerModal() {
    currentSquadPlayerModalNumber = null;
    document.getElementById('squadPlayerModal').style.display = 'none';
  }

  // ===== 팀 정보 전환 (Team Info Switcher: 좌우 화살표 / 팀 바로가기) =====
  // 치주물루는 기존 전체 허브(팀정보/기록/선수단/상대전적/경기결과)를 그대로 보여주고,
  // 나머지 14개 구단은 leagueData에 있는 간단 정보(순위/승점/전적/폼/다음경기/홈구장)만
  // 같은 전체화면 레이아웃으로 보여줍니다.
  function renderTeamSwitcherBar(team, rank, total) {
    const name = isKorean ? team.nameKo : team.nameEn;
    const rankTxt = isKorean ? `${rank} / ${total}위` : `#${rank} of ${total}`;
    const logoEl = document.getElementById('tiSwitchLogo');
    const nameEl = document.getElementById('tiSwitchName');
    const rankEl = document.getElementById('tiSwitchRank');
    if (logoEl) { logoEl.src = team.logoSrc; logoEl.alt = team.nameEn; }
    if (nameEl) {
      nameEl.textContent = name;
      nameEl.setAttribute('data-en', team.nameEn);
      nameEl.setAttribute('data-ko', team.nameKo);
    }
    if (rankEl) rankEl.textContent = rankTxt;
  }

  function switchTeamInfo(direction) {
    const ranked = getRankedTeams('all');
    const idx = ranked.findIndex(t => t.nameEn === currentTeamInfoKey);
    const safeIdx = idx === -1 ? 0 : idx;
    const newIdx = (safeIdx + direction + ranked.length) % ranked.length;
    showTeamInfoForKey(ranked[newIdx].nameEn);
  }

  function showTeamInfoForKey(nameEn) {
    const ranked = getRankedTeams('all');
    const idx = ranked.findIndex(t => t.nameEn === nameEn);
    if (idx === -1) return;
    const team = ranked[idx];

    currentTeamInfoKey = team.nameEn;
    renderTeamSwitcherBar(team, idx + 1, ranked.length);

    const mineEl = document.getElementById('myTeamInfoView');
    const otherEl = document.getElementById('otherTeamFullView');

    if (isMyTeamName(team.nameEn, team.nameKo)) {
      if (mineEl) mineEl.style.display = '';
      if (otherEl) otherEl.style.display = 'none';
      renderTeamInfoView();
    } else {
      if (mineEl) mineEl.style.display = 'none';
      if (otherEl) otherEl.style.display = '';
      renderOtherTeamFull(team, idx + 1, ranked.length);
    }
  }

  function renderOtherTeamFull(t, rank, total) {
    const name = isKorean ? t.nameKo : t.nameEn;
    const venueName = t.venue ? (isKorean ? t.venue.nameKo : t.venue.nameEn) : '';

    const headerEl = document.getElementById('otherTeamFullHeader');
    if (headerEl) {
      headerEl.innerHTML = `
        <div class="squad-header team-info-header other-team-full-header" data-logo-src="${t.logoSrc}">
          <img class="squad-header-logo" src="${t.logoSrc}" alt="${t.nameEn}">
          <div class="squad-header-text">
            <h2 class="lbl" data-en="${t.nameEn}" data-ko="${t.nameKo}">${name}</h2>
            <span class="squad-header-sub lbl" data-en="26/27 Season · NRFA League One" data-ko="26/27 시즌 · NRFA 리그 원">26/27 시즌 · NRFA 리그 원</span>
            ${venueName ? `<div class="team-info-people"><span class="team-info-person"><span class="tip-label lbl" data-en="Home Ground" data-ko="홈구장">홈구장</span><span class="tip-value lbl" data-en="${t.venue.nameEn}" data-ko="${t.venue.nameKo}">${venueName}</span></span></div>` : ''}
          </div>
          <div class="team-info-quickstats">
            <div class="ti-stat ti-stat-highlight">
              <span class="ti-stat-value">${rank}${isKorean ? '위' : ''}</span>
              <span class="ti-stat-label lbl" data-en="RANK" data-ko="순위">${isKorean ? '순위' : 'RANK'}</span>
            </div>
            <div class="ti-stat">
              <span class="ti-stat-value">${t.pts}</span>
              <span class="ti-stat-label lbl" data-en="PTS" data-ko="승점">${isKorean ? '승점' : 'PTS'}</span>
            </div>
            <div class="ti-stat">
              <span class="ti-stat-value">${t.played}</span>
              <span class="ti-stat-label lbl" data-en="PLAYED" data-ko="경기">${isKorean ? '경기' : 'PLAYED'}</span>
            </div>
            <div class="ti-stat">
              <span class="ti-stat-value">${t.won}</span>
              <span class="ti-stat-label lbl" data-en="W" data-ko="승">${isKorean ? '승' : 'W'}</span>
            </div>
            <div class="ti-stat">
              <span class="ti-stat-value">${t.drawn}</span>
              <span class="ti-stat-label lbl" data-en="D" data-ko="무">${isKorean ? '무' : 'D'}</span>
            </div>
            <div class="ti-stat">
              <span class="ti-stat-value">${t.lost}</span>
              <span class="ti-stat-label lbl" data-en="L" data-ko="패">${isKorean ? '패' : 'L'}</span>
            </div>
          </div>
        </div>`;
    }

    // 치주물루(우리 팀)와 동일한 형태로 보여줍니다: 기록 카드 → 폼 가이드 + 홈 vs 원정 카드 → 득점 순위 → 다음 경기.
    const recordCardHtml = buildRecordCardHtml(t, rank, total);
    const magicNumberHtml = buildTeamMagicNumberHtml(t, getRankedTeams('all'));
    const pointsTrendHtml = `
      <details class="team-points-trend-details ti-section team-points-trend-section">
        <summary class="team-points-trend-summary lbl" data-en="Cumulative Points by Round" data-ko="라운드별 누적 승점">${isKorean ? '라운드별 누적 승점' : 'Cumulative Points by Round'}</summary>
        <div class="team-points-trend-card"><svg id="otherTeamPointsHistorySvg" viewBox="0 0 700 300" xmlns="http://www.w3.org/2000/svg"></svg></div>
      </details>`;
    const formGuideHtml = buildFormGuideCardHtml(t);
    const homeAwayHtml = renderHomeAwaySplitCard(t);
    const byeFlowHtml = renderByeWeekFlowCard(t);
    const scorersHtml = buildTeamScorerCardsHtml(t.nameEn, t.nameKo);
    const nextMatchHtml = nextMatchOpponentHtml(t, rank);
    const pastResultsHtml = buildTeamPastResultsHtml(t.nameEn, t.nameKo);

    const bodyEl = document.getElementById('otherTeamFullBody');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="ti-section">
          <div class="ti-section-title lbl" data-en="Record" data-ko="기록">${isKorean ? '기록' : 'Record'}</div>
          ${recordCardHtml}
        </div>
        <div class="ti-section">
          <div class="ti-overview-grid other-team-full-grid">
            ${formGuideHtml}
            ${homeAwayHtml}
            ${byeFlowHtml}
          </div>
          ${magicNumberHtml}
        </div>
        ${pointsTrendHtml}
        <div class="ti-section">
          <div class="ti-section-title lbl" data-en="Top Scorers" data-ko="득점 순위">${isKorean ? '득점 순위' : 'Top Scorers'}</div>
          ${scorersHtml}
        </div>
        <div class="ti-section">
          <div class="ti-card">
            ${nextMatchHtml}
          </div>
        </div>
        <div class="ti-section">
          <div class="ti-section-title lbl" data-en="Results" data-ko="경기 결과">${isKorean ? '경기 결과' : 'Results'}</div>
          <div class="round-match-list ti-results-list">${pastResultsHtml}</div>
        </div>`;
    }

    attachImageFallback();
    renderTeamPointsHistoryChart('otherTeamPointsHistorySvg', t);
    applyOtherTeamHeaderAccent(t.nameEn);
    hydrateWeatherWidgets();
  }

  // ===== 타 팀 헤더 색상 (하드코딩) =====
  // 로고에서 실시간으로 색을 뽑는 대신, 팀별로 고정된 색상을 지정합니다.
  // (일괄 남색 대신 팀마다 다른 색으로 보이도록)
  const TEAM_ACCENT_COLORS = {
    "Chibavi Real Stars FC":  { r: 196, g: 45,  b: 58  }, // 레드
    "Jenda United FC":        { r: 32,  g: 122, b: 77  }, // 그린
    "Chintheche United FC":   { r: 106, g: 56,  b: 168 }, // 퍼플
    "Chilumba Barracks FC":   { r: 200, g: 98,  b: 24  }, // 오렌지
    "Mafu Stars FC":          { r: 16,  g: 137, b: 126 }, // 틸
    "M'mbelwa Warriors FC":   { r: 145, g: 32,  b: 60  }, // 마룬
    "Chipolopolo Boys FC":    { r: 176, g: 108, b: 30  }, // 카퍼/브론즈
    "Ekwendeni FC":           { r: 51,  g: 92,  b: 158 }, // 슬레이트 블루
    "Lube Masters FC":        { r: 98,  g: 110, b: 36  }, // 올리브
    "Chihame All Stars FC":   { r: 190, g: 45,  b: 120 }, // 마젠타
    "Raiply FC":              { r: 122, g: 78,  b: 44  }, // 브라운
    "Euthini Veterans FC":    { r: 71,  g: 100, b: 112 }, // 스틸 블루그레이
    "Vision S Academy":       { r: 68,  g: 60,  b: 168 }, // 인디고
    "Luviri FC":              { r: 20,  g: 150, b: 108 }  // 에메랄드
  };

  function headerGradientFromColor(rgb) {
    const { r, g, b } = rgb;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // 밝은 색일수록 더 어둡게 눌러서 흰 글자와 대비를 확보합니다.
    const darkFactor = luminance > 0.6 ? 0.42 : (luminance > 0.4 ? 0.6 : 0.8);
    const lightFactor = Math.min(darkFactor + 0.32, 1.15);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const dark = `rgb(${clamp(r * darkFactor)}, ${clamp(g * darkFactor)}, ${clamp(b * darkFactor)})`;
    const light = `rgb(${clamp(r * lightFactor)}, ${clamp(g * lightFactor)}, ${clamp(b * lightFactor)})`;
    return `linear-gradient(135deg, ${dark} 0%, ${light} 100%)`;
  }

  function applyOtherTeamHeaderAccent(nameEn) {
    const headerEl = document.querySelector('.other-team-full-header');
    if (!headerEl) return;

    const rgb = TEAM_ACCENT_COLORS[nameEn];
    if (!rgb) return;

    if (!otherTeamAccentCache[nameEn]) {
      otherTeamAccentCache[nameEn] = headerGradientFromColor(rgb);
    }
    headerEl.style.background = otherTeamAccentCache[nameEn];
  }

  // ===== 팀 바로가기 모달 (Jump to Team Modal) =====
  function openOtherTeamModal() {
    renderOtherTeamGrid();
    document.getElementById('otherTeamModal').style.display = 'flex';
  }

  function closeOtherTeamModal() {
    document.getElementById('otherTeamModal').style.display = 'none';
  }

  function jumpToTeam(nameEn) {
    closeOtherTeamModal();
    showTeamInfoForKey(nameEn);
  }

  // 팀 순위표에서 팀 이름/로고를 클릭하면 '팀 정보' 뷰로 바로 이동합니다.
  function goToTeamInfo(nameEn) {
    showView('squad');
    showTeamInfoForKey(nameEn);
    const squadBtn = document.getElementById('viewSquadBtn');
    if (squadBtn && squadBtn.scrollIntoView) {
      squadBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  function renderOtherTeamGrid() {
    const grid = document.getElementById('otherTeamGrid');
    if (!grid) return;
    const ranked = getRankedTeams('all');

    grid.innerHTML = ranked.map((t, idx) => {
      const rank = idx + 1;
      const isMine = isMyTeamName(t.nameEn, t.nameKo);
      const isCurrent = t.nameEn === currentTeamInfoKey;
      const name = isKorean ? t.nameKo : t.nameEn;
      const rankTxt = isKorean ? `${rank}위 · ${t.pts}점` : `#${rank} · ${t.pts} pts`;
      return `
        <button class="other-team-grid-item${isCurrent ? ' other-team-grid-item-current' : ''}" onclick="jumpToTeam('${t.nameEn.replace(/'/g, "\\'")}')">
          <img class="other-team-grid-logo" src="${t.logoSrc}" alt="${t.nameEn}">
          <span class="other-team-grid-info">
            <span class="other-team-grid-name lbl" data-en="${t.nameEn}" data-ko="${t.nameKo}">${name}${isMine ? (isKorean ? ' (우리 팀)' : ' (Us)') : ''}</span>
            <span class="other-team-grid-rank">${rankTxt}</span>
          </span>
        </button>`;
    }).join('');

    attachImageFallback();
  }

  document.addEventListener('click', function(event) {
    const card = event.target.closest('.squad-card');
    if (card && card.dataset.playerNumber) {
      openSquadPlayerModal(card.dataset.playerNumber);
    }
  });

  document.addEventListener('click', function(event) {
    const lineupLink = event.target.closest('.lineup-squad-link');
    if (lineupLink && lineupLink.dataset.playerNumber) {
      openSquadPlayerModal(lineupLink.dataset.playerNumber);
    }
  });

  document.addEventListener('click', function(event) {
    const gkCard = event.target.closest('.ti-gk-card-item');
    if (gkCard && gkCard.dataset.playerNumber) {
      openSquadPlayerModal(gkCard.dataset.playerNumber);
    }
  });

  document.addEventListener('click', function(event) {
    const awardCard = event.target.closest('.ti-award-card-item');
    if (awardCard && awardCard.dataset.playerNumber) {
      openSquadPlayerModal(awardCard.dataset.playerNumber);
    }
  });

  function toggleInfoTooltip(event, id) {
    event.stopPropagation();
    document.querySelectorAll('.info-tooltip').forEach(el => {
      if (el.id !== id) el.classList.remove('show');
    });
    document.getElementById(id).classList.toggle('show');
  }

  document.addEventListener('click', function() {
    document.querySelectorAll('.info-tooltip').forEach(el => el.classList.remove('show'));
  });
  
  window.onclick = function(event) {
    const modal = document.getElementById('statModal');
    if (event.target === modal) {
      closeModal();
    }
    const playerModal = document.getElementById('playerModal');
    if (event.target === playerModal) {
      closePlayerModal();
    }
    const squadPlayerModal = document.getElementById('squadPlayerModal');
    if (event.target === squadPlayerModal) {
      closeSquadPlayerModal();
    }
    const matchDetailModal = document.getElementById('matchDetailModal');
    if (event.target === matchDetailModal) {
      closeMatchDetail();
    }
    const venueMapModal = document.getElementById('venueMapModal');
    if (event.target === venueMapModal) {
      closeVenueMapModal();
    }
    const postponedMatchesModal = document.getElementById('postponedMatchesModal');
    if (event.target === postponedMatchesModal) {
      closePostponedMatchesModal();
    }
  }

  // ===== 라운드 상세(포메이션/득점/최근 전적) 모달 =====
  const POS_ROWS = [
    ['ST'],
    ['LW', 'CAM', 'RW'],
    ['LCM', 'RCM'],
    ['LB', 'LCB', 'RCB', 'RB'],
    ['GK']
  ];

  function findLineupPlayer(lineup, pos) {
    return lineup.starters.find(s => s.pos === pos);
  }

  function renderLineupPitch(lineup) {
    const isKo = isKorean;

    const nameFor = (ev) => isKo ? ev.nameKo : (ev.nameEn || ev.nameKo);

    const goalsTag = (ev) => {
      const goalMins = (ev.goals || []).filter(g => g !== '-');
      return (ev.goals && ev.goals.length)
        ? `<span class="lineup-goal-tag">⚽${goalMins.length ? ' ' + goalMins.join(', ') : ''}</span>`
        : '';
    };

    const renderCell = (pos) => {
      const starter = findLineupPlayer(lineup, pos);
      if (!starter) return '';
      const captainTag = starter.captain ? `<span class="lineup-captain-tag">C</span>` : '';

      if (!starter.outMin) {
        return `
          <div class="lineup-cell">
            <div class="lineup-pos">${pos}</div>
            <div class="lineup-player">
              <span class="lineup-num">${starter.number}</span>
              <span class="lineup-name player-name-link lineup-squad-link" data-player-number="${starter.number}">${nameFor(starter)}</span>
              ${captainTag}
              ${goalsTag(starter)}
            </div>
          </div>`;
      }

      // 선발이 교체되어 나간 경우: pos가 같은 subsIn 항목들을 순서대로 이어 붙여
      // ▼(아웃) / ▲(인) 체인을 구성합니다. subsIn 항목 자체가 outMin을 가지면
      // 그 자리를 이어받는 다음 pos-일치 항목이 또 투입된 것으로 처리합니다(이중 교체).
      const subsForPos = (lineup.subsIn || []).filter(s => s.pos === pos);
      const chain = [starter, ...subsForPos];

      let linesHtml = '';
      for (let i = 0; i < chain.length; i++) {
        const ev = chain[i];
        const evCaptainTag = ev.captain ? `<span class="lineup-captain-tag">C</span>` : '';
        if (i === 0) {
          linesHtml += `
            <div class="lineup-sub-line lineup-sub-line-out">
              <span class="lineup-sub-arrow">▼</span>
              <span class="lineup-sub-num">${ev.number}</span>
              <span class="lineup-sub-name player-name-link lineup-squad-link" data-player-number="${ev.number}">${nameFor(ev)}</span>
              ${evCaptainTag}
              ${ev.injury ? '<span class="lineup-sub-injury">🩹</span>' : ''}
            </div>`;
        } else {
          const rawTime = ev.inMin || '';
          const timeText = rawTime ? (rawTime.endsWith("'") ? rawTime : rawTime + "'") : '';
          linesHtml += `
            <div class="lineup-sub-line lineup-sub-line-in">
              <span class="lineup-sub-arrow">▲</span>
              ${timeText ? `<span class="lineup-sub-time">${timeText}</span>` : ''}
              <span class="lineup-sub-num">${ev.number}</span>
              <span class="lineup-sub-name player-name-link lineup-squad-link" data-player-number="${ev.number}">${nameFor(ev)}</span>
              ${evCaptainTag}
              ${goalsTag(ev)}
            </div>`;
          if (ev.outMin) {
            linesHtml += `
              <div class="lineup-sub-line lineup-sub-line-out">
                <span class="lineup-sub-arrow">▼</span>
                <span class="lineup-sub-num">${ev.number}</span>
                <span class="lineup-sub-name player-name-link lineup-squad-link" data-player-number="${ev.number}">${nameFor(ev)}</span>
              </div>`;
          }
        }
      }

      return `
        <div class="lineup-cell">
          <div class="lineup-pos">${pos}</div>
          ${linesHtml}
        </div>`;
    };

    const rowsHtml = POS_ROWS.map(rowPositions => {
      const cellsHtml = rowPositions.map(renderCell).join('');
      return `<div class="lineup-row">${cellsHtml}</div>`;
    }).join('');
    return `<div class="lineup-pitch">${rowsHtml}</div>`;
  }

  function renderLineupSubs(lineup) {
    const isKo = isKorean;
    const inHtml = lineup.subsIn.length
      ? lineup.subsIn.map(s => {
          const goalMins = (s.goals || []).filter(g => g !== '-');
          const goalsHtml = (s.goals && s.goals.length)
            ? `<span class="lineup-goal-tag">⚽${goalMins.length ? ' ' + goalMins.join(', ') : ''}</span>`
            : '';
          return `<span class="lineup-sub-chip lineup-sub-chip-in">▲ ${s.inMin && s.inMin !== '-' ? s.inMin + ' ' : ''}${s.number} <span class="player-name-link lineup-squad-link" data-player-number="${s.number}">${s.nameKo}</span>${goalsHtml}</span>`;
        }).join('')
      : `<span class="lineup-sub-empty">${isKo ? '교체 없음' : 'No substitutions'}</span>`;

    const unusedHtml = (lineup.subsUnused || []).map(num => {
      const sq = squadData.find(p => p.number === num);
      const name = sq ? (isKo ? sq.nameKo : sq.nameEn) : num;
      return `<span class="lineup-sub-chip lineup-sub-chip-unused">${num} <span class="player-name-link lineup-squad-link" data-player-number="${num}">${name}</span></span>`;
    }).join('');

    return `
      <div class="lineup-subs-section">
        <div class="lineup-subs-title lbl" data-en="Substitutes (Used)" data-ko="교체 투입">${isKo ? '교체 투입' : 'Substitutes (Used)'}</div>
        <div class="lineup-subs-chips">${inHtml}</div>
      </div>
      <div class="lineup-subs-section">
        <div class="lineup-subs-title lbl" data-en="Unused Substitutes" data-ko="벤치 (미출전)">${isKo ? '벤치 (미출전)' : 'Unused Substitutes'}</div>
        <div class="lineup-subs-chips">${unusedHtml || `<span class="lineup-sub-empty">${isKo ? '없음' : 'None'}</span>`}</div>
      </div>`;
  }

  function renderLineupHistory(history) {
    const isKo = isKorean;
    const list = (history && history.list) || [];
    if (!list.length) return '';
    const rows = list.map(h => `
      <tr>
        <td class="h2h-comp">${formatCompLabel(h.comp)}</td>
        <td class="h2h-score">${h.score}</td>
        <td class="h2h-result">${h.result}</td>
      </tr>`).join('');
    return `
      <div class="lineup-history-section">
        <div class="lineup-subs-title lbl" data-en="Recent Head-to-Head" data-ko="최근 상대 전적">${isKo ? '최근 상대 전적' : 'Recent Head-to-Head'}</div>
        <div class="h2h-card">
          <table class="h2h-table">
            <thead><tr>
              <th class="lbl" data-en="Match" data-ko="경기">${isKo ? '경기' : 'Match'}</th>
              <th class="lbl" data-en="Score" data-ko="스코어">${isKo ? '스코어' : 'Score'}</th>
              <th class="lbl" data-en="Result" data-ko="결과">${isKo ? '결과' : 'Result'}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="h2h-summary">${history.summary || ''}</div>
        </div>
      </div>`;
  }

  // 상대전적 "경기" 표기를 짧게 정리합니다.
  // "2025-26 시즌 음벨와 노던 리전 풋볼 리그 24주차" 같은 "N주차"가 있는 리그 경기는
  // 리그 이름을 빼고 "25/26 시즌 24주차" 형태로 줄여서 표시합니다.
  // "2025-26 시즌 카스텔컵 지역 단계 3라운드"처럼 "주차" 표기가 없는 컵대회 등은
  // 원래 문구 그대로(대회명 포함) 표시합니다.
  function formatCompLabel(comp) {
    const text = String(comp || '');
    const weekMatch = text.match(/(\d+)\s*주차/);
    if (!weekMatch) return text;
    const seasonMatch = text.match(/(\d{4})-(\d{2})/) || text.match(/(\d{2})\/(\d{2})/);
    if (!seasonMatch) return text;
    const seasonShort = seasonMatch[0].length === 7
      ? `${seasonMatch[1].slice(2)}/${seasonMatch[2]}`
      : seasonMatch[0];
    return `${seasonShort} 시즌 ${weekMatch[1]}주차`;
  }

  // 결과 문자열("3 : 1 승" 등) 끝의 승/패/무 표기를 언어에 맞게 변환
  function translateResultSuffix(resultKo) {
    const suffixMap = { '승': 'W', '패': 'L', '무': 'D' };
    const trimmed = resultKo.trim();
    const lastChar = trimmed.slice(-1);
    if (isKorean || !suffixMap[lastChar]) return resultKo;
    const scorePart = trimmed.slice(0, -1).trim();
    return `${scorePart} ${suffixMap[lastChar]}`;
  }

  function openMatchDetail(roundKey, weekNum) {
    const lineup = matchLineups[roundKey];
    if (!lineup) return;

    const isKo = isKorean;
    const weekLabel = isKo ? `${weekNum}주차` : `Week ${weekNum}`;
    const opponentTeam = leagueData.find(t => t.nameKo === lineup.opponentKo);
    const opponentName = opponentTeam ? (isKo ? opponentTeam.nameKo : opponentTeam.nameEn) : lineup.opponentKo;
    const resultText = translateResultSuffix(lineup.result);
    document.getElementById('matchDetailTitle').textContent =
      `${weekLabel} vs ${opponentName} (${resultText})`;

    const historyData = (typeof getEffectiveRoundHistory === 'function')
      ? getEffectiveRoundHistory(roundKey, weekNum, lineup)
      : { list: lineup.recentHistory || [], summary: lineup.historySummary || '' };

    const bodyEl = document.getElementById('matchDetailBody');
    bodyEl.innerHTML = `
      <div class="lineup-formation-tag">${lineup.formation}</div>
      <div class="match-detail-layout">
        <div class="match-detail-left">
          ${renderLineupPitch(lineup)}
        </div>
        <div class="match-detail-right">
          ${renderLineupSubs(lineup)}
          ${renderLineupHistory(historyData)}
        </div>
      </div>
    `;

    document.getElementById('matchDetailModal').style.display = 'flex';
  }

  function closeMatchDetail() {
    document.getElementById('matchDetailModal').style.display = 'none';
  }

  // ===== 경기 전 팀 비교(전적 비교) 모달 =====
  // "다음 경기"(아직 결과가 안 나온 라운드 카드)에서만 버튼이 노출되고,
  // 스코어가 입력되어 결과 카드로 바뀌는 순간 버튼 자체가 더 이상 렌더링되지
  // 않으므로 이 모달도 자연히 더는 뜨지 않습니다.
  function getTeamCompareSnapshot(nameEn, nameKo) {
    const ranked = getRankedTeams('all');
    const idx = ranked.findIndex(t => t.nameEn === nameEn);
    const team = idx !== -1 ? ranked[idx] : leagueData.find(t => t.nameEn === nameEn);
    const rank = idx !== -1 ? idx + 1 : null;
    const form = (typeof computeFormGuide === 'function') ? computeFormGuide(nameEn, nameKo) : null;
    return { team, rank, form };
  }

  function mcFormDotsHtml(form) {
    const results = form ? form.recentForm.map(m => m.result) : [];
    if (!results.length) {
      return `<span class="mc-form-empty lbl" data-en="No matches yet" data-ko="경기 기록 없음">${isKorean ? '경기 기록 없음' : 'No matches yet'}</span>`;
    }
    const label = { W: isKorean ? '승' : 'W', D: isKorean ? '무' : 'D', L: isKorean ? '패' : 'L' };
    return results.map(r => `<span class="mc-form-dot mc-form-${r.toLowerCase()}">${label[r]}</span>`).join('');
  }

  function mcStatRow(labelEn, labelKo, homeVal, awayVal, betterIsHigher) {
    const homeNum = Number(homeVal);
    const awayNum = Number(awayVal);
    let homeBetter = false, awayBetter = false;
    if (!Number.isNaN(homeNum) && !Number.isNaN(awayNum) && homeNum !== awayNum && betterIsHigher !== null) {
      homeBetter = betterIsHigher ? homeNum > awayNum : homeNum < awayNum;
      awayBetter = betterIsHigher ? homeNum < awayNum : homeNum > awayNum;
    }
    return `
      <div class="mc-stat-row">
        <span class="mc-stat-val${homeBetter ? ' mc-stat-better' : ''}">${homeVal}</span>
        <span class="mc-stat-label lbl" data-en="${labelEn}" data-ko="${labelKo}">${isKorean ? labelKo : labelEn}</span>
        <span class="mc-stat-val${awayBetter ? ' mc-stat-better' : ''}">${awayVal}</span>
      </div>`;
  }

  // 아직 결과가 안 나온(예정/연기) 경기의 "전적 비교" 모달에서, 우리 팀(치주물루)이 낀
  // 매치업이라면 matchLineups[roundKey].recentHistory(라운드가 끝난 뒤 채워짐) 또는
  // upcomingMatchHistory[roundKey].recentHistory(미리 적어둔 메모)에서 그 상대와의
  // 이전 맞대결 스코어 목록을 그대로 가져옵니다. 우리 팀이 아닌 매치업은 이런 메모가
  // 없으므로 null을 반환합니다.
  function getPriorMeetingsForMatch(homeEn, homeKo, awayEn, awayKo, roundKey) {
    if (!roundKey) return null;
    if (!isMyTeamName(homeEn, homeKo) && !isMyTeamName(awayEn, awayKo)) return null;
    const fromUpcoming = (typeof upcomingMatchHistory !== 'undefined' && upcomingMatchHistory[roundKey])
      ? upcomingMatchHistory[roundKey] : null;
    const fromLineup = (typeof matchLineups !== 'undefined' && matchLineups[roundKey])
      ? matchLineups[roundKey] : null;
    const entry = (fromUpcoming && fromUpcoming.recentHistory && fromUpcoming.recentHistory.length) ? fromUpcoming : fromLineup;
    const list = entry ? entry.recentHistory : null;
    return (list && list.length) ? { list, historySummary: entry.historySummary || '' } : null;
  }

  // recentHistory 한 건의 "result" 텍스트(예: "치주물루 승", "치주물루 승(몰수승)", "무승부",
  // "심보웨 승")를 우리 팀 기준 W/D/L로 분류합니다.
  function classifyPriorResult(resultText) {
    const t = String(resultText || '');
    if (t.indexOf('무승부') !== -1) return 'D';
    if (t.indexOf('치주물루') !== -1 && t.indexOf('승') !== -1) return 'W';
    return 'L';
  }

  // 위에서 찾은 이전 맞대결 목록을 예쁜 카드 목록 + 승무패 요약으로 렌더링합니다(항상 펼쳐진 상태).
  function priorMeetingsSectionHtml(prior) {
    if (!prior || !prior.list || !prior.list.length) return '';
    const list = prior.list;
    const wdlLabel = { W: isKorean ? '승' : 'W', D: isKorean ? '무' : 'D', L: isKorean ? '패' : 'L' };

    let w = 0, d = 0, l = 0;
    const rows = list.map(h => {
      const r = classifyPriorResult(h.result);
      if (r === 'W') w++; else if (r === 'D') d++; else l++;
      return `
        <div class="mc-prior-row mc-prior-row-${r.toLowerCase()}">
          <span class="mc-prior-badge mc-prior-badge-${r.toLowerCase()}">${wdlLabel[r]}</span>
          <div class="mc-prior-row-main">
            <span class="mc-prior-comp">${formatCompLabel(h.comp) || ''}</span>
            <span class="mc-prior-score">${h.score || ''}</span>
          </div>
        </div>`;
    }).join('');

    const playedTxt = isKorean ? `총 ${list.length}경기` : `${list.length} PLD`;

    return `
      <div class="mc-prior-block">
        <div class="mc-prior-header">
          <span class="mc-prior-title lbl" data-en="Previous Meetings" data-ko="상대전적(이전경기)">${isKorean ? '상대전적(이전경기)' : 'Previous Meetings'}</span>
          <span class="mc-prior-played">${playedTxt}</span>
        </div>
        <div class="mc-prior-wdl">
          <span class="mc-prior-wdl-item mc-prior-wdl-w"><b>${w}</b>${wdlLabel.W}</span>
          <span class="mc-prior-wdl-item mc-prior-wdl-d"><b>${d}</b>${wdlLabel.D}</span>
          <span class="mc-prior-wdl-item mc-prior-wdl-l"><b>${l}</b>${wdlLabel.L}</span>
        </div>
        <div class="mc-prior-list">${rows}</div>
      </div>`;
  }

  // 승/무/패 확률 막대 (홈-무-원정 3분할, 각 구간 폭 = 확률%)
  function mcAiProbBarHtml(pred, homeShort, awayShort) {
    const h = pred.homeWinPct, d = pred.drawPct, a = pred.awayWinPct;
    const fmtPct = v => (v >= 10 ? Math.round(v) : v.toFixed(1)) + '%';
    return `
      <div class="mc-ai-probbar">
        <div class="mc-ai-prob-seg mc-ai-prob-home" style="flex:${Math.max(h, 0.001)}" title="${homeShort} ${fmtPct(h)}"></div>
        <div class="mc-ai-prob-seg mc-ai-prob-draw" style="flex:${Math.max(d, 0.001)}" title="${isKorean ? '무승부' : 'Draw'} ${fmtPct(d)}"></div>
        <div class="mc-ai-prob-seg mc-ai-prob-away" style="flex:${Math.max(a, 0.001)}" title="${awayShort} ${fmtPct(a)}"></div>
      </div>
      <div class="mc-ai-prob-labels">
        <span class="mc-ai-prob-label mc-ai-prob-label-home"><b>${fmtPct(h)}</b> ${homeShort}</span>
        <span class="mc-ai-prob-label mc-ai-prob-label-draw"><b>${fmtPct(d)}</b> ${isKorean ? '무' : 'Draw'}</span>
        <span class="mc-ai-prob-label mc-ai-prob-label-away"><b>${fmtPct(a)}</b> ${awayShort}</span>
      </div>`;
  }

  // "AI 예측" 블록 전체(제목 배지 + 확률바 + 예상스코어 + 자동 코멘트).
  // 아직 결과가 안 나온 경기라면 팀/폼/순위 데이터를 모아 predictSingleMatch +
  // buildAiPredictionNarrative(둘 다 data.js)로 확률과 코멘트를 계산합니다.
  function aiPredictionBlockHtml(homeEn, homeKo, awayEn, awayKo, home, away) {
    if (typeof predictSingleMatch !== 'function') return '';
    const pred = predictSingleMatch(homeEn, homeKo, awayEn, awayKo);
    if (!pred) return '';

    const homeName = isKorean ? homeKo : homeEn;
    const awayName = isKorean ? awayKo : awayEn;
    const homeShort = homeName.split(' ')[0];
    const awayShort = awayName.split(' ')[0];

    const narrative = (typeof buildAiPredictionNarrative === 'function')
      ? buildAiPredictionNarrative({
          homeName: homeShort, awayName: awayShort, pred,
          homeRank: home.rank, awayRank: away.rank,
          homeForm: home.form, awayForm: away.form,
          isKorean
        })
      : [];

    const scoreTxt = `${pred.predictedHomeGoals} : ${pred.predictedAwayGoals}`;
    const xgTxt = isKorean
      ? `예상 득점 ${pred.expectedHomeGoals.toFixed(2)} : ${pred.expectedAwayGoals.toFixed(2)}`
      : `Expected goals ${pred.expectedHomeGoals.toFixed(2)} : ${pred.expectedAwayGoals.toFixed(2)}`;

    // AI 예측 성적표에 쌓인 오차 패턴으로 자동 보정이 적용됐다면 계수와 함께 알려줍니다.
    const correctionLineHtml = pred.correctionApplied
      ? `<div class="mc-ai-correction lbl" data-en="Auto-corrected from past prediction errors (home ×${pred.homeCorrectionFactor.toFixed(2)} / away ×${pred.awayCorrectionFactor.toFixed(2)}, n=${pred.correctionSampleSize})" data-ko="지난 예측 오차를 반영해 자동 보정됨(홈 ×${pred.homeCorrectionFactor.toFixed(2)} · 원정 ×${pred.awayCorrectionFactor.toFixed(2)}, 표본 ${pred.correctionSampleSize}경기)">${isKorean ? `지난 예측 오차를 반영해 자동 보정됨(홈 ×${pred.homeCorrectionFactor.toFixed(2)} · 원정 ×${pred.awayCorrectionFactor.toFixed(2)}, 표본 ${pred.correctionSampleSize}경기)` : `Auto-corrected from past prediction errors (home ×${pred.homeCorrectionFactor.toFixed(2)} / away ×${pred.awayCorrectionFactor.toFixed(2)}, n=${pred.correctionSampleSize})`}</div>`
      : '';

    return `
      <div class="mc-ai-block">
        <div class="mc-ai-header">
          <span class="mc-ai-badge lbl" data-en="AI Prediction" data-ko="AI 예측">🤖 ${isKorean ? 'AI 예측' : 'AI Prediction'}</span>
          <span class="mc-ai-score">${scoreTxt}</span>
        </div>
        ${mcAiProbBarHtml(pred, homeShort, awayShort)}
        <div class="mc-ai-xg">${xgTxt}</div>
        <ul class="mc-ai-text">
          ${narrative.map(l => `<li>${l}</li>`).join('')}
        </ul>
        ${correctionLineHtml}
        <div class="mc-ai-disclaimer lbl" data-en="Auto-generated from this season's stats (Poisson model) — for fun, not a guarantee." data-ko="이번 시즌 스탯 기반 자동 계산(포아송 모델)이며, 참고용 예측일 뿐 결과를 보장하지 않습니다.">
          ${isKorean ? '이번 시즌 스탯 기반 자동 계산(포아송 모델)이며, 참고용 예측일 뿐 결과를 보장하지 않습니다.' : "Auto-generated from this season's stats (Poisson model) — for fun, not a guarantee."}
        </div>
      </div>`;
  }

  function openMatchCompareModal(homeEn, homeKo, awayEn, awayKo, roundKey) {
    const home = getTeamCompareSnapshot(homeEn, homeKo);
    const away = getTeamCompareSnapshot(awayEn, awayKo);
    if (!home.team || !away.team) return;

    const homeLogo = getTeamLogo(homeEn);
    const awayLogo = getTeamLogo(awayEn);
    const homeName = isKorean ? homeKo : homeEn;
    const awayName = isKorean ? awayKo : awayEn;
    const rankTxt = (r) => r ? (isKorean ? `${r}위` : `#${r}`) : '-';

    const h2h = (typeof computeTeamSeasonH2H === 'function')
      ? computeTeamSeasonH2H(homeEn, homeKo, awayEn, awayKo)
      : null;
    let h2hHtml;
    if (h2h) {
      const scoreTxt = h2h.aIsHome ? `${h2h.aScore} : ${h2h.bScore}` : `${h2h.bScore} : ${h2h.aScore}`;
      const weekLbl = isKorean ? `${h2h.weekNum}주차` : `Week ${h2h.weekNum}`;
      h2hHtml = `
        <div class="mc-h2h-note">
          <span class="mc-h2h-week">${weekLbl}</span>
          <span class="mc-h2h-score">${homeName} ${scoreTxt} ${awayName}</span>
        </div>`;
    } else {
      h2hHtml = `
        <div class="mc-h2h-note mc-h2h-empty lbl" data-en="First meeting this season" data-ko="이번 시즌 첫 맞대결">
          ${isKorean ? '이번 시즌 첫 맞대결' : 'First meeting this season'}
        </div>`;
    }

    const bodyEl = document.getElementById('matchCompareBody');
    bodyEl.innerHTML = `
      <div class="mc-teams-row">
        <div class="mc-team-col">
          ${homeLogo ? `<img class="team-logo mc-team-logo" src="${homeLogo}" alt="${homeEn}">` : ''}
          <span class="mc-team-name lbl" data-en="${homeEn}" data-ko="${homeKo}">${homeName}</span>
          <span class="mc-team-rank">${rankTxt(home.rank)}</span>
        </div>
        <div class="mc-vs">VS</div>
        <div class="mc-team-col">
          ${awayLogo ? `<img class="team-logo mc-team-logo" src="${awayLogo}" alt="${awayEn}">` : ''}
          <span class="mc-team-name lbl" data-en="${awayEn}" data-ko="${awayKo}">${awayName}</span>
          <span class="mc-team-rank">${rankTxt(away.rank)}</span>
        </div>
      </div>
      <div class="mc-compare-layout">
        <div class="mc-compare-right">
          ${aiPredictionBlockHtml(homeEn, homeKo, awayEn, awayKo, home, away)}
        </div>
        <div class="mc-compare-left">
          <div class="mc-stats-block">
            ${mcStatRow('Points', '승점', home.team.pts, away.team.pts, true)}
            ${mcStatRow('Record (W-D-L)', '전적(승-무-패)', `${home.team.won}-${home.team.drawn}-${home.team.lost}`, `${away.team.won}-${away.team.drawn}-${away.team.lost}`, null)}
            ${mcStatRow('Goals For', '득점', home.team.goalsFor, away.team.goalsFor, true)}
            ${mcStatRow('Goals Against', '실점', home.team.goalsAgainst, away.team.goalsAgainst, false)}
            ${mcStatRow('Goal Difference', '득실차', home.team.gd, away.team.gd, true)}
            ${mcStatRow('Clean Sheets', '클린시트', home.team.cleanSheets, away.team.cleanSheets, true)}
            ${mcStatRow('Failed to Score', '무득점 경기', home.team.failedToScore, away.team.failedToScore, false)}
          </div>
          <div class="mc-form-block">
            <div class="mc-form-title lbl" data-en="Recent Form" data-ko="최근 폼">${isKorean ? '최근 폼' : 'Recent Form'}</div>
            <div class="mc-form-row">
              <div class="mc-form-side">${mcFormDotsHtml(home.form)}</div>
              <div class="mc-form-side">${mcFormDotsHtml(away.form)}</div>
            </div>
          </div>
          <div class="mc-h2h-block">
            <div class="mc-form-title lbl" data-en="Season Head-to-Head" data-ko="이번 시즌 맞대결">${isKorean ? '이번 시즌 맞대결' : 'Season Head-to-Head'}</div>
            ${h2hHtml}
          </div>
          ${priorMeetingsSectionHtml(getPriorMeetingsForMatch(homeEn, homeKo, awayEn, awayKo, roundKey))}
        </div>
      </div>
    `;

    document.getElementById('matchCompareModal').style.display = 'flex';
  }

  function closeMatchCompareModal() {
    document.getElementById('matchCompareModal').style.display = 'none';
  }


  // ===== 날짜 / 시즌 정보 유틸 (Date & Season Utils) =====
  function getLocalToday() {
    // 방문자의 브라우저(접속 국가) 로컬 시간대 기준 오늘 날짜
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  // 완료된 라운드 다음에 예정된 라운드의 첫 킥오프 날짜를 scheduledRounds에서 자동으로 찾습니다.
  // (더 이상 NEXT_ROUND_START_DATE를 수동으로 갱신할 필요가 없습니다.)
  function computeNextRoundStartDate() {
    const completedRounds = sortedRoundKeys().length;
    const nextKey = 'round' + (completedRounds + 1);
    const nextRound = (scheduledRounds && scheduledRounds[nextKey]) || [];
    const dates = nextRound
      .filter(m => !m.byeKo && !m.byeEn && m.kickoffDate)
      .map(m => m.kickoffDate)
      .sort();
    return dates[0] || null;
  }

  function updateSeasonInfo() {
    const today = getLocalToday();
    const nextRoundStartStr = computeNextRoundStartDate();
    const nextRoundStart = nextRoundStartStr ? new Date(`${nextRoundStartStr}T00:00:00`) : null;

    // 완료된 라운드 수를 기준 주차로 삼고, 다음 라운드 시작일이 지나면 주차를 하나 올립니다.
    const completedRounds = sortedRoundKeys().length;
    const week = (nextRoundStart && today >= nextRoundStart) ? completedRounds + 1 : completedRounds;

    const weekEl = document.getElementById('weekLabel');
    const dateEl = document.getElementById('dateLabel');
    const dateShortEl = document.getElementById('dateLabelShort');
    if (weekEl) weekEl.textContent = isKorean ? `${week}주차` : `Week ${week}`;
    if (dateEl) {
      dateEl.textContent = isKorean
        ? `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`
        : today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (dateShortEl) {
      dateShortEl.textContent = isKorean
        ? `${today.getMonth() + 1}.${today.getDate()}`
        : today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  function equalizeTitleLines() {
    const h1 = document.querySelector('.league-title h1');
    if (!h1) return;
    const line1 = h1.querySelector('.sponsor-line');
    const line2 = h1.querySelector('.main-line');
    if (!line1 || !line2) return;
    line1.style.letterSpacing = '';
    line2.style.letterSpacing = '';
    const w1 = line1.getBoundingClientRect().width;
    const w2 = line2.getBoundingClientRect().width;
    const shorter = w1 < w2 ? line1 : line2;
    const longer = w1 < w2 ? line2 : line1;
    const diff = longer.getBoundingClientRect().width - shorter.getBoundingClientRect().width;
    const charCount = shorter.textContent.trim().length;
    if (charCount > 1 && diff > 0) {
      shorter.style.letterSpacing = (diff / (charCount - 1)) + 'px';
    }
  }


  // ===== 언어 전환 (Language Toggle) =====
  function toggleLang() {
    isKorean = !isKorean;
    document.querySelectorAll('.lbl').forEach(el => {
      el.innerHTML = isKorean ? el.getAttribute('data-ko') : el.getAttribute('data-en');
    });
    document.querySelectorAll('.opp-logo').forEach(el => {
      el.title = isKorean ? el.getAttribute('data-ko-name') : el.getAttribute('data-en-name');
    });
    document.getElementById('langBtnText').textContent = isKorean ? 'View in English' : '한국어로 보기';
    updateSeasonInfo();
    equalizeTitleLines();
    
    renderLeagueTable();
    renderNextMatchStrip();
    
    if (currentView === 'stats') {
      buildStatsTables();
      if (currentModalType) {
        openModal(currentModalType);
      }
    } else if (currentView === 'scorers') {
      renderScorersTable();
    } else if (currentView === 'predict') {
      drawPredictionTable();
      renderRankHistoryChart();
      renderPointsHistoryChart();
      renderMagicNumberStats();
      renderAiTrackRecord();
    } else if (currentView === 'squad') {
      showTeamInfoForKey(currentTeamInfoKey);
    } else if (currentView === 'rounds') {
      renderRoundsView();
    } else if (currentView === 'venues') {
      renderVenuesView();
      const venueModal = document.getElementById('venueMapModal');
      if (venueModal && venueModal.style.display === 'flex') {
        renderVenueLeafletMapLarge();
      }
    }

    if (currentPlayerModalKey) {
      openPlayerModal(currentPlayerModalKey);
    }
    if (currentSquadPlayerModalNumber) {
      openSquadPlayerModal(currentSquadPlayerModalNumber);
    }

    const otherTeamModal = document.getElementById('otherTeamModal');
    if (otherTeamModal && otherTeamModal.style.display === 'flex') {
      renderOtherTeamGrid();
    }

    const postponedModal = document.getElementById('postponedMatchesModal');
    if (postponedModal && postponedModal.style.display === 'flex') {
      renderPostponedMatchesModal();
    }
  }


  // ===== 이미지 로드 실패 대체 처리 (Image Fallback) =====
  function attachImageFallback() {
    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.fallbackListenerAdded) return;
      img.dataset.fallbackListenerAdded = true;
      
      img.addEventListener('error', function() {
        if (this.dataset.fallbackApplied) return;
        this.dataset.fallbackApplied = true;

        let name = this.getAttribute('data-en-name') || this.alt || this.title || 'Team';
        let cleanName = name.replace(/\s+FC$/i, '').replace(/\s+Academy$/i, '').trim();
        let initials = cleanName.split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase();
        
        let size = '150x150';
        if (this.classList.contains('team-logo-sm')) {
            size = '40x40';
        } else if (this.classList.contains('team-logo')) {
            size = '50x50';
        }

        this.src = `https://placehold.co/${size}/033990/FFFFFF?text=${initials}`;
      });
    });
  }


  // ===== 접속 안내 팝업 (공식 사이트 아님 안내) =====
  const DISCLAIMER_KEY = 'nrfa-disclaimer-hide-until';
  const DISCLAIMER_HIDE_WEEKS = 1;

  function showDisclaimerIfNeeded() {
    const modal = document.getElementById('disclaimerModal');
    if (!modal) return;
    try {
      const hideUntil = localStorage.getItem(DISCLAIMER_KEY);
      if (hideUntil && Date.now() < Number(hideUntil)) {
        return; // 아직 숨김 기간이 지나지 않음
      }
    } catch (e) {}
    modal.style.display = 'flex';
  }

  function closeDisclaimer() {
    const modal = document.getElementById('disclaimerModal');
    const dontShow = document.getElementById('disclaimerDontShow');
    if (dontShow && dontShow.checked) {
      try {
        const hideUntil = Date.now() + DISCLAIMER_HIDE_WEEKS * 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem(DISCLAIMER_KEY, String(hideUntil));
      } catch (e) {}
    }
    if (modal) modal.style.display = 'none';
  }

  // ===== 초기 실행 (App Init) =====
  document.addEventListener('DOMContentLoaded', function() {
    renderLeagueTable();
    renderNextMatchStrip();
  
    document.querySelectorAll('.lbl').forEach(el => {
      el.innerHTML = el.getAttribute('data-ko');
    });
    document.getElementById('langBtnText').textContent = 'View in English';

    applyTheme(isDarkTheme() ? 'dark' : 'light');
    
    attachImageFallback();

    updateSeasonInfo();
    equalizeTitleLines();
    setInterval(updateSeasonInfo, 60 * 60 * 1000); 
    setInterval(updateAllNextMatchCountdowns, 1000);
    window.addEventListener('resize', equalizeTitleLines);

    showDisclaimerIfNeeded();
    initScrollFadeHints();
    updateInstallBtnVisibility();

    pwaVisitCount = trackPwaVisit();
    maybeShowInstallBanner();
  });

  // ===== 스크롤 힌트 (표/탭 바를 좌우로 넘길 수 있음을 표시) =====
  // 여러 개의 가로 스크롤 영역(순위표, 득점 순위표, 리그 예측표, 상단 탭 바)에
  // 공통으로 적용합니다. 각 영역은 { scrollerId, fadeWrapId } 쌍으로 등록되고,
  // 스크롤/리사이즈 시점마다 실제로 더 스크롤할 내용이 남아있는 쪽에만
  // show-left/show-right 클래스를 붙여 그라데이션 힌트를 보여줍니다.
  const scrollFadeUpdaters = [];

  function registerScrollFadeHint(scrollerId, fadeWrapId) {
    const scroller = document.getElementById(scrollerId);
    const fadeWrap = document.getElementById(fadeWrapId);
    if (!scroller || !fadeWrap) return;

    function update() {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth;
      const scrolled = scroller.scrollLeft;
      fadeWrap.classList.toggle('show-left', scrolled > 4);
      fadeWrap.classList.toggle('show-right', scrolled < maxScroll - 4);
    }

    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    setTimeout(update, 300);
    scrollFadeUpdaters.push(update);
    enableMouseDragScroll(scroller);
    enableWheelToHorizontalScroll(scroller);
  }

  // 데스크톱에서는 터치 스와이프가 없으므로, 마우스 클릭+드래그로 가로 스크롤 영역을
  // 좌우로 움직일 수 있게 해줍니다 (탭 바, 표 등 overflow-x:auto 영역 공통 적용).
  function enableMouseDragScroll(el) {
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    el.addEventListener('mousedown', (e) => {
      // 버튼/링크 클릭 자체는 막지 않되, 드래그 시작점을 기록합니다.
      isDown = true;
      moved = false;
      startX = e.pageX;
      startScroll = el.scrollLeft;
      el.classList.add('is-dragging');
    });
    window.addEventListener('mouseup', () => {
      isDown = false;
      el.classList.remove('is-dragging');
    });
    window.addEventListener('mouseleave', () => {
      isDown = false;
      el.classList.remove('is-dragging');
    });
    el.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      if (Math.abs(dx) > 3) moved = true;
      if (moved) {
        e.preventDefault();
        el.scrollLeft = startScroll - dx;
      }
    });
    // 드래그로 실제로 움직였다면, mouseup 직후 발생하는 click 이벤트(탭 전환 등)를
    // 취소해서 드래그가 클릭으로 오인되지 않도록 합니다.
    el.addEventListener('click', (e) => {
      if (moved) {
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      }
    }, true);
  }

  // 세로 휠 스크롤(일반 마우스)만 있는 경우에도 가로 스크롤 영역을 움직일 수 있도록
  // deltaY를 가로 스크롤로 변환합니다. 가로로 넘길 내용이 있을 때만 동작합니다.
  function enableWheelToHorizontalScroll(el) {
    el.addEventListener('wheel', (e) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  }

  function initScrollFadeHints() {
    registerScrollFadeHint('viewToggleWrap', 'viewToggleFade');
    registerScrollFadeHint('rankTableScroller', 'rankTableFade');
    registerScrollFadeHint('magicNumberStatsScroller', 'magicNumberStatsFade');
    registerScrollFadeHint('scorersTableScroller', 'scorersTableFade');
    registerScrollFadeHint('predictTableScroller', 'predictTableFade');
  }

  // 데이터가 다시 렌더링되거나(언어 전환, 필터 변경, 화면 전환 등) 콘텐츠 폭이
  // 바뀔 수 있는 시점마다 이 함수를 호출해 힌트 상태를 다시 계산합니다.
  function refreshScrollFadeHints() {
    scrollFadeUpdaters.forEach(update => update());
  }
