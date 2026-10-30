// ===== 치체와어(Chichewa, ny) 번역 레이어 — 단일 파일 =====
// 주소 뒤에 ?lang=ny 를 붙여 들어오면 활성화됩니다. (예: https://chizumulu.github.io/UTD/?lang=ny)
// 앱은 영문(isKorean=false) 모드로 그려지고, 이 파일이 화면에 나온 영어 문구를 치체와어로 바꿔치기합니다.
//
// 파일 구성 (위에서 아래로):
//   [A] 엔진          : 활성화 조건, DOM 번역기(MutationObserver)
//   [B] 기본 사전     : 메뉴·표 머리글·버튼 등 짧은 문구   → 고칠 때: DICT
//   [C] 사전 1        : index.html 안내문·섹션 설명문       → 고칠 때: 이 구역의 D
//   [D] 사전 2        : app.js 고정 문구·지표 설명문        → 고칠 때: 이 구역의 D
//   [E] 패턴 규칙     : 숫자·팀 이름이 섞인 조립 문장       → 고칠 때: 이 구역의 P
//   [F] 리포트 본문   : 경기 리포트·예측 코멘트의 긴 문장 80개  → 고칠 때: R('영어 정규식', '치체와어 $1 $2') 한 줄
// 번역 추가: 사전은 "영어 원문": "치체와어" 한 줄, 조립 문장은 [정규식, 치환] 한 줄을 추가하세요.
// (앱 코드는 수정할 필요 없습니다.)
// ===== 치체와어(Chichewa, ny) 번역 레이어 =====
// 주소 뒤에 ?lang=ny 를 붙여 들어오면 활성화됩니다. (예: https://chizumulu.github.io/UTD/?lang=ny)
// 앱은 영문(isKorean=false) 모드로 그려지고, 이 파일이 화면에 나온 영어 문구를 치체와어로 바꿔치기합니다.
// 번역을 늘리려면 아래 DICT에 "영어 원문": "치체와어" 한 줄만 추가하면 됩니다. (앱 코드는 수정 불필요)
// ===== 숨은 기능: 로고를 연속 7번 누르면 치체와어 버전으로 이동 =====
// 치체와어는 주소의 ?lang=ny 로만 켜지므로, 7번째 탭에서 그 주소로 이동(새로고침)합니다.
// 이미 치체와어 화면이면 같은 동작으로 기본(한국어) 화면으로 돌아옵니다. (#/league 같은 화면 경로는 유지)
// 탭 사이 간격이 TAP_GAP_MS(1.5초)를 넘으면 횟수가 0부터 다시 시작합니다.
(function () {
  var NEED_TAPS = 7, TAP_GAP_MS = 1500, taps = 0, last = 0;
  function isNy() {
    try { var q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); return q === 'ny' || q === 'chichewa'; }
    catch (e) { return false; }
  }
  function go() {
    try {
      var u = new URL(location.href);
      if (isNy()) u.searchParams.delete('lang'); else u.searchParams.set('lang', 'ny');
      location.href = u.href;
    } catch (e) {}
  }
  function prepare() { // 연속 탭이 '더블탭 확대'로 먹히지 않게
    var els = document.querySelectorAll('.club-logo');
    for (var i = 0; i < els.length; i++) { els[i].style.touchAction = 'manipulation'; els[i].style.webkitUserSelect = 'none'; els[i].style.userSelect = 'none'; }
  }
  prepare();
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('.club-logo')) return;
    var now = Date.now();
    taps = (now - last > TAP_GAP_MS) ? 1 : taps + 1;
    last = now;
    if (taps >= NEED_TAPS) { taps = 0; go(); }
  });
})();

// ===== 말라위 접속자에게 치체와어 버전 안내 팝업 =====
// 판별: 외부 요청 없이 브라우저 정보만 사용 (개인정보 수집 없음)
//   1) 기기 시간대가 Africa/Blantyre (말라위 전용 시간대)
//   2) 브라우저 언어에 ny(치체와어) 또는 -MW(말라위) 지역이 포함
// 표시 안 하는 경우: 이미 치체와어 화면 / 주소에 ?lang= 을 직접 지정 / 이전에 닫은 뒤 30일 이내
(function () {
  var KEY = 'nyPromptDismissedAt', HIDE_DAYS = 30;
  function isMalawi() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz === 'Africa/Blantyre') return true;
    } catch (e) {}
    try {
      var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
      for (var i = 0; i < langs.length; i++) {
        var l = String(langs[i] || '').toLowerCase();
        if (l === 'ny' || l.indexOf('ny-') === 0 || /-mw$/.test(l)) return true;
      }
    } catch (e) {}
    return false;
  }
  function hasLangParam() {
    try { return new URLSearchParams(location.search).has('lang'); } catch (e) { return false; }
  }
  function recentlyDismissed() {
    try {
      var t = parseInt(localStorage.getItem(KEY) || '0', 10);
      return t && (Date.now() - t) < HIDE_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function remember() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }

  if (hasLangParam() || recentlyDismissed() || !isMalawi()) return;

  function show() {
    if (document.getElementById('nyPromptOverlay')) return;
    var css = document.createElement('style');
    css.textContent =
      '#nyPromptOverlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,12,32,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:nyFade .2s ease}' +
      '#nyPromptBox{width:100%;max-width:380px;padding:22px 20px 18px;border-radius:18px;background:linear-gradient(160deg,#0b3a8f,#06245f);color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);font-family:inherit;text-align:center}' +
      '#nyPromptBox h2{margin:0 0 6px;font-size:18px;font-weight:800;line-height:1.3}' +
      '#nyPromptBox p{margin:0 0 4px;font-size:14px;line-height:1.45;color:rgba(238,242,251,.92)}' +
      '#nyPromptBox p.ny-en{font-size:12.5px;color:rgba(238,242,251,.65);margin-bottom:16px}' +
      '#nyPromptBox button{display:block;width:100%;min-height:44px;margin-top:8px;border:none;border-radius:999px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}' +
      '#nyPromptGo{background:#fff;color:#0b3a8f}' +
      '#nyPromptNo{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25)!important}' +
      '@keyframes nyFade{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(css);

    var ov = document.createElement('div');
    ov.id = 'nyPromptOverlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'nyPromptTitle');
    ov.innerHTML =
      '<div id="nyPromptBox">' +
        '<h2 id="nyPromptTitle">Takulandirani! \uD83C\uDDF2\uD83C\uDDFC</h2>' +
        '<p>Mukufuna kuwerenga tsambali m\u2019Chichewa?</p>' +
        '<p class="ny-en">Would you like to view this site in Chichewa?</p>' +
        '<button type="button" id="nyPromptGo">Inde, Chichewa / Yes, Chichewa</button>' +
        '<button type="button" id="nyPromptNo">Ayi, zikomo / No, thanks</button>' +
      '</div>';
    document.body.appendChild(ov);

    function close() {
      remember();
      document.removeEventListener('keydown', onKey);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.getElementById('nyPromptNo').addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.getElementById('nyPromptGo').addEventListener('click', function () {
      try {
        var u = new URL(location.href);
        u.searchParams.set('lang', 'ny');
        location.href = u.href; // 현재 화면 경로(#/league 등)는 유지
      } catch (e) { location.search = '?lang=ny'; }
    });
    try { document.getElementById('nyPromptGo').focus(); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(show, 600); });
  else setTimeout(show, 600);
})();

