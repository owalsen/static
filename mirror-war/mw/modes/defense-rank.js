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
  var VER = '266';                                           // 게임 버전 = README 번호 (참고용 — 밸런스를 바꾼 배포 때 올린다)
  DG.RANK = { api: API, ver: VER };
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

  /* 순위 창을 연다. won = 이긴 화면에서 열었다(이번 기록을 올릴 수 있다) */
  P._rankShow = function (won) {
    var g = this; if (g.rankOpen) return;
    var res = won ? g._rankResult() : null, F = DG.FACTIONS, view = { fac: g.faction, stage: g.stageI || 0 }, sentKey = res ? res.fac + ':' + res.stage + ':' + res.time : '';
    var wrap = el('div', 'position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(6,8,12,.72);touch-action:manipulation;');
    var box = el('div', 'box-sizing:border-box;width:min(360px,94vw);max-height:92vh;display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:10px;border:1px solid #6b5a33;background:#12151d;color:#dfe6f5;font:13px sans-serif;');
    var head = el('div', 'display:flex;align-items:center;justify-content:space-between;');
    head.appendChild(el('b', 'font-size:17px;color:#ffd36e;', '순위'));
    var closeB = el('button', BTN, '닫기'); head.appendChild(closeB); box.appendChild(head);
    var subBox = el('div', 'display:none;flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:#1b2130;border:1px solid #2c3446;'); box.appendChild(subBox);
    var facRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap;'), stRow = el('div', 'display:flex;gap:6px;flex-wrap:wrap;'); box.appendChild(facRow); box.appendChild(stRow);
    var list = el('div', 'flex:1 1 auto;min-height:120px;overflow-y:auto;border-radius:8px;background:#0d1017;border:1px solid #232a3a;'); box.appendChild(list);
    var foot = el('div', 'min-height:16px;color:#9aa3b8;font-size:12px;text-align:center;'); box.appendChild(foot);
    wrap.appendChild(box); doc.body.appendChild(wrap); g.rankOpen = true;
    var close = function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); g.rankOpen = false; };
    closeB.onclick = close; wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap) close(); });
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'wheel', 'touchstart'].forEach(function (t) { box.addEventListener(t, function (e) { e.stopPropagation(); }); });

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
          more.appendChild(el('div', '', '남은 기지 ' + r.base + ' · 잃은 아군 ' + r.lost + ' · 처치 ' + r.kills));
          if (r.units && r.units.length) more.appendChild(el('div', '', '소환: ' + r.units.slice(0, 8).map(function (u) { return u[0] + ' ' + u[1]; }).join(', ')));
          if (r.cards && r.cards.length) more.appendChild(el('div', '', '카드: ' + r.cards.slice(0, 10).join(', ')));
          row.appendChild(more); row.onclick = function () { more.style.display = more.style.display === 'none' ? 'block' : 'none'; };
          list.appendChild(row);
        });
        foot.textContent = d.me ? '내 기록 ' + mmss(d.me.time) + ' — ' + d.me.rank + '위 / ' + d.total + '명' : d.total ? '기록 ' + d.total + '명 · 줄을 누르면 편성이 보입니다' : '';
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
      subBox.appendChild(el('div', 'color:#8fe89a;font-weight:bold;', F[res.fac].name + ' ' + (res.stage + 1) + '단계 클리어 — ' + mmss(res.time)));
      var line = el('div', 'display:flex;gap:6px;');
      var inp = el('input', 'flex:1 1 auto;min-width:0;box-sizing:border-box;padding:7px 8px;border-radius:6px;border:1px solid #3a4152;background:#0d1017;color:#fff;font:14px sans-serif;');
      inp.maxLength = 12; inp.placeholder = '닉네임 (12자까지)'; inp.value = lsGet(LS.nick); inp.autocomplete = 'off';
      var send = el('button', BTN, '기록 올리기'); line.appendChild(inp); line.appendChild(send); subBox.appendChild(line);
      var msg = el('div', 'min-height:15px;font-size:12px;color:#9aa3b8;', '닉네임·기록·편성이 순위표에 공개됩니다'); subBox.appendChild(msg);
      var go = function () {
        var nick = inp.value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12); if (!nick) { msg.style.color = '#ff9a8a'; msg.textContent = '닉네임을 입력하세요'; inp.focus(); return; }
        lsSet(LS.nick, nick); send.disabled = true; msg.style.color = '#9aa3b8'; msg.textContent = '올리는 중…';
        call('POST', '/score', { did: did(), nick: nick, fac: res.fac, stage: res.stage, time: res.time, base: res.base, lost: res.lost, kills: res.kills, units: res.units, cards: res.cards, ver: DG.RANK.ver }).then(function (d) {
          if (!d || !d.ok) throw new Error('fail');
          g._rankSent = sentKey; msg.style.color = '#8fe89a';
          msg.textContent = d.best ? d.rank + '위 / ' + d.total + '명 — 내 최고 기록입니다' : '전에 올린 기록(' + mmss(d.time) + ')이 더 빠릅니다 — ' + d.rank + '위 / ' + d.total + '명';
          line.style.display = 'none'; view.fac = res.fac; view.stage = res.stage; tabs(); load();
        }).catch(function () { send.disabled = false; msg.style.color = '#ff9a8a'; msg.textContent = '올리지 못했습니다. 잠시 뒤 다시 눌러 주세요'; });
      };
      send.onclick = go; inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    }
    tabs(); load();
  };
})(typeof window !== 'undefined' ? window : globalThis);
