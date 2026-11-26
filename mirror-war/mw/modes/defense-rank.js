/* 거울전쟁 디펜스 — 순위·기록 올리기 (2026-11-18 사용자 요청, README 248)
   서버: Cloudflare Workers + D1 (analysis/cloud/rank — worker.js·schema.sql). 순위 기준 = 클리어 시간(빠른 순), 같으면 남은 기지 체력.
   기기마다 진영·스테이지별 가장 빠른 기록 하나만 남는다. 시즌 구분 없음(버전은 참고로만 보낸다), 조작 방지 없음(사용자 결정).
   보내는 것: 닉네임(12자), 무작위 기기 ID(localStorage — 개인정보 아님), 진영·스테이지, 시간·남은 기지 체력·잃은 아군·처치, 소환 집계, 고른 카드, 버전.
   화면: 게임 캔버스 위에 뜨는 DOM 창(닉네임을 입력받아야 해서 캔버스가 아니라 DOM). 여는 곳 = 스테이지 고르기의 [순위 보기], 끝난 화면의 [기록 올리기 · 순위].
   defense.js 쪽 연결: this._rankShow(이겼는가) · this.rankOpen(떠 있는 동안 단축키 막기) · this.rankBtn */
(function (root) {
  'use strict';
  var MWE = root.MWE, DG = MWE && MWE.DefenseGame; if (!DG || !root.document) return;
  var P = DG.prototype, doc = root.document;
  var API = 'https://mw-rank.zardbird.workers.dev';           // 배포한 Workers 주소 (analysis/cloud/rank)
  var VER = '350';                                           // 게임 버전 = README 번호 (참고용 — 밸런스를 바꾼 배포 때 올린다)
  DG.RANK = { api: API, ver: VER, surv: true };   /* surv = 서바이벌 판을 서버가 받는가 — 워커(cloud/rank/worker.js, README 350)를 2026-11-23 에 올려서 켰다. false 면 서바이벌 탭과 끝 화면 버튼이 나오지 않는다 */
  var LS = { nick: 'mwdef.nick', did: 'mwdef.did' };
  function lsGet(k) { try { return root.localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { root.localStorage.setItem(k, v); } catch (e) {} }
  function did() { var d = lsGet(LS.did); if (!/^[A-Za-z0-9_-]{8,40}$/.test(d)) { d = ''; var A = 'abcdefghijklmnopqrstuvwxyz0123456789'; for (var i = 0; i < 20; i++) d += A[Math.floor(Math.random() * A.length)]; lsSet(LS.did, d); } return d; }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function el(tag, css, txt) { var e = doc.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }
  function call(method, path, body) {
    return root.fetch(DG.RANK.api + path, { method: method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }).then(function (r) { return r.json(); });
  }

  /* 이번 판의 기록 (이긴 화면에서만) */
  P._rankResult = function () {
    if (this.screen !== 'win' || !this.rep) return null;
    var R = this.rep, units = Object.keys(R.sum).map(function (k) { return [R.sum[k].name, R.sum[k].n]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 40);
    return { fac: this.faction, stage: this.stageI, time: Math.max(1, Math.round(R.end)), base: Math.max(0, Math.ceil(this.baseHp)), lost: R.lost || 0, kills: this.kills || 0, units: units, cards: (R.cards || []).slice(0, 60) };
  };

  var BTN = 'font:bold 13px sans-serif;padding:7px 10px;border-radius:6px;border:1px solid #6b5a33;background:#2a2418;color:#ffd36e;cursor:pointer;';
  var TAB = 'font:12px sans-serif;padding:5px 8px;border-radius:5px;border:1px solid #3a4152;background:#181c26;color:#9aa3b8;cursor:pointer;white-space:nowrap;';
  var TAB_ON = 'font:bold 12px sans-serif;padding:5px 8px;border-radius:5px;border:1px solid #c9a44a;background:#3a2f17;color:#ffe9b0;cursor:pointer;white-space:nowrap;';

  /* 순위 창을 연다. won = 이긴 화면에서 열었다(이번 기록을 올릴 수 있다).
     sv = 서바이벌에서 열었다 (README 350): { stage: 0 대도의 길 | 1 무사의 길, res: 올릴 기록 또는 null } — 서바이벌 판은 오래 버틴 순이고 줄에는 레벨·처치·스킬이 나온다 */
  var SURV = { name: '서바이벌', stages: [{ name: '대도의 길' }, { name: '무사의 길' }, { name: '성전사', soon: true }] };   /* soon = 탭을 숨긴다 (README 384, 2026-11-26 사용자 "명예의 전당의 성전사 탭도 가려 줘" — 성전사는 아직 개발 중). 서버의 판(stage 2)과 올리는 길은 그대로 */
  P._rankShow = function (won, sv) {
    var g = this; if (g.rankOpen) return;
    var F = {}; if (DG.RANK.surv) F.surv = SURV; Object.keys(DG.FACTIONS).forEach(function (k) { F[k] = DG.FACTIONS[k]; });
    var res = sv ? sv.res : won ? g._rankResult() : null, view = sv ? { fac: 'surv', stage: sv.stage || 0 } : { fac: g.faction, stage: g.stageI || 0 }, sentKey = res ? res.fac + ':' + res.stage + ':' + res.time + ':' + res.kills : '';
    var wrap = el('div', 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.72);touch-action:manipulation;');
    var box = el('div', 'box-sizing:border-box;width:min(360px,94vw);max-height:92vh;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;border:1px solid #6b5a33;background:#12151d;color:#dfe6f5;font:13px sans-serif;');
    var head = el('div', 'display:flex;align-items:center;justify-content:space-between;');
    head.appendChild(el('b', 'font-size:17px;color:#ffd36e;', sv ? '명예의 전당' : '순위'));
    var closeB = el('button', BTN, '닫기'); head.appendChild(closeB); box.appendChild(head);
    var subBox = el('div', 'display:none;flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:#1b2130;border:1px solid #2c3446;'); box.appendChild(subBox);
    var facRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap;'), stRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap;'); box.appendChild(facRow); box.appendChild(stRow);
    var list = el('div', 'flex:1 1 auto;min-height:120px;overflow-y:auto;border-radius:8px;background:#0d1017;border:1px solid #232a3a;'); box.appendChild(list);
    var foot = el('div', 'min-height:16px;color:#9aa3b8;font-size:12px;text-align:center;'); box.appendChild(foot);
    wrap.appendChild(box); doc.body.appendChild(wrap); g.rankOpen = true;
    var close = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); g.rankOpen = false; };
    closeB.onclick = close; wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) close(); });
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'wheel', 'touchstart'].forEach(function (t) { box.addEventListener(t, function (e) { e.stopPropagation(); }); });

    /* 기록 카드 (README 380, 2026-11-26 사용자 "명예의 전당 리스트의 아이템을 누르면 펼쳐지는데, 그 상태에서 내용을 한 번 더 누르면 카드가 나오도록. 카드의 스킬 아이콘을 길게 누르면 스킬 레벨과 설명"):
       서바이벌 기록 한 줄을 결과 화면 같은 카드로 — 서버에 있는 것만(시간·처치·레벨·적 레벨·스킬·버전. 준 피해 같은 것은 올리지 않는다). 스킬 그림·설명은 survival.js 의 SK 에서 이름으로 찾는다(디펜스에서 열었으면 그때 받는다, 못 찾는 옛 이름은 글자로) */
    var needSK = function (cb) {
      if (MWE.SurvivalGame) { cb(MWE.SurvivalGame.SK); return; }
      var base = '../mw/modes/', tags = doc.getElementsByTagName('script'), ti; for (ti = 0; ti < tags.length; ti++) { var m = /^(.*\/)defense\.js(\?.*)?$/.exec(tags[ti].getAttribute('src') || ''); if (m && /modes\/$/.test(m[1])) base = m[1]; }
      var sc = doc.createElement('script'); sc.src = base + 'survival.js'; sc.onload = function () { cb(MWE.SurvivalGame ? MWE.SurvivalGame.SK : null); }; sc.onerror = function () { cb(null); }; doc.head.appendChild(sc);
    };
    var card = function (r, rank) {
      var CK = ['venom', 'shadow', 'paladin'][view.stage] || 'venom', NOSEL = '-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;';
      var ov = el('div', 'position:fixed;inset:0;z-index:51;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.78);touch-action:manipulation;' + NOSEL);
      var cb = el('div', 'box-sizing:border-box;width:min(340px,92vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:10px;border:1px solid #a8823a;background:#1a1410;color:#dfe6f5;font:13px sans-serif;');
      var hd = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:8px;'), nm = el('div', 'flex:1 1 auto;min-width:0;');
      nm.appendChild(el('div', 'font:bold 18px sans-serif;color:#ffd36e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', r.nick));
      nm.appendChild(el('div', 'font-size:11px;color:#9aa3b8;margin-top:2px;', '서바이벌 · ' + SURV.stages[view.stage].name + ' · ' + (rank + 1) + '위'));
      var cl = el('button', BTN, '닫기'); hd.appendChild(nm); hd.appendChild(cl); cb.appendChild(hd);
      var rows = [['생존 시간', mmss(r.time) + (r.time >= 600 ? '  (완주)' : '')], ['처치', String(r.kills)], ['레벨', String(r.lost)]];
      (r.cards || []).slice(0, 3).forEach(function (c) { var m2 = /^(적 레벨)\s*(.+)$/.exec(c); if (m2) rows.push([m2[1], m2[2]]); });
      if (r.ver) rows.push(['버전', (/\./.test(r.ver) ? 'v' : '') + r.ver]);
      var tb = el('div', 'display:flex;flex-direction:column;gap:5px;padding:8px 4px;border-top:1px solid rgba(168,130,58,.5);border-bottom:1px solid rgba(168,130,58,.5);');
      rows.forEach(function (rw) { var ln = el('div', 'display:flex;justify-content:space-between;'); ln.appendChild(el('span', 'color:#9aa3b8;', rw[0])); ln.appendChild(el('span', 'color:#ffe9b0;font-weight:bold;', rw[1])); tb.appendChild(ln); }); cb.appendChild(tb);
      var sh = el('div', 'display:flex;justify-content:space-between;align-items:baseline;'); sh.appendChild(el('span', 'color:#9aa3b8;', '스킬')); sh.appendChild(el('span', 'color:#6f7890;font-size:11px;', '길게 누르면 설명')); cb.appendChild(sh);
      var grid = el('div', 'display:flex;flex-wrap:wrap;gap:6px;min-height:44px;'); cb.appendChild(grid);
      var tip = el('div', 'display:none;flex-direction:column;gap:4px;padding:9px;border-radius:8px;background:#0d1017;border:1px solid #3a4152;'); cb.appendChild(tip);
      ov.appendChild(cb); doc.body.appendChild(ov);
      var shut = function () { if (ov.parentNode) ov.parentNode.removeChild(ov); };
      cl.onclick = shut; ov.addEventListener('pointerdown', function (e) { if (e.target === ov) shut(); });
      ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'wheel', 'touchstart', 'click'].forEach(function (t) { ov.addEventListener(t, function (e) { e.stopPropagation(); }); });
      ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      var showTip = function (name, lv, s, ev) {
        tip.textContent = ''; tip.style.display = 'flex';
        var t1 = el('div', 'display:flex;justify-content:space-between;align-items:baseline;'); t1.appendChild(el('b', 'color:#ffe9b0;font-size:14px;', name)); t1.appendChild(el('span', 'color:#9cc0ff;font-weight:bold;font-size:12px;', 'Lv ' + lv + (lv >= 5 ? ' (최대)' : ''))); tip.appendChild(t1);
        var d = ''; try { d = s && s.desc ? String(s.desc(Math.max(1, Math.min(5, lv)), ev)) : ''; } catch (e) {}
        tip.appendChild(el('div', 'color:#dfe6f5;font-size:12px;line-height:1.5;', d || '설명을 찾지 못했습니다 (지금 판에는 없는 스킬)'));
      };
      grid.appendChild(el('span', 'color:#7b8397;font-size:12px;', '불러오는 중…'));
      needSK(function (SK) {
        if (!ov.parentNode) return; grid.textContent = '';
        var byName = {}; if (SK) Object.keys(SK).forEach(function (k) { var s = SK[k]; if (s.name && !byName[s.name]) byName[String(s.name).slice(0, 16)] = k; if (s.evo && s.evo.name && !byName[s.evo.name]) byName[String(s.evo.name).slice(0, 16)] = k; });
        var IC = g.data && g.data.fx && g.data.fx.icon, icons = g.assets && g.assets.get('acticons');
        (r.units || []).forEach(function (u) {
          var k = byName[u[0]], s = k && SK[k], lv = u[1] | 0, ev = !!(s && s.evo && s.evo.cls === CK), name = s ? (ev ? s.evo.name : s.name) : u[0];
          var cell = el('div', 'position:relative;width:38px;height:42px;cursor:pointer;touch-action:none;' + NOSEL);
          if (s && (s.art || (IC && icons))) { var cv = doc.createElement('canvas'); cv.width = 72; cv.height = 80; cv.style.cssText = 'width:36px;height:40px;display:block;pointer-events:none;'; var cx = cv.getContext('2d'); cx.scale(2, 2);
            try { var fi = s.icon * 2; if (s.art) s.art(cx, 0, 1, 34, 34); else cx.drawImage(s.tree === 'pas' && MWE.SurvivalGame.greenSheet ? MWE.SurvivalGame.greenSheet(icons) : icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, 0, 0, 34, 37); } catch (e) {} cell.appendChild(cv); }
          else { cell.style.cssText += 'width:auto;height:auto;padding:4px 6px;border-radius:5px;border:1px solid #3a4152;color:#9aa3b8;font-size:11px;'; cell.appendChild(el('span', 'pointer-events:none;', u[0])); }
          cell.appendChild(el('span', 'position:absolute;right:0;bottom:0;font:bold 10px sans-serif;color:' + (ev ? '#ffd36e' : '#fff') + ';text-shadow:0 0 2px #000,0 0 2px #000,1px 1px 0 #000;pointer-events:none;', String(lv)));
          var tmr = 0, stop = function () { if (tmr) { root.clearTimeout(tmr); tmr = 0; } };
          cell.addEventListener('pointerdown', function () { stop(); tmr = root.setTimeout(function () { tmr = 0; cell.style.outline = '1px solid #ffd36e'; root.setTimeout(function () { cell.style.outline = ''; }, 600); showTip(name, lv, s, ev); }, 350); });
          ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { cell.addEventListener(t, stop); });
          grid.appendChild(cell);
        });
        if (!(r.units || []).length) grid.appendChild(el('span', 'color:#7b8397;font-size:12px;', '기록된 스킬이 없습니다'));
      });
    };

    var seq = 0;
    var load = function () {
      var my = ++seq; list.textContent = ''; list.appendChild(el('div', 'padding:18px;text-align:center;color:#7b8397;', '불러오는 중…')); foot.textContent = '';
      call('GET', '/top?fac=' + view.fac + '&stage=' + view.stage + '&did=' + did()).then(function (d) {
        if (my !== seq) return; list.textContent = '';
        if (!d || !d.ok) { list.appendChild(el('div', 'padding:18px;text-align:center;color:#ff9a8a;', '순위를 불러오지 못했습니다')); return; }
        if (!d.top.length) list.appendChild(el('div', 'padding:18px;text-align:center;color:#7b8397;', '아직 기록이 없습니다. 첫 기록의 주인공이 되어 보세요.'));
        d.top.forEach(function (r, i) {
          var row = el('div', 'padding:7px 9px;border-bottom:1px solid #1b2130;cursor:pointer;' + (r.me ? 'background:#22301f;' : ''));
          var top = el('div', 'display:flex;align-items:baseline;gap:8px;');
          top.appendChild(el('span', 'width:22px;text-align:right;color:' + (i < 3 ? '#ffd36e' : '#7b8397') + ';font-weight:bold;', String(i + 1)));
          top.appendChild(el('span', 'flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (r.me ? '#8fe89a' : '#dfe6f5') + ';', r.nick + (r.me ? ' (나)' : '')));
          top.appendChild(el('span', 'color:#ffe9b0;font-weight:bold;', mmss(r.time)));
          row.appendChild(top);
          var more = el('div', 'display:none;margin:5px 0 0 30px;color:#9aa3b8;font-size:11px;line-height:1.5;');
          var sv2 = view.fac === 'surv';
          more.appendChild(el('div', '', sv2 ? '레벨 ' + r.lost + ' · 처치 ' + r.kills + (r.cards && r.cards.length ? ' · ' + r.cards.slice(0, 3).join(' · ') : '') : '남은 기지 ' + r.base + ' · 잃은 아군 ' + r.lost + ' · 처치 ' + r.kills));
          if (r.units && r.units.length) more.appendChild(el('div', '', (sv2 ? '스킬: ' : '소환: ') + r.units.slice(0, sv2 ? 16 : 8).map(function (u) { return u[0] + ' ' + u[1]; }).join(', ')));
          if (!sv2 && r.cards && r.cards.length) more.appendChild(el('div', '', '카드: ' + r.cards.slice(0, 10).join(', ')));
          if (r.ver) more.appendChild(el('div', 'color:#6f7890;', (/\./.test(r.ver) ? '버전 v' : '버전 ') + r.ver)); row.appendChild(more);
          if (sv2) { more.appendChild(el('div', 'color:#c9a44a;', '한 번 더 누르면 카드 ▸')); more.onclick = function (e) { e.stopPropagation(); card(r, i); }; }   /* 펼친 내용을 한 번 더 누르면 그 기록의 카드 (README 380) */
          row.onclick = function () { more.style.display = more.style.display === 'none' ? 'block' : 'none'; };
          list.appendChild(row);
        });
        foot.textContent = d.me ? '내 기록 ' + mmss(d.me.time) + ' — ' + d.me.rank + '위 / ' + d.total + '명' : d.total ? '기록 ' + d.total + '명 · 줄을 누르면 ' + (view.fac === 'surv' ? '스킬이, 한 번 더 누르면 카드가' : '편성이') + ' 보입니다' : '';
      }).catch(function () { if (my !== seq) return; list.textContent = ''; list.appendChild(el('div', 'padding:18px;text-align:center;color:#ff9a8a;', '순위 서버에 연결하지 못했습니다')); });
    };
    var tabs = function () {
      facRow.textContent = ''; stRow.textContent = '';
      Object.keys(F).forEach(function (k) { var b = el('button', k === view.fac ? TAB_ON : TAB, F[k].name); b.onclick = function () { view.fac = k; view.stage = 0; tabs(); load(); }; facRow.appendChild(b); });
      (F[view.fac].stages || []).forEach(function (S, i) { if (S.soon) return; var b = el('button', i === view.stage ? TAB_ON : TAB, (i + 1) + '. ' + S.name); b.onclick = function () { view.stage = i; tabs(); load(); }; stRow.appendChild(b); });
    };

    /* 이번 기록 올리기 (이긴 화면에서만, 같은 판은 한 번) */
    if (res && g._rankSent !== sentKey) {
      subBox.style.display = 'flex';
      subBox.appendChild(el('div', 'color:#8fe89a;font-weight:bold;', res.fac === 'surv' ? '서바이벌 ' + SURV.stages[res.stage].name + ' — ' + mmss(res.time) + (res.time >= 600 ? ' 완주' : ' 생존') : F[res.fac].name + ' ' + (res.stage + 1) + '단계 클리어 — ' + mmss(res.time)));
      var line = el('div', 'display:flex;gap:6px;');
      var inp = el('input', 'flex:1 1 auto;min-width:0;box-sizing:border-box;padding:7px 8px;border-radius:6px;border:1px solid #3a4152;background:#0d1017;color:#fff;font:14px sans-serif;');
      inp.maxLength = 12; inp.placeholder = '닉네임 (12자까지)'; inp.value = lsGet(LS.nick); inp.autocomplete = 'off';
      var send = el('button', BTN, '기록 올리기'); line.appendChild(inp); line.appendChild(send); subBox.appendChild(line);
      var msg = el('div', 'min-height:15px;font-size:12px;color:#9aa3b8;', res.fac === 'surv' ? '닉네임·기록·스킬이 순위표에 공개됩니다' : '닉네임·기록·편성이 순위표에 공개됩니다'); subBox.appendChild(msg);
      var go = function () {
        var nick = inp.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12); if (!nick) { msg.style.color = '#ff9a8a'; msg.textContent = '닉네임을 입력하세요'; inp.focus(); return; }
        lsSet(LS.nick, nick); send.disabled = true; msg.style.color = '#9aa3b8'; msg.textContent = '올리는 중…';
        call('POST', '/score', { did: did(), nick: nick, fac: res.fac, stage: res.stage, time: res.time, base: res.base, lost: res.lost, kills: res.kills, units: res.units, cards: res.cards, ver: DG.GAME_VER || DG.RANK.ver })   /* 버전 = 그 판의 게임 버전(화면 왼쪽 위 숫자)이 저절로 들어간다 (2026-11-23 사용자) — 전에는 손으로 올리던 README 번호 */.then(function (d) {
          if (!d || !d.ok) throw new Error('fail');
          g._rankSent = sentKey; msg.style.color = '#8fe89a';
          msg.textContent = d.best ? d.rank + '위 / ' + d.total + '명 — 내 최고 기록입니다' : '전에 올린 기록(' + mmss(d.time) + ')이 더 ' + (res.fac === 'surv' ? '깁니다' : '빠릅니다') + ' — ' + d.rank + '위 / ' + d.total + '명';
          line.style.display = 'none'; view.fac = res.fac; view.stage = res.stage; tabs(); load();
        }).catch(function () { send.disabled = false; msg.style.color = '#ff9a8a'; msg.textContent = '올리지 못했습니다. 잠시 뒤 다시 눌러 주세요'; });
      };
      send.onclick = go; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    }
    if (sv && !res && sv.msg) { subBox.style.display = 'flex'; subBox.appendChild(el('div', 'color:#9aa3b8;font-size:12px;', sv.msg)); }   /* 올릴 수 없는 판: 까닭 한 줄 */
    tabs(); load();
  };
})(typeof window !== 'undefined' ? window : globalThis);
