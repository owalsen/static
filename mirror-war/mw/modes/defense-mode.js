/* 거울전쟁 — 모드 선택 화면 (2026-11-19 사용자 요청): 로딩이 끝나면 [디펜스] / [서바이벌] 중 하나를 고른다.
   흐름: 로딩(70% 에서 눌러 시작) → 모드 선택(여기) → 디펜스: 진영 선택 → 스테이지 / 서바이벌: 바로 시작(mw/modes/survival.js 를 그때 받는다).
   진영 선택 화면의 [취소]와 서바이벌의 [모드 선택으로]가 여기로 돌아온다 (modeOk = false).
   defense.js 쪽 연결: _drawOverlay 맨 앞(_modeShow → _drawMode), _tap 의 시작 화면 갈래(_modeTap), _frame 맨 앞(this.sub 가 있으면 그 게임의 frame 만), 입력 처리 맨 앞(sub 가 있으면 쉰다). ?mode=survival 이면 바로 서바이벌 */
(function (root) {
  'use strict';
  var MWE = root.MWE, DG = MWE.DefenseGame, P = DG.prototype, CONFIG = DG.CONFIG;
  var MODES = [
    { key: 'defense', name: '디펜스', sub: 'Defense', lines: ['유닛을 소환해 전선을 밀고', '적 기지를 무너뜨립니다'], col: '#ffd36e' },
    { key: 'survival', name: '서바이벌', sub: 'Survival', lines: ['도둑 한 명으로 사방에서', '몰려오는 적을 버팁니다'], col: '#9cc0ff', tag: '신규' }
  ];
  function inBox(b, x, y) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  var loading = false, failed = false;

  P._modeShow = function () { return !!(CONFIG.PUSH && this.st && this.screen === 'title' && this.titleSeen && !this.modeOk); };
  P._modeBgm = function () { if (this.soundOn && this.bgm) { this.bgm.set(3); this.bgm.resume(); } };   // 3 = 로딩·메뉴 곡 (defense.js MENU_BGM.idx)
  P._drawMode = function () {
    var ctx = this.ctx, W = this.W, H = this.H, tb = this._titleBg && this._titleBg(), i;
    if (tb) { var k = Math.max(W / tb.naturalWidth, H / tb.naturalHeight), tw = tb.naturalWidth * k, th = tb.naturalHeight * k; ctx.drawImage(tb, Math.round((W - tw) / 2), Math.round((H - th) / 2), Math.round(tw), Math.round(th)); }
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(5,4,6,.2)'); g.addColorStop(0.35, 'rgba(5,4,6,.55)'); g.addColorStop(1, 'rgba(5,4,6,.85)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var ty = Math.round(H * 0.2);
    ctx.save(); ctx.font = 'bold 40px "Nanum Myeongjo","AppleMyungjo","Batang",serif'; ctx.shadowColor = '#2e6bff'; ctx.shadowBlur = 20; ctx.fillStyle = '#9cc0ff'; ctx.fillText('거울전쟁', W / 2, ty); ctx.shadowBlur = 5; ctx.fillStyle = '#e8f0ff'; ctx.fillText('거울전쟁', W / 2, ty); ctx.restore();
    ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#dfe6f5'; ctx.fillText('게임을 고르세요', W / 2, ty + 44);
    var bw = Math.min(W - 48, 320), bh = 104, gap = 18, x = Math.round((W - bw) / 2), y0 = Math.round(H * 0.38); this.modeBtns = [];
    for (i = 0; i < MODES.length; i++) { var M = MODES[i], b = { x: x, y: y0 + i * (bh + gap), w: bw, h: bh, key: M.key }, hot = this.modeHover === M.key; this.modeBtns.push(b);
      this._plate(b.x, b.y, b.w, b.h, 8, hot);
      ctx.textAlign = 'left'; ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = M.col; ctx.fillText(M.name, b.x + 22, b.y + 32); var nw = ctx.measureText(M.name).width;
      ctx.font = 'italic bold 11px Georgia,serif'; ctx.fillStyle = '#7b8397'; ctx.fillText(M.sub, b.x + 30 + nw, b.y + 36);
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#c9d1e3'; ctx.fillText(M.lines[0], b.x + 22, b.y + 62); ctx.fillText(M.lines[1], b.x + 22, b.y + 80);
      if (M.tag) { ctx.font = 'bold 10px sans-serif'; var tw2 = ctx.measureText(M.tag).width + 12; ctx.fillStyle = 'rgba(156,192,255,.18)'; ctx.fillRect(b.x + b.w - tw2 - 14, b.y + 14, tw2, 18); ctx.fillStyle = '#9cc0ff'; ctx.textAlign = 'center'; ctx.fillText(M.tag, b.x + b.w - 14 - tw2 / 2, b.y + 23); }
      ctx.textAlign = 'center'; }
    var my = y0 + MODES.length * (bh + gap) + 8;
    if (loading) { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffe9b0'; ctx.fillText('서바이벌을 받는 중…', W / 2, my); }
    else if (failed) { ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffb4a8'; ctx.fillText('서바이벌을 받지 못했습니다 — 다시 눌러 주세요', W / 2, my); }
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#7b8397';
    ctx.fillText('이 게임은 원작 「거울전쟁」에 대한 팬심으로 만든 비영리 팬 게임입니다.', W / 2, H - 44, W - 16); ctx.fillText('원작 자산의 저작권은 제작사 L&K Logic Korea에 있으며, 요청이 있으면 즉시 내리겠습니다.', W / 2, H - 30, W - 16);
    ctx.textAlign = 'left';
    if (!this._modeAuto && /[?&]mode=survival/.test(root.location.search)) { this._modeAuto = true; this._modeGo('survival'); }
  };
  P._modeHover = function (x, y) { if (!this._modeShow()) return; var k = null; (this.modeBtns || []).forEach(function (b) { if (inBox(b, x, y)) k = b.key; }); this.modeHover = k; if (this.cv) this.cv.style.cursor = k ? 'pointer' : ''; };
  P._modeTap = function (x, y) {
    if (loading) return;
    if (x < 0) { this._modeGo('defense'); return; }           // 스페이스·엔터 = 디펜스
    for (var i = 0; i < (this.modeBtns || []).length; i++) if (inBox(this.modeBtns[i], x, y)) { this._modeGo(this.modeBtns[i].key); return; }
  };
  P._modeGo = function (key) {
    var self = this; if (this.cv) this.cv.style.cursor = ''; this.modeHover = null;
    if (this._raceSnd) this._raceSnd('click');
    if (key === 'defense') { this.modeOk = true; return; }
    var start = function () { loading = false; self.modeOk = true; self.sub = new MWE.SurvivalGame(self);
      var F = DG.FACTIONS && DG.FACTIONS.dark; if (F && self.soundOn && self.bgm) { self.bgm.set(F.bgm); self.bgm.resume(); } };   // 도둑 = 흑마술파 → 흑마술파 곡
    if (MWE.SurvivalGame) { start(); return; }
    // survival.js 는 고른 뒤에 받는다. 주소는 defense.js 를 읽어 온 <script> 의 것을 따른다 (itch 묶음은 ../mw/ 가 mw/ 로 바뀐다 — tools/itch.js)
    var base = '../mw/modes/', tags = document.getElementsByTagName('script'), i;
    for (i = 0; i < tags.length; i++) { var m = /^(.*\/)defense\.js(\?.*)?$/.exec(tags[i].getAttribute('src') || ''); if (m && /modes\/$/.test(m[1])) base = m[1]; }
    loading = true; failed = false;
    var s = document.createElement('script'); s.src = base + 'survival.js';
    s.onload = function () { if (MWE.SurvivalGame) start(); else { loading = false; failed = true; } };
    s.onerror = function () { loading = false; failed = true; };
    document.head.appendChild(s);
  };
})(typeof window !== 'undefined' ? window : globalThis);
