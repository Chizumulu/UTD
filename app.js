  // ===== 전역 상태 (Global State) =====
  let isKorean = true;
  let currentView = 'rank';
  let currentTeamInfoTab = 'overview';
  let statsData = {};
  let currentModalType = null;
  let currentPlayerModalKey = null;
  let currentSquadPlayerModalNumber = null;
  let currentTeamInfoKey = 'Chizumulu United FC';
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
  });

  window.addEventListener('appinstalled', function() {
    deferredInstallPrompt = null;
    updateInstallBtnVisibility();
    showShareToast(isKorean ? '✅ 앱이 설치됐어요' : '✅ App installed');
  });

  async function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (e) {}
      deferredInstallPrompt = null;
      updateInstallBtnVisibility();
      return;
    }
    if (isIOSDevice()) {
      showShareToast(
        isKorean ? '하단 공유 버튼(□↑) → "홈 화면에 추가"를 눌러주세요' : 'Tap Share (□↑) → "Add to Home Screen"',
        4000
      );
      return;
    }
    showShareToast(isKorean ? '이 브라우저에서는 설치를 지원하지 않아요' : 'Install is not supported in this browser');
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
    const nextWeek = (preview && preview.roundKey)
      ? parseInt(preview.roundKey.replace('round', ''), 10)
      : (sortedRoundKeys().length + 1);
    const weekLbl = isKorean ? `${nextWeek}주차` : `WK ${nextWeek}`;

    if (t.nextMatch.isBye) {
      el.innerHTML = `
        <span class="nms-label lbl" data-en="Next" data-ko="다음경기">${isKorean ? '다음경기' : 'Next'}</span>
        <span class="nms-bye lbl" data-en="Bye week — no match this round" data-ko="이번 라운드는 휴식주입니다">${isKorean ? '이번 라운드는 휴식주입니다' : 'Bye week — no match this round'}</span>`;
      return;
    }

    const ranked = getRankedTeams('all');
    const oppIdx = ranked.findIndex(rt => rt.nameEn === t.nextMatch.oppEn);
    const oppRank = oppIdx !== -1 ? oppIdx + 1 : null;
    const oppRankTxt = oppRank ? (isKorean ? `${oppRank}위` : `#${oppRank}`) : '';
    const haClass = t.nextMatch.homeAway === 'H' ? 'ha-home' : 'ha-away';
    const oppName = isKorean ? t.nextMatch.oppKo : t.nextMatch.oppEn;
    const kickoffTxt = formatKickoff(t.nextMatch);

    el.innerHTML = `
      <span class="nms-label lbl" data-en="Next · ${weekLbl}" data-ko="다음경기 · ${weekLbl}">${isKorean ? '다음경기' : 'Next'} · ${weekLbl}</span>
      <span class="nms-team">
        <img class="team-logo team-logo-sm" src="./dd.svg" alt="Chizumulu United FC">
        <span class="lbl" data-en="Chizumulu United FC" data-ko="치주물루">${isKorean ? '치주물루' : 'Chizumulu'}</span>
      </span>
      <span class="ha-badge ${haClass} nms-ha">${t.nextMatch.homeAway}</span>
      <span class="nms-team">
        <img class="team-logo team-logo-sm opp-logo" data-en-name="${t.nextMatch.oppEn}" data-ko-name="${t.nextMatch.oppKo}" title="${oppName}" src="${t.nextMatch.oppLogo}" alt="${t.nextMatch.oppEn}">
        <span class="lbl" data-en="${t.nextMatch.oppEn}" data-ko="${t.nextMatch.oppKo}">${oppName}</span>
        ${oppRankTxt ? `<span class="nms-opp-rank">${oppRankTxt}</span>` : ''}
      </span>
      ${kickoffTxt ? `<span class="nms-kickoff">${kickoffTxt}</span>` : ''}
      <span class="nms-action-group">
        <button class="nms-action-btn" onclick="downloadNextMatchICS()" aria-label="Add to calendar" title="${isKorean ? '캘린더에 추가' : 'Add to calendar'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9H21M7 3V5M17 3V5M6.2 5H17.8C19 5 20 6 20 7.2V18.8C20 20 19 21 17.8 21H6.2C5 21 4 20 4 18.8V7.2C4 6 5 5 6.2 5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
        <button class="nms-action-btn" onclick="shareNextMatch()" aria-label="Share" title="${isKorean ? '공유하기' : 'Share'}">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.6 13.5L15.4 17.5M15.4 6.5L8.6 10.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="5" r="2.4" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="2.4" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="19" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>
        </button>
      </span>`;
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

    return `
      <div class="ti-next-match">
        <div class="ti-next-match-label lbl" data-en="Next Match · Week ${nextWeek}" data-ko="다음 경기 · ${nextWeek}주차">${isKorean ? `다음 경기 · ${nextWeek}주차` : `Next Match · Week ${nextWeek}`}</div>
        <div class="ti-next-match-body">
          <div class="ti-next-match-team">
            <img class="team-logo" src="${team.logoSrc}" alt="${team.nameEn}">
            <span class="lbl" data-en="${team.nameEn}" data-ko="${team.nameKo}">${isKorean ? team.nameKo : team.nameEn}</span>
            ${rankBadge(myRank)}
          </div>
          <div class="ti-next-match-vs">
            <span class="ha-badge ${haClass}">${nm.homeAway}</span>
            <span class="ti-next-match-vs-text">VS</span>
          </div>
          <div class="ti-next-match-team">
            <img class="team-logo" data-en-name="${nm.oppEn}" data-ko-name="${nm.oppKo}" src="${nm.oppLogo}" alt="${nm.oppEn}">
            <span class="lbl" data-en="${nm.oppEn}" data-ko="${nm.oppKo}">${oppName}</span>
            ${rankBadge(oppRank)}
          </div>
        </div>
        ${kickoffTxt ? `<div class="ti-next-match-kickoff">${kickoffTxt}</div>` : ''}
        ${nextMatchVenueName ? `<div class="ti-next-match-venue">🏟️ ${nextMatchVenueName}</div>` : ''}
        ${countdownHtml}
        ${h2hHtml}
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
    const awardsHtml = renderTeamAwardsCard();
    const homeAwayHtml = renderHomeAwaySplitCard(t);

    el.innerHTML = `
      <div class="ti-overview-grid">
        ${formGuideHtml}
        ${homeAwayHtml}
        ${awardsHtml}
      </div>
    `;
    attachImageFallback();
  }

  // 등번호로 선수 정보를 찾아 언어에 맞는 이름과 포지션 텍스트를 반환
  function awardPlayerHtml(number) {
    const sq = squadData.find(p => p.number === number);
    if (!sq) return '';
    const name = isKorean ? sq.nameKo : sq.nameEn;
    return `
      <span class="ti-award-player">
        <span class="ti-award-player-number">${sq.number}</span>
        <span class="ti-award-player-name">${name}</span>
      </span>`;
  }

  const MONTH_LABELS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function formatAwardMonth(ymKey) {
    const [y, m] = ymKey.split('-').map(Number);
    return isKorean ? `${m}월` : MONTH_LABELS_EN[m - 1];
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

    const motmHtml = motmKeys.map(key => {
      const weekNum = parseInt(key.replace('round', ''), 10);
      const weekLabel = isKorean ? `${weekNum}주차` : `Week ${weekNum}`;
      const playersHtml = teamAwards.motm[key].map(awardPlayerHtml).join('');
      return `
        <div class="ti-award-row">
          <span class="ti-award-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</span>
          <span class="ti-award-players">${playersHtml}</span>
        </div>`;
    }).join('');

    const potmKeys = Object.keys(teamAwards.playerOfTheMonth || {}).sort().reverse();
    const potmHtml = potmKeys.map(ymKey => {
      const [, mNum] = ymKey.split('-').map(Number);
      const monthLabelKo = `${mNum}월`;
      const monthLabelEn = MONTH_LABELS_EN[mNum - 1];
      const monthLabel = isKorean ? monthLabelKo : monthLabelEn;
      const playerHtml = awardPlayerHtml(teamAwards.playerOfTheMonth[ymKey]);
      return `
        <div class="ti-award-row">
          <span class="ti-award-week lbl" data-en="${monthLabelEn}" data-ko="${monthLabelKo}">${monthLabel}</span>
          <span class="ti-award-players">${playerHtml}</span>
        </div>`;
    }).join('');

    if (!motmHtml && !potmHtml) return '';

    return `
      <div class="ti-card ti-awards-card">
        <div class="ti-card-title lbl" data-en="Awards" data-ko="수상 정보">${isKorean ? '수상 정보' : 'Awards'}</div>
        ${potmHtml ? `
          <div class="ti-award-group">
            <div class="ti-award-group-title lbl" data-en="Player of the Month" data-ko="이달의 선수">${isKorean ? '이달의 선수' : 'Player of the Month'}</div>
            ${potmHtml}
          </div>` : ''}
        ${motmHtml ? `
          <div class="ti-award-group">
            <div class="ti-award-group-title lbl" data-en="Man of the Match" data-ko="맨 오브 더 매치">${isKorean ? '맨 오브 더 매치' : 'Man of the Match'}</div>
            ${motmHtml}
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
  function buildRecordCardHtml(t, rank, total) {
    const gpg = t.played > 0 ? (t.goalsFor / t.played).toFixed(1) : '0.0';
    const gapg = t.played > 0 ? (t.goalsAgainst / t.played).toFixed(1) : '0.0';
    const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : 'gd-zero');
    const { home, away } = computeHomeAwayRecord(t.nameEn, t.nameKo);
    const homeAwayValue = (rec) => `${rec.won}/${rec.played}${isKorean ? '승' : ' W'}`;

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

  function renderTeamResultsTab() {
    const el = document.getElementById('teamInfoResultsTab');
    if (!el) return;
    const info = getMyRankedTeam();

    let html = '';
    if (info) {
      html += `<div class="ti-next-mini">${nextMatchOpponentHtml(info.team, info.rank)}</div>`;
    }

    const roundKeys = completedRoundKeysIncludingScheduled();
    const totalRounds = roundKeys.length;

    roundKeys.slice().reverse().forEach((key, revIdx) => {
      const weekNum = totalRounds - revIdx;
      const matches = buildRoundMatches(key);
      const mine = matches.find(m => !m.isBye && (isMyTeamName(m.homeEn, m.homeKo) || isMyTeamName(m.awayEn, m.awayKo)));
      const byeMine = matches.find(m => m.isBye && isMyTeamName(m.teamEn, m.teamKo));
      if (!mine && !byeMine) return;

      const weekLabel = isKorean ? `${weekNum}주차` : `Week ${weekNum}`;

      if (byeMine) {
        html += `
          <div class="round-match-card round-bye-card">
            <span class="ti-result-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</span>
            <span class="round-bye-badge lbl" data-en="BYE" data-ko="휴식주">${isKorean ? '휴식주' : 'BYE'}</span>
          </div>`;
        return;
      }

      const m = mine;
      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;
      const isDraw = m.homeScore === m.awayScore;
      const iAmHome = isMyTeamName(m.homeEn, m.homeKo);
      const myResult = isDraw ? 'D' : ((iAmHome && homeWin) || (!iAmHome && awayWin) ? 'W' : 'L');
      const myResultClass = myResult === 'W' ? 'form-w' : (myResult === 'D' ? 'form-d' : 'form-l');
      const myResultLabelKo = myResult === 'W' ? '승' : (myResult === 'D' ? '무' : '패');
      const myResultLabel = isKorean ? myResultLabelKo : myResult;
      const homeLogo = getTeamLogo(m.homeEn);
      const awayLogo = getTeamLogo(m.awayEn);
      const homeName = isKorean ? m.homeKo : m.homeEn;
      const awayName = isKorean ? m.awayKo : m.awayEn;
      const noneLabel = isKorean ? '득점자 없음' : 'No scorers';
      const scorersHomeText = (m.scorersHome === '없음' || !m.scorersHome) ? noneLabel : m.scorersHome;
      const scorersAwayText = (m.scorersAway === '없음' || !m.scorersAway) ? noneLabel : m.scorersAway;

      html += `
        <div class="round-match-card my-team">
          <div class="ti-result-week lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${weekLabel}</div>
          <span class="form-badge ${myResultClass} ti-result-badge">${myResultLabel}</span>
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
          ${(matchLineups[key] || matchHighlights[key]) ? `
          <div class="rmc-btn-row">
            ${matchLineups[key] ? `<button class="rmc-detail-btn lbl" data-en="View Details" data-ko="상세보기" onclick="openMatchDetail('${key}', ${weekNum})">${isKorean ? '상세보기' : 'View Details'}</button>` : ''}
            ${matchHighlights[key] ? `<a class="rmc-highlight-btn lbl" data-en="Watch Highlights" data-ko="하이라이트 보기" href="${matchHighlights[key]}" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              ${isKorean ? '하이라이트 보기' : 'Watch Highlights'}
            </a>` : ''}
          </div>` : ''}
        </div>`;
    });

    el.innerHTML = `<div class="round-match-list ti-results-list">${html}</div>`;
    attachImageFallback();
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
      h2h: 'tiH2hBtn',
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
    const sections = ['overview', 'record', 'squad', 'h2h', 'results']
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

  function renderTeamInfoView() {
    renderTeamInfoHeader();
    renderTeamInfoOverview();
    renderTeamRecordTab();
    renderTeamH2HTab();
    renderTeamStaffTab();
    renderSquadView();
    renderTeamResultsTab();
    setActiveTeamInfoButton(currentTeamInfoTab);
    setupTeamInfoScrollSpy();
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
        kickoffDate: m.kickoffDate, kickoffTime: m.kickoffTime
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

  function renderRoundsView() {
    const tabBar = document.getElementById('roundTabBar');
    const roundKeys = allRoundKeysIncludingScheduled();

    if (!currentRoundKey || !(roundsData[currentRoundKey] || (scheduledRounds && scheduledRounds[currentRoundKey]))) {
      currentRoundKey = latestRoundWithResult();
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
              <span class="rmc-pending-badge lbl" data-en="Upcoming" data-ko="경기 시작 전">${isKorean ? '경기 시작 전' : 'Upcoming'}</span>
            </div>
            <div class="rmc-team rmc-away">
              <span class="lbl" data-en="${m.awayEn}" data-ko="${m.awayKo}">${awayName}</span>
              ${awayLogo ? `<img class="team-logo-sm" src="${awayLogo}" alt="${m.awayEn}">` : ''}
            </div>
          </div>
          ${kickoffTxt ? `<div class="rmc-kickoff">${kickoffTxt}</div>` : ''}
          ${venueCaptionHtml(m.homeEn)}
        `;
        listEl.appendChild(card);
        return;
      }

      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;

      const noneLabel = isKorean ? '득점자 없음' : 'No scorers';
      const scorersHomeText = (m.scorersHome === '없음' || !m.scorersHome) ? noneLabel : m.scorersHome;
      const scorersAwayText = (m.scorersAway === '없음' || !m.scorersAway) ? noneLabel : m.scorersAway;

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

    const roundKeys = Object.keys(roundsData).sort((a, b) => {
      const na = parseInt(a.replace('round', ''), 10);
      const nb = parseInt(b.replace('round', ''), 10);
      return na - nb;
    });

    roundKeys.forEach(roundKey => {
      roundsData[roundKey].forEach(m => {
        if (m.byeKo || m.byeEn) return;
        if (!m.homeEn || !m.awayEn) return;

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

  // ===== 팀 순위 렌더링 (League Table) =====
  function renderLeagueTable() {
    const processedData = getRankedTeams();

    // 순위 변동 표시는 '전체' 순위표 기준으로만 의미가 있으므로(홈/원정 분할표는
    // 전주 순위와 직접 비교할 대상이 없음) 필터가 'all'일 때만 계산합니다.
    const showRankChange = currentRankFilter === 'all';
    const previousRanks = showRankChange ? getPreviousRoundRanks() : null;
    const playedTeams = showRankChange ? getCurrentRoundPlayedTeams() : null;

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
        nextMatchHtml = `
          <span class="next-opp-inner">
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
        <td class="team">
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

      return {
        nameKo: team.nameKo,
        nameEn: team.nameEn,
        logoSrc: team.logoSrc,
        played: team.played,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalsForPerGame: team.played > 0 ? team.goalsFor / team.played : 0,
        goalsAgainstPerGame: team.played > 0 ? team.goalsAgainst / team.played : 0,
        cleanSheets: team.cleanSheets,
        failedToScore: team.failedToScore,
        pts: pts,
        ppg: team.played > 0 ? pts / team.played : 0,
        pythagPoints: pythagPoints,
        pythagDiff: pts - pythagPoints,
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
    renderStatsTable('streakWinBody', statsData.streakWin.slice(0, 5), 'streakWin');
    renderStatsTable('streakLossBody', statsData.streakLoss.slice(0, 5), 'streakLoss');
    renderStatsTable('streakDrawBody', statsData.streakDraw.slice(0, 5), 'streakDraw');
    renderStatsTable('streakUnbeatenBody', statsData.streakUnbeaten.slice(0, 5), 'streakUnbeaten');
    renderStatsTable('streakScoringBody', statsData.streakScoring.slice(0, 5), 'streakScoring');
    renderStatsTable('streakConcedingBody', statsData.streakConceding.slice(0, 5), 'streakConceding');

    renderScatterPlot(teams);
  }


  // ===== SVG 차트 - 공통 헬퍼 (Chart Helpers) =====
  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }


  // ===== SVG 차트 - 공격/수비 산점도 (Scatter Plot) =====
  function renderScatterPlot(teams) {
    const svg = document.getElementById('scatterSvg');
    if (!svg) return;
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
      { x: avgX, y: avgY, w: margin.left + plotW - avgX, h: margin.top + plotH - avgY, fill: ct.qua