(function () {
  // [A] 엔진 + [B] 기본 사전
  var q = '';
  try { q = (new URLSearchParams(location.search).get('lang') || '').toLowerCase(); } catch (e) {}
  if (q !== 'ny' && q !== 'chichewa') return;

  document.documentElement.setAttribute('lang', 'ny');
  window.IS_CHICHEWA = true;

  // 언어 버튼: 치체와어 화면에서는 "View in English" 로 보이고, 누르면 영문 버전(?lang=en)으로 이동합니다.
  // (영문 화면에서는 app.js 기본 동작대로 "한국어로 보기" 버튼이 그대로 나옵니다.)
  (function () {
    var LABEL = 'View in English';
    function fixLabel() {
      var el = document.getElementById('langBtnText');
      if (el && el.textContent !== LABEL) el.textContent = LABEL;
    }
    // app.js가 isKorean=false 라서 "한국어로 보기"로 덮어쓰므로, 바뀔 때마다 다시 맞춥니다.
    function watchLabel() {
      var el = document.getElementById('langBtnText');
      if (!el) return;
      fixLabel();
      new MutationObserver(fixLabel).observe(el, { childList: true, characterData: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchLabel);
    else watchLabel();

    // app.js의 toggleLang()(한/영 토글)이 실행되지 않도록 캡처 단계에서 가로채 영문 주소로 이동합니다.
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest || !t.closest('#langBtn')) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        var u = new URL(location.href);
        u.searchParams.set('lang', 'en');
        location.href = u.href; // #/league 같은 화면 경로는 유지됩니다
      } catch (err) {}
    }, true);
  })();

  var DICT = {
    // --- 메뉴 / 탭 ---
    'Main': 'Tsamba Lalikulu', 'Club Info': 'Za Gulu', 'League Ranking': 'Udindo mu Ligi',
    'Weekly Standings': 'Udindo wa Sabata', 'Weekly Report': 'Lipoti la Sabata', 'Top Scorers': 'Osewera Opambana Zigoli',
    'Team Compare': 'Kuyerekeza Matimu', 'Team Comparison': 'Kuyerekeza Matimu', 'Match Projections': 'Zoneneratu za Masewera',
    'League Schedule': 'Ndandanda ya Ligi', 'League Records': 'Zolemba za Ligi', 'Postponed Matches': 'Masewera Osinthidwa',
    'Cup': 'Chikho', 'Community': 'Gulu la Anthu', 'Club Venues': 'Mabwalo a Magulu', 'Squad': 'Osewera',
    'Chizumulu United FC': 'Chizumulu United FC', 'Table': 'Tebulo', 'Results': 'Zotsatira', 'Report': 'Lipoti', 'Record': 'Mbiri',
    // --- 표 머리글 ---
    'RANK': 'MALO', 'TEAM': 'TIMU', 'TEAMS': 'MATIMU', 'P': 'MS', 'W': 'W', 'D': 'D', 'L': 'L', 'F': 'ZP', 'A': 'ZL',
    'GD': 'KK', 'PTS': 'MAP', 'WK': 'SBT', 'CHG': 'SINTHA', 'ALL': 'ZONSE', 'Total': 'Chiwerengero', 'Total Goals': 'Zigoli Zonse',
    'SCORE': 'ZIGOLI', 'TITLE': 'CHIKHO', 'TITLE %': 'CHIKHO %', 'TOP 3 %': 'ATATU OYAMBA %', 'SAFETY': 'CHITETEZO', 'TEAM A': 'TIMU A', 'TEAM B': 'TIMU B',
    // --- 버튼 / 안내 ---
    'Share': 'Gawana', 'See more': 'Onani zambiri', 'Show details': 'Onetsani zambiri', 'View Larger': 'Onani Chachikulu',
    'View Full Ranking': 'Onani Udindo Wonse', 'View full standings': 'Onani Udindo Wonse', 'View weekly standings': 'Onani Udindo wa Sabata',
    'View Cup': 'Onani Chikho', 'Save as Image': 'Sungani ngati Chithunzi', 'Save as app': 'Sungani ngati App', 'Add to Home Screen': 'Onjezani pa Sikilini Yoyamba',
    'Set up alerts': 'Yatsani zidziwitso', 'Set up match alerts?': 'Mukufuna zidziwitso za masewera?', 'Turn off alerts': 'Zimitsani zidziwitso',
    'Turn off match alerts?': 'Zimitsani zidziwitso za masewera?', 'Refresh connection': 'Yambitsaninso intaneti', 'Jump to Team': 'Pitani ku Timu',
    'Tap a column header to sort': 'Dinani mutu wa mzati kuti musankhe', '\u2039 Prev season': '\u2039 Nyengo yapitayi',
    'Running simulation...': 'Tikuyerekeza masewera...',
    // --- 섹션 제목 ---
    'Upcoming Fixtures': 'Masewera Akubwera', 'Recent Matches': 'Masewera Aposachedwa', 'Season Stats': 'Ziwerengero za Nyengo',
    'Season Highlights': 'Zofunika za Nyengo', 'Season Form': 'Kachitidwe ka Nyengo', 'Team Records': 'Zolemba za Timu', 'Scoring Matches': 'Masewera Opambana Zigoli',
    'Starts / Subs': 'Oyamba / Olowa m\u2019malo', 'Relegated': 'Atsika Gawo', 'Released / Contract Terminated': 'Amasulidwa / Mgwirizano Watha',
    'WHAT-IF SIMULATOR': 'KUYESA KUTI \u201CBWANJI\u201D', 'WHAT IF': 'BWANJI BAS', 'TRACK RECORD': 'MBIRI YA ZONENERATU',
    'TITLE PROBABILITY TREND': 'KUKWERA KWA MWAYI WOPAMBANA CHIKHO', 'SCENARIO TABLE': 'TEBULO LA ZOCHITIKA', 'SCORING PACE': 'LIPOTI LA ZIGOLI', 'STORY': 'NKHANI',
    // --- 요일 / 월 ---
    'Mon': 'Lolemba', 'Tue': 'Lachiwiri', 'Wed': 'Lachitatu', 'Thu': 'Lachinayi', 'Fri': 'Lachisanu', 'Sat': 'Loweruka', 'Sun': 'Lamulungu',
    'Jan': 'Jan', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Epu', 'May': 'Mei', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago', 'Sep': 'Sep', 'Oct': 'Okt', 'Nov': 'Nov', 'Dec': 'Dis'
  };

  // 숫자가 들어가는 문구용 패턴 (필요한 만큼 추가)
  window.NY_DICT = DICT;
  window.NY_PATTERNS = null; // 아래 PATTERNS 와 같은 배열 (lang-ny-ext3.js 가 패턴을 추가) // lang-ny-ext.js 등 확장 사전이 여기에 합쳐집니다.

  var PATTERNS = [
    [/^Round (\d+)$/i, 'Gawo $1'], [/^Week (\d+)$/i, 'Sabata $1'], [/^Matchweek (\d+)$/i, 'Sabata la Masewera $1'],
    [/^(\d+) wins?$/i, 'Zopambana $1'], [/^(\d+) draws?$/i, 'Zofanana $1'], [/^(\d+) loss(?:es)?$/i, 'Zolephera $1'],
    [/^(\d+) pts?$/i, 'Mapointi $1'], [/^(\d+) goals?$/i, 'Zigoli $1'], [/^(\d+)(?:st|nd|rd|th)$/i, 'Wa $1']
  ];

  window.NY_PATTERNS = PATTERNS;

  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  var written = new WeakMap();

  // 따옴표(’)·공백 차이가 있어도 찾을 수 있도록 정규화한 사전을 start()에서 만듭니다.
  var NORM = null;
  function norm(x) { return x.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim(); }
  function tr(s) {
    var core = s.trim();
    if (!core) return null;
    var nc = norm(core);
    var out = (NORM && NORM.hasOwnProperty(nc)) ? NORM[nc] : null;
    if (out === null) {
      for (var i = 0; i < PATTERNS.length; i++) {
        if (PATTERNS[i][0].test(nc)) { out = nc.replace(PATTERNS[i][0], PATTERNS[i][1]); break; }
      }
    }
    if (out === null || out === core) return null;
    return s.replace(core, out);
  }

  // 패턴 치환 함수 안에서 조각 문구(팀 이름 주변 단어 등)를 번역할 때 씁니다.
  window.NY_T = function (x) { var r = tr(String(x)); return r === null ? x : r; };

  function doText(node) {
    var v = node.nodeValue;
    if (written.get(node) === v) return;
    var t = tr(v);
    if (t !== null) { node.nodeValue = t; written.set(node, t); }
  }

  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute && el.getAttribute(ATTRS[i]);
      if (v) { var t = tr(v); if (t !== null) el.setAttribute(ATTRS[i], t); }
    }
  }

  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return;
    doAttrs(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else if (n.tagName !== 'SCRIPT' && n.tagName !== 'STYLE') doAttrs(n);
    }
  }

  function start() {
    NORM = {};
    for (var k in DICT) if (DICT.hasOwnProperty(k)) NORM[norm(k)] = DICT[k];
    walk(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ============================================================
  // [C] 사전 1 — index.html 안내문·섹션 설명문
  // ============================================================
  (function () {
    if (!window.NY_DICT) return;
    var D = {
      // --- 알림 / 설치 안내 ---
      'Get alerts one hour before kickoff, for goals, and at full time. Continue to allow browser notifications.':
        'Mudzalandira zidziwitso ola limodzi masewera asanayambe, zigoli zikapezeka, komanso masewera akatha. Pitirizani kuloleza zidziwitso za msakatuli.',
      'Not now': 'Osati pano', 'Cancel': 'Siyani', 'OK': 'Chabwino', 'Close': 'Tsekani', 'Notice': 'Chidziwitso',
      'If alerts are not arriving, refresh this device\'s push registration. Turning alerts off will stop match notifications.':
        'Ngati zidziwitso zikusowa, yambitsaninso chipangizochi. Mukazimitsa, simudzalandiranso zidziwitso za masewera.',
      'Match alerts': 'Zidziwitso za masewera', 'Dark Mode': 'Mdima',
      'Faster access, works like an app': 'Kutsegula mwachangu, imagwira ngati app', 'Install': 'Ikani',
      'Tap the': 'Dinani batani la', 'button in Safari': 'mu Safari', 'Scroll down and tap': 'Tsikani pansi ndikudina',
      'Tap': 'Dinani', 'to finish': 'kuti mumalize',
      'This is not the official website of Chizumulu United FC. It is a fan site posting related information.':
        'Ili si tsamba lovomerezeka la Chizumulu United FC. Ndi tsamba la mafani lomwe limayika zambiri zokhudza timuyi.',
      'Don\'t show this for 1 week': 'Musandionetsenso kwa sabata imodzi', 'Don\'t show this for 7 days': 'Musandionetsenso kwa masiku 7',
      'called up to Malawi U-23 national team': 'waitanidwa ku timu ya dziko la Malawi ya U-23',
      // --- 헤더 / 시즌 ---
      'LIVE': 'PAKUSEWERA', 'Live Now \u00B7 NRFA League One': 'Pakusewera Tsopano \u00B7 NRFA League One',
      'NRFA Facebook Live Text Commentary': 'Ndemanga za Masewera pa Facebook ya NRFA',
      '\u2039 Prev season': '\u2039 Nyengo yapitayi', '25/26 Season': 'Nyengo ya 25/26', '26/27 Season': 'Nyengo ya 26/27', '26/27 Season \u203A': 'Nyengo ya 26/27 \u203A',
      '25/26 Season \u00B7 M\'mbelwa Northern Region Football League': 'Nyengo ya 25/26 \u00B7 M\'mbelwa Northern Region Football League',
      '26/27 Season \u00B7 NRFA League One': 'Nyengo ya 26/27 \u00B7 NRFA League One',
      '26/27 Season \u00B7 NRFA League One standings': 'Nyengo ya 26/27 \u00B7 Udindo wa NRFA League One',
      '25/26 Season \u00B7 Final standings': 'Nyengo ya 25/26 \u00B7 Udindo Womaliza',
      'Predict': 'Zoneneratu', 'Champion': 'Wopambana', 'Final Standings': 'Udindo Womaliza',
      // --- 순위표 ---
      'HOME': 'KWAWO', 'AWAY': 'KUNJA', 'FORM 5': 'MASEWERA 5', 'FORM': 'KACHITIDWE', 'NEXT': 'ADZAKHALA', 'H/A': 'K/K', 'W/D/L': 'W/D/L',
      'Form table \u2014 standings based on each team\'s last 5 matches only.': 'Tebulo la kachitidwe \u2014 udindo potengera masewera 5 aposachedwa a timu iliyonse okha.',
      '1st: Champion (C)': 'Wa 1: Wopambana (C)', '14th\u201316th: Relegated (R)': 'Wa 14 mpaka 16: Atsika Gawo (R)',
      '1st: Promoted to National Division League': 'Wa 1: Akwera ku National Division League',
      '13th\u201315th: Relegated to NRFA League Two': 'Wa 13 mpaka 15: Atsikira ku NRFA League Two',
      // --- 클럽 ---
      'Owner': 'Mwini', 'Manager': 'Mphunzitsi', 'Home Ground': 'Bwalo Lakwawo', 'One Island, One Team': 'Chilumba Chimodzi, Timu Imodzi',
      'OVERVIEW': 'ZAMBIRI', 'RECORDS': 'ZOLEMBA', 'RESULTS': 'ZOTSATIRA', 'PREDICTION': 'ZONENERATU', 'SQUAD': 'OSEWERA',
      'Cumulative Points by Round': 'Mapointi Onse pa Gawo Lililonse', 'Club YouTube': 'YouTube ya Gulu', 'Go to Channel': 'Pitani ku Channel',
      'Next Match': 'Masewera Otsatira', 'Cards': 'Makadi', 'Player Records': 'Zolemba za Osewera', 'Head-to-Head': 'Maso ndi Maso',
      'Magic Number': 'Nambala ya Matsenga', 'Path Finder': 'Wopeza Njira', 'Postponed': 'Osinthidwa',
      'Captain': 'Kapitao', 'League': 'Ligi', 'Appearances': 'Masewera Osewera', 'Goals': 'Zigoli', 'Assists': 'Zothandizira Zigoli',
      'Clean Sheets': 'Osalola Zigoli', 'MOTM': 'WOSEWERA BWINO', 'Assist Connections': 'Ogwirizana pa Zigoli', 'Recent Appearances': 'Masewera Aposachedwa',
      // --- 예측 화면 ---
      'TITLE RACE (TOP 3 \u00B7 CUMULATIVE POINTS)': 'MPIKISANO WA CHIKHO (ATATU OYAMBA \u00B7 MAPOINTI ONSE)',
      'ATTACK vs DEFENSE (Goals For vs Goals Against per Game)': 'KUUKIRA VS KUTETEZA (Zigoli Zopeza vs Zolandira pa Masewera)',
      'X-axis is goals conceded per game (fewer toward the right), Y-axis is goals scored per game. Teams are split into four zones based on the league average: Strong (above average at both ends), Attacking (scores a lot but concedes a lot too), Defensive (low scoring, low conceding), and Weak (below average at both ends). The faded dots and trail line, shown in a distinct color per team, show how each team\'s position has moved round by round. Click a team\'s logo to highlight just that team\'s trail \u2014 click again to clear it.':
        'Mzere wopingasa ndi zigoli zolandira pa masewera (zocheperapo kumanja), mzere woimirira ndi zigoli zopeza pa masewera. Matimu agawidwa m\'madera anayi potengera avareji ya ligi: Amphamvu (opambana avareji mbali zonse), Okuukira (amapeza zigoli zambiri koma amalandiranso zambiri), Oteteza (zigoli zochepa, amalandira zochepa), ndi Ofooka (osafika avareji mbali zonse). Madontho ofowoka ndi mzere wotsatira, wa mtundu wosiyana pa timu iliyonse, akusonyeza momwe malo a timu asinthira gawo ndi gawo. Dinani chizindikiro cha timu kuti muone njira ya timuyo yokha \u2014 dinaninso kuti muchotse.',
      'Compare with last season': 'Yerekezerani ndi nyengo yapitayi',
      'Faded dot = last season\'s final position (25/26); arrow = move to this season\'s current position. Teams without a 25/26 record are not shown.':
        'Dontho lofowoka = malo omaliza a nyengo yapitayi (25/26); muvi = kusuntha kupita ku malo a nyengo ino. Matimu opanda mbiri ya 25/26 sakuonetsedwa.',
      'BY TEAM': 'PA TIMU ILIYONSE', 'MULTI-GOAL GAMES': 'MASEWERA OPEZA ZIGOLI ZAMBIRI', 'PLAYER': 'OSEWERA', 'GOALS': 'ZIGOLI',
      'Monte Carlo season simulation \u2014 every remaining fixture is played out thousands of times using each team\'s current attack/defense rate (Poisson-based), plus a home advantage factor, to estimate title, top-3, and bottom-3 (relegation zone) probabilities.':
        'Kuyerekeza nyengo ya Monte Carlo \u2014 masewera onse otsala amaseweredwa nthawi zikwi zambiri potengera mphamvu zoukira ndi kuteteza za timu iliyonse (kutengera Poisson), kuphatikiza ubwino wosewera kwawo, kuti tiyese mwayi wopambana chikho, kukhala atatu oyamba, ndi atatu omaliza (malo otsika).',
      'Re-run Simulation': 'Bwerezani Kuyerekeza', 'BOTTOM 3 %': 'ATATU OMALIZA %', 'AVG FINAL RANK': 'AVAREJI YA MALO OMALIZA',
      'AVG FINAL PTS (80% RANGE)': 'AVAREJI YA MAPOINTI OMALIZA (80%)',
      'Fix the result of any remaining game (win / draw / loss) and re-run the season simulation to see how the title, top-3 and bottom-3 chances change. Second-half games have no dates yet, so they are listed by opponent; scheduled games show their kickoff.':
        'Sankhani zotsatira za masewera aliwonse otsala (kupambana / kufanana / kulephera) ndikubwerezanso kuyerekeza nyengo kuti muone momwe mwayi wopambana chikho, kukhala atatu oyamba ndi atatu omaliza ukusinthira. Masewera a theka lachiwiri alibe masiku, choncho alembedwa potengera wotsutsana naye; masewera okonzedwa akuonetsa nthawi yoyambira.',
      'RANK PROGRESSION BY WEEK': 'KUSINTHA KWA MALO SABATA ILIYONSE',
      'Each line traces a team\'s rank after every completed round so far. Lower on the chart means a lower rank. Hover or tap a team\'s name to highlight just that line.':
        'Mzere uliwonse ukutsatira malo a timu pambuyo pa gawo lililonse lomalizidwa. Kutsika pa chithunzi kumatanthauza malo otsika. Ikani cholozera kapena dinani dzina la timu kuti muone mzere wake wokha.',
      'CUMULATIVE POINTS BY ROUND': 'MAPOINTI ONSE PA GAWO LILILONSE',
      'Tracks each club\'s points total after every completed round. Select a club below to focus on its line.':
        'Ikutsatira mapointi onse a gulu lililonse pambuyo pa gawo lililonse lomalizidwa. Sankhani gulu pansipa kuti muone mzere wake.',
      'A time-machine chart: at each completed round, we recompute the title probability using only the data known at that moment. It shares the same week axis as the cumulative points chart above. Only teams that reached a noticeable probability at some point are shown; tap a team\'s name to highlight just that line.':
        'Chithunzi chofanana ndi makina a nthawi: pa gawo lililonse lomalizidwa, timawerengeranso mwayi wopambana chikho pogwiritsa ntchito zomwe zinkadziwika nthawi imeneyo zokha. Chimagwiritsa ntchito mzere wa masabata womwewo ngati chithunzi cha mapointi onse pamwambapa. Matimu omwe adafika pa mwayi woonekera nthawi ina yokha ndi omwe akuonetsedwa; dinani dzina la timu kuti muone mzere wake.',
      'TITLE PROBABILITY TREND': 'KUSINTHA KWA MWAYI WOPAMBANA CHIKHO', 'FINAL RANK PROBABILITY': 'MWAYI WA MALO OMALIZA',
      'The chance each team finishes the season in the top N. Uses the simulation above; cells that are already mathematically settled show LOCKED (top N guaranteed) or OUT (can no longer reach it). The check is points-only and conservative, so ties count as undecided.':
        'Mwayi woti timu iliyonse imalize nyengo mu atsogoleri oyamba N. Imagwiritsa ntchito kuyerekeza kwa pamwambapa; maselo omwe atsimikizika kale ndi masamu amaonetsa LOCKED (otsimikizika mu N oyamba) kapena OUT (sangafikenso). Kuwunikaku kumagwiritsa ntchito mapointi okha ndipo kuli kosamala, choncho mapointi ofanana amawerengedwa ngati osaganiziridwa.',
      'Locked: top N guaranteed': 'Otsimikizika: ali mu N oyamba', 'Out: can no longer reach it': 'Atuluka: sangafikenso',
      'Number = probability (%) \u2014 darker is likelier': 'Nambala = mwayi (%) \u2014 mdima kwambiri ndi mwayi waukulu',
      'Compare teams side by side: for each possible final points total, how many wins, draws and losses a team needs from its remaining games. Same row = same final points. Several W-D-L combinations can give the same total, so only the one with the most wins is shown (e.g. 3 pts = 1 win). Title / safety lines use the simulation median for 1st and 12th place. Pick up to 4 teams to compare above.':
        'Yerekezerani matimu mbali ndi mbali: pa mapointi omaliza aliwonse otheka, ndi masewera angati opambana, ofanana ndi olephera omwe timu ikufunika pa masewera ake otsala. Mzere umodzi = mapointi omaliza ofanana. Kuphatikiza kosiyanasiyana kwa W-D-L kungapereke chiwerengero chomwecho, choncho umaonetsedwa umodzi wokha wokhala ndi zopambana zambiri (mwachitsanzo mapointi 3 = kupambana 1). Mizere ya chikho / chitetezo imagwiritsa ntchito pakati pa kuyerekeza kwa malo a 1 ndi 12. Sankhani matimu mpaka 4 pamwambapa.',
      'At or above the expected title line': 'Pamwamba kapena pa mzere woyembekezeka wa chikho',
      'At or above the expected safety line': 'Pamwamba kapena pa mzere woyembekezeka wa chitetezo',
      'Below the safety line (relegation risk)': 'Pansi pa mzere wa chitetezo (pali chiopsezo chotsika)',
      'TITLE & SAFETY POINT LINES': 'MIZERE YA MAPOINTI A CHIKHO NDI CHITETEZO',
      'How many points the 1st, 3rd and 12th-placed teams finished with across the simulations. The bar spans the 10th\u201390th percentile (80% of runs land inside), the thick tick is the median. 12th place\'s total is the safety line (13th\u201315th are relegated). The gold line is Chizumulu\'s current points. The blue tick marks last season\'s (25/26) points for the same line, scaled to this season\'s number of games.':
        'Mapointi omwe matimu a malo a 1, 3 ndi 12 anamaliza nawo mu kuyerekeza konse. Mzere wautali ukuyambira pa 10 mpaka 90 peresenti (80% ya zotsatira zili mkati), kachizindikiro kakuda ndi pakati. Mapointi a malo a 12 ndi mzere wa chitetezo (a 13 mpaka 15 amatsika). Mzere wagolide ndi mapointi apano a Chizumulu. Kachizindikiro kabuluu kakuonetsa mapointi a nyengo yapitayi (25/26) pa mzere womwewo, osinthidwa kuti agwirizane ndi chiwerengero cha masewera a nyengo ino.',
      'RACE': 'MPIKISANO', 'TITLE & SAFETY MAGIC NUMBERS': 'NAMBALA ZA MATSENGA ZA CHIKHO NDI CHITETEZO',
      'A conservative figure based on each rival\'s maximum possible points. All 15 teams are shown. Teams already out of the title race or relegated show a status instead of a number.':
        'Nambala yosamala yotengera mapointi apamwamba omwe wotsutsana naye aliyense angapeze. Matimu onse 15 akuonetsedwa. Matimu omwe atuluka kale mu mpikisano wa chikho kapena atsika amaonetsa mkhalidwe m\'malo mwa nambala.',
      'LEFT': 'ZOTSALA',
      'AI PREDICTION ACCURACY': 'KULONDOLA KWA ZONENERATU ZA AI', 'Hide details': 'Bisani zambiri',
      'For every match already played, we recompute what the Poisson model would have predicted using only the data available before that match, then compare it with the actual score. Opening-week matches (no prior data for either side) are shown but excluded from the accuracy stats.':
        'Pa masewera onse omwe adaseweredwa kale, timawerengeranso zomwe chitsanzo cha Poisson chikananeneratu pogwiritsa ntchito zidziwitso zomwe zinalipo masewerawo asanachitike, kenako timayerekeza ndi zigoli zenizeni. Masewera a sabata yoyamba (opanda zidziwitso zam\'mbuyo) akuonetsedwa koma sakuphatikizidwa mu ziwerengero za kulondola.',
      'Recalculated automatically every time a new round\'s results are added \u2014 no manual logging needed.':
        'Imawerengedwanso yokha nthawi iliyonse zotsatira za gawo latsopano zikawonjezedwa \u2014 palibe kulemba pamanja.',
      'EXPECTED vs ACTUAL': 'ZOYEMBEKEZEKA VS ZENIZENI',
      'Every completed match\'s home/away side plotted as one dot each: x-axis is the model\'s expected goals for that side going into the match, y-axis is the actual goals scored. Dots above the diagonal scored more than expected, dots below scored less. Chizumulu United\'s own matches are outlined in gold.':
        'Mbali iliyonse (kwawo/kunja) ya masewera aliwonse omalizidwa yaikidwa ngati dontho limodzi: mzere wopingasa ndi zigoli zomwe chitsanzo chimayembekezera mbali imeneyo masewera asanayambe, mzere woimirira ndi zigoli zenizeni zomwe zinapezeka. Madontho pamwamba pa mzere wopendekeka anapeza zigoli zambiri kuposa zoyembekezeka, a pansi anapeza zochepa. Masewera a Chizumulu United amazunguliridwa ndi golide.',
      'Scored more than expected': 'Anapeza zigoli zambiri kuposa zoyembekezeka', 'Scored less than expected': 'Anapeza zigoli zochepa kuposa zoyembekezeka',
      'Chizumulu United': 'Chizumulu United', 'Not enough completed matches yet.': 'Palibe masewera okwanira omalizidwa panobe.',
      'AUTO-CORRECTION': 'KUSINTHA KWAOKHA',
      'Compares expected goals vs actual goals across completed matches and nudges future predictions (this section, the Monte Carlo simulation, and next-match cards) accordingly. Turns on automatically once enough matches build up, and the adjustment is capped to avoid overreacting to a small sample.':
        'Imayerekeza zigoli zoyembekezeka ndi zenizeni pa masewera omalizidwa ndikusintha pang\'ono zoneneratu zamtsogolo (gawo ili, kuyerekeza kwa Monte Carlo, ndi makadi a masewera otsatira). Imayatsidwa yokha masewera okwanira akachuluka, ndipo kusinthako kuli ndi malire kuti zisapitirire chifukwa cha masewera ochepa.',
      'Each team\'s home/away correction is shrunk toward the league-wide value above until it has enough matches of its own \u2014 small samples lean on the league number, bigger samples move toward the team\'s own.':
        'Kusintha kwa kwawo/kunja kwa timu iliyonse kumachepetsedwa kupita ku mtengo wa ligi yonse pamwambapa mpaka timuyo ikhale ndi masewera okwanira; masewera ochepa amadalira nambala ya ligi, ochuluka amatsatira za timuyo.',
      'HOME CORRECTION': 'KUSINTHA KWA KWAWO', 'AWAY CORRECTION': 'KUSINTHA KWA KUNJA',
      'DIXON-COLES LOW-SCORE FIX (\u03C1)': 'KUKONZA KWA DIXON-COLES PA ZIGOLI ZOCHEPA (\u03C1)',
      'Independent Poisson models tend to misjudge low scorelines (0-0, 1-0, 0-1, 1-1). Instead of using a textbook default, \u03C1 is estimated from this league\'s own results via maximum likelihood, recalculated walk-forward before each round. Turns on automatically once enough matches build up.':
        'Zitsanzo za Poisson zodziyimira pawokha zimalakwitsa pa zigoli zochepa (0-0, 1-0, 0-1, 1-1). M\'malo mogwiritsa ntchito mtengo wa m\'buku, \u03C1 imawerengedwa kuchokera ku zotsatira za ligi iyi pogwiritsa ntchito maximum likelihood, ndipo imawerengedwanso gawo lililonse lisanayambe. Imayatsidwa yokha masewera okwanira akachuluka.',
      'MATCH': 'MASEWERA', 'AI PICK': 'CHISANKHO CHA AI', 'ACTUAL': 'ZENIZENI', 'GOAL ERR': 'ZIGOLI ZOLAKWIKA', 'BRIER': 'BRIER',
      // --- 경기장 / 비교 ---
      'Home grounds of all 15 clubs in NRFA League One, plotted by coordinates. Tap a marker or a team in the list below to see its venue.':
        'Mabwalo akwawo a magulu onse 15 a NRFA League One, oikidwa potengera malo. Dinani chizindikiro kapena timu pa mndandanda pansipa kuti muone bwalo lake.',
      'CLUB VENUES MAP': 'MAPU YA MABWALO A MAGULU', 'Club Venues Map': 'Mapu ya Mabwalo a Magulu',
      'Pick any two teams to compare goals, home/away splits, recent form and head-to-head records.':
        'Sankhani matimu awiri aliwonse kuti muyerekeze zigoli, kwawo/kunja, kachitidwe ka posachedwa ndi mbiri ya maso ndi maso.',
      // --- 상단 광고 라벨 (스폰서명·리그명은 그대로) ---
      'CHIWEMI INVESTMENT': 'CHIWEMI INVESTMENT', 'NRFA LEAGUE ONE': 'NRFA LEAGUE ONE'
    };
    for (var k in D) if (Object.prototype.hasOwnProperty.call(D, k)) window.NY_DICT[k] = D[k];
  })();

  // ============================================================
  // [D] 사전 2 — app.js 고정 문구·지표 설명문
  // ============================================================
  (function () {
    if (!window.NY_DICT) return;
    var D = {
      // --- 공통 / 시스템 ---
      "Switch to light mode": "Sinthani kukhala kuwala", "Switch to dark mode": "Sinthani kukhala mdima", "Dark mode": "Mdima",
      "\u2705 App installed": "\u2705 App yaikidwa", "Install is not supported in this browser": "Msakatuli uyu sungathe kuika app",
      "Simulation failed. Please refresh and try again.": "Kuyerekeza kwalephera. Chonde yambitsaninso tsamba ndikuyesanso.",
      "Calculation failed. Please try again.": "Kuwerengera kwalephera. Chonde yesaninso.", "Calculation failed.": "Kuwerengera kwalephera.",
      "Copied to clipboard": "Kwakopedwa", "Share failed": "Kugawana kwalephera", "No results to share yet": "Palibe zotsatira zogawana panobe",
      "Calendar file downloaded": "Fayilo ya kalendala yatsitsidwa", "Loading latest videos...": "Tikutsitsa makanema aposachedwa...",
      "Loading weather\u2026": "Tikutsitsa nyengo\u2026", "Forecast not available yet": "Zoneneratu za nyengo palibe panobe",
      "Generating...": "Tikupanga...", "Calculating...": "Tikuwerengera...", "Calculating": "Tikuwerengera", "Simulating...": "Tikuyerekeza...",
      "Failed to generate image. Please try again.": "Kupanga chithunzi kwalephera. Chonde yesaninso.",
      "Poster module failed to load.": "Gawo la positala silinatsegulidwe.", "Failed to generate the poster. Please try again.": "Kupanga positala kwalephera. Chonde yesaninso.",
      "Could not load last season data. Please try again in a moment.": "Sitinathe kutsitsa zidziwitso za nyengo yapitayi. Chonde yesaninso pakangopita kanthawi.",
      "Show less": "Onetsani zochepa", "Show all": "Onetsani zonse", "Hide": "Bisani", "Details": "Zambiri", "View Details": "Onani Zambiri",
      "Reset": "Yambanso", "Reset all": "Yambitsaninso zonse", "None": "Palibe", "None yet": "Palibe panobe", "TBD": "ISANAMVEKE", "TBA": "ISANAMVEKE", "TBC": "ISANATSIMIKIZIKE",
      "Date TBD": "Tsiku silinadziwike", "Upcoming": "Akubwera", "Current": "Pano", "NOW": "TSOPANO", "TODAY": "LERO", "KICK-OFF!": "ZAYAMBA!", "D-DAY": "TSIKU LOFUNIKA",
      // --- 예측 / 시뮬레이션 ---
      "Middle 80% of simulated outcomes": "Pakati pa 80% ya zotsatira zoyerekeza", "Simulations:": "Kuyerekeza:", "Remaining fixtures:": "Masewera otsala:",
      "already above the safety line": "ali kale pamwamba pa mzere wa chitetezo", "Chizumulu": "Chizumulu", "(vs. median)": "(poyerekeza ndi pakati)",
      "This yr median \u2212 last yr": "Pakati a chaka chino \u2212 chaka chatha", "no real change": "palibe kusintha kwenikweni",
      "Your picks changed. The result below reflects the previous picks \u2014 recalculate to update.": "Zosankha zanu zasintha. Zotsatira zili pansipa zikuonetsa zosankha zakale \u2014 werengeraninso kuti zisinthe.",
      "TOP 3": "ATATU OYAMBA", "BOTTOM 3": "ATATU OMALIZA", "AVG PTS": "AVAREJI YA MAPOINTI", "No remaining fixtures.": "Palibe masewera otsala.",
      "Recalculate with these picks": "Werengeraninso ndi zosankha izi", "Available once the base forecast finishes.": "Zipezeka zoneneratu zoyambirira zikatha.",
      "Pick at least one result.": "Sankhani zotsatira chimodzi osachepera.", "Team": "Timu", "Win all": "Pambanani zonse", "Win all home": "Pambanani zonse kwawo",
      "Lose all": "Lephereni zonse", "Clear this team": "Chotsani timu iyi", "Locked": "Otsimikizika", "Out": "Atuluka", "FINAL PTS": "MAPOINTI OMALIZA", "SAFE": "ACHITETEZEKA",
      "Hide below safety line \u25B2": "Bisani pansi pa mzere wa chitetezo \u25B2", "No scenarios to show.": "Palibe zochitika zoonetsa.",
      "Expected Goals \u2192": "Zigoli Zoyembekezeka \u2192", "Actual Goals \u2192": "Zigoli Zenizeni \u2192",
      "Not enough completed matches yet to score prediction accuracy.": "Masewera omalizidwa sakukwanira panobe kuyeza kulondola kwa zoneneratu.",
      "Win/Draw/Loss accuracy": "Kulondola kwa Kupambana/Kufanana/Kulephera", "Exact score accuracy": "Kulondola kwa zigoli zenizeni",
      "Avg. goal error (xG vs actual)": "Avareji ya kulakwitsa zigoli (xG vs zenizeni)", "Brier score (0=perfect, 2=worst)": "Mapointi a Brier (0=wangwiro, 2=oyipitsitsa)",
      "Matches scored": "Masewera oyezedwa", "Home": "Kwawo", "Draw": "Kufanana", "Away": "Kunja", "early season": "kuyamba kwa nyengo", "Home win": "Kupambana kwawo",
      "Away win": "Kupambana kunja", "Upset": "Kudabwitsa", "GP": "MS", "xPTS": "xMAP", "DIFF": "KUSIYANA", "Home goal correction": "Kusintha kwa zigoli za kwawo",
      "Away goal correction": "Kusintha kwa zigoli za kunja", "Matches used": "Masewera ogwiritsidwa ntchito", "W/D/L accuracy w/ correction": "Kulondola kwa W/D/L ndi kusintha",
      "Exact score accuracy w/ correction": "Kulondola kwa zigoli zenizeni ndi kusintha", "Avg. goal error w/ correction": "Avareji ya kulakwitsa zigoli ndi kusintha",
      "Brier score w/ correction": "Mapointi a Brier ndi kusintha", "Estimated ρ (MLE)": "ρ yoyerekezedwa (MLE)",
      "W/D/L accuracy w/ ρ (vs correction only)": "Kulondola kwa W/D/L ndi ρ (poyerekeza ndi kusintha kokha)",
      "Exact score accuracy w/ ρ (vs correction only)": "Kulondola kwa zigoli zenizeni ndi ρ (poyerekeza ndi kusintha kokha)",
      "Brier score w/ ρ (vs correction only)": "Mapointi a Brier ndi ρ (poyerekeza ndi kusintha kokha)",
      "Goal margin barely matters here: it only breaks ties on equal points, and the gap is within simulation noise.": "Kusiyana kwa zigoli sikufunika kwambiri apa: kumangosankha pa mapointi ofanana, ndipo kusiyanako kuli mkati mwa kulakwitsa kwa kuyerekeza.",
      "WIN by 2+": "KUPAMBANA ndi 2+", "WIN by 1": "KUPAMBANA ndi 1", "DRAW": "KUFANANA", "LOSS by 1": "KULEPHERA ndi 1", "LOSS by 2+": "KULEPHERA ndi 2+",
      // --- 리포트 / 다음 경기 ---
      "Not enough matches played yet this round \u2014 the report appears automatically once at least 6 of the 7 fixtures are in.": "Masewera sanakwane mu gawo lino \u2014 lipoti limaoneka lokha masewera 6 mwa 7 akatha.",
      "Above": "Pamwamba", "Below": "Pansi", "WEEKLY REPORT": "LIPOTI LA SABATA", "What it means for the race": "Tanthauzo lake pa mpikisano", "Download Poster": "Tsitsani Positala",
      "PREDICTION REPORT": "LIPOTI LA ZONENERATU", "No upcoming fixture to preview yet.": "Palibe masewera akubwera oonetseratu panobe.",
      "Chizumulu have no fixture next round \u2014 a chance to rest up before the following match.": "Chizumulu alibe masewera gawo lotsatira \u2014 mwayi wopuma asanakumane ndi masewera ena.",
      "Also worth watching this round": "Masewera ena oyenera kuwonera mu gawo lino", "OG": "ZK", "Next": "Wotsatira", "Bye week \u2014 no match this round": "Sabata yopuma \u2014 palibe masewera gawo lino",
      "Then": "Kenako", "Add to calendar": "Onjezani ku kalendala", "All remaining fixtures (.ics)": "Masewera onse otsala (.ics)",
      "Kickoff time not confirmed yet": "Nthawi yoyambira sinatsimikizike panobe", "No confirmed upcoming fixtures yet": "Palibe masewera atsimikizika akubwera panobe",
      "Chizumulu Next Match": "Masewera Otsatira a Chizumulu", "Chizumulu United FC Remaining Fixtures": "Masewera Otsala a Chizumulu United FC",
      "Added from the Chizumulu United FC fan site.": "Yawonjezedwa kuchokera ku tsamba la mafani la Chizumulu United FC.",
      "NRFA League One Standings": "Udindo wa NRFA League One", "pp": "pp", "Lead over 2nd": "Patsogolo pa wachiwiri", "Behind 1st": "Kumbuyo kwa woyamba", "Clinched": "Watsimikiza",
      "vs last wk": "poyerekeza ndi sabata yatha", "Promotion Race": "Mpikisano wa Kukwera Ligi", "Games left": "Masewera otsala", "Title odds": "Mwayi wa chikho", "Match details": "Zambiri za masewera",
      "Chance of finishing 1st (promotion) from 4,000 Monte Carlo runs. Change is vs. the previous round in the trend chart (simplified model), matching the last segment of that chart.": "Mwayi womaliza pa malo a 1 (kukwera ligi) kuchokera ku kuyerekeza kwa Monte Carlo 4,000. Kusintha kukuyerekezedwa ndi gawo lapitalo pa chithunzi cha kukwera (chitsanzo chosavuta), kofanana ndi gawo lomaliza la chithunzicho.",
      "Win/draw/loss title odds appear once the next fixture is scheduled": "Mwayi wa chikho wa kupambana/kufanana/kulephera uoneka masewera otsatira akakonzedwa",
      "No matches played yet": "Palibe masewera omwe asewera panobe", "No matches yet": "Palibe masewera panobe", "Compare teams": "Yerekezani matimu", "Compare Teams": "Yerekezani Matimu",
      "Second-half league fixtures have not been announced yet.": "Masewera a theka lachiwiri la ligi sanalengezedwe panobe.", "Predicted XI": "Osewera 11 Oyembekezeka", "starters": "oyamba",
      "Top scorer": "Wopeza zigoli kwambiri", "Top assists": "Wothandiza zigoli kwambiri", "Most impactful": "Wofunika kwambiri", "Watch out": "Samalani",
      "No scoring record for this opponent yet": "Palibe mbiri ya zigoli ya wotsutsana naye uyu panobe", "Opponent to watch": "Wotsutsana woyenera kumuyang'anira", "Key Players": "Osewera Ofunika",
      "Perceived difficulty from opponent rank, form and venue (1 easy \u2013 5 hard).": "Zovuta zoganiziridwa kuchokera ku malo a wotsutsana naye, kachitidwe ndi bwalo (1 zosavuta \u2013 5 zovuta).",
      "Upcoming Difficulty": "Zovuta Zomwe Zikubwera", "Next Match Preview": "Zoonetseratu za Masewera Otsatira", "Bye week": "Sabata yopuma", "Opp. form": "Kachitidwe ka wotsutsana",
      "Auto-corrected using past prediction errors": "Yasinthidwa yokha pogwiritsa ntchito zolakwika zakale za zoneneratu", "Match Prediction (fun stat)": "Zoneneratu za Masewera (zosangalatsa)",
      "Easy": "Zosavuta", "Hard": "Zovuta kwambiri", "Average": "Zapakati", "Fixture Difficulty": "Zovuta za Masewera",
      // --- 팀 비교 / 기록 ---
      "PTS/GAME": "MAPOINTI/MASEWERA", "GOAL DIFF": "KUSIYANA KWA ZIGOLI", "Home vs Away": "Kwawo vs Kunja", "Bye Week Flow": "Kayendedwe ka Sabata Yopuma", "Bye": "Wopuma", "BYE": "WOPUMA",
      "Cumulative points before and after the bye week": "Mapointi onse pamaso ndi pambuyo pa sabata yopuma", "No streak yet": "Palibe mzere wopambana panobe",
      "Longest Win Streak": "Mzere Wautali wa Kupambana", "Longest Unbeaten Run": "Mzere Wautali Wosagonja", "Form Guide": "Chitsogozo cha Kachitidwe",
      "Goals For": "Zigoli Zopeza", "Goals Against": "Zigoli Zolandira", "Goal Diff": "Kusiyana kwa Zigoli", "Height: Start \u203A Sub \u203A Bench": "Kutalika: Woyamba \u203A Wolowa \u203A Benchi",
      "Assist": "Kuthandiza", "APP": "MSW", "CS": "OZ", "CONC": "ZL", "CS RATE": "KUCHULUKA KWA OZ", "Goalkeeper Clean Sheets": "Osalola Zigoli a Goloboyi", "Based on starting appearances": "Potengera masewera omwe adayamba",
      "Awards": "Mphoto", "Player of the Month": "Osewera wa Mwezi", "Goal of the Month": "Zigoli za Mwezi", "Man of the Match": "Wosewera Bwino wa Masewera", "Staff": "Ogwira Ntchito",
      "Attack/Defense Index \u2014 100% is the league average; higher is stronger": "Chizindikiro cha Kuukira/Kuteteza \u2014 100% ndi avareji ya ligi; kukwera kumatanthauza mphamvu", "Final Rank": "Malo Omaliza",
      "FT": "KATHA", "HT": "THEKA", "Recent": "Aposachedwa", "Before kickoff \u2192 at current score": "Asanayambe \u2192 pa zigoli zapano", "No goals": "Palibe zigoli", "Match Events": "Zochitika za Masewera",
      "No scorers": "Palibe opeza zigoli", "Watch Highlights": "Onani Zofunika", "No scorer data yet.": "Palibe zidziwitso za opeza zigoli panobe.", "No data yet": "Palibe zidziwitso panobe",
      "No repeat pairs yet": "Palibe awiri obwerezabwereza panobe", "Assist \u2193 / Goal \u2192": "Wothandiza \u2193 / Zigoli \u2192", "Ast": "Th", "Unassisted": "Opanda wothandiza",
      "\u2013 Full Ranking": "\u2013 Udindo Wonse", "Appearance Stats": "Ziwerengero za Masewera", "Based on lineup data entered so far": "Potengera zidziwitso za mndandanda wa osewera zolembedwa mpaka pano",
      "matches": "masewera", "win rate": "kupambana", "Goals/gm": "Zigoli/masewera", "Conceded/gm": "Zolandira/masewera", "Key Player Impact": "Kufunika kwa Osewera Ofunika",
      "Not enough lineup data yet": "Zidziwitso za mndandanda wa osewera sizikwanira panobe", "Ranked by impact \u2014 points/game with the player starting vs. not featuring at all": "Zolembedwa potengera kufunika \u2014 mapointi/masewera pamene wosewera akuyamba poyerekeza ndi pamene sakusewera konse",
      "Small sample": "Masewera ochepa", "Starting Duo Effect": "Mphamvu ya Awiri Oyamba", "The team story is coming soon.": "Nkhani ya timu ikubwera posachedwa.",
      "Vice-Captain": "Wachiwiri kwa Kapitao", "On Loan": "Wobwereketsa", "Loan": "Wobwereketsa", "Vice-Capt.": "Wa/Kapitao", "\uD83D\uDD01 On Loan": "\uD83D\uDD01 Wobwereketsa",
      "My team only": "Timu yanga yokha", "No postponed matches right now.": "Palibe masewera osinthidwa pakadali pano.", "Goals by round": "Zigoli pa gawo lililonse", "No players to show.": "Palibe osewera oonetsa.",
      "Chizumulu only": "Chizumulu okha", "No multi-goal games yet.": "Palibe masewera opeza zigoli zambiri panobe.", "goals": "zigoli", "conceded": "zolandira", "wins": "zopambana", "draws": "zofanana", "losses": "zolephera",
      "Half-time": "Theka", "Start": "Yambani", "End": "Mapeto", "Rank by week": "Malo pa sabata", "Cumulative points by round": "Mapointi onse pa gawo lililonse",
      // --- 매직넘버 / 패스파인더 ---
      "CLINCHED": "WATSIMIKIZA", "Not clinchable by wins alone this season": "Sangatsimikizidwe ndi kupambana kokha nyengo ino", "Condition already met": "Chofunika chakwaniritsidwa kale",
      "Cannot catch the teams already ahead, even by winning out": "Sangathe kufikira matimu omwe ali patsogolo, ngakhale atapambana onse", "MAGIC NUMBER": "NAMBALA YA MATSENGA",
      "TITLE CLINCH": "KUTSIMIKIZA CHIKHO", "SAFETY CLINCH": "KUTSIMIKIZA CHITETEZO", "Not clinchable by results alone this season": "Sangatsimikizidwe ndi zotsatira zokha nyengo ino",
      "Already clinched": "Watsimikiza kale", "Win needed": "Kupambana kukufunika", "Draw or better": "Kufanana kapena kupambana", "Head-to-head": "Maso ndi maso",
      "No confirmed fixtures for this path yet": "Palibe masewera atsimikizika panjira iyi panobe", "Must-win \u2014 no games to spare": "Ayenera kupambana \u2014 palibe masewera ochulukirapo",
      "One example scenario": "Chitsanzo chimodzi", "Draw/loss helps": "Kufanana/kulephera kumathandiza", "PATH FINDER": "WOPEZA NJIRA", "Easiest path": "Njira yosavuta", "Safest path": "Njira yotetezeka",
      "View head-to-head": "Onani maso ndi maso", "LAST 5": "5 APOSACHEDWA", "Promotion": "Kukwera Ligi", "Relegation": "Kutsika Ligi", "Chizumulu United Fan Edition": "Chizumulu United Mtundu wa Mafani",
      "No completed match result yet.": "Palibe zotsatira za masewera omalizidwa panobe.", "/ game": "/ masewera", "Clean Sheet": "Osalola Zigoli", "Roller-coaster": "Osasinthasintha", "Steady": "Okhazikika",
      "\u00B7 last": "\u00B7 omaliza", "Not enough matches yet": "Masewera sakukwanira panobe", "Best Single-Team Haul": "Zigoli Zambiri za Timu Imodzi", "GOALS": "ZIGOLI", "Season at a Glance": "Nyengo Pang'ono",
      "Matches Played": "Masewera Omwe Asewera", "Goals / Game": "Zigoli / Masewera", "0-0 Draws": "Kufanana kwa 0-0", "Home : Away Avg Goals": "Avareji ya Zigoli Kwawo : Kunja",
      "Home Win vs Draw vs Away Win": "Kupambana Kwawo vs Kufanana vs Kupambana Kunja", "Matches": "Masewera", "in progress": "zikuchitika", "CHANGE": "KUSINTHA",
      "LAST SEASON LUCK /G": "MWAYI WA NYENGO YAPITAYI /M", "PPG CHANGE": "KUSINTHA KWA PPG", "THIS SEASON LUCK /G": "MWAYI WA NYENGO INO /M",
      "Goals Against / Game (fewer \u2192)": "Zigoli Zolandira / Masewera (zochepa \u2192)", "Goals For / Game \u2192": "Zigoli Zopeza / Masewera \u2192", "GF/g": "ZP/m", "GA/g": "ZL/m",
      "(click to highlight trail)": "(dinani kuti muone njira)", "Rank \u2192": "Malo \u2192", "Week \u2192": "Sabata \u2192", "Points \u2192": "Mapointi \u2192", "Last season pace": "Liwiro la nyengo yapitayi", "Title chance \u2192": "Mwayi wa chikho \u2192",
      "No goal records.": "Palibe mbiri ya zigoli.", "Share of Goals Assisted": "Gawo la Zigoli Zothandizidwa", "No Number": "Opanda Nambala", "Sub": "Wolowa", "No cup appearances yet.": "Palibe masewera a chikho panobe.",
      "No appearance records.": "Palibe mbiri ya masewera.", "PLAYED": "ASEWERA", "ast.": "th.", "The only goal was assisted": "Zigoli zokhazo zinathandizidwa", "assists": "zothandizira", "Pitch": "Bwalo", "List": "Mndandanda",
      "(Forfeit)": "(Wasiya)", "Previous Meetings": "Kukumana Kwapitako", "AI Prediction": "Zoneneratu za AI", "No goals yet": "Palibe zigoli panobe", "Related to this match": "Zokhudza masewera awa",
      "This match": "Masewera awa", "Standings and form shown are as of now, not at kickoff.": "Udindo ndi kachitidwe kakuonetsedwa ndi kwa pano, osati kwa nthawi yoyambira.", "Recent Form": "Kachitidwe ka Posachedwa",
      "Season Head-to-Head": "Maso ndi Maso a Nyengo", "This season": "Nyengo ino", "Postponed \u00B7 date TBC": "Osinthidwa \u00B7 tsiku silinatsimikizike", "Upcoming fixture": "Masewera akubwera", "See AI prediction": "Onani zoneneratu za AI",
      "No meeting between these two this season yet": "Awiriwa sanakumanebe nyengo ino", "All-time head-to-head is only tracked for matchups that include Chizumulu United.": "Mbiri ya maso ndi maso ya nthawi zonse imasungidwa pa masewera omwe ali ndi Chizumulu United okha.",
      "No all-time record against Chizumulu yet.": "Palibe mbiri ya nthawi zonse yotsutsana ndi Chizumulu panobe.", "Swap teams": "Sinthanitsani matimu",
      // --- 리그 기록 카테고리 ---
      "Goals/Game": "Zigoli/Masewera", "Highest first": "Wapamwamba poyamba", "Conceded/Game": "Zolandira/Masewera", "Lowest first": "Wapansi poyamba", "Failed to Score": "Osapeza Zigoli", "Points/Game": "Mapointi/Masewera",
      "PPG (Points Per Game) is points divided by games played. A season average above 2.00 is generally considered title-race pace. It lets you fairly compare teams that have played a different number of matches.": "PPG (Mapointi pa Masewera) ndi mapointi ogawidwa ndi masewera omwe asewera. Avareji ya nyengo yopitirira 2.00 nthawi zambiri imaonedwa ngati liwiro la mpikisano wa chikho. Imathandiza kuyerekeza matimu omwe asewera masewera osiyana mofanana.",
      "Pythagorean Pts": "Mapointi a Pythagorean",
      "Estimates the points a team \"should\" have earned based purely on goals scored and conceded. A positive (+) difference means the team has outperformed its underlying numbers (close-game luck or clutch play); negative (-) means it's picking up fewer points than its output suggests. Over a season, actual points tend to drift back toward this expected value.": "Imayerekeza mapointi omwe timu \"imayenera\" kukhala nawo potengera zigoli zopeza ndi zolandira zokha. Kusiyana kwabwino (+) kumatanthauza kuti timu yachita bwino kuposa ziwerengero zake (mwayi pa masewera ovuta kapena luso pa nthawi yofunika); koyipa (-) kumatanthauza kuti ikupeza mapointi ochepera kuposa momwe zochita zake zikusonyezera. Pa nyengo yonse, mapointi enieni amakonda kubwerera ku mtengo woyembekezekawu.",
      "Attack Index": "Chizindikiro cha Kuukira",
      "An xG-style metric built purely from goal records (no shot data). League-wide average goals per game is set to 100%, and this shows this team's goals per game as a percentage of that average. Above 100% means the team scores more than the league average.": "Muyeso wofanana ndi xG wopangidwa ndi mbiri ya zigoli zokha (popanda zidziwitso za kuwombera). Avareji ya zigoli pa masewera ya ligi yonse yayikidwa pa 100%, ndipo apa pakuonetsedwa zigoli za timu iyi pa masewera ngati peresenti ya avareji imeneyo. Kupitirira 100% kumatanthauza kuti timu imapeza zigoli zambiri kuposa avareji ya ligi.",
      "Defense Index": "Chizindikiro cha Kuteteza",
      "League-wide average goals conceded per game is set to 100%, and this shows how much less this team concedes relative to that average. A higher number means a stronger-than-average defense; a team with zero goals conceded shows as 'Perfect'.": "Avareji ya zigoli zolandira pa masewera ya ligi yonse yayikidwa pa 100%, ndipo apa pakuonetsedwa momwe timu iyi imalandirira zochepa poyerekeza ndi avareji imeneyo. Nambala yokwera imatanthauza chitetezo champhamvu kuposa avareji; timu yopanda zigoli zolandira imaoneka ngati 'Perfect'.",
      "Scorer Dependence": "Kudalira Wopeza Zigoli",
      "The share of a team's total goals scored by its single top scorer. A high number means goals are concentrated in one player (a big hit if he is missing); a low number means the scoring is spread across the squad. Opponents' own goals count toward the team total but not any player, so the share can read slightly low.": "Gawo la zigoli zonse za timu zomwe zapezedwa ndi wopeza zigoli wake wamkulu m'modzi. Nambala yokwera imatanthauza kuti zigoli zimadalira wosewera m'modzi (ndi vuto lalikulu akasowa); nambala yotsika imatanthauza kuti zigoli zimapezedwa ndi osewera ambiri. Zigoli zodzipweteka za wotsutsana zimawerengedwa mu zonse za timu koma osati kwa wosewera aliyense, choncho gawolo lingaoneke lochepa pang'ono.",
      "Winning Streak": "Mzere wa Kupambana", "Losing Streak": "Mzere wa Kulephera", "Drawing Streak": "Mzere wa Kufanana", "Unbeaten Streak": "Mzere Wosagonja",
      "Consecutive matches without a loss (win or draw) since the most recent defeat. Combines winning and drawing streaks to show a team's overall run of form.": "Masewera otsatizana osalephera (kupambana kapena kufanana) kuyambira pa kugonja komaliza. Imaphatikiza mizere ya kupambana ndi kufanana kusonyeza kachitidwe ka timu konse.",
      "Scoring Streak": "Mzere wa Kupeza Zigoli", "Conceding Streak": "Mzere wa Kulandira Zigoli", "Volatility": "Kusasinthasintha", "Most volatile first": "Osasinthasintha kwambiri poyamba",
      "The standard deviation of points per game (win 3, draw 1, loss 0). A higher number means a roller-coaster team that swings between results; a lower number means steadier results. The top third of the league is tagged Roller-coaster and the bottom third Steady. Last season's value only uses weeks where a single match result can be identified, so treat it as a rough guide. Teams need at least 5 games this season.": "Standard deviation ya mapointi pa masewera (kupambana 3, kufanana 1, kulephera 0). Nambala yokwera imatanthauza timu yosasinthasintha yomwe imasinthasintha pakati pa zotsatira; nambala yotsika imatanthauza zotsatira zokhazikika. Gawo limodzi mwa magawo atatu apamwamba a ligi limatchedwa Osasinthasintha ndipo lapansi Okhazikika. Mtengo wa nyengo yapitayi umagwiritsa ntchito masabata omwe zotsatira za masewera amodzi zingadziwike okha, choncho utengeni ngati chitsogozo chokha. Matimu ayenera kukhala ndi masewera 5 osachepera nyengo ino.",
      "Most Improved": "Opita Patsogolo Kwambiri", "Biggest PPG gain": "Kukwera kwakukulu kwa PPG",
      "Compares last season's (25/26) final points per game with this season's current PPG and lists teams that improved, biggest gain first. Only teams with a 25/26 record are included, and values will move as this season progresses.": "Imayerekeza PPG yomaliza ya nyengo yapitayi (25/26) ndi PPG ya nyengo ino ndipo imalemba matimu omwe apita patsogolo, okwera kwambiri poyamba. Matimu omwe ali ndi mbiri ya 25/26 okha ndi omwe akuphatikizidwa, ndipo mitengo idzasintha nyengo ikamapita.",
      "Biggest Decline": "Obwerera M'mbuyo Kwambiri", "Biggest PPG drop": "Kutsika kwakukulu kwa PPG",
      "Compares last season's (25/26) final points per game with this season's current PPG and lists teams that declined, biggest drop first. Only teams with a 25/26 record are included, and values will move as this season progresses.": "Imayerekeza PPG yomaliza ya nyengo yapitayi (25/26) ndi PPG ya nyengo ino ndipo imalemba matimu omwe abwerera m'mbuyo, otsika kwambiri poyamba. Matimu omwe ali ndi mbiri ya 25/26 okha ndi omwe akuphatikizidwa, ndipo mitengo idzasintha nyengo ikamapita.",
      "Attack": "Kuukira", "Defense": "Kuteteza", "Form": "Kachitidwe", "Advanced": "Zapamwamba", "1st-place total": "Chiwerengero cha wa 1", "3rd-place total": "Chiwerengero cha wa 3",
      "Most Assists": "Thandizo Zambiri", "The creator": "Wopanga zigoli", "Goal Contributions": "Zopereka pa Zigoli", "Goals + assists": "Zigoli + zothandizira", "Contributions per Game": "Zopereka pa Masewera",
      "Best Duos": "Awiri Abwino Kwambiri", "2+ combos (assist \u2192 goal)": "Kuphatikiza 2+ (thandizo \u2192 zigoli)", "Duo Scoring Rate": "Kuchuluka kwa Zigoli za Awiri", "Most Starts": "Oyamba Kwambiri",
      "Regular starter": "Woyamba wokhazikika", "Most Sub Appearances": "Olowa M'malo Kwambiri", "Super sub": "Wolowa m'malo wabwino", "Most Unused on Bench": "Osagwiritsidwa Ntchito Kwambiri pa Benchi",
      "Warming the bench": "Akutenthetsa benchi", "Sub Appearance Rate": "Kuchuluka kwa Kulowa M'malo", "3+ appearances": "Masewera 3+", "Goals by Position": "Zigoli pa Udindo", "Share of team goals scored by each position": "Gawo la zigoli za timu zopezedwa ndi udindo uliwonse",
      "No goal data yet": "Palibe zidziwitso za zigoli panobe", "Top scorer:": "Wopeza zigoli kwambiri:", "Assists by Position": "Zothandizira pa Udindo", "Share of team assists made by each position": "Gawo la zothandizira za timu zopangidwa ndi udindo uliwonse",
      "No assist data yet": "Palibe zidziwitso za zothandizira panobe", "Top assister:": "Wothandiza kwambiri:"
    };
    for (var k in D) if (Object.prototype.hasOwnProperty.call(D, k)) window.NY_DICT[k] = D[k];
  })();

  // ============================================================
  // [E] 패턴 규칙 — 숫자·팀 이름이 섞인 조립 문장
  // ============================================================
  (function () {
    if (!window.NY_PATTERNS || !window.NY_T) return;
    var T = window.NY_T;
    // "2 wins + 1 draw" 같은 조각 안의 단어 치환
    function S(x) {
      return x.replace(/(\d+) wins?/g, 'zopambana $1').replace(/(\d+) draws?/g, 'zofanana $1')
              .replace(/(\d+) loss(?:es)?/g, 'zolephera $1').replace(/\bor\b/g, 'kapena');
    }
    var P = [
      // --- 예측 / 라인 ---
      [/^Last season #(.+): (.+) pts \((.+) games\) \u2192 (.+) scaled$/, 'Nyengo yapitayi #$1: mapointi $2 (masewera $3) \u2192 $4 yosinthidwa'],
      [/^\+(\d+) to the title line$/, '+$1 kufika pa mzere wa chikho'],
      [/^\+(\d+) to the safety line$/, '+$1 kufika pa mzere wa chitetezo'],
      [/^Last season \(25\/26\), same line \u00B7 scaled to (\d+) games$/, 'Nyengo yapitayi (25/26), mzere womwewo \u00B7 wosinthidwa kukhala masewera $1'],
      [/^(.+) title chance ([\d.]+)% \u2192 ([\d.]+)% \((.+)\)$/, '$1 mwayi wa chikho $2% \u2192 $3% ($4)'],
      [/^([\d,]+) simulations with (\d+) fixed result\(s\)\. Small figures show the change vs\. the base forecast; changes within \u00B11%p \(\u2248\) are simulation noise\.$/,
        'Kuyerekeza $1 ndi zotsatira $2 zokhazikika. Manambala ang\'onoang\'ono akuonetsa kusintha poyerekeza ndi zoneneratu zoyambirira; kusintha mkati mwa \u00B11%p (\u2248) ndi kulakwitsa kwa kuyerekeza.'],
      [/^(.+): (\d+) remaining games \u00B7 results are from (.+)'s side\. Unpicked games are simulated as usual\.$/,
        '$1: masewera $2 otsala \u00B7 zotsatira ndi za mbali ya $3. Masewera osasankhidwa amayerekezedwa mwachizolowezi.'],
      [/^(\d+) left$/, '$1 zatsala'],
      [/^Show (\d+) more point totals below the safety line \u25BC$/, 'Onetsani mapointi enanso $1 pansi pa mzere wa chitetezo \u25BC'],
      [/^Only this result is fixed; ([\d,]+) simulations each\. Small figures show the change vs\. now; within \u00B1(\d+)%p \(\u2248\) is simulation noise\.$/,
        'Zotsatira izi zokha ndizokhazikika; kuyerekeza $1 pa chilichonse. Manambala ang\'onoang\'ono akuonetsa kusintha poyerekeza ndi pano; mkati mwa \u00B1$2%p (\u2248) ndi kulakwitsa kwa kuyerekeza.'],
      [/^The result swings Chizumulu's title chance by up to ([\d.]+)%p$/, 'Zotsatirazi zingasinthe mwayi wa Chizumulu wa chikho mpaka $1%p'],
      [/^Margin effect: winning by 2\+ vs\. by 1 is (.+); losing by 1 vs\. by 2\+ is (.+)$/,
        'Mphamvu ya kusiyana kwa zigoli: kupambana ndi 2+ poyerekeza ndi 1 ndi $1; kulephera ndi 1 poyerekeza ndi 2+ ndi $2'],
      [/^(.+) WIN$/, '$1 WAPAMBANA'], [/^(.+) win$/, '$1 wapambana'],
      // --- AI 정확도 ---
      [/^(WK|Wk|Week) ?(\d+) \u00B7 (.+) \((.+)\) vs (.+) \u2014 expected ([\d.]+), actual (\d+)$/, function (m, a, w, t, ha, o, e, ac) { return 'Sabata ' + w + ' \u00B7 ' + t + ' (' + T(ha) + ') vs ' + o + ' \u2014 zoyembekezeka ' + e + ', zenizeni ' + ac; }],
      [/^Pre-match: home (.+) \u00B7 draw (.+) \u00B7 away (.+) \u2192 (.+)$/, function (m, h, d, a, r) { return 'Masewera asanayambe: kwawo ' + h + ' \u00B7 kufanana ' + d + ' \u00B7 kunja ' + a + ' \u2192 ' + T(r); }],
      [/^Expected goals ([\d.]+) : ([\d.]+)$/, 'Zigoli zoyembekezeka $1 : $2'],
      [/^Auto-corrected from past prediction errors \(home (.+) \/ away (.+), n=(\d+)\)$/, 'Yasinthidwa yokha kuchokera ku zolakwika zakale za zoneneratu (kwawo $1 / kunja $2, n=$3)'],
      // --- 주차 / 컵 / 공유 ---
      [/^Wk (\d+)$/, 'Sabata $1'], [/^Wk (\d+) match$/, 'Masewera a sabata $1'],
      [/^Round (\d+): (.+)$/, 'Gawo $1: $2'], [/^Round (\d+) Result$/, 'Zotsatira za Gawo $1'], [/^Round (\d+) Matchday$/, 'Tsiku la Masewera la Gawo $1'],
      [/^(.+): Bye week$/, function (m, w) { return T(w) + ': Sabata yopuma'; }],
      [/^(.+): Chizumulu vs (.+) \((.+)\) Preview$/, function (m, w, o, ha) { return T(w) + ': Chizumulu vs ' + o + ' (' + T(ha) + ') Zoonetseratu'; }],
      [/^Next Match \u00B7 (.+)$/, function (m, w) { return 'Masewera Otsatira \u00B7 ' + T(w); }],
      [/^Cup \u00B7 (.+)$/, function (m, r) { return 'Chikho \u00B7 ' + T(r); }],
      [/^(\u26BD )?NRFA League One (.+) Results$/, function (m, i, w) { return (i || '') + 'Zotsatira za NRFA League One ' + T(w); }],
      [/^Downloaded (\d+) fixtures$/, 'Masewera $1 atsitsidwa'], [/^\((\d+) TBD excluded\)$/, '($1 osadziwika tsiku sanaphatikizidwe)'],
      [/^\[(.+)\] Chizumulu United FC vs (.+) \((.+)\)$/, function (m, c, o, ha) { return '[' + T(c) + '] Chizumulu United FC vs ' + o + ' (' + T(ha) + ')'; }],
      // --- 순위 / 다음 경기 ---
      [/^(\d+) pts clear of (.+)$/, 'Mapointi $1 patsogolo pa $2'], [/^(\d+) pts behind (.+)$/, 'Mapointi $1 kumbuyo kwa $2'],
      [/^Title chance if the next match \(vs (.+)\) is won, drawn or lost, and the change from the current chance\.$/, 'Mwayi wa chikho ngati masewera otsatira (vs $1) apambanidwa, afanana kapena alephera, ndi kusintha kuchokera ku mwayi wapano.'],
      [/^Numbers = starts in the last (\d+) matches\. Injuries and suspensions aren't factored in\.$/, 'Manambala = kuyamba mu masewera $1 aposachedwa. Kuvulala ndi kuletsedwa sizinaganiziridwe.'],
      [/^Starts ([\d.]+) \u00B7 Absent ([\d.]+) pts\/gm$/, 'Akayamba $1 \u00B7 Akasakhalapo $2 mapointi/masewera'],
      [/^Next (\d+): avg ([\d.]+) \u00B7 (.+)$/, function (m, n, a, t) { return 'Otsatira ' + n + ': avareji ' + a + ' \u00B7 ' + T(t); }],
      [/^Difficulty (\d+) \((.+)\)$/, function (m, l, t) { return 'Mlingo wa zovuta ' + l + ' (' + T(t) + ')'; }],
      [/^H2H \u00B7 (\d+) PLD$/, 'Maso ndi maso \u00B7 $1 asewera'], [/^(\d+) PLD$/, '$1 asewera'], [/^(\d+) played$/, '$1 asewera'],
      [/^([\d.]+) scored \/ ([\d.]+) conceded per game$/, 'Zopeza $1 / zolandira $2 pa masewera'],
      [/^(\d+)-game win streak$/, 'Mzere wa kupambana masewera $1'], [/^Unbeaten in (\d+)$/, 'Osagonja mu $1'], [/^(\d+)-game losing run$/, 'Mzere wa kulephera masewera $1'],
      [/^(\d+) of (\d+) matches played \((\d+) starts\) \u00B7 Tap a bar for match details$/, 'Masewera $1 mwa $2 asewera (oyamba $3) \u00B7 Dinani mzere kuti muone zambiri za masewera'],
      [/^of (\d+) teams$/, 'mwa matimu $1'], [/^Rank (\d+)$/, 'Malo $1'], [/^#(\d+) \u00B7 (\d+) pts$/, '#$1 \u00B7 mapointi $2'],
      [/^Last season after (\d+) games: (\d+) pts \(this season ([+\-\u2212]?\d+)\)$/, 'Nyengo yapitayi pambuyo pa masewera $1: mapointi $2 (nyengo ino $3)'],
      [/^\+(\d+) more$/, '+$1 enanso'],
      // --- 선수 ---
      [/^(\d+) assists?$/, 'Zothandizira $1'], [/^(\d+)-(\d+) club reached!$/, 'Gulu la $1-$2 lafika!'],
      [/^Season pace (\d+)G (\d+)A( \u00B7 on track for 10-10)?$/, function (m, g, a, t) { return 'Liwiro la nyengo ' + g + 'Z ' + a + 'T' + (t ? ' \u00B7 ili panjira ya 10-10' : ''); }],
      [/^(\d+)P \/ (\d+) apps$/, '$1P / masewera $2'],
      [/^Together (\d+) G ([\d.]+) pts vs other (\d+) G ([\d.]+) pts$/, 'Pamodzi $1 M $2 mapointi vs ena $3 M $4 mapointi'],
      [/^On Loan \(from (.+)\)$/, 'Wobwereketsa (kuchokera ku $1)'], [/^From: (.+)$/, 'Kuchokera ku: $1'],
      [/^(.+) \+(\d+) \u00B7 (\d+) goals$/, '$1 +$2 \u00B7 zigoli $3'], [/^(.+) \u00B7 (\d+) goals$/, '$1 \u00B7 zigoli $2'],
      [/^(.+) \u2014 last season GF ([\d.]+) \/ GA ([\d.]+) \u2192 now GF ([\d.]+) \/ GA ([\d.]+)$/, '$1 \u2014 nyengo yapitayi ZP $2 / ZL $3 \u2192 pano ZP $4 / ZL $5'],
      [/^(\d+) of (\d+) goals? (?:was|were) assisted$/, 'Zigoli $1 mwa $2 zinathandizidwa'], [/^\u00B7 (\d+) unconfirmed excluded$/, '\u00B7 $1 zosatsimikizika sizinaphatikizidwe'],
      [/^\uD83C\uDF96\uFE0F Started as captain (\d+) time\(s\)$/, '\uD83C\uDF96\uFE0F Anayamba ngati kapitao nthawi $1'],
      [/^\uD83C\uDFC5 Player of the Month (\d+) time\(s\)$/, '\uD83C\uDFC5 Osewera wa Mwezi nthawi $1'], [/^\u26BD Goal of the Month (\d+) time\(s\)$/, '\u26BD Zigoli za Mwezi nthawi $1'],
      [/^\uD83C\uDFD7\uFE0F? ?MOTM (\d+) time\(s\)$/, 'WOSEWERA BWINO nthawi $1'],
      [/^(\d+) of (\d+) goals have an assist logged$/, 'Zigoli $1 mwa $2 zili ndi thandizo lolembedwa'], [/^All (\d+) goals assisted$/, 'Zigoli zonse $1 zinathandizidwa'],
      [/^(?:The goal was|All \d+ goals were) unassisted$/, 'Zigoli zonse zinalibe wothandiza'], [/^(\d+) of (\d+) goals assisted$/, 'Zigoli $1 mwa $2 zinathandizidwa'],
      [/^\u203B W\/D\/L from Chizumulu's side \u00B7 all-time goals (\d+) for, (\d+) against \((.+)\)$/, '\u203B W/D/L kuchokera ku mbali ya Chizumulu \u00B7 zigoli za nthawi zonse $1 zopeza, $2 zolandira ($3)'],
      // --- 매직넘버 ---
      [/^(\d+) PTS LEFT$/, 'MAPOINTI $1 ZATSALA'], [/^Clinch with (\d+) more wins?$/, 'Tsimikizani ndi kupambana kwina $1'],
      [/^Cannot reach the top (\d+), even by winning out$/, 'Sangafike mu $1 oyamba, ngakhale atapambana zonse'], [/^\(top-(\d+) guarantee\)$/, '(chitsimikizo cha $1 oyamba)'],
      [/^(.+)'s max is (\d+) pts \u2192 reach (\d+)\+ to clinch(.*)$/, 'Mapointi apamwamba a $1 ndi $2 \u2192 fikani $3+ kuti mutsimikize$4'],
      [/^(\d+) rounds left \u00B7 (\d+) games$/, 'Magawo $1 atsala \u00B7 masewera $2'],
      [/^A conservative combined total of (.+)'s points gained and rivals' points dropped\.$/, 'Chiwerengero chosamala cha mapointi omwe $1 wapeza kuphatikiza mapointi omwe otsutsana naye ataya.'],
      [/^(.+) is enough$/, function (m, x) { return S(x) + ' ndikwanira'; }],
      [/^Plus (\d+) more result\(s\) from rounds not yet scheduled$/, 'Kuphatikiza zotsatira $1 zina kuchokera ku magawo osakonzedwa'],
      [/^(.+)'s remaining games that help you$/, 'Masewera otsala a $1 omwe amakuthandizani']
    ];
    for (var i = 0; i < P.length; i++) window.NY_PATTERNS.push(P[i]);
  })();

  // ============================================================
  // [F] 리포트 본문·예측 코멘트 — 문장 은행(pickSentence 등)에서 조립되는 긴 문장
  // ============================================================
  (function () {
    if (!window.NY_PATTERNS || !window.NY_T) return;
    var T = window.NY_T;
    // 영어 문장 템플릿(정규식, 빈칸은 (.+?))을 치체와어 문장($1, $2 …)으로 바꿉니다. 팀·선수 이름, 숫자, 순위(1st→Wa 1)는 T()로 처리합니다.
    function R(src, ny) {
      window.NY_PATTERNS.push([new RegExp(src), function (m) {
        var c = Array.prototype.slice.call(arguments, 1);
        return ny.replace(/\$(\d)/g, function (_, i) { return T(c[i - 1]); });
      }]);
    }
    R("^(.+?) above also won this week, keeping the gap at (.+?) points\\.$", "$1 yomwe ili pamwamba nayonso yapambana sabata ino, kusunga kusiyana pa mapointi $2.");
    R("^(.+?) above dropped points, narrowing the gap to (.+?) points\\.$", "$1 yomwe ili pamwamba yataya mapointi, kuchepetsa kusiyana kufika pa mapointi $2.");
    R("^(.+?) below also picked up a win — the chase is on, with just (.+?) points between the sides\\.$", "$1 yomwe ili pansi nayonso yapambana — kuthamangitsana kukupitirira, pali mapointi $2 okha pakati pa matimuwa.");
    R("^(.+?) below failed to gain ground this week — the gap stands at (.+?) points\\.$", "$1 yomwe ili pansi sinakwere sabata ino — kusiyana kuli pa mapointi $2.");
    R("^Elsewhere in the round, (.+?) added another twist to the picture at the top of the table\\.$", "Kwina mu gawoli, $1 yawonjezera zodabwitsa zina pa zomwe zikuchitika pamwamba pa tebulo.");
    R("^Elsewhere that round, (.+?) is also being played, so results across the board could reshape the top of the table\\.$", "Kwina mu gawolo, $1 nawonso akuseweredwa, choncho zotsatira m'masewera onse zingasinthe pamwamba pa tebulo.");
    R("^With top spot — the sole promotion place — on the line for one of these sides, this fixture could prove pivotal in the promotion race\\.$", "Popeza malo oyamba — malo okhawo okwera ligi — ali pachiwopsezo kwa limodzi mwa matimuwa, masewerawa angakhale ofunika kwambiri pa mpikisano wokwera ligi.");
    R("^With the league's top spot at stake, whoever wins here takes a real step forward in the promotion race\\.$", "Malo oyamba a ligi ali pachiwopsezo, wopambana pano atenga sitepe yeniyeni pa mpikisano wokwera ligi.");
    R("^The result had an immediate knock\\-on effect at the top of the table, where the single promotion spot is being contested\\.$", "Zotsatirazi zinakhudza nthawi yomweyo pamwamba pa tebulo, komwe malo okhawo okwera ligi akupikisanidwa.");
    R("^With both sides sitting near the top of the table, this is a heavyweight clash that could shape the promotion race\\.$", "Popeza matimu onse awiri ali pafupi ndi pamwamba pa tebulo, ili ndi masewera akulu omwe angakhudze mpikisano wokwera ligi.");
    R("^As a top\\-of\\-the\\-table meeting, this single result could either close the gap or stretch it further apart\\.$", "Monga kukumana kwa pamwamba pa tebulo, zotsatira zimodzi izi zingachepetse kapena kukulitsa kusiyana.");
    R("^As a clash between two sides near the top, the result carried real weight for the promotion picture\\.$", "Monga kukumana kwa matimu awiri omwe ali pafupi ndi pamwamba, zotsatirazi zinali zofunika kwenikweni pa mpikisano wokwera ligi.");
    R("^With one side sitting in the relegation zone, this match matters just as much for survival as for the table above\\.$", "Popeza limodzi mwa matimuwa lili m'malo otsika, masewerawa ndi ofunika kwa kupulumuka monga momwe alili kwa tebulo la pamwamba.");
    R("^With the relegation zone within touching distance, this single result could swing the survival picture significantly\\.$", "Popeza malo otsika ali pafupi kwambiri, zotsatira zimodzi izi zingasinthe kwambiri za kupulumuka.");
    R("^With relegation\\-threatened opposition involved, the result also had implications at the bottom of the table\\.$", "Popeza wotsutsana naye ali pachiwopsezo chotsika, zotsatirazi zinakhudzanso pansi pa tebulo.");
    R("^Chizumulu currently top the table on (.+?) points, holding the sole promotion spot\\.$", "Chizumulu pakadali pano ali pamwamba pa tebulo ndi mapointi $1, atakhala pa malo okhawo okwera ligi.");
    R("^The gap to league leaders (.+?) stands at (.+?) point(?:s)?\\.$", "Kusiyana ndi atsogoleri a ligi $1 kuli pa mapointi $2.");
    R("^Chizumulu trail leaders (.+?) by (.+?) point(?:s)? — a gap that could shrink or grow depending on how this one goes\\.$", "Chizumulu ali kumbuyo kwa atsogoleri $1 ndi mapointi $2 — kusiyana komwe kungachepe kapena kuchuluke kutengera momwe masewerawa apitire.");
    R("^(.+?)'s top scorer is (.+?) with (.+?) goals, while (.+?) leads the line for (.+?) with (.+?)\\.$", "Wopeza zigoli kwambiri wa $1 ndi $2 ndi zigoli $3, pomwe $4 akutsogolera kuukira kwa $5 ndi $6.");
    R("^(.+?) leads the way for (.+?) with (.+?) goals this season\\.$", "$1 akutsogolera $2 ndi zigoli $3 nyengo ino.");
    R("^Chizumulu are averaging (.+?) goals scored and (.+?) conceded per game, compared with (.+?) scored and (.+?) conceded for (.+?)\\.$", "Chizumulu akupeza avareji ya zigoli $1 ndi kulandira $2 pa masewera, poyerekeza ndi $3 zopeza ndi $4 zolandira za $5.");
    R("^It also shapes up as a clash between attack and defense — (.+?) vs (.+?) goals scored per game, and (.+?) vs (.+?) conceded, for Chizumulu and (.+?) respectively\\.$", "Ilinso ngati kukumana kwa kuukira ndi kuteteza — zigoli zopeza pa masewera $1 vs $2, ndi zolandira $3 vs $4, kwa Chizumulu ndi $5 motsatana.");
    R("^With (.+?) game(?:s)? in hand still to play, Chizumulu's position could shift up or down purely on the back of other results, regardless of how this one goes\\.$", "Ndi masewera $1 otsala oti asewere, malo a Chizumulu angakwere kapena kutsika chifukwa cha zotsatira za ena zokha, mosasamala kanthu momwe masewerawa apitire.");
    R("^A backlog of (.+?) postponed fixture(?:s)? means the table position can move even without Chizumulu kicking a ball\\.$", "Masewera $1 osinthidwa otsala amatanthauza kuti malo pa tebulo angasinthe ngakhale Chizumulu asasewere.");
    R("^Even after this result, Chizumulu still have (.+?) game(?:s)? in hand, so the table could still shift once those fixtures are played out\\.$", "Ngakhale pambuyo pa zotsatirazi, Chizumulu akadali ndi masewera $1 otsala, choncho tebulo lingasinthebe masewerawo akasewera.");
    R("^Chizumulu had no fixture this week due to the bye round — a chance to rest up and watch how the rest of the league moved\\.$", "Chizumulu analibe masewera sabata ino chifukwa cha gawo lopuma — mwayi wopuma ndi kuyang'ana momwe ligi yonse yasunthira.");
    R("^Chizumulu were in control from start to finish for a dominant win\\.$", "Chizumulu anali olamulira kuyambira poyamba mpaka kumapeto pa kupambana kwakukulu.");
    R("^A one\\-sided affair saw the three points secured with ease\\.$", "Masewera osagwirizana mbali zonse anatsimikizira mapointi atatu mosavuta.");
    R("^A tight one\\-goal margin was enough to see the game out\\.$", "Kusiyana kwa zigoli chimodzi kunakwanira kumaliza masewerawa.");
    R("^It was a nervy, narrow win, but concentration held to the final whistle\\.$", "Kunali kupambana kovutitsa ndi kocheperako, koma kuika maganizo kunakhalabe mpaka mluzu womaliza.");
    R("^A composed performance was enough to secure the three points\\.$", "Kusewera mwabata kunakwanira kutsimikizira mapointi atatu.");
    R("^A balanced contest ultimately swung Chizumulu's way\\.$", "Masewera ofanana mphamvu pamapeto pake anapindulira Chizumulu.");
    R("^Goals flowed on both sides, but neither side could find a winner\\.$", "Zigoli zinapezeka mbali zonse ziwiri, koma palibe timu yomwe inapeza wopambana.");
    R("^A tightly fought contest ended in a share of the spoils\\.$", "Masewera ovuta kwambiri anatha pogawana mapointi.");
    R("^It was a heavy, one\\-sided defeat\\.$", "Unali kugonja kwakukulu kosagwirizana mbali zonse.");
    R("^A narrow one\\-goal margin decided the game\\.$", "Kusiyana kochepa kwa zigoli chimodzi kunasankha masewerawo.");
    R("^A spirited effort wasn't enough to avoid defeat\\.$", "Khama lalikulu silinakwanire kupewa kugonja.");
    R("^(.+?) was the star of the day with a (.+?)\\-goal haul\\.$", "$1 anali nyenyezi ya tsikulo ndi zigoli $2.");
    R("^The result lifted Chizumulu (.+?) place(?:s)? up the table, from (.+?) to (.+?)\\.$", "Zotsatirazi zinakweza Chizumulu malo $1 pa tebulo, kuchokera pa $2 kufika pa $3.");
    R("^The table now reads (.+?), down (.+?) place(?:s)? from (.+?)\\.$", "Tebulo tsopano likuonetsa $1, pansi malo $2 kuchokera pa $3.");
    R("^This was the first away win of the season — a potential turning point for a side that had leaned heavily on home form\\.$", "Uku kunali kupambana koyamba kunja kwa nyengo — mwina kusintha kwakukulu kwa timu yomwe imadalira kwambiri kachitidwe ka kwawo.");
    R("^This win ended a run of (.+?) away games without a win — a much\\-needed breakthrough on the road\\.$", "Kupambana kumeneku kunathetsa mzere wa masewera $1 akunja osapambana — kupambana kofunikira kwambiri kunja.");
    R("^It also marked the team's first away goal of the season — a psychological boost on unfamiliar turf\\.$", "Kunalinso zigoli zoyamba za timu kunja kwa nyengo — chilimbikitso chamaganizo pa bwalo losadziwika.");
    R("^The unbeaten home run continues — sides that consistently protect home points tend to hold the edge come the business end of the season\\.$", "Mzere wosagonja kwawo ukupitirira — matimu omwe amateteza mapointi akwawo nthawi zonse amakonda kukhala patsogolo pafupi ndi mapeto a nyengo.");
    R("^A clean sheet was kept at the back — and the more clean sheets pile up, the more points tend to follow\\.$", "Osalola zigoli anasungidwa kumbuyo — ndipo osalola zigoli akamachuluka, mapointi amakonda kutsatira.");
    R("^That's (.+?) wins in a row — momentum is firmly on Chizumulu's side\\.$", "Awa ndi kupambana $1 motsatana — mphamvu ili kumbali ya Chizumulu.");
    R("^The unbeaten run has been extended to (.+?) games\\.$", "Mzere wosagonja wafika pa masewera $1.");
    R("^This is a (.+?) straight defeat — a difficult run that needs turning around soon\\.$", "Uku ndi kugonja $1 motsatana — mzere wovuta womwe uyenera kusinthidwa posachedwa.");
    R("^How (.+?) — currently just above Chizumulu — fare here could shrink or stretch the current (.+?)\\-point gap\\.$", "Momwe $1 — omwe ali pamwamba pa Chizumulu pakadali pano — achitire pano zingachepetse kapena kukulitsa kusiyana kwa mapointi $2.");
    R("^Whether (.+?) — right behind Chizumulu — pick up points here will shape how tight the chase \\(currently (.+?) points\\) becomes\\.$", "Kaya $1 — omwe ali kumbuyo kwa Chizumulu — apeza mapointi pano kudzatsimikizira momwe kuthamangitsana (pakadali pano mapointi $2) kudzakhalire kolimba.");
    R("^Chizumulu currently sit (.+?), above (.+?) \\((.+?)\\) by (.+?) point(?:s)?\\.$", "Chizumulu pakadali pano ali pa $1, pamwamba pa $2 ($3) ndi mapointi $4.");
    R("^(.+?) sit above Chizumulu in the table \\((.+?) vs (.+?)\\), making this a tough test on paper — the gap is (.+?) point(?:s)?\\.$", "$1 ali pamwamba pa Chizumulu pa tebulo ($2 vs $3), zomwe zimapangitsa kukhala mayeso ovuta papepala — kusiyana kuli mapointi $4.");
    R("^Both sides are level in the table at (.+?), so this result could shuffle the standings either way\\.$", "Matimu onse ali pa malo ofanana pa tebulo, $1, choncho zotsatirazi zingasinthe udindo mbali iliyonse.");
    R("^Chizumulu head into this one on a (.+?)\\-game winning streak, looking to keep the momentum going\\.$", "Chizumulu alowa m'masewerawa ndi mzere wopambana masewera $1, akufuna kupitiriza mphamvu.");
    R("^On the back of (.+?) straight wins, the question is whether that momentum can carry over into this fixture\\.$", "Atapambana $1 motsatana, funso ndi lakuti kodi mphamvu imeneyo ingapitirire m'masewerawa.");
    R("^An unbeaten run of (.+?) games has Chizumulu heading in with confidence\\.$", "Mzere wosagonja wa masewera $1 umapatsa Chizumulu chidaliro polowa.");
    R("^Chizumulu have been stuck in a win\\-lose\\-win\\-lose pattern lately, making the next result tough to call\\.$", "Chizumulu akhala mu mchitidwe wopambana-kulephera-kupambana-kulephera posachedwapa, zomwe zimapangitsa zotsatira zotsatira kukhala zovuta kuneneratu.");
    R("^Results have swung back and forth recently, so building any real consistency is the priority heading into this one\\.$", "Zotsatira zasinthasintha posachedwapa, choncho kukhala okhazikika ndi cholinga chachikulu polowa m'masewerawa.");
    R("^Recent results haven't gone Chizumulu's way, so this is a chance to turn things around\\.$", "Zotsatira zaposachedwa sizinatsatire Chizumulu, choncho uwu ndi mwayi wosintha zinthu.");
    R("^Chizumulu arrive in poor recent form and badly need a result to arrest the slide\\.$", "Chizumulu afika ali mu kachitidwe koyipa posachedwapa ndipo akufunika kwambiri zotsatira zoletsa kutsika.");
    R("^Chizumulu won the earlier meeting this season (.+?)\\-(.+?) \\((.+?)\\), giving them the edge in this rivalry\\.$", "Chizumulu anapambana kukumana koyamba nyengo ino $1-$2 ($3), zomwe zimawapatsa mwayi pa mpikisano uwu.");
    R("^(.+?) won the earlier meeting this season (.+?)\\-(.+?) \\((.+?)\\) — Chizumulu will be looking for revenge\\.$", "$1 anapambana kukumana koyamba nyengo ino $2-$3 ($4) — Chizumulu adzafuna kubwezera.");
    R("^The earlier meeting this season \\((.+?)\\) finished level, (.+?)\\-(.+?)\\.$", "Kukumana koyamba nyengo ino ($1) kunatha ofanana, $2-$3.");
    R("^This will be the first meeting between the two sides this season\\.$", "Uku kudzakhala kukumana koyamba pakati pa matimu awiriwa nyengo ino.");
    R("^Playing at home, Chizumulu should draw extra energy from the crowd\\.$", "Posewera kwawo, Chizumulu ayenera kupeza mphamvu yowonjezera kuchokera kwa anthu.");
    R("^On the road, how well Chizumulu handle the away\\-day challenge will be key\\.$", "Kunja, momwe Chizumulu angathanirane ndi vuto la kusewera kunja zidzakhala zofunika.");
    R("^How composed Chizumulu look away from home is likely to be the deciding factor in this one\\.$", "Momwe Chizumulu adzaonekere mwabata kunja kwawo ndi chinthu chomwe chingasankhe masewerawa.");
    R("^GOALS PER MATCH \\(both teams\\)$", "ZIGOLI PA MASEWERA (matimu onse)");
    R("^GAMES PER TEAM \\(full season\\)$", "MASEWERA PA TIMU (nyengo yonse)");
    R("^Tap a column header to sort \\(tap again to reverse\\)\\. Per game = goals ÷ games played by the player's team \\(individual appearances aren't tracked for most clubs\\)\\. Projected = per game × (.+?) season games, assuming the current pace holds\\. Last (.+?) rounds = goals in the latest (.+?) rounds; team share = % of the team's total goals; trend = goals per round from round 1\\.$", "Dinani mutu wa mzati kuti musankhe (dinaninso kuti musinthe). Pa masewera = zigoli ÷ masewera omwe timu ya wosewera yasewera (masewera a wosewera aliyense sakulembedwa m'magulu ambiri). Zoyembekezeka = pa masewera × masewera $1 a nyengo, poganiza kuti liwiro lapano lipitirira. Magawo $2 aposachedwa = zigoli m'magawo $3 aposachedwa; gawo la timu = % ya zigoli zonse za timu; kukwera/kutsika = zigoli pa gawo kuyambira gawo 1.");
    R("^No bye round is scheduled for this team yet\\.$", "Palibe gawo lopuma lokonzedwa kwa timu iyi panobe.");
    R("^Both sides look evenly matched — a draw is the single most likely result \\((.+?)%\\)\\.$", "Matimu onse akuoneka ofanana mphamvu — kufanana ndi zotsatira zomwe zingachitike kwambiri ($1%).");
    R("^(.+?) has a slight edge \\((.+?)% win chance\\), but this looks like a close, even contest\\.$", "$1 ali ndi mwayi wocheperako ($2% mwayi wopambana), koma izi zikuoneka ngati masewera ofanana ndi ovuta.");
    R("^(.+?) is projected as the moderate favorite \\((.+?)% win chance\\)\\.$", "$1 akuyembekezeka kukhala wokondedwa wapakati ($2% mwayi wopambana).");
    R("^(.+?) looks like a clear favorite here \\((.+?)% win chance\\)\\.$", "$1 akuoneka ngati wokondedwa woonekeratu pano ($2% mwayi wopambana).");
    R("^(.+?)'s attack rating sits well above league average, lifting its expected goals\\.$", "Mphamvu youkira ya $1 ili pamwamba kwambiri pa avareji ya ligi, zomwe zikukweza zigoli zake zoyembekezeka.");
    R("^(.+?) concedes at a below\\-average rate, which could keep the opposition quiet\\.$", "$1 imalandira zigoli zochepa kuposa avareji, zomwe zingakhazikitse wotsutsana naye.");
    R("^(.+?) also sits (.+?) places higher in the table, so the standings favor the same outcome\\.$", "$1 alinso malo $2 pamwamba pa tebulo, choncho udindo ukuthandizira zotsatira zomwezo.");
    R("^(.+?) also arrives in good form, with (.+?) wins in its last (.+?) games\\.$", "$1 afikanso ali mu kachitidwe kabwino, atapambana $2 mu masewera ake $3 aposachedwa.");
    R("^(.+?) arrives in good form too, with (.+?) wins in its last (.+?) games — a potential upset factor\\.$", "$1 afikanso ali mu kachitidwe kabwino, atapambana $2 mu masewera ake $3 aposachedwa — chinthu chomwe chingabweretse zodabwitsa.");
  })();

  // ============================================================
  // 시작: 모든 사전이 등록된 뒤 실행 (반드시 파일 맨 끝)
  // ============================================================
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
