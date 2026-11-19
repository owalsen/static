/* 거울전쟁 서바이벌 (2026-11-19 사용자 요청) — 흑마술파 도둑 한 명으로 사방에서 오는 적을 버틴다.
   디펜스(defense.js)와 같은 캔버스·그림·소리·유닛 데이터를 쓴다. 이 파일은 모드 선택 화면(defense-mode.js)에서 [서바이벌]을 고른 뒤에야 받는다 — 디펜스만 하는 사람의 로딩은 늘지 않는다.
   연결: DefenseGame 인스턴스 D 의 D.sub 에 이 게임이 들어가 있는 동안 D._frame 은 sub.frame(dt) 만 부르고, D 의 입력 처리는 쉰다(defense.js 의 `if (self.sub) return`).
         화면 크기(D.W·D.H·D.rs)와 유닛 그리기(D._drawUnit)·체력 바·돌판(_plate)은 D 것을 그대로 빌린다.
   단계: 1 뼈대(이동·카메라·빈 HUD) / 2 전투(사방 스폰·추적·자동 단도·피격·사망) / 3 성장(경험치·레벨업 카드·붉은보석 도둑 스킬 16개·전직 3갈래) / 4 웨이브 10단계·보스·결과 리포트 ← 지금 여기 / 3 성장(레벨업 카드·붉은보석 도둑 스킬·전직) / 4 웨이브 10단계·보스·승패 / 5 마무리
   좌표: 전장 좌표 = 화면 픽셀과 같은 단위(확대 ZOOM 전). 필드는 끝이 없다 — 바닥 조각(D.ground, 448×192)을 가로세로로 이어 깐다. */
