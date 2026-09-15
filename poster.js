// ============================================================================
// 매치데이 포스터 생성 모듈 (poster.js)
// ----------------------------------------------------------------------------
// app.js의 downloadMatchPoster()가 호출하는 순수 캔버스 드로잉 함수 모음입니다.
// 데이터(팀명, 스코어, 로고 Image 객체 등)는 전부 인자로 전달받고, 이 파일은
// 어떻게 그릴지만 담당합니다 — 리그 데이터/리포트 로직과 분리해 두어야
// app.js가 아무리 커져도 이 파일만 보고 포스터 디자인을 고칠 수 있습니다.
//
// 팀 로고는 흰 원판/그라디언트 링 없이 로고 이미지 자체만 부드러운 그림자로
// 띄우는 방식입니다(원 안에 로고를 가두지 않음 — 어떤 로고를 넣어도 찌그러지지
// 않도록 항상 비율을 유지해서 그립니다).
// ============================================================================
(function (global) {
  'use strict';

  var PALETTE = {
    navy: '#003C8C', navyDeep: '#001c4d', navyLight: '#0a56b8',
    teal: '#0A9696', tealBright: '#2be0d6',
    gold: '#DCBE8C', goldStrong: '#cc9c4d', goldSoft: '#f2ddb2', cream: '#f5ecdb',
    shadow: 'rgba(2,8,26,0.55)'
  };

  var FONT = '"Segoe UI", "Noto Sans KR", Arial, sans-serif';

  var POSTER_SIZE = { w: 1080, h: 1920 };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bgGradient(ctx, W, H) {
    var g = ctx.createLinearGradient(0, 0, W * 0.25, H);
    g.addColorStop(0, PALETTE.navyDeep);
    g.addColorStop(0.55, PALETTE.navy);
    g.addColorStop(1, '#04122c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var glow = ctx.createRadialGradient(W * 0.82, H * 0.08, 10, W * 0.82, H * 0.08, W * 0.9);
    glow.addColorStop(0, 'rgba(43,224,214,0.16)');
    glow.addColorStop(1, 'rgba(43,224,214,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    for (var i = -H; i < W + H; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(220,190,140,0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, 10, 10, W - 20, H - 20, 22);
    ctx.stroke();
    ctx.restore();
  }

  // 로고만 — 흰 원판/그라디언트 링 없이 부드러운 그림자로만 띄웁니다.
  function drawCrest(ctx, img, cx, cy, r) {
    if (!img) return;
    ctx.save();
    ctx.shadowColor = PALETTE.shadow;
    ctx.shadowBlur = r * 0.4;
    ctx.shadowOffsetY = r * 0.1;
    var iw = img.naturalWidth || img.width || 300;
    var ih = img.naturalHeight || img.height || 300;
    var scale = Math.min((r * 2.05) / iw, (r * 2.05) / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  function letterSpacedText(ctx, text, cx, cy, spacing) {
    var widths = text.split('').map(function (ch) { return ctx.measureText(ch).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * (text.length - 1);
    var x = cx - total / 2;
    var prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, cy);
      x += widths[i] + spacing;
    }
    ctx.textAlign = prevAlign;
  }

  function teamNameBlock(ctx, x, y, nameKo, W) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "700 " + Math.round(W * 0.042) + "px " + FONT;
    ctx.fillText(nameKo, x, y);
  }

  function footer(ctx, W, H, weekLabel) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = "600 " + Math.round(W * 0.022) + "px " + FONT;
    letterSpacedText(ctx, (weekLabel || '') + '  ·  CHIWEMI INVESTMENT  ·  NRFA LEAGUE ONE', W / 2, H - 56, 2);
    ctx.restore();
  }

  function headerBlock(ctx, W, roundLabel, kicker) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.goldSoft;
    ctx.font = "700 " + Math.round(W * 0.028) + "px " + FONT;
    letterSpacedText(ctx, kicker, W / 2, 118, 4);
    ctx.fillStyle = '#fff';
    ctx.font = "800 " + Math.round(W * 0.05) + "px " + FONT;
    ctx.fillText(roundLabel, W / 2, 176);
    ctx.restore();
  }

  // ---- 프리뷰(다음 경기 예고) 포스터 ----------------------------------------
  function drawPreviewPoster(ctx, W, H, data) {
    bgGradient(ctx, W, H);
    headerBlock(ctx, W, data.roundLabel, data.isKorean ? 'MATCHDAY PREVIEW' : 'MATCHDAY PREVIEW');

    var crestR = W * 0.16;
    var crestY = H * 0.34;
    var homeX = W * 0.27, awayX = W * 0.73;
    drawCrest(ctx, data.homeLogo, homeX, crestY, crestR);
    drawCrest(ctx, data.awayLogo, awayX, crestY, crestR);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.goldSoft;
    ctx.font = "800 " + Math.round(W * 0.06) + "px " + FONT;
    ctx.fillText('VS', W / 2, crestY + H * 0.012);
    ctx.restore();

    var nameY = crestY + crestR + 70;
    teamNameBlock(ctx, homeX, nameY, data.homeKo, W);
    teamNameBlock(ctx, awayX, nameY, data.awayKo, W);

    var haY = nameY + 46;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = "600 " + Math.round(W * 0.024) + "px " + FONT;
    ctx.fillText(data.isKorean ? '홈' : 'HOME', homeX, haY);
    ctx.fillText(data.isKorean ? '원정' : 'AWAY', awayX, haY);
    ctx.restore();

    // 킥오프 정보 카드
    var cardY = haY + 70, cardH = 220, cardW = W * 0.8, cardX = (W - cardW) / 2;
    ctx.save();
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,190,140,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "800 " + Math.round(W * 0.045) + "px " + FONT;
    ctx.fillText(data.dateText || '', W / 2, cardY + 78);
    ctx.fillStyle = PALETTE.tealBright;
    ctx.font = "700 " + Math.round(W * 0.03) + "px " + FONT;
    ctx.fillText(data.timeText || '', W / 2, cardY + 128);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = "500 " + Math.round(W * 0.022) + "px " + FONT;
    ctx.fillText(data.venue || '', W / 2, cardY + 176);
    ctx.restore();

    footer(ctx, W, H, data.weekLabel);
  }

  // ---- 결과(스코어) 포스터 ---------------------------------------------------
  function drawResultPoster(ctx, W, H, data) {
    bgGradient(ctx, W, H);
    var badgeText = data.result === 'W' ? (data.isKorean ? '승리' : 'WIN')
      : data.result === 'D' ? (data.isKorean ? '무승부' : 'DRAW')
      : (data.isKorean ? '패배' : 'LOSS');
    headerBlock(ctx, W, data.roundLabel, badgeText + '  ·  FULL TIME');

    var crestR = W * 0.155;
    var crestY = H * 0.34;
    var homeX = W * 0.27, awayX = W * 0.73;
    drawCrest(ctx, data.homeLogo, homeX, crestY, crestR);
    drawCrest(ctx, data.awayLogo, awayX, crestY, crestR);

    var scoreY = crestY + H * 0.012;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = "800 " + Math.round(W * 0.1) + "px " + FONT;
    ctx.fillStyle = data.homeScore > data.awayScore ? PALETTE.goldSoft : '#fff';
    ctx.fillText(String(data.homeScore), W * 0.37, scoreY);
    ctx.fillStyle = data.awayScore > data.homeScore ? PALETTE.goldSoft : '#fff';
    ctx.fillText(String(data.awayScore), W * 0.63, scoreY);
    ctx.restore();

    ctx.save();
    var divGrad = ctx.createLinearGradient(0, scoreY - 46, 0, scoreY + 46);
    divGrad.addColorStop(0, 'rgba(255,255,255,0)');
    divGrad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    divGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, scoreY - 46); ctx.lineTo(W / 2, scoreY + 46); ctx.stroke();
    ctx.restore();

    var nameY = crestY + crestR + 70;
    teamNameBlock(ctx, homeX, nameY, data.homeKo, W);
    teamNameBlock(ctx, awayX, nameY, data.awayKo, W);

    var scY = nameY + 58;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = "500 " + Math.round(W * 0.021) + "px " + FONT;
    var lineH = 32;
    (data.homeScorers || []).forEach(function (name, i) {
      ctx.fillStyle = PALETTE.cream;
      ctx.fillText('\u26BD ' + name, homeX, scY + i * lineH);
    });
    (data.awayScorers || []).forEach(function (name, i) {
      ctx.fillStyle = PALETTE.cream;
      ctx.fillText('\u26BD ' + name, awayX, scY + i * lineH);
    });
    ctx.restore();

    if (data.venue) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = "500 " + Math.round(W * 0.02) + "px " + FONT;
      ctx.fillText(data.venue, W / 2, H * 0.72);
      ctx.restore();
    }

    footer(ctx, W, H, data.weekLabel);
  }

  global.MatchPoster = {
    SIZE: POSTER_SIZE,
    drawResultPoster: drawResultPoster,
    drawPreviewPoster: drawPreviewPoster
  };
})(window);
