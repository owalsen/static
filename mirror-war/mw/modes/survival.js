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
    ATK: { sec: q('atk', 0.8), lv: q('atklv', 0.016), min: 0.4, range: q('range', 170), shot: q('shot', 840), dmg: q('dmg', 1.32), life: 0.45, anim: 2.4 },   // 단도 던지기: 간격(초)·사거리(화면 폭 절반 안쪽)·단도 속도·피해 배수(원본 공격값 19 → 25: 첫 무리 해골전사(체력 52)·좀비(73) 모두 세 방 — 2026-11-19 사용자 요청, 전에는 2.8 = 53 으로 해골전사 한 방). 도둑의 모든 스킬 피해가 이 값에 곱해진다
    FOE: { dmg: q('edmg', 0.6), hp: q('ehp', 1), reach: 24, rs: 0.07, rangeMax: 150, from3: 2, range3: q('erange', 210), shot: q('eshot', 190), sep: 20, body: 20, far: 1000 },   // 적: 피해·체력 배수, 근접 닿는 거리, 사거리 배율(디펜스 RANGE_SCALE)·원거리 상한, from3 단계(0부터)부터 원거리 적은 모두 사거리 range3 — 도둑 단도(170) 밖에서 멈춰 쏜다 (2026-11-19 사용자 "적 투사체가 없어서 쉬워, 3단계부터 투사체 날아오게" — 전에는 150 이라 쏘기 전에 단도에 쓰러졌다), 적 발사체 속도(170 → 190), 서로 밀어내는 거리, 이보다 멀어지면 화면 둘레로 다시 보낸다
    CRIT: { p: q('crit', 0.1), mul: 2, p2: q('crit2', 0.15), mul2: 4 },   // 치명타(붉은보석 도둑에서): 확률·피해 배수. 더블 크리티컬 = 치명타가 났을 때 p2 확률로, 피해 mul2 배. 숫자 색: 보통 흰색 · 치명타 노랑 · 더블 붉은색 (NUM)
    BOOM: { touch: 30, radius: 46 },   // 좀비 자폭: 닿으면 터진다
    DEF: { lvk: q('deflv', 0.25), min: q('dmin', 0.3) },   // 도둑이 받는 피해 (294·295번): 방어 계산에 넣는 레벨 = 도둑 레벨 × lvk (원작 방어 = def + defGrow×레벨/4 → 레벨 40 이면 25 라 후반 적이 전부 1 을 쳤다. 0.25 면 5 + 레벨/8), min = 방어가 아무리 높아도 적 공격값의 이 비율은 들어간다
    HURT: { inv: 0.25, flash: 0.35 },  // 도둑이 맞은 뒤 무적 시간(여럿이 한 틱에 겹쳐 치는 것 방지)·화면 가장자리 붉은 빛
    /* 웨이브 10단계 (4단계, 2026-11-19 사용자 안: 처음엔 쉬운 적, 10단계로 갈수록 모든 유닛). 1분에 한 단계.
       add = 그 단계에 새로 나오는 유닛(세 진영 모두 — 기본 공격이 있는 유닛만). 뽑힐 비중: 새로 나온 단계 3 · 한 단계 전 2 · 두 단계 전 1 · 그보다 옛것 0.4 — 10단계는 전부 같은 비중(모든 유닛이 다 나온다).
       rate = 초당 마릿수, cap = 살아 있는 적 상한, hp = 체력 배수. boss = 그 단계가 시작될 때 나오는 우두머리 [유닛, 체력 배수] */
    WAVE: { sec: q('wavesec', 60), margin: 50, list: [
      { add: [28, 31], rate: 1.1, cap: 60, hp: 1, dmg: 0.7 },                         // 1 해골전사 좀비 (2026-11-19 사용자 "초반이 너무 어려워": rate 1.4·cap 80 → 1.1·60, 적 피해 ×0.7 — 체력은 그대로라 첫 무리는 여전히 세 방)
      { add: [43, 46], rate: 1.5, cap: 95, hp: 1, dmg: 0.8, mini: [43, 14] },   // (1.8·110 → 1.5·95, 피해 ×0.8, 중간 우두머리 늑대 체력 25 → 14배)
                                        // 2 늑대 박쥐
      { add: [32, 7, 29, 52], rate: 2.8, cap: 160, hp: 1.35, mini: [29, 20] },   // (사용자 "3,4,5 를 어렵게": 2.5·1.2 → 2.8·1.35)
                                  // 3 유령 격투가 해골기사 궁수(4단계에서 앞당김 — 투사체) (2026-11-19 사용자 "3·4단계 넘어갈 때 더 어렵게": rate 2.3·hp 1 → 2.5·1.2. 2.7·1.3 은 봇 셋 다 쓰러짐)
      { add: [68, 0, 52, 4], rate: 3.4, cap: 190, hp: 1.6, boss: [30, 18], mini: [0, 20] },   // (3.0·1.4 → 3.4·1.6)
               // 4 개미 전사(해방) 전사(흑) 궁수 · 우두머리 듀라한 (2.8·1.1 → 3.0·1.4. 3.3·1.6 은 너무 어려움)
      { add: [36, 35, 11, 6, 33], rate: 3.8, cap: 215, hp: 1.8, mini: [36, 16] },   // (3.3·1.5 → 3.8·1.8, 중간 우두머리는 절대 체력을 그대로)
                          // 5 늑대인간 흡혈귀 정령사 창검사 리치
      { add: [39, 15, 8, 53, 49, 1], rate: 3.8, cap: 230, hp: 2, mini: [39, 20] },                  // 6 데몬 마법전사 무도가 흑전사 흑마술사 기사
      { add: [69, 25, 12, 10, 56, 57, 40], rate: 4.3, cap: 260, hp: 2.6, boss: [47, 16], mini: [57, 18] },   // 7 거미 악령술사 마법사 의적 대도 마기사 데빌 · 우두머리 드래곤
      { add: [30, 44, 45, 2, 16, 50, 26, 5, 66], rate: 4.8, cap: 290, hp: 3.2, mini: [44, 16] },      // 8 듀라한 켈베로스 펜릴 창기사 마법기사 요마술사 강신술사 명궁 구렁이
      { add: [70, 54, 3, 22, 9, 13, 41, 27, 51, 19], rate: 5.4, cap: 320, hp: 4, mini: [54, 14] },  // 9 전갈 흑기사 성기사 엔젤 나이트 도사 장로 사탄 사술사 대마술사 주교
      { add: [47, 67, 21, 59, 61, 62, 20, 58, 63, 64], rate: 6.2, cap: 340, hp: 5, boss: [34, 32], mini: [47, 10] } ] },   /* 5단계부터 적 체력 (2026-11-19 사용자 "6단계부터 애들이 너무 빠르게 죽음"): 1.2·1.3·1.4·1.5·1.6·1.8 → 1.5·2·2.6·3.2·4·5 (1.8·2.6·3.4·4.4·5.5·7 은 봇 셋 다 6~8단계에서 쓰러짐). 우두머리·중간 우두머리의 배수는 웨이브 배수와 곱해지므로 그만큼 나눠 절대 체력을 거의 그대로(중간 우두머리는 조금 위로) */   // 10 드래곤 신수사 환술사 인챈터 마녀 소환사 … · 우두머리 다크로드
    /* 돌진 (2026-11-19 사용자 지시 — 뱀서류 분석 글의 "무리 돌진"): 3단계부터 한쪽에서 떼가 줄지어 나타나 곧게 달려 지나간다(도둑을 쫓지 않는다).
       먼저 warn 초 동안 지나갈 길(폭 band)을 붉게 보이고 화면 가장자리에 화살표 → 그 길 밖으로 비키면 된다. 닿으면 한 번에 피해 × dmg, 같은 놈은 0.8초 뒤에야 다시 친다.
       every·n = [3단계 값, 10단계 값] (단계에 따라 고르게 바뀐다), unit = [이 단계부터, 유닛] */
    RUSH: { from: 2, every: [36, 22], n: [12, 30], speed: 150, band: 200, warn: 1.7, dist: 580, dmg: 1.3, unit: [[0, 43], [5, 36], [8, 44]] },
    /* 포위 (296번, 뱀서류 분석 글의 "포위" — 사용자 승인 순서 2): from 단계(0부터)부터 every 초마다 도둑 둘레 타원(가로 rx·세로 ry — 세로 화면 안에 다 보이게. 처음엔 반경 310 원이었는데 예고 고리가 화면 밖이라 안 보였다)에 n 기가 한꺼번에 나타나 좁혀 온다.
       warn 초 동안 그 자리에 붉은 고리로 예고. 걸음은 × speed(조여 오는 것이 보이게). 돌진처럼 경험치·아이템은 없다. every·n = [시작 단계 값, 10단계 값], unit = [이 단계부터, 유닛] */
    SIEGE: { from: q('siegefrom', 4), every: [q('siegeevery', 48), 32], n: [20, 40], rx: 180, ry: 260, warn: 1.8, speed: 0.8, unit: [[0, 28], [5, 29], [8, 54]] },
    /* 치유형·소환형 적 (298번, 사용자 승인 순서 4): 기본 공격이 없어 웨이브 표에 못 들어가던 원작 유닛. 도둑에게서 keep 만큼 떨어져 서서(단도 사거리 170 밖) tick 초마다
       heal = 둘레 r 안 다친 적을 최대 체력의 pct 만큼 회복(우두머리는 1/4) / summon = unit 을 n 기 불러낸다(불러낸 적은 경험치 없음). from 단계부터 every 초마다 하나, 동시에 max 기까지. hp = 체력 배수. 발밑 고리(녹색·보라)로 구별 */
    SUP: { heal: { from: q('supfrom', 5), ids: [[0, 17], [7, 18]], every: q('supevery', 20), max: 3, keep: 190, r: 120, tick: 2.5, pct: 0.12, hp: 2.5, col: '127,227,106' },
           summon: { from: q('supfrom', 7), id: 58, every: q('supevery', 28), max: 2, keep: 230, tick: 6, n: 2, unit: 28, hp: 3, col: '190,120,255' } },
    /* 중간 우두머리 (2026-11-19 사용자 "중간보스 더 자주 등장해서 압박"): 2단계부터 단계마다 at 초에 mini: [유닛, 체력 배수] 하나. 우두머리처럼 멈춤·묶임·감속이 안 걸리고 피해 ×BOSS.dmg, 보상은 작다(경험치 gem, 회복 heal, 회복 아이템 확정 없음) */
    MINI: { at: q('miniat', 30), scale: 1.25, gem: 4, heal: 0 },   // 처음엔 체력 10~16배·경험치 12·회복 10 → 봇이 쉽게 잡아 경험치 보너스가 됐다(셋 다 생존, 3분에 레벨 17) → 체력 20~28배, 경험치 4, 회복 없음
    /* 섀도우 인필트레이터의 근접 검술 (2026-11-19 사용자 "섀도우 스킬이 차별점이 없어 — 근접 위주로, 전직 뒤 스킬셋을 처음부터 다시", 모습은 마법전사): armor = 받는 피해 배수, killHeal = 베어 쓰러뜨릴 때 체력, healCap = 처치 회복의 초당 상한(최대 체력 비율) — 2026-11-19 사용자 "어쌔신이 너무 강해서 후반에는 체력도 안 닳고 스킬도 너무 자주 씀": armor 0.8 → 0.9, killHeal 0.5 → 0.15, 상한 새로, arc = 베기 반각(라디안, 1.2 ≈ 70° — 처음 1.75 는 봇이 5분에 레벨 29, 너무 셌다), comboMax = 연속 베기가 더 치는 적 수(가까운 순), after = 잔상이 다시 베기까지(초), arcLife = 칼자국 보이는 시간 */
    BLADE: { armor: 0.9, killHeal: 0.15, healCap: 0.03, arc: 1.2, comboMax: 3, after: 0.6, arcLife: 0.24 },
    BOSS: { scale: 1.5, dmg: 1.6, speed: 1.15, gem: 30, heal: 30 },   // 우두머리: 그림 배율, 피해·속도 배수, 떨어뜨리는 경험치, 쓰러뜨리면 도둑 체력 회복
    TS: q('ts', 1)               // 시간 배속 (시험·측정용: ?ts=4)
  };
  /* 숫자 모양 (2026-11-19 붉은보석 도둑 영상을 보고 맞춤): 굵은 기울임 숫자에 오른쪽 아래로 떨어지는 검은 그림자. 보통 = 흰색, 치명타 = 노랑, 더블 크리티컬 = 붉은색 + "Double Critical!!" 글자 */
  var NUM = { n: { size: 14, top: '#ffffff', mid: '#ffffff', bot: '#e4e6ee', life: 0.75, rise: 10 },
    c: { size: 17, top: '#fff66a', mid: '#ffe600', bot: '#ffc400', life: 0.9, rise: 12 },
    d: { size: 21, top: '#ff5a48', mid: '#ff2616', bot: '#d00000', life: 1.15, rise: 14, label: 'Double Critical!!' } };
  var GW = 448, GH = 192;        // 바닥 조각 크기 (defense.js 의 GW·GH)
  function inBox(b, x, y) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  /* 그림의 한 색 범위만 다른 색으로: 색상(hue)이 h0~h1 도이고 채도가 있는 픽셀만 shift 도 돌린다 (밝기·채도는 그대로). 결과는 캔버스 — drawImage 에 그대로 쓴다 */
  function recolor(img, h0, h1, shift) {
    var c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; var x = c.getContext('2d'); x.drawImage(img, 0, 0);
    var id = x.getImageData(0, 0, c.width, c.height), d = id.data, i;
    for (i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; var r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn; if (!dl || dl / mx < 0.2) continue;
      var hh = mx === r ? ((g - b) / dl + 6) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; hh *= 60; if (hh < h0 || hh > h1) continue;
      hh = ((hh + shift) % 360 + 360) % 360 / 60; var k = function (n) { var t = (n + hh) % 6; return mx - dl * Math.max(0, Math.min(1, Math.min(t, 4 - t))); };   // HSV → RGB (같은 명도·채도)
      d[i] = Math.round(k(5) * 255); d[i + 1] = Math.round(k(3) * 255); d[i + 2] = Math.round(k(1) * 255); }
    x.putImageData(id, 0, 0); return c;
  }
  function mmss(t) { t = Math.max(0, Math.ceil(t)); return (t < 600 ? '0' : '') + Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); }

  function SurvivalGame(D) {
    this.D = D; this.keys = {}; this.stick = null; this.menu = false; this.menuT = 0; this.done = false;
    var A = D.assets, ids = [CFG.HERO];
    this.fxNeed = {};
    this._need(ids); this._need([56, 15]);   // 15 = 마법전사 (섀도우 인필트레이터로 전직하면 이 모습)
    this._need(CFG.WAVE.list[0].add);   // 56 = 대도 (전직하면 이 모습)
    this._need(CFG.WAVE.list[1].add);   // 도둑과 1·2단계 유닛만 먼저 받는다 — 나머지는 한 단계 앞서 받는다 (_need)
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
    this.foes = []; this.shots = []; this.effects = []; this.texts = []; this.nums = []; this.bursts = []; this.feverUntil = 0; this.feverT0 = 0; this.ringT = -9; this.aimUntil = 0; this.crit = CFG.CRIT.p; this.spawnAcc = 0; this.wave = 0; this.waveOn = false; this.bossWait = null; this.miniDone = -1; this.rushIn = null; this.rushWarn = null; this.siegeIn = null; this.siegeWarn = null; this.supIn = {}; this.banner = null; this.stat = { dealt: 0, maxHit: 0, taken: 0, crit: 0, dbl: 0, boss: 0 }; this.over = null; this.overT = 0; this.dieSndT = -9;
    this._growReset();
    var n0 = q('n', 0); for (var i = 0; i < n0; i++) this._spawn();   // ?n=250: 시작하자마자 그만큼 (성능 시험)
  };

  /* ───────── 매 프레임 (D._frame 이 부른다) ───────── */
  P.frame = function (dt) {
    var D = this.D;
    if (D.time - (D._groundAt || 0) > 0.5 && D.terrain) D._makeGround();   // 아이폰이 보조 캔버스를 비우는 문제의 복구 (defense.js _frame 과 같은 이유)
    for (var k = 0; k < CFG.TS; k++) {
      if (!this.menu && !D.paused && this.ready()) { if (this.cards) this.cardT += dt; else if (this.info) this.infoT += dt; else if (this.over) { this.overT += dt; if (this.hero.state === 'dead') this.hero.deadT += dt; } else this.update(dt); }
      D.time += dt; }                                        // D._faceVec·_drawUnit 이 D.time 을 본다
    if (this.menu) this.menuT += dt;
    if (this.press && Date.now() - this.press.t0 >= 350 && !this.cards && !this.over && !this.menu) { var ik = this.press.key === 'ult' && !this.cls ? null : this.press.key; if (ik) { this.info = { key: ik }; this.infoT = 0; } this.press = null; this.stick = null; this.keys = {}; }   // 스킬 칸을 꾹 누르면 설명 (게임은 멈춘다)
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
  P._spawn = function (bossId, bossHp, pos, plain) {   // pos = 나타날 자리(없으면 화면 둘레), plain = 유닛을 지정하되 우두머리는 아님(포위·치유형·소환형·불러낸 적)
    var D = this.D, W = CFG.WAVE.list[this.wave], id = bossId;
    if (id == null) { var pool = this._pool(), tw = 0, i; if (!pool.length) return null; for (i = 0; i < pool.length; i++) tw += pool[i][1]; var r = D.rng.next() * tw; for (i = 0; i < pool.length - 1 && r >= pool[i][1]; i++) r -= pool[i][1]; id = pool[i][0]; }
    var p = pos || this._edgePoint(), u = this._unit(id, 1, p[0], p[1]), t = u.t;
    u.life = Math.round(u.maxHp * CFG.FOE.hp * W.hp * (bossHp || 1)); u.life0 = u.life;   // 적의 체력은 life 로 센다 — u.hp 는 가득 둔다(_drawUnit 이 닳은 유닛마다 체력 바를 그려 수백 기면 화면을 덮는다). 우두머리만 체력 바를 보인다
    if (bossId != null && !plain) { u.boss = true; u.maxHp = u.life; u.hp = u.life; u.speedPx *= CFG.BOSS.speed; }
    u.boom = t.acts.filter(function (a) { return a && a.suicide && a.dmg; })[0] || null;   // 자폭 유닛(좀비)
    if (!u.act && !u.boom) u.act = t.acts.filter(function (a) { return a && a.dmg; })[0] || null;
    var rp = u.act ? u.act.range * CFG.FOE.rs : 0; u.ranged = rp > 80; u.reach = u.ranged ? (this.wave >= CFG.FOE.from3 ? CFG.FOE.range3 : Math.min(CFG.FOE.rangeMax, rp)) : CFG.FOE.reach;
    if (u.boss) u.boom = null;
    u.state = 'move'; u.cd = 0; this.foes.push(u); return u;
  };
  P._fx = function (x, y, arm) { var d = this.D.data.fx.arms[arm], f = d && (d.hit.length ? d.hit : d.fly.length ? d.fly : d.seq); if (f && f.length) this.effects.push({ x: x, y: y, f: f, t0: this.D.time, add: !d.dir }); };
  P._hitFoe = function (u, dmg, arm, big) {
    if (u.state === 'dead') return; var D = this.D; u.hitT = D.time;
    if (u.vulnUntil > D.time) dmg *= 1 + (u.vuln || 0);      // 독 단도·유독가스: 받는 피해 증가
    if (this.cls === 'shadow') { var lr = u.life / (u.maxHp * CFG.FOE.hp); if (lr <= 0.2) dmg *= 1.6; else if (lr <= 0.5) dmg *= 1.3; }   // 섀도우 인필트레이터: 마무리 일격
    var kind = 'n'; if (dmg < 1e5 && D.rng.next() < this.crit) { if (D.rng.next() < CFG.CRIT.p2) { kind = 'd'; dmg *= CFG.CRIT.mul2; } else { kind = 'c'; dmg *= CFG.CRIT.mul; } }
    if (dmg < 1e5) { if (this.nums.length > 90) this.nums.shift(); for (var qi = 0; qi < this.nums.length; qi++) if (this.nums[qi].u === u) { this.nums[qi].lift += 12; this.nums[qi].old = true; }   // 새 숫자가 뜨면 그 적의 앞선 숫자는 위로 밀려 올라가며 작아진다 (붉은보석처럼 쌓인다)
      this.nums.push({ u: u, x: u.x + (D.rng.next() - 0.5) * 8, y: u.y - u.headY - 2, lift: 0, v: Math.max(1, Math.round(dmg)), k: kind, t0: D.time }); }
    if (arm === this.hero.act.arm) this.bursts.push({ x: u.x, y: u.y - u.headY * 0.5, t0: D.time, a: D.rng.next() * 6.28, k: kind, life: (kind === 'n' ? 0.16 : 0.26) * (big ? 1.25 : 1), sc: big || 0 }); else if (arm >= 0) this._fx(u.x, u.y - u.headY * 0.5, arm);   // 단검이 맞으면 흰 별 모양 섬광
    var dd = Math.max(1, Math.round(dmg)), ST = this.stat; if (dd < 1e5) { ST.dealt += Math.min(dd, u.life); if (dd > ST.maxHit) ST.maxHit = dd; if (kind === 'c') ST.crit++; else if (kind === 'd') ST.dbl++; }
    u.life -= dd; if (u.boss) u.hp = Math.max(0, u.life); if (u.life > 0) return;
    if (u.boss) { if (u.mini) ST.mini = (ST.mini || 0) + 1; else ST.boss++; var hh = this.hero; hh.hp = Math.min(hh.maxHp, hh.hp + (u.mini ? CFG.MINI.heal : CFG.BOSS.heal)); this.banner = { s: u.t.name + ' 처치!', t0: D.time, col: '#ffd36e' }; }
    u.state = 'dead'; u.deadT = 0; u.fade = 0; this.kills++; this._drop(u);
    this.bursts.push({ x: u.x, y: u.y - 6, t0: D.time, a: D.rng.next() * 6.28, k: 'g', life: 0.45 });   // 쓰러진 자리의 노란 반짝임
    if (D.time - this.dieSndT > 0.12) { this.dieSndT = D.time; D._play(u.t.snd && u.t.snd.die, 0.35); }   // 수십 기가 한꺼번에 쓰러져도 소리는 띄엄띄엄
  };
  P._supAct = function (u) {   // 치유형: 둘레의 다친 적 회복 / 소환형: 옆에 적을 불러낸다
    var S = CFG.SUP[u.sup], D = this.D, F = this.foes, T = D.time, i; u.supT = S.tick;
    if (u.sup === 'heal') { var n = 0; F.forEach(function (o) { if (o === u || o.state === 'dead' || o.rush || o.life >= o.life0 || Math.hypot(o.x - u.x, o.y - u.y) > S.r) return; o.life = Math.min(o.life0, o.life + Math.round(o.life0 * S.pct * (o.boss ? 0.25 : 1))); if (o.boss) o.hp = o.life; o.healT = T; n++; }); if (n) u.castT = T; }
    else { if (F.length >= CFG.WAVE.list[this.wave].cap + 20) return; for (i = 0; i < S.n; i++) { var a = D.rng.next() * 6.2832, m = this._spawn(S.unit, null, [u.x + Math.cos(a) * 26, u.y + Math.sin(a) * 26], true); if (m) { m.noDrop = true; m.boom = null; } } u.castT = T; }
  };
  P._chest = function () {   // 우두머리 보물상자 (297번, 사용자 승인 순서 3): 가진 스킬 1~3개가 한 단계씩 오른다 (올릴 것이 없으면 체력 회복)
    var self = this, h = this.hero, rng = this.D.rng, C = GROW.chest, ks = Object.keys(this.sk).filter(function (k) { return SK[k] && self.sk[k] > 0 && self.sk[k] < 5; }), r = rng.next(), n = Math.min(ks.length, r < C.p[0] ? 1 : r < C.p[0] + C.p[1] ? 2 : 3), got = [];
    while (got.length < n) { var k = ks.splice(Math.floor(rng.next() * ks.length), 1)[0]; this.sk[k]++; got.push(SK[k].name + ' ' + this.sk[k]); }
    if (!got.length) { h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * C.heal)); got.push('체력 회복'); }
    this.banner = { s: '보물상자 — ' + got.join(' · '), t0: this.D.time, col: '#ffd36e' };
    Object.keys(SK).forEach(function (k2) { if (self._awk(k2) && !self.awkSeen[k2]) { self.awkSeen[k2] = 1; self.banner = { s: '각성 — ' + SK[k2].awk.name, t0: self.D.time, col: '#7fe0ff' }; } });
  };
  P._foeDmg = function (u) {   // 적 → 도둑 피해: 원작 공식 그대로, 다만 방어에 넣는 레벨만 줄이고(공격값은 도둑 레벨 그대로) 최소 피해 비율을 둔다
    var R = this.D.rules, h = this.hero, L = h.level; h.level = Math.floor(L * CFG.DEF.lvk); var d = R.damage(u, h, this.D.rng); h.level = L;
    return Math.max(d, R.attackValue(u) * CFG.DEF.min);
  };
  P._hitHero = function (dmg) {
    var D = this.D, h = this.hero; if (this.over || D.time < this.invUntil || dmg <= 0) return;
    var sl = this._lvOf('sense'); if (sl && D.rng.next() < SK.sense.v(sl)) { this._text(h.x, h.y - h.headY - 8, '회피', '#9fe08a'); this.invUntil = D.time + CFG.HURT.inv; return; }
    dmg = Math.max(1, Math.round(dmg * CFG.FOE.dmg * (CFG.WAVE.list[this.wave].dmg || 1) * (this.cls === 'shadow' ? CFG.BLADE.armor : 1))); this.stat.taken += Math.min(dmg, h.hp); h.hp -= dmg; h.hitT = D.time; this.hurtT = D.time; this.invUntil = D.time + CFG.HURT.inv;   // 웨이브 dmg = 그 단계 적 피해 배수 (1·2단계만)
    if (h.hp <= 0) { h.hp = 0; h.state = 'dead'; h.deadT = 0; h.fade = 0; this.stick = null; this.keys = {}; this.over = 'dead'; this.overT = 0; D._play(h.t.snd && h.t.snd.die, 0.8); }
  };
  P.update = function (dt) {
    var D = this.D, R = D.rules, rng = D.rng, h = this.hero, v = this._moveVec(), F = this.foes, T = D.time, self = this, i, j, u;
    this.t += dt; if (this.t >= CFG.TIME) { this.t = CFG.TIME; this.over = 'win'; this.overT = 0; this.stick = null; return; }
    if (this.cls && h.t.id !== (CLS[this.cls].unit || GROW.clsUnit) && this._has(CLS[this.cls].unit || GROW.clsUnit)) this._promote(this.cls);   // 전직했는데 아직 그 모습(대도·마법전사) 그림을 못 받았던 경우 (시험용 ?cls= 로 시작할 때)
    // 도둑: 걷기
    var moving = !!(v[0] || v[1]);
    var hs = this.speed * (T < this.stealthUntil && this._evo('shadow') ? 1.24 : 1);
    if (moving) { this.lastDir = v; h.x += v[0] * hs * dt; h.y += v[1] * hs * dt; if (h.state !== 'attack') h.state = 'move'; h.walkT += dt * Math.max(0.5, Math.hypot(v[0], v[1])) * CFG.SPEED; if (!(T < this.aimUntil)) D._faceVec(h, v[0], v[1]); }   // 단검을 던진 직후에는 던진 쪽을 본 채로 걷는다 (aimUntil)
    else if (h.state !== 'attack') h.state = 'idle';
    if (h.state === 'attack') { h.at += dt * R.tps * CFG.ATK.anim; if (h.at >= h.t.anim.atk.n) h.state = moving ? 'move' : 'idle'; }   // 던지는 동작: 걷는 중에도 (2026-11-19 사용자 지적) — 그동안 발은 걷지 않고 미끄러진다
    if (T < this.feverUntil) { var fo = Math.floor((T - this.feverT0) / 0.045) % 8, FA = h.t.anim.atk; D._faceVec(h, Math.cos(fo * 0.7854), Math.sin(fo * 0.7854), true); h.state = 'attack'; h.at = FA && FA.hit != null ? FA.hit : 4; this.aimUntil = this.feverUntil; }   // 다팅 피버: 던지는 자세로 8방향을 빠르게 돈다 (걷는 중이면 돌면서 미끄러진다)
    // 스폰
    // 웨이브: 1분마다 다음 단계. 단계가 바뀌면 알림 한 줄 + 우두머리 + 다음 단계 유닛 그림을 미리 받는다
    var WL = CFG.WAVE.list, wv = Math.min(WL.length - 1, Math.floor(this.t / CFG.WAVE.sec));
    if (wv !== this.wave || !this.waveOn) { this.wave = wv; this.waveOn = true; var WV = WL[wv]; if (WL[wv + 1]) { this._need(WL[wv + 1].add); if (WL[wv + 1].boss) this._need([WL[wv + 1].boss[0]]); }
      this.banner = { s: '웨이브 ' + (wv + 1) + (WV.boss ? ' — ' + D.types[WV.boss[0]].name + ' 등장' : ''), t0: T, col: WV.boss ? '#ff8a7a' : '#ffe9b0' };
      if (WV.boss) { this._need([WV.boss[0]]); this.bossWait = WV.boss; } if (WV.mini) this._need([WV.mini[0]]); }
    if (this.bossWait && this._has(this.bossWait[0])) { this._spawn(this.bossWait[0], this.bossWait[1]); this.bossWait = null; }
    var MW = WL[wv].mini; if (MW && this.miniDone !== wv && this.t - wv * CFG.WAVE.sec >= CFG.MINI.at && this._has(MW[0])) { this.miniDone = wv; var mu = this._spawn(MW[0], MW[1]); if (mu) { mu.mini = true; this.banner = { s: '중간 우두머리 — ' + mu.t.name, t0: T, col: '#ffb27a' }; } }   // 중간 우두머리: 단계마다 at 초에 하나
    this.spawnAcc += dt * WL[wv].rate;
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (F.length < WL[wv].cap) this._spawn(); }
    // 돌진: 예고(길과 화살표) → warn 초 뒤 떼가 나타나 달려 지나간다
    var RU = CFG.RUSH; if (wv >= RU.from) { var rk = (wv - RU.from) / Math.max(1, WL.length - 1 - RU.from);
      if (this.rushIn == null) this.rushIn = RU.every[0] * 0.5; this.rushIn -= dt;
      if (this.rushIn <= 0 && !this.rushWarn) { this.rushIn = RU.every[0] + (RU.every[1] - RU.every[0]) * rk; var rid = 43; RU.unit.forEach(function (e) { if (wv >= e[0] && self._has(e[1])) rid = e[1]; });
        if (this._has(rid)) { this.rushWarn = { a: Math.floor(rng.next() * 8) * 0.7854 + (rng.next() - 0.5) * 0.3, x: h.x, y: h.y, t0: T, at: T + RU.warn, id: rid, n: Math.round(RU.n[0] + (RU.n[1] - RU.n[0]) * rk) }; this.banner = { s: '돌진 — ' + D.types[rid].name + ' 떼', t0: T, col: '#ff8a7a' }; } }
      var RW = this.rushWarn; if (RW && T >= RW.at) { this.rushWarn = null; var ca = Math.cos(RW.a), sa2 = Math.sin(RW.a), per = Math.max(4, Math.round(RU.band / 30));
        for (i = 0; i < RW.n; i++) { var col = i % per, row = Math.floor(i / per), off = (col - (per - 1) / 2) * (RU.band / per) + (row % 2 ? 9 : -9), back = RU.dist + row * 34 + rng.next() * 10;
          u = this._unit(RW.id, 1, RW.x - ca * back - sa2 * off, RW.y - sa2 * back + ca * off); u.life = Math.round(u.maxHp * CFG.FOE.hp * WL[wv].hp); u.life0 = u.life; u.boom = null;
          u.rush = { vx: ca * RU.speed, vy: sa2 * RU.speed, until: T + (2 * RU.dist + 300 + row * 34) / RU.speed }; u.state = 'move'; u.cd = 0; D._faceVec(u, ca, sa2, true); F.push(u); } } }
    // 포위: 예고(도둑 둘레 붉은 고리) → warn 초 뒤 원으로 나타나 좁혀 온다
    var SG = CFG.SIEGE; if (wv >= SG.from) { var gk = (wv - SG.from) / Math.max(1, WL.length - 1 - SG.from);
      if (this.siegeIn == null) this.siegeIn = SG.every[0] * 0.4; this.siegeIn -= dt;
      if (this.siegeIn <= 0 && !this.siegeWarn && !this.rushWarn) { this.siegeIn = SG.every[0] + (SG.every[1] - SG.every[0]) * gk; var sid = 28; SG.unit.forEach(function (e) { if (wv >= e[0] && self._has(e[1])) sid = e[1]; });
        if (this._has(sid)) { this.siegeWarn = { t0: T, at: T + SG.warn, id: sid, n: Math.round(SG.n[0] + (SG.n[1] - SG.n[0]) * gk) }; this.banner = { s: '포위 — ' + D.types[sid].name + ' 떼', t0: T, col: '#ff8a7a' }; } }
      var SW = this.siegeWarn; if (SW && T >= SW.at) { this.siegeWarn = null; var a0 = rng.next() * 6.2832;
        for (i = 0; i < SW.n; i++) { var ga = a0 + i / SW.n * 6.2832, gr = i % 2 ? 1.06 : 0.97; u = this._spawn(SW.id, null, [h.x + Math.cos(ga) * SG.rx * gr, h.y + Math.sin(ga) * SG.ry * gr], true); if (u) { u.siege = true; u.noDrop = true; u.boom = null; u.speedPx *= SG.speed; } } } }
    // 치유형·소환형 적: 단계가 되면 every 초마다 하나씩 (동시에 max 기까지)
    ['heal', 'summon'].forEach(function (k) { var S = CFG.SUP[k]; if (wv < S.from) return; if (self.supIn[k] == null) self.supIn[k] = S.every * 0.5; self.supIn[k] -= dt; if (self.supIn[k] > 0) return; self.supIn[k] = S.every;
      var sid2 = S.id; if (S.ids) S.ids.forEach(function (e) { if (wv >= e[0]) sid2 = e[1]; });
      if (!self._has(sid2) || (S.unit != null && !self._has(S.unit))) { self._need(S.unit != null ? [sid2, S.unit] : [sid2]); self.supIn[k] = 2; return; }   // 그림을 아직 못 받았으면 받고 2초 뒤 다시
      if (F.filter(function (x) { return x.sup === k && x.state !== 'dead'; }).length >= S.max) return;
      var su = self._spawn(sid2, S.hp, null, true); if (su) { su.sup = k; su.supT = S.tick; su.keep = S.keep; su.act = null; su.boom = null; } });
    // 적: 도둑에게 다가가 친다. 격자(칸 32px)로 가까운 적끼리만 서로 밀어낸다
    var G = {}, CS = 32, SEP = CFG.FOE.sep, key, near = null, nd = CFG.ATK.range;
    for (i = 0; i < F.length; i++) { u = F[i]; if (u.state === 'dead') continue; key = Math.floor(u.x / CS) + ',' + Math.floor(u.y / CS); (G[key] || (G[key] = [])).push(u); }
    for (i = 0; i < F.length; i++) { u = F[i];
      if (u.state === 'dead') { u.deadT += dt; var dn = u.t.anim.die ? u.t.anim.die.n / R.tps : 0; if (u.deadT > dn) u.fade = Math.min(1, (u.deadT - dn) / 0.4); continue; }
      var dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
      if (d > CFG.FOE.far && !u.rush) { var p = this._edgePoint(); u.x = p[0]; u.y = p[1]; continue; }   // 너무 멀리 떨어진 적은 화면 둘레로 다시 온다
      if (d < nd) { nd = d; near = u; }
      if (u.bleedUntil > T) { u.dotT = (u.dotT || 0) + dt; if (u.dotT >= 0.5) { u.dotT = 0; this._hitFoe(u, u.bleed * 0.5, -1); if (u.state === 'dead') continue; } }   // 출혈 (베놈 쓰로워)
      if (u.boss) { u.stunUntil = 0; u.rootUntil = 0; u.slowUntil = 0; }   // 우두머리는 멈춤·묶임·감속이 안 걸린다
      if (u.stunUntil > T || u.rootUntil > T) { u.state = 'idle'; continue; }   // 멈춤(교란)·묶임(발목 함정)
      if (u.rush) { u.x += u.rush.vx * dt * (u.slowUntil > T ? SK.mouse.slow : 1); u.y += u.rush.vy * dt * (u.slowUntil > T ? SK.mouse.slow : 1); u.state = 'move'; u.walkT += dt * 1.6;   // 돌진하는 떼: 도둑을 쫓지 않고 곧게 지나간다 (숨어 있어도 지나가다 닿으면 맞는다)
        if (d < 20 && T >= (u.rushHit || 0)) { u.rushHit = T + 0.8; this._hitHero(this._foeDmg(u) * CFG.RUSH.dmg); }
        if (T > u.rush.until) { u.state = 'dead'; u.deadT = 9; u.fade = 1; }   // 화면을 지나 멀리 가면 사라진다 (처치로 세지 않는다)
        continue; }
      if (T < this.stealthUntil) {   // 그림자 숨기: 도둑을 못 찾는다 — 숨은 자리 둘레로 몰려가 서성인다 (전에는 화면의 적이 전부 그 자리에 멈춰 서서 "적이 갑자기 다 멈추는 버그"로 보였다 — 2026-11-19 사용자 지적)
        if (u.hideK !== this.hideK) { u.hideK = this.hideK; var ha = rng.next() * 6.2832, hr = 20 + rng.next() * 50; u.hx = this.hideX + Math.cos(ha) * hr; u.hy = this.hideY + Math.sin(ha) * hr; }
        var wx = u.hx - u.x, wy = u.hy - u.y, wd = Math.hypot(wx, wy);
        if (wd > 6) { var ws = Math.min(wd, u.speedPx * 0.7 * dt * (u.slowUntil > T ? SK.mouse.slow : 1)); u.x += wx / wd * ws; u.y += wy / wd * ws; u.state = 'move'; u.walkT += dt; D._faceVec(u, wx, wy); }
        else { var wa = rng.next() * 6.2832; u.hx = this.hideX + Math.cos(wa) * (20 + rng.next() * 50); u.hy = this.hideY + Math.sin(wa) * (20 + rng.next() * 50); u.state = 'idle'; }
        continue; }
      if (u.boom) { if (d <= CFG.BOOM.touch) { this._fx(u.x, u.y - 10, u.boom.arm); D._play(u.boom.snd, 0.5); u.act = u.boom; if (d <= CFG.BOOM.radius) this._hitHero(R.attackValue(u)); u.state = 'dead'; u.deadT = 9; u.fade = 1; this.kills++; this._drop(u); continue; } }
      if (u.state === 'attack') {
        var A = u.t.anim.atk, n = A ? A.n : 6, hitAt = A && A.hit != null ? A.hit : Math.floor(n * 0.6); u.at += dt * R.tps;
        if (!u.hitDone && u.at >= hitAt) { u.hitDone = true;
          if (u.ranged) { var def = D.data.fx.arms[u.act.arm]; this.shots.push({ x: u.x, y: u.y - u.headY * 0.6, vx: dx / d * CFG.FOE.shot, vy: (dy + h.headY * 0.5 - u.headY * 0.6) / d * CFG.FOE.shot, dmg: this._foeDmg(u), arm: u.act.arm, def: def, foe: true, t0: T, life: (u.reach + 60) / CFG.FOE.shot }); }
          else if (d <= u.reach * 1.5) this._hitHero(this._foeDmg(u) * (u.boss ? CFG.BOSS.dmg : 1)); }   // 휘두르는 사이에 벗어나면 빗나간다
        if (u.at >= n) { u.state = 'idle'; u.cd = R.cooldown(u, rng); }
        continue; }
      if (u.cd > 0) u.cd -= dt;
      if (u.sup) { u.supT -= dt; if (u.supT <= 0) this._supAct(u); }
      if (u.sup && d <= u.keep) { D._faceVec(u, dx, dy); u.state = 'idle'; }   // 치유형·소환형: 단도 사거리 밖에 서 있는다
      else if (d <= u.reach * (u.boss && !u.ranged ? 1.5 : 1) && u.act) { D._faceVec(u, dx, dy); if (u.cd <= 0) { u.state = 'attack'; u.at = 0; u.hitDone = false; } else u.state = 'idle'; }
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
    if (this.cls === 'shadow') this._bladeAtk(); else if (this.atkCd <= 0 && near && !this.hide) {   /* 숨은 동안은 자동으로 던지지 않는다 */ var dl = this.sk.dagger; this.atkCd = Math.max(CFG.ATK.min, CFG.ATK.sec - CFG.ATK.lv * (this.lv - 1)) * SK.dagger.sec(dl) * (1 - this._pv('haste'));   // 던지는 간격: 처음엔 느리고(0.8초) 도둑 레벨이 오를수록 빨라진다(레벨마다 −0.016초, 0.4초까지 = 레벨 26) — 2026-11-19 사용자 요청
      var tx = near.x - h.x, ty = near.y - h.y, td = Math.hypot(tx, ty) || 1;
      D._faceVec(h, tx, ty, true); this.aimUntil = T + h.t.anim.atk.n / (R.tps * CFG.ATK.anim) + 0.05;   // 걷는 중에도 던지는 쪽으로 몸을 돌린다 (2026-11-19 사용자 지적: 등에서 단검이 나가는 것처럼 보였다)
      h.state = 'attack'; h.at = 0;
      var ms = this._dagger(near, SK.dagger.dmg(dl)), xl = this._lvOf('double'); this.glintT = T; this.glintA = Math.atan2(ty, tx);
      ms.main = true; if (xl) ms.extra = { n: SK.double.n(xl) + (this._evo('double') ? 2 : 0) + (this._awk('double') ? 1 : 0), mul: SK.double.dmg(xl) };   // 더블 드로잉: 단검(동작)은 하나, 맞으면 피해가 여러 번 겹쳐 뜬다 (2026-11-19 사용자 요청 — 붉은보석의 타격 수)
      D._play(h.act.snd, 0.3); }
    this._growStep(dt, G, near);
    // 발사체: 도둑의 단도는 겨눈 적을 따라가고(적이 쓰러지면 곧게), 적의 것은 곧게 날아와 피할 수 있다
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i];
      if (s.tgt && s.tgt.state !== 'dead') { var qx = s.tgt.x - s.x, qy = s.tgt.y - s.tgt.headY * 0.5 - s.y, qd = Math.hypot(qx, qy) || 1; s.vx = qx / qd * CFG.ATK.shot; s.vy = qy / qd * CFG.ATK.shot;
        if (qd <= CFG.ATK.shot * dt + 8) { this._hitFoe(s.tgt, s.dmg * (s.dg ? this._onDagger(s.tgt) : 1), s.arm); this._extra(s, s.tgt); if (s.spl) this._dagSplash(s.tgt.x, s.tgt.y, s.spl);
          if (s.main && this._awk('dagger')) { var pt = s.tgt, po = null, pd = 70; for (j = 0; j < F.length; j++) { var pf = F[j]; if (pf === pt || pf.state === 'dead') continue; var pq = Math.hypot(pf.x - pt.x, pf.y - pt.y); if (pq < pd) { pd = pq; po = pf; } } if (po) this._hitFoe(po, s.dmg * 0.6 * this._onDagger(po), s.arm); }   // 관통 단검(각성)
          s.dead = true; continue; } }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (!s.foe && !(s.tgt && s.tgt.state !== 'dead')) { var gx = Math.floor(s.x / CS), gy = Math.floor((s.y + 16) / CS), ga, gb, gj, got = null;   // 겨눈 적이 없는 단검(다팅 피버·적이 먼저 쓰러진 단검): 처음 닿는 적을 맞힌다
        for (ga = gx - 1; ga <= gx + 1 && !got; ga++) for (gb = gy - 1; gb <= gy + 1 && !got; gb++) { var GL = G[ga + ',' + gb]; if (GL) for (gj = 0; gj < GL.length; gj++) if (GL[gj].state !== 'dead' && !(s.vol && (s.vol.hit[GL[gj].uid] || Math.hypot(GL[gj].x - s.x0, GL[gj].y - s.y0) > CFG.ATK.range + 12)) && Math.hypot(GL[gj].x - s.x, GL[gj].y - GL[gj].headY * 0.5 - s.y) < (s.vol ? Math.max(15, Math.hypot(s.x - s.x0, s.y - s.y0) * s.wk) : 15)) { got = GL[gj]; break; } }   // 흩뿌리기 단검(vol): 이미 맞은 적은 건너뛰고, 멀어질수록 단검 사이가 벌어지는 만큼 폭을 넓혀 부채꼴 안을 빈틈없이
        if (got && s.vol) { if (s.vol.left > 0) { s.vol.left--; s.vol.hit[got.uid] = 1; this._hitFoe(got, s.dmg * (1 - (1 - s.far) * Math.min(1, Math.hypot(got.x - s.x0, got.y - s.y0) / CFG.ATK.range)) * this._onDagger(got), s.arm); this.bursts.push({ x: got.x, y: got.y - got.headY * 0.5, t0: T, a: Math.atan2(s.vy, s.vx), k: 'p', life: 0.2 }); if (s.spl) this._dagSplash(got.x, got.y, s.spl); } else { s.dead = true; continue; } }   // 꿰뚫고 계속 난다 — 먼 적일수록 약하게(far), 한 번에 n명까지
        else if (got) { this._hitFoe(got, s.dmg * (s.dg ? this._onDagger(got) : 1), s.arm); this._extra(s, got); if (s.spl) this._dagSplash(got.x, got.y, s.spl); s.dead = true; continue; } }
      if (s.foe && Math.hypot(h.x - s.x, h.y - h.headY * 0.5 - s.y) < 13) { this._fx(s.x, s.y, s.arm); this._hitHero(s.dmg); s.dead = true; }
      else if (T - s.t0 > s.life) s.dead = true; }
    this.shots = this.shots.filter(function (s) { return !s.dead; });
    this.effects = this.effects.filter(function (e) { return (T - e.t0) * 15 < e.f.length; });
    this.texts = this.texts.filter(function (e) { return T - e.t0 < 0.7; });
    this.nums = this.nums.filter(function (e) { return T - e.t0 < NUM[e.k].life; });
    this.slashes = this.slashes.filter(function (e) { return T - e.t0 < 0.3; }); this.arcs = this.arcs.filter(function (e) { return T - e.t0 < CFG.BLADE.arcLife; }); this.ghosts = this.ghosts.filter(function (e) { return T < e.until; }); this.puffs = this.puffs.filter(function (e) { return T - e.t0 < 0.45; }); if (this.puffs.length > 40) this.puffs.splice(0, this.puffs.length - 40);
    this.bursts = this.bursts.filter(function (e) { return T - e.t0 < e.life; }); if (this.bursts.length > 120) this.bursts.splice(0, this.bursts.length - 120);
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
    for (i = 0; i < L.length; i++) { if (!hd && L[i].y > h.y) { hd = true; this._drawHero(); } if (L[i].boss) { var bu = L[i], bs = bu.mini ? CFG.MINI.scale : CFG.BOSS.scale; ctx.save(); ctx.translate(bu.x, bu.y); ctx.scale(bs, bs); ctx.translate(-bu.x, -bu.y); D._drawUnit(bu); ctx.restore(); } else D._drawUnit(L[i]); }
    if (!hd) this._drawHero();
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i], fl = s.def && !s.def.dir && s.def.fly;
      if (s.spl) { var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9), sc = s.spl === 'toxdag' ? '90,230,70' : '255,150,40'; sg.addColorStop(0, 'rgba(' + sc + ',.95)'); sg.addColorStop(1, 'rgba(' + sc + ',0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 6.2832); ctx.fill(); }   // 트래퍼의 독·폭발 단검
      if (s.foe) { var gl = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 11); gl.addColorStop(0, 'rgba(255,90,60,.85)'); gl.addColorStop(0.45, 'rgba(255,60,40,.35)'); gl.addColorStop(1, 'rgba(255,40,30,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(s.x, s.y, 11, 0, 6.2832); ctx.fill(); }   // 적 투사체: 붉은 빛무리 (원본 이펙트가 작아 눈에 안 띄었다)
      if (fl && fl.length) D._fxFrame(fl[Math.floor((D.time - s.t0) * 15) % fl.length], s.x, s.y, true);
      else { var sa = Math.atan2(s.vy, s.vx), ux = Math.cos(sa), uy = Math.sin(sa); ctx.lineCap = 'round';
        if (s.foe) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x - ux * 7, s.y - uy * 7); ctx.lineTo(s.x + ux * 7, s.y + uy * 7); ctx.stroke(); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - ux * 7, s.y - uy * 7); ctx.lineTo(s.x + ux * 7, s.y + uy * 7); ctx.stroke(); }
        else {   // 도둑의 단검 (붉은보석 영상처럼): 거의 안 보일 만큼 가늘고 빠르다 — 뒤로 끊어진 옅은 자국, 앞에 짧고 밝은 날
          ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(s.x - ux * 46, s.y - uy * 46); ctx.lineTo(s.x - ux * 6, s.y - uy * 6); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(s.x - ux * 6, s.y - uy * 6); ctx.lineTo(s.x + ux * 6, s.y + uy * 6); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x - ux * 6, s.y - uy * 6); ctx.lineTo(s.x + ux * 6, s.y + uy * 6); ctx.stroke(); } } }
    this._drawArcs();
    for (i = 0; i < this.puffs.length; i++) { var pf = this.puffs[i], pk = (D.time - pf.t0) / 0.45; ctx.save(); ctx.translate(pf.x, pf.y - 6); ctx.scale(1, 0.6); var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pf.r * (0.6 + 0.4 * pk)); pg.addColorStop(0, 'rgba(90,220,70,' + (0.5 * (1 - pk)).toFixed(3) + ')'); pg.addColorStop(1, 'rgba(60,180,40,0)'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pf.r * (0.6 + 0.4 * pk), 0, 6.2832); ctx.fill(); ctx.restore(); }   // 독 묻힌 단도의 독 튐
    for (i = 0; i < this.slashes.length; i++) { var sl2 = this.slashes[i], sk2 = 1 - (D.time - sl2.t0) / 0.3; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';   // 처형의 칼자국
      ctx.strokeStyle = 'rgba(150,90,255,' + (0.8 * sk2).toFixed(3) + ')'; ctx.lineWidth = 7 * sk2 + 1; ctx.beginPath(); ctx.moveTo(sl2.x0, sl2.y0); ctx.lineTo(sl2.x1, sl2.y1); ctx.stroke(); ctx.strokeStyle = 'rgba(240,230,255,' + sk2.toFixed(3) + ')'; ctx.lineWidth = 2 * sk2 + 0.5; ctx.beginPath(); ctx.moveTo(sl2.x0, sl2.y0); ctx.lineTo(sl2.x1, sl2.y1); ctx.stroke(); ctx.restore(); }
    // 단검이 맞은 자리의 섬광 (붉은보석 도둑 영상을 보고 — 이 게임에서 그린 것): 보통 = 흰 별 모양 빛살, 치명타·더블 = 검보라 가시 덩어리 + 흰 속, 쓰러진 자리 = 노란 반짝임
    var spikes = function (b, k, n, r0, r1, wid) { for (var j = 0; j < n; j++) { var a = b.a + j * 6.283 / n + (j % 2) * 0.25, l = (r0 + r1 * k) * (j % 2 ? 0.62 : 1), w = wid * (1 - k) + 0.6; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * l, b.y + Math.sin(a) * l); ctx.lineTo(b.x + Math.cos(a + 1.57) * w, b.y + Math.sin(a + 1.57) * w); ctx.lineTo(b.x - Math.cos(a + 1.57) * w, b.y - Math.sin(a + 1.57) * w); ctx.closePath(); ctx.fill(); } };
    for (i = 0; i < this.bursts.length; i++) { var bu2 = this.bursts[i], bk = Math.max(0, Math.min(1, (D.time - bu2.t0) / bu2.life)); ctx.save(); if (bu2.sc) { ctx.translate(bu2.x, bu2.y); ctx.scale(bu2.sc, bu2.sc); ctx.translate(-bu2.x, -bu2.y); }
      if (bu2.k === 'p') { ctx.globalCompositeOperation = 'lighter'; ctx.translate(bu2.x, bu2.y); ctx.rotate(bu2.a); var pl = 10 + 26 * bk; ctx.globalAlpha = 1 - bk; ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 3 * (1 - bk) + 0.5; ctx.beginPath(); ctx.moveTo(-pl * 0.35, 0); ctx.lineTo(pl, 0); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-pl * 0.35, 0); ctx.lineTo(pl, 0); ctx.moveTo(0, -5 * (1 - bk)); ctx.lineTo(0, 5 * (1 - bk)); ctx.stroke(); }   // 단도 흩뿌리기: 꿰뚫고 지나간 방향의 푸른 흰 빛줄기 (다팅 피버의 둥근 큰 별과 구별)
      else if (bu2.k === 'g') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe24a'; for (var gj = 0; gj < 7; gj++) { var ga2 = bu2.a + gj * 0.9, gr = 4 + 16 * bk * (0.6 + (gj % 3) * 0.25); ctx.globalAlpha = (1 - bk) * (0.6 + 0.4 * Math.sin(D.time * 40 + gj)); ctx.fillRect(bu2.x + Math.cos(ga2) * gr - 1, bu2.y + Math.sin(ga2) * gr * 0.6 - 10 * bk - 1, 2, 2); } }
      else if (bu2.k === 'n') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - bk * bk; spikes(bu2, bk, 8, 8, 20, 2.6); ctx.beginPath(); ctx.arc(bu2.x, bu2.y, 5 * (1 - bk) + 1, 0, 6.3); ctx.fill(); }
      else { var big = bu2.k === 'd' ? 1.35 : 1; ctx.globalAlpha = 1 - bk * bk * bk; ctx.fillStyle = '#1a0a3a'; spikes(bu2, bk, 14, 10 * big, 16 * big, 3.4); ctx.beginPath(); ctx.arc(bu2.x, bu2.y, (9 + 5 * bk) * big, 0, 6.3); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,90,255,.9)'; ctx.globalAlpha = (1 - bk) * 0.9; spikes(bu2, bk, 7, 6 * big, 22 * big, 1.6); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bu2.x, bu2.y, 4 * (1 - bk) * big + 0.5, 0, 6.3); ctx.fill(); }
      ctx.restore(); }
    ctx.globalAlpha = 1;
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
    var bf = 1 - (D.time - this.flashT) / 0.3; if (bf > 0) { ctx.fillStyle = 'rgba(255,245,220,' + (0.55 * bf).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }   // 폭탄: 화면이 번쩍
    this._drawStick(); this._drawHud();
    if (this.hide && !this.over) this._drawHide();
    if (this.over) this._drawOver();
    if (this.cards) this._drawCards();
    if (this.info) this._drawInfo();
    if (this.menu) this._drawMenu();
  };
  P._drawHero = function () { var D = this.D, ctx = D.ctx, h = this.hero, T = D.time;
    if (h.state !== 'dead') {   // 발밑의 노란 고리: 옅은 타원 + 도는 밝은 호 + 따라오는 점들 (붉은보석 도둑 영상의 발밑 고리 느낌 — 이 게임에서 그린 것)
      ctx.save(); ctx.translate(h.x, h.y + 2); ctx.scale(1, 0.45); ctx.globalCompositeOperation = 'lighter';
      var rg = ctx.createRadialGradient(0, 0, 6, 0, 0, 26); rg.addColorStop(0, 'rgba(255,220,60,.28)'); rg.addColorStop(1, 'rgba(255,200,40,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,90,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.3); ctx.stroke();
      var ra = T * 3.2; ctx.strokeStyle = 'rgba(255,250,200,.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 23, ra, ra + 1.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,210,.9)'; for (var ri = 1; ri <= 5; ri++) { ctx.globalAlpha = 1 - ri * 0.17; ctx.beginPath(); ctx.arc(Math.cos(ra - ri * 0.2) * 23, Math.sin(ra - ri * 0.2) * 23, 1.6, 0, 6.3); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1; }
    D._drawUnit(h); ctx.globalAlpha = 1;
    if (T < this.stealthUntil && h.state !== 'dead') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';   // 그림자 숨기: 몸을 감싸고 위로 흐르는 보라색 빛줄기
      for (var si = 0; si < 9; si++) { var sx = h.x - 14 + si * 3.5 + Math.sin(T * 3 + si) * 1.5, ph = (T * 1.6 + si * 0.37) % 1, sy0 = h.y - 2 - ph * (h.headY + 6); ctx.strokeStyle = 'rgba(150,90,255,' + (0.55 * (1 - ph)).toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, sy0); ctx.lineTo(sx, sy0 - 12); ctx.stroke(); }
      ctx.restore(); }
    var rt = T - this.ringT; if (rt >= 0 && rt < 0.28 && h.state !== 'dead') { var rk = rt / 0.28;   // 다팅 피버의 한 파: 몸 둘레로 푸른 빛줄기가 사방으로 번쩍인다 (가운데서 퍼지던 고리는 뺐다 — 2026-11-19 사용자 요청)
      if (rt < 0.14) { var qk = 1 - rt / 0.14, cy0 = h.y - h.headY * 0.55; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (var qi = 0; qi < this.ringN; qi++) { var qa = this.ringA + qi / this.ringN * 6.2832, q0 = 10 + 14 * (1 - qk), q1 = q0 + 22; ctx.strokeStyle = 'rgba(90,150,255,' + (0.85 * qk).toFixed(3) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(qa) * q0, cy0 + Math.sin(qa) * q0 * 0.7); ctx.lineTo(h.x + Math.cos(qa) * q1, cy0 + Math.sin(qa) * q1 * 0.7); ctx.stroke();
          ctx.strokeStyle = 'rgba(235,245,255,' + qk.toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(h.x + Math.cos(qa) * q0, cy0 + Math.sin(qa) * q0 * 0.7); ctx.lineTo(h.x + Math.cos(qa) * q1, cy0 + Math.sin(qa) * q1 * 0.7); ctx.stroke(); }
        ctx.restore(); } }
    var gt = T - (this.glintT || -9); if (gt >= 0 && gt < 0.12 && h.state !== 'dead') { var ga = this.glintA, gk = 1 - gt / 0.12, gx = h.x + Math.cos(ga) * 9, gy = h.y - h.headY * 0.62 + Math.sin(ga) * 6;   // 던지는 순간 손에서 번쩍이는 푸른 빛줄기
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(90,150,255,' + (0.9 * gk).toFixed(3) + ')'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ga) * 20, gy + Math.sin(ga) * 20); ctx.stroke();
      ctx.strokeStyle = 'rgba(235,245,255,' + gk.toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(ga) * 22, gy + Math.sin(ga) * 22); ctx.stroke(); ctx.restore(); }
    if (h.state !== 'dead' && h.hp >= h.maxHp) D._drawHpBar(h, Math.round(h.x), Math.round(h.y)); };   // 체력 바는 늘 보인다 (닳으면 _drawUnit 이 그린다)
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
      g.fillStyle = '#000'; g.fillText(String(i), x + K * 1.5, y + K * 1.8); g.fillText(String(i), x + K * 0.8, y + K * 1); g.lineWidth = K * 1.1; g.strokeStyle = '#000'; g.strokeText(String(i), x, y); g.fillStyle = gr; g.fillText(String(i), x, y);   // 오른쪽 아래로 떨어지는 검은 그림자 + 가는 테
      g.save(); g.beginPath(); g.rect(i * cw, 0, cw, ch * 0.5); g.clip(); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillText(String(i), x, y); g.restore(); }   // 윗부분 광택
    N.cv = cv; N.cw = cw / K; N.ch = ch / K; N.K = K; return N;
  };
  P._drawNums = function () {
    var D = this.D, ctx = D.ctx, T = D.time, i, j;
    for (i = 0; i < this.nums.length; i++) { var n = this.nums[i], N = this._numSheet(n.k), t = T - n.t0, k = t / N.life, s = String(n.v);
      n.sc = n.sc == null ? 1 : n.sc + ((n.old ? 0.62 : 1) - n.sc) * 0.3; n.ly = n.ly == null ? 0 : n.ly + (n.lift - n.ly) * 0.35;   // 밀려 올라가며 작아지는 것은 부드럽게
      var pop = (t < 0.09 ? 1.9 - 10 * t : 1) * n.sc, adv = N.cw * 0.6 * pop, w = adv * (s.length - 1) + N.cw * pop;
      var y = n.y - n.ly - N.rise * k - N.ch * pop / 2, x = n.x - w / 2; ctx.globalAlpha = (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1) * (n.old ? 0.85 : 1);
      for (j = 0; j < s.length; j++) { var dg = s.charCodeAt(j) - 48; ctx.drawImage(N.cv, dg * N.cw * N.K, 0, N.cw * N.K, N.ch * N.K, x + j * adv, y, N.cw * pop, N.ch * pop); }
      if (N.label) { var lp = n.old ? 0.8 : 1; ctx.font = 'italic 900 ' + Math.round(9 * lp) + 'px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(80,0,20,.9)'; ctx.strokeText(N.label, n.x, y + N.ch * pop + 4); ctx.fillStyle = '#ffd6e6'; ctx.fillText(N.label, n.x, y + N.ch * pop + 4); ctx.textAlign = 'left'; } }   // "Double Critical!!" 은 숫자 아래에 작게
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
    this.ultBtn = { x: W - 8 - 44 - 50, y: by - 10, w: 44, h: 44 };   // 궁극기 칸 (축지법 칸 왼쪽)
    this.hudBot = by - 36;   // 스킬 줄 + 그 위의 패시브 작은 칸                                   // 이 아래는 조작 영역이 아니다 (스킬 줄)
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
    var RW2 = this.rushWarn; if (RW2) { var ex = hx0 - Math.cos(RW2.a) * 900, ey = hy0 - Math.sin(RW2.a) * 900, qx = Math.max(22, Math.min(W - 22, ex)), qy = Math.max(78, Math.min(this.hudBot - 18, ey)), pq = 0.55 + 0.45 * Math.sin(D.time * 12);   // 돌진이 오는 쪽 가장자리: 붉은 겹화살표
      ctx.save(); ctx.translate(qx, qy); ctx.rotate(RW2.a); ctx.globalAlpha = pq; ctx.fillStyle = '#ff4a2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; for (i = 0; i < 3; i++) { var cx3 = i * 11 - 6; ctx.beginPath(); ctx.moveTo(cx3 + 9, 0); ctx.lineTo(cx3 - 4, -10); ctx.lineTo(cx3, 0); ctx.lineTo(cx3 - 4, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); }
    ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif';
    ctx.font = 'bold 12px sans-serif'; txt('Lv ' + this.lv, this.menuBtn.x - 8, 'right', '#9cc0ff');
    var M = this.menuBtn; D._plate(M.x, M.y, M.w, M.h, 5, false); ctx.fillStyle = '#e6c476'; for (i = 0; i < 3; i++) ctx.fillRect(M.x + 10, M.y + 8 + i * 5, M.w - 20, 2);
    // 스킬 칸: 얻은 순서대로 (아이콘 + 레벨, 주기 스킬은 남은 대기만큼 어둡게 덮인다). 누르는 버튼이 아니라 지금 빌드의 표시
    var IC = D.data.fx.icon, icons = D.assets.get('acticons'), self = this, icon = function (ic, b, pad) { var fi = ic * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, b.x + pad, b.y + pad, b.w - pad * 2, b.h - pad * 2); };
    var cool = function (key, b) { var s = SK[key], l = self.sk[key], r = s.cd && self.tm[key] > 0 ? Math.min(1, self.tm[key] / (s.cd(l) * (1 - self._pv('haste')) * (self.ult === key ? GROW.ultCd : 1))) : 0; if (r > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(b.x + 3, b.y + 3 + (b.h - 6) * (1 - r), b.w - 6, (b.h - 6) * r); } };
    this.hit = [];   // 누를 수 있는 칸들 [{x,y,w,h,key}] (꾹 누르면 설명, 수동 스킬은 짧게 누르면 발동)
    for (i = 0; i < this.slots.length; i++) { var b = this.slots[i], key = this.order[i], isU = key && this.ult === key, ak = key && this._awk(key); ctx.globalAlpha = key ? (isU ? 0.6 : 1) : 0.4; D._plate(b.x, b.y, b.w, b.h, 4, false);
      if (key) { this.hit.push({ x: b.x, y: b.y, w: b.w, h: b.h, key: key }); icon(SK[key].icon, b, 4); if (!isU) cool(key, b);
        if (isU) { ctx.globalAlpha = 1; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.fillRect(b.x + 2, b.y + 2, 11, 10); ctx.fillStyle = '#ffd36e'; ctx.fillText('궁', b.x + 3, b.y + 8); }
        if (ak) { ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3); }   // 각성한 스킬: 하늘색 테
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); ctx.fillStyle = ak ? '#7fe0ff' : this._evo(key) ? '#ffd36e' : '#fff'; ctx.fillText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); } }
    var pas = Object.keys(this.sk).filter(function (k) { return SK[k].tree === 'pas' || SK[k].trait; }); ctx.globalAlpha = 1;   // 패시브: 스킬 줄 위에 작은 칸
    for (i = 0; i < pas.length; i++) { var pb = { x: 8 + i * 28, y: this.slots[0].y - 28, w: 24, h: 24, key: pas[i] }; this.hit.push(pb); D._plate(pb.x, pb.y, pb.w, pb.h, 3, false); icon(SK[pas[i]].icon, pb, 3);
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.strokeText(this.sk[pas[i]], pb.x + pb.w - 2, pb.y + pb.h - 5); ctx.fillStyle = '#fff'; ctx.fillText(this.sk[pas[i]], pb.x + pb.w - 2, pb.y + pb.h - 5); }
    this.hit.push({ x: this.blinkBtn.x, y: this.blinkBtn.y, w: this.blinkBtn.w, h: this.blinkBtn.h, key: 'blink' });
    // 궁극기 칸: 고급 스킬 하나를 올려 직접 쓴다 (설명 카드에서 올린다). 준비되면 금빛으로 맥박친다. 올릴 수 있는 스킬이 하나도 없으면 칸을 그리지 않는다
    var B = this.blinkBtn; ctx.globalAlpha = 1; D._plate(B.x, B.y, B.w, B.h, 6, !(this.tm.blink > 0)); icon(SK.blink.icon, B, 6); cool('blink', B);   // 축지법 칸
    var U = this.ultBtn, UD = this.cls && ULT[this.cls];   // 궁극기 칸: 전직한 뒤에만 보인다
    if (UD) { var urdy = !(this.tm.ult > 0), ucd = ULT.cd * (1 - this._pv('haste')); ctx.globalAlpha = 1; D._plate(U.x, U.y, U.w, U.h, 6, urdy); this.hit.push({ x: U.x, y: U.y, w: U.w, h: U.h, key: 'ult' }); icon(UD.icon, U, 6);
      if (!urdy) { var ur = Math.min(1, this.tm.ult / ucd); ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(U.x + 3, U.y + 3 + (U.h - 6) * (1 - ur), U.w - 6, (U.h - 6) * ur); ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(Math.ceil(this.tm.ult), U.x + U.w / 2, U.y + U.h / 2); ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(this.tm.ult), U.x + U.w / 2, U.y + U.h / 2); }
      else { ctx.strokeStyle = 'rgba(255,225,110,' + (0.55 + 0.45 * Math.sin(D.time * 9)).toFixed(3) + ')'; ctx.lineWidth = 2.5; ctx.strokeRect(U.x + 1, U.y + 1, U.w - 2, U.h - 2); } }
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
      if (self.info) { self._infoTap(x, y); return; }
      if (self.over) { (self.overBtns || []).forEach(function (b) { if (inBox(b, x, y)) { if (b.act === 'retry') self.reset(); else self.exit(); } }); return; }
      if (inBox(self.menuBtn, x, y)) { self.openMenu(); return; }
      if (self.hide && self._hideTap(x, y)) return;   // 그림자 숨기: 적을 누르면 기습 (적이 아닌 곳은 평소처럼 조이스틱)
      var pk = self.over ? null : self._slotAt(x, y); if (pk) { self.press = { key: pk, t0: Date.now(), id: e.pointerId }; return; }   // 스킬 칸: 떼면 누르기(_slotTap), 0.35초 넘게 누르고 있으면 설명(frame)
      if (y >= self.hudBot) return;                          // 스킬 줄
      var now = Date.now(), LD = self.lastDown; self.lastDown = { t: now, x: x, y: y };
      if (LD && now - LD.t < 300 && Math.hypot(x - LD.x, y - LD.y) < 44) { self.lastDown = null; self._blink(x - D.W / 2, y - D.H * CFG.HERO_Y); return; }   // 두 번 누르기 = 그쪽으로 축지법
      self.stick = { id: e.pointerId, x0: x, y0: y, x: x, y: y }; try { cv.setPointerCapture(e.pointerId); } catch (err) {} });
    cv.addEventListener('pointermove', function (e) { var S = self.stick; if (!on() || !S || S.id !== e.pointerId) return; var p = D._pos(e); S.x = p[0]; S.y = p[1];
      var dx = S.x - S.x0, dy = S.y - S.y0, m = Math.hypot(dx, dy), R = CFG.STICK.r * 1.6; if (m > R) { S.x0 = S.x - dx / m * R; S.y0 = S.y - dy / m * R; } });   // 멀리 끌면 중심이 따라온다 (방향을 바꾸려고 손가락을 한참 되돌리지 않게)
    var end = function (e) { var S = self.stick; if (S && S.id === e.pointerId) self.stick = null;
      var PR = self.press; if (PR && PR.id === e.pointerId) { self.press = null; if (e.type === 'pointerup' && on() && !self.cards && !self.menu && !self.over) self._slotTap(PR.key); } };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    root.addEventListener('keydown', function (e) { if (!on()) return;
      if (e.key === 'Escape') { if (self.menu) self.menu = false; else self.openMenu(); return; }
      if (e.code === 'KeyM' && !e.repeat) { D.sfx.unlock(); D.toggleSound(); return; }
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); self._blink(0, 0); return; }
      if (e.code === 'KeyE' && !e.repeat) { self._slotTap('ult'); return; }
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
    dagger: { awk: { pas: 'power', name: '관통 단검', text: '맞은 적 옆의 적 하나도 60% 피해' }, name: '단도 던지기', tree: 'throw', icon: 63, slot: 1, dmg: L5([1, 1.2, 1.4, 1.65, 1.9]), sec: L5([1, 0.93, 0.86, 0.8, 0.72]),
      desc: function (l) { return '가장 가까운 적에게 단검을 던집니다. 피해 ' + pc(this.dmg(l)) + ', 던지는 간격 ' + pc(this.sec(l)); } },
    double: { awk: { pas: 'haste', name: '연속 드로잉', text: '타격이 한 번 더' }, name: '더블 드로잉', tree: 'throw', icon: 5, slot: 1, evo: { cls: 'venom', name: '코인시던스 드로잉' }, n: L5([1, 1, 2, 2, 3]), dmg: L5([0.6, 0.75, 0.75, 0.9, 0.9]),
      desc: function (l, ev) { return '단검 하나가 ' + (this.n(l) + (ev ? 2 : 0)) + '번 더 타격합니다 (각 피해 ' + pc(this.dmg(l)) + ')' + (ev ? ', 치명타 확률 +5%' : ''); } },
    scatter: { name: '단도 흩뿌리기', tree: 'throw', icon: 4, slot: 1, evo: { cls: 'venom', name: '단도 총공격' }, cd: L5([2.4, 2.4, 2.2, 2.2, 2]), n: L5([6, 8, 10, 12, 14]), m: L5([4, 5, 6, 7, 8]), ang: L5([50, 65, 80, 95, 110]), far: L5([0.4, 0.55, 0.7, 0.85, 1]), dmg: L5([0.7, 0.8, 0.9, 1, 1.1]),   // 300번(2026-11-20 사용자): 가까운 n명 → 가장 가까운 적 쪽 부채꼴(각도 ang°, 사거리 안)로 단검 m개가 고르게 퍼져 곧게 날아가며 적을 꿰뚫는다(한 번에 n명까지, 같은 적은 한 번). 다팅 피버(단검 없이 제자리에서 돌며 둘레를 즉시 타격)와 연출이 겹치지 않게 — 사용자. far = 사거리 끝에서의 피해 비율(가까울수록 온전히, 5단계는 거리와 무관). 쓰로워 진화 = 앞뒤 두 방향
      desc: function (l, ev) { return '가장 가까운 적 쪽 부채꼴(' + this.ang(l) + '°)' + (ev ? '과 그 반대쪽' : '') + '로 단검 ' + this.m(l) + '개를 흩뿌려 꿰뚫습니다 — 한 번에 ' + this.n(l) + '명까지 (피해 ' + pc(this.dmg(l)) + (this.far(l) < 1 ? ', 먼 적은 ' + pc(this.dmg(l) * this.far(l)) + '까지 약해짐' : ', 거리와 무관') + ')'; } },
    fever: { awk: { pas: 'reach', name: '다팅 스톰', text: '대상 +4명, 닿는 거리 1.3배' }, man: 1, name: '다팅 피버', tree: 'throw', icon: 54, slot: 1, evo: { cls: 'venom', name: '다팅 피버' }, cd: L5([7, 6.5, 6, 5.5, 5]), n: L5([8, 10, 10, 12, 12]), w: L5([1, 1, 2, 2, 3]), dmg: L5([0.8, 0.9, 1, 1.1, 1.2]),
      desc: function (l, ev) { return '둘레의 적 ' + this.n(l) + '명을 단검으로 ' + (this.w(l) + (ev ? 1 : 0)) + '번 순식간에 칩니다 (피해 ' + pc(this.dmg(l) * (ev ? 1.3 : 1)) + ')'; } },
    poison: { name: '독 단도', tree: 'throw', icon: 79, slot: 1, v: L5([0.15, 0.25, 0.35, 0.45, 0.6]), dur: 4,
      desc: function (l) { return '단검에 맞은 적은 4초 동안 받는 피해 +' + pc(this.v(l)); } },
    mouse: { awk: { pas: 'last', name: '강철 덫', text: '밟은 적을 1.5초 묶고 덫을 14개까지' }, name: '쥐덫 설치', tree: 'trap', icon: 62, slot: 1, arm: 63, boom: 62, cd: L5([3, 2.6, 2.3, 2, 1.7]), dmg: L5([1.2, 1.5, 1.8, 2.2, 2.6]), slow: 0.7, slowSec: 3, max: 10,
      desc: function (l) { return this.cd(l) + '초마다 발밑에 쥐덫을 놓습니다. 밟은 적에게 피해 ' + pc(this.dmg(l)) + ', 3초 감속'; } },
    booby: { name: '발목 함정 설치', tree: 'trap', icon: 77, slot: 1, arm: 46, boom: 62, evo: { cls: 'trapper', name: '절단 함정' }, cd: L5([6, 5.5, 5, 4.5, 4]), root: L5([2, 2.5, 3, 3.5, 4]), dmg: L5([0.6, 0.7, 0.8, 0.9, 1]), max: 6,
      desc: function (l, ev) { return this.cd(l) + '초마다 발목 함정을 놓습니다. 밟은 적' + (ev ? '과 둘레의 적 모두' : '') + '를 ' + this.root(l) + '초 묶고 피해 ' + pc(this.dmg(l) * (ev ? 2 : 1)); } },
    explo: { awk: { pas: 'reach', name: '대폭발', text: '폭발 범위 1.5배' }, name: '폭발 함정 설치', tree: 'trap', icon: 64, slot: 1, arm: 64, boom: 64, evo: { cls: 'trapper', name: '연폭 함정' }, cd: L5([7, 6.5, 6, 5.5, 5]), dmg: L5([3, 4, 5, 6.5, 8]), r: 60, max: 6,
      desc: function (l, ev) { return this.cd(l) + '초마다 폭발 함정을 놓습니다. 밟으면 둘레의 적 모두에게 피해 ' + pc(this.dmg(l)) + (ev ? ' — 3번 연달아 폭발' : ''); } },
    simul: { man: 1, name: '일제 폭발', tree: 'trap', icon: 39, slot: 1, boom: 20, need: 'trap', cd: L5([12, 11, 10, 9, 8]), dmg: L5([2, 2.6, 3.2, 4, 5]), r: 48,
      desc: function (l) { return this.cd(l) + '초마다 깔아 둔 덫을 모두 터뜨립니다. 덫마다 둘레에 피해 ' + pc(this.dmg(l)); } },
    gas: { awk: { pas: 'last', name: '역병 지대', text: '독 구름이 도둑을 따라다닌다' }, man: 1, name: '유독가스', tree: 'trap', icon: 92, slot: 1, arm: 79, evo: { cls: 'trapper', name: '유독가스' }, cd: L5([9, 8.5, 8, 7.5, 7]), dmg: L5([0.8, 1, 1.2, 1.5, 1.8]), r: 50, dur: 4, v: 0.1,
      desc: function (l, ev) { return this.cd(l) + '초마다 독 구름을 던집니다. ' + (ev ? 6 : 4) + '초 동안 안의 적에게 초당 피해 ' + pc(this.dmg(l)) + ', 받는 피해 +' + (ev ? '16%' : '10%') + (ev ? ' (범위 1.5배)' : ''); } },
    blink: { name: '축지법', tree: 'shadow', icon: 12, cd: L5([6, 5.5, 5, 4.5, 4]), dist: L5([110, 125, 140, 155, 170]),
      desc: function (l) { return '화면을 두 번 누르면 그쪽으로 ' + this.dist(l) + '만큼 순간 이동합니다 (대기 ' + this.cd(l) + '초, 잠깐 무적)'; } },
    surprise: { awk: { pas: 'power', name: '연쇄 기습', text: '가장 튼튼한 적 셋을 한꺼번에' }, man: 1, name: '기습', tree: 'shadow', icon: 85, slot: 1, fx: 74, evo: { cls: 'shadow', name: '교란' }, cd: L5([7, 6.5, 6, 5.5, 5]), dmg: L5([5, 6.5, 8, 10, 12]), range: 230,
      desc: function (l, ev) { return this.cd(l) + '초마다 가장 튼튼한 적을 급습해 피해 ' + pc(this.dmg(l)) + (ev ? ', 둘레의 적을 2초 멈춥니다' : ''); } },
    shadow: { awk: { pas: 'regen', name: '그림자 치유', text: '기습할 때 체력 20% 회복' }, man: 1, name: '그림자 숨기', tree: 'shadow', icon: 11, slot: 1, evo: { cls: 'shadow', name: '그림자 동화' }, cd: L5([16, 15, 14, 13, 12]), dur: L5([6, 6.5, 7, 7.5, 8]), crit: L5([0.2, 0.275, 0.35, 0.425, 0.5]), amb: L5([4, 5, 6, 7.5, 9]),
      desc: function (l) { return this.cd(l) + '초마다 숨습니다(최대 ' + this.dur(l) + '초) — 적이 도둑을 놓치고 서성이며, 자동 공격은 멈춥니다. 적을 누르면 그 적 옆으로 가서 기습하고 풀립니다(피해 ' + pc(this.amb(l)) + ', 반드시 치명타)'; } },   /* 2026-11-19 사용자: "모든 적이 멈추는 게 아닌, 어그로만 끌리지 않은 상태에서(게임 진행) 내가 타겟한 적을 공격" */   /* 2026-11-19 사용자 "그림자 숨기 하고 난 후 자동 공격 말고 적을 찍어야 풀리면서 게임 진행되도록" — 전에는 몇 초 숨었다 저절로 풀렸다 */
    assassin: { name: '암살', tree: 'shadow', icon: 41, slot: 1, evo: { cls: 'shadow', name: '암살' }, p: L5([0.03, 0.05, 0.07, 0.09, 0.12]),
      desc: function (l, ev) { return '단검에 맞은 적이 ' + pc(this.p(l) * (ev ? 1.5 : 1)) + ' 확률로 즉사합니다 (우두머리는 5배 피해)'; } },
    /* 그림자 검술 (tree: blade) — 섀도우 인필트레이터로 전직하면 칼 스킬이 전부 이것으로 바뀐다(_toBlade: 단계는 이어받는다). 전직 전에는 카드에 안 나온다 */
    slash: { awk: { pas: 'power', name: '초승달 베기', text: '베기가 둘레 전체(원)로 넓어진다' }, name: '그림자 베기', tree: 'blade', icon: 0, slot: 1, dmg: L5([1, 1.15, 1.3, 1.5, 1.7]), r: L5([62, 68, 74, 80, 88]), sec: L5([1, 0.94, 0.88, 0.82, 0.76]),
      desc: function (l) { return '가장 가까운 적 쪽 반원(반경 ' + this.r(l) + ')을 베어 안의 적 모두에게 피해 ' + pc(this.dmg(l)) + ', 베는 간격 ' + pc(this.sec(l)); } },
    combo: { name: '연속 베기', tree: 'blade', icon: 10, slot: 1, n: L5([1, 1, 2, 2, 3]), dmg: L5([0.5, 0.6, 0.6, 0.7, 0.75]),
      desc: function (l) { return '베기에 맞은 적 중 가까운 ' + CFG.BLADE.comboMax + '명을 ' + this.n(l) + '번 더 칩니다 (각 피해 ' + pc(this.dmg(l)) + ')'; } },
    whirl: { awk: { pas: 'reach', name: '폭풍 칼날', text: '범위 1.5배' }, name: '회오리 베기', tree: 'blade', icon: 59, slot: 1, cd: L5([7, 6.5, 6, 5.5, 5]), w: L5([2, 2, 3, 3, 4]), r: 105, dmg: L5([0.9, 1, 1.1, 1.25, 1.4]),
      desc: function (l) { return this.cd(l) + '초마다 제자리에서 돌며 둘레(반경 ' + this.r + ')의 적을 ' + this.w(l) + '번 벱니다 (피해 ' + pc(this.dmg(l)) + ')'; } },
    dash: { awk: { pas: 'last', name: '연쇄 돌진', text: '곧이어 되돌아오며 한 번 더 돌진' }, name: '그림자 돌진', tree: 'blade', icon: 96, slot: 1, cd: L5([9, 8.5, 8, 7.5, 7]), dist: L5([150, 165, 180, 200, 220]), dmg: L5([2, 2.5, 3, 3.6, 4.2]), w: 34,
      desc: function (l) { return this.cd(l) + '초마다 적이 가장 많은 쪽으로 ' + this.dist(l) + '만큼 돌진해 지나간 길의 적 모두에게 피해 ' + pc(this.dmg(l)) + ' (돌진하는 동안 무적)'; } },
    after: { name: '잔상', tree: 'blade', icon: 15, slot: 1, p: L5([0.4, 0.5, 0.6, 0.7, 0.8]),
      desc: function (l) { return '벤 자리에 분신이 남아 ' + CFG.BLADE.after + '초 뒤 같은 베기를 한 번 더 합니다 (피해 ' + pc(this.p(l)) + ') — 움직이며 싸우면 두 곳을 벱니다'; } },
    blood: { awk: { pas: 'regen', name: '흡혈 검', text: '처치 회복 2.5배' }, name: '피의 칼날', tree: 'blade', icon: 88, slot: 1, bleed: L5([0.15, 0.2, 0.25, 0.3, 0.4]), heal: L5([0.2, 0.3, 0.4, 0.5, 0.6]), kill: L5([0.02, 0.03, 0.04, 0.05, 0.07]),
      desc: function (l) { return '벤 적이 3초 동안 피를 흘립니다(초당 ' + pc(this.bleed(l)) + '). 쓰러뜨릴 때마다 체력 +' + this.heal(l) + ', ' + pc(this.kill(l)) + ' 확률로 즉사(우두머리 제외)'; } },
    /* 트래퍼 전용 주력 (2026-11-19 사용자 "주력 스킬을 독 묻힌 단도, 폭발 단도 — 적이 맞았을 때 그 자리에서 스플래시"): 전직하면 둘 다 1단계로 생기고 카드로 올린다.
       스킬 칸을 차지하지 않는다(trait — 패시브 줄에 작은 칸). 단검이 맞은 자리에서 터진다(같은 적에게는 0.15초에 한 번 — 더블 드로잉의 추가 타격마다 터지지 않게) */
    toxdag: { only: 'trapper', trait: 1, name: '독 묻힌 단도', tree: 'trap', icon: 106, cd: L5([4, 3.6, 3.2, 2.8, 2.4]), n: L5([1, 1, 2, 2, 3]), r: L5([40, 44, 48, 52, 58]), dmg: L5([0.3, 0.38, 0.46, 0.55, 0.65]), dot: L5([0.2, 0.25, 0.3, 0.36, 0.45]),
      desc: function (l) { return this.cd(l) + '초마다 독 묻힌 단검 ' + this.n(l) + '개를 던집니다. 맞은 자리에 독이 튑니다 — 반경 ' + this.r(l) + ' 안의 적에게 피해 ' + pc(this.dmg(l)) + ', 3초 동안 초당 ' + pc(this.dot(l)); } },
    bombdag: { only: 'trapper', trait: 1, name: '폭발 단도', tree: 'trap', icon: 103, cd: L5([5, 4.5, 4, 3.5, 3]), n: L5([1, 1, 1, 2, 2]), r: L5([46, 50, 55, 60, 68]), dmg: L5([0.55, 0.7, 0.85, 1, 1.2]),
      desc: function (l) { return this.cd(l) + '초마다 폭발 단검 ' + this.n(l) + '개를 던집니다. 맞은 자리에서 터집니다 — 반경 ' + this.r(l) + ' 안의 적 모두에게 피해 ' + pc(this.dmg(l)); } },
    sense: { name: '육감', tree: 'pas', icon: 9, v: L5([0.06, 0.12, 0.18, 0.24, 0.3]), desc: function (l) { return '적의 공격을 ' + pc(this.v(l)) + ' 확률로 피합니다'; } },
    pick: { name: '소매치기', tree: 'pas', icon: 53, v: L5([1.25, 1.5, 1.75, 2, 2.3]), desc: function (l) { return '경험치를 끌어오는 범위 ' + pc(this.v(l)); } },
    /* 패시브 5종 추가 (2026-11-19, 뱀서류 분석 글의 "패시브 조건부 진화"): 이름은 붉은보석 도둑의 보조 스킬에서, 효과는 이 게임에 맞게 다시 풀었다 */
    power: { name: '비열한 전략', tree: 'pas', icon: 85, v: L5([0.08, 0.16, 0.24, 0.32, 0.4]), desc: function (l) { return '모든 피해 +' + pc(this.v(l)); } },
    haste: { name: '전문 도구', tree: 'pas', icon: 73, v: L5([0.06, 0.12, 0.18, 0.24, 0.3]), desc: function (l) { return '던지는 간격과 모든 스킬의 대기 −' + pc(this.v(l)); } },
    reach: { name: '함정 개조', tree: 'pas', icon: 57, v: L5([0.1, 0.2, 0.3, 0.4, 0.5]), desc: function (l) { return '폭발·독 구름·덫이 닿는 범위 +' + pc(this.v(l)); } },
    last: { name: '전문가의 기술', tree: 'pas', icon: 71, v: L5([0.15, 0.3, 0.45, 0.6, 0.75]), desc: function (l) { return '감속·묶기·독·숨기의 지속 시간 +' + pc(this.v(l)); } },
    regen: { name: '해독', tree: 'pas', icon: 2, v: L5([0.5, 1, 1.5, 2, 2.5]), desc: function (l) { return '체력을 초당 ' + this.v(l) + ' 회복합니다'; } }
  };
  /* 각성: 스킬 5단계 + 짝이 되는 패시브(단계 무관)를 갖추면 그 스킬에 효과가 하나 더 붙는다 (SK[k].awk = { pas, name, text }). 전직의 상위 스킬(evo)과는 따로 겹친다 */
  var CLS = {
    venom: { name: '쓰로워', icon: 61,   // 이름 (2026-11-19 사용자): 베놈 쓰로워 → 쓰로워 · 사일런트 트래퍼 → 트래퍼 · 섀도우 인필트레이터 → 어쌔신
 col: '#ffcf7a', lines: ['궁극기 「다팅 퓨리」 — 화면의 적 모두를 단검으로 연타', '단검에 맞은 적이 3초 동안 피를 흘립니다', '더블 드로잉 → 코인시던스 드로잉 · 단도 흩뿌리기 → 단도 총공격', '다팅 피버는 사라지고 그 단계만큼 카드를 더'] },
    trapper: { name: '트래퍼', icon: 64, col: '#7fe36a', lines: ['궁극기 「독무」 — 큰 독 구름 + 폭발 함정 여섯', '주력: 독 묻힌 단도 · 폭발 단도 — 대기마다 던져 맞은 자리에서 터진다', '덫이 더 멀리서 반응하고 일제 폭발이 두 번', '발목 함정 → 절단 함정 · 폭발 함정 → 연폭 함정'] },
    shadow: { name: '어쌔신', icon: 80, col: '#c9a8ff', unit: 15, lines: ['궁극기 「처형」 — 가장 튼튼한 적 여섯을 벤다', '마법전사가 되어 근접 「그림자 검술」로 싸운다', '칼 스킬이 검술 6종으로 바뀐다 (단계 이어받음)', '받는 피해 −10% · 처치마다 체력 조금 회복'] }
  };
  /* 궁극기 (2026-11-19 사용자 안: "각 전직마다 대표되는 궁극기를 하나씩"): 전직하면 궁극기 칸(축지법 칸 왼쪽)에 그 전직의 궁극기가 들어온다. 직접 누르는 스킬은 축지법과 이것 둘뿐 — 나머지는 전부 자동.
     이름은 붉은보석 도둑의 전직별 상위 스킬에서. 대기 ULT.cd 초(전문 도구 패시브가 줄인다), 준비되면 칸이 금빛으로 맥박친다 */
  var ULT = { cd: q('ultcd', 30),
    venom: { name: '다팅 퓨리', icon: 54, sec: 2, gap: 0.2, r: 300, mul: 0.9, max: 40,
      desc: function () { return '2초 동안 돌면서 화면 안의 적 모두를 단검으로 10번 연타합니다 (한 번에 피해 90%). 맞은 적은 피를 흘립니다.'; } },
    trapper: { name: '독무', icon: 92, r: 120, sec: 8, mul: 2, v: 0.16, traps: 6, ring: 70, lv: 3,
      desc: function () { return '도둑 둘레에 큰 독 구름이 8초 동안 깔립니다 (초당 피해 200%, 안의 적은 느려지고 받는 피해 +16%). 구름 안에 폭발 함정 여섯 개가 한꺼번에 놓입니다.'; } },
    shadow: { name: '처형', icon: 41, n: 6, r: 320, gap: 0.12, mul: 12, kill: 0.3,
      desc: function () { return '가장 튼튼한 적 여섯을 순식간에 차례로 벱니다 (피해 1200%). 체력 30% 이하인 적은 즉사합니다(우두머리 제외). 베는 동안 무적입니다.'; } } };
  var GROW = { chest: { p: [0.5, 0.35], heal: 0.3 }, pasMax: 4, ultPow: 1.5, ultCd: 0.75, item: { meat: 0.012, magnet: 0.008, bomb: 0.005, max: 10, life: 40, heal: 0.3, bombR: 330, bombMul: 10 }, classLv: q('classlv', 7), clsUnit: 56, clsHp: 50, pickup: 64, gemSpeed: 330, hpLv: 6, heal: 30, trapR: 16, trapRx: 1.7, critMax: 0.6, xpk: q('xpk', 0.6), need: function (lv) { return Math.max(2, Math.round((3 + lv * 2 + lv * lv * 0.12) * this.xpk)); }   /* 다음 레벨까지: 뒤로 갈수록 가파르게 (2026-11-19 사용자 요청 "레벨 올리기 조금 더 어렵게"). xpk = 곡선 배수 — 285번 공격력 너프(×0.47) 뒤 "경험치 곡선 완화"로 0.5 (레벨 10 에 18, 20 에 46, 30 에 86) */ };
  SurvivalGame.SK = SK; SurvivalGame.CLS = CLS; SurvivalGame.GROW = GROW; SurvivalGame.ULT = ULT;

  P._growReset = function () {
    var self = this, D = this.D;
    this.lv = 1; this.exp = 0; this.expNeed = GROW.need(1); this.pend = 0; this.cards = null; this.cardT = 0; this.cls = null;
    this.sk = { dagger: 1, blink: 1 }; this.order = ['dagger']; this.tm = {}; this.traps = []; this.zones = []; this.gems = []; this.queue = [];
    this.stealthUntil = 0; this.hide = null; this.hideT = 0; this.lastDir = [1, 0]; this.lastDown = null; this.fire = {}; this.press = null; this.info = null; this.infoT = 0;
    this.ult = null;   // (281번의 "고급 스킬을 궁극기 칸에 올리기"는 뺐다 — 궁극기는 전직이 준다. this.ult 는 늘 null)
    this.items = []; this.fans = []; this.flashT = -9; this.awkSeen = {}; this.slashes = []; this.arcs = []; this.ghosts = []; this.puffs = []; this.bladeOn = false;
    Object.keys(SK).forEach(function (k) { var s = SK[k]; [s.arm, s.boom, s.fx].forEach(function (a) { var d = a != null && D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); }); });
    [3, 38].forEach(function (a) { var d = D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); });
    var pre = /[?&]sk=([a-z,]+)/.exec(root.location.search); if (pre) pre[1].split(',').forEach(function (k) { if (SK[k]) { if (!self.sk[k] && SK[k].slot) self.order.push(k); self.sk[k] = q('sklv', 3); } });   // ?sk=fever,explo&sklv=5 : 시험용
    var pc0 = /[?&]cls=([a-z]+)/.exec(root.location.search); if (pc0 && CLS[pc0[1]]) { if (this._has(CLS[pc0[1]].unit || GROW.clsUnit)) this._promote(pc0[1]); else { this.cls = pc0[1]; if (this.cls === 'shadow') this._toBlade(); } }
  };
  /* 전직: 갈래를 정하고 도둑 → 대도로 모습이 바뀐다 (2026-11-19 사용자 요청). 공격력·방어력·걷는 속도·기본 공격(단도 던지기)은 원작 대도의 것, 최대 체력은 GROW.clsHp 만큼만 더한다(원작 차이 +130 을 다 주면 너무 단단하다) */
  P._promote = function (cls) {
    var D = this.D, h = this.hero, T2 = D.types[CLS[cls].unit || GROW.clsUnit]; this.cls = cls; if (cls !== 'shadow' && this.sk.fever) { this.pend += this.sk.fever; delete this.sk.fever; this.order = this.order.filter(function (k) { return k !== 'fever'; }); this._text(h.x, h.y - h.headY - 40, '다팅 피버 → 카드 +' + this.pend, '#9cc0ff'); }   // 2026-11-19 사용자 "전직 후에 다팅 피버는 제거" (어쌔신은 검술로 바뀐다)
    if (cls === 'shadow') this._toBlade(); if (cls === 'trapper') { if (!this.sk.toxdag) this.sk.toxdag = 1; if (!this.sk.bombdag) this.sk.bombdag = 1; } if (!T2 || h.t === T2) return;
    if (this.tm.ult == null) this.tm.ult = 4;
    var sp0 = this.speed, mh = h.maxHp + GROW.clsHp, hp = h.hp + GROW.clsHp; h.setType(T2); D._applyType(h); h.maxHp = mh; h.hp = Math.min(mh, hp); this.speed = h.speedPx * CFG.SPEED;
    if (cls === 'trapper') { var gk = 'u' + T2.id + 'g'; if (!D.assets.img[gk]) D.assets.img[gk] = recolor(D.assets.get('u' + T2.id), 240, 330, -165); h.imgKey = gk; }   // 트래퍼: 대도의 포인트색(보라)만 녹색으로 (2026-11-19 사용자 "전체가 녹색이 아니라 포인트색만 녹색으로" — 전에는 그림 전체에 녹색을 덮었다)
    if (cls === 'shadow') { this.speed = Math.max(this.speed, sp0); h.act = Object.assign({}, h.act, { k1: 8, arm: -5 }); }   // 마법전사: 걸음은 느리므로 전직 전 속도를 지키고, 공격값의 레벨 계수(원작 16)는 다른 갈래와 같은 8 로(아니면 후반에 두 배로 세진다). arm −5 = 베기 타격 표시용 (−1 은 폭발·출혈과 겹친다)
    this._fx(h.x, h.y - 8, 3); this.ringT = D.time; this.ringN = 12; this.ringA = 0;
    this.tm.ult = 4; this.banner = { s: '궁극기 「' + ULT[cls].name + '」 — 오른쪽 아래 칸', t0: D.time + 0.8, col: CLS[cls].col };
  };
  P._lvOf = function (k) { return this.sk[k] || 0; };
  P._evo = function (k) { var e = SK[k].evo; return !!(e && this.cls === e.cls); };
  P._name = function (k) { return this._evo(k) ? SK[k].evo.name : SK[k].name; };
  P._pv = function (k) { var l = this.sk[k]; return l ? SK[k].v(l) : 0; };   // 패시브 값 (없으면 0)
  P._awk = function (k) { var a = SK[k].awk; return !!(a && this.sk[k] >= 5 && this.sk[a.pas]); };
  P._base = function () { return this.D.rules.attackValue(this.hero) * (1 + this._pv('power')); };
  P._text = function (x, y, s, col) { this.texts.push({ x: x, y: y, s: s, t0: this.D.time, col: col }); };
  /* 경험치 */
  P._loot = function (u) { var IT = GROW.item, r = this.D.rng.next(), k = u.boss && !u.mini ? 'meat' : r < IT.meat ? 'meat' : r < IT.meat + IT.magnet ? 'magnet' : r < IT.meat + IT.magnet + IT.bomb ? 'bomb' : null; if (!k || (this.items.length >= IT.max && !(u.boss && !u.mini))) return; this.items.push({ k: k, x: u.x + 14, y: u.y, t0: this.D.time }); if (u.boss && !u.mini) this.items.push({ k: 'chest', x: u.x - 14, y: u.y, t0: this.D.time }); };   // 큰 우두머리: 회복 아이템 + 보물상자
  P._drop = function (u) { if (u.rush || u.noDrop) return;   // 돌진하는 떼는 경험치·아이템을 주지 않는다 (줄지어 와서 범위 스킬에 쓸리면 경험치 덩어리가 됐다 — README 282)
    this._loot(u); if (this.gems.length > 400) this.gems.shift(); this.gems.push({ x: u.x, y: u.y, v: u.boss ? (u.mini ? CFG.MINI.gem : CFG.BOSS.gem) : Math.max(1, Math.round(u.t.hp / 60)) }); };
  P._gain = function (v) {
    this.exp += v;
    while (this.exp >= this.expNeed) { this.exp -= this.expNeed; this.lv++; this.expNeed = GROW.need(this.lv); this.pend++; var h = this.hero; h.level = this.lv; h.maxHp += GROW.hpLv; h.hp = Math.min(h.maxHp, h.hp + GROW.hpLv); }
  };
  /* 레벨업 카드 3장 (전직 레벨이면 전직 3갈래) */
  P._roll = function () {
    var self = this, rng = this.D.rng, out = [], pool = [], used = this.order.length, npas = Object.keys(this.sk).filter(function (k) { return SK[k].tree === 'pas'; }).length, hasTrap = ['mouse', 'booby', 'explo'].some(function (k) { return self.sk[k]; });
    if (this.lv >= GROW.classLv && !this.cls) return Object.keys(CLS).map(function (k) { return { cls: k }; });
    Object.keys(SK).forEach(function (k) { var s = SK[k], l = self._lvOf(k); if (l >= 5) return;
      if (s.only && self.cls !== s.only) return; if (k === 'fever' && self.cls) return;   // 다팅 피버는 전직 전에만   // 갈래 전용 (트래퍼의 독 묻힌 단도·폭발 단도)
      if (s.tree === 'blade' ? self.cls !== 'shadow' : (self.cls === 'shadow' && s.tree !== 'pas' && k !== 'blink')) return;   // 그림자 검술은 섀도우만, 섀도우는 칼 스킬이 검술뿐
      if (!l && s.slot && used >= CFG.SLOTS) return; if (!l && s.need === 'trap' && !hasTrap) return; if (!l && s.tree === 'pas' && npas >= GROW.pasMax) return;
      var clsTree = self.cls === 'venom' ? 'throw' : self.cls === 'trapper' ? 'trap' : self.cls === 'shadow' ? 'blade' : null;
      pool.push({ k: k, w: (s.tree === clsTree ? 2 : 1) * (l ? 1.3 : 1) }); });
    while (out.length < 3 && pool.length) { var tw = pool.reduce(function (a, b) { return a + b.w; }, 0), r = rng.next() * tw, i = 0; while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; } out.push({ k: pool[i].k }); pool.splice(i, 1); }
    if (!out.length) out.push({ heal: 1 });
    return out;
  };
  P._pick = function (c) {
    var h = this.hero, self2 = this;
    if (c.cls) { this._promote(c.cls); this._text(h.x, h.y - h.headY - 22, CLS[c.cls].name, CLS[c.cls].col); }
    else if (c.heal) h.hp = Math.min(h.maxHp, h.hp + GROW.heal);
    else { if (!this.sk[c.k] && SK[c.k].slot) this.order.push(c.k); this.sk[c.k] = this._lvOf(c.k) + 1; if (this.tm[c.k] == null) this.tm[c.k] = 0.6; }
    Object.keys(SK).forEach(function (k) { if (self2._awk(k) && !self2.awkSeen[k]) { self2.awkSeen[k] = 1; self2.banner = { s: '각성 — ' + SK[k].awk.name, t0: self2.D.time, col: '#7fe0ff' }; } });
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
      if (c.k) { var wk = null; Object.keys(SK).forEach(function (q2) { var a2 = SK[q2].awk; if (!a2 || self._awk(q2)) return; if ((q2 === c.k && l === 4 && self.sk[a2.pas]) || (a2.pas === c.k && !l && self.sk[q2] >= 5)) wk = a2.name; });   // 이 카드를 고르면 각성이 완성된다
        if (wk) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#7fe0ff'; ctx.fillText('각성 「' + wk + '」', b.x + b.w - 16, b.y + 40); } }
      ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#c9d1e3';
      var lines = c.cls ? CLS[c.cls].lines : D._wrap(c.heal ? '체력을 ' + GROW.heal + ' 회복합니다' : s.desc(l + 1, ev), b.w - 84);
      lines.slice(0, 4).forEach(function (ln, n) { ctx.fillText(ln, b.x + 68, b.y + 48 + n * 17, b.w - 80); }); });
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  /* 스킬 설명 카드 (칸을 꾹 누르면): 이름·단계·지금 효과·다음 단계. 각성 조건. 고급 스킬(SK.man)은 [궁극기 칸에 올리기] — 올리면 자동으로 안 나가고 궁극기 칸을 눌러 쓴다(위력 ×1.5·대기 −25%) */
  P._drawInfo = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, k = this.info.key, isU = k === 'ult', s = isU ? ULT[this.cls] : SK[k], l = isU ? 5 : (this.sk[k] || 1), A = s.awk, akl = A ? D._wrap('각성 「' + A.name + '」 — ' + A.text + '  (조건: 5단계 + ' + SK[A.pas].name + ')', Math.min(W - 24, 350) - 36) : [], ev = !isU && this._evo(k), IC = D.data.fx.icon, icons = D.assets.get('acticons'), pw = Math.min(W - 24, 350), px = Math.round((W - pw) / 2), y;
    ctx.fillStyle = 'rgba(4,6,10,.6)'; ctx.fillRect(0, 0, W, H); ctx.font = '12px sans-serif';
    var cur = D._wrap(s.desc(l, ev), pw - 36), nxt = l < 5 ? D._wrap(s.desc(l + 1, ev), pw - 36) : [], ph = 70 + cur.length * 17 + (nxt.length ? 26 + nxt.length * 17 : 0) + (akl.length ? 10 + akl.length * 17 : 0) + 30, py = Math.round(this.slots[0].y - 44 - ph);
    D._plate(px, py, pw, ph, 7, false); var fi = s.icon * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, px + 16, py + 14, 36, 40);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#ffe9b0'; ctx.fillText(isU ? s.name : this._name(k), px + 62, py + 26);
    var TREE = { 'throw': '투척', trap: '함정', shadow: '암살', blade: '검술', pas: '패시브' }; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#9cc0ff'; ctx.fillText(isU ? '궁극기  ·  대기 ' + Math.round(ULT.cd * (1 - this._pv('haste'))) + '초  ·  ' + CLS[this.cls].name : TREE[s.tree] + '  ·  Lv ' + l + (l >= 5 ? ' (최대)' : ''), px + 62, py + 46);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#dfe6f5'; y = py + 74; cur.forEach(function (ln) { ctx.fillText(ln, px + 18, y); y += 17; });
    if (nxt.length) { y += 8; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#9fe08a'; ctx.fillText('다음 단계', px + 18, y); y += 18; ctx.font = '12px sans-serif'; ctx.fillStyle = '#aab3c7'; nxt.forEach(function (ln) { ctx.fillText(ln, px + 18, y); y += 17; }); }
    if (akl.length) { y += 8; ctx.font = '12px sans-serif'; ctx.fillStyle = this._awk(k) ? '#7fe0ff' : '#7b93a8'; akl.forEach(function (ln) { ctx.fillText(ln, px + 18, y); y += 17; }); }
    this.infoBtns = null;
    ctx.textAlign = 'center'; ctx.font = '11px sans-serif'; ctx.fillStyle = '#7b8397'; ctx.fillText('아무 곳이나 누르면 닫힙니다', W / 2, py + ph - 16); ctx.textAlign = 'left';
  };
  P._infoTap = function (x, y) {
    if (this.infoT < 0.2) return; var k = this.info.key, B = this.infoBtns || [], i;
    this.info = null;
  };
  P._slotAt = function (x, y) { var L = this.hit || [], i; for (i = 0; i < L.length; i++) if (x >= L[i].x - 2 && x <= L[i].x + L[i].w + 2 && y >= L[i].y - 2 && y <= L[i].y + L[i].h + 2) return L[i].key; return null; };
  /* 칸을 짧게 눌렀다: 축지법은 걷던 쪽으로, 수동 스킬은 준비됐으면 발동 */
  P._slotTap = function (k) { if (k === 'blink') this._blink(0, 0); else if (k === 'ult') this._ultFire(); };
  P._cardTap = function (x, y) { if (this.cardT < 0.4) return; for (var i = 0; i < this.cards.length; i++) if (inBox(this.cards[i].box, x, y)) { this._pick(this.cards[i]); return; } };

  /* 피해: 둘레 폭발 · 단검 한 발 */
  P._blast = function (x, y, r, mul, arm) { var F = this.foes, b = this._base() * mul, i; r *= 1 + this._pv('reach'); if (arm != null) this._fx(x, y, arm); for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state !== 'dead' && Math.hypot(u.x - x, u.y - y) <= r) this._hitFoe(u, b, -1); } };
  P._dagger = function (tgt, mul, ox, oy, vx, vy) { var h = this.hero, s = { x: h.x + (ox || 0), y: h.y - h.headY * 0.6 + (oy || 0), vx: vx || 0, vy: vy || 0, tgt: tgt || null, dmg: this._base() * mul, arm: h.act.arm, t0: this.D.time, life: CFG.ATK.life, dg: true };
    if (tgt) { var dx = tgt.x - s.x, dy = tgt.y - s.y, d = Math.hypot(dx, dy) || 1; s.vx = dx / d * CFG.ATK.shot; s.vy = dy / d * CFG.ATK.shot; } this.shots.push(s); return s; };
  /* 여러 번 타격 (더블 드로잉): 맞은 뒤 0.07초 간격으로 같은 적에게 n번 더 */
  P._extra = function (s, u) { if (!s.extra) return; var self = this, T = this.D.time, b = this._base() * s.extra.mul; for (var k = 0; k < s.extra.n; k++) this.queue.push({ at: T + 0.07 * (k + 1), fn: function () { if (u.state !== 'dead') self._hitFoe(u, b * self._onDagger(u), s.arm); } }); };
  /* 단검에 맞았을 때 붙는 효과: 독 단도 · 출혈(베놈 쓰로워) · 암살 */
  P._onDagger = function (u) {
    var T = this.D.time, l;
    if ((l = this._lvOf('poison'))) { u.vulnUntil = T + SK.poison.dur * (1 + this._pv('last')); u.vuln = Math.max(u.vuln || 0, SK.poison.v(l)); }
    if (this.cls === 'venom') { u.bleedUntil = T + 3; u.bleed = this._base() * 0.25; }
    if ((l = this._lvOf('assassin')) && this.D.rng.next() < SK.assassin.p(l) * (this._evo('assassin') ? 1.5 : 1)) { if (u.boss) return 5; this._text(u.x, u.y - u.headY - 4, '암살', '#c9a8ff'); return 1e6; }
    return 1;
  };
  /* 트래퍼: 단검이 맞은 자리의 스플래시 — 독(피해 + 3초 독, 녹색 구름) · 폭발(피해, 폭발 이펙트) */
  P._dagSplash = function (x, y, kind) {
    var self = this, T = this.D.time, F = this.foes, RC = 1 + this._pv('reach'), l, i, u;
    if (kind === 'toxdag' && (l = this.sk.toxdag)) { var tr = SK.toxdag.r(l) * RC, tb = this._base() * SK.toxdag.dmg(l), dot = this._base() * SK.toxdag.dot(l);
      for (i = 0; i < F.length; i++) { u = F[i]; if (u.state !== 'dead' && Math.hypot(u.x - x, u.y - y) <= tr) { u.bleedUntil = T + 3 * (1 + this._pv('last')); u.bleed = Math.max(u.bleed || 0, dot); this._hitFoe(u, tb, -1); } }
      this.puffs.push({ x: x, y: y, r: tr, t0: T }); }
    if (kind === 'bombdag' && (l = this.sk.bombdag)) this._blast(x, y, SK.bombdag.r(l), SK.bombdag.dmg(l), 62);   // 작은 터짐(쥐덫의 것) — 폭발 함정의 큰 불꽃(64)은 단검마다 화면을 덮었다
  };
  /* 그림자 숨기 중 누르기: 누른 자리에서 가장 가까운 적(화면 거리 48 안)을 기습 */
  P._hideTap = function (x, y) {
    var D = this.D, h = this.hero, Z = CFG.ZOOM, wx = h.x + (x - D.W / 2) / Z, wy = h.y + (y - D.H * CFG.HERO_Y) / Z, F = this.foes, best = null, bd = 48 / Z, i;
    for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead') continue; var d = Math.hypot(u.x - wx, u.y - u.headY * 0.5 - wy); if (d < bd) { bd = d; best = u; } }
    if (best) this._ambush(best); return !!best;
  };
  P._ambush = function (u) {
    var D = this.D, h = this.hero, T = D.time, l = this.sk.shadow || 1, dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
    this._fx(h.x, h.y - 8, 3); h.x = u.x + dx / d * 20; h.y = u.y + dy / d * 20; D._faceVec(h, -dx, -dy, true); h.state = 'attack'; h.at = 0;
    var c0 = this.crit; this.crit = 1; this._hitFoe(u, this._base() * SK.shadow.amb(l), h.act.arm, 1.6); this.crit = c0;
    this._fx(u.x, u.y - u.headY * 0.5, SK.surprise.fx); this._text(u.x, u.y - u.headY - 10, '기습!', '#c9a8ff'); D._play(5011, 0.5);
    if (this._awk('shadow')) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2);
    this.invUntil = Math.max(this.invUntil, T + 0.6); this.stealthUntil = 0; this.hide = null;
  };
  P._drawHide = function () {
    var D = this.D, ctx = D.ctx, W = D.W, T = D.time, mk = this.hideMiss && T - this.hideMiss < 0.6;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 13px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = '#000';
    var tx = '숨는 중 — 적을 눌러 기습  ' + Math.max(0, Math.ceil(this.stealthUntil - T)) + '초'; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(T * 5); ctx.strokeText(tx, W / 2, 96); ctx.fillStyle = mk ? '#ff9a8a' : '#d9c4ff'; ctx.fillText(tx, W / 2, 96); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  P._nearest = function (n, range, skip) { var h = this.hero, L = [], F = this.foes, i; for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead' || u === skip) continue; var d = Math.hypot(u.x - h.x, u.y - h.y); if (d <= range) L.push([d, u]); } L.sort(function (a, b) { return a[0] - b[0]; }); return L.slice(0, n).map(function (e) { return e[1]; }); };
  P._blink = function (dx, dy) {
    var D = this.D, h = this.hero, l = this._lvOf('blink'); if (!l || this.tm.blink > 0 || this.over || this.cards) return;
    var d = Math.hypot(dx, dy); if (d < 0.01) { dx = this.lastDir[0]; dy = this.lastDir[1]; d = 1; }
    this._fx(h.x, h.y - 8, 3); h.x += dx / d * SK.blink.dist(l); h.y += dy / d * SK.blink.dist(l); this._fx(h.x, h.y - 8, 3);
    this.invUntil = Math.max(this.invUntil, D.time + 0.4); this.tm.blink = SK.blink.cd(l); D._faceVec(h, dx, dy, true); D._play(5012, 0.5);
    if (this.cls === 'shadow') this._slash(h.x, h.y, 0, true, SK.slash.dmg(this.sk.slash || 1), false, true);   // 섀도우: 도착한 자리에서 둘레 베기 (원거리 적에게 파고드는 길)
  };
  /* ───────── 그림자 검술 (섀도우 인필트레이터) ───────── */
  /* 기본 공격: 베기가 닿는 거리 안에 적이 있으면 그쪽 반원을 벤다 (간격은 단도 던지기와 같은 식) */
  P._bladeAtk = function () {
    var D = this.D, h = this.hero, T = D.time, l = this.sk.slash || 1; if (this.atkCd > 0) return;
    var near = this._nearest(1, SK.slash.r(l) + 14, null)[0]; if (!near) return;
    this.atkCd = Math.max(CFG.ATK.min, CFG.ATK.sec - CFG.ATK.lv * (this.lv - 1)) * SK.slash.sec(l) * (1 - this._pv('haste'));
    var tx = near.x - h.x, ty = near.y - h.y; D._faceVec(h, tx, ty, true); this.aimUntil = T + h.t.anim.atk.n / (D.rules.tps * CFG.ATK.anim) + 0.05; h.state = 'attack'; h.at = 0;
    this._slash(h.x, h.y, Math.atan2(ty, tx), false, SK.slash.dmg(l)); D._play(h.act.snd, 0.3);
  };
  /* 베기 한 번: (x, y) 에서 ang 쪽 반원(full 이면 원). 연속 베기는 맞은 적마다 더 치고, 잔상은 그 자리에서 after 초 뒤 한 번 더 (ghost = 잔상이 벤 것) */
  P._slash = function (x, y, ang, full, mul, ghost, noAfter) {
    var self = this, T = this.D.time, F = this.foes, l = this.sk.slash || 1, r = SK.slash.r(l), wide = full || this._awk('slash'), b = this._base() * mul, xl = this.sk.combo, hitL = [], i;
    for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead') continue; var dx = u.x - x, dy = u.y - y, d = Math.hypot(dx, dy); if (d > r + 8) continue;
      if (!wide && d > 14) { var da = Math.abs(Math.atan2(dy, dx) - ang); if (da > Math.PI) da = 2 * Math.PI - da; if (da > CFG.BLADE.arc) continue; }
      this._bladeHit(u, b); if (xl) hitL.push([d, u]); }
    if (xl) { hitL.sort(function (p, q) { return p[0] - q[0]; }); hitL.slice(0, CFG.BLADE.comboMax).forEach(function (e) { var fu = e[1]; var cb = self._base() * SK.combo.dmg(xl); for (var k = 0; k < SK.combo.n(xl); k++) self.queue.push({ at: T + 0.06 * (k + 1), fn: function () { self._bladeHit(fu, cb); } }); }); }
    this.arcs.push({ x: x, y: y, a: ang, r: r, full: wide, t0: T, ghost: !!ghost });
    if (!ghost && !noAfter && this.sk.after) { var al = this.sk.after, h = this.hero; this.ghosts.push({ x: x, y: y, dir: h.dir, t0: T, until: T + CFG.BLADE.after });
      this.queue.push({ at: T + CFG.BLADE.after, fn: function () { self._slash(x, y, ang, wide, mul * SK.after.p(al), true); } }); }
  };
  P._ring = function (x, y, r, mul) { var F = this.foes, b = this._base() * mul, i; for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state !== 'dead' && Math.hypot(u.x - x, u.y - y) <= r) this._bladeHit(u, b); } this.arcs.push({ x: x, y: y, a: 0, r: r, full: true, t0: this.D.time, ring: true }); };
  /* 그림자 돌진: 곧게 dist 만큼 — 지나간 길(폭 w)의 적 모두를 벤다. 무적 0.35초, 지나간 길에 잔상 셋 */
  P._dash = function (ca, sa, dist, mul) {
    var D = this.D, h = this.hero, T = D.time, F = this.foes, x0 = h.x, y0 = h.y, w = SK.dash.w, b = this._base() * mul, i;
    for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead') continue; var px = u.x - x0, py = u.y - y0, pt = px * ca + py * sa; if (pt >= -10 && pt <= dist + 10 && Math.abs(px * sa - py * ca) <= w) this._bladeHit(u, b); }
    for (i = 1; i <= 3; i++) this.ghosts.push({ x: x0 + ca * dist * i / 4, y: y0 + sa * dist * i / 4, dir: h.dir, t0: T, until: T + 0.18 + i * 0.05 });
    h.x = x0 + ca * dist; h.y = y0 + sa * dist; this.invUntil = Math.max(this.invUntil, T + 0.35); D._faceVec(h, ca, sa, true);
    this.slashes.push({ x0: x0, y0: y0 - 14, x1: h.x, y1: h.y - 14, t0: T }); D._play(5012, 0.5);
  };
  /* 베기 한 대: 피의 칼날(출혈·즉사) · 쓰러뜨리면 체력 회복 */
  P._bladeHit = function (u, dmg) {
    if (u.state === 'dead') return; var T = this.D.time, l = this.sk.blood, mul = 1;
    if (l) { u.bleedUntil = T + 3; u.bleed = this._base() * SK.blood.bleed(l); if (!u.boss && this.D.rng.next() < SK.blood.kill(l)) { this._text(u.x, u.y - u.headY - 4, '절명', '#ff7a9a'); mul = 1e6; } }
    this._hitFoe(u, dmg * mul, this.hero.act.arm);
    if (u.state === 'dead' && !u.healed) { u.healed = 1; var h = this.hero, sec = Math.floor(T); if (this.healSec !== sec) { this.healSec = sec; this.healGot = 0; }   // 처치 회복은 초당 최대 체력의 healCap 까지
      var hv = Math.min(CFG.BLADE.killHeal + (l ? SK.blood.heal(l) * (this._awk('blood') ? 2.5 : 1) : 0), h.maxHp * CFG.BLADE.healCap - this.healGot); if (hv > 0) { this.healGot += hv; h.hp = Math.min(h.maxHp, h.hp + hv); } }
  };
  /* 섀도우로 전직: 칼 스킬(투척·함정·암살)을 그림자 검술로 바꾼다 — 짝이 정해진 것은 그 짝으로, 나머지는 아직 없는 검술 스킬로. 단계는 이어받는다(같은 짝으로 둘이 모이면 높은 쪽) */
  var BLADE_MAP = { dagger: 'slash', 'double': 'combo', scatter: 'whirl', fever: 'whirl', surprise: 'dash', shadow: 'after', assassin: 'blood', poison: 'blood' }, BLADE_LIST = ['slash', 'combo', 'whirl', 'dash', 'after', 'blood'];
  P._toBlade = function () {
    if (this.bladeOn) return; this.bladeOn = true;   // 한 번만 (모습이 늦게 바뀌어 _promote 가 다시 불려도)
    var self = this, nsk = {}, nord = [];
    this.order.forEach(function (k) { var t = BLADE_MAP[k];
      if (!t || nsk[t]) t = BLADE_LIST.filter(function (b) { return !nsk[b] && !self.order.some(function (o) { return o !== k && BLADE_MAP[o] === b && !nsk[b]; }); })[0] || t;   // 짝이 없거나 이미 찼으면 아직 아무도 안 가는 검술 스킬로, 그것도 없으면 짝에 합친다(높은 단계)
      if (t) { nsk[t] = Math.max(nsk[t] || 0, self.sk[k]); if (nord.indexOf(t) < 0) nord.push(t); } delete self.sk[k]; });
    if (!nsk.slash) { nsk.slash = 1; nord.unshift('slash'); }
    Object.keys(nsk).forEach(function (k) { self.sk[k] = Math.min(5, nsk[k]); self.tm[k] = 0.6; }); this.order = nord; this.stealthUntil = 0; this.hide = null; this.traps = []; this.zones = [];
  };
  /* 칼자국(반원·원) · 잔상(옅은 분신) */
  P._drawArcs = function () {
    var D = this.D, ctx = D.ctx, T = D.time, h = this.hero, i;
    if (this.ghosts.length && h.state !== 'dead') { var hx = h.x, hy = h.y, hp = h.hp, hd = h.dir; h.hp = h.maxHp;
      for (i = 0; i < this.ghosts.length; i++) { var g = this.ghosts[i]; ctx.globalAlpha = 0.42 * Math.max(0, (g.until - T) / (g.until - g.t0)); h.x = g.x; h.y = g.y; h.dir = g.dir; D._drawUnit(h); }
      h.x = hx; h.y = hy; h.hp = hp; h.dir = hd; ctx.globalAlpha = 1; }
    for (i = 0; i < this.arcs.length; i++) { var a = this.arcs[i], k = 1 - (T - a.t0) / CFG.BLADE.arcLife, rr = a.r * (0.82 + 0.18 * (1 - k)), al = a.ghost ? 0.55 : 1;
      ctx.save(); ctx.translate(a.x, a.y - 12); ctx.scale(1, 0.62); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      var a0 = a.full ? 0 : a.a - CFG.BLADE.arc, a1 = a.full ? 6.2832 : a.a + CFG.BLADE.arc;
      ctx.strokeStyle = 'rgba(150,90,255,' + (0.7 * k * al).toFixed(3) + ')'; ctx.lineWidth = 14 * k + 2; ctx.beginPath(); ctx.arc(0, 0, rr, a0, a1); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,235,255,' + (0.95 * k * al).toFixed(3) + ')'; ctx.lineWidth = 3 * k + 0.5; ctx.beginPath(); ctx.arc(0, 0, rr + 3, a0 + (a.full ? 0 : 0.25), a1 - (a.full ? 0 : 0.25)); ctx.stroke();
      ctx.restore(); }
  };
  /* 매 프레임: 스킬 타이머 · 덫 · 독 구름 · 경험치 (update 가 부른다. G = 적 격자, near = 사거리 안 가장 가까운 적) */
  P._growStep = function (dt, G, near) {
    var self = this, D = this.D, T = D.time, h = this.hero, F = this.foes, tm = this.tm, l, k, i, ev;
    var due = function (key) { if (!self.sk[key]) return false; tm[key] = (tm[key] == null ? 0.6 : tm[key]) - dt; if (tm[key] > 0) return false;
      if (self.ult === key) { if (!self.fire[key]) { tm[key] = 0; return false; } self.fire[key] = false; }   // 궁극기 칸에 올린 스킬: 준비된 채로 누르기를 기다린다
      return true; };
    if (tm.blink > 0) tm.blink -= dt; if (tm.ult > 0) tm.ult -= dt;
    var HS = 1 - this._pv('haste'), RC = 1 + this._pv('reach'), LS = 1 + this._pv('last');   // 패시브: 대기 배수 · 범위 배수 · 지속 배수
    var CD = function (key, lv) { return SK[key].cd(lv) * HS * (self.ult === key ? GROW.ultCd : 1); }, UP = function (key) { return self.ult === key ? GROW.ultPow : 1; };   // 궁극기 칸: 대기 −25%, 위력 ×1.5
    if (this.hide && T >= this.stealthUntil) this.hide = null;   // 최대 시간이 지나면 저절로 풀린다 (계속 숨어서 버티지 못하게)
    var rg = this._pv('regen'); if (rg && h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + rg * dt);
    // 시차를 두고 나가는 것들 (다팅 피버의 둘째·셋째 파, 연폭 함정)
    var Q0 = this.queue, keep = []; this.queue = []; Q0.forEach(function (qu) { if (T < qu.at) keep.push(qu); else qu.fn(); }); this.queue = keep.concat(this.queue);   // 실행 중에 새로 넣은 것(다팅 피버의 타격들)을 잃지 않게 — 전에는 filter 가 돌려준 새 배열로 덮어써서 사라졌다
    if (due('scatter')) { l = this.sk.scatter; ev = this._evo('scatter'); var SC = SK.scatter, sn = this._nearest(1, CFG.ATK.range, null)[0];   // 단도 흩뿌리기: 가장 가까운 적 쪽 부채꼴 안의 적에게 (먼 적일수록 약하게 — 단계가 오르면 같아진다)
      if (sn) { tm.scatter = CD('scatter', l); var sa = Math.atan2(sn.y - h.y, sn.x - h.x), half = SC.ang(l) * 0.008727, fr = SC.far(l), sd = SC.dmg(l), sides = ev ? [sa, sa + Math.PI] : [sa];
        sides.forEach(function (a0) { var m = SC.m(l), vol = { hit: {}, left: SC.n(l) }, fi;
          for (fi = 0; fi < m; fi++) { var ra = a0 - half + (fi + 0.5) * (2 * half / m), sh = self._dagger(null, sd, 0, 0, Math.cos(ra) * CFG.ATK.shot, Math.sin(ra) * CFG.ATK.shot); sh.vol = vol; sh.far = fr; sh.x0 = h.x; sh.y0 = h.y; sh.wk = Math.tan(half / m); sh.life = CFG.ATK.range / CFG.ATK.shot; }
          self.fans.push({ a: a0, half: half, t0: T }); }); } else tm.scatter = 0.3; }
    if (due('fever')) { l = this.sk.fever; ev = this._evo('fever'); if (near || this._nearest(1, CFG.ATK.range * 1.3, null).length) { tm.fever = CD('fever', l);
        var cnt = SK.fever.n(l), frange = CFG.ATK.range * 1.4 * RC * (this._awk('fever') ? 1.3 : 1), waves = SK.fever.w(l) + (ev ? 1 : 0), mul = SK.fever.dmg(l) * (ev ? 1.3 : 1) * UP('fever'), fa = this._awk('fever'); if (fa) cnt += 4; this.feverT0 = T; this.feverUntil = T + (waves - 1) * 0.22 + 0.2;   // 그동안 도둑이 제자리에서 돌며 던진다 (update)
        for (k = 0; k < waves; k++) (function (wi) { self.queue.push({ at: T + wi * 0.22, fn: function () {   // 날아가는 단검은 보이지 않는다 (2026-11-19 사용자 요청 — 붉은보석처럼): 둘레의 적들이 거의 동시에 맞고, 맞는 자리의 섬광을 크게
              var tg = self._nearest(cnt, frange, null), hits = Math.min(cnt, tg.length * 2), a;   // 적이 단검 수보다 적으면 한 적에게 두 발까지
              for (a = 0; a < hits; a++) (function (u, k) { self.queue.push({ at: self.D.time + k * 0.014, fn: function () { if (u.state !== 'dead') self._hitFoe(u, self._base() * mul * self._onDagger(u), self.hero.act.arm, 1.7); } }); })(tg[a % tg.length], a);
              self.ringT = self.D.time; self.ringN = cnt; self.ringA = wi * 0.5 / cnt * 6.2832; D._play(self.hero.act.snd, 0.4); } }); })(k); } else tm.fever = 0.3; }
    // 트래퍼 주력: 독 묻힌 단도 · 폭발 단도 — 대기마다 가까운 적에게 그 단검을 던진다 (2026-11-19 사용자 "패시브가 아닌 쿨타임 존재" — 전에는 모든 단검이 맞을 때마다 터졌다)
    ['toxdag', 'bombdag'].forEach(function (key) { if (!due(key)) return; var lv = self.sk[key], tg = self._nearest(SK[key].n(lv), CFG.ATK.range, null);
      if (!tg.length) { tm[key] = 0.3; return; } tm[key] = CD(key, lv); tg.forEach(function (u) { self._dagger(u, 1).spl = key; }); D._play(self.hero.act.snd, 0.35); });
    // 그림자 검술: 회오리 베기 · 그림자 돌진
    if (due('whirl')) { l = this.sk.whirl; var wr = SK.whirl.r * (this._awk('whirl') ? 1.5 : 1), wm = SK.whirl.dmg(l), wn = SK.whirl.w(l);
      if (this._nearest(1, wr, null).length) { tm.whirl = CD('whirl', l); this.feverT0 = T; this.feverUntil = T + wn * 0.13 + 0.05;   // 도는 자세는 다팅 피버의 것을 빌린다
        for (k = 0; k < wn; k++) this.queue.push({ at: T + k * 0.13, fn: function () { var hh = self.hero; self._ring(hh.x, hh.y, wr, wm); D._play(hh.act.snd, 0.35); } }); } else tm.whirl = 0.3; }
    if (due('dash')) { l = this.sk.dash; var dd = SK.dash.dist(l), dm = SK.dash.dmg(l), dw = SK.dash.w, best = null, bc = 0, di, dc;
      for (di = 0; di < 16; di++) { var ca = Math.cos(di * 0.3927), sa = Math.sin(di * 0.3927); dc = 0; for (i = 0; i < F.length; i++) { var fu = F[i]; if (fu.state === 'dead') continue; var px = fu.x - h.x, py = fu.y - h.y, pt = px * ca + py * sa; if (pt >= 0 && pt <= dd && Math.abs(px * sa - py * ca) <= dw) dc++; } if (dc > bc) { bc = dc; best = [ca, sa]; } }
      if (best && bc >= 2) { tm.dash = CD('dash', l); this._dash(best[0], best[1], dd, dm); if (this._awk('dash')) this.queue.push({ at: T + 0.3, fn: function () { self._dash(-best[0], -best[1], dd, dm); } }); } else tm.dash = 0.4; }
    // 덫 놓기
    ['mouse', 'booby', 'explo'].forEach(function (key) { if (!due(key)) return; var s = SK[key], lv = self.sk[key]; tm[key] = s.cd(lv) * HS;
      var mine = self.traps.filter(function (t) { return t.k === key; }); if (mine.length >= (key === 'mouse' && self._awk('mouse') ? 14 : s.max)) self.traps.splice(self.traps.indexOf(mine[0]), 1);
      self.traps.push({ k: key, x: h.x, y: h.y, t0: T }); });
    // 덫 밟기
    var TR = GROW.trapR * (this.cls === 'trapper' ? GROW.trapRx : 1) * RC;
    this.traps = this.traps.filter(function (t) { if (T - t.t0 < 0.5) return true;
      var cx = Math.floor(t.x / 32), cy = Math.floor(t.y / 32), a, b, j, hit = null;
      for (a = cx - 1; a <= cx + 1 && !hit; a++) for (b = cy - 1; b <= cy + 1 && !hit; b++) { var Lc = G[a + ',' + b]; if (Lc) for (j = 0; j < Lc.length; j++) if (Lc[j].state !== 'dead' && Math.hypot(Lc[j].x - t.x, Lc[j].y - t.y) <= TR) { hit = Lc[j]; break; } }
      if (!hit) return true; self._spring(t, hit); return false; });
    if (due('simul')) { l = this.sk.simul; if (this.traps.length) { tm.simul = CD('simul', l); var reps = this.cls === 'trapper' ? 2 : 1, sup = UP('simul'); this.traps.forEach(function (t, j) { for (k = 0; k < reps; k++) (function (kk) { self.queue.push({ at: T + j * 0.05 + kk * 0.3, fn: function () { self._blast(t.x, t.y, SK.simul.r, SK.simul.dmg(l) * sup, SK.simul.boom); } }); })(k); }); this.traps = []; D._play(5064, 0.6); } else tm.simul = 0.5; }
    if (due('gas')) { l = this.sk.gas; ev = this._evo('gas'); var gt = this._nearest(1, CFG.ATK.range * 1.2, null)[0]; if (gt) { tm.gas = CD('gas', l); this.zones.push({ x: gt.x, y: gt.y, r: SK.gas.r * (ev ? 1.5 : 1) * RC, until: T + (ev ? 6 : SK.gas.dur) * LS, next: T, mul: SK.gas.dmg(l) * UP('gas'), v: ev ? 0.16 : SK.gas.v, t0: T, follow: this._awk('gas') }); D._play(5092, 0.5); } else tm.gas = 0.4; }
    this.zones = this.zones.filter(function (z) { if (T >= z.until) return false; if (z.follow) { z.x += (h.x - z.x) * Math.min(1, dt * 4); z.y += (h.y - z.y) * Math.min(1, dt * 4); }   // 역병 지대(각성): 도둑을 따라온다
      if (T >= z.next) { z.next = T + 0.5; var b = self._base() * z.mul * 0.5; for (var j = 0; j < F.length; j++) { var u = F[j]; if (u.state !== 'dead' && Math.hypot(u.x - z.x, u.y - z.y) <= z.r) { u.vulnUntil = T + 1; u.vuln = Math.max(u.vuln || 0, z.v); if (z.slow) u.slowUntil = T + 1; self._hitFoe(u, b, -1); } } } return true; });
    if (due('surprise')) { l = this.sk.surprise; ev = this._evo('surprise'); var sr = SK.surprise.range * (ev ? 1.4 : 1), cand = F.filter(function (u) { return u.state !== 'dead' && Math.hypot(u.x - h.x, u.y - h.y) <= sr; }).sort(function (a, b) { return b.life - a.life; }).slice(0, this._awk('surprise') ? 3 : 1);
      if (cand.length) { tm.surprise = CD('surprise', l); D._play(h.act.snd, 0.6); var sdm = this._base() * SK.surprise.dmg(l) * UP('surprise');
        cand.forEach(function (best, bi) { self._fx(best.x, best.y - best.headY * 0.5, SK.surprise.fx); if (!bi) self._text(best.x, best.y - best.headY - 16, self._name('surprise'), '#c9a8ff');
          if (ev) for (var si = 0; si < F.length; si++) if (F[si].state !== 'dead' && Math.hypot(F[si].x - best.x, F[si].y - best.y) <= 55 * RC) F[si].stunUntil = T + 2;
          self._hitFoe(best, sdm, -1); }); } else tm.surprise = 0.4; }
    if (due('shadow') && !this._nearest(1, 260, null).length) tm.shadow = 0.5;   // 둘레에 누를 적이 없으면 미룬다 (숨으면 적을 눌러야 풀린다)
    else if (tm.shadow <= 0 && this.sk.shadow) { l = this.sk.shadow; tm.shadow = CD('shadow', l); this.hideK = (this.hideK || 0) + 1; this.hideX = h.x; this.hideY = h.y; this.stealthUntil = T + SK.shadow.dur(l) * LS; this.hide = { t0: T }; this._text(h.x, h.y - h.headY - 22, this._name('shadow'), '#c9a8ff'); D._play(5011, 0.5); }
    // 치명타 확률: 기본 + 그림자 숨기(숨은 동안) + 코인시던스 드로잉
    this.crit = Math.min(GROW.critMax, CFG.CRIT.p + (T < this.stealthUntil ? SK.shadow.crit(this.sk.shadow || 1) : 0) + (this.sk.double && this._evo('double') ? 0.05 : 0));
    // 경험치 보석: 범위 안이면 끌려온다
    var pr = GROW.pickup * ((l = this._lvOf('pick')) ? SK.pick.v(l) : 1);
    this.gems = this.gems.filter(function (g) { var dx = h.x - g.x, dy = h.y - 12 - g.y, d = Math.hypot(dx, dy) || 1; if (g.pull || d <= pr) { g.pull = true; var st = GROW.gemSpeed * dt; if (d <= st + 8) { self._gain(g.v); return false; } g.x += dx / d * st; g.y += dy / d * st; } return true; });
    // 필드 아이템: 닿으면 바로 쓴다 — 고기(체력 30%) · 자석(화면의 경험치 전부) · 폭탄(둘레의 적 모두에게 큰 피해)
    var IT = GROW.item, I0 = this.items; this.items = []; I0 = I0.filter(function (it) {   // 줍는 동안 생긴 아이템(폭탄에 쓰러진 적의 드롭 — 우두머리 상자 포함)은 새 배열에 쌓였다가 아래에서 합친다. 전에는 걸러 낸 배열로 덮어써 사라졌다 if (T - it.t0 > IT.life && it.k !== 'chest') return false; if (Math.hypot(h.x - it.x, h.y - 10 - it.y) > 26) return true;
      if (it.k === 'meat') { var hv = Math.round(h.maxHp * IT.heal); h.hp = Math.min(h.maxHp, h.hp + hv); self._text(h.x, h.y - h.headY - 16, '+' + hv, '#9fe08a'); }
      else if (it.k === 'chest') self._chest();
      else if (it.k === 'magnet') { self.gems.forEach(function (g) { g.pull = true; }); self._text(h.x, h.y - h.headY - 16, '경험치 흡수', '#7fe0ff'); }
      else { var bb = self._base() * IT.bombMul; F.forEach(function (u) { if (u.state !== 'dead' && Math.hypot(u.x - h.x, u.y - h.y) <= IT.bombR) self._hitFoe(u, bb, -1); }); self.flashT = T; self._fx(h.x, h.y - 10, SK.explo.boom); D._play(5064, 0.8); self._text(h.x, h.y - h.headY - 16, '폭탄!', '#ffb86a'); }
      if (D._raceSnd) D._raceSnd('click'); return false; }); this.items = I0.concat(this.items);
    if (this.pend > 0 && !this.cards) { this.cards = this._roll(); this.cardT = 0; this.stick = null; this.keys = {}; }
  };
  /* 궁극기 발동 (궁극기 칸을 누르거나 E 키) */
  P._ultFire = function () {
    var self = this, D = this.D, T = D.time, h = this.hero, F = this.foes, U = ULT[this.cls], k; if (!U || this.tm.ult > 0 || this.over || this.cards || this.info) return;
    this.tm.ult = ULT.cd * (1 - this._pv('haste')); this._text(h.x, h.y - h.headY - 24, U.name, CLS[this.cls].col); this.flashT = T - 0.18; D._play(5064, 0.7);
    if (this.cls === 'venom') { this.feverT0 = T; this.feverUntil = T + U.sec;   // 다팅 퓨리: 도는 던지기 자세로 화면의 적 모두를 연타
      for (k = 0; k < Math.round(U.sec / U.gap); k++) (function (wi) { self.queue.push({ at: T + wi * U.gap, fn: function () { var tg = self._nearest(U.max, U.r, null), b = self._base() * U.mul;
        tg.forEach(function (u, j) { self.queue.push({ at: self.D.time + (j % 8) * 0.012, fn: function () { if (u.state !== 'dead') self._hitFoe(u, b * self._onDagger(u), self.hero.act.arm, 1.4); } }); });
        self.ringT = self.D.time; self.ringN = 12; self.ringA = wi * 0.26; D._play(self.hero.act.snd, 0.35); } }); })(k); }
    else if (this.cls === 'trapper') { var RC = 1 + this._pv('reach'), LS = 1 + this._pv('last');   // 독무: 큰 독 구름 + 폭발 함정 여섯
      this.zones.push({ x: h.x, y: h.y, r: U.r * RC, until: T + U.sec * LS, next: T, mul: U.mul, v: U.v, t0: T, slow: true });
      for (k = 0; k < U.traps; k++) this.traps.push({ k: 'explo', x: h.x + Math.cos(k / U.traps * 6.2832) * U.ring, y: h.y + Math.sin(k / U.traps * 6.2832) * U.ring * 0.7, t0: T - 0.3, lv: Math.max(U.lv, this.sk.explo || 0) });
      D._play(5092, 0.7); }
    else { var tg = F.filter(function (u) { return u.state !== 'dead' && Math.hypot(u.x - h.x, u.y - h.y) <= U.r; }).sort(function (a, b) { return b.life - a.life; }).slice(0, U.n), px = h.x, py = h.y - h.headY * 0.5;   // 처형: 가장 튼튼한 적들을 차례로 벤다 (도둑은 제자리 — 보라색 칼자국만 적들 사이를 오간다)
      this.invUntil = Math.max(this.invUntil, T + tg.length * U.gap + 0.4); this.feverT0 = T; this.feverUntil = T + tg.length * U.gap;
      tg.forEach(function (u, j) { var fx = px, fy = py; px = u.x; py = u.y - u.headY * 0.5; var tx = px, ty = py;
        self.queue.push({ at: T + j * U.gap, fn: function () { self.slashes.push({ x0: fx, y0: fy, x1: tx, y1: ty, t0: self.D.time }); if (u.state === 'dead') return;
          var kill = !u.boss && u.life <= u.life0 * U.kill; if (kill) self._text(u.x, u.y - u.headY - 6, '처형', '#c9a8ff'); self._fx(u.x, u.y - u.headY * 0.5, SK.surprise.fx);
          self._hitFoe(u, kill ? 1e6 : self._base() * U.mul, self.hero.act.arm, 1.8); D._play(self.hero.act.snd, 0.5); } }); }); }
  };
  /* 덫이 터진다 */
  P._spring = function (t, u) {
    var self = this, D = this.D, T = D.time, s = SK[t.k], l = Math.max(t.lv || 0, this.sk[t.k] || 1), ev = this._evo(t.k), F = this.foes, i;
    var RC = 1 + this._pv('reach'), LS = 1 + this._pv('last');
    if (t.k === 'mouse') { this._fx(t.x, t.y - 6, s.boom); u.slowUntil = T + s.slowSec * LS; if (this._awk('mouse')) u.rootUntil = T + 1.5 * LS; this._hitFoe(u, this._base() * s.dmg(l), -1); }
    else if (t.k === 'booby') { var L = ev ? F.filter(function (o) { return o.state !== 'dead' && Math.hypot(o.x - t.x, o.y - t.y) <= 55 * RC; }) : [u]; this._fx(t.x, t.y - 6, s.boom);
      L.forEach(function (o) { o.rootUntil = T + s.root(l) * LS; self._hitFoe(o, self._base() * s.dmg(l) * (ev ? 2 : 1), -1); }); }
    else if (t.k === 'explo') { var n = ev ? 3 : 1; for (i = 0; i < n; i++) (function (k) { self.queue.push({ at: T + k * 0.28, fn: function () { self._blast(t.x, t.y, s.r * (self._awk('explo') ? 1.5 : 1), s.dmg(l), s.boom); D._play(5064, 0.5); } }); })(i); }
  };
  /* 전장 층(유닛 아래): 독 구름 · 덫 · 경험치 보석 */
  P._drawGround = function () {
    var D = this.D, ctx = D.ctx, T = D.time, i;
    this.fans = this.fans.filter(function (f) { return T - f.t0 < 0.22; }); for (i = 0; i < this.fans.length; i++) { var fn = this.fans[i], fk = 1 - (T - fn.t0) / 0.22;   // 단도 흩뿌리기: 던진 쪽 부채꼴을 바닥에 아주 잠깐·옅게 (어디를 쳤는지만)
      ctx.fillStyle = 'rgba(255,240,200,' + (0.10 * fk).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(this.hero.x, this.hero.y); ctx.arc(this.hero.x, this.hero.y, CFG.ATK.range, fn.a - fn.half, fn.a + fn.half); ctx.closePath(); ctx.fill(); }
    var SW = this.siegeWarn; if (SW) { var gk = (T - SW.t0) / CFG.SIEGE.warn;   // 포위 예고: 적이 나타날 자리(도둑 둘레)에 붉은 점선 고리 — 가늘게, 전장을 덮지 않는다
      ctx.strokeStyle = 'rgba(255,80,50,' + (0.5 + 0.4 * gk).toFixed(3) + ')'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 9]); ctx.lineDashOffset = -T * 50; ctx.beginPath(); ctx.ellipse(this.hero.x, this.hero.y, CFG.SIEGE.rx, CFG.SIEGE.ry, 0, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    for (i = 0; i < this.foes.length; i++) { var fu = this.foes[i]; if (fu.state === 'dead') continue;
      if (fu.sup) { var FS = CFG.SUP[fu.sup], ck = fu.castT != null ? Math.max(0, 1 - (T - fu.castT) / 0.6) : 0;   // 치유형(녹색)·소환형(보라): 발밑 고리, 시전할 때 잠깐 퍼진다
        ctx.strokeStyle = 'rgba(' + FS.col + ',' + (0.55 + 0.35 * ck).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, 15, 7, 0, 0, 6.2832); ctx.stroke();
        if (ck > 0 && fu.sup === 'heal') { ctx.strokeStyle = 'rgba(' + FS.col + ',' + (0.4 * ck).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, FS.r * (1 - ck * 0.6), FS.r * 0.5 * (1 - ck * 0.6), 0, 0, 6.2832); ctx.stroke(); } }
      else if (fu.healT != null && T - fu.healT < 0.5) { var hk = (T - fu.healT) / 0.5; ctx.fillStyle = 'rgba(127,227,106,' + (1 - hk).toFixed(2) + ')'; ctx.fillRect(fu.x - 1, fu.y - fu.headY - 9 - hk * 8, 2, 7); ctx.fillRect(fu.x - 3.5, fu.y - fu.headY - 6.5 - hk * 8, 7, 2); } }   // 회복받은 적 머리 위 작은 녹색 십자
    var RW = this.rushWarn; if (RW) { var wk = (T - RW.t0) / CFG.RUSH.warn, B = CFG.RUSH.band;   // 돌진 예고: 떼가 지나갈 길을 붉게 (예고가 끝날수록 짙어진다)
      ctx.save(); ctx.translate(RW.x, RW.y); ctx.rotate(RW.a); ctx.fillStyle = 'rgba(255,60,40,' + (0.07 + 0.11 * wk + 0.04 * Math.sin(T * 14)).toFixed(3) + ')'; ctx.fillRect(-900, -B / 2, 1800, B);
      ctx.strokeStyle = 'rgba(255,90,60,' + (0.35 + 0.3 * wk).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -T * 60; ctx.beginPath(); ctx.moveTo(-900, -B / 2); ctx.lineTo(900, -B / 2); ctx.moveTo(-900, B / 2); ctx.lineTo(900, B / 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,110,80,' + (0.3 + 0.3 * wk).toFixed(3) + ')'; for (i = -5; i <= 5; i++) { var ax = i * 70 + ((T * 90) % 70); ctx.beginPath(); ctx.moveTo(ax + 12, 0); ctx.lineTo(ax - 8, -12); ctx.lineTo(ax - 2, 0); ctx.lineTo(ax - 8, 12); ctx.closePath(); ctx.fill(); }   // 달려갈 방향의 화살표
      ctx.restore(); }
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
    for (i = 0; i < this.items.length; i++) { var it = this.items[i], iy = it.y - 9 + Math.sin(T * 3 + it.x) * 2, left = GROW.item.life - (T - it.t0), col = it.k === 'meat' ? '#8fe07a' : it.k === 'magnet' ? '#6fd0ff' : it.k === 'chest' ? '#ffd36e' : '#ff9a4a';   // 필드 아이템: 빛나는 원판 + 기호 (끝나기 5초 전부터 깜빡인다)
      if (left < 5 && it.k !== 'chest' && Math.floor(T * 6) % 2) continue;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 2, 9, 3.5, 0, 0, 6.3); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var ig = ctx.createRadialGradient(it.x, iy, 2, it.x, iy, 16); ig.addColorStop(0, col); ig.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 5); ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(it.x, iy, 16, 0, 6.3); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#10131c'; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, iy, 9, 0, 6.3); ctx.fill(); ctx.stroke(); ctx.fillStyle = col; ctx.strokeStyle = col;
      if (it.k === 'meat') { ctx.fillRect(it.x - 1.5, iy - 5, 3, 10); ctx.fillRect(it.x - 5, iy - 1.5, 10, 3); }                       // 회복: 십자
      else if (it.k === 'chest') { ctx.fillRect(it.x - 5.5, iy - 1, 11, 5.5); ctx.fillRect(it.x - 5.5, iy - 5, 11, 3); ctx.fillStyle = '#10131c'; ctx.fillRect(it.x - 1, iy - 2.5, 2, 3.5); }   // 보물상자: 뚜껑 + 몸통 + 자물쇠
      else if (it.k === 'magnet') { ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(it.x, iy - 0.5, 4, Math.PI, 0); ctx.moveTo(it.x - 4, iy - 0.5); ctx.lineTo(it.x - 4, iy + 4.5); ctx.moveTo(it.x + 4, iy - 0.5); ctx.lineTo(it.x + 4, iy + 4.5); ctx.stroke(); }   // 자석: U
      else { ctx.beginPath(); ctx.arc(it.x - 0.5, iy + 1, 4.2, 0, 6.3); ctx.fill(); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(it.x + 2, iy - 2.5); ctx.lineTo(it.x + 4.5, iy - 5.5); ctx.stroke(); ctx.fillStyle = '#fff3a0'; ctx.fillRect(it.x + 4, iy - 7, 2, 2); } }   // 폭탄: 공 + 심지
    if (T < this.stealthUntil) { var h = this.hero; ctx.fillStyle = 'rgba(120,80,200,' + (0.35 + 0.15 * Math.sin(T * 8)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 22, 9, 0, 0, 6.3); ctx.fill(); }
  };

  MWE.SurvivalGame = SurvivalGame;
})(typeof window !== 'undefined' ? window : globalThis);
