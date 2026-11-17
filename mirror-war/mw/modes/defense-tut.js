/* 거울전쟁 디펜스 — 입문자 가이드 (2026-11-17 사용자 요청, README 204·205)
   1단계(해골 들판)를 처음 고를 때 한 번만 나온다. 하이라이트된 곳을 실제로 눌러야 다음으로 넘어가는 강제 진행형이고, 언제든 [건너뛰기]로 끝낼 수 있다.
   끝나거나 건너뛰면 localStorage 'mwdef.tut' = 1 을 적고 1단계를 처음부터 시작한다. 시험: 주소에 ?tut=1 (본 적이 있어도 다시), ?tut=0 (끄기).

   짜임새
     this.tut = { si 단계 번호, ai 그 단계의 동작 번호, phase 'wait'(멈추고 누르기를 기다림) | 'run'(잠깐 흘려 결과를 보여 줌), pause, holdX, ... }
     단계 = { title, acts: [동작…] },  동작 = {
       text   설명 글 (문자열 또는 함수)
       box    눌러야 할 곳의 화면 상자를 돌려주는 함수 (매 프레임 다시 구한다 — 좌표를 박아 두지 않는다)
       btn    상자 대신 설명 창 안의 버튼 하나 (글자) — 설명만 하는 동작
       free   아무 곳이나 누르면 되는 동작 (상성 창 닫기)
       do     누르면 할 일. 없으면 누른 자리를 평소 입력 경로(_tap / _tapField)로 그대로 넘긴다
       ok     눌린 뒤 이 조건이 참이어야 다음으로 (게임 상태로 판단)
       skip   참이면 이 동작은 건너뛴다 (이미 그 탭에 있을 때 등)
       pre    이 동작에 들어올 때 깔아 줄 상황
       run    넘어가기 전에 게임을 흘려 보여 줄 시간(초),  after = 그동안 보일 글 }
   defense.js 쪽 연결: pickStage(i, true) → _tutWant, _frame(멈춤·_tutTick), update(웨이브·카드·기습 등 끔), _damage(아군은 죽지 않음), _gainXp, draw(_tutDraw), pointerdown(_tutPointer), keydown */
