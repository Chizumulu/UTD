// =====================================================================
// a11y.js — 접근성 보강 모듈 (키보드 · 스크린리더)
// =====================================================================
// app.js(약 2만 줄)는 건드리지 않고, 화면이 그려진 "결과 DOM"을 보고 부족한 접근성 속성을
// 덧붙이는 방식입니다. 정적 HTML뿐 아니라 app.js가 나중에 만들어 넣는 카드·표·차트도
// MutationObserver가 새로 들어온 노드만 골라 같은 규칙으로 처리합니다.
//
// 하는 일
//   1) 스킵 링크 대상(#mainContent)·상태 안내용 라이브 리전(#a11yAnnouncer) 준비
//   2) onclick만 달린 div/span/td/tr  → role="button" + tabindex="0" + Enter/Space 동작
//   3) ⓘ 설명 버튼                    → 이름·aria-expanded·aria-controls, Esc로 닫기
//   4) 탭                             → ←/→/Home/End 이동, 구단정보 탭바 role/aria-selected
//   5) 현재 화면 표시                  → 하단·사이드 내비에 aria-current, 화면 전환 음성 안내
//   6) 모달                           → role="dialog" aria-modal, 열리면 포커스 이동·배경 inert,
//                                       닫히면 열기 전 위치로 포커스 복귀
//   7) 표 머리글                       → <th scope="col">
//   8) SVG 차트                        → 의미 없는 작은 아이콘은 숨기고, 큰 차트는 제목으로 이름 붙임
//
// 설계 메모
//   - 이 파일은 data.js/app.js 이후에 로드돼도, 이전에 로드돼도 상관없습니다(DOM만 봄).
//   - 기존 규칙을 덮어쓰지 않습니다. 이미 role/tabindex/aria-label이 있는 요소는 건드리지 않습니다.
//   - 언어는 <html data-lang="ko|en"> (app.js의 syncLangAttr)를 그때그때 읽습니다.
// =====================================================================
(function () {
  'use strict';

  function isKo() { return document.documentElement.getAttribute('data-lang') !== 'en'; }
  function T(ko, en) { return isKo() ? ko : en; }
  var uid = 0;
  function ensureId(el, prefix) { if (!el.id) el.id = prefix + (++uid); return el.id; }
  function has(el, attr) { return el.hasAttribute(attr); }

  // ---------------------------------------------------------------------
  // 1) 음성 안내용 라이브 리전
  // ---------------------------------------------------------------------
  var announcer = null;
  function ensureAnnouncer() {
    if (announcer && document.body.contains(announcer)) return announcer;
    announcer = document.getElementById('a11yAnnouncer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'a11yAnnouncer';
      announcer.className = 'sr-only';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    return announcer;
  }
  function announce(msg) {
    var el = ensureAnnouncer();
    el.textContent = '';
    // 같은 문구를 연속으로 보내도 다시 읽히도록 한 틱 쉬고 넣습니다.
    setTimeout(function () { el.textContent = msg; }, 60);
  }

  // ---------------------------------------------------------------------
  // 2) onclick만 달린 비-버튼 요소를 키보드로 쓸 수 있게
  // ---------------------------------------------------------------------
  var NATIVE = /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL|OPTION|DIALOG)$/;
  var TABLE_PART = /^(TR|TD|TH)$/;
  var INNER_INTERACTIVE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
  // "클릭을 삼키기만 하는" 핸들러(툴팁 본문 등)와 "배경 클릭 닫기" 패턴은 버튼이 아닙니다.
  var NON_TRIGGER = /^\s*event\.stopPropagation\(\)\s*;?\s*$|event\.target\s*===\s*this/;

  function isPseudoButton(el) {
    if (el.nodeType !== 1 || NATIVE.test(el.tagName)) return false;
    if (el.namespaceURI === 'http://www.w3.org/2000/svg' && el.tagName.toLowerCase() === 'svg') return false;
    if (has(el, 'role') || has(el, 'tabindex') || has(el, 'aria-hidden')) return false;
    if (el.classList.contains('modal-overlay') || el.classList.contains('info-tooltip')) return false;
    var oc = el.getAttribute('onclick') || '';
    if (NON_TRIGGER.test(oc)) return false;
    // 안쪽에 이미 버튼/링크가 있는 큰 컨테이너는 포커스 대상이 되면 중복·중첩이 됩니다.
    if (el.querySelector(INNER_INTERACTIVE)) return false;
    return true;
  }

  function enhancePseudoButton(el) {
    if (!isPseudoButton(el)) return;
    // 표 구조(tr/td)에 role=button을 주면 표 의미가 깨지므로 tabindex만 줍니다.
    if (!TABLE_PART.test(el.tagName)) el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('data-a11y-btn', '1');
  }

  // ⓘ 설명 버튼 ------------------------------------------------------------
  function infoTargetOf(btn) {
    var m = /toggleInfoTooltip\(\s*event\s*,\s*'([^']+)'/.exec(btn.getAttribute('onclick') || '');
    return m ? document.getElementById(m[1]) : null;
  }
  function enhanceInfoButton(btn) {
    if (has(btn, 'data-a11y-info')) return;
    btn.setAttribute('data-a11y-info', '1');
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    if (!has(btn, 'aria-label')) btn.setAttribute('aria-label', T('설명 보기', 'Show explanation'));
    var tip = infoTargetOf(btn);
    if (tip) {
      btn.setAttribute('aria-controls', ensureId(tip, 'a11yTip'));
      btn.setAttribute('aria-expanded', tip.classList.contains('show') ? 'true' : 'false');
      if (!has(tip, 'role')) tip.setAttribute('role', 'note');
    }
  }
  function syncInfoExpanded() {
    var btns = document.querySelectorAll('.info-icon-btn[aria-controls]');
    for (var i = 0; i < btns.length; i++) {
      var tip = document.getElementById(btns[i].getAttribute('aria-controls'));
      if (tip) btns[i].setAttribute('aria-expanded', tip.classList.contains('show') ? 'true' : 'false');
    }
  }
  // 언어를 바꾸면 ⓘ 버튼 이름도 따라가도록 갱신
  function refreshInfoLabels() {
    var btns = document.querySelectorAll('.info-icon-btn[data-a11y-info]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-label', T('설명 보기', 'Show explanation'));
  }

  // ---------------------------------------------------------------------
  // 3) 탭
  // ---------------------------------------------------------------------
  // 구단정보 탭바: 마크업에 role이 없어서 여기서 채웁니다.
  function enhanceTeamInfoTabBar() {
    var bar = document.getElementById('teamInfoTabBar');
    if (!bar || has(bar, 'data-a11y-tabs')) return;
    bar.setAttribute('data-a11y-tabs', '1');
    bar.setAttribute('role', 'tablist');
    if (!has(bar, 'aria-label')) bar.setAttribute('aria-label', T('구단 정보 메뉴', 'Club info sections'));
    var btns = bar.querySelectorAll('.team-info-tab-btn');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('role', 'tab');
    var ind = bar.querySelector('.ti-tab-indicator');
    if (ind) ind.setAttribute('aria-hidden', 'true');
    syncTeamInfoTabs();
  }
  function syncTeamInfoTabs() {
    var bar = document.getElementById('teamInfoTabBar');
    if (!bar) return;
    var btns = bar.querySelectorAll('.team-info-tab-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-selected', btns[i].classList.contains('active') ? 'true' : 'false');
    }
    var ind = bar.querySelector('.ti-tab-indicator');
    if (ind && !has(ind, 'aria-hidden')) ind.setAttribute('aria-hidden', 'true');
  }

  // ←/→/↑/↓/Home/End 로 탭 이동 (이동하면 바로 활성화 — 이 사이트 탭은 전환 비용이 작음)
  function onTabKeydown(ev) {
    var t = ev.target;
    if (!t || t.getAttribute('role') !== 'tab') return;
    var key = ev.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(key) < 0) return;
    var list = t.closest('[role="tablist"]');
    if (!list) return;
    var tabs = Array.prototype.filter.call(list.querySelectorAll('[role="tab"]'), function (b) {
      return !b.disabled && b.getAttribute('aria-disabled') !== 'true' && b.offsetParent !== null;
    });
    var idx = tabs.indexOf(t);
    if (idx < 0 || tabs.length < 2) return;
    var next = idx;
    if (key === 'ArrowLeft' || key === 'ArrowUp') next = (idx - 1 + tabs.length) % tabs.length;
    else if (key === 'ArrowRight' || key === 'ArrowDown') next = (idx + 1) % tabs.length;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = tabs.length - 1;
    ev.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  }

  // ---------------------------------------------------------------------
  // 4) 현재 화면 표시 + 화면 전환 음성 안내
  // ---------------------------------------------------------------------
  var NAV_SELECTORS = '#mTabbar .m-tab, #viewToggleWrap .view-toggle-btn';
  var lastNavLabel = null;
  function navLabel(btn) {
    var l = btn.querySelector('.lbl, .m-tab-lbl');
    return ((l || btn).textContent || '').replace(/\s+/g, ' ').trim();
  }
  function syncNav(announceChange) {
    var btns = document.querySelectorAll(NAV_SELECTORS);
    var active = null;
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var on = b.classList.contains('is-active') || b.classList.contains('active');
      if (on) { b.setAttribute('aria-current', 'page'); if (!active || b.closest('#mTabbar')) active = b; }
      else b.removeAttribute('aria-current');
    }
    if (active) {
      var label = navLabel(active);
      if (announceChange && lastNavLabel && label && label !== lastNavLabel) announce(label + T(' 화면', ' view'));
      lastNavLabel = label || lastNavLabel;
    }
  }

  // ---------------------------------------------------------------------
  // 5) 모달: role/이름, 포커스 이동·복귀, 배경 inert
  // ---------------------------------------------------------------------
  var lastFocusBefore = null;
  var openOverlays = [];

  function enhanceOverlay(ov) {
    if (has(ov, 'data-a11y-modal')) return;
    ov.setAttribute('data-a11y-modal', '1');
    var content = ov.querySelector('.modal-content') || ov.firstElementChild;
    if (content && !has(content, 'role')) {
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
    }
    if (content && !has(content, 'aria-labelledby') && !has(content, 'aria-label')) {
      var h = content.querySelector('h1, h2, h3, [id$="Title"]');
      if (h && (h.textContent || '').trim()) content.setAttribute('aria-labelledby', ensureId(h, 'a11yDlgTitle'));
      else content.setAttribute('aria-label', T('상세 정보', 'Details'));
    }
    // 제목이 나중에 채워지는 모달(내용이 열 때마다 바뀜)은 열릴 때 한 번 더 확인합니다.
    ovObserver.observe(ov, { attributes: true, attributeFilter: ['style'] });
    syncOverlay(ov);   // 이미 열린 채로 만들어진 팝업(소식·경기일 안내 등)도 처리
  }

  function isVisible(ov) {
    return ov.style.display !== 'none' && ov.getClientRects().length > 0;
  }

  var BG_SKIP = /^(SCRIPT|STYLE|LINK|META|DIALOG|NOSCRIPT)$/;
  // 열린 모달 뒤의 "배경"만 inert로 만듭니다.
  // 모달이 <body> 바로 아래가 아니라 .app-shell > #mainContent 안쪽에 들어 있는 경우가 많아서,
  // body의 자식만 보면 모달을 품은 .app-shell 전체가 inert가 되어 모달 안의 클릭·포커스가 전부 막힙니다.
  // 그래서 "열린 모달 + 그 모든 조상"을 보존 경로로 잡고, 그 경로 위 각 단계의 나머지 형제들만 inert 처리합니다.
  function isKeepNode(k) {
    return has(k, 'data-a11y-keep') ||
      k.getAttribute('role') === 'status' || k.getAttribute('role') === 'alert' ||
      k.id === 'shareToast' || k.id === 'a11yAnnouncer' || k.classList.contains('skip-link');
  }
  function updateInert() {
    var open = Array.prototype.filter.call(document.querySelectorAll('.modal-overlay[data-a11y-modal]'), isVisible);
    openOverlays = open;

    // 이전에 이 모듈이 걸어 둔 inert는 모두 풀고 다시 계산합니다.
    var prev = document.querySelectorAll('[data-a11y-inert]');
    for (var p = 0; p < prev.length; p++) { prev[p].removeAttribute('data-a11y-inert'); prev[p].inert = false; }
    if (!open.length) return;

    var onPath = [];
    open.forEach(function (ov) {
      for (var n = ov; n && n !== document.documentElement; n = n.parentElement) {
        if (onPath.indexOf(n) < 0) onPath.push(n);
      }
    });
    onPath.forEach(function (node) {
      if (open.indexOf(node) >= 0) return;   // 열린 모달 자기 내용은 건드리지 않습니다.
      var kids = node.children;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (onPath.indexOf(k) >= 0 || BG_SKIP.test(k.tagName) || isKeepNode(k)) continue;
        k.setAttribute('data-a11y-inert', '1');
        k.inert = true;
      }
    });
  }

  function syncOverlay(ov) {
    var visible = isVisible(ov);
    var was = ov._a11yOpen === true;
    if (visible && !was) {
      ov._a11yOpen = true;
      // 제목이 이 시점에 채워졌을 수 있어 이름을 다시 연결
      var c = ov.querySelector('.modal-content');
      if (c && !has(c, 'aria-label')) {
        var h = c.querySelector('h1, h2, h3, [id$="Title"]');
        if (h && (h.textContent || '').trim()) c.setAttribute('aria-labelledby', ensureId(h, 'a11yDlgTitle'));
      }
      // 다른 모달 위에 겹쳐 열린 경우는 "원래 있던 자리"를 덮어쓰지 않습니다.
      var ae = document.activeElement;
      if (!openOverlays.length && ae && ae !== document.body && !ov.contains(ae)) lastFocusBefore = ae;
      updateInert();
      // 열림 애니메이션 한 프레임 뒤에 포커스를 안으로 옮깁니다.
      requestAnimationFrame(function () {
        var target = ov.querySelector('[autofocus]') || c || ov;
        if (target && !has(target, 'tabindex') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
        try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
      });
    } else if (!visible && was) {
      ov._a11yOpen = false;
      updateInert();
      if (!openOverlays.length && lastFocusBefore && document.body.contains(lastFocusBefore)) {
        var back = lastFocusBefore;
        lastFocusBefore = null;
        try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
      }
    }
  }

  var ovObserver = new MutationObserver(function (records) {
    records.forEach(function (r) { syncOverlay(r.target); });
  });

  // ---------------------------------------------------------------------
  // 6) 표 머리글 · SVG
  // ---------------------------------------------------------------------
  function enhanceTableHeaders(root) {
    var ths = root.tagName === 'TH' ? [root] : (root.querySelectorAll ? root.querySelectorAll('th:not([scope])') : []);
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      if (has(th, 'scope')) continue;
      var tr = th.parentElement;
      var inHead = th.closest('thead') || (tr && Array.prototype.every.call(tr.children, function (c) { return c.tagName === 'TH'; }));
      th.setAttribute('scope', inHead ? 'col' : 'row');
    }
  }

  function nearestHeadingText(svg) {
    var box = svg.closest('.ti-card, .card, section, .stat-card, [class*="-card"], [class*="chart"]');
    var scope = box || svg.parentElement;
    for (var hops = 0; scope && hops < 3; hops++, scope = scope.parentElement) {
      var h = scope.querySelector('.ti-section-title, [class*="title"], h2, h3, h4');
      if (h && !h.contains(svg)) {
        var txt = (h.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && txt.length <= 80) return txt;
      }
    }
    // 바로 앞 형제 중 제목
    var p = svg.parentElement && svg.parentElement.previousElementSibling;
    if (p) {
      var t2 = (p.textContent || '').replace(/\s+/g, ' ').trim();
      if (t2 && t2.length <= 80 && /title|heading|head/i.test(p.className + ' ' + p.tagName)) return t2;
    }
    return '';
  }

  function enhanceSvg(svg) {
    if (has(svg, 'data-a11y-svg')) return;
    svg.setAttribute('data-a11y-svg', '1');
    if (has(svg, 'aria-hidden') || has(svg, 'role') || has(svg, 'aria-label') || has(svg, 'aria-labelledby')) return;
    // 버튼·링크 안의 아이콘은 글자 라벨이 따로 있으므로 장식으로 처리
    if (svg.closest('button, a, [role="button"], [role="tab"]')) { svg.setAttribute('aria-hidden', 'true'); return; }
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    var w = vb.length === 4 ? vb[2] : parseFloat(svg.getAttribute('width')) || 0;
    var h = vb.length === 4 ? vb[3] : parseFloat(svg.getAttribute('height')) || 0;
    if (w && h && w <= 48 && h <= 48) { svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); return; }
    // 안에 포커스 가능한 요소가 있는 인터랙티브 차트는 role=img로 덮지 않습니다(안쪽이 가려짐).
    if (svg.querySelector('[tabindex], a, [onclick], [role="button"]')) return;
    var name = nearestHeadingText(svg);
    if (name) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', name + T(' (차트)', ' (chart)'));
    }
  }

  // ---------------------------------------------------------------------
  // 새로 들어온 노드 처리
  // ---------------------------------------------------------------------
  function processNode(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('[onclick]')) enhancePseudoButton(root);
    var oc = root.querySelectorAll ? root.querySelectorAll('[onclick]') : [];
    for (var i = 0; i < oc.length; i++) enhancePseudoButton(oc[i]);

    var infos = [];
    if (root.matches && root.matches('.info-icon-btn')) infos.push(root);
    if (root.querySelectorAll) Array.prototype.push.apply(infos, root.querySelectorAll('.info-icon-btn'));
    infos.forEach(enhanceInfoButton);

    var ovs = [];
    if (root.matches && root.matches('.modal-overlay')) ovs.push(root);
    if (root.querySelectorAll) Array.prototype.push.apply(ovs, root.querySelectorAll('.modal-overlay'));
    ovs.forEach(enhanceOverlay);

    enhanceTableHeaders(root);

    var svgs = [];
    if (root.tagName && root.tagName.toLowerCase() === 'svg') svgs.push(root);
    if (root.querySelectorAll) Array.prototype.push.apply(svgs, root.querySelectorAll('svg:not([data-a11y-svg])'));
    svgs.forEach(enhanceSvg);
  }

  var pending = [];
  var scheduled = false;
  function flush() {
    scheduled = false;
    var batch = pending; pending = [];
    // 이미 DOM에서 빠진 노드는 건너뜁니다.
    batch.forEach(function (n) { if (n.isConnected) processNode(n); });
  }
  var domObserver = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) pending.push(added[j]);
    }
    if (pending.length && !scheduled) { scheduled = true; setTimeout(flush, 120); }
  });

  // ---------------------------------------------------------------------
  // 키보드 이벤트 (위임)
  // ---------------------------------------------------------------------
  function onKeydown(ev) {
    var t = ev.target;
    if (!t || t.nodeType !== 1) return;

    // Enter/Space로 가짜 버튼 작동
    if ((ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') && has(t, 'data-a11y-btn') || (t.classList && t.classList.contains('info-icon-btn') && (ev.key === 'Enter' || ev.key === ' '))) {
      if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      ev.preventDefault();
      t.click();
      return;
    }

    // Esc: 열려 있는 ⓘ 설명을 먼저 닫고 포커스를 버튼으로 돌려줍니다.
    if (ev.key === 'Escape') {
      var shown = document.querySelectorAll('.info-tooltip.show');
      if (shown.length) {
        var trigger = null;
        for (var i = 0; i < shown.length; i++) {
          shown[i].classList.remove('show');
          var b = document.querySelector('.info-icon-btn[aria-controls="' + shown[i].id + '"]');
          if (b) trigger = b;
        }
        syncInfoExpanded();
        if (trigger) trigger.focus();
      }
      return;
    }
    onTabKeydown(ev);
  }

  // ---------------------------------------------------------------------
  // 시작
  // ---------------------------------------------------------------------
  function init() {
    ensureAnnouncer();
    processNode(document.body);
    enhanceTeamInfoTabBar();
    syncNav(false);
    updateInert();

    domObserver.observe(document.body, { childList: true, subtree: true });

    // 구단정보 탭바 / 내비게이션의 active 클래스 변화를 aria 속성으로 반영
    var watch = function (id, fn) {
      var el = document.getElementById(id);
      if (el) new MutationObserver(fn).observe(el, { attributes: true, attributeFilter: ['class'], subtree: true });
    };
    watch('teamInfoTabBar', syncTeamInfoTabs);
    watch('mTabbar', function () { syncNav(true); });
    watch('viewToggleWrap', function () { syncNav(true); });

    // 언어 전환 시 이 모듈이 만든 문구 갱신
    new MutationObserver(function () {
      refreshInfoLabels();
      var bar = document.getElementById('teamInfoTabBar');
      if (bar) bar.setAttribute('aria-label', T('구단 정보 메뉴', 'Club info sections'));
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

    document.addEventListener('keydown', onKeydown);
    // ⓘ 버튼을 누른 직후 aria-expanded를 맞춥니다(인라인 핸들러가 stopPropagation 하므로 캡처 단계에서 예약).
    document.addEventListener('click', function () { setTimeout(syncInfoExpanded, 0); }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // 필요하면 다른 코드에서도 쓸 수 있게 노출
  window.A11y = { announce: announce, refresh: function () { processNode(document.body); } };
})();
