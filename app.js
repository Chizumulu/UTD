  // ===== 전역 상태 (Global State) =====
  let isKorean = true;
  let currentView = 'rank';
  let currentTeamInfoTab = 'overview';
  let statsData = {};
  let currentModalType = null;
  let currentPlayerModalKey = null;

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

  // leagueData, topScorersData, SEASON_START, ROUND_DATE 등은 data.js 파일에서 불러옵니다.


  // ===== 화면 전환 (View Switching) =====
  function showView(view) {
    currentView = view;
    const rankView = document.getElementById('rankView');
    const squadView = document.getElementById('squadView');
    const roundsView = document.getElementById('roundsView');
    const statsView = document.getElementById('statsView');
    const scorersView = document.getElementById('scorersView');
    const predictView = document.getElementById('predictView');
    const rankBtn = document.getElementById('viewRankBtn');
    const squadBtn = document.getElementById('viewSquadBtn');
    const roundsBtn = document.getElementById('viewRoundsBtn');
    const statsBtn = document.getElementById('viewStatsBtn');
    const scorersBtn = document.getElementById('viewScorersBtn');
    const predictBtn = document.getElementById('viewPredictBtn');

    rankView.style.display = 'none';
    squadView.style.display = 'none';
    roundsView.style.display = 'none';
    statsView.style.display = 'none';
    scorersView.style.display = 'none';
    predictView.style.display = 'none';
    rankBtn.classList.remove('active');
    squadBtn.classList.remove('active');
    roundsBtn.classList.remove('active');
    statsBtn.classList.remove('active');
    scorersBtn.classList.remove('active');
    predictBtn.classList.remove('active');

    if (view === 'squad') {
      squadView.style.display = '';
      squadBtn.classList.add('active');
      renderTeamInfoView();
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
    } else {
      rankView.style.display = '';
      rankBtn.classList.add('active');
    }
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

  // ===== 팀 정보 허브 (Team Info Hub: 팀정보/기록/선수단/경기결과) =====
  function getMyRankedTeam() {
    const ranked = getRankedTeams();
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

  function nextMatchOpponentHtml(team, myRank) {
    if (team.nextMatch.isBye) {
      return `
        <div class="ti-next-match ti-next-bye">
          <span class="lbl" data-en="Bye week — no match this round" data-ko="이번 라운드는 휴식주입니다">이번 라운드는 휴식주입니다</span>
        </div>`;
    }
    const ranked = getRankedTeams();
    const oppIdx = ranked.findIndex(rt => rt.nameEn === team.nextMatch.oppEn);
    const oppRank = oppIdx !== -1 ? oppIdx + 1 : null;
    const rankBadge = (r) => r ? `<span class="ti-next-match-rank">${isKorean ? r + '위' : '#' + r}</span>` : '';

    const haClass = team.nextMatch.homeAway === 'H' ? 'ha-home' : 'ha-away';
    const oppName = isKorean ? team.nextMatch.oppKo : team.nextMatch.oppEn;
    const nextWeek = sortedRoundKeys().length + 1;
    return `
      <div class="ti-next-match">
        <div class="ti-next-match-label lbl" data-en="Next Match · Week ${nextWeek}" data-ko="다음 경기 · ${nextWeek}주차">다음 경기 · ${nextWeek}주차</div>
        <div class="ti-next-match-body">
          <div class="ti-next-match-team">
            <img class="team-logo" src="./dd.svg" alt="Chizumulu United FC">
            <span class="lbl" data-en="Chizumulu United FC" data-ko="치주물루 유나이티드 FC">치주물루 유나이티드 FC</span>
            ${rankBadge(myRank)}
          </div>
          <div class="ti-next-match-vs">
            <span class="ha-badge ${haClass}">${team.nextMatch.homeAway}</span>
            <span class="ti-next-match-vs-text">VS</span>
          </div>
          <div class="ti-next-match-team">
            <img class="team-logo" data-en-name="${team.nextMatch.oppEn}" data-ko-name="${team.nextMatch.oppKo}" src="${team.nextMatch.oppLogo}" alt="${team.nextMatch.oppEn}">
            <span class="lbl" data-en="${team.nextMatch.oppEn}" data-ko="${team.nextMatch.oppKo}">${oppName}</span>
            ${rankBadge(oppRank)}
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
    const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : 'gd-zero');

    let formHtml = '';
    t.form.forEach(f => {
      const fClass = f === 'W' ? 'form-w' : (f === 'D' ? 'form-d' : 'form-l');
      formHtml += `<span class="form-badge ${fClass}">${f}</span>`;
    });

    el.innerHTML = `
      <div class="ti-overview-grid">
        <div class="ti-card ti-next-match-card">
          ${nextMatchOpponentHtml(t, info.rank)}
        </div>
        <div class="ti-card ti-form-card">
          <div class="ti-card-title lbl" data-en="Recent Form" data-ko="최근 경기력">최근 경기력</div>
          <div class="form-cell ti-form-badges">${formHtml}</div>
          <div class="ti-mini-stats">
            <div class="ti-mini-stat">
              <span class="ti-mini-num">${t.goalsFor}</span>
              <span class="ti-mini-label lbl" data-en="Goals For" data-ko="득점">득점</span>
            </div>
            <div class="ti-mini-stat">
              <span class="ti-mini-num">${t.goalsAgainst}</span>
              <span class="ti-mini-label lbl" data-en="Goals Against" data-ko="실점">실점</span>
            </div>
            <div class="ti-mini-stat">
              <span class="ti-mini-num ${gdClass}">${t.gd > 0 ? '+' : ''}${t.gd}</span>
              <span class="ti-mini-label lbl" data-en="Goal Diff" data-ko="득실차">득실차</span>
            </div>
          </div>
        </div>
      </div>
    `;
    attachImageFallback();
  }

  function renderTeamRecordTab() {
    const el = document.getElementById('teamInfoRecordTab');
    if (!el) return;
    const info = getMyRankedTeam();
    if (!info) { el.innerHTML = ''; return; }
    const t = info.team;
    const gpg = t.played > 0 ? (t.goalsFor / t.played).toFixed(1) : '0.0';
    const gapg = t.played > 0 ? (t.goalsAgainst / t.played).toFixed(1) : '0.0';
    const gdClass = t.gd > 0 ? 'gd-pos' : (t.gd < 0 ? 'gd-neg' : 'gd-zero');

    const rows = [
      { ko: '승점', en: 'PTS', value: `<span class="pts">${t.pts}</span>` },
      { ko: '경기', en: 'PLAYED', value: t.played },
      { ko: '승-무-패', en: 'W-D-L', value: `${t.won}-${t.drawn}-${t.lost}` },
      { ko: '득점', en: 'GOALS FOR', value: t.goalsFor },
      { ko: '실점', en: 'GOALS AGAINST', value: t.goalsAgainst },
      { ko: '득실차', en: 'GOAL DIFF', value: `<span class="${gdClass}">${t.gd > 0 ? '+' : ''}${t.gd}</span>` },
      { ko: '경기당 득점', en: 'GOALS / GAME', value: gpg },
      { ko: '경기당 실점', en: 'CONCEDED / GAME', value: gapg },
      { ko: '무실점 경기', en: 'CLEAN SHEETS', value: t.cleanSheets },
      { ko: '무득점 경기', en: 'FAILED TO SCORE', value: t.failedToScore }
    ];

    el.innerHTML = `
      <div class="ti-record-card">
        <div class="ti-record-rank">
          <span class="ti-record-rank-num">${info.rank}</span>
          <span class="ti-record-rank-label lbl" data-en="of ${info.total} teams" data-ko="위 (총 ${info.total}팀)">위 (총 ${info.total}팀)</span>
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

  function renderTeamResultsTab() {
    const el = document.getElementById('teamInfoResultsTab');
    if (!el) return;
    const info = getMyRankedTeam();

    let html = '';
    if (info) {
      html += `<div class="ti-next-mini">${nextMatchOpponentHtml(info.team, info.rank)}</div>`;
    }

    const roundKeys = sortedRoundKeys();
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
            <span class="round-bye-badge lbl" data-en="BYE" data-ko="휴식주">휴식주</span>
          </div>`;
        return;
      }

      const m = mine;
      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;
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
    const sections = ['overview', 'record', 'squad', 'results']
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
    renderSquadView();
    renderTeamResultsTab();
    setActiveTeamInfoButton(currentTeamInfoTab);
    setupTeamInfoScrollSpy();
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

        let badge = '';
        if (p.isCaptain) {
          badge = `<span class="squad-band squad-band-c" title="${isKorean ? '주장' : 'Captain'}">C</span>`;
        } else if (p.isViceCaptain) {
          badge = `<span class="squad-band squad-band-vc" title="${isKorean ? '부주장' : 'Vice-Captain'}">VC</span>`;
        }

        const playerName = isKorean ? p.nameKo : p.nameEn;

        card.innerHTML = `
          <div class="squad-card-number">${p.number}</div>
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

  function buildRoundMatches(roundKey) {
    const matches = roundsData[roundKey] || [];
    const details = matchDetails[roundKey] || [];
    let detailIdx = 0;
    return matches.map(m => {
      if (m.byeKo || m.byeEn) {
        return { isBye: true, teamKo: m.byeKo, teamEn: m.byeEn };
      }
      const d = details[detailIdx] || {};
      detailIdx++;
      return {
        isBye: false,
        homeKo: m.homeKo, homeEn: m.homeEn, awayKo: m.awayKo, awayEn: m.awayEn,
        homeScore: m.homeScore, awayScore: m.awayScore,
        scorersHome: d.scorersHome, scorersAway: d.scorersAway
      };
    });
  }

  function isMyTeamName(nameEn, nameKo) {
    return nameEn === 'Chizumulu United FC' || nameKo === '치주물루 유나이티드 FC';
  }

  function renderRoundsView() {
    const tabBar = document.getElementById('roundTabBar');
    const roundKeys = sortedRoundKeys();

    if (!currentRoundKey || !roundsData[currentRoundKey]) {
      currentRoundKey = roundKeys[roundKeys.length - 1];
    }

    tabBar.innerHTML = '';
    roundKeys.forEach((key, idx) => {
      const weekNum = idx + 1;
      const btn = document.createElement('button');
      btn.className = 'round-tab-btn' + (key === currentRoundKey ? ' active' : '');
      btn.innerHTML = `<span class="lbl" data-en="Week ${weekNum}" data-ko="${weekNum}주차">${isKorean ? weekNum + '주차' : 'Week ' + weekNum}</span>`;
      btn.onclick = () => { currentRoundKey = key; renderRoundsView(); };
      tabBar.appendChild(btn);
    });

    const listEl = document.getElementById('roundMatchList');
    listEl.innerHTML = '';

    const matches = buildRoundMatches(currentRoundKey);

    matches.forEach(m => {
      if (m.isBye) {
        const card = document.createElement('div');
        card.className = 'round-match-card round-bye-card';
        const logo = getTeamLogo(m.teamEn);
        const teamName = isKorean ? m.teamKo : m.teamEn;
        card.innerHTML = `
          ${logo ? `<img class="team-logo-sm" src="${logo}" alt="${m.teamEn}">` : ''}
          <span class="lbl" data-en="${m.teamEn}" data-ko="${m.teamKo}">${teamName}</span>
          <span class="round-bye-badge lbl" data-en="BYE" data-ko="휴식주">휴식주</span>
        `;
        listEl.appendChild(card);
        return;
      }

      const mine = isMyTeamName(m.homeEn, m.homeKo) || isMyTeamName(m.awayEn, m.awayKo);
      const homeWin = m.homeScore > m.awayScore;
      const awayWin = m.awayScore > m.homeScore;
      const homeLogo = getTeamLogo(m.homeEn);
      const awayLogo = getTeamLogo(m.awayEn);
      const homeName = isKorean ? m.homeKo : m.homeEn;
      const awayName = isKorean ? m.awayKo : m.awayEn;

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

      tr.innerHTML = `
        <td class="rank-cell">${displayRank}</td>
        <td class="team"><span class="lbl player-name-link" data-en="${player.nameEn}" data-ko="${player.nameKo}" data-player-key="${player.key}">${playerName}</span></td>
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
  }


  // 승점·득실차 계산 후 정렬된 순위표를 반환 (테이블 렌더링과 이미지 내보내기가 공용으로 사용)
  function getRankedTeams() {
    const processedData = leagueData.map(team => {
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

  // ===== 팀 순위 렌더링 (League Table) =====
  function renderLeagueTable() {
    const processedData = getRankedTeams();

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
      team.form.forEach(f => {
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

      tr.innerHTML = `
        <td class="rank-cell">${rank}</td>
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
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 13px "Segoe UI", "Noto Sans KR", Arial, sans-serif';
      ctx.fillText([weekText, dateText].filter(Boolean).join('  ·  '), 24, 92);

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


  // ===== 팀 기록 통계 (Team Records / Stats) =====
  function collectTeamStats() {
    return leagueData.map(team => {
      const pts = (team.won * 3) + (team.drawn * 1);
      const denom = Math.pow(team.goalsFor, 1.072388) + Math.pow(team.goalsAgainst, 1.127248);
      const pythagPoints = (team.played > 0 && denom > 0)
        ? (Math.pow(team.goalsFor, 1.122777) / denom) * 2.499973 * team.played
        : 0;
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
        pythagDiff: pts - pythagPoints
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

    renderStatsTable('scoreBody', statsData.goalsFor.slice(0, 5), 'goalsFor');
    renderStatsTable('concedeBody', statsData.goalsAgainst.slice(0, 5), 'goalsAgainst');
    renderStatsTable('csBody', statsData.cs.slice(0, 5), 'cs');
    renderStatsTable('ftsBody', statsData.fts.slice(0, 5), 'fts');
    renderStatsTable('ppgBody', statsData.ppg.slice(0, 5), 'ppg');
    renderStatsTable('pythagBody', statsData.pythag.slice(0, 5), 'pythag');

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

    points.forEach(p => {
      const g = svgEl('g', {});
      const clipId = 'scatterClip-' + p.idx;

      const clipPath = svgEl('clipPath', { id: clipId });
      clipPath.appendChild(svgEl('circle', { cx: p.cx, cy: p.cy, r: p.r - 1.5 }));
      defs.appendChild(clipPath);

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
        stroke: p.ringColor, 'stroke-width': p.isMine ? 3 : 2
      });

      const title = svgEl('title', {});
      const name = isKorean ? p.team.nameKo : p.team.nameEn;
      title.textContent = `${name} — ${isKorean ? '경기당 득점' : 'GF/g'}: ${p.team.goalsForPerGame.toFixed(2)}, ${isKorean ? '경기당 실점' : 'GA/g'}: ${p.team.goalsAgainstPerGame.toFixed(2)}`;

      g.appendChild(img);
      g.appendChild(ring);
      g.appendChild(title);
      svg.appendChild(g);

      if (Math.abs(p.ly - (p.cy + 3.5)) > 4 || Math.abs(p.lx - (p.cx + p.r + 5)) > 4) {
        svg.appendChild(svgEl('line', {
          x1: p.cx + p.r, y1: p.cy, x2: p.lx - 2, y2: p.ly - 3,
          stroke: ct.guideLine, 'stroke-width': 0.8
        }));
      }

      const label = svgEl('text', {
        x: p.lx, y: p.ly,
        class: p.isMine ? 'scatter-dot-label-mine' : 'scatter-dot-label'
      });
      label.textContent = p.labelText;
      svg.appendChild(label);
    });
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
  }


  // ===== 날짜 / 시즌 정보 유틸 (Date & Season Utils) =====
  function getMalawiToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Blantyre', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return new Date(`${y}-${m}-${d}T00:00:00`);
  }

  function updateSeasonInfo() {
    const today = getMalawiToday();
    const start = new Date(`${SEASON_START}T00:00:00`);
    const diffDays = Math.floor((today - start) / 86400000);
    const week = Math.max(1, Math.floor(diffDays / 7) + 1);
    const roundDate = new Date(`${ROUND_DATE}T00:00:00`);

    const weekEl = document.getElementById('weekLabel');
    const dateEl = document.getElementById('dateLabel');
    if (weekEl) weekEl.textContent = isKorean ? `${week}주차` : `Week ${week}`;
    if (dateEl) {
      dateEl.textContent = isKorean
        ? `${roundDate.getFullYear()}년 ${roundDate.getMonth() + 1}월 ${roundDate.getDate()}일`
        : roundDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    } else if (currentView === 'squad') {
      renderTeamInfoView();
    } else if (currentView === 'rounds') {
      renderRoundsView();
    }

    if (currentPlayerModalKey) {
      openPlayerModal(currentPlayerModalKey);
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
  
    document.querySelectorAll('.lbl').forEach(el => {
      el.innerHTML = el.getAttribute('data-ko');
    });
    document.getElementById('langBtnText').textContent = 'View in English';

    applyTheme(isDarkTheme() ? 'dark' : 'light');
    
    attachImageFallback();

    updateSeasonInfo();
    equalizeTitleLines();
    setInterval(updateSeasonInfo, 60 * 60 * 1000); 
    window.addEventListener('resize', equalizeTitleLines);

    showDisclaimerIfNeeded();
  });
