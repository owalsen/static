/* 거울전쟁 디펜스 — 진영 선택 화면 (2026-11-17 사용자 요청, README 209)
   원본판(거울전쟁: 악령군, 2000)의 시나리오 진영 선택 화면을 옮겼다: 탁자 위에 펼친 지도와 원 셋(악령군·흑마술파·해방부대),
   포인터를 원에 대면 칼이 떨어져 동전에 꽂히고 빛이 흐른다. 그림은 tools/racebuild.py 가 원본 title.mwi·knife.mws 에서 굽는다
   (sim/race-bg.jpg = 배경 640×480 의 x 40~600, y 105~440 / sim/race-knife.png = 해방부대 칼 12장·이름표 12장·취소 6장).
   세 진영 모두 고를 수 있다(해방부대 → 악령군 2026-11-17 → 흑마술파 2026-11-18). on: false 인 진영은 어둡게 두고 누르면 "개발 예정"을 띄운다.
   흐름: 첫 장(공지) → 진영 선택(여기) → 스테이지 고르기. [취소]는 모드 선택(defense-mode.js)으로 돌아간다. 스페이스·엔터 = 해방부대.
   defense.js 쪽 연결: _drawOverlay 맨 앞(_raceShow → _drawRace), _tap 의 시작 화면 갈래(_raceTap), pointermove(_raceHover) */