(function (root) {
  'use strict';
  var MWE = root.MWE, DG = MWE.DefenseGame, P = DG.prototype, CONFIG = DG.CONFIG, KEY = 'mwdef.tut';
  function inBox(b, x, y) { return b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  function grow(b, p) { return b ? { x: b.x - p, y: b.y - p, w: b.w + p * 2, h: b.h + p * 2 } : null; }

  P._tutSeen = function () { try { return root.localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  P._tutWanted = function (i) { var q = root.location.search; if (i !== 0 || this.faction !== 'lib' || this._tutDone || /[?&]tut=0/.test(q)) return false; return /[?&]tut=1/.test(q) || !this._tutSeen(); };

  /* ── 찾기 도우미 ── */
  P._tutRos = function (name) { var out = null; this.roster.forEach(function (list, ti) { list.forEach(function (r, i) { if (!out && r.t.name === name) out = { ti: ti, i: i, r: r }; }); }); return out; };
  P._tutAlly = function (name) { return this.units.filter(function (u) { return u.side === 0 && u.state !== 'dead' && u.t.name === name; })[0] || null; };
  P._tutAllies = function () { return this.units.filter(function (u) { return u.side === 0 && u.state !== 'dead'; }); };
  P._tutGroup = function (act) { return this.groups.filter(function (g) { return g.act.name === act; })[0] || null; };
  P._tutTabBox = function (name) { var q = this._tutRos(name); return q ? this.tabBoxes[q.ti] : null; };
  P._tutBtnBox = function (name) {
    var q = this._tutRos(name); if (!q || this.tab !== q.ti) return null;
    var vis = Math.min(this.btnVis || this.btnBoxes.length, this.btnBoxes.length), f = this.btnFirst || 0;
    if (q.i < f || q.i >= f + vis) { this.btnFirst = Math.max(0, q.i - Math.floor(vis / 2)); this._scrollBtns(0); f = this.btnFirst || 0; }   // 캐러셀 밖이면 보이게 넘긴다
    return this.btnBoxes[q.i - f] || null;
  };
  P._tutSlotBox = function (act) {
    var g = this._tutGroup(act), k = g ? this.groups.indexOf(g) : -1, n = this.slotBoxes.length; if (k < 0 || !n) return null;
    if (k < this.slotFirst || k >= this.slotFirst + n) this.slotFirst = Math.max(0, Math.min(k, Math.max(0, this.groups.length - n)));
    return this.slotBoxes[k - this.slotFirst] || null;
  };
  P._tutUnitBox = function (u) { return u ? { x: u.x - this.cam.x - 20, y: u.y - u.headY - 8, w: 40, h: u.headY + 18 } : null; };
  P._tutPtBox = function (p, r) { return p ? { x: p.x - this.cam.x - r, y: p.y - r * 0.7, w: r * 2, h: r * 1.4 } : null; };
  P._tutFoe = function (id, x, row) { var u = this.spawn(id, 1), R = this.rows; this._setLevel(u, 1); u.hp = u.maxHp; u.x = x; u.y = this.laneY + R[Math.max(0, Math.min(R.length - 1, row))]; u.tutFoe = true; return u; };
  P._tutClearFoes = function () { this.units = this.units.filter(function (u) { return !u.tutFoe; }); this.shots = []; };
  P._tutFoes = function () { return this.units.filter(function (u) { return u.tutFoe && u.state !== 'dead'; }); };
  P._tutMid = function (L) { var x = 0, y = 0; L.forEach(function (u) { x += u.x; y += u.y - u.headY * 0.4; }); return L.length ? { x: x / L.length, y: y / L.length } : null; };
  P._tutFront = function () { var L = this._tutAllies(); return L.length ? Math.max.apply(null, L.map(function (u) { return u.x; })) : CONFIG.BASE.front; };
  /* 시전자를 대상 가까이 데려다 놓는다 (연출: 가이드 중 마법이 닿지 않아 멈추는 일이 없게) */
  P._tutNear = function (c, x, d) { if (c && Math.abs(c.x - x) > d) c.x = x - d * 0.7; };
  P._tutBuffed = function (k) { var T = this.time; return this._tutAllies().filter(function (u) { return u.buffs && u.buffs[k] && u.buffs[k].until > T; }).length; };
  /* 아군을 기준 유닛 둘레(뒤쪽 60px 안)로 모은다 — 강화 마법은 시전자 둘레에 공격 아군이 2기 이상 있어야 쓴다 */
  P._tutHuddle = function (w) { var k = 0; this._tutAllies().forEach(function (u) { if (u === w) return; u.x = w.x - 18 - (k % 3) * 18; u.y = w.y + ((k % 2) ? 14 : -14); u.castOrder = null; u.state = 'idle'; k++; }); };
  P._tutMelee = function () { return this._tutAlly('전사') || this._tutAllies().filter(function (u) { return u.act && u.rangePx < 80; })[0] || this._tutAllies()[0]; };

  /* ── 단계 표 ── */
  function summonActs(name, why) {
    return [
      { text: function (g) { return '아래 탭에서 [' + CONFIG.TABS[g._tutRos(name).ti].name + ']을 누르세요.'; }, box: function (g) { return g._tutTabBox(name); }, skip: function (g) { return g.tab === g._tutRos(name).ti; }, ok: function (g) { return g.tab === g._tutRos(name).ti; } },
      { text: '[' + name + ']를 눌러 소환하세요. ' + why, box: function (g) { return g._tutBtnBox(name); }, pre: function (g) { g.tut.n0 = g._tutAllies().length; }, ok: function (g) { return g._tutAllies().length > g.tut.n0; }, run: 0.9, after: name + ' 소환!' }
    ];
  }
  var STEPS = [
    { title: '입문자 가이드', acts: [
      { text: '거울전쟁 디펜스에 오신 것을 환영합니다. 유닛을 소환하고 마법을 써서 적 기지를 무너뜨리면 승리합니다. 기본 조작을 차례로 익혀 봅시다.', btn: '시작' } ] },
    { title: '유닛 생산', acts: [].concat(
      summonActs('전사', '마나를 쓰고, 성 앞에서 나와 스스로 싸웁니다.'),
      summonActs('정령사', '아군의 공격을 강화하는 마법 유닛입니다.'),
      summonActs('마법사', '아군에게 방어막을 쳐 줍니다.'),
      summonActs('성령사', '다친 아군을 치유합니다.'),
      summonActs('소환사', '범위 공격과 가속 마법을 씁니다.')) },
    { title: '성에 병력 배치', acts: [
      { text: '성을 눌러 고르세요. 성 안에 넣은 유닛은 성벽 위에서 적을 쏩니다.', cam: 0, box: function (g) { return g._baseBox(g.forts[0]); }, do: function (g) { g.selectFort(g.forts[0]); g.camGoal = null; }, ok: function (g) { return g.selBase; } },
      { text: '[원거리] 탭을 누르세요.', cam: 0, box: function (g) { return g._tutTabBox('궁수'); }, skip: function (g) { return g.tab === g._tutRos('궁수').ti; }, ok: function (g) { return g.tab === g._tutRos('궁수').ti; } },
      { text: '성을 고른 동안 [궁수]를 누르면 전장이 아니라 성 안에 배치됩니다.', cam: 0, box: function (g) { return g._tutBtnBox('궁수'); }, pre: function (g) { g.tut.n0 = g.garrison.length; if (!g.selBase) g.selectFort(g.forts[0]); },
        ok: function (g) { return g.garrison.length > g.tut.n0; }, run: 4, after: '적이 다가오면 성 안의 궁수가 사격합니다.',
        post: function (g) { var id = g.tut.foeId, x = CONFIG.BASE.front + 330; g._tutFoe(id, x, 1); g._tutFoe(id, x + 30, 3); } } ] },
    { title: '성령사 — 힐링', acts: [
      { text: '전사가 다쳤습니다. 오른쪽 스킬 칸의 [힐링]을 누르세요. 주변의 다친 아군을 치유합니다.', box: function (g) { return g._tutSlotBox('힐링'); },
        pre: function (g) { g._tutClearFoes(); var w = g._tutMelee(), c = g._tutAlly('성령사'); if (w) { w.hp = Math.max(1, Math.round(w.maxHp * 0.4)); g.tut.hp0 = w.hp; g._tutNear(c, w.x, 70); } },
        ok: function (g) { var w = g._tutMelee(); return !w || w.hp > g.tut.hp0; }, run: 1.6, after: '체력이 회복됐습니다. 마법은 마나를 쓰고 재사용 대기가 있습니다.' } ] },
    { title: '정령사 — 파이어 웨폰', acts: [
      { text: '적이 왔습니다. 스킬 칸의 [파이어 웨폰]을 누르세요. 정령사 둘레의 공격 아군들이 잠시 강해집니다.', box: function (g) { return g._tutSlotBox('파이어 웨폰'); },
        pre: function (g) { var w = g._tutMelee(), id = g.tut.foeId, row = g.rows.length >> 1; if (w) { w.hp = w.maxHp; g._tutHuddle(w); g._tutFoe(id, w.x + 46, row).y = w.y; g._tutFoe(id, w.x + 70, row + 1); } g.tut.b0 = g._tutBuffed('weapon'); },
        ok: function (g) { return g._tutBuffed('weapon') > g.tut.b0; }, run: 2.6, after: '무기에 불이 붙었습니다. 둘레에 공격 아군이 2기 이상 있어야 씁니다.' } ] },
    { title: '마법사 — 파운틴 베리어', acts: [
      { text: '[파운틴 베리어]를 누르세요. 마법사 둘레의 공격 아군에게 방어막을 칩니다.', box: function (g) { return g._tutSlotBox('파운틴 베리어'); },
        pre: function (g) { var w = g._tutMelee(); if (w) { g._tutHuddle(w); if (!g._tutFoes().length) g._tutFoe(g.tut.foeId, w.x + 46, 0).y = w.y; } g.tut.b0 = g._tutBuffed('shield'); },
        ok: function (g) { return g._tutBuffed('shield') > g.tut.b0; }, run: 2.6, after: '방어막이 받는 피해를 줄여 줍니다.' } ] },
    { title: '소환사 — 나르 소환', acts: [
      { text: '적이 한데 몰려옵니다. [나르 소환]을 누르세요. 찍은 곳 둘레의 적을 한꺼번에 공격합니다.', box: function (g) { return g._tutSlotBox('나르 소환'); },
        pre: function (g) { g._tutClearFoes(); var x = g._tutFront() + 150, id = g.tut.foeId, n = g.rows.length, m = n >> 1; g.tut.pack = [[0, m], [22, m - 1], [18, m + 1], [44, m], [40, m - 1], [-14, m + 1]].map(function (e) { return g._tutFoe(id, x + e[0], e[1]); });
          g._tutNear(g._tutAlly('소환사'), x, 150); },
        ok: function (g) { return !!g.aim; } },
      { text: '적이 가장 많이 모인 곳을 누르세요. 원 안의 적이 모두 맞습니다.', box: function (g) { return g._tutPtBox(g._tutMid(g._tutFoes()), 46); },
        do: function (g) { var p = g._tutMid(g._tutFoes()); if (p) g._aimCast(p.x, p.y); }, ok: function (g) { return !g.aim; }, run: 3, after: '범위 마법은 적이 뭉쳐 있을 때 쓰면 좋습니다.' } ] },
    { title: '소환사 — 가속(케멘 소환)', acts: [
      { text: '[케멘 소환]을 누르세요. 찍은 곳 둘레의 아군이 빨라집니다.', box: function (g) { return g._tutSlotBox('케멘 소환'); }, pre: function (g) { var p = g._tutMid(g._tutAllies()); if (p) g._tutNear(g._tutAlly('소환사'), p.x, 120); }, ok: function (g) { return !!g.aim; } },
      { text: '아군이 모여 있는 곳을 누르세요.', box: function (g) { return g._tutPtBox(g._tutMid(g._tutAllies()), 50); },
        do: function (g) { var p = g._tutMid(g._tutAllies()); if (p) g._aimCast(p.x, p.y); }, ok: function (g) { return !g.aim; }, run: 2.6, after: '가속된 아군은 더 빨리 움직이고 더 자주 공격합니다.' } ] },
    { title: '상성', acts: [
      { text: '새로운 적이 나타났습니다. 적마다 약한 상대가 있습니다. 위쪽의 [상성] 버튼을 누르세요.', box: function (g) { return g.affBtn; },
        pre: function (g) { g._tutClearFoes(); var x = g._tutFront() + 230, m = g.rows.length >> 1; [[0, m], [26, m - 1], [30, m + 1]].forEach(function (e) { g._tutFoe(g.tut.affId, x + e[0], e[1]); }); },
        ok: function (g) { return g.modal === 'aff'; } },
      { text: function (g) { return '상성 표입니다. ' + g.types[g.tut.affId].name + '에게는 ' + g.tut.counter + ' 쪽이 유리합니다. 아무 곳이나 눌러 닫으세요.'; }, free: true, ok: function (g) { return !g.modal; } },
      { text: function (g) { return '[' + CONFIG.TABS[g._tutRos(g.tut.counter).ti].name + '] 탭을 누르세요.'; }, box: function (g) { return g._tutTabBox(g.tut.counter); }, skip: function (g) { return g.tab === g._tutRos(g.tut.counter).ti; }, ok: function (g) { return g.tab === g._tutRos(g.tut.counter).ti; } },
      { text: function (g) { return '상성이 유리한 [' + g.tut.counter + ']를 소환하세요. 유리한 유닛은 더 큰 피해를 줍니다.'; }, box: function (g) { return g._tutBtnBox(g.tut.counter); }, pre: function (g) { g.tut.n0 = g._tutAllies().length; },
        ok: function (g) { return g._tutAllies().length > g.tut.n0; }, run: 4, hold: 260, after: '소환 버튼을 길게 누르면 유닛 설명과 상성을 볼 수 있습니다.' } ] },
    { title: '가이드 끝', acts: [
      { text: '여기까지입니다. 유닛을 모아 적 벙커를 부수고, 맨 오른쪽의 적 기지를 무너뜨리면 승리합니다. 이제 해골 들판을 시작합니다.', btn: '시작하기' } ] }
  ];
  DG.TUT_STEPS = STEPS;

  /* ── 진행 ── */
  P._tutBegin = function () {
    var self = this, w0 = this._stageWaves && this._stageWaves[0];
    this.tut = { si: 0, ai: -1, phase: 'wait', pause: true, runT: 0, t: 0, hold: 200, foeId: w0 ? w0.list[0][0] : 28, affId: 35, counter: '격투가', n0: 0, hp0: 0 };
    // 상성 단계에 쓸 적과 그 적에게 유리한 값싼 일반 유닛 (없으면 그 단계는 뺀다)
    var pick = null; [35, 36, 39, 43].forEach(function (id) { if (pick || !self.types[id]) return; var best = null;
      self.roster.forEach(function (list) { list.forEach(function (r) { if (r.magic || r.t.name === '전사' || (r.t.aff || []).indexOf(id) < 0) return; if (!best || r.cost < best.cost) best = r; }); });
      if (best) pick = [id, best.t.name]; });
    if (pick) { this.tut.affId = pick[0]; this.tut.counter = pick[1]; } else this.tut.noAff = true;
    this.units = this.units.filter(function (u) { return u.side !== 1 || u.x > CONFIG.WORLD_W * 0.55; });   // 길목의 적은 치운다 (적 기지 쪽 수비대는 멀어서 그대로)
    this.banner = null; this.aim = null; this.sel = null; this.selFort = null; this.cards = null; this.modal = null;
    this._tutNext();
  };
  P._tutAct = function () { var T = this.tut, S = T && STEPS[T.si]; return S ? S.acts[T.ai] : null; };
  P._tutNext = function () {
    var T = this.tut; if (!T) return;
    for (;;) { T.ai++; var S = STEPS[T.si]; if (!S) { this._tutEnd(); return; }
      if (T.ai >= S.acts.length) { T.si++; T.ai = -1; if (STEPS[T.si] && STEPS[T.si].title === '상성' && T.noAff) T.si++; continue; }
      var a = S.acts[T.ai]; if (a.skip && a.skip(this)) continue; break; }
    var act = this._tutAct(); T.phase = 'wait'; T.pause = true; T.t = 0; T.hold = act.hold || 200;
    this.manaMax = Math.max(this.manaMax, 300); this.mana = this.manaMax;
    this.roster.forEach(function (list) { list.forEach(function (r) { r.wait = 0; }); });
    this.slots.forEach(function (s) { if (s.unit && s.unit.side === 0) s.cd = 0; });
    if (act.pre) act.pre(this);
    if (act.cam != null) { this.cam.x = act.cam; this._clampCam(); }   // 화면을 바로 옮긴다 (움직이는 동안 하이라이트가 화면 밖에 있지 않게)
    this._regroup && this.groups.length;   // (칸 순서는 그대로 — 상자는 매 프레임 다시 구한다)
  };
  P._tutEnd = function () {
    try { root.localStorage.setItem(KEY, '1'); } catch (e) {}
    this.tut = null; this._tutWant = false; this._tutDone = true; this.modal = null; this.aim = null; this.slotSortAt = null;   // 칸 줄 세우기를 다시 켠다
    this.pickStage(this.stageI);                             // 연출을 지우고 1단계를 처음부터
  };
  /* 매 프레임 (멈춰 있을 때도): 보여 주는 시간 재기, 아군이 너무 멀리 나가지 않게, 카메라 */
  P._tutTick = function (dt) {
    var T = this.tut, act = this._tutAct(), self = this; if (!T || !act) return;
    T.t += dt;
    // 스킬 칸: 가이드 중에는 "전장에 가까운 순" 다시 줄 세우기를 멈추고(_regroup 의 SLOT_ORDER — 연출로 시전자를 옮기면 칸이 자리를 바꿔 하이라이트와 그림이 어긋났다),
    // 멈춰 있는 동안에도 칸 그림이 제 자리에 있게 미끄러짐을 끝내 둔다 (평소에는 update 의 _updateSlots 가 한다)
    this.slotSortAt = Infinity; if (T.pause) { this.groups.forEach(function (g, i) { g.vi = i; }); this.slotPos = this.slotFirst; }
    if (T.phase === 'run') { T.runT -= dt;
      var lim = CONFIG.BASE.front + T.hold; this.units.forEach(function (u) { if (u.side === 0 && u.state !== 'dead' && !u.castOrder && u.x > lim) { u.x = lim; if (u.state === 'move') u.state = 'idle'; } });
      if (T.runT <= 0) this._tutNext(); }
    var front = this._tutFront(), camX = act.cam != null ? act.cam : Math.max(0, front - this.W * 0.42), F = this._tutFoes();   // 아군 맨 앞이 화면 왼쪽 40% 남짓에
    if (act.cam == null && F.length) { var fx = Math.max.apply(null, F.map(function (u) { return u.x; })); camX = Math.min(Math.max(camX, fx + 50 - this.W), front - 60); }   // 연출한 적도 보이게 (아군 맨 앞은 화면 안에 남긴다)
    this.manualUntil = this.time + 5; this.camGoal = null;
    this.cam.x += (camX - this.cam.x) * Math.min(1, dt * 6); this._clampCam();
  };
  P._tutSkipBox = function () { return { x: this.W - 88, y: 6, w: 82, h: 26 }; };
  P._tutSoundBox = function () { return { x: this.W - 88 - 6 - 64, y: 6, w: 64, h: 26 }; };   // 소리 켜기/끄기 (설정 메뉴는 가이드 중에 막혀 있어서 따로 둔다)
  /* 누르기: 건너뛰기, 설명 창의 버튼, 하이라이트된 곳만 받는다 */
  P._tutPointer = function (x, y) {
    var T = this.tut, act = this._tutAct(); if (!T || !act) return;
    if (inBox(this._tutSkipBox(), x, y)) { this._tutEnd(); return; }
    if (inBox(this._tutSoundBox(), x, y)) { this.toggleSound(); return; }
    if (T.phase !== 'wait' || T.t < 0.3) return;             // 뜨자마자 잘못 누르지 않게
    if (act.btn) { if (inBox(grow(T.btnBox, 6), x, y)) this._tutNext(); return; }
    if (!act.free) { var b = act.box && act.box(this); if (!b || !inBox(grow(b, 6), x, y)) return; }
    if (act.do) act.do(this);
    else if (act.free || inBox(this.affBtn, x, y) || y >= this.H - this.hudH) this._tap(x, y);
    else { if (this.aim) this.aimPt = { x: x, y: y }; this._tapField(x, y); }
    this.info = null; this.sinfo = null; this.drag = null;
    if (act.ok && !act.ok(this)) return;
    if (act.post) act.post(this);
    if (act.run) { T.phase = 'run'; T.pause = false; T.runT = act.run; T.t = 0; } else this._tutNext();
  };

  /* ── 그리기 ── */
  P._tutDraw = function () {
    var T = this.tut, act = this._tutAct(), ctx = this.ctx, W = this.W, H = this.H; if (!T || !act) return;
    var S = STEPS[T.si], wait = T.phase === 'wait', hole = wait && !act.btn && !act.free && act.box ? act.box(this) : null, pulse = 0.5 + 0.5 * Math.sin(Date.now() / 180);
    ctx.save(); ctx.textBaseline = 'middle';
    if (wait && !act.free) {                                 // 덮개: 눌러야 할 곳만 뚫는다
      ctx.fillStyle = 'rgba(4,6,12,.62)';
      if (hole) { var h = grow(hole, 5), hx = Math.max(0, h.x), hy = Math.max(0, h.y), hr = Math.min(W, h.x + h.w), hb = Math.min(H, h.y + h.h);
        ctx.fillRect(0, 0, W, hy); ctx.fillRect(0, hb, W, H - hb); ctx.fillRect(0, hy, hx, hb - hy); ctx.fillRect(hr, hy, W - hr, hb - hy);
        ctx.strokeStyle = 'rgba(255,211,110,' + (0.55 + 0.45 * pulse) + ')'; ctx.lineWidth = 2 + pulse; ctx.strokeRect(hx + 1, hy + 1, hr - hx - 2, hb - hy - 2);
        var ax = (hx + hr) / 2, up = hy > H * 0.5, ay = up ? hy - 8 - pulse * 5 : hb + 8 + pulse * 5;   // 가리키는 화살표
        ctx.fillStyle = '#ffd36e'; ctx.beginPath(); if (up) { ctx.moveTo(ax, ay); ctx.lineTo(ax - 8, ay - 11); ctx.lineTo(ax + 8, ay - 11); } else { ctx.moveTo(ax, ay); ctx.lineTo(ax - 8, ay + 11); ctx.lineTo(ax + 8, ay + 11); } ctx.closePath(); ctx.fill();
      } else ctx.fillRect(0, 0, W, H);
    }
    // 설명 창
    var txt = wait ? (typeof act.text === 'function' ? act.text(this) : act.text) : (act.after || ''), pw = Math.min(W - 20, 330), px = Math.round((W - pw) / 2);
    if (txt) {
      ctx.font = 'bold 13px sans-serif'; var lines = this._wrap(txt, pw - 28), lh = 19, ph = 34 + lines.length * lh + (wait && act.btn ? 44 : 8), py;
      if (wait && act.free) py = H - ph - 8;                  // 상성 창이 떠 있다: 맨 아래에 (표의 이름 줄을 가리지 않게)
      else if (!wait) py = 40;
      else if (!hole) py = Math.round((H - this.hudH) / 2 - ph / 2);
      else if (hole.y + hole.h / 2 > H * 0.5) py = Math.round(Math.max(40, Math.min(hole.y - ph - 30, (H - this.hudH) * 0.42)));
      else py = Math.round(Math.min(H - ph - 8, hole.y + hole.h + 30));
      ctx.fillStyle = 'rgba(14,17,26,.94)'; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = '#b08a3c'; ctx.lineWidth = 1.5; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      ctx.textAlign = 'left'; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffd36e'; ctx.fillText('가이드 ' + (T.si + 1) + '/' + STEPS.length + ' · ' + S.title, px + 14, py + 16);
      ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#eef2fb'; lines.forEach(function (l, i) { ctx.fillText(l, px + 14, py + 38 + i * lh); });
      if (wait && act.btn) { var bw = 120, bh = 30, bb = { x: Math.round(W / 2 - bw / 2), y: py + ph - bh - 10, w: bw, h: bh }; T.btnBox = bb;
        ctx.fillStyle = 'rgba(255,211,110,' + (0.82 + 0.18 * pulse) + ')'; ctx.fillRect(bb.x, bb.y, bb.w, bb.h); ctx.fillStyle = '#1a1408'; ctx.textAlign = 'center'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(act.btn, W / 2, bb.y + bh / 2 + 1); }
    }
    // 건너뛰기 (늘 보인다)
    var sb = this._tutSkipBox(); ctx.fillStyle = 'rgba(14,17,26,.92)'; ctx.fillRect(sb.x, sb.y, sb.w, sb.h); ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 1; ctx.strokeRect(sb.x + 0.5, sb.y + 0.5, sb.w - 1, sb.h - 1);
    ctx.fillStyle = '#dfe6f5'; ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillText('건너뛰기 ▶', sb.x + sb.w / 2, sb.y + sb.h / 2 + 1);
    var ob = this._tutSoundBox(); ctx.fillStyle = 'rgba(14,17,26,.92)'; ctx.fillRect(ob.x, ob.y, ob.w, ob.h); ctx.strokeStyle = this.soundOn ? '#b08a3c' : '#8a93a8'; ctx.strokeRect(ob.x + 0.5, ob.y + 0.5, ob.w - 1, ob.h - 1);
    ctx.fillStyle = this.soundOn ? '#ffd36e' : '#9aa3b8'; ctx.fillText(this.soundOn ? '소리 켬' : '소리 끔', ob.x + ob.w / 2, ob.y + ob.h / 2 + 1);
    ctx.restore();
  };
})(window);