(function (root) {
  'use strict';
  var MWE = root.MWE;
  var q = function (k, d) { var m = new RegExp('[?&]' + k + '=([0-9.]+)').exec(root.location.search); return m ? +m[1] : d; };
  var CFG = {
    HERO: 55,                    // 도둑 (흑마술파 55 — 체력 120, 다트 던지기)
    ZOOM: q('zoom', 1),          // 전장 확대 배수: 1 = 디펜스와 같은 크기. 시야를 넓히려면 0.8 쯤 (?zoom=0.8 로 견주어 본다 — 폰에서 확인 후 확정)
    HERO_Y: q('heroy', 0.42),    // 도둑이 서는 화면 세로 자리 (가운데보다 조금 위 — 끄는 엄지가 아래쪽을 가린다)
    SPEED: q('speed', 1.6),      // 도둑 걷는 속도 = 디펜스의 걷는 속도 × 이 값 (적보다 확실히 빨라야 보고 피한다)
    TIME: 600,                   // 한 판 10분
    STICK: { r: 44, dead: 5 },   // 가상 조이스틱: 누른 곳이 중심, r 만큼 끌면 최고 속도, dead 안쪽은 멈춤
    SAFE: { top: 20, bottom: 24 },   // 디펜스의 SAFE 와 같다 (상태 표시줄·홈 막대 자리)
    SLOTS: 6,
    /* 전투 (2단계). 수치는 원작에서 출발: 피해 = 원본 피해 공식(rules.damage), 적 걷는 속도 = 디펜스와 같은 식(walkPx × 틱 × 0.45) */
    ATK: { sec: q('atk', 0.5), range: q('range', 170), shot: 420, dmg: q('dmg', 2.8), life: 0.9, anim: 2.4 },   // 단도 던지기: 간격(초)·사거리(화면 폭 절반 안쪽)·단도 속도·피해 배수(원본 19 → 28: 해골전사 두 방)
    FOE: { dmg: q('edmg', 0.6), hp: q('ehp', 1), reach: 24, rs: 0.07, rangeMax: 150, shot: 170, sep: 20, body: 20, far: 1000 },   // 적: 피해·체력 배수, 근접 닿는 거리, 사거리 배율(디펜스 RANGE_SCALE)·원거리 상한, 적 발사체 속도, 서로 밀어내는 거리, 이보다 멀어지면 화면 둘레로 다시 보낸다
    CRIT: { p: q('crit', 0.1), mul: 2, p2: q('crit2', 0.15), mul2: 4 },   // 치명타(붉은보석 도둑에서): 확률·피해 배수. 더블 크리티컬 = 치명타가 났을 때 p2 확률로, 피해 mul2 배. 숫자 색: 보통 흰색 · 치명타 노랑 · 더블 붉은색 (NUM)
    BOOM: { touch: 30, radius: 46 },   // 좀비 자폭: 닿으면 터진다
    HURT: { inv: 0.25, flash: 0.35 },  // 도둑이 맞은 뒤 무적 시간(여럿이 한 틱에 겹쳐 치는 것 방지)·화면 가장자리 붉은 빛
    /* 웨이브 10단계 (4단계, 2026-11-19 사용자 안: 처음엔 쉬운 적, 10단계로 갈수록 모든 유닛). 1분에 한 단계.
       add = 그 단계에 새로 나오는 유닛(세 진영 모두 — 기본 공격이 있는 유닛만). 뽑힐 비중: 새로 나온 단계 3 · 한 단계 전 2 · 두 단계 전 1 · 그보다 옛것 0.4 — 10단계는 전부 같은 비중(모든 유닛이 다 나온다).
       rate = 초당 마릿수, cap = 살아 있는 적 상한, hp = 체력 배수. boss = 그 단계가 시작될 때 나오는 우두머리 [유닛, 체력 배수] */
    WAVE: { sec: q('wavesec', 60), margin: 50, list: [
      { add: [28, 31], rate: 0.9, cap: 60, hp: 1 },                                   // 1 해골전사 좀비
      { add: [43, 46], rate: 1.2, cap: 80, hp: 1 },                                   // 2 늑대 박쥐
      { add: [32, 7, 29], rate: 1.5, cap: 100, hp: 1 },                               // 3 유령 격투가 해골기사
      { add: [68, 0, 52, 4], rate: 1.8, cap: 120, hp: 1.1, boss: [30, 18] },          // 4 개미 전사(해방) 전사(흑) 궁수 · 우두머리 듀라한
      { add: [36, 35, 11, 6, 33], rate: 2.1, cap: 140, hp: 1.2 },                     // 5 늑대인간 흡혈귀 정령사 창검사 리치
      { add: [39, 15, 8, 53, 49, 1], rate: 2.4, cap: 160, hp: 1.3 },                  // 6 데몬 마법전사 무도가 흑전사 흑마술사 기사
      { add: [69, 25, 12, 10, 56, 57, 40], rate: 2.7, cap: 180, hp: 1.4, boss: [47, 28] },   // 7 거미 악령술사 마법사 의적 대도 마기사 데빌 · 우두머리 드래곤
      { add: [30, 44, 45, 2, 16, 50, 26, 5, 66], rate: 3.0, cap: 210, hp: 1.5 },      // 8 듀라한 켈베로스 펜릴 창기사 마법기사 요마술사 강신술사 명궁 구렁이
      { add: [70, 54, 3, 22, 9, 13, 41, 27, 51, 19], rate: 3.4, cap: 240, hp: 1.6 },  // 9 전갈 흑기사 성기사 엔젤 나이트 도사 장로 사탄 사술사 대마술사 주교
      { add: [47, 67, 21, 59, 61, 62, 20, 58, 63, 64], rate: 4.0, cap: 260, hp: 1.8, boss: [34, 90] } ] },   // 10 드래곤 신수사 환술사 인챈터 마녀 소환사 … · 우두머리 다크로드
    BOSS: { scale: 1.5, dmg: 1.6, speed: 1.15, gem: 30, heal: 30 },   // 우두머리: 그림 배율, 피해·속도 배수, 떨어뜨리는 경험치, 쓰러뜨리면 도둑 체력 회복
    TS: q('ts', 1)               // 시간 배속 (시험·측정용: ?ts=4)
  };
  var NUM = { n: { size: 12, top: '#ffffff', mid: '#f2f4fa', bot: '#b9c2d6', edge: 'rgba(0,0,0,.55)', life: 0.55, rise: 16 },
    c: { size: 17, top: '#fffbc2', mid: '#ffe23e', bot: '#ff9a12', edge: 'rgba(60,20,0,.7)', life: 0.8, rise: 24 },
    d: { size: 23, top: '#ffd0b0', mid: '#ff4a2a', bot: '#b00a0a', edge: 'rgba(40,0,0,.8)', life: 1.05, rise: 32 } };
  var GW = 448, GH = 192;        // 바닥 조각 크기 (defense.js 의 GW·GH)
  function inBox(b, x, y) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  function mmss(t) { t = Math.max(0, Math.ceil(t)); return (t < 600 ? '0' : '') + Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }

  function SurvivalGame(D) {
    this.D = D; this.keys = {}; this.stick = null; this.menu = false; this.menuT = 0; this.done = false;
    var A = D.assets, ids = [CFG.HERO];
    this.fxNeed = {};
    this._need(ids); this._need(CFG.WAVE.list[0].add); this._need(CFG.WAVE.list[1].add);   // 도둑과 1·2단계 유닛만 먼저 받는다 — 나머지는 한 단계 앞서 받는다 (_need)
    this._theme = D.theme; D.theme = null;                   // 디펜스의 난이도 테마(색조·바닥)는 끈다 — 나갈 때 돌려준다
    this.reset(); this._bind();
  }
  var P = SurvivalGame.prototype;
  SurvivalGame.CFG = CFG;

  P._unit = function (id, side, x, y) {
    var D = this.D, u = new MWE.Unit(D.types[id], D.types[id].fac, x, y);
    u.side = side; u.rangeK = 1; u.fade = 0; u.stunUntil = 0; D._applyType(u); D._look(u, 1);
    return u;
  };
  P.reset = function () {
    var D = this.D, self = this, rng = D.rng;
    this.t = 0; this.kills = 0; this.stick = null;
    this.hero = this._unit(CFG.HERO, 0, 0, 0); this.hero.hero = false;
    this.speed = this.hero.speedPx * CFG.SPEED;              // 초당 px
    this.cam = { x: 0, y: 0 };
    this.hero.powMul = CFG.ATK.dmg; this.atkCd = 0.4; this.hurtT = -9; this.invUntil = 0;
    this.foes = []; this.shots = []; this.effects = []; this.texts = []; this.nums = []; this.aimUntil = 0; this.crit = CFG.CRIT.p; this.spawnAcc = 0; this.wave = 0; this.waveOn = false; this.bossWait = null; this.banner = null; this.stat = { dealt: 0, maxHit: 0, taken: 0, crit: 0, dbl: 0, boss: 0 }; this.over = null; this.overT = 0; this.dieSndT = -9;
    this._growReset();
    var n0 = q('n', 0); for (var i = 0; i < n0; i++) this._spawn();   // ?n=250: 시작하자마자 그만큼 (성능 시험)
  };

  /* ───────── 매 프레임 (D._frame 이 부른다) ───────── */
  P.frame = function (dt) {
    var D = this.D;
    if (D.time - (D._groundAt || 0) > 0.5 && D.terrain) D._makeGround();   // 아이폰이 보조 캔버스를 비우는 문제의 복구 (defense.js _frame 과 같은 이유)
    for (var k = 0; k < CFG.TS; k++) {
      if (!this.menu && !D.paused && this.ready()) { if (this.cards) this.cardT += dt; else if (this.over) { this.overT += dt; if (this.hero.state === 'dead') this.hero.deadT += dt; } else this.update(dt); }
      D.time += dt; }                                        // D._faceVec·_drawUnit 이 D.time 을 본다
    if (this.menu) this.menuT += dt;
    this.draw();
  };
  P.ready = function () { return this.started || (this.started = this.D.assets.ready() && !!this.D.ground); };   // 처음 한 번만 기다린다 (뒤 단계 유닛 그림은 하면서 받는다)
  /* 유닛 그림과 그 유닛의 이펙트 시트를 받는다 (이미 받은 것은 건너뛴다) */
  P._need = function (ids) { var D = this.D, A = D.assets; ids.forEach(function (id) { var t = D.types[id]; if (!t) return; if (!A.img['u' + id]) A.load('u' + id, t.img);
    t.acts.forEach(function (a) { var d = a && a.arm >= 0 && D.data.fx.arms[a.arm]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); }); }); };
  P._has = function (id) { var im = this.D.assets.img['u' + id]; return !!(im && im.complete && im.naturalWidth); };

  P._moveVec = function () {
    var K = this.keys, x = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0), y = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0);
    if (x || y) { var d = Math.hypot(x, y); return [x / d, y / d]; }
    var S = this.stick; if (!S) return [0, 0];
    var dx = S.x - S.x0, dy = S.y - S.y0, m = Math.hypot(dx, dy); if (m < CFG.STICK.dead) return [0, 0];
    var k = Math.min(1, m / CFG.STICK.r); return [dx / m * k, dy / m * k];
  };
  /* 화면 둘레(보이는 곳 바로 밖)의 한 점 — 적이 나오는 자리 */
  P._edgePoint = function () {
    var D = this.D, rng = D.rng, Z = CFG.ZOOM, M = CFG.WAVE.margin, h = this.hero, l = D.W / 2 / Z + M, up = D.H * CFG.HERO_Y / Z + M + 40, dn = D.H * (1 - CFG.HERO_Y) / Z + M, k = rng.next() * (4 * l + 2 * (up + dn));
    if (k < 2 * l) return [h.x - l + k, h.y - up]; k -= 2 * l;
    if (k < 2 * l) return [h.x - l + k, h.y + dn]; k -= 2 * l;
    if (k < up + dn) return [h.x - l, h.y - up + k]; return [h.x + l, h.y - up + (k - up - dn)];
  };
  /* 지금 단계의 스폰 묶음 [[유닛, 비중] …] — 그림이 다 온 유닛만 */
  P._pool = function () {
    var self = this, WL = CFG.WAVE.list, w = this.wave, out = [], i;
    for (i = 0; i <= w; i++) WL[i].add.forEach(function (id) { if (self._has(id)) out.push([id, w === WL.length - 1 ? 1 : Math.max(0.4, 3 - (w - i))]); });
    return out;
  };
  P._spawn = function (bossId, bossHp) {
    var D = this.D, W = CFG.WAVE.list[this.wave], id = bossId;
    if (id == null) { var pool = this._pool(), tw = 0, i; if (!pool.length) return null; for (i = 0; i < pool.length; i++) tw += pool[i][1]; var r = D.rng.next() * tw; for (i = 0; i < pool.length - 1 && r >= pool[i][1]; i++) r -= pool[i][1]; id = pool[i][0]; }
    var p = this._edgePoint(), u = this._unit(id, 1, p[0], p[1]), t = u.t;
    u.life = Math.round(u.maxHp * CFG.FOE.hp * W.hp * (bossHp || 1)); u.life0 = u.life;   // 적의 체력은 life 로 센다 — u.hp 는 가득 둔다(_drawUnit 이 닳은 유닛마다 체력 바를 그려 수백 기면 화면을 덮는다). 우두머리만 체력 바를 보인다
    if (bossId != null) { u.boss = true; u.maxHp = u.life; u.hp = u.life; u.speedPx *= CFG.BOSS.speed; }
    u.boom = t.acts.filter(function (a) { return a && a.suicide && a.dmg; })[0] || null;   // 자폭 유닛(좀비)
    if (!u.act && !u.boom) u.act = t.acts.filter(function (a) { return a && a.dmg; })[0] || null;
    var rp = u.act ? u.act.range * CFG.FOE.rs : 0; u.ranged = rp > 80; u.reach = u.ranged ? Math.min(CFG.FOE.rangeMax, rp) : CFG.FOE.reach;
    if (u.boss) u.boom = null;
    u.state = 'move'; u.cd = 0; this.foes.push(u); return u;
  };
  P._fx = function (x, y, arm) { var d = this.D.data.fx.arms[arm], f = d && (d.hit.length ? d.hit : d.fly.length ? d.fly : d.seq); if (f && f.length) this.effects.push({ x: x, y: y, f: f, t0: this.D.time, add: !d.dir }); };
  P._hitFoe = function (u, dmg, arm) {
    if (u.state === 'dead') return; var D = this.D; u.hitT = D.time;
    if (u.vulnUntil > D.time) dmg *= 1 + (u.vuln || 0);      // 독 단도·유독가스: 받는 피해 증가
    if (this.cls === 'shadow') { var lr = u.life / (u.maxHp * CFG.FOE.hp); if (lr <= 0.2) dmg *= 1.6; else if (lr <= 0.5) dmg *= 1.3; }   // 섀도우 인필트레이터: 마무리 일격
    var kind = 'n'; if (dmg < 1e5 && D.rng.next() < this.crit) { if (D.rng.next() < CFG.CRIT.p2) { kind = 'd'; dmg *= CFG.CRIT.mul2; } else { kind = 'c'; dmg *= CFG.CRIT.mul; } }
    if (dmg < 1e5) { if (this.nums.length > 90) this.nums.shift(); this.nums.push({ x: u.x + (D.rng.next() - 0.5) * 14, y: u.y - u.headY - 2, v: Math.max(1, Math.round(dmg)), k: kind, t0: D.time }); } if (arm >= 0) this._fx(u.x, u.y - u.headY * 0.5, arm);
    var dd = Math.max(1, Math.round(dmg)), ST = this.stat; if (dd < 1e5) { ST.dealt += Math.min(dd, u.life); if (dd > ST.maxHit) ST.maxHit = dd; if (kind === 'c') ST.crit++; else if (kind === 'd') ST.dbl++; }
    u.life -= dd; if (u.boss) u.hp = Math.max(0, u.life); if (u.life > 0) return;
    if (u.boss) { ST.boss++; var hh = this.hero; hh.hp = Math.min(hh.maxHp, hh.hp + CFG.BOSS.heal); this.banner = { s: u.t.name + ' 처치!', t0: D.time, col: '#ffd36e' }; }
    u.state = 'dead'; u.deadT = 0; u.fade = 0; this.kills++; this._drop(u);
    if (D.time - this.dieSndT > 0.12) { this.dieSndT = D.time; D._play(u.t.snd && u.t.snd.die, 0.35); }   // 수십 기가 한꺼번에 쓰러져도 소리는 띄엄띄엄
  };
  P._hitHero = function (dmg) {
    var D = this.D, h = this.hero; if (this.over || D.time < this.invUntil || dmg <= 0) return;
    var sl = this._lvOf('sense'); if (sl && D.rng.next() < SK.sense.v(sl)) { this._text(h.x, h.y - h.headY - 8, '회피', '#9fe08a'); this.invUntil = D.time + CFG.HURT.inv; return; }
    dmg = Math.max(1, Math.round(dmg * CFG.FOE.dmg)); this.stat.taken += Math.min(dmg, h.hp); h.hp -= dmg; h.hitT = D.time; this.hurtT = D.time; this.invUntil = D.time + CFG.HURT.inv;
    if (h.hp <= 0) { h.hp = 0; h.state = 'dead'; h.deadT = 0; h.fade = 0; this.stick = null; this.keys = {}; this.over = 'dead'; this.overT = 0; D._play(h.t.snd && h.t.snd.die, 0.8); }
  };
  P.update = function (dt) {
    var D = this.D, R = D.rules, rng = D.rng, h = this.hero, v = this._moveVec(), F = this.foes, T = D.time, i, j, u;
    this.t += dt; if (this.t >= CFG.TIME) { this.t = CFG.TIME; this.over = 'win'; this.overT = 0; this.stick = null; return; }
    // 도둑: 걷기
    var moving = !!(v[0] || v[1]);
    var hs = this.speed * (T < this.stealthUntil && this._evo('shadow') ? 1.24 : 1);
    if (moving) { this.lastDir = v; h.x += v[0] * hs * dt; h.y += v[1] * hs * dt; if (h.state !== 'attack') h.state = 'move'; h.walkT += dt * Math.max(0.5, Math.hypot(v[0], v[1])) * CFG.SPEED; if (!(T < this.aimUntil)) D._faceVec(h, v[0], v[1]); }   // 단검을 던진 직후에는 던진 쪽을 본 채로 걷는다 (aimUntil)
    else if (h.state !== 'attack') h.state = 'idle';
    if (h.state === 'attack') { h.at += dt * R.tps * CFG.ATK.anim; if (h.at >= h.t.anim.atk.n) h.state = moving ? 'move' : 'idle'; }   // 던지는 동작: 걷는 중에도 (2026-11-19 사용자 지적) — 그동안 발은 걷지 않고 미끄러진다
    // 스폰
    // 웨이브: 1분마다 다음 단계. 단계가 바뀌면 알림 한 줄 + 우두머리 + 다음 단계 유닛 그림을 미리 받는다
    var WL = CFG.WAVE.list, wv = Math.min(WL.length - 1, Math.floor(this.t / CFG.WAVE.sec));
    if (wv !== this.wave || !this.waveOn) { this.wave = wv; this.waveOn = true; var WV = WL[wv]; if (WL[wv + 1]) { this._need(WL[wv + 1].add); if (WL[wv + 1].boss) this._need([WL[wv + 1].boss[0]]); }
      this.banner = { s: '웨이브 ' + (wv + 1) + (WV.boss ? ' — ' + D.types[WV.boss[0]].name + ' 등장' : ''), t0: T, col: WV.boss ? '#ff8a7a' : '#ffe9b0' };
      if (WV.boss) { this._need([WV.boss[0]]); this.bossWait = WV.boss; } }
    if (this.bossWait && this._has(this.bossWait[0])) { this._spawn(this.bossWait[0], this.bossWait[1]); this.bossWait = null; }
    this.spawnAcc += dt * WL[wv].rate;
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (F.length < WL[wv].cap) this._spawn(); }
    // 적: 도둑에게 다가가 친다. 격자(칸 32px)로 가까운 적끼리만 서로 밀어낸다
    var G = {}, CS = 32, SEP = CFG.FOE.sep, key, near = null, nd = CFG.ATK.range;
    for (i = 0; i < F.length; i++) { u = F[i]; if (u.state === 'dead') continue; key = Math.floor(u.x / CS) + ',' + Math.floor(u.y / CS); (G[key] || (G[key] = [])).push(u); }
    for (i = 0; i < F.length; i++) { u = F[i];
      if (u.state === 'dead') { u.deadT += dt; var dn = u.t.anim.die ? u.t.anim.die.n / R.tps : 0; if (u.deadT > dn) u.fade = Math.min(1, (u.deadT - dn) / 0.4); continue; }
      var dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
      if (d > CFG.FOE.far) { var p = this._edgePoint(); u.x = p[0]; u.y = p[1]; continue; }   // 너무 멀리 떨어진 적은 화면 둘레로 다시 온다
      if (d < nd) { nd = d; near = u; }
      if (u.bleedUntil > T) { u.dotT = (u.dotT || 0) + dt; if (u.dotT >= 0.5) { u.dotT = 0; this._hitFoe(u, u.bleed * 0.5, -1); if (u.state === 'dead') continue; } }   // 출혈 (베놈 쓰로워)
      if (u.boss) { u.stunUntil = 0; u.rootUntil = 0; u.slowUntil = 0; }   // 우두머리는 멈춤·묶임·감속이 안 걸린다
      if (u.stunUntil > T || u.rootUntil > T) { u.state = 'idle'; continue; }   // 멈춤(교란)·묶임(발목 함정)
      if (T < this.stealthUntil) { u.state = 'idle'; continue; }                // 그림자 숨기: 도둑을 못 찾는다
      if (u.boom) { if (d <= CFG.BOOM.touch) { this._fx(u.x, u.y - 10, u.boom.arm); D._play(u.boom.snd, 0.5); u.act = u.boom; if (d <= CFG.BOOM.radius) this._hitHero(R.attackValue(u)); u.state = 'dead'; u.deadT = 9; u.fade = 1; this.kills++; this._drop(u); continue; } }
      if (u.state === 'attack') {
        var A = u.t.anim.atk, n = A ? A.n : 6, hitAt = A && A.hit != null ? A.hit : Math.floor(n * 0.6); u.at += dt * R.tps;
        if (!u.hitDone && u.at >= hitAt) { u.hitDone = true;
          if (u.ranged) { var def = D.data.fx.arms[u.act.arm]; this.shots.push({ x: u.x, y: u.y - u.headY * 0.6, vx: dx / d * CFG.FOE.shot, vy: (dy + h.headY * 0.5 - u.headY * 0.6) / d * CFG.FOE.shot, dmg: R.damage(u, h, rng), arm: u.act.arm, def: def, foe: true, t0: T, life: (u.reach + 60) / CFG.FOE.shot }); }
          else if (d <= u.reach * 1.5) this._hitHero(R.damage(u, h, rng) * (u.boss ? CFG.BOSS.dmg : 1)); }   // 휘두르는 사이에 벗어나면 빗나간다
        if (u.at >= n) { u.state = 'idle'; u.cd = R.cooldown(u, rng); }
        continue; }
      if (u.cd > 0) u.cd -= dt;
      if (d <= u.reach * (u.boss && !u.ranged ? 1.5 : 1) && u.act) { D._faceVec(u, dx, dy); if (u.cd <= 0) { u.state = 'attack'; u.at = 0; u.hitDone = false; } else u.state = 'idle'; }
      else { var sp = u.speedPx * dt * (u.slowUntil > T ? SK.mouse.slow : 1); u.x += dx / d * sp; u.y += dy / d * sp; u.state = 'move'; u.walkT += dt; D._faceVec(u, dx, dy); }
      if (d < CFG.FOE.body) { u.x = h.x - dx / d * CFG.FOE.body; u.y = h.y - dy / d * CFG.FOE.body; }   // 도둑 몸 위로 겹쳐 올라서지 않는다 (밀려 들어온 적은 둘레로)
      // 밀어내기: 둘레 9칸의 적과 SEP 보다 가까우면 반씩 벌린다
      var cx = Math.floor(u.x / CS), cy = Math.floor(u.y / CS), a, b;
      for (a = cx - 1; a <= cx + 1; a++) for (b = cy - 1; b <= cy + 1; b++) { var L = G[a + ',' + b]; if (!L) continue;
        for (j = 0; j < L.length; j++) { var o = L[j]; if (o === u || o.uid < u.uid) continue; var ex = o.x - u.x, ey = o.y - u.y, e = Math.hypot(ex, ey);
          if (e < SEP) { if (e < 0.01) { ex = 1; ey = 0; e = 1; } var push = (SEP - e) / 2 / e; u.x -= ex * push; u.y -= ey * push; o.x += ex * push; o.y += ey * push; } } }
    }
    if (F.length && F[0].fade >= 1 || F.length > 40) this.foes = F.filter(function (o) { return !(o.state === 'dead' && o.fade >= 1); });
    // 도둑: 단도 던지기 — 사거리 안에서 가장 가까운 적에게 저절로 (걸으면서도 던진다. 서 있으면 던지는 동작을 보인다)
    this.atkCd -= dt;
    if (this.atkCd <= 0 && near) { var dl = this.sk.dagger; this.atkCd = CFG.ATK.sec * SK.dagger.sec(dl);
      var tx = near.x - h.x, ty = near.y - h.y, td = Math.hypot(tx, ty) || 1;
      D._faceVec(h, tx, ty, true); this.aimUntil = T + h.t.anim.atk.n / (R.tps * CFG.ATK.anim) + 0.05;   // 걷는 중에도 던지는 쪽으로 몸을 돌린다 (2026-11-19 사용자 지적: 등에서 단검이 나가는 것처럼 보였다)
      h.state = 'attack'; h.at = 0;
      this._dagger(near, SK.dagger.dmg(dl));
      var xl = this._lvOf('double'); if (xl) { var xn = SK.double.n(xl) + (this._evo('double') ? 2 : 0), px = -ty / td, py = tx / td; for (j = 0; j < xn; j++) { var off = (Math.floor(j / 2) + 1) * 7 * (j % 2 ? -1 : 1); this._dagger(near, SK.double.dmg(xl), px * off, py * off); } }
      D._play(h.act.snd, 0.3); }
    this._growStep(dt, G, near);
    // 발사체: 도둑의 단도는 겨눈 적을 따라가고(적이 쓰러지면 곧게), 적의 것은 곧게 날아와 피할 수 있다
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i];
      if (s.tgt && s.tgt.state !== 'dead') { var qx = s.tgt.x - s.x, qy = s.tgt.y - s.tgt.headY * 0.5 - s.y, qd = Math.hypot(qx, qy) || 1; s.vx = qx / qd * CFG.ATK.shot; s.vy = qy / qd * CFG.ATK.shot;
        if (qd <= CFG.ATK.shot * dt + 8) { this._hitFoe(s.tgt, s.dmg * (s.dg ? this._onDagger(s.tgt) : 1), s.arm); s.dead = true; continue; } }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (!s.foe && !(s.tgt && s.tgt.state !== 'dead')) { var gx = Math.floor(s.x / CS), gy = Math.floor((s.y + 16) / CS), ga, gb, gj, got = null;   // 겨눈 적이 없는 단검(다팅 피버·적이 먼저 쓰러진 단검): 처음 닿는 적을 맞힌다
        for (ga = gx - 1; ga <= gx + 1 && !got; ga++) for (gb = gy - 1; gb <= gy + 1 && !got; gb++) { var GL = G[ga + ',' + gb]; if (GL) for (gj = 0; gj < GL.length; gj++) if (GL[gj].state !== 'dead' && Math.hypot(GL[gj].x - s.x, GL[gj].y - GL[gj].headY * 0.5 - s.y) < 15) { got = GL[gj]; break; } }
        if (got) { this._hitFoe(got, s.dmg * (s.dg ? this._onDagger(got) : 1), s.arm); s.dead = true; continue; } }
      if (s.foe && Math.hypot(h.x - s.x, h.y - h.headY * 0.5 - s.y) < 13) { this._fx(s.x, s.y, s.arm); this._hitHero(s.dmg); s.dead = true; }
      else if (T - s.t0 > s.life) s.dead = true; }
    this.shots = this.shots.filter(function (s) { return !s.dead; });
    this.effects = this.effects.filter(function (e) { return (T - e.t0) * 15 < e.f.length; });
    this.texts = this.texts.filter(function (e) { return T - e.t0 < 0.7; });
    this.nums = this.nums.filter(function (e) { return T - e.t0 < NUM[e.k].life; });
    // 카메라: 도둑을 부드럽게 따라간다 (끊기지 않을 만큼만 — 늦으면 멀미가 난다)
    var k = Math.min(1, dt * 12); this.cam.x += (h.x - this.cam.x) * k; this.cam.y += (h.y - this.cam.y) * k;
  };

  /* ───────── 그리기 ───────── */
  P.draw = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, Z = CFG.ZOOM, i;
    ctx.setTransform(D.rs, 0, 0, D.rs, 0, 0); ctx.imageSmoothingEnabled = !!D.look || Z !== 1; if (ctx.imageSmoothingEnabled) ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
    if (!this.ready()) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif'; ctx.fillStyle = '#ffe9b0'; ctx.fillText('서바이벌 준비 중…', W / 2, H / 2); ctx.textAlign = 'left'; return; }
    var hx = W / 2, hy = Math.round(H * CFG.HERO_Y), vw = W / Z, vh = H / Z;          // 화면에서 도둑이 서는 자리, 전장 좌표로 본 화면 크기
    var ox = Math.round(this.cam.x - hx / Z), oy = Math.round(this.cam.y - hy / Z);   // 화면 왼쪽 위 = 전장의 어디
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-ox, -oy);
    var gx0 = Math.floor(ox / GW) * GW, gy0 = Math.floor(oy / GH) * GH, gx, gy;
    for (gx = gx0; gx < ox + vw; gx += GW) for (gy = gy0; gy < oy + vh; gy += GH) ctx.drawImage(D.ground, gx, gy);
    var L = this.foes.filter(function (u) { return u.x > ox - 80 && u.x < ox + vw + 80 && u.y > oy - 40 && u.y < oy + vh + 120; }).sort(function (a, b) { return a.y - b.y; });
    this._drawGround();
    var h = this.hero, hd = false;
    for (i = 0; i < L.length; i++) { if (!hd && L[i].y > h.y) { hd = true; this._drawHero(); } if (L[i].boss) { var bu = L[i], bs = CFG.BOSS.scale; ctx.save(); ctx.translate(bu.x, bu.y); ctx.scale(bs, bs); ctx.translate(-bu.x, -bu.y); D._drawUnit(bu); ctx.restore(); } else D._drawUnit(L[i]); }
    if (!hd) this._drawHero();
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i], fl = s.def && !s.def.dir && s.def.fly;
      if (fl && fl.length) D._fxFrame(fl[Math.floor((D.time - s.t0) * 15) % fl.length], s.x, s.y, true);
      else { var sa = Math.atan2(s.vy, s.vx), cx = Math.cos(sa) * 7, cy = Math.sin(sa) * 7; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x - cx, s.y - cy); ctx.lineTo(s.x + cx, s.y + cy); ctx.stroke();
        ctx.strokeStyle = s.foe ? '#ff9a8a' : '#f3f0e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - cx, s.y - cy); ctx.lineTo(s.x + cx, s.y + cy); ctx.stroke(); } }
    for (i = 0; i < this.effects.length; i++) { var e = this.effects[i]; D._fxFrame(e.f[Math.floor((D.time - e.t0) * 15)], e.x, e.y, e.add); }
    this._drawNums();
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (i = 0; i < this.texts.length; i++) { var tx = this.texts[i], tk = (D.time - tx.t0) / 0.7; ctx.globalAlpha = 1 - tk * tk; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(tx.s, tx.x, tx.y - tk * 20); ctx.fillStyle = tx.col || '#ffd23e'; ctx.fillText(tx.s, tx.x, tx.y - tk * 20); }
    ctx.textAlign = 'left';
    ctx.restore(); ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = !!D.look;
    // 맞으면 화면 가장자리가 붉어진다. 체력 30% 이하면 옅게 남는다
    var ht = 1 - (D.time - this.hurtT) / CFG.HURT.flash, low = h.hp > 0 && h.hp <= h.maxHp * 0.3 ? 0.35 + 0.15 * Math.sin(D.time * 6) : 0, va = Math.max(ht > 0 ? ht * 0.75 : 0, low);
    if (va > 0) { var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72); vg.addColorStop(0, 'rgba(200,20,10,0)'); vg.addColorStop(1, 'rgba(200,20,10,' + va.toFixed(3) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); }
    this._drawStick(); this._drawHud();
    if (this.over) this._drawOver();
    if (this.cards) this._drawCards();
    if (this.menu) this._drawMenu();
  };
  P._drawHero = function () { var D = this.D, h = this.hero; D._drawUnit(h); D.ctx.globalAlpha = 1; if (h.state !== 'dead' && h.hp >= h.maxHp) D._drawHpBar(h, Math.round(h.x), Math.round(h.y)); };   // 체력 바는 늘 보인다 (닳으면 _drawUnit 이 그린다)
  /* 끝난 화면 = 결과 리포트: 생존 시간·웨이브·처치·레벨·전직 / 준 피해·최고 한 방·치명타·받은 피해 / 가진 스킬 */
  P._drawOver = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, self = this, win = this.over === 'win', al = Math.min(1, this.overT / 0.6), ST = this.stat, pw = Math.min(330, W - 28), px = Math.round((W - pw) / 2), i;
    var keys = Object.keys(this.sk).filter(function (k) { return k !== 'dagger'; }), all = ['dagger'].concat(keys), per = Math.floor((pw - 28) / 40), srows = Math.ceil(all.length / per), ph = 280 + srows * 46 + 116, py = Math.max(24, Math.round((H - ph) / 2));
    ctx.fillStyle = 'rgba(4,6,10,' + (0.74 * al).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); if (this.overT < 0.6) { this.overBtns = null; return; }
    D._plate(px, py, pw, ph, 8, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = win ? '#ffd36e' : '#ffb4a8'; ctx.fillText(win ? '10분을 버텼습니다' : '쓰러졌습니다', W / 2, py + 34);
    var rows = [['생존 시간', mmss(Math.floor(this.t))], ['웨이브', (this.wave + 1) + ' / ' + CFG.WAVE.list.length], ['처치', this.kills + (ST.boss ? '  (우두머리 ' + ST.boss + ')' : '')], ['레벨', this.lv + (this.cls ? '  ·  ' + CLS[this.cls].name : '')],
      ['준 피해', Math.round(ST.dealt).toLocaleString()], ['최고 한 방', ST.maxHit.toLocaleString()], ['치명타 / 더블', ST.crit + ' / ' + ST.dbl], ['받은 피해', Math.round(ST.taken).toLocaleString()]];
    ctx.font = '13px sans-serif';
    for (i = 0; i < rows.length; i++) { var ry = py + 68 + i * 24; ctx.textAlign = 'left'; ctx.fillStyle = '#9aa3b8'; ctx.fillText(rows[i][0], px + 24, ry); ctx.textAlign = 'right'; ctx.fillStyle = i < 4 ? '#ffe9b0' : '#dfe6f5'; ctx.fillText(rows[i][1], px + pw - 24, ry);
      if (i === 3) { ctx.fillStyle = 'rgba(168,130,58,.5)'; ctx.fillRect(px + 20, ry + 12, pw - 40, 1); } }
    var sy = py + 68 + rows.length * 24 + 10, IC = D.data.fx.icon, icons = D.assets.get('acticons');
    ctx.textAlign = 'left'; ctx.fillStyle = '#9aa3b8'; ctx.fillText('스킬', px + 24, sy);
    all.forEach(function (k, n) { var bx = px + 16 + (n % per) * 40, by = sy + 14 + Math.floor(n / per) * 46, fi = SK[k].icon * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, bx, by, 34, 37);
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(self.sk[k], bx + 34, by + 32); ctx.fillStyle = self._evo(k) ? '#ffd36e' : '#fff'; ctx.fillText(self.sk[k], bx + 34, by + 32); });
    var bts = [['retry', '다시 하기'], ['exit', '모드 선택으로']], by0 = py + ph - 112; this.overBtns = []; ctx.textAlign = 'center';
    for (i = 0; i < bts.length; i++) { var b = { x: px + 14, y: by0 + i * 50, w: pw - 28, h: 42, act: bts[i][0] }; this.overBtns.push(b); D._plate(b.x, b.y, b.w, b.h, 5, false); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = '#dfe6f5'; ctx.fillText(bts[i][1], b.x + b.w / 2, b.y + b.h / 2); }
    ctx.textAlign = 'left';
  };
  /* 피해 숫자 (2026-11-19 사용자 요청 — 붉은보석처럼 그림 숫자): 글꼴로 매번 쓰지 않고, 굵은 기울임 숫자 0~9 를 색별로 한 장(시트)에 구워 두고 그림으로 찍는다.
     보통 = 흰색 · 치명타 = 노랑 · 더블 크리티컬 = 붉은색. 뜨는 순간 크게 튀었다가 제 크기로 줄고, 위로 떠오르며 사라진다. 그림은 이 게임에서 그린 것(붉은보석의 그림이 아니다) */
  P._numSheet = function (k) {
    var N = NUM[k]; if (N.cv) return N;
    var K = 3, fs = N.size * K, cv = document.createElement('canvas'), g = cv.getContext('2d'), font = 'italic 900 ' + fs + 'px "Arial Black", Impact, "Helvetica Neue", sans-serif', i;
    g.font = font; var cw = 0; for (i = 0; i < 10; i++) cw = Math.max(cw, g.measureText(String(i)).width); cw = Math.ceil(cw + K * 4); var ch = Math.ceil(fs * 1.25);
    cv.width = cw * 10; cv.height = ch; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (i = 0; i < 10; i++) { var x = i * cw + cw / 2, y = ch / 2 + K, gr = g.createLinearGradient(0, ch * 0.18, 0, ch * 0.88); gr.addColorStop(0, N.top); gr.addColorStop(0.55, N.mid); gr.addColorStop(1, N.bot);
      g.lineWidth = K * 3.2; g.strokeStyle = N.edge; g.strokeText(String(i), x, y); g.lineWidth = K * 1.2; g.strokeStyle = '#000'; g.strokeText(String(i), x, y); g.fillStyle = gr; g.fillText(String(i), x, y);
      g.save(); g.beginPath(); g.rect(i * cw, 0, cw, ch * 0.5); g.clip(); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillText(String(i), x, y); g.restore(); }   // 윗부분 광택
    N.cv = cv; N.cw = cw / K; N.ch = ch / K; N.K = K; return N;
  };
  P._drawNums = function () {
    var D = this.D, ctx = D.ctx, T = D.time, i, j;
    for (i = 0; i < this.nums.length; i++) { var n = this.nums[i], N = this._numSheet(n.k), t = T - n.t0, k = t / N.life, s = String(n.v), pop = t < 0.1 ? 1.7 - 7 * t : 1, adv = N.cw * 0.62 * pop, w = adv * (s.length - 1) + N.cw * pop;
      var y = n.y - N.rise * (1 - (1 - k) * (1 - k)) - N.ch * pop / 2, x = n.x - w / 2; ctx.globalAlpha = k > 0.65 ? Math.max(0, (1 - k) / 0.35) : 1;
      for (j = 0; j < s.length; j++) { var dg = s.charCodeAt(j) - 48; ctx.drawImage(N.cv, dg * N.cw * N.K, 0, N.cw * N.K, N.ch * N.K, x + j * adv, y, N.cw * pop, N.ch * pop); } }
    ctx.globalAlpha = 1;
  };
  P._drawStick = function () {
    var S = this.stick, ctx = this.D.ctx; if (!S) return;
    var dx = S.x - S.x0, dy = S.y - S.y0, m = Math.hypot(dx, dy), R = CFG.STICK.r, k = m > R ? R / m : 1;
    ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#0b0d12'; ctx.beginPath(); ctx.arc(S.x0, S.y0, R + 6, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#e6c476'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#e6c476'; ctx.beginPath(); ctx.arc(S.x0 + dx * k, S.y0 + dy * k, 16, 0, 6.3); ctx.fill(); ctx.restore();
  };
  /* HUD: 위 = 경험치 막대(폭 전체) + [남은 시간 · 처치 수 · 설정], 아래 = 가진 스킬 칸 6 + 축지법 칸. 가운데는 비운다 (전장을 가리지 않게) */
  P._layout = function () {
    var D = this.D, W = D.W, H = D.H, S = CFG.SAFE, sw = 34, gap = 4, by = H - S.bottom - sw - 4, i;
    this.xpBox = { x: 8, y: S.top, w: W - 16, h: 7 };
    this.menuBtn = { x: W - 8 - 34, y: S.top + 12, w: 34, h: 28 };
    this.slots = []; for (i = 0; i < CFG.SLOTS; i++) this.slots.push({ x: 8 + i * (sw + gap), y: by, w: sw, h: sw });
    this.blinkBtn = { x: W - 8 - 44, y: by - 10, w: 44, h: 44 };
    this.hudBot = by - 12;                                   // 이 아래는 조작 영역이 아니다 (스킬 줄)
  };
  P._drawHud = function () {
    var D = this.D, ctx = D.ctx, W = D.W, X = (this._layout(), this.xpBox), i;
    var g = ctx.createLinearGradient(0, 0, 0, 62); g.addColorStop(0, 'rgba(5,6,10,.7)'); g.addColorStop(1, 'rgba(5,6,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 62);
    // 경험치 막대 + 레벨
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(X.x, X.y, X.w, X.h); ctx.fillStyle = '#5fb0ff'; ctx.fillRect(X.x + 1, X.y + 1, Math.round((X.w - 2) * Math.min(1, this.exp / this.expNeed)), X.h - 2);
    ctx.strokeStyle = '#a8823a'; ctx.lineWidth = 1; ctx.strokeRect(X.x + 0.5, X.y + 0.5, X.w - 1, X.h - 1);
    ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif';
    var ty = X.y + 26, txt = function (s, x, al, col) { ctx.textAlign = al; ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, ty + 1); ctx.fillStyle = col; ctx.fillText(s, x, ty); };
    txt(mmss(CFG.TIME - this.t), 10, 'left', '#ffe9b0'); txt('처치 ' + this.kills, W / 2, 'center', '#dfe6f5');
    ctx.font = 'bold 11px sans-serif'; txt('웨이브 ' + (this.wave + 1) + '/' + CFG.WAVE.list.length, 66, 'left', '#c9b48a');
    // 알림 한 줄 (웨이브·우두머리): 위쪽 띠 바로 아래에 작고 짧게
    var BN = this.banner, bt = BN ? D.time - BN.t0 : 9; if (BN && bt < 2.2) { ctx.globalAlpha = Math.min(1, bt / 0.2, (2.2 - bt) / 0.5); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(BN.s, W / 2, X.y + 54); ctx.fillStyle = BN.col; ctx.fillText(BN.s, W / 2, X.y + 54); ctx.globalAlpha = 1; }
    // 화면 밖 우두머리: 가장자리에 붉은 화살표
    var Zm = CFG.ZOOM, hx0 = W / 2, hy0 = D.H * CFG.HERO_Y, F = this.foes;
    for (i = 0; i < F.length; i++) { var bo = F[i]; if (!bo.boss || bo.state === 'dead') continue; var sx = hx0 + (bo.x - this.cam.x) * Zm, sy = hy0 + (bo.y - this.cam.y) * Zm;
      if (sx > 16 && sx < W - 16 && sy > 70 && sy < this.hudBot - 10) continue; var ax = Math.max(18, Math.min(W - 18, sx)), ay = Math.max(74, Math.min(this.hudBot - 14, sy)), an = Math.atan2(sy - ay, sx - ax), pu = 0.6 + 0.4 * Math.sin(D.time * 7);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.globalAlpha = pu; ctx.fillStyle = '#ff5a3a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif';
    ctx.font = 'bold 12px sans-serif'; txt('Lv ' + this.lv, this.menuBtn.x - 8, 'right', '#9cc0ff');
    var M = this.menuBtn; D._plate(M.x, M.y, M.w, M.h, 5, false); ctx.fillStyle = '#e6c476'; for (i = 0; i < 3; i++) ctx.fillRect(M.x + 10, M.y + 8 + i * 5, M.w - 20, 2);
    // 스킬 칸: 얻은 순서대로 (아이콘 + 레벨, 주기 스킬은 남은 대기만큼 어둡게 덮인다). 누르는 버튼이 아니라 지금 빌드의 표시
    var IC = D.data.fx.icon, icons = D.assets.get('acticons'), self = this, icon = function (ic, b, pad) { var fi = ic * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, b.x + pad, b.y + pad, b.w - pad * 2, b.h - pad * 2); };
    var cool = function (key, b) { var s = SK[key], l = self.sk[key], r = s.cd && self.tm[key] > 0 ? Math.min(1, self.tm[key] / s.cd(l)) : 0; if (r > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(b.x + 3, b.y + 3 + (b.h - 6) * (1 - r), b.w - 6, (b.h - 6) * r); } };
    for (i = 0; i < this.slots.length; i++) { var b = this.slots[i], key = this.order[i]; ctx.globalAlpha = key ? 1 : 0.4; D._plate(b.x, b.y, b.w, b.h, 4, false);
      if (key) { icon(SK[key].icon, b, 4); cool(key, b); ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); ctx.fillStyle = this._evo(key) ? '#ffd36e' : '#fff'; ctx.fillText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); } }
    var B = this.blinkBtn; ctx.globalAlpha = 1; D._plate(B.x, B.y, B.w, B.h, 6, !(this.tm.blink > 0)); icon(SK.blink.icon, B, 6); cool('blink', B);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  P._menuRows = function () { return [['resume', '계속하기'], ['sound', '소리: ' + (this.D.soundOn ? '켬' : '끔')], ['retry', '다시 하기'], ['exit', '모드 선택으로']]; };
  P._drawMenu = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, rows = this._menuRows(), pw = Math.min(250, W - 40), rh = 44, ph = 52 + rows.length * (rh + 8) + 6, px = Math.round((W - pw) / 2), py = Math.round(Math.max(60, (H - ph) / 2 - 40)), i;
    ctx.fillStyle = 'rgba(4,6,10,.72)'; ctx.fillRect(0, 0, W, H); D._plate(px, py, pw, ph, 8, false);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = '#ffe9b0'; ctx.fillText('일시정지', W / 2, py + 26);
    this.menuBox = { x: px, y: py, w: pw, h: ph }; this.menuRowBoxes = [];
    for (i = 0; i < rows.length; i++) { var b = { x: px + 14, y: py + 52 + i * (rh + 8), w: pw - 28, h: rh, act: rows[i][0] }; this.menuRowBoxes.push(b);
      D._plate(b.x, b.y, b.w, b.h, 5, false); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = b.act === 'exit' || b.act === 'retry' ? '#ffb4a8' : '#dfe6f5'; ctx.fillText(rows[i][1], b.x + b.w / 2, b.y + b.h / 2); }
    ctx.textAlign = 'left';
  };
  P._menuTap = function (x, y) {
    if (this.menuT < 0.15) return;
    var B = this.menuRowBoxes || [], hit = null, i; for (i = 0; i < B.length; i++) if (inBox(B[i], x, y)) { hit = B[i].act; break; }
    if (!hit) { if (!inBox(this.menuBox, x, y)) this.menu = false; return; }
    if (hit === 'sound') { this.D.toggleSound(); return; }
    this.menu = false;
    if (hit === 'retry') this.reset(); else if (hit === 'exit') this.exit();
  };
  P.openMenu = function () { this.menu = true; this.menuT = 0; this.stick = null; this.keys = {}; };

  /* 모드 선택으로 돌아간다: 캔버스와 입력을 디펜스에 돌려준다 */
  P.exit = function () {
    var D = this.D; this.done = true; this.stick = null; this.keys = {};
    D.theme = this._theme; D.sub = null; D.modeOk = false; D.screen = 'title'; D.titleSeen = true;
    if (D._modeBgm) D._modeBgm();
  };

  /* ───────── 입력: 누른 곳이 조이스틱 중심. PC 는 WASD·화살표, Esc = 일시정지 ───────── */
  P._bind = function () {
    var self = this, D = this.D, cv = D.cv, on = function () { return D.sub === self && !self.done; };
    cv.addEventListener('pointerdown', function (e) { if (!on()) return; e.preventDefault(); var p = D._pos(e), x = p[0], y = p[1];
      D.sfx.unlock(); D.bgm.resume();
      if (self.menu) { self._menuTap(x, y); return; }
      if (self.cards) { self._cardTap(x, y); return; }
      if (self.over) { (self.overBtns || []).forEach(function (b) { if (inBox(b, x, y)) { if (b.act === 'retry') self.reset(); else self.exit(); } }); return; }
      if (inBox(self.menuBtn, x, y)) { self.openMenu(); return; }
      if (inBox(self.blinkBtn, x, y)) { self._blink(0, 0); return; }   // 축지법 칸: 걷던 쪽으로
      if (y >= self.hudBot) return;                          // 스킬 줄
      var now = Date.now(), LD = self.lastDown; self.lastDown = { t: now, x: x, y: y };
      if (LD && now - LD.t < 300 && Math.hypot(x - LD.x, y - LD.y) < 44) { self.lastDown = null; self._blink(x - D.W / 2, y - D.H * CFG.HERO_Y); return; }   // 두 번 누르기 = 그쪽으로 축지법
      self.stick = { id: e.pointerId, x0: x, y0: y, x: x, y: y }; try { cv.setPointerCapture(e.pointerId); } catch (err) {} });
    cv.addEventListener('pointermove', function (e) { var S = self.stick; if (!on() || !S || S.id !== e.pointerId) return; var p = D._pos(e); S.x = p[0]; S.y = p[1];
      var dx = S.x - S.x0, dy = S.y - S.y0, m = Math.hypot(dx, dy), R = CFG.STICK.r * 1.6; if (m > R) { S.x0 = S.x - dx / m * R; S.y0 = S.y - dy / m * R; } });   // 멀리 끌면 중심이 따라온다 (방향을 바꾸려고 손가락을 한참 되돌리지 않게)
    var end = function (e) { var S = self.stick; if (S && S.id === e.pointerId) self.stick = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    root.addEventListener('keydown', function (e) { if (!on()) return;
      if (e.key === 'Escape') { if (self.menu) self.menu = false; else self.openMenu(); return; }
      if (e.code === 'KeyM' && !e.repeat) { D.sfx.unlock(); D.toggleSound(); return; }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); self._blink(0, 0); return; }
      if (self.cards && /^Digit[1-3]$/.test(e.code)) { var ci = +e.code.charAt(5) - 1; if (self.cards[ci] && self.cardT >= 0.4) self._pick(self.cards[ci]); return; }
      if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) { e.preventDefault(); if (!self.menu) self.keys[e.code] = true; } });
    root.addEventListener('keyup', function (e) { delete self.keys[e.code]; });
    root.addEventListener('blur', function () { self.keys = {}; self.stick = null; });
  };

  /* ───────── 3단계: 성장 — 경험치·레벨업 카드·스킬·전직 ─────────
     스킬의 동작은 「붉은보석」 도둑(공식 가이드의 스킬 표 C061)에서, 그림·소리·아이콘은 거울전쟁 것(icon = 원작 행동 아이콘 번호, 이펙트 = 원작 이펙트 칸).
     수치는 표의 배열(레벨 1~5). 피해 배수의 1 = 도둑의 기본 공격값(원본 공식 × CFG.ATK.dmg). 스킬을 더하거나 고치려면 이 표만 손보면 된다.
     tree: throw 투척 · trap 함정 · shadow 암살 · pas 패시브. slot = HUD 스킬 칸(6칸)을 차지한다. evo = 전직(cls)하면 바뀌는 이름 */
  var L5 = function (a) { return function (l) { return a[Math.max(1, Math.min(5, l)) - 1]; }; };
  var pc = function (v) { return Math.round(v * 100) + '%'; };
  var SK = {
    dagger: { name: '단도 던지기', tree: 'throw', icon: 63, slot: 1, dmg: L5([1, 1.2, 1.4, 1.65, 1.9]), sec: L5([1, 0.93, 0.86, 0.8, 0.72]),
      desc: function (l) { return '가장 가까운 적에게 단검을 던집니다. 피해 ' + pc(this.dmg(l)) + ', 던지는 간격 ' + pc(this.sec(l)); } },
    double: { name: '더블 드로잉', tree: 'throw', icon: 5, slot: 1, evo: { cls: 'venom', name: '코인시던스 드로잉' }, n: L5([1, 1, 2, 2, 3]), dmg: L5([0.6, 0.75, 0.75, 0.9, 0.9]),
      desc: function (l, ev) { return '같은 적에게 단검 ' + (this.n(l) + (ev ? 2 : 0)) + '개를 더 던집니다 (각 피해 ' + pc(this.dmg(l)) + ')' + (ev ? ', 치명타 확률 +5%' : ''); } },
    scatter: { name: '단도 흩뿌리기', tree: 'throw', icon: 4, slot: 1, evo: { cls: 'venom', name: '단도 총공격' }, cd: L5([2.4, 2.4, 2.2, 2.2, 2]), n: L5([2, 3, 4, 5, 7]), dmg: L5([0.7, 0.8, 0.9, 1, 1.1]),
      desc: function (l, ev) { return '사거리 안의 적 ' + (this.n(l) + (ev ? 2 : 0)) + '명에게 한꺼번에 던집니다 (피해 ' + pc(this.dmg(l)) + ')' + (ev ? '. 적이 적으면 두 번' : ''); } },
    fever: { name: '다팅 피버', tree: 'throw', icon: 54, slot: 1, evo: { cls: 'venom', name: '다팅 퓨리' }, cd: L5([7, 6.5, 6, 5.5, 5]), n: L5([8, 10, 10, 12, 12]), w: L5([1, 1, 2, 2, 3]), dmg: L5([0.8, 0.9, 1, 1.1, 1.2]),
      desc: function (l, ev) { return '사방으로 단검 ' + this.n(l) + '개를 ' + (this.w(l) + (ev ? 1 : 0)) + '번 난사합니다 (피해 ' + pc(this.dmg(l) * (ev ? 1.3 : 1)) + ')'; } },
    poison: { name: '독 단도', tree: 'throw', icon: 79, slot: 1, v: L5([0.15, 0.25, 0.35, 0.45, 0.6]), dur: 4,
      desc: function (l) { return '단검에 맞은 적은 4초 동안 받는 피해 +' + pc(this.v(l)); } },
    mouse: { name: '쥐덫 설치', tree: 'trap', icon: 62, slot: 1, arm: 63, boom: 62, cd: L5([3, 2.6, 2.3, 2, 1.7]), dmg: L5([1.2, 1.5, 1.8, 2.2, 2.6]), slow: 0.7, slowSec: 3, max: 10,
      desc: function (l) { return this.cd(l) + '초마다 발밑에 쥐덫을 놓습니다. 밟은 적에게 피해 ' + pc(this.dmg(l)) + ', 3초 감속'; } },
    booby: { name: '발목 함정 설치', tree: 'trap', icon: 77, slot: 1, arm: 46, boom: 62, evo: { cls: 'trapper', name: '절단 함정' }, cd: L5([6, 5.5, 5, 4.5, 4]), root: L5([2, 2.5, 3, 3.5, 4]), dmg: L5([0.6, 0.7, 0.8, 0.9, 1]), max: 6,
      desc: function (l, ev) { return this.cd(l) + '초마다 발목 함정을 놓습니다. 밟은 적' + (ev ? '과 둘레의 적 모두' : '') + '를 ' + this.root(l) + '초 묶고 피해 ' + pc(this.dmg(l) * (ev ? 2 : 1)); } },
    explo: { name: '폭발 함정 설치', tree: 'trap', icon: 64, slot: 1, arm: 64, boom: 64, evo: { cls: 'trapper', name: '연폭 함정' }, cd: L5([7, 6.5, 6, 5.5, 5]), dmg: L5([3, 4, 5, 6.5, 8]), r: 60, max: 6,
      desc: function (l, ev) { return this.cd(l) + '초마다 폭발 함정을 놓습니다. 밟으면 둘레의 적 모두에게 피해 ' + pc(this.dmg(l)) + (ev ? ' — 3번 연달아 폭발' : ''); } },
    simul: { name: '일제 폭발', tree: 'trap', icon: 39, slot: 1, boom: 20, need: 'trap', cd: L5([12, 11, 10, 9, 8]), dmg: L5([2, 2.6, 3.2, 4, 5]), r: 48,
      desc: function (l) { return this.cd(l) + '초마다 깔아 둔 덫을 모두 터뜨립니다. 덫마다 둘레에 피해 ' + pc(this.dmg(l)); } },
    gas: { name: '유독가스', tree: 'trap', icon: 92, slot: 1, arm: 79, evo: { cls: 'trapper', name: '독무' }, cd: L5([9, 8.5, 8, 7.5, 7]), dmg: L5([0.8, 1, 1.2, 1.5, 1.8]), r: 50, dur: 4, v: 0.1,
      desc: function (l, ev) { return this.cd(l) + '초마다 독 구름을 던집니다. ' + (ev ? 6 : 4) + '초 동안 안의 적에게 초당 피해 ' + pc(this.dmg(l)) + ', 받는 피해 +' + (ev ? '16%' : '10%') + (ev ? ' (범위 1.5배)' : ''); } },
    blink: { name: '축지법', tree: 'shadow', icon: 12, cd: L5([6, 5.5, 5, 4.5, 4]), dist: L5([110, 125, 140, 155, 170]),
      desc: function (l) { return '화면을 두 번 누르면 그쪽으로 ' + this.dist(l) + '만큼 순간 이동합니다 (대기 ' + this.cd(l) + '초, 잠깐 무적)'; } },
    surprise: { name: '기습', tree: 'shadow', icon: 85, slot: 1, fx: 74, evo: { cls: 'shadow', name: '교란' }, cd: L5([7, 6.5, 6, 5.5, 5]), dmg: L5([5, 6.5, 8, 10, 12]), range: 230,
      desc: function (l, ev) { return this.cd(l) + '초마다 가장 튼튼한 적을 급습해 피해 ' + pc(this.dmg(l)) + (ev ? ', 둘레의 적을 2초 멈춥니다' : ''); } },
    shadow: { name: '그림자 숨기', tree: 'shadow', icon: 11, slot: 1, evo: { cls: 'shadow', name: '그림자 동화' }, cd: L5([16, 15, 14, 13, 12]), dur: L5([2, 2.5, 3, 3.5, 4]), crit: L5([0.2, 0.275, 0.35, 0.425, 0.5]),
      desc: function (l, ev) { return this.cd(l) + '초마다 ' + (this.dur(l) + (ev ? 1.5 : 0)) + '초 동안 숨습니다. 적이 쫓지 못하고 치명타 확률 +' + pc(this.crit(l)) + (ev ? ', 이동 속도 +24%' : ''); } },
    assassin: { name: '암살', tree: 'shadow', icon: 41, slot: 1, evo: { cls: 'shadow', name: '처형' }, p: L5([0.03, 0.05, 0.07, 0.09, 0.12]),
      desc: function (l, ev) { return '단검에 맞은 적이 ' + pc(this.p(l) * (ev ? 1.5 : 1)) + ' 확률로 즉사합니다 (우두머리는 5배 피해)'; } },
    sense: { name: '육감', tree: 'pas', icon: 9, v: L5([0.06, 0.12, 0.18, 0.24, 0.3]), desc: function (l) { return '적의 공격을 ' + pc(this.v(l)) + ' 확률로 피합니다'; } },
    pick: { name: '소매치기', tree: 'pas', icon: 53, v: L5([1.25, 1.5, 1.75, 2, 2.3]), desc: function (l) { return '경험치를 끌어오는 범위 ' + pc(this.v(l)); } }
  };
  var CLS = {
    venom: { name: '베놈 쓰로워', icon: 61, col: '#9fe08a', lines: ['단검에 맞은 적이 3초 동안 피를 흘립니다', '더블 드로잉 → 코인시던스 드로잉', '다팅 피버 → 다팅 퓨리 · 단도 흩뿌리기 → 단도 총공격'] },
    trapper: { name: '사일런트 트래퍼', icon: 64, col: '#ffcf7a', lines: ['덫이 더 멀리서 반응하고 일제 폭발이 두 번 터집니다', '발목 함정 → 절단 함정 · 폭발 함정 → 연폭 함정', '유독가스 → 독무'] },
    shadow: { name: '섀도우 인필트레이터', icon: 80, col: '#c9a8ff', lines: ['체력 50% 이하 적에게 피해 +30%, 20% 이하 +60%', '그림자 숨기 → 그림자 동화 · 기습 → 교란', '암살 → 처형'] }
  };
  var GROW = { classLv: q('classlv', 7), pickup: 64, gemSpeed: 330, hpLv: 6, heal: 30, trapR: 16, trapRx: 1.7, critMax: 0.6, need: function (lv) { return 3 + lv * 2; } };
  SurvivalGame.SK = SK; SurvivalGame.CLS = CLS; SurvivalGame.GROW = GROW;

  P._growReset = function () {
    var self = this, D = this.D;
    this.lv = 1; this.exp = 0; this.expNeed = GROW.need(1); this.pend = 0; this.cards = null; this.cardT = 0; this.cls = null;
    this.sk = { dagger: 1, blink: 1 }; this.order = ['dagger']; this.tm = {}; this.traps = []; this.zones = []; this.gems = []; this.queue = [];
    this.stealthUntil = 0; this.lastDir = [1, 0]; this.lastDown = null;
    Object.keys(SK).forEach(function (k) { var s = SK[k]; [s.arm, s.boom, s.fx].forEach(function (a) { var d = a != null && D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); }); });
    [3, 38].forEach(function (a) { var d = D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); });
    var pre = /[?&]sk=([a-z,]+)/.exec(root.location.search); if (pre) pre[1].split(',').forEach(function (k) { if (SK[k]) { if (!self.sk[k] && SK[k].slot) self.order.push(k); self.sk[k] = q('sklv', 3); } });   // ?sk=fever,explo&sklv=5 : 시험용
    var pc0 = /[?&]cls=([a-z]+)/.exec(root.location.search); if (pc0 && CLS[pc0[1]]) this.cls = pc0[1];
  };
  P._lvOf = function (k) { return this.sk[k] || 0; };
  P._evo = function (k) { var e = SK[k].evo; return !!(e && this.cls === e.cls); };
  P._name = function (k) { return this._evo(k) ? SK[k].evo.name : SK[k].name; };
  P._base = function () { return this.D.rules.attackValue(this.hero); };
  P._text = function (x, y, s, col) { this.texts.push({ x: x, y: y, s: s, t0: this.D.time, col: col }); };
  /* 경험치 */
  P._drop = function (u) { if (this.gems.length > 400) this.gems.shift(); this.gems.push({ x: u.x, y: u.y, v: u.boss ? CFG.BOSS.gem : Math.max(1, Math.round(u.t.hp / 60)) }); };
  P._gain = function (v) {
    this.exp += v;
    while (this.exp >= this.expNeed) { this.exp -= this.expNeed; this.lv++; this.expNeed = GROW.need(this.lv); this.pend++; var h = this.hero; h.level = this.lv; h.maxHp += GROW.hpLv; h.hp = Math.min(h.maxHp, h.hp + GROW.hpLv); }
  };
  /* 레벨업 카드 3장 (전직 레벨이면 전직 3갈래) */
  P._roll = function () {
    var self = this, rng = this.D.rng, out = [], pool = [], used = this.order.length, hasTrap = ['mouse', 'booby', 'explo'].some(function (k) { return self.sk[k]; });
    if (this.lv >= GROW.classLv && !this.cls) return Object.keys(CLS).map(function (k) { return { cls: k }; });
    Object.keys(SK).forEach(function (k) { var s = SK[k], l = self._lvOf(k); if (l >= 5) return;
      if (!l && s.slot && used >= CFG.SLOTS) return; if (!l && s.need === 'trap' && !hasTrap) return;
      var clsTree = self.cls === 'venom' ? 'throw' : self.cls === 'trapper' ? 'trap' : self.cls === 'shadow' ? 'shadow' : null;
      pool.push({ k: k, w: (s.tree === clsTree ? 2 : 1) * (l ? 1.3 : 1) }); });
    while (out.length < 3 && pool.length) { var tw = pool.reduce(function (a, b) { return a + b.w; }, 0), r = rng.next() * tw, i = 0; while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; } out.push({ k: pool[i].k }); pool.splice(i, 1); }
    if (!out.length) out.push({ heal: 1 });
    return out;
  };
  P._pick = function (c) {
    var h = this.hero;
    if (c.cls) { this.cls = c.cls; this._text(h.x, h.y - h.headY - 22, CLS[c.cls].name, CLS[c.cls].col); }
    else if (c.heal) h.hp = Math.min(h.maxHp, h.hp + GROW.heal);
    else { if (!this.sk[c.k] && SK[c.k].slot) this.order.push(c.k); this.sk[c.k] = this._lvOf(c.k) + 1; if (this.tm[c.k] == null) this.tm[c.k] = 0.6; }
    if (this.D._raceSnd) this.D._raceSnd('click');
    if (!c.cls) this.pend = Math.max(0, this.pend - 1);
    this.cards = null; this.stick = null; this.keys = {};
  };
  P._drawCards = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, C = this.cards, self = this, cls = !!C[0].cls, al = Math.min(1, this.cardT / 0.25), cw = Math.min(W - 32, 340), ch = cls ? 122 : 100, gap = 12, x = Math.round((W - cw) / 2), tot = C.length * ch + (C.length - 1) * gap, y0 = Math.round((H - tot) / 2) + 14, IC = D.data.fx.icon, icons = D.assets.get('acticons');
    ctx.fillStyle = 'rgba(4,6,10,' + (0.72 * al).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = al; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = cls ? '#ffd36e' : '#9cc0ff'; ctx.fillText(cls ? '전직 — 길을 고르세요' : '레벨 ' + this.lv + ' — 하나를 고르세요', W / 2, y0 - 30);
    C.forEach(function (c, i) { var b = c.box = { x: x, y: y0 + i * (ch + gap), w: cw, h: ch }, s = c.k && SK[c.k], l = c.k ? self._lvOf(c.k) : 0, ev = c.k && self._evo(c.k);
      D._plate(b.x, b.y, b.w, b.h, 7, false);
      var ic = c.cls ? CLS[c.cls].icon : c.heal ? 2 : s.icon, fi = ic * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, b.x + 16, b.y + 18, 40, 44);
      ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = c.cls ? CLS[c.cls].col : '#ffe9b0'; ctx.fillText(c.cls ? CLS[c.cls].name : c.heal ? '응급처치' : self._name(c.k), b.x + 68, b.y + 24);
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = l ? '#9cc0ff' : '#9fe08a'; if (c.k) ctx.fillText(l ? 'Lv ' + l + ' → ' + (l + 1) : '새 스킬', b.x + b.w - 16, b.y + 24);
      ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#c9d1e3';
      var lines = c.cls ? CLS[c.cls].lines : D._wrap(c.heal ? '체력을 ' + GROW.heal + ' 회복합니다' : s.desc(l + 1, ev), b.w - 84);
      lines.slice(0, 4).forEach(function (ln, n) { ctx.fillText(ln, b.x + 68, b.y + 48 + n * 17, b.w - 80); }); });
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  P._cardTap = function (x, y) { if (this.cardT < 0.4) return; for (var i = 0; i < this.cards.length; i++) if (inBox(this.cards[i].box, x, y)) { this._pick(this.cards[i]); return; } };

  /* 피해: 둘레 폭발 · 단검 한 발 */
  P._blast = function (x, y, r, mul, arm) { var F = this.foes, b = this._base() * mul, i; if (arm != null) this._fx(x, y, arm); for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state !== 'dead' && Math.hypot(u.x - x, u.y - y) <= r) this._hitFoe(u, b, -1); } };
  P._dagger = function (tgt, mul, ox, oy, vx, vy) { var h = this.hero, s = { x: h.x + (ox || 0), y: h.y - h.headY * 0.6 + (oy || 0), vx: vx || 0, vy: vy || 0, tgt: tgt || null, dmg: this._base() * mul, arm: h.act.arm, t0: this.D.time, life: CFG.ATK.life, dg: true };
    if (tgt) { var dx = tgt.x - s.x, dy = tgt.y - s.y, d = Math.hypot(dx, dy) || 1; s.vx = dx / d * CFG.ATK.shot; s.vy = dy / d * CFG.ATK.shot; } this.shots.push(s); };
  /* 단검에 맞았을 때 붙는 효과: 독 단도 · 출혈(베놈 쓰로워) · 암살 */
  P._onDagger = function (u) {
    var T = this.D.time, l;
    if ((l = this._lvOf('poison'))) { u.vulnUntil = T + SK.poison.dur; u.vuln = Math.max(u.vuln || 0, SK.poison.v(l)); }
    if (this.cls === 'venom') { u.bleedUntil = T + 3; u.bleed = this._base() * 0.25; }
    if ((l = this._lvOf('assassin')) && this.D.rng.next() < SK.assassin.p(l) * (this._evo('assassin') ? 1.5 : 1)) { if (u.boss) return 5; this._text(u.x, u.y - u.headY - 4, this._evo('assassin') ? '처형' : '암살', '#c9a8ff'); return 1e6; }
    return 1;
  };
  P._nearest = function (n, range, skip) { var h = this.hero, L = [], F = this.foes, i; for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead' || u === skip) continue; var d = Math.hypot(u.x - h.x, u.y - h.y); if (d <= range) L.push([d, u]); } L.sort(function (a, b) { return a[0] - b[0]; }); return L.slice(0, n).map(function (e) { return e[1]; }); };
  P._blink = function (dx, dy) {
    var D = this.D, h = this.hero, l = this._lvOf('blink'); if (!l || this.tm.blink > 0 || this.over || this.cards) return;
    var d = Math.hypot(dx, dy); if (d < 0.01) { dx = this.lastDir[0]; dy = this.lastDir[1]; d = 1; }
    this._fx(h.x, h.y - 8, 3); h.x += dx / d * SK.blink.dist(l); h.y += dy / d * SK.blink.dist(l); this._fx(h.x, h.y - 8, 3);
    this.invUntil = Math.max(this.invUntil, D.time + 0.4); this.tm.blink = SK.blink.cd(l); D._faceVec(h, dx, dy, true); D._play(5012, 0.5);
  };
  /* 매 프레임: 스킬 타이머 · 덫 · 독 구름 · 경험치 (update 가 부른다. G = 적 격자, near = 사거리 안 가장 가까운 적) */
  P._growStep = function (dt, G, near) {
    var self = this, D = this.D, T = D.time, h = this.hero, F = this.foes, tm = this.tm, l, k, i, ev;
    var due = function (key) { if (!self.sk[key]) return false; tm[key] = (tm[key] == null ? 0.6 : tm[key]) - dt; return tm[key] <= 0; };
    if (tm.blink > 0) tm.blink -= dt;
    // 시차를 두고 나가는 것들 (다팅 피버의 둘째·셋째 파, 연폭 함정)
    this.queue = this.queue.filter(function (qu) { if (T < qu.at) return true; qu.fn(); return false; });
    if (due('scatter')) { l = this.sk.scatter; ev = this._evo('scatter'); var n = SK.scatter.n(l) + (ev ? 2 : 0), tg = this._nearest(n, CFG.ATK.range, null);
      if (tg.length) { tm.scatter = SK.scatter.cd(l); var twice = ev && tg.length <= n / 2 ? 2 : 1; for (k = 0; k < twice; k++) tg.forEach(function (u, j) { self._dagger(u, SK.scatter.dmg(l), (k ? 5 : 0), (k ? -5 : 0)); }); } else tm.scatter = 0.3; }
    if (due('fever')) { l = this.sk.fever; ev = this._evo('fever'); if (near || this._nearest(1, CFG.ATK.range * 1.3, null).length) { tm.fever = SK.fever.cd(l);
        var cnt = SK.fever.n(l), waves = SK.fever.w(l) + (ev ? 1 : 0), mul = SK.fever.dmg(l) * (ev ? 1.3 : 1);
        for (k = 0; k < waves; k++) (function (wi) { self.queue.push({ at: T + wi * 0.22, fn: function () { for (var a = 0; a < cnt; a++) { var an = (a + wi * 0.5) / cnt * 6.2832; self._dagger(null, mul, 0, 0, Math.cos(an) * CFG.ATK.shot * 0.8, Math.sin(an) * CFG.ATK.shot * 0.8); } D._play(self.hero.act.snd, 0.4); } }); })(k); } else tm.fever = 0.3; }
    // 덫 놓기
    ['mouse', 'booby', 'explo'].forEach(function (key) { if (!due(key)) return; var s = SK[key], lv = self.sk[key]; tm[key] = s.cd(lv);
      var mine = self.traps.filter(function (t) { return t.k === key; }); if (mine.length >= s.max) self.traps.splice(self.traps.indexOf(mine[0]), 1);
      self.traps.push({ k: key, x: h.x, y: h.y, t0: T }); });
    // 덫 밟기
    var TR = GROW.trapR * (this.cls === 'trapper' ? GROW.trapRx : 1);
    this.traps = this.traps.filter(function (t) { if (T - t.t0 < 0.5) return true;
      var cx = Math.floor(t.x / 32), cy = Math.floor(t.y / 32), a, b, j, hit = null;
      for (a = cx - 1; a <= cx + 1 && !hit; a++) for (b = cy - 1; b <= cy + 1 && !hit; b++) { var Lc = G[a + ',' + b]; if (Lc) for (j = 0; j < Lc.length; j++) if (Lc[j].state !== 'dead' && Math.hypot(Lc[j].x - t.x, Lc[j].y - t.y) <= TR) { hit = Lc[j]; break; } }
      if (!hit) return true; self._spring(t, hit); return false; });
    if (due('simul')) { l = this.sk.simul; if (this.traps.length) { tm.simul = SK.simul.cd(l); var reps = this.cls === 'trapper' ? 2 : 1; this.traps.forEach(function (t, j) { for (k = 0; k < reps; k++) (function (kk) { self.queue.push({ at: T + j * 0.05 + kk * 0.3, fn: function () { self._blast(t.x, t.y, SK.simul.r, SK.simul.dmg(l), SK.simul.boom); } }); })(k); }); this.traps = []; D._play(5064, 0.6); } else tm.simul = 0.5; }
    if (due('gas')) { l = this.sk.gas; ev = this._evo('gas'); var gt = this._nearest(1, CFG.ATK.range * 1.2, null)[0]; if (gt) { tm.gas = SK.gas.cd(l); this.zones.push({ x: gt.x, y: gt.y, r: SK.gas.r * (ev ? 1.5 : 1), until: T + (ev ? 6 : SK.gas.dur), next: T, mul: SK.gas.dmg(l), v: ev ? 0.16 : SK.gas.v, t0: T }); D._play(5092, 0.5); } else tm.gas = 0.4; }
    this.zones = this.zones.filter(function (z) { if (T >= z.until) return false; if (T >= z.next) { z.next = T + 0.5; var b = self._base() * z.mul * 0.5; for (var j = 0; j < F.length; j++) { var u = F[j]; if (u.state !== 'dead' && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) { u.vulnUntil = T + 1; u.vuln = Math.max(u.vuln || 0, z.v); self._hitFoe(u, b, -1); } } } return true; });
    if (due('surprise')) { l = this.sk.surprise; ev = this._evo('surprise'); var best = null; for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state !== 'dead' && Math.hypot(u.x - h.x, u.y - h.y) <= SK.surprise.range * (ev ? 1.4 : 1) && (!best || u.life > best.life)) best = u; }
      if (best) { tm.surprise = SK.surprise.cd(l); this._fx(best.x, best.y - best.headY * 0.5, SK.surprise.fx); this._text(best.x, best.y - best.headY - 16, this._name('surprise'), '#c9a8ff'); D._play(h.act.snd, 0.6);
        if (ev) for (i = 0; i < F.length; i++) if (F[i].state !== 'dead' && Math.hypot(F[i].x - best.x, F[i].y - best.y) <= 55) F[i].stunUntil = T + 2;
        this._hitFoe(best, this._base() * SK.surprise.dmg(l), -1); } else tm.surprise = 0.4; }
    if (due('shadow')) { l = this.sk.shadow; tm.shadow = SK.shadow.cd(l); this.stealthUntil = T + SK.shadow.dur(l) + (this._evo('shadow') ? 1.5 : 0); this._text(h.x, h.y - h.headY - 22, this._name('shadow'), '#c9a8ff'); D._play(5011, 0.5); }
    // 치명타 확률: 기본 + 그림자 숨기(숨은 동안) + 코인시던스 드로잉
    this.crit = Math.min(GROW.critMax, CFG.CRIT.p + (T < this.stealthUntil ? SK.shadow.crit(this.sk.shadow || 1) : 0) + (this.sk.double && this._evo('double') ? 0.05 : 0));
    // 경험치 보석: 범위 안이면 끌려온다
    var pr = GROW.pickup * ((l = this._lvOf('pick')) ? SK.pick.v(l) : 1);
    this.gems = this.gems.filter(function (g) { var dx = h.x - g.x, dy = h.y - 12 - g.y, d = Math.hypot(dx, dy) || 1; if (g.pull || d <= pr) { g.pull = true; var st = GROW.gemSpeed * dt; if (d <= st + 8) { self._gain(g.v); return false; } g.x += dx / d * st; g.y += dy / d * st; } return true; });
    if (this.pend > 0 && !this.cards) { this.cards = this._roll(); this.cardT = 0; this.stick = null; this.keys = {}; }
  };
  /* 덫이 터진다 */
  P._spring = function (t, u) {
    var self = this, D = this.D, T = D.time, s = SK[t.k], l = this.sk[t.k] || 1, ev = this._evo(t.k), F = this.foes, i;
    if (t.k === 'mouse') { this._fx(t.x, t.y - 6, s.boom); u.slowUntil = T + s.slowSec; this._hitFoe(u, this._base() * s.dmg(l), -1); }
    else if (t.k === 'booby') { var L = ev ? F.filter(function (o) { return o.state !== 'dead' && Math.hypot(o.x - t.x, o.y - t.y) <= 55; }) : [u]; this._fx(t.x, t.y - 6, s.boom);
      L.forEach(function (o) { o.rootUntil = T + s.root(l); self._hitFoe(o, self._base() * s.dmg(l) * (ev ? 2 : 1), -1); }); }
    else if (t.k === 'explo') { var n = ev ? 3 : 1; for (i = 0; i < n; i++) (function (k) { self.queue.push({ at: T + k * 0.28, fn: function () { self._blast(t.x, t.y, s.r, s.dmg(l), s.boom); D._play(5064, 0.5); } }); })(i); }
  };
  /* 전장 층(유닛 아래): 독 구름 · 덫 · 경험치 보석 */
  P._drawGround = function () {
    var D = this.D, ctx = D.ctx, T = D.time, i;
    for (i = 0; i < this.zones.length; i++) { var z = this.zones[i], k = Math.min(1, (T - z.t0) / 0.3, (z.until - T) / 0.5), g = ctx.createRadialGradient(z.x, z.y, z.r * 0.2, z.x, z.y, z.r);
      g.addColorStop(0, 'rgba(120,200,70,' + (0.42 * k).toFixed(3) + ')'); g.addColorStop(0.7, 'rgba(90,170,60,' + (0.3 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(70,140,50,0)');
      ctx.save(); ctx.translate(z.x, z.y); ctx.scale(1, 0.62); ctx.translate(-z.x, -z.y); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 + 0.04 * Math.sin(T * 5)), 0, 6.3); ctx.fill(); ctx.restore();
      var gd = D.data.fx.arms[SK.gas.arm], gf = gd && (gd.hit.length ? gd.hit : gd.fly); if (gf && gf.length) { ctx.globalAlpha = 0.55 * k; D._fxFrame(gf[Math.floor(T * 10) % gf.length], z.x, z.y, true); ctx.globalAlpha = 1; } }
    for (i = 0; i < this.traps.length; i++) { var t = this.traps[i], d = D.data.fx.arms[SK[t.k].arm], f = d && (d.fly.length ? d.fly : d.hit); ctx.globalAlpha = Math.min(0.9, (T - t.t0) / 0.3);
      if (f && f.length) D._fxFrame(f[0], t.x, t.y, false); else { ctx.fillStyle = '#c9a15a'; ctx.fillRect(t.x - 5, t.y - 3, 10, 6); } }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.gems.length; i++) { var gm = this.gems[i], sz = gm.v >= 3 ? 5 : 3.5, by = gm.y - 4 + Math.sin(T * 4 + gm.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(gm.x, gm.y + 1, sz, sz * 0.4, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = gm.v >= 3 ? '#7fe0ff' : '#5fb0ff'; ctx.beginPath(); ctx.moveTo(gm.x, by - sz - 1); ctx.lineTo(gm.x + sz, by); ctx.lineTo(gm.x, by + sz + 1); ctx.lineTo(gm.x - sz, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(gm.x - 1, by - sz + 1, 1.5, 2); }
    if (T < this.stealthUntil) { var h = this.hero; ctx.fillStyle = 'rgba(120,80,200,' + (0.35 + 0.15 * Math.sin(T * 8)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 22, 9, 0, 0, 6.3); ctx.fill(); }
  };

  MWE.SurvivalGame = SurvivalGame;
})(typeof window !== 'undefined' ? window : globalThis);