(function (root) {
  'use strict';
  var MWE = root.MWE, DG = MWE.DefenseGame, P = DG.prototype, CONFIG = DG.CONFIG;
  var CROP = { x: 40, y: 105, w: 560, h: 318 };              // race-bg.jpg 가 원본 배경에서 잘린 자리 (그림은 335 줄 — 아래 17 줄은 원본 저작권 줄이 걸려 그리지 않는다)
  var VIEW = { x: 92, w: 490 };                              // 화면 폭에 맞추는 가로 범위 (세 원과 [취소]까지 — 세로 화면에서 지도를 조금이라도 크게)
  /* 원본 배경(640×480) 좌표. 이름표·취소는 배경 글자와 픽셀 대조로, 칼은 동전 가운데를 지도 원에 맞춰 구했다 (tools/racebuild.py 머리말) */
  var RACES = [
    { key: 'lib', name: '해방부대', to: '해방부대로', on: true, c: [438, 243], knife: [394, -2], label: [383, 275, 95, 27], ky: 0, ly: 320, nl: 12 },   // ky·ly = 시트에서 칼 줄·이름표 줄의 y, nl = 이름표 장 수
    { key: 'dark', name: '흑마술파', to: '흑마술파로', on: true, c: [287, 181], knife: [205, -7], label: [252, 219, 80, 28], ky: 752, ly: 1072, nl: 5 },   // 2026-11-18: 흑마술파 진영을 열었다 (칼 17~28 · 이름표 29~33, 칼 자리는 동전 가운데를 원 가운데에 맞춤)
    { key: 'evil', name: '악령군', to: '악령군으로', on: true, c: [157, 259], knife: [-4, -7], label: [120, 290, 80, 28], ky: 400, ly: 720, nl: 5 }   // 2026-11-17: 1단계(대 흑마술파)부터 열었다
  ];
  var CANCEL = [479, 277, 95, 79], RX = 56, RY = 45, FPS = 12, FALL = 0.16, GO = 0.75;
  var imgs = null;
  function inBox(b, x, y) { return x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]; }

  /* 메뉴 소리: 원본판 msdf.mwd 의 RIFF 448개 중 메뉴가 읽는 444~447(FUN_00401140 의 FUN_0051a420(0x1bc~0x1bf)) — 어느 것이 무엇인지는 실행 파일로 확인하지 못해
     소리 모양으로 골랐다: 447 = 즉각적인 낮은 "쿵" + 1초 울림 → 칼이 꽂히는 소리(sim/menu-knife.wav), 444 = 0.2초 짧은 소리 → 출정 버튼(sim/menu-click.wav). 소리가 꺼져 있으면 안 낸다 */
  var SND = {};
  P._raceSnd = function (k) { if (!this.soundOn) return; var a = SND[k]; if (!a) { a = SND[k] = new Audio(((this.assets && this.assets.base) || '') + 'menu-' + k + '.wav'); a.volume = k === 'knife' ? 0.85 : 0.6; }
    try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} };
  P._raceShow = function () { return !!(CONFIG.PUSH && this.st && this.screen === 'title' && this.titleSeen && !this.raceOk); };
  P._raceImgs = function () {
    if (!imgs) { var b = (this.assets && this.assets.base) || ''; imgs = { bg: new Image(), sh: new Image() }; imgs.bg.src = b + 'race-bg.jpg'; imgs.sh.src = b + 'race-knife.png'; }
    return imgs;
  };
  /* 화면 배치: 배경을 화면 폭에 맞추고, 칼이 위로 솟을 자리(원본 y −2 까지)를 남겨 세로 30% 쯤에 */
  P._raceLay = function () { var s = this.W / VIEW.w, ih = Math.round(CROP.h * s), top = Math.max(Math.round(110 * s) + 70, Math.round(this.H * 0.44 - ih / 2)); return { s: s, x0: 0, y0: top, ih: ih }; };
  P._raceToBg = function (x, y) { var L = this._raceLay(); return [x / L.s + VIEW.x, (y - L.y0) / L.s + CROP.y]; };
  P._raceAt = function (x, y) {
    var b = this._raceToBg(x, y), i;
    for (i = 0; i < RACES.length; i++) { var R = RACES[i], dx = (b[0] - R.c[0]) / RX, dy = (b[1] - R.c[1]) / RY; if (dx * dx + dy * dy <= 1 || inBox(R.label, b[0], b[1])) return R.key; }
    if (this._modeShow && inBox(CANCEL, b[0], b[1])) return 'cancel';   // [취소] → 모드 선택으로 (_raceTap)
    return null;
  };
  P._raceHover = function (x, y) {
    if (!this._raceShow()) return; var S = this.raceS || (this.raceS = {}); if (S.go) return;
    var k = this._raceAt(x, y), R = RACES.filter(function (r) { return r.key === k; })[0];
    var h = R && R.on ? k : k === 'cancel' ? 'cancel' : null;
    if (h !== S.hover) { S.hover = h; S.t0 = Date.now(); S.landed = false; }
    if (this.cv) this.cv.style.cursor = k ? 'pointer' : '';
  };
  P._raceTap = function (x, y) {
    var S = this.raceS || (this.raceS = {}), now = Date.now(); if (S.go) return;
    var k = x < 0 ? (this.faction || 'lib') : this._raceAt(x, y);              // 스페이스·엔터 = 해방부대
    if (k === 'cancel' && this._modeShow) { this.modeOk = false; this.raceS = null; if (this.cv) this.cv.style.cursor = ''; return; }   // [취소] = 모드 선택으로 (defense-mode.js, 2026-11-19)
    var R = RACES.filter(function (r) { return r.key === k; })[0]; if (!R) return;
    if (!R.on) { S.msg = { txt: R.name + ' — 개발 예정입니다', t0: now, r: R }; return; }
    if (x < 0) { if (S.hover !== k) { S.hover = k; S.t0 = now; S.landed = false; } S.pick = k; S.go = Math.max(now, S.t0 + FALL * 1000) + GO * 1000; this._raceSnd('click'); this._raceBgm(k); return; }   // 키보드: 떨어뜨리고 바로 출정
    // 터치 (2026-11-17 사용자 요청): 첫 누르기 = 칼이 떨어져 꽂힘(활성화), 꽂힌 뒤 한 번 더 누르면 출정. PC 는 포인터를 대면 이미 꽂혀 있으니 클릭 한 번에 출정
    if (S.hover !== k) { S.hover = k; S.t0 = now; S.landed = false; return; }
    if (now - S.t0 < FALL * 1000) return;                    // 떨어지는 중에 누른 것은 무시
    S.pick = k; S.go = now + 350; this._raceSnd('click'); this._raceBgm(k);
  };
  /* 고른 진영의 배경음으로 바꾸는 것은 이 터치 안에서 한다 (2026-11-17: 휴대폰에서 악령군을 고르면 배경음이 끊겼다 —
     setFaction 은 그리기 루프(_drawRace)에서 불려 터치 밖이고, 그때 곡 파일이 바뀌면 브라우저가 재생을 막을 수 있다. 해방부대는 같은 곡이라 문제가 안 보였다) */
  P._raceBgm = function (k) { var F = DG.FACTIONS && DG.FACTIONS[k]; if (F && this.soundOn && this.bgm) { this.bgm.set(F.bgm); this.bgm.resume(); } };
  /* 매 프레임 (_drawOverlay 대신) */
  P._drawRace = function () {
    var ctx = this.ctx, W = this.W, H = this.H, I = this._raceImgs(), L = this._raceLay(), s = L.s, S = this.raceS || (this.raceS = {}), now = Date.now(), self = this;
    if (S.go && now >= S.go) { S.go = 0; S.hover = null; this.raceOk = true; if (this.setFaction) this.setFaction(S.pick || 'lib'); if (this.cv) this.cv.style.cursor = ''; return; }   // 다음 화면(스테이지 고르기)으로
    var BX = function (bx) { return (bx - VIEW.x) * s; }, BY = function (by) { return L.y0 + (by - CROP.y) * s; };
    // 탁자(짙은 나무) 바탕 — 배경 그림 가장자리의 어두운 나무색과 이어지게
    var g = ctx.createRadialGradient(W / 2, L.y0 + L.ih / 2, 20, W / 2, L.y0 + L.ih / 2, H * 0.75); g.addColorStop(0, '#3a1d0c'); g.addColorStop(0.5, '#1d0d05'); g.addColorStop(1, '#070302');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (I.bg.complete && I.bg.naturalWidth) {
      ctx.drawImage(I.bg, VIEW.x - CROP.x, 0, VIEW.w, CROP.h, 0, L.y0, W, L.ih);
      var fe = 26, ft = ctx.createLinearGradient(0, L.y0, 0, L.y0 + fe), fb = ctx.createLinearGradient(0, L.y0 + L.ih - fe, 0, L.y0 + L.ih);   // 위아래 가장자리를 바탕에 풀어 준다
      ft.addColorStop(0, 'rgba(18,8,3,1)'); ft.addColorStop(1, 'rgba(18,8,3,0)'); fb.addColorStop(0, 'rgba(10,5,2,0)'); fb.addColorStop(1, 'rgba(10,5,2,1)');
      ctx.fillStyle = ft; ctx.fillRect(0, L.y0, W, fe); ctx.fillStyle = fb; ctx.fillRect(0, L.y0 + L.ih - fe, W, fe);
    }
    // 아직 못 고르는 진영: 원을 어둡게 + "개발 예정"
    RACES.forEach(function (R) { if (R.on) return; ctx.save(); ctx.fillStyle = 'rgba(8,4,2,.5)'; ctx.beginPath(); ctx.ellipse(BX(R.c[0]), BY(R.c[1]), RX * s, RY * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(0,0,0,.6)'; var tw = ctx.measureText('개발 예정').width + 10, ty = BY(R.c[1]);
      ctx.fillRect(BX(R.c[0]) - tw / 2, ty - 8, tw, 16); ctx.fillStyle = '#c9b48a'; ctx.fillText('개발 예정', BX(R.c[0]), ty + 1); ctx.restore(); });
    // 해방부대: 포인터를 대면 칼이 떨어져 꽂히고 빛이 흐른다 (원본 knife.mws 34~45, 이름표 46~57)
    var sh = I.sh.complete && I.sh.naturalWidth ? I.sh : null;
    if (S.hover && S.hover !== 'cancel' && !S.landed && now - S.t0 >= FALL * 1000) { S.landed = true; this._raceSnd('knife'); }   // 칼이 꽂히는 순간 "쿵"
    if (sh && S.hover && S.hover !== 'cancel') { var R = RACES.filter(function (r) { return r.key === S.hover; })[0] || RACES[0], el = (now - S.t0) / 1000, kx = BX(R.knife[0]), ky = BY(R.knife[1]);
      ctx.save(); ctx.beginPath(); ctx.rect(0, BY(14), W, H); ctx.clip();   // 프레임 맨 위 몇 줄의 점은 원본에서 화면 위끝 밖이라 안 보이던 것 — 잘라 낸다
      if (el < FALL) { var f = el / FALL; ctx.save(); ctx.globalAlpha = 0.35 + 0.65 * f; ctx.drawImage(sh, 0, R.ky, 220, 320, kx, ky - (1 - f) * 110 * s, 220 * s, 320 * s); ctx.restore(); }
      else { var fi = 1 + Math.floor((el - FALL) * FPS) % 11; ctx.drawImage(sh, fi * 220, R.ky, 220, 320, kx, ky, 220 * s, 320 * s);
        if (el - FALL < 0.12) { ctx.save(); ctx.globalAlpha = 0.5 * (1 - (el - FALL) / 0.12); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.ellipse(BX(R.c[0]), BY(R.c[1]), RX * s * 1.1, RY * s * 1.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } }   // 꽂히는 순간 번쩍
      ctx.restore(); var li = Math.floor(el * FPS) % R.nl; ctx.drawImage(sh, li * 100, R.ly, 100, 32, BX(R.label[0]), BY(R.label[1]), 100 * s, 32 * s); }
    // [취소] (2026-11-19 사용자 요청으로 되살림 — 누르면 모드 선택으로): 원본 knife.mws 58~63. 평소에는 가장 밝은 장(휴대폰은 포인터가 없어 늘 보여야 한다), 포인터를 대면 빛이 흐른다
    if (sh && this._modeShow) { var ci = S.hover === 'cancel' ? Math.floor((now - S.t0) / 1000 * FPS) % 6 : 5; ctx.drawImage(sh, 1200 + ci * 96, 320, 96, 80, BX(CANCEL[0]), BY(CANCEL[1]), 96 * s, 80 * s); }
    // 글자: 제목 · 안내 · 팬 게임 고지
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var hy = Math.max(30, Math.round(L.y0 - 110 * s - 40));
    var HR = S.hover ? RACES.filter(function (r) { return r.key === S.hover; })[0] : null, ht = HR ? HR.name : '진영을 고르세요';   // 고른 진영의 이름을 위에 크게 (지도의 이름표가 작아 잘 안 보인다 — 2026-11-17 사용자 요청)
    ctx.font = 'bold ' + (HR ? 32 : 26) + 'px sans-serif'; ctx.fillStyle = '#000'; ctx.fillText(ht, W / 2 + 1, hy + 1); ctx.fillStyle = HR ? '#fff1c4' : '#ffd36e'; if (HR) { ctx.shadowColor = '#ffb23a'; ctx.shadowBlur = 14; } ctx.fillText(ht, W / 2, hy); ctx.shadowBlur = 0;
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#c9b48a'; ctx.fillText(RACES.filter(function (r) { return r.on; }).map(function (r) { return r.name; }).join(' · ') + ' 중에서 고르세요', W / 2, hy + 26, W - 20);
    var by = Math.min(H - 40, L.y0 + L.ih + 34);
    ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#dfe6f5'; ctx.fillText(S.go ? ((RACES.filter(function (r) { return r.key === S.pick; })[0] || RACES[0]).name + ' — 출정!') : S.hover && S.hover !== 'cancel' ? '한 번 더 누르면 ' + (RACES.filter(function (r) { return r.key === S.hover; })[0] || RACES[0]).to + ' 출정합니다' : '지도에서 진영을 누르세요', W / 2, by, W - 20);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#7b8397';
    ctx.fillText('이 게임은 원작 「거울전쟁」에 대한 팬심으로 만든 비영리 팬 게임입니다.', W / 2, H - 30, W - 16);
    ctx.fillText('원작 자산의 저작권은 제작사 L&K Logic Korea에 있으며, 요청이 있으면 즉시 내리겠습니다.', W / 2, H - 16, W - 16);
    if (S.msg && now - S.msg.t0 < 1600) { var m = S.msg, a = Math.min(1, (1600 - (now - m.t0)) / 300), mx = BX(m.r.label[0] + m.r.label[2] / 2), my = BY(m.r.label[1]) + 40 * s;
      ctx.globalAlpha = a; ctx.font = 'bold 12px sans-serif'; var mw = ctx.measureText(m.txt).width + 18; mx = Math.max(mw / 2 + 6, Math.min(W - mw / 2 - 6, mx));
      ctx.fillStyle = 'rgba(14,10,6,.92)'; ctx.fillRect(mx - mw / 2, my - 12, mw, 24); ctx.strokeStyle = '#b08a3c'; ctx.lineWidth = 1; ctx.strokeRect(mx - mw / 2 + 0.5, my - 11.5, mw - 1, 23); ctx.fillStyle = '#ffe9b0'; ctx.fillText(m.txt, mx, my + 1); }
    ctx.restore();
  };
})(window);
