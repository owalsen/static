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
    TIME: 600, SHOWN: 7,   /* 328번: 7웨이브(7분) 뒤 '최후의 3분'(RAGE)까지 한 판 10분 */
    RAGE: { show: 3.4, at: q('rageat', 420), hp: q('ragehp', 2), minHit: q('ragehit', 0.2), spd: 1.2 },   /* 2026-11-20 사용자 "7분 이후에는 전체 몹들이 7분대보다 2배 이상 강해져서 10분까지 지속. 한 대 맞으면 1/5 이상은 무조건 닳게. 공속과 걷기 빠르기는 1.2배": at 초부터 적 체력 × hp(그때 살아 있던 적도), 한 대 피해가 적어도 최대 체력 × minHit, 걸음·휘두르기·공격 대기 × spd */         // 한 판 7분, 화면에 보이는 웨이브 7단계 (319번, 2026-11-20 사용자 "10웨이브가 길게 느껴져서 7까지로, 대신 어려움 굴곡은 똑같이"): 아래 WAVE.list 의 난이도 10칸은 그대로 두고 한 칸을 60초 → 42초로 — 같은 굴곡을 7분에 지난다. 화면의 '웨이브 n/7' 은 1분마다
    STICK: { r: 44, dead: 5 },   // 가상 조이스틱: 누른 곳이 중심, r 만큼 끌면 최고 속도, dead 안쪽은 멈춤
    SAFE: { top: 20, bottom: 24 },   // 디펜스의 SAFE 와 같다 (상태 표시줄·홈 막대 자리)
    SLOTS: 6,
    /* 전투 (2단계). 수치는 원작에서 출발: 피해 = 원본 피해 공식(rules.damage), 적 걷는 속도 = 디펜스와 같은 식(walkPx × 틱 × 0.45) */
    ATK: { sec: q('atk', 0.8), lv: q('atklv', 0.016), min: 0.4, range: q('range', 170), shot: q('shot', 840), dmg: q('dmg', 1.32), life: 0.45, anim: 2.4 },   // 단도 던지기: 간격(초)·사거리(화면 폭 절반 안쪽)·단도 속도·피해 배수(원본 공격값 19 → 25: 첫 무리 해골전사(체력 52)·좀비(73) 모두 세 방 — 2026-11-19 사용자 요청, 전에는 2.8 = 53 으로 해골전사 한 방). 도둑의 모든 스킬 피해가 이 값에 곱해진다
    FOE: { dmg: q('edmg', 0.52), hp: q('ehp', 1), reach: 24, rs: 0.07, rangeMax: 150, from3: 2, range3: q('erange', 210), shot: q('eshot', 190), sep: 20, body: 20, far: 1000 },   // 적: 피해·체력 배수, 근접 닿는 거리, 사거리 배율(디펜스 RANGE_SCALE)·원거리 상한, from3 단계(0부터)부터 원거리 적은 모두 사거리 range3 — 도둑 단도(170) 밖에서 멈춰 쏜다 (2026-11-19 사용자 "적 투사체가 없어서 쉬워, 3단계부터 투사체 날아오게" — 전에는 150 이라 쏘기 전에 단도에 쓰러졌다), 적 발사체 속도(170 → 190), 서로 밀어내는 거리, 이보다 멀어지면 화면 둘레로 다시 보낸다
    CRIT: { p: q('crit', 0.1), mul: 2, p2: q('crit2', 0.15), mul2: 4 },   // 치명타(붉은보석 도둑에서): 확률·피해 배수. 더블 크리티컬 = 치명타가 났을 때 p2 확률로, 피해 mul2 배. 숫자 색: 보통 흰색 · 치명타 노랑 · 더블 붉은색 (NUM)
    BOOM: { touch: 30, radius: 46 },   // 좀비 자폭: 닿으면 터진다
    DEF: { lvk: q('deflv', 0.25), min: q('dmin', 0.3), lateLv: q('latelv', 30), lateK: q('latek', 0.04) },   // lateLv·lateK (343번, 2026-11-20 사용자 "고레벨 이후에는 맞아도 체력이 거의 안 달아서 몹들의 공격이 강해져야"): 도둑 레벨 lateLv 를 넘으면 레벨마다 적 피해 +lateK (레벨 40 ×1.4 · 50 ×1.8 · 60 ×2.2)   // 도둑이 받는 피해 (294·295번): 방어 계산에 넣는 레벨 = 도둑 레벨 × lvk (원작 방어 = def + defGrow×레벨/4 → 레벨 40 이면 25 라 후반 적이 전부 1 을 쳤다. 0.25 면 5 + 레벨/8), min = 방어가 아무리 높아도 적 공격값의 이 비율은 들어간다
    HURT: { inv: 0.25, flash: 0.35 },  // 도둑이 맞은 뒤 무적 시간(여럿이 한 틱에 겹쳐 치는 것 방지)·화면 가장자리 붉은 빛
    /* 웨이브 10단계 (4단계, 2026-11-19 사용자 안: 처음엔 쉬운 적, 10단계로 갈수록 모든 유닛). 1분에 한 단계.
       add = 그 단계에 새로 나오는 유닛(세 진영 모두 — 기본 공격이 있는 유닛만). 뽑힐 비중: 새로 나온 단계 3 · 한 단계 전 2 · 두 단계 전 1 · 그보다 옛것 0.4 — 10단계는 전부 같은 비중(모든 유닛이 다 나온다).
       rate = 초당 마릿수, cap = 살아 있는 적 상한, hp = 체력 배수. boss = 그 단계가 시작될 때 나오는 우두머리 [유닛, 체력 배수] */
    WAVE: { sec: q('wavesec', 42), margin: 50, list: [
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
    /* 레벨 스케일링 (318번, 2026-11-20 사용자: "몹들의 공격력과 체력이 플레이어가 강해지는 만큼 강해지는 시스템 — 디아블로4 의 레벨 스케일링처럼. 조절할 수 있게 계수도. 어떤 판은 레벨과 동일하게, 어떤 판은 레벨의 70% 로 약해서 시원하게"):
       적 레벨 = 1 + (도둑 레벨 − 1) × k.   k = 판의 계수 (1 = 도둑과 같은 레벨, 0.7 = 70% — 시원한 판, 1.2 = 더 센 판, 0 = 끔: 예전처럼 웨이브 표의 체력 배수만).
       적 체력 = 기본 × (1 + hp × (적 레벨 − 1)) × 웨이브 체력 배수^wave   (스폰할 때의 적 레벨로 정해진다. 웨이브 배수는 wave 제곱으로 눌러 "시간" 몫을 조금만 남긴다)
       적 피해 = 기본 × (1 + atk × (적 레벨 − 1))                          (맞는 순간의 적 레벨)
       hp·atk = 적 레벨 1당 늘어나는 비율 — 도둑은 레벨 1당 한 방 피해가 약 +5%, 최대 체력이 약 +5% 늘어난다 */
    SCALE: { k: q('scale', -1), pool: [[0.7, '시원한 판'], [0.85, '보통 판'], [1, '팽팽한 판']],   /* k 가 주소(?scale=)에 없으면 판마다 pool 에서 하나를 고른다 — 첫 웨이브 알림과 결과 화면에 보인다 */ hp: q('scalehp', 0.032), atk: q('scaleatk', 0.003), wave: 0.25 },
    /* 화염 포격 (344번, 2026-11-23 사용자: "5단계 때는 흑마술사 또는 요마술사들의 대부대가 깜짝 등장해서 파이어볼을 다량으로 날리고 그걸 피하는 재미 — 거의 비행기 슈팅게임의 미사일 피하기 하듯"):
       at 초(보이는 5웨이브가 시작되고 조금 뒤)에 warn 초 예고 → 도둑 둘레 타원(rx·ry — 화면 가장자리)에 술사 n 기가 한꺼번에 나타나 sec 초 동안 **제자리에서** 화염구를 쏜다. 술사마다 aim 초에 한 발씩 도둑을 겨누고(서로 엇갈리게), fan 초마다 술사 fanFrom 기가 부채꼴 fanN 발을 흩뿌린다.
       화염구는 느리고(speed — 도둑 걸음 88 보다 조금 빠름) 크게 보인다(플레임 윈드 그림) — 틈을 보고 피한다. 그동안 다른 적이 나오는 수는 × spawnK. 포격이 끝나면 술사들은 보통 적처럼 다가온다. 피해 = 술사의 기본 피해 × dmg */
    BARRAGE: { n: q('barrn', 14), rx: 172, ry: 290, warn: 2.2, sec: q('barrsec', 13), aim: 1.5, fan: 3.4, fanFrom: 3, fanN: 5, spread: 0.22, speed: q('barrspd', 118), life: 4.6, dmg: q('barrdmg', 0.8), spawnK: 0.25, hp: 1, lag: 80,
      /* list = 포격 차례 (346번, 2026-11-23 사용자 "포격을 6에도 넣어 줘 — 장로의 장풍으로. 그런데 포격이 맵을 옮기면 지나치니까 맵 옮길 때마다 가장자리에서 등장하게"): 보이는 5웨이브 = 흑마술사·요마술사의 화염구(fire), 6웨이브 = 장로의 장풍(wind — 조금 빠르고, 부채꼴은 3발을 넓게). 항목에 적은 값은 위의 공통 값을 덮는다.
         술사는 도둑 둘레의 제 자리(각도)를 지킨다 — 도둑이 걸어가 그 자리에서 lag 넘게 벗어나면 **지금 화면의 가장자리 제 자리에 다시 나타난다**(포격을 걸어서 따돌릴 수 없다) */
      list: [{ at: q('barrat', 250), ids: [49, 50], kind: 'fire', name: '화염 포격' }, { at: q('barrat2', 310), ids: [13], kind: 'wind', name: '장풍 포격', speed: 132, fanN: 3, spread: 0.34, aim: 1.35, dmg: 0.85 }] },
    /* 후반 적 투사체·마법 (304번, 2026-11-20 사용자 "후반에 갈수록 적의 투사체가 더 강력해지고 마법이 강력하고 더 다양하게"):
       SHOT.k·v = 웨이브별 적 투사체 피해·속도 배수(6단계부터 오른다).
       MAGIC = from 단계(0부터)부터 화면 근처의 마법 유닛(ids) 하나가 every 초마다 마법을 쓴다(every = [시작 단계 값, 10단계 값]). kinds = [이 단계부터, 종류] — 단계가 오를수록 종류가 늘어난다.
         fan 부채꼴 3~5발 · blast 도둑 자리에 붉은 원 예고 뒤 폭발(피하면 안 맞음) · frost 맞으면 느려지는 냉기탄 · orb 천천히 따라오는 큰 구체 · rain 도둑 둘레 여러 곳에 예고 뒤 폭발.
       피해 = 그 유닛의 기본 피해(_foeDmg) × SHOT.k × 종류의 dmg */
    SHOT: { k: [1, 1, 1, 1, 1, 1.15, 1.3, 1.5, 1.7, 2], v: [1, 1, 1, 1, 1, 1.05, 1.1, 1.18, 1.26, 1.35] },
    /* 마법 포격 (README 353, 2026-11-23 사용자 "최후의 3분에선 마법도 맵에 시전되는 위치를 먼저 알려주고 그 후에 광역기 마법 다수가 떨어지는(마치 포격처럼) 단계도 추가. 플레이어에게 알려는 주되 최대한 피하기 어렵게"):
       최후의 3분이 시작되고 first 초 뒤부터 every 초마다 한 차례. 한 차례 = vol 번의 일제 낙하(gap 초 간격), 한 번에 n 자리 — 붉은 원이 warn 초 동안 차오른 뒤 터진다(반경 r, 그 안이면 맞는다. 피해는 최후의 3분의 최소 피해 = 최대 체력의 20%).
       자리: lead = 지금 걷는 방향으로 (warn 초 동안 걸을 거리 × 이 값)만큼 앞 — 서 있는 자리·반쯤 간 자리·끝까지 간 자리를 막아 곧게 걸어서는 못 피한다. 나머지는 둘레 ring[0]~ring[1] 에 고르게 흩어 빠져나갈 틈을 좁힌다 */
    /* 구급 물약 (README 356, 2026-11-23 사용자 "피가 20% 이하로 떨어지면 플레이어의 이동 방향에 미리 포션을 한 개씩 떨궈서 쉽게 죽지 않게"): 체력이 최대의 hp 이하이고 바닥에 구급 물약이 없고 앞의 것을 놓은 지 cd 초가 지났으면, 걷는 방향(서 있으면 마지막으로 걷던 방향)으로 ahead 만큼 앞에 회복 아이템 하나 */
    /* 성소 (README 357, 2026-11-23 사용자 "성소(구조물)를 만들어서 후반 싸움에 도움 얻어 갈 수 있게 — 디아블로2의 체력 채우기나 마법 강화나 물리 공격 강화 등등" → 설계안 → "권장안대로"):
       from 초(4웨이브)부터 every 초마다(최후의 3분에는 everyRage) 주인공에게서 dist 떨어진 곳에 하나. 한 번에 하나, life 초 안에 안 쓰면 사라진다. 닿으면(touch) 바로 발동.
       life = 체력 전부 / war = 주는 피해 × dmg / magic = 스킬 쿨타임이 cd 배로 빨리 돈다 / guard = 받는 피해 × take (최후의 3분의 최소 피해에도 먹힌다) — 뒤 셋은 sec 초. 같은 종류는 시간만 새로, 다른 종류끼리는 함께.
       그림 = 디펜스 건물 시트의 푸른 둥근 지붕 건물(pic)을 scale 배로 + 종류 색 빛. 화면 밖이면 가장자리에 종류 색 화살표 */
    SHRINE: { from: q('shrinefrom', 210), every: q('shrineevery', 70), everyRage: 55, dist: [260, 340], life: 40, touch: 30, sec: q('shrinesec', 12), heal: 0.5,   /* 361번(2026-11-23 사용자 "성소도 제거하지 말고 영향 약하게"): 간격 55·40 → 70·55초, 지속 20 → 12초, 생명 = 전부 → 최대 체력의 heal, 전투 +40 → +25%, 마력 2 → 1.5배, 수호 절반 → 30% 감소 */ pic: 18, scale: 0.34,
      kinds: { life: { name: '생명의 성소', note: '체력 50% 회복', col: '#7be07a', rgb: '110,230,120' }, war: { name: '전투의 성소', note: '피해 +25%', col: '#ff8a6a', rgb: '255,120,80', dmg: 1.25 },
        magic: { name: '마력의 성소', note: '쿨타임 1.5배 빠름', col: '#7fbcff', rgb: '110,170,255', cd: 1.5 }, guard: { name: '수호의 성소', note: '받는 피해 -30%', col: '#ffd35a', rgb: '255,205,80', take: 0.7 } } },
    RESCUE: { hp: q('rescuehp', 0.2), cd: q('rescuecd', 15), ahead: 62 },   /* 358번(2026-11-23 사용자 "구급 물약 간격을 늘려 줘"): 8 → 15초 — 8초일 때 무사 봇이 처음으로 10분을 버텼다 */
    STORM: { first: q('stormat', 14), every: q('stormevery', 38), vol: q('stormvol', 4), gap: 1.15, n: q('stormn', 8), r: 44, warn: q('stormwarn', 0.95), dmg: 1, lead: [0, 0.55, 1.05], ring: [66, 150], nUp: 1, potion: q('stormpot', 2), potR: [46, 84] },   /* nUp = 차례가 거듭될 때마다 한 번에 떨어지는 자리 +1 (8 → 12). potion = 한 차례가 다 지나가면 주인공 둘레 potR 거리에 회복 아이템(고기)을 이만큼 뿌린다 (2026-11-23 사용자 "한 번 지나면 포션을 두어 개 뿌려서 회복할 수 있게") */
    MAGIC: { from: q('magicfrom', 5), every: [q('magicevery', 7), 3.2], near: 340, ids: [11, 33, 49, 12, 25, 16, 50, 26, 9, 13, 27, 51, 19, 21, 59, 61, 62, 20, 63, 64, 67, 58],
      kinds: [[5, 'fan'], [6, 'blast'], [7, 'frost'], [8, 'orb'], [9, 'rain']],
      fan: { n: [3, 5], spread: 0.26, dmg: 1.1, life: 2.4 }, blast: { r: 48, warn: 1.0, dmg: 2.2 }, frost: { slow: 0.6, sec: 2.2, dmg: 0.9, v: 1.25, life: 2 },
      orb: { speed: 100, turn: 2.0, life: 4.5, dmg: 1.8 }, rain: { n: 5, r: 38, warn: 1.15, spread: 115, dmg: 1.7 } },
    /* 중간 우두머리 (2026-11-19 사용자 "중간보스 더 자주 등장해서 압박"): 2단계부터 단계마다 at 초에 mini: [유닛, 체력 배수] 하나. 우두머리처럼 멈춤·묶임·감속이 안 걸리고 피해 ×BOSS.dmg, 보상은 작다(경험치 gem, 회복 heal, 회복 아이템 확정 없음) */
    MINI: { ats: [q('miniat', 8), 29], hpk: q('minihp', 2), dmg: q('minidmg', 3.2),   /* 320번(2026-11-20 사용자 "중간 보스도 더 자주 나와야 하고 지금보다 2배는 더 강하고 단단해야"): 난이도 칸(42초)마다 한 번 → 두 번(ats 초), 체력 ×hpk, 피해 = 우두머리 배수 1.6 의 두 배 */ at: 21, scale: 1.25, gem: 4, heal: 0 },   // 처음엔 체력 10~16배·경험치 12·회복 10 → 봇이 쉽게 잡아 경험치 보너스가 됐다(셋 다 생존, 3분에 레벨 17) → 체력 20~28배, 경험치 4, 회복 없음
    /* 섀도우 인필트레이터의 근접 검술 (2026-11-19 사용자 "섀도우 스킬이 차별점이 없어 — 근접 위주로, 전직 뒤 스킬셋을 처음부터 다시", 모습은 마법전사): armor = 받는 피해 배수, killHeal = 베어 쓰러뜨릴 때 체력, healCap = 처치 회복의 초당 상한(최대 체력 비율) — 2026-11-19 사용자 "어쌔신이 너무 강해서 후반에는 체력도 안 닳고 스킬도 너무 자주 씀": armor 0.8 → 0.9, killHeal 0.5 → 0.15, 상한 새로, arc = 베기 반각(라디안, 1.2 ≈ 70° — 처음 1.75 는 봇이 5분에 레벨 29, 너무 셌다), comboMax = 연속 베기가 더 치는 적 수(가까운 순), after = 잔상이 다시 베기까지(초), arcLife = 칼자국 보이는 시간 */
    BLADE: { melee: q('bmelee', 60),   /* 40 → 60 (337번, 사용자 "근접 공격 사거리 조금 더 늘려서 좀비 자폭 거리 벗어나게" — 좀비는 30 안에서 터지고 46 안이면 맞는다. 40 이면 벨 때 늘 폭발 범위 안이었다). 수직 베기가 나가는 거리 (329번, 사용자 "적에게 아주 가까이 붙었을 때만 일반 공격해") — 전에는 90 안이면 휘둘렀다 */ atk: q('batk', 0.7), spd: q('bspd', 1.25),   /* 어쌔신 너프 (315번, 2026-11-20 사용자 "어쌔신 웨이브 4에서부터 너무 세짐. 공속을 낮추고, 공격력도 낮춰 줘"): atk = 어쌔신의 모든 피해 배수(검술·궁극기·기습), spd = 기본 베기 간격 배수(1.25 = 25% 느리게) */ armor: 0.92, killHeal: 0.1, healCap: 0.02,   /* 320번: 무사의 길 봇이 계수 1 에서 4/4 생존(받은 피해가 최대 체력의 5~8배 — 회복이 과했다) → 0.95·0.06·1.2% 로는 0/4 가 되어 중간값: 받는 피해 −8%, 처치 회복 0.1, 초당 회복 한도 2% */ arc: 1.2, comboMax: 3, after: 0.6, arcLife: 0.24 },
    BOSS: { pace: { on: q('bpace', 1), burst: 2.8, rest: 2.6, restSpd: 0.45 },   /* 완급 (344번, 2026-11-23 사용자 "보스급의 이속·공속이 플레이어보다 항상 빠르지 않고 완급 조절이 필요함 — 붙으면 계속 맞으니까"): 우두머리·중간 우두머리는 burst 초 동안 쫓아와 치고 rest 초 동안 숨을 고른다 — 그동안 걸음 × restSpd, 새 공격을 시작하지 않는다(휘두르던 것은 끝낸다). 박자는 나타난 때부터 센다 */ scale: 1.5, dmg: 1.2, speed: 1.15, gem: 30, heal: 30, chase: q('bchase', 1.1), miniChase: 1.02, swing: 1.3, lunge: 1, reach: 2, hitReach: 2.3, cdK: 0.65,   /* 처음 값(1.25·1.5·1.5·2.4·2.7·0.5)은 봇이 첫 우두머리(2분 6초)에서 전부 쓰러졌다 */ mini: { swing: 1.2, lunge: 0, reach: 1.7, hitReach: 2, cdK: 0.8 } },   /* mini = 중간 우두머리는 덜 (큰 우두머리와 같은 값은 봇이 전부 1분 30초 안에 쓰러졌다 — 2단계부터 나와 레벨 5~8 일 때 만난다) */   /* 327번(2026-11-20 사용자 "보스 몹이 느리고 공속도 느려서 플레이어가 한 대도 안 맞음"): 우두머리·중간 우두머리는 걸음이 적어도 도둑 속도 × chase(중간 우두머리 miniChase), 휘두르는 동작 × swing, 휘두르는 동안 도둑 쪽으로 파고든다(걸음 × lunge), 닿는 거리 × reach(맞는 판정 hitReach), 공격 대기 × cdK */   // 우두머리: 그림 배율, 피해·속도 배수, 떨어뜨리는 경험치, 쓰러뜨리면 도둑 체력 회복
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
    [26, 64].forEach(function (a) { var d = D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); });   /* 천지파열무의 불꽃: 데빌의 플레임 윈드(26, 불꽃 한 송이)와 폭발 함정의 불구름(64). 플레임 헬(27)은 불꽃 고리 뒤에 별 모양이 나오는 고유한 모양이라 쓰지 않는다 — 사용자 "플레임 헬의 모양을 그대로 갖고 오면 안 되고 불꽃만" (327번) */
    this._need(ids); this._need([56, 15, 59, 68]);   /* 68 = 개미 (트래퍼 궁극기의 폭탄 개미) */   // 59 = 환술사 (트래퍼의 모습)
      // 15 = 마법전사 (섀도우 인필트레이터로 전직하면 이 모습)
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
    this.foes = []; this.shots = []; this.effects = []; this.texts = []; this.nums = []; this.bursts = []; this.feverUntil = 0; this.feverT0 = 0; this.ringT = -9; this.aimUntil = 0; this.crit = CFG.CRIT.p; this.spawnAcc = 0; this.wave = 0; this.waveOn = false; this.bossWait = null; this.miniDone = -1; this.miniWave = -1; this.miniN = 0; this.rushIn = null; this.rushWarn = null; this.siegeIn = null; this.siegeWarn = null; this.supIn = {}; this.magicIn = null; this.barr = null; this.barrNext = 0; this.rageOn = false; this.rageSoon = false; this.rageT = -99; this.shownWave = 0; var SP0 = CFG.SCALE.pool[Math.floor(this.D.rng.next() * CFG.SCALE.pool.length)]; this.scaleK = CFG.SCALE.k >= 0 ? CFG.SCALE.k : SP0[0]; this.scaleName = CFG.SCALE.k >= 0 ? '' : SP0[1]; this.shrine = null; this.shrineNext = CFG.SHRINE.from; this.shrineLast = null; this.buff = { war: 0, magic: 0, guard: 0 }; this.storm = null; this.rescueT = 0; this.lastV = null; this.marks = []; this.chillUntil = 0; this.banner = null; this.stat = { dealt: 0, maxHit: 0, taken: 0, crit: 0, dbl: 0, boss: 0 }; this.over = null; this.overT = 0; this.dieSndT = -9;
    this._growReset();
    var n0 = q('n', 0); for (var i = 0; i < n0; i++) this._spawn();   // ?n=250: 시작하자마자 그만큼 (성능 시험)
  };

  /* ───────── 매 프레임 (D._frame 이 부른다) ───────── */
  P.frame = function (dt) {
    var D = this.D;
    if (D.time - (D._groundAt || 0) > 0.5 && D.terrain) D._makeGround();   // 아이폰이 보조 캔버스를 비우는 문제의 복구 (defense.js _frame 과 같은 이유)
    for (var k = 0; k < CFG.TS; k++) {
      if (!this.menu && !D.paused && this.ready()) { if (this.guide) this.guideT += dt; else if (this.cards) this.cardT += dt; else if (this.info) this.infoT += dt; else if (this.over) { this.overT += dt; if (this.hero.state === 'dead') this.hero.deadT += dt; } else this.update(dt); }
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
  P._rage = function () { return this.t >= CFG.RAGE.at; };
  P._shown = function () { return Math.min(CFG.SHOWN, Math.floor(this.t / (CFG.WAVE.list.length * CFG.WAVE.sec / CFG.SHOWN)) + 1); };   // 화면에 보이는 웨이브 번호 (1~7)
  P._foeLv = function () { return 1 + (this.lv - 1) * this.scaleK; };   // 적 레벨 (레벨 스케일링)
  P._hpK = function (w) { var S = CFG.SCALE, W = CFG.WAVE.list[w == null ? this.wave : w]; return (this._rage() ? CFG.RAGE.hp : 1) * (this.scaleK > 0 ? (1 + S.hp * (this._foeLv() - 1)) * Math.pow(W.hp, S.wave) : W.hp); };   // 적 체력 배수
  P._atkK = function () { var S = CFG.SCALE; return this.scaleK > 0 ? 1 + S.atk * (this._foeLv() - 1) : 1; };   // 적 피해 배수
  P._spawn = function (bossId, bossHp, pos, plain) {   // pos = 나타날 자리(없으면 화면 둘레), plain = 유닛을 지정하되 우두머리는 아님(포위·치유형·소환형·불러낸 적)
    var D = this.D, W = CFG.WAVE.list[this.wave], id = bossId;
    if (id == null) { var pool = this._pool(), tw = 0, i; if (!pool.length) return null; for (i = 0; i < pool.length; i++) tw += pool[i][1]; var r = D.rng.next() * tw; for (i = 0; i < pool.length - 1 && r >= pool[i][1]; i++) r -= pool[i][1]; id = pool[i][0]; }
    var p = pos || this._edgePoint(), u = this._unit(id, 1, p[0], p[1]), t = u.t;
    u.life = Math.round(u.maxHp * CFG.FOE.hp * this._hpK() * (bossHp || 1) * (bossId != null && !plain && this.scaleK > 0 ? W.hp / Math.pow(W.hp, CFG.SCALE.wave) : 1)); u.life0 = u.life;   /* 우두머리의 체력 배수는 웨이브 배수와 곱해 맞춰 둔 값이라 웨이브 몫은 그대로 둔다 */   // 적의 체력은 life 로 센다 — u.hp 는 가득 둔다(_drawUnit 이 닳은 유닛마다 체력 바를 그려 수백 기면 화면을 덮는다). 우두머리만 체력 바를 보인다
    if (bossId != null && !plain) { u.boss = true; u.born = this.D.time; u.maxHp = u.life; u.hp = u.life; u.spd0 = u.speedPx * CFG.BOSS.speed; u.speedPx = Math.max(u.spd0, this.speed * CFG.BOSS.chase); }
    u.boom = t.acts.filter(function (a) { return a && a.suicide && a.dmg; })[0] || null;   // 자폭 유닛(좀비)
    if (!u.act && !u.boom) u.act = t.acts.filter(function (a) { return a && a.dmg; })[0] || null;
    var rp = u.act ? u.act.range * CFG.FOE.rs : 0; u.ranged = rp > 80; u.reach = u.ranged ? (this.wave >= CFG.FOE.from3 ? CFG.FOE.range3 : Math.min(CFG.FOE.rangeMax, rp)) : CFG.FOE.reach;
    if (u.boss) u.boom = null;
    u.state = 'move'; u.cd = 0; this.foes.push(u); return u;
  };
  P._fx = function (x, y, arm) { var d = this.D.data.fx.arms[arm], f = d && (d.hit.length ? d.hit : d.fly.length ? d.fly : d.seq); if (f && f.length) this.effects.push({ x: x, y: y, f: f, t0: this.D.time, add: !d.dir }); };
  P._hitFoe = function (u, dmg, arm, big, cb) {   // cb = 이 한 방에만 더하는 치명타 확률 (크레이지 샷 — 상한 ULT.venom.critCap)
    if (u.state === 'dead') return; var D = this.D; u.hitT = D.time;
    if (u.vulnUntil > D.time) dmg *= 1 + (u.vuln || 0);      // 독 단도·유독가스: 받는 피해 증가
    if (dmg < 1e5 && this.buff && D.time < this.buff.war) dmg *= CFG.SHRINE.kinds.war.dmg;   /* 전투의 성소 */
    if (this.cls === 'shadow') { var lr = u.life / (u.maxHp * CFG.FOE.hp); if (lr <= 0.2) dmg *= 1.6; else if (lr <= 0.5) dmg *= 1.3; }   // 섀도우 인필트레이터: 마무리 일격
    var kind = 'n', cp = cb ? Math.min(ULT.venom.critCap, this.crit + cb) : this.crit; if (dmg < 1e5 && D.rng.next() < cp) { if (D.rng.next() < (this.crit2 || CFG.CRIT.p2)) { kind = 'd'; dmg *= CFG.CRIT.mul2; } else { kind = 'c'; dmg *= CFG.CRIT.mul; } }
    if (dmg < 1e5) { if (this.nums.length > 90) this.nums.shift(); for (var qi = 0; qi < this.nums.length; qi++) if (this.nums[qi].u === u) { this.nums[qi].lift += 12; this.nums[qi].old = true; }   // 새 숫자가 뜨면 그 적의 앞선 숫자는 위로 밀려 올라가며 작아진다 (붉은보석처럼 쌓인다)
      this.nums.push({ u: u, x: u.x + (D.rng.next() - 0.5) * 8, y: u.y - u.headY - 2, lift: 0, v: Math.max(1, Math.round(dmg)), k: kind, t0: D.time }); }
    if (arm === this.hero.act.arm) this.bursts.push({ x: u.x, y: u.y - u.headY * 0.5, t0: D.time, a: D.rng.next() * 6.28, k: kind, life: (kind === 'n' ? 0.16 : 0.26) * (big ? 1.25 : 1), sc: big || 0 }); else if (arm >= 0) this._fx(u.x, u.y - u.headY * 0.5, arm);   // 단검이 맞으면 흰 별 모양 섬광
    var dd = Math.max(1, Math.round(dmg)), ST = this.stat; if (dd < 1e5) { ST.dealt += Math.min(dd, u.life); if (dd > ST.maxHit) ST.maxHit = dd; if (kind === 'c') ST.crit++; else if (kind === 'd') ST.dbl++; }
    u.life -= dd; if (u.boss) u.hp = Math.max(0, u.life); if (u.life > 0) return;
    if (u.boss) { if (u.mini) ST.mini = (ST.mini || 0) + 1; else ST.boss++; var hh = this.hero; hh.hp = Math.min(hh.maxHp, hh.hp + (u.mini ? CFG.MINI.heal : CFG.BOSS.heal)); this.banner = { s: u.t.name + ' 처치!', t0: D.time, col: '#ffd36e' }; }
    u.state = 'dead'; u.deadT = 0; u.fade = 0; this.kills++; this._drop(u);
    if (u.toxUntil > D.time && this.sk.toxdag) { var TX = SK.toxdag, tl = u.toxLv || 1, RC2 = 1 + this._pv('reach'); if (this.zones.length < 14) this.zones.push({ x: u.x, y: u.y, r: TX.r(tl) * RC2, until: D.time + TX.csec * (1 + this._pv('last')), next: D.time, mul: TX.cloud(tl), v: 0, t0: D.time }); this.puffs.push({ x: u.x, y: u.y, r: TX.r(tl) * RC2, t0: D.time }); }   // 독 묻힌 단도: 중독된 채 쓰러지면 독 구름
    if (u.darkUntil > D.time && this.sk.darkdag) { var DK = SK.darkdag, dl = u.darkLv || 1, selfD = this, bx = u.x, by = u.y; this.queue.push({ at: D.time + 0.08, fn: function () { var rr = DK.r(dl) * (1 + selfD._pv('reach')); selfD._blast(bx, by, DK.r(dl), DK.boom(dl), null); selfD.bursts.push({ x: bx, y: by - 8, t0: selfD.D.time, a: 0, k: 'k', life: 0.38, r: rr }); selfD.D._play(5064, 0.35); } }); }   // 암흑 단도: 감염된 채 쓰러지면 폭발 (조금 늦게 — 연쇄가 한 프레임에 몰리지 않게)
    this.bursts.push({ x: u.x, y: u.y - 6, t0: D.time, a: D.rng.next() * 6.28, k: 'g', life: 0.45 });   // 쓰러진 자리의 노란 반짝임
    if (D.time - this.dieSndT > 0.12) { this.dieSndT = D.time; D._play(u.t.snd && u.t.snd.die, 0.35); }   // 수십 기가 한꺼번에 쓰러져도 소리는 띄엄띄엄
  };
  P._fireball = function (c, n) {   // 포격의 탄: 술사 c 가 도둑 쪽으로 n 발(여러 발이면 부채꼴) — 느리고 또렷해 피할 수 있다. fb = 'fire' 화염구 · 'wind' 장풍
    var D = this.D, T = D.time, h = this.hero, B = this.barr ? this.barr.c : CFG.BARRAGE, sy = c.y - c.headY * 0.6, a0 = Math.atan2(h.y - h.headY * 0.5 - sy, h.x - c.x), dmg = this._foeDmg(c) * B.dmg, i;
    for (i = 0; i < n; i++) { var a = a0 + (i - (n - 1) / 2) * B.spread; this.shots.push({ x: c.x, y: sy, vx: Math.cos(a) * B.speed, vy: Math.sin(a) * B.speed, dmg: dmg, arm: B.kind === 'wind' ? -1 : 62, foe: true, t0: T, life: B.life, mg: 'fan', fb: B.kind || 'fire' }); }
    c.castUntil = T + 0.45; c.at = 0; if (T - (this.fbSndT || -9) > 0.25) { this.fbSndT = T; D._play(c.act && c.act.snd, 0.25); }
  };
  P._shrine = function (T) {   /* 성소 (CFG.SHRINE) */
    var S = CFG.SHRINE, D = this.D, h = this.hero, rng = D.rng, sh = this.shrine, self = this;
    if (!sh) { if (this.t < this.shrineNext || this.t > CFG.TIME - 8) return; var ks = Object.keys(S.kinds).filter(function (k) { return k !== self.shrineLast; }), k = ks[Math.floor(rng.next() * ks.length)], a = rng.next() * 6.2832, d = S.dist[0] + rng.next() * (S.dist[1] - S.dist[0]);
      this.shrine = { k: k, x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d * 0.8, t0: T }; this.shrineLast = k; this.banner = { s: S.kinds[k].name + ' — 화살표 쪽', t0: T, col: S.kinds[k].col }; return; }
    var K = S.kinds[sh.k], done = false;
    if (Math.hypot(h.x - sh.x, (h.y - sh.y) / 0.62) <= S.touch && h.state !== 'dead') { done = true;
      if (sh.k === 'life') h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * S.heal)); else this.buff[sh.k] = T + S.sec;
      this._text(h.x, h.y - h.headY - 22, K.name + ' — ' + K.note, K.col); this.shrineFx = { x: sh.x, y: sh.y, t0: T, rgb: K.rgb }; D._play(5064, 0.5); }
    else if (T - sh.t0 > S.life) done = true;
    if (done) { this.shrine = null; this.shrineNext = this.t + (this._rage() ? S.everyRage : S.every); }
  };
  P._rescue = function (T, v) {   /* 구급 물약 (CFG.RESCUE) */
    var R = CFG.RESCUE, h = this.hero, vl = Math.hypot(v[0], v[1]); if (vl) this.lastV = [v[0] / vl, v[1] / vl];
    if (R.cd <= 0 || h.state === 'dead' || h.hp <= 0 || h.hp > h.maxHp * R.hp || T < (this.rescueT || 0) || this.items.some(function (it) { return it.rescue; })) return;
    var d = this.lastV || [0, 1]; this.rescueT = T + R.cd; this.items.push({ k: 'meat', x: h.x + d[0] * R.ahead, y: h.y + d[1] * R.ahead * 0.8, t0: T, rescue: 1 });
  };
  P._storm = function (T, v) {   /* 마법 포격 (CFG.STORM) */
    var S = CFG.STORM, D = this.D, h = this.hero, rng = D.rng, q0 = this.t - CFG.RAGE.at, st = this.storm || (this.storm = { i: 0, left: 0, next: 0, dropAt: 0 }), i;
    if (!st.left && q0 >= S.first + st.i * S.every && this.t < CFG.TIME - 4) { st.i++; st.left = S.vol; st.next = T + 1.3; this.banner = { s: '마법 포격 — 붉은 원을 피하십시오', t0: T, col: '#ff6a5a' }; D._play(5064, 0.6); }
    if (st.dropAt && T >= st.dropAt) { st.dropAt = 0; for (i = 0; i < S.potion; i++) { var pa = rng.next() * 6.2832, pr = S.potR[0] + rng.next() * (S.potR[1] - S.potR[0]); this.items.push({ k: 'meat', x: h.x + Math.cos(pa) * pr, y: h.y + Math.sin(pa) * pr * 0.62, t0: T }); } }
    if (!st.left || T < st.next) return;
    st.left--; st.next = T + S.gap; if (!st.left) st.dropAt = T + S.warn + 0.6;
    var vl = Math.hypot(v[0], v[1]), ux = vl ? v[0] / vl : 0, uy = vl ? v[1] / vl : 0, step = this.speed * S.warn, pts = [], m, a0 = rng.next() * 6.2832;
    (vl ? S.lead : [0]).forEach(function (k) { pts.push([h.x + ux * step * k, h.y + uy * step * k]); });
    m = Math.max(0, S.n + (st.i - 1) * S.nUp - pts.length); for (i = 0; i < m; i++) { var a = a0 + (i + (rng.next() - 0.5) * 0.5) * 6.2832 / m, rr = S.ring[0] + rng.next() * (S.ring[1] - S.ring[0]); pts.push([h.x + Math.cos(a) * rr, h.y + Math.sin(a) * rr * 0.62]); }
    for (i = 0; i < pts.length; i++) this.marks.push({ x: pts[i][0], y: pts[i][1], r: S.r, t0: T, at: T + S.warn + i * 0.03, dmg: S.dmg, storm: 1 });
  };
  P._foeCast = function (c, kind, k) {   // 적 마법 (CFG.MAGIC)
    var D = this.D, T = D.time, h = this.hero, rng = D.rng, M = CFG.MAGIC, K = M[kind], base = this._foeDmg(c) * (CFG.SHOT.k[this.wave] || 1) * K.dmg, sy = c.y - c.headY * 0.6, dx = h.x - c.x, dy = h.y - h.headY * 0.5 - sy, d = Math.hypot(dx, dy) || 1, a0 = Math.atan2(dy, dx), arm = c.act ? c.act.arm : -1, v = CFG.FOE.shot * (CFG.SHOT.v[this.wave] || 1), i;
    this.bursts.push({ x: c.x, y: c.y - c.headY, t0: T, a: rng.next() * 6.28, k: 'g', life: 0.4 }); D._faceVec(c, dx, dy);
    if (kind === 'fan') { var n = Math.round(K.n[0] + (K.n[1] - K.n[0]) * k); for (i = 0; i < n; i++) { var a = a0 + (i - (n - 1) / 2) * K.spread; this.shots.push({ x: c.x, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, dmg: base, arm: arm, foe: true, t0: T, life: K.life, mg: 'fan' }); } }
    else if (kind === 'frost') this.shots.push({ x: c.x, y: sy, vx: dx / d * v * K.v, vy: dy / d * v * K.v, dmg: base, arm: arm, foe: true, t0: T, life: K.life, mg: 'frost' });
    else if (kind === 'orb') this.shots.push({ x: c.x, y: sy, vx: dx / d * K.speed, vy: dy / d * K.speed, dmg: base, arm: arm, foe: true, t0: T, life: K.life, mg: 'orb' });
    else if (kind === 'blast') this.marks.push({ x: h.x, y: h.y, r: K.r, t0: T, at: T + K.warn, dmg: base });
    else if (kind === 'rain') for (i = 0; i < K.n; i++) { var ra = rng.next() * 6.2832, rr = i ? 30 + rng.next() * K.spread : 0; this.marks.push({ x: h.x + Math.cos(ra) * rr, y: h.y + Math.sin(ra) * rr * 0.62, r: K.r, t0: T, at: T + K.warn + i * 0.12, dmg: base }); }
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
    dmg = Math.max(1, Math.round(dmg * CFG.FOE.dmg * this._atkK() * (CFG.WAVE.list[this.wave].dmg || 1) * (this.cls === 'shadow' ? CFG.BLADE.armor : 1) * (1 + CFG.DEF.lateK * Math.max(0, this.lv - CFG.DEF.lateLv)))); if (this._rage()) dmg = Math.max(dmg, Math.ceil(h.maxHp * CFG.RAGE.minHit)); if (D.time < this.buff.guard) dmg = Math.max(1, Math.ceil(dmg * CFG.SHRINE.kinds.guard.take));   /* 수호의 성소 */ this.stat.taken += Math.min(dmg, h.hp); h.hp -= dmg; h.hitT = D.time; this.hurtT = D.time; var ssl = this.cls === 'shadow' ? this._lvOf('sidestep') : 0; this.invUntil = Math.max(this.invUntil, D.time + (ssl ? SK.sidestep.v(ssl) : CFG.HURT.inv)); if (ssl) { h.glowT0 = D.time; h.glowUntil = this.invUntil; this._text(h.x, h.y - h.headY - 12, '비켜 피하기', '#ffd24a'); } if (ssl && this.ghosts) { var sga = D.rng.next() < 0.5 ? 1 : -1; this.ghosts.push({ x: h.x + sga * 12, y: h.y, dir: h.dir, t0: D.time, until: D.time + 0.3 }); }   /* 비켜 피하기: 맞은 뒤 무적이 길어지고, 옆으로 비켜서는 잔상 */   // 웨이브 dmg = 그 단계 적 피해 배수 (1·2단계만)
    if (h.hp <= 0) { h.hp = 0; h.state = 'dead'; h.deadT = 0; h.fade = 0; this.stick = null; this.keys = {}; this.over = 'dead'; this.overT = 0; D._play(h.t.snd && h.t.snd.die, 0.8); }
  };
  P.update = function (dt) {
    var D = this.D, R = D.rules, rng = D.rng, h = this.hero, v = this._moveVec(), F = this.foes, T = D.time, self = this, i, j, u;
    this.t += dt; if (this.t >= CFG.TIME) { this.t = CFG.TIME; this.over = 'win'; this.overT = 0; this.stick = null; return; }
    if (this.cls && h.t.id !== (CLS[this.cls].unit || GROW.clsUnit) && this._has(CLS[this.cls].unit || GROW.clsUnit)) this._promote(this.cls);   // 전직했는데 아직 그 모습(대도·마법전사) 그림을 못 받았던 경우 (시험용 ?cls= 로 시작할 때)
    // 도둑: 걷기
    if (this.zrun) { this._zStep(dt); v = [0, 0]; }   /* 처형으로 달리는 동안은 조작이 안 먹는다 */
    if (this.rift && T - this.rift.t0 > ULT.shadow.life) this.rift = null;
    if (this.rift) { v = [0, 0]; var RA = h.t.anim.atk; var rq = T - this.rift.t0, RU = ULT.shadow; D._faceVec(h, RU.face[0], RU.face[1], true); h.state = 'attack'; h.at = rq < 0.25 ? RU.pose[0] : rq < RU.charge + RU.plant * 0.5 ? RU.pose[1] : RU.pose[2]; this.aimUntil = T + 0.2; this.stick = null; }   /* 329번(사용자 "칼 꽂는 게 캐릭터의 모션 자체가 바뀌어서 꽂아야지 갑자기 없던 칼이 등장하면 안 되지"): 따로 그린 칼은 없앴다 — 마법전사의 공격 동작을 아래 방향으로: 기를 모으는 동안 칼을 치켜들고(pose[1]), 꽂는 순간 내려찍은 자세(pose[2])로 끝까지 */   /* 천지파열무: 스킬이 끝날 때까지(균열이 사라질 때까지) 칼을 꽂은 자세로 못 움직인다 (323번, 2026-11-20 사용자) — 그동안 무적 */
    if (this.crazy && T < this.crazy.until + ULT.venom.tail) { v = [0, 0]; this.stick = null; }   /* 무차별 난사: 기 모으기부터 피해가 들어갈 때까지 제자리 (345번) */
    var moving = !!(v[0] || v[1]);
    var hs = this.speed * (T < this.stealthUntil && this._evo('shadow') ? 1.24 : 1) * (T < this.chillUntil ? CFG.MAGIC.frost.slow : 1);   // 냉기탄에 맞으면 잠깐 느려진다
    if (moving) { this.lastDir = v; h.x += v[0] * hs * dt; h.y += v[1] * hs * dt; if (h.state !== 'attack') h.state = 'move'; h.walkT += dt * Math.max(0.5, Math.hypot(v[0], v[1])) * CFG.SPEED; if (!(T < this.aimUntil)) D._faceVec(h, v[0], v[1]); }   // 단검을 던진 직후에는 던진 쪽을 본 채로 걷는다 (aimUntil)
    else if (h.state !== 'attack') h.state = 'idle';
    if (h.state === 'attack') { h.at += dt * R.tps * CFG.ATK.anim; if (h.at >= h.t.anim.atk.n) h.state = moving ? 'move' : 'idle'; }   // 던지는 동작: 걷는 중에도 (2026-11-19 사용자 지적) — 그동안 발은 걷지 않고 미끄러진다
    if (this.crazy && T > this.crazy.until + 0.25) this.crazy = null;
    if (this.crazy && T < this.crazy.until) { var CZA = h.t.anim.atk, czn = CZA && CZA.n ? CZA.n : 6; if (T >= this.crazy.go) D._faceVec(h, Math.cos(this.crazy.a), Math.sin(this.crazy.a), true); h.state = 'attack'; h.at = T < this.crazy.go ? 0 : Math.floor((T - this.crazy.go) * 40) % czn; this.aimUntil = T + 0.1; }   /* 기 모으는 동안은 던지려는 첫 자세로 멈춰 있다 */   // 크레이지 샷: 던지는 동작을 아주 빠르게 되풀이하며 던지는 쪽을 본다 (걸을 수는 있다 — 발은 미끄러진다)
    if (T < this.feverUntil) { var fo = Math.floor((T - this.feverT0) / 0.045) % 8, FA = h.t.anim.atk; D._faceVec(h, Math.cos(fo * 0.7854), Math.sin(fo * 0.7854), true); h.state = 'attack'; h.at = FA && FA.hit != null ? FA.hit : 4; this.aimUntil = this.feverUntil; }   // 다팅 피버: 던지는 자세로 8방향을 빠르게 돈다 (걷는 중이면 돌면서 미끄러진다)
    // 스폰
    // 웨이브: 1분마다 다음 단계. 단계가 바뀌면 알림 한 줄 + 우두머리 + 다음 단계 유닛 그림을 미리 받는다
    var WL = CFG.WAVE.list, wv = Math.min(WL.length - 1, Math.floor(this.t / CFG.WAVE.sec)), RG = this._rage() ? CFG.RAGE.spd : 1;
    if (this._rage() && !this.rageOn) { this.rageOn = true; F.forEach(function (x) { if (x.state === 'dead') return; x.life = Math.round(x.life * CFG.RAGE.hp); x.life0 = Math.round(x.life0 * CFG.RAGE.hp); if (x.boss) { x.maxHp = x.life0; x.hp = x.life; } }); this.rageT = T; this.flashT = T; D._play(5064, 0.9); }
    this._rescue(T, v); this._shrine(T); if (this.rageOn) this._storm(T, v);
    if (!this.rageOn && !this.rageSoon && this.t >= CFG.RAGE.at - 10) { this.rageSoon = true; this.banner = { s: '경고 — 10초 뒤 최후의 3분', t0: T, col: '#ff6a5a' }; }
    if (wv !== this.wave || !this.waveOn) { this.wave = wv; this.waveOn = true; var WV = WL[wv]; if (WL[wv + 1]) { this._need(WL[wv + 1].add); if (WL[wv + 1].boss) this._need([WL[wv + 1].boss[0]]); }
      var sh = this._shown(), newSh = sh !== this.shownWave; this.shownWave = sh; if (newSh || WV.boss) this.banner = { s: (newSh ? '웨이브 ' + sh + (sh === 1 && this.scaleK > 0 ? ' · 적 레벨 ' + Math.round(this.scaleK * 100) + '%' + (this.scaleName ? ' (' + this.scaleName + ')' : '') : '') : '') + (WV.boss ? (newSh ? ' — ' : '') + D.types[WV.boss[0]].name + ' 등장' : ''), t0: T, col: WV.boss ? '#ff8a7a' : '#ffe9b0' };   /* 알림은 보이는 웨이브가 바뀔 때와 우두머리가 나올 때만 (안쪽 난이도 칸은 10개) */
      if (WV.boss) { this._need([WV.boss[0]]); this.bossWait = WV.boss; } if (WV.mini) this._need([WV.mini[0]]); }
    if (this.bossWait && this._has(this.bossWait[0])) { this._spawn(this.bossWait[0], this.bossWait[1]); this.bossWait = null; }
    var MW = WL[wv].mini, mn = this.miniWave === wv ? this.miniN : 0; if (MW && mn < CFG.MINI.ats.length && this.t - wv * CFG.WAVE.sec >= CFG.MINI.ats[mn] && this._has(MW[0])) { this.miniWave = wv; this.miniN = mn + 1; var mu = this._spawn(MW[0], MW[1] * CFG.MINI.hpk); if (mu) { mu.mini = true; mu.speedPx = Math.max(mu.spd0, this.speed * CFG.BOSS.miniChase); this.banner = { s: '중간 우두머리 — ' + mu.t.name, t0: T, col: '#ffb27a' }; } }   // 중간 우두머리: 단계마다 at 초에 하나
    var BG = CFG.BARRAGE, BA = this.barr, BN = BG.list[this.barrNext];   // 포격: 예고 → 술사 부대 등장 → sec 초 포격 (차례대로 — CFG.BARRAGE.list)
    if (BN && this.t >= BN.at - 20) this._need(BN.ids);
    if (BN && this.t >= BN.at && !BA) { var bid = BN.ids.filter(function (id) { return self._has(id); }); if (bid.length) { this.barrNext++; var BC = Object.assign({}, BG, BN); BA = this.barr = { ph: 'warn', at: T + BC.warn, ids: bid, t0: T, c: BC }; this.banner = { s: '경고 — ' + D.types[bid[0]].name + ' 부대의 ' + BC.name, t0: T, col: BC.kind === 'wind' ? '#9fd8ff' : '#ff8a4a' }; D._play(5064, 0.5); } }
    if (BA && BA.ph === 'warn' && T >= BA.at) { BA.ph = 'fire'; BA.until = T + BA.c.sec; BA.fanAt = T + 1.6; var ba0 = rng.next() * 6.2832;
      for (i = 0; i < BA.c.n; i++) { var bga = ba0 + i / BA.c.n * 6.2832, bu3 = this._spawn(BA.ids[i % BA.ids.length], BA.c.hp, [h.x + Math.cos(bga) * BA.c.rx, h.y + Math.sin(bga) * BA.c.ry], true); if (bu3) { bu3.barr = true; bu3.barrA = bga; bu3.boom = null; bu3.shotT = 0.5 + (i * 0.37) % BA.c.aim; } } }
    if (BA && BA.ph === 'fire') { if (T >= BA.until) { F.forEach(function (x) { x.barr = false; }); this.barr = null; }
      else if (T >= BA.fanAt) { BA.fanAt = T + BA.c.fan; var cst = F.filter(function (x) { return x.barr && x.state !== 'dead'; }); for (i = 0; i < BA.c.fanFrom && cst.length; i++) { var cu = cst.splice(Math.floor(rng.next() * cst.length), 1)[0]; this._fireball(cu, BA.c.fanN); } } }
    this.spawnAcc += dt * WL[wv].rate * (this.barr && this.barr.ph === 'fire' ? BG.spawnK : 1);
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; if (F.length < WL[wv].cap) this._spawn(); }
    // 돌진: 예고(길과 화살표) → warn 초 뒤 떼가 나타나 달려 지나간다
    var RU = CFG.RUSH; if (wv >= RU.from) { var rk = (wv - RU.from) / Math.max(1, WL.length - 1 - RU.from);
      if (this.rushIn == null) this.rushIn = RU.every[0] * 0.5; this.rushIn -= dt;
      if (this.rushIn <= 0 && !this.rushWarn) { this.rushIn = RU.every[0] + (RU.every[1] - RU.every[0]) * rk; var rid = 43; RU.unit.forEach(function (e) { if (wv >= e[0] && self._has(e[1])) rid = e[1]; });
        if (this._has(rid)) { this.rushWarn = { a: Math.floor(rng.next() * 8) * 0.7854 + (rng.next() - 0.5) * 0.3, x: h.x, y: h.y, t0: T, at: T + RU.warn, id: rid, n: Math.round(RU.n[0] + (RU.n[1] - RU.n[0]) * rk) }; this.banner = { s: '돌진 — ' + D.types[rid].name + ' 떼', t0: T, col: '#ff8a7a' }; } }
      var RW = this.rushWarn; if (RW && T >= RW.at) { this.rushWarn = null; var ca = Math.cos(RW.a), sa2 = Math.sin(RW.a), per = Math.max(4, Math.round(RU.band / 30));
        for (i = 0; i < RW.n; i++) { var col = i % per, row = Math.floor(i / per), off = (col - (per - 1) / 2) * (RU.band / per) + (row % 2 ? 9 : -9), back = RU.dist + row * 34 + rng.next() * 10;
          u = this._unit(RW.id, 1, RW.x - ca * back - sa2 * off, RW.y - sa2 * back + ca * off); u.life = Math.round(u.maxHp * CFG.FOE.hp * this._hpK(wv)); u.life0 = u.life; u.boom = null;
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
    // 적 마법: 화면 근처의 마법 유닛 하나가 주기마다 (숨어 있는 동안은 쓰지 않는다)
    var MG = CFG.MAGIC; if (wv >= MG.from) { if (this.magicIn == null) this.magicIn = 4; this.magicIn -= dt;
      if (this.magicIn <= 0) { var cs = T < this.stealthUntil ? [] : F.filter(function (x) { return x.state !== 'dead' && !x.rush && !x.sup && MG.ids.indexOf(x.t.id) >= 0 && !(x.stunUntil > T) && Math.hypot(x.x - h.x, x.y - h.y) <= MG.near; });
        if (cs.length) { var mk2 = (wv - MG.from) / Math.max(1, WL.length - 1 - MG.from), kd = MG.kinds.filter(function (e) { return wv >= e[0]; }); this.magicIn = MG.every[0] + (MG.every[1] - MG.every[0]) * mk2; this._foeCast(cs[Math.floor(rng.next() * cs.length)], kd[Math.floor(rng.next() * kd.length)][1], mk2); }
        else this.magicIn = 0.8; } }
    for (i = this.marks.length - 1; i >= 0; i--) { var mq = this.marks[i]; if (T >= mq.at) { this.marks.splice(i, 1); this._fx(mq.x, mq.y - 8, SK.explo.boom); if (mq.storm) { var se = this.effects[this.effects.length - 1]; if (se) { se.sc = 0.42; se.al = 0.8; se.y = mq.y - 4; } } if (mq.storm && T - (this.stormSndT || -9) > 0.5) { this.stormSndT = T; D._play(5012, 0.45); } if (Math.hypot(h.x - mq.x, (h.y - mq.y) / 0.62) <= mq.r) this._hitHero(mq.dmg); } }   // 예고가 끝난 자리: 폭발 (그 안에 있으면 맞는다)
    // 적: 도둑에게 다가가 친다. 격자(칸 32px)로 가까운 적끼리만 서로 밀어낸다
    var G = {}, CS = 32, SEP = CFG.FOE.sep, key, near = null, nd = CFG.ATK.range;
    for (i = 0; i < F.length; i++) { u = F[i]; if (u.state === 'dead') continue; key = Math.floor(u.x / CS) + ',' + Math.floor(u.y / CS); (G[key] || (G[key] = [])).push(u); }
    for (i = 0; i < F.length; i++) { u = F[i];
      if (u.state === 'dead') { u.deadT += dt; var dn = u.t.anim.die ? u.t.anim.die.n / R.tps : 0; if (u.deadT > dn) u.fade = Math.min(1, (u.deadT - dn) / 0.4); continue; }
      var dx = h.x - u.x, dy = h.y - u.y, d = Math.hypot(dx, dy) || 1;
      if (d > CFG.FOE.far && !u.rush) { var p = this._edgePoint(); u.x = p[0]; u.y = p[1]; continue; }   // 너무 멀리 떨어진 적은 화면 둘레로 다시 온다
      if (d < nd) { nd = d; near = u; }
      if (u.bleedUntil > T) { u.dotT = (u.dotT || 0) + dt; if (u.dotT >= 0.5) { u.dotT = 0; this._hitFoe(u, u.bleed * 0.5, -1); if (u.state === 'dead') continue; } }   // 출혈 (베놈 쓰로워)
      if (T < this.freezeUntil) { if (u.state === 'move') u.state = 'idle'; continue; }
      if (u.barr && this.barr) { var BQ = this.barr.c, sxq = h.x + Math.cos(u.barrA) * BQ.rx, syq = h.y + Math.sin(u.barrA) * BQ.ry; if (Math.hypot(u.x - sxq, u.y - syq) > BQ.lag) { u.x = sxq; u.y = syq; u.shotT = Math.max(u.shotT, 0.35); }   /* 도둑이 걸어가 제 자리에서 벗어났다 — 지금 화면의 가장자리 제 자리에 다시 나타난다 */
        var bdx = h.x - u.x, bdy = h.y - u.y; D._faceVec(u, bdx, bdy); u.state = u.castUntil > T ? 'attack' : 'idle'; if (u.state === 'attack') u.at = Math.min((u.t.anim.atk ? u.t.anim.atk.n : 6) - 1, (u.at || 0) + dt * R.tps); u.shotT -= dt; if (u.shotT <= 0 && !(u.stunUntil > T)) { u.shotT = BQ.aim * (0.85 + rng.next() * 0.3); this._fireball(u, 1); } continue; }   /* 화염 포격의 술사: 제자리에서 쏜다 */   // 크레이지 샷: 기 모으기부터 피해가 들어갈 때까지 모든 적이 그 자리에 멈춘다 (우두머리·돌진 떼도)
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
        var A = u.t.anim.atk, n = A ? A.n : 6, hitAt = A && A.hit != null ? A.hit : Math.floor(n * 0.6); var BK = u.mini ? CFG.BOSS.mini : CFG.BOSS; u.at += dt * R.tps * (u.boss ? BK.swing : 1) * RG;
        if (u.boss && BK.lunge && !u.ranged && !u.hitDone && d > 20) { var lg2 = Math.min(d - 18, u.speedPx * BK.lunge * dt); u.x += dx / d * lg2; u.y += dy / d * lg2; }   /* 우두머리는 휘두르며 파고든다 — 걸어서 벗어나기 어렵게 */
        if (!u.hitDone && u.at >= hitAt) { u.hitDone = true;
          if (u.ranged) { var def = D.data.fx.arms[u.act.arm]; var sv = CFG.FOE.shot * (CFG.SHOT.v[this.wave] || 1); this.shots.push({ x: u.x, y: u.y - u.headY * 0.6, vx: dx / d * sv, vy: (dy + h.headY * 0.5 - u.headY * 0.6) / d * sv, dmg: this._foeDmg(u) * (CFG.SHOT.k[this.wave] || 1), arm: u.act.arm, def: def, foe: true, t0: T, life: (u.reach + 60) / sv }); }
          else if (d <= u.reach * (u.boss ? BK.hitReach : 1.5)) this._hitHero(this._foeDmg(u) * (u.mini ? CFG.MINI.dmg : u.boss ? CFG.BOSS.dmg : 1)); }   // 휘두르는 사이에 벗어나면 빗나간다
        if (u.at >= n) { u.state = 'idle'; u.cd = R.cooldown(u, rng) * (u.boss ? BK.cdK : 1) / RG; }
        continue; }
      if (u.cd > 0) u.cd -= dt;
      var BP = CFG.BOSS.pace, resting = u.boss && BP.on && ((T - (u.born || 0)) % (BP.burst + BP.rest)) >= BP.burst;   /* 우두머리의 숨 고르기 */
      if (u.sup) { u.supT -= dt; if (u.supT <= 0) this._supAct(u); }
      if (u.sup && d <= u.keep) { D._faceVec(u, dx, dy); u.state = 'idle'; }   // 치유형·소환형: 단도 사거리 밖에 서 있는다
      else if (d <= u.reach * (u.boss && !u.ranged ? (u.mini ? CFG.BOSS.mini.reach : CFG.BOSS.reach) : 1) && u.act) { D._faceVec(u, dx, dy); if (u.cd <= 0 && !resting) { u.state = 'attack'; u.at = 0; u.hitDone = false; } else u.state = 'idle'; }
      else { var sp = u.speedPx * RG * dt * (u.slowUntil > T ? SK.mouse.slow : 1) * (resting ? BP.restSpd : 1); u.x += dx / d * sp; u.y += dy / d * sp; u.state = 'move'; u.walkT += dt; D._faceVec(u, dx, dy); }
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
      if (this.cls === 'trapper') { var BM = GROW.bomb; ms.dmg *= BM.mul; ms.arm = -2; ms.bomb = BM.r + BM.rLv * dl; ms.bv = CFG.ATK.shot * BM.speed; ms.life = CFG.ATK.life / BM.speed; this.atkCd *= BM.sec; }   // 트래퍼: 단검 대신 폭탄
      ms.main = true; if (xl) ms.extra = { n: (this._evo('double') ? SK.double.evo.n(xl) : SK.double.n(xl)) + (this._awk('double') ? 1 : 0), mul: SK.double.dmg(xl), bounce: this._evo('double') ? SK.double.evo.bounce : 0 };   // 더블 드로잉: 단검(동작)은 하나, 맞으면 피해가 여러 번 겹쳐 뜬다 (2026-11-19 사용자 요청 — 붉은보석의 타격 수)
      D._play(h.act.snd, 0.3); }
    this._growStep(dt, G, near);
    // 발사체: 도둑의 단도는 겨눈 적을 따라가고(적이 쓰러지면 곧게), 적의 것은 곧게 날아와 피할 수 있다
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i];
      if (s.tgt && s.tgt.state !== 'dead') { var qx = s.tgt.x - s.x, qy = s.tgt.y - s.tgt.headY * 0.5 - s.y, qd = Math.hypot(qx, qy) || 1; var sv2 = s.bv || CFG.ATK.shot; s.vx = qx / qd * sv2; s.vy = qy / qd * sv2;
        if (qd <= sv2 * dt + 8) { if (s.bomb) this._bombHit(s, s.tgt); if (s.spl) this._dagMark(s.tgt, s.spl); this._hitFoe(s.tgt, s.dmg * (s.dg ? this._onDagger(s.tgt) : 1), s.arm, 0, s.cb); this._extra(s, s.tgt); if (s.spl) this._dagMark(s.tgt, s.spl);
          if (s.main && this._awk('dagger')) { var pt = s.tgt, po = null, pd = 70; for (j = 0; j < F.length; j++) { var pf = F[j]; if (pf === pt || pf.state === 'dead') continue; var pq = Math.hypot(pf.x - pt.x, pf.y - pt.y); if (pq < pd) { pd = pq; po = pf; } } if (po) this._hitFoe(po, s.dmg * 0.6 * this._onDagger(po), s.arm); }   // 관통 단검(각성)
          s.dead = true; continue; } }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (!s.foe && !(s.tgt && s.tgt.state !== 'dead')) { var gx = Math.floor(s.x / CS), gy = Math.floor((s.y + 16) / CS), ga, gb, gj, got = null;   // 겨눈 적이 없는 단검(다팅 피버·적이 먼저 쓰러진 단검): 처음 닿는 적을 맞힌다
        for (ga = gx - 1; ga <= gx + 1 && !got; ga++) for (gb = gy - 1; gb <= gy + 1 && !got; gb++) { var GL = G[ga + ',' + gb]; if (GL) for (gj = 0; gj < GL.length; gj++) if (GL[gj].state !== 'dead' && !(s.vol && (s.vol.hit[GL[gj].uid] || Math.hypot(GL[gj].x - s.x0, GL[gj].y - s.y0) > CFG.ATK.range + 12)) && Math.hypot(GL[gj].x - s.x, GL[gj].y - GL[gj].headY * 0.5 - s.y) < (s.vol ? Math.max(15, Math.hypot(s.x - s.x0, s.y - s.y0) * s.wk) : 15)) { got = GL[gj]; break; } }   // 흩뿌리기 단검(vol): 이미 맞은 적은 건너뛰고, 멀어질수록 단검 사이가 벌어지는 만큼 폭을 넓혀 부채꼴 안을 빈틈없이
        if (got && s.vol) { if (s.vol.left > 0) { s.vol.left--; s.vol.hit[got.uid] = 1; this._hitFoe(got, s.dmg * (1 - (1 - s.far) * Math.min(1, Math.hypot(got.x - s.x0, got.y - s.y0) / CFG.ATK.range)) * this._onDagger(got), s.arm); this.bursts.push({ x: got.x, y: got.y - got.headY * 0.5, t0: T, a: Math.atan2(s.vy, s.vx), k: 'p', life: 0.2 }); if (s.spl) this._dagMark(got, s.spl); } else { s.dead = true; continue; } }   // 꿰뚫고 계속 난다 — 먼 적일수록 약하게(far), 한 번에 n명까지
        else if (got) { if (s.bomb) this._bombHit(s, got); if (s.spl) this._dagMark(got, s.spl); this._hitFoe(got, s.dmg * (s.dg ? this._onDagger(got) : 1), s.arm, 0, s.cb); this._extra(s, got); if (s.spl) this._dagMark(got, s.spl); s.dead = true; continue; } }
      if (s.mg === 'orb') { var oa = Math.atan2(s.vy, s.vx), ta = Math.atan2(h.y - h.headY * 0.5 - s.y, h.x - s.x), od = Math.atan2(Math.sin(ta - oa), Math.cos(ta - oa)), ot = CFG.MAGIC.orb.turn * dt; oa += Math.max(-ot, Math.min(ot, od)); s.vx = Math.cos(oa) * CFG.MAGIC.orb.speed; s.vy = Math.sin(oa) * CFG.MAGIC.orb.speed; }   // 따라오는 구체: 천천히 방향을 튼다 (끝까지 따라오지는 못한다)
      if (s.foe && Math.hypot(h.x - s.x, h.y - h.headY * 0.5 - s.y) < (s.mg === 'orb' ? 17 : 13)) { if (s.arm >= 0) this._fx(s.x, s.y, s.arm); var hp0 = h.hp; this._hitHero(s.dmg); if (s.mg === 'frost' && h.hp < hp0) { this.chillUntil = T + CFG.MAGIC.frost.sec; this._text(h.x, h.y - h.headY - 30, '감속', '#9fd8ff'); } s.dead = true; }
      else if (T - s.t0 > s.life) s.dead = true; }
    this.shots = this.shots.filter(function (s) { return !s.dead; });
    this.effects = this.effects.filter(function (e) { return (T - e.t0) * 15 < e.f.length; });
    this.texts = this.texts.filter(function (e) { return T - e.t0 < 0.7; });
    this.nums = this.nums.filter(function (e) { return T - e.t0 < NUM[e.k].life; });
    this.slashes = this.slashes.filter(function (e) { return T - e.t0 < 0.3; }); this.arcs = this.arcs.filter(function (e) { return T - e.t0 < CFG.BLADE.arcLife; }); this.ghosts = this.ghosts.filter(function (e) { return T < e.until; }); this.puffs = this.puffs.filter(function (e) { return T - e.t0 < 0.45; }); if (this.puffs.length > 40) this.puffs.splice(0, this.puffs.length - 40);
    this.bursts = this.bursts.filter(function (e) { return T - e.t0 < e.life; }); if (this.bursts.length > 120) this.bursts.splice(0, this.bursts.length - 120);
    // 카메라: 도둑을 부드럽게 따라간다 (끊기지 않을 만큼만 — 늦으면 멀미가 난다)
    var k = Math.min(1, dt * 12); if (!this.zrun) { this.cam.x += (h.x - this.cam.x) * k; this.cam.y += (h.y - this.cam.y) * k; }   /* 처형으로 화면을 가로지르는 동안은 화면을 세워 둔다 (제자리로 돌아온다) */
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
    for (i = 0; i < this.ants.length; i++) { var an2 = this.ants[i], au2 = an2.u, sc2 = ULT.trapper.scale, left2 = an2.at - D.time, bl = left2 < 0.8 ? Math.floor(D.time * 16) % 2 : 0;   // 폭탄 개미: 작게(적 개미와 구별 — 발밑 노란 고리), 터지기 0.8초 전부터 붉게 깜빡인다
      ctx.strokeStyle = bl ? 'rgba(255,90,50,.95)' : 'rgba(255,214,110,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(au2.x, au2.y, 9, 4.5, 0, 0, 6.2832); ctx.stroke();
      ctx.save(); ctx.translate(au2.x, au2.y); ctx.scale(sc2, sc2); ctx.translate(-au2.x, -au2.y); D._drawUnit(au2); ctx.restore();
      if (bl) { ctx.fillStyle = 'rgba(255,80,40,.55)'; ctx.beginPath(); ctx.arc(au2.x, au2.y - 7, 6, 0, 6.2832); ctx.fill(); } }
    for (i = 0; i < this.lobs.length; i++) { var lb = this.lobs[i], lk = (D.time - lb.t0) / lb.dur; if (lk < 0) continue; lk = Math.min(1, lk); var lx = lb.x0 + (lb.x1 - lb.x0) * lk, ly = lb.y0 + (lb.y1 - lb.y0) * lk, lh = Math.sin(lk * 3.1416) * 46;   // 폭탄 다발: 포물선으로 나는 검은 공 + 떨어질 자리의 옅은 주황 점
      ctx.fillStyle = 'rgba(255,150,60,' + (0.18 + 0.25 * lk).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(lb.x1, lb.y1, 7, 3.5, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#1b1d26'; ctx.strokeStyle = '#8a8f9f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(lx, ly - lh, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = Math.floor(D.time * 20) % 2 ? '#fff3a0' : '#ff9a3a'; ctx.fillRect(lx + 2, ly - lh - 7, 2.5, 2.5); }
    for (i = 0; i < this.shots.length; i++) { var s = this.shots[i], fl = s.def && !s.def.dir && s.def.fly;
      if (s.fb === 'wind') { var wa3 = Math.atan2(s.vy, s.vx), wq3, wt3 = D.time * 9 + s.t0 * 5;   // 장풍: 날아가는 쪽으로 볼록한 흰 바람결 셋 + 가운데 옅은 빛 — 화염구와 색·모양으로 구별
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(wa3); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        var wg3 = ctx.createRadialGradient(0, 0, 0, 0, 0, 15); wg3.addColorStop(0, 'rgba(225,245,255,.85)'); wg3.addColorStop(0.45, 'rgba(130,200,255,.4)'); wg3.addColorStop(1, 'rgba(90,160,255,0)'); ctx.fillStyle = wg3; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 6.2832); ctx.fill();
        for (wq3 = 0; wq3 < 3; wq3++) { var wo3 = -wq3 * 7 + Math.sin(wt3 + wq3 * 2) * 1.5, wr4 = 11 - wq3 * 2.4; ctx.strokeStyle = 'rgba(' + (wq3 ? '150,210,255,' : '240,250,255,') + (0.95 - wq3 * 0.28).toFixed(2) + ')'; ctx.lineWidth = 3 - wq3 * 0.7; ctx.beginPath(); ctx.arc(wo3 - wr4 * 0.55, 0, wr4, -1.05, 1.05); ctx.stroke(); }
        ctx.restore(); continue; }
      if (s.fb) { var fa = Math.atan2(s.vy, s.vx), fux = Math.cos(fa), fuy = Math.sin(fa), fpu = 0.85 + 0.15 * Math.sin(D.time * 30 + s.t0 * 7), fq;   // 화염 포격의 화염구: 맞는 크기(13)만 한 불덩이 — 뒤로 흔들리는 불꼬리, 주황 빛무리, 노란 핵 (플레임 윈드 그림은 판정보다 훨씬 커서 틈이 안 보였다)
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (fq = 4; fq >= 1; fq--) { var fw2 = Math.sin(D.time * 22 + fq * 1.7 + s.t0 * 5) * 2.2, fr3 = 7.5 - fq * 1.3; ctx.fillStyle = 'rgba(255,' + (150 - fq * 22) + ',30,' + (0.5 - fq * 0.09).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(s.x - fux * fq * 6 - fuy * fw2, s.y - fuy * fq * 6 + fux * fw2, fr3, 0, 6.2832); ctx.fill(); }
        var fg2 = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 15); fg2.addColorStop(0, 'rgba(255,230,150,' + (0.95 * fpu).toFixed(2) + ')'); fg2.addColorStop(0.4, 'rgba(255,130,30,.6)'); fg2.addColorStop(1, 'rgba(255,60,10,0)'); ctx.fillStyle = fg2; ctx.beginPath(); ctx.arc(s.x, s.y, 15, 0, 6.2832); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(s.x + fux * 1.5, s.y + fuy * 1.5, 3.6, 0, 6.2832); ctx.fill(); continue; }
      if (s.spl) { var sg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9), sc = s.spl === 'toxdag' ? '90,230,70' : '150,70,255'; sg.addColorStop(0, 'rgba(' + sc + ',.95)'); sg.addColorStop(1, 'rgba(' + sc + ',0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 6.2832); ctx.fill(); }   // 트래퍼의 독·폭발 단검
      if (s.foe) { var gR = s.mg === 'orb' ? 18 : s.mg ? 13 : 11, gC = s.mg === 'frost' ? ['150,220,255', '90,170,255', '60,120,255'] : s.mg === 'orb' ? ['230,150,255', '170,70,255', '110,30,220'] : s.mg === 'fan' ? ['255,200,90', '255,130,40', '255,80,20'] : ['255,90,60', '255,60,40', '255,40,30'], gl = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, gR); gl.addColorStop(0, 'rgba(' + gC[0] + ',.9)'); gl.addColorStop(0.45, 'rgba(' + gC[1] + ',.4)'); gl.addColorStop(1, 'rgba(' + gC[2] + ',0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(s.x, s.y, gR, 0, 6.2832); ctx.fill(); if (s.mg === 'orb') { ctx.fillStyle = '#f4dcff'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 6.2832); ctx.fill(); } }   // 적 투사체: 붉은 빛무리 (원본 이펙트가 작아 눈에 안 띄었다)
      if (s.bomb || s.spl) { var bh = Math.sin(Math.min(1, (D.time - s.t0) / 0.3) * 3.1416) * 10; ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(s.x, s.y + 12, 4, 2, 0, 0, 6.2832); ctx.fill(); ctx.fillStyle = s.spl === 'toxdag' ? '#1f5a1a' : s.spl ? '#2a1050' : '#1b1d26'; ctx.strokeStyle = s.spl === 'toxdag' ? '#8be07a' : s.spl ? '#b98aff' : '#8a8f9f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(s.x, s.y - bh, 4.5, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.fillStyle = Math.floor(D.time * 20) % 2 ? '#fff3a0' : '#ff9a3a'; ctx.fillRect(s.x + 2, s.y - bh - 7, 2.5, 2.5); }   // 트래퍼의 폭탄: 검은 공 + 깜빡이는 심지 (살짝 떠서 난다)
      else if (fl && fl.length) D._fxFrame(fl[Math.floor((D.time - s.t0) * 15) % fl.length], s.x, s.y, true);
      else { var sa = Math.atan2(s.vy, s.vx), ux = Math.cos(sa), uy = Math.sin(sa); ctx.lineCap = 'round';
        if (s.foe) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(s.x - ux * 7, s.y - uy * 7); ctx.lineTo(s.x + ux * 7, s.y + uy * 7); ctx.stroke(); ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x - ux * 7, s.y - uy * 7); ctx.lineTo(s.x + ux * 7, s.y + uy * 7); ctx.stroke(); }
        else {   // 도둑의 단검 (붉은보석 영상처럼): 거의 안 보일 만큼 가늘고 빠르다 — 뒤로 끊어진 옅은 자국, 앞에 짧고 밝은 날
          ctx.strokeStyle = 'rgba(40,30,20,.45)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(s.x - ux * 46, s.y - uy * 46); ctx.lineTo(s.x - ux * 6, s.y - uy * 6); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(s.x - ux * 6, s.y - uy * 6); ctx.lineTo(s.x + ux * 6, s.y + uy * 6); ctx.stroke();
          if (s.cz) { ctx.strokeStyle = 'rgba(140,220,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(s.x - ux * 16, s.y - uy * 16); ctx.lineTo(s.x + ux * 6, s.y + uy * 6); ctx.stroke(); }   // 크레이지 샷의 단검: 옅은 푸른 꼬리 (환영이 던진 것)
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x - ux * 6, s.y - uy * 6); ctx.lineTo(s.x + ux * 6, s.y + uy * 6); ctx.stroke(); } } }
    this._drawArcs();
    for (i = 0; i < this.puffs.length; i++) { var pf = this.puffs[i], pk = (D.time - pf.t0) / 0.45; ctx.save(); ctx.translate(pf.x, pf.y - 6); ctx.scale(1, 0.6); var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pf.r * (0.6 + 0.4 * pk)); pg.addColorStop(0, 'rgba(90,220,70,' + (0.5 * (1 - pk)).toFixed(3) + ')'); pg.addColorStop(1, 'rgba(60,180,40,0)'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, pf.r * (0.6 + 0.4 * pk), 0, 6.2832); ctx.fill(); ctx.restore(); }   // 독 묻힌 단도의 독 튐
    for (i = 0; i < this.slashes.length; i++) { var sl2 = this.slashes[i], sk2 = 1 - (D.time - sl2.t0) / 0.3; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';   // 처형의 칼자국
      ctx.strokeStyle = 'rgba(150,90,255,' + (0.8 * sk2).toFixed(3) + ')'; ctx.lineWidth = 7 * sk2 + 1; ctx.beginPath(); ctx.moveTo(sl2.x0, sl2.y0); ctx.lineTo(sl2.x1, sl2.y1); ctx.stroke(); ctx.strokeStyle = 'rgba(240,230,255,' + sk2.toFixed(3) + ')'; ctx.lineWidth = 2 * sk2 + 0.5; ctx.beginPath(); ctx.moveTo(sl2.x0, sl2.y0); ctx.lineTo(sl2.x1, sl2.y1); ctx.stroke(); ctx.restore(); }
    // 단검이 맞은 자리의 섬광 (붉은보석 도둑 영상을 보고 — 이 게임에서 그린 것): 보통 = 흰 별 모양 빛살, 치명타·더블 = 검보라 가시 덩어리 + 흰 속, 쓰러진 자리 = 노란 반짝임
    var spikes = function (b, k, n, r0, r1, wid) { for (var j = 0; j < n; j++) { var a = b.a + j * 6.283 / n + (j % 2) * 0.25, l = (r0 + r1 * k) * (j % 2 ? 0.62 : 1), w = wid * (1 - k) + 0.6; ctx.beginPath(); ctx.moveTo(b.x + Math.cos(a) * l, b.y + Math.sin(a) * l); ctx.lineTo(b.x + Math.cos(a + 1.57) * w, b.y + Math.sin(a + 1.57) * w); ctx.lineTo(b.x - Math.cos(a + 1.57) * w, b.y - Math.sin(a + 1.57) * w); ctx.closePath(); ctx.fill(); } };
    for (i = 0; i < this.bursts.length; i++) { var bu2 = this.bursts[i], bk = Math.max(0, Math.min(1, (D.time - bu2.t0) / bu2.life)); ctx.save(); if (bu2.sc) { ctx.translate(bu2.x, bu2.y); ctx.scale(bu2.sc, bu2.sc); ctx.translate(-bu2.x, -bu2.y); }
      if (bu2.k === 'w') { var wr = bu2.r * (0.45 + 0.75 * bk), wj; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.translate(bu2.x, bu2.y); ctx.rotate(bu2.a); ctx.globalAlpha = 1 - bk * bk;   /* 눈꽃 섬광: 여섯 갈래 흰·푸른 결정 + 흩날리는 알갱이 (설화난영참) */
        for (wj = 0; wj < 6; wj++) { ctx.rotate(1.0472); ctx.strokeStyle = 'rgba(160,215,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wr, 0); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(wr, 0); ctx.moveTo(wr * 0.55, 0); ctx.lineTo(wr * 0.78, wr * 0.2); ctx.moveTo(wr * 0.55, 0); ctx.lineTo(wr * 0.78, -wr * 0.2); ctx.stroke(); ctx.fillStyle = '#eaf6ff'; ctx.fillRect(wr * (1.05 + 0.5 * bk) - 1, (wj % 2 ? 5 : -5) - 1, 2, 2); } }
      else if (bu2.k === 'e') { var ec = bu2.c || '255,190,90', ej; ctx.fillStyle = 'rgba(40,36,34,' + (0.35 * (1 - bk)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(bu2.x, bu2.y - 10 * bk, 6 + 9 * bk, 0, 6.2832); ctx.fill();   /* 연기 한 덩이가 떠오르고 */
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(' + ec + ',' + (1 - bk).toFixed(3) + ')'; for (ej = 0; ej < 9; ej++) { var ea = bu2.a + ej * 0.698, ed = bu2.r * (0.25 + 0.85 * bk) * (0.7 + (ej % 3) * 0.2); ctx.fillRect(bu2.x + Math.cos(ea) * ed - 1, bu2.y + Math.sin(ea) * ed * 0.62 - 14 * Math.sin(bk * 3.1416) - 1, 2.5, 2.5); } }   /* 불티 아홉 개가 포물선으로 튄다 */
      else if (bu2.k === 'b') { var br = bu2.r * (0.4 + 0.6 * Math.sqrt(bk)); ctx.globalCompositeOperation = 'lighter'; ctx.translate(bu2.x, bu2.y); ctx.scale(1, 0.62); var bg = ctx.createRadialGradient(0, 0, 0, 0, 0, br); var bc = bu2.c || ['255,240,180', '255,150,50', '255,80,20']; bg.addColorStop(0, 'rgba(' + bc[0] + ',' + (0.9 * (1 - bk)).toFixed(3) + ')'); bg.addColorStop(0.5, 'rgba(' + bc[1] + ',' + (0.6 * (1 - bk)).toFixed(3) + ')'); bg.addColorStop(1, 'rgba(' + bc[2] + ',0)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, br, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,200,120,' + (0.7 * (1 - bk)).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, br, 0, 6.2832); ctx.stroke(); }   // 폭탄의 터짐: 범위만큼 퍼지는 주황 불빛
      else if (bu2.k === 'k') { var kr = bu2.r * (0.35 + 0.65 * Math.sqrt(bk)); ctx.translate(bu2.x, bu2.y); ctx.scale(1, 0.62); var kg = ctx.createRadialGradient(0, 0, kr * 0.15, 0, 0, kr); kg.addColorStop(0, 'rgba(20,0,40,' + (0.85 * (1 - bk)).toFixed(3) + ')'); kg.addColorStop(0.7, 'rgba(90,30,170,' + (0.55 * (1 - bk)).toFixed(3) + ')'); kg.addColorStop(1, 'rgba(170,90,255,0)'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(0, 0, kr, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(200,140,255,' + (0.9 * (1 - bk)).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, kr, 0, 6.2832); ctx.stroke(); }   // 암흑 단도의 폭발: 검보라 원이 퍼진다
      else if (bu2.k === 'p') { ctx.globalCompositeOperation = 'lighter'; ctx.translate(bu2.x, bu2.y); ctx.rotate(bu2.a); var pl = 10 + 26 * bk; ctx.globalAlpha = 1 - bk; ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 3 * (1 - bk) + 0.5; ctx.beginPath(); ctx.moveTo(-pl * 0.35, 0); ctx.lineTo(pl, 0); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-pl * 0.35, 0); ctx.lineTo(pl, 0); ctx.moveTo(0, -5 * (1 - bk)); ctx.lineTo(0, 5 * (1 - bk)); ctx.stroke(); }   // 단도 흩뿌리기: 꿰뚫고 지나간 방향의 푸른 흰 빛줄기 (다팅 피버의 둥근 큰 별과 구별)
      else if (bu2.k === 'g') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffe24a'; for (var gj = 0; gj < 7; gj++) { var ga2 = bu2.a + gj * 0.9, gr = 4 + 16 * bk * (0.6 + (gj % 3) * 0.25); ctx.globalAlpha = (1 - bk) * (0.6 + 0.4 * Math.sin(D.time * 40 + gj)); ctx.fillRect(bu2.x + Math.cos(ga2) * gr - 1, bu2.y + Math.sin(ga2) * gr * 0.6 - 10 * bk - 1, 2, 2); } }
      else if (bu2.k === 'n') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1 - bk * bk; spikes(bu2, bk, 8, 8, 20, 2.6); ctx.beginPath(); ctx.arc(bu2.x, bu2.y, 5 * (1 - bk) + 1, 0, 6.3); ctx.fill(); }
      else { var big = bu2.k === 'd' ? 1.35 : 1; ctx.globalAlpha = 1 - bk * bk * bk; ctx.fillStyle = '#1a0a3a'; spikes(bu2, bk, 14, 10 * big, 16 * big, 3.4); ctx.beginPath(); ctx.arc(bu2.x, bu2.y, (9 + 5 * bk) * big, 0, 6.3); ctx.fill();
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,90,255,.9)'; ctx.globalAlpha = (1 - bk) * 0.9; spikes(bu2, bk, 7, 6 * big, 22 * big, 1.6); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(bu2.x, bu2.y, 4 * (1 - bk) * big + 0.5, 0, 6.3); ctx.fill(); }
      ctx.restore(); }
    ctx.globalAlpha = 1;
    for (i = 0; i < this.effects.length; i++) { var e = this.effects[i]; if (e.sc) { ctx.save(); ctx.translate(e.x, e.y); ctx.scale(e.sc, e.sc); ctx.globalAlpha = e.al || 1; D._fxFrame(e.f[Math.floor((D.time - e.t0) * 15)], 0, 0, e.add); ctx.restore(); } else D._fxFrame(e.f[Math.floor((D.time - e.t0) * 15)], e.x, e.y, e.add); }   /* sc·al = 작게·옅게 (마법 포격의 폭발 — 여럿이 겹쳐도 전장을 덮지 않게) */
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
    if (D.time - this.rageT < CFG.RAGE.show) this._drawRage();
    if (this.guide) this._drawGuide();
    if (this.menu) this._drawMenu();
  };
  /* 천지파열무의 '칼을 꽂은 자세' (331번, 2026-11-20 사용자가 시안 A·B·C 중 "원래 C 안으로"): 마법전사의 앞쪽 대각선 방향 공격 프레임 1(칼을 정면에 곧게 든 자세)에서
     든 칼날과 코등이를 지우고, 손 아래에 코등이 → 뒤집은 칼날(발밑 아래는 잘라 땅에 박힌 것처럼)을 붙이고, 손 위로 자루를 올린다. 원작 시트의 픽셀을 옮긴 것이라 색·질감이 그대로다.
     시안은 Pillow 로 만들었고(analysis/ref/art/plant_mock.png) 같은 손질을 여기서 캔버스로 한 번 해 둔다 — 그림 파일을 따로 싣지 않는다. 둘째 팔을 그려 넣은 C2 는 품질이 안 나와 쓰지 않는다 */
  P._plantSprite = function () {
    if (this._plant !== undefined) return this._plant;
    var D = this.D, t = D.types[15], img = D.assets.get('u15'); if (!t || !img || !img.complete || !img.naturalWidth) return null;
    var FR = t.frames || t.fr, AF = t.anim && t.anim.atk && t.anim.atk.f, r = FR && AF ? FR[AF[3 * 7 + 1]] : null; if (!r || r[2] !== 35 || r[3] !== 66) return (this._plant = null);   // 프레임이 예상한 그 그림이 아니면 쓰지 않는다
    var W = r[2], H = r[3], mk = function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
    var C = mk(W, H), g = C[1], B = mk(7, 33), G = mk(11, 2), y, x;
    g.drawImage(img, r[0], r[1], W, H, 0, 0, W, H); B[1].drawImage(img, r[0] + 24, r[1], 7, 33, 0, 0, 7, 33); G[1].drawImage(img, r[0] + 24, r[1] + 35, 11, 2, 0, 0, 11, 2);
    for (y = 0; y < 33; y++) g.clearRect(y <= 16 ? 24 : 25, y, W, 1);                 // 든 칼날
    g.clearRect(24, 33, W, 3); g.clearRect(26, 36, W, 1); g.clearRect(27, 37, W, 1);   // 코등이·칼밑 (손 y 39~42 는 남긴다)
    g.fillStyle = 'rgb(122,58,26)'; g.fillRect(28, 34, 1, 5); g.fillRect(28, 32, 1, 1); g.fillStyle = 'rgb(70,30,14)'; g.fillRect(29, 34, 1, 5); g.fillRect(27, 33, 4, 1); g.fillRect(29, 32, 1, 1);   // 손 위로 올라온 자루
    var gy = 43, vh = Math.max(1, r[5] + 1 - (gy + 2)); g.drawImage(G[0], 24, gy);
    var V = mk(7, vh); V[1].translate(0, vh); V[1].scale(1, -1); V[1].drawImage(B[0], 0, 33 - vh, 7, vh, 0, 0, 7, vh);   // 뒤집은 칼날의 땅 위로 보이는 만큼
    var d = V[1].getImageData(0, 0, 7, vh).data; g.fillStyle = 'rgb(34,36,44)';
    for (y = 0; y < vh; y++) { var x0 = -1, x1 = -1; for (x = 0; x < 7; x++) if (d[(y * 7 + x) * 4 + 3] > 40) { if (x0 < 0) x0 = x; x1 = x; } if (x0 >= 0) { g.fillRect(24 + x0, gy + 2 + y, 1, 1); g.fillRect(26 + x1, gy + 2 + y, 1, 1); } }   // 흰 바지 위에서 묻히지 않게 양옆 어두운 테두리
    g.drawImage(V[0], 25, gy + 2);
    return (this._plant = { c: C[0], ox: r[4], oy: r[5], w: W, h: H });
  };
  P._swordSprite = function () {   // 환영검의 검: 마법전사 공격 프레임(_plantSprite 와 같은 프레임)의 칼날 + 코등이 — 칼끝이 위를 본다
    if (this._sword !== undefined) return this._sword;
    var D = this.D, t = D.types[15], img = D.assets.get('u15'); if (!t || !img || !img.complete || !img.naturalWidth) return null;
    var FR = t.frames || t.fr, AF = t.anim && t.anim.atk && t.anim.atk.f, r = FR && AF ? FR[AF[3 * 7 + 1]] : null; if (!r || r[2] !== 35 || r[3] !== 66) return (this._sword = null);
    var c = document.createElement('canvas'); c.width = 11; c.height = 37; var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(img, r[0] + 24, r[1], 7, 33, 2, 0, 7, 33); g.drawImage(img, r[0] + 24, r[1] + 35, 11, 2, 0, 33, 11, 2); g.fillStyle = 'rgb(122,58,26)'; g.fillRect(5, 35, 1, 2); g.fillStyle = 'rgb(70,30,14)'; g.fillRect(6, 35, 1, 2);
    return (this._sword = c);
  };
  P._drawHero = function () { var D = this.D, ctx = D.ctx, h = this.hero, T = D.time;
    if (h.state !== 'dead') {   // 발밑의 노란 고리: 옅은 타원 + 도는 밝은 호 + 따라오는 점들 (붉은보석 도둑 영상의 발밑 고리 느낌 — 이 게임에서 그린 것)
      ctx.save(); ctx.translate(h.x, h.y + 2); ctx.scale(1, 0.45); ctx.globalCompositeOperation = 'lighter';
      var rg = ctx.createRadialGradient(0, 0, 6, 0, 0, 26); rg.addColorStop(0, 'rgba(255,220,60,.28)'); rg.addColorStop(1, 'rgba(255,200,40,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,90,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.3); ctx.stroke();
      var ra = T * 3.2; ctx.strokeStyle = 'rgba(255,250,200,.95)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 23, ra, ra + 1.5); ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,210,.9)'; for (var ri = 1; ri <= 5; ri++) { ctx.globalAlpha = 1 - ri * 0.17; ctx.beginPath(); ctx.arc(Math.cos(ra - ri * 0.2) * 23, Math.sin(ra - ri * 0.2) * 23, 1.6, 0, 6.3); ctx.fill(); }
      ctx.restore(); ctx.globalAlpha = 1; }
    var PS = this.rift && T - this.rift.t0 >= ULT.shadow.charge + ULT.shadow.plant * 0.5 && h.state !== 'dead' ? this._plantSprite() : null;
    if (PS) ctx.drawImage(PS.c, 0, 0, PS.w, PS.h, Math.round(h.x) - PS.ox, Math.round(h.y) - PS.oy, PS.w, PS.h); else D._drawUnit(h);   /* 천지파열무: 꽂은 뒤로는 전용 자세 그림 */
    ctx.globalAlpha = 1;
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
  /* 명예의 전당 (README 350, 2026-11-23 사용자 "디펜스 모드의 명예의 전당에 올리기처럼 최후의 3분에 죽어도 올릴 수 있게"): 최후의 3분까지 갔거나 10분을 버틴 판만 올린다.
     순위 = 버틴 시간(긴 순), 같으면 처치. 판은 갈래마다 (0 대도의 길 · 1 무사의 길). 시험용 주소 값(?sk= ?edmg= …)으로 시작한 판은 올리지 않는다 (?cls= 로 갈래를 골라 시작한 판은 올린다) */
  P._rankRes = function () {
    var self = this, stage = this.cls === 'shadow' ? 1 : 0, win = this.over === 'win', test = (root.location.search || '').replace(/^\?/, '').split('&').some(function (kv) { var k = kv.split('=')[0]; return k && ['mode', 'tut', 'mute', 'game', 'chk', 'bgmvol', 'cls'].indexOf(k) < 0   /* cls = 갈래로 바로 시작하는 주소 — 올릴 수 있다 (2026-11-23 사용자 "해당 클래스로 시작해도 작성할 수 있게") */; });
    if (!this.over) return null; if (test) return { stage: stage, res: null, msg: '시험용 주소로 시작한 판은 기록을 올릴 수 없습니다' };
    if (!win && !this._rage()) return { stage: stage, res: null, msg: '최후의 3분(' + mmss(CFG.RAGE.at) + ')까지 버티면 기록을 올릴 수 있습니다' };
    var units = ['dagger'].concat(Object.keys(this.sk).filter(function (k) { return k !== 'dagger'; })).filter(function (k) { return SK[k] && self.sk[k]; }).map(function (k) { return [String(SK[k].name).slice(0, 16), self.sk[k]]; }).slice(0, 40);
    return { stage: stage, res: { fac: 'surv', stage: stage, time: win ? CFG.TIME : Math.max(1, Math.min(CFG.TIME, Math.floor(this.t))), base: this.kills || 0, lost: this.lv, kills: this.kills || 0, units: units, cards: ['적 레벨 ' + Math.round((this.scaleK || 0) * 100) + '%'].concat(win ? ['완주'] : []) } };
  };
  /* 끝난 화면 = 결과 리포트: 생존 시간·웨이브·처치·레벨·전직 / 준 피해·최고 한 방·치명타·받은 피해 / 가진 스킬 */
  P._drawOver = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, self = this, win = this.over === 'win', al = Math.min(1, this.overT / 0.6), ST = this.stat, pw = Math.min(330, W - 28), px = Math.round((W - pw) / 2), i;
    var keys = Object.keys(this.sk).filter(function (k) { return k !== 'dagger'; }), all = (this.sk.dagger ? ['dagger'] : []).concat(keys), per = Math.floor((pw - 28) / 40), srows = Math.ceil(all.length / per), ph = 280 + srows * 46 + 166, py = Math.max(24, Math.round((H - ph) / 2));
    ctx.fillStyle = 'rgba(4,6,10,' + (0.74 * al).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); if (this.overT < 0.6) { this.overBtns = null; return; }
    D._plate(px, py, pw, ph, 8, false); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = win ? '#ffd36e' : '#ffb4a8'; ctx.fillText(win ? '10분을 버텼습니다' : '쓰러졌습니다', W / 2, py + 34);
    var rows = [['생존 시간', mmss(Math.floor(this.t))], ['웨이브', this._shown() + ' / ' + CFG.SHOWN + (this.scaleK > 0 ? '  ·  적 레벨 ' + Math.round(this.scaleK * 100) + '%' : '')], ['처치', this.kills + (ST.boss ? '  (우두머리 ' + ST.boss + ')' : '')], ['레벨', this.lv + (this.cls ? '  ·  ' + CLS[this.cls].name : '')],
      ['준 피해', Math.round(ST.dealt).toLocaleString()], ['최고 한 방', ST.maxHit.toLocaleString()], ['치명타 / 더블', ST.crit + ' / ' + ST.dbl], ['받은 피해', Math.round(ST.taken).toLocaleString()]];
    ctx.font = '13px sans-serif';
    for (i = 0; i < rows.length; i++) { var ry = py + 68 + i * 24; ctx.textAlign = 'left'; ctx.fillStyle = '#9aa3b8'; ctx.fillText(rows[i][0], px + 24, ry); ctx.textAlign = 'right'; ctx.fillStyle = i < 4 ? '#ffe9b0' : '#dfe6f5'; ctx.fillText(rows[i][1], px + pw - 24, ry);
      if (i === 3) { ctx.fillStyle = 'rgba(168,130,58,.5)'; ctx.fillRect(px + 20, ry + 12, pw - 40, 1); } }
    var sy = py + 68 + rows.length * 24 + 10, IC = D.data.fx.icon, icons = D.assets.get('acticons');
    ctx.textAlign = 'left'; ctx.fillStyle = '#9aa3b8'; ctx.fillText('스킬', px + 24, sy);
    all.forEach(function (k, n) { var bx = px + 16 + (n % per) * 40, by = sy + 14 + Math.floor(n / per) * 46, fi = SK[k].icon * 2; if (SK[k].art) SK[k].art(ctx, bx, by + 1, 34, 34); else if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, bx, by, 34, 37);
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(self.sk[k], bx + 34, by + 32); ctx.fillStyle = self._evo(k) ? '#ffd36e' : '#fff'; ctx.fillText(self.sk[k], bx + 34, by + 32); });
    var rk = D._rankShow && D.constructor.RANK && D.constructor.RANK.surv ? this._rankRes() : null, bts = (rk ? [['rank', rk.res ? '기록 올리기 · 명예의 전당' : '명예의 전당 보기']] : []).concat([['retry', '다시 하기'], ['exit', '모드 선택으로']]), by0 = py + ph - 12 - bts.length * 50; this.overBtns = []; ctx.textAlign = 'center';
    for (i = 0; i < bts.length; i++) { var b = { x: px + 14, y: by0 + i * 50, w: pw - 28, h: 42, act: bts[i][0] }; this.overBtns.push(b); D._plate(b.x, b.y, b.w, b.h, 5, b.act === 'rank' && !!rk.res); ctx.font = 'bold 14px sans-serif'; ctx.fillStyle = b.act === 'rank' && rk.res ? '#ffd36e' : '#dfe6f5'; ctx.fillText(bts[i][1], b.x + b.w / 2, b.y + b.h / 2); }
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
    ctx.font = 'bold 11px sans-serif'; txt((this._rage() ? '최후 3분' : '웨이브 ' + this._shown() + '/' + CFG.SHOWN) + (this.scaleK > 0 ? '  적 Lv ' + Math.round(this._foeLv()) : ''), 66, 'left', '#c9b48a');
    // 알림 한 줄 (웨이브·우두머리): 위쪽 띠 바로 아래에 작고 짧게
    var BN = this.banner, bt = BN ? D.time - BN.t0 : 9; if (BN && bt < 2.2) { ctx.globalAlpha = Math.min(1, bt / 0.2, (2.2 - bt) / 0.5); ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(BN.s, W / 2, X.y + 54); ctx.fillStyle = BN.col; ctx.fillText(BN.s, W / 2, X.y + 54); ctx.globalAlpha = 1; }
    // 화면 밖 우두머리: 가장자리에 붉은 화살표
    var Zm = CFG.ZOOM, hx0 = W / 2, hy0 = D.H * CFG.HERO_Y, F = this.foes;
    for (i = 0; i < F.length; i++) { var bo = F[i]; if (!bo.boss || bo.state === 'dead') continue; var sx = hx0 + (bo.x - this.cam.x) * Zm, sy = hy0 + (bo.y - this.cam.y) * Zm;
      if (sx > 16 && sx < W - 16 && sy > 70 && sy < this.hudBot - 10) continue; var ax = Math.max(18, Math.min(W - 18, sx)), ay = Math.max(74, Math.min(this.hudBot - 14, sy)), an = Math.atan2(sy - ay, sx - ax), pu = 0.6 + 0.4 * Math.sin(D.time * 7);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(an); ctx.globalAlpha = pu; ctx.fillStyle = '#ff5a3a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
    var SH3 = this.shrine; if (SH3) { var s3x = hx0 + (SH3.x - this.cam.x) * Zm, s3y = hy0 + (SH3.y - this.cam.y) * Zm; if (!(s3x > 16 && s3x < W - 16 && s3y > 70 && s3y < this.hudBot - 10)) { var a3x = Math.max(18, Math.min(W - 18, s3x)), a3y = Math.max(74, Math.min(this.hudBot - 14, s3y)), a3 = Math.atan2(s3y - a3y, s3x - a3x);   /* 화면 밖 성소: 가장자리에 종류 색 화살표 */
        ctx.save(); ctx.translate(a3x, a3y); ctx.rotate(a3); ctx.globalAlpha = 0.75 + 0.25 * Math.sin(D.time * 5); ctx.fillStyle = CFG.SHRINE.kinds[SH3.k].col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); } }
    var BF3 = this.buff, b3 = ['war', 'magic', 'guard'].filter(function (k) { return D.time < BF3[k]; }); for (i = 0; i < b3.length; i++) { var K3 = CFG.SHRINE.kinds[b3[i]], bx3 = 8, by3 = X.y + 64 + i * 11, r3 = Math.max(0, Math.min(1, (BF3[b3[i]] - D.time) / CFG.SHRINE.sec));   /* 성소 강화: 왼쪽 위에 이름과 남은 시간 줄 (작게) */
      ctx.globalAlpha = 0.9; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(bx3, by3, 40, 4); ctx.fillStyle = K3.col; ctx.fillRect(bx3, by3, Math.round(40 * r3), 4); ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(K3.name.slice(0, 2), bx3 + 44, by3 + 2); ctx.fillText(K3.name.slice(0, 2), bx3 + 44, by3 + 2); ctx.globalAlpha = 1; }
    var RW2 = this.rushWarn; if (RW2) { var ex = hx0 - Math.cos(RW2.a) * 900, ey = hy0 - Math.sin(RW2.a) * 900, qx = Math.max(22, Math.min(W - 22, ex)), qy = Math.max(78, Math.min(this.hudBot - 18, ey)), pq = 0.55 + 0.45 * Math.sin(D.time * 12);   // 돌진이 오는 쪽 가장자리: 붉은 겹화살표
      ctx.save(); ctx.translate(qx, qy); ctx.rotate(RW2.a); ctx.globalAlpha = pq; ctx.fillStyle = '#ff4a2a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; for (i = 0; i < 3; i++) { var cx3 = i * 11 - 6; ctx.beginPath(); ctx.moveTo(cx3 + 9, 0); ctx.lineTo(cx3 - 4, -10); ctx.lineTo(cx3, 0); ctx.lineTo(cx3 - 4, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); } ctx.restore(); }
    ctx.textBaseline = 'middle'; ctx.font = 'bold 15px sans-serif';
    ctx.font = 'bold 12px sans-serif'; txt('Lv ' + this.lv, this.menuBtn.x - 8, 'right', '#9cc0ff');
    var M = this.menuBtn; D._plate(M.x, M.y, M.w, M.h, 5, false); ctx.fillStyle = '#e6c476'; for (i = 0; i < 3; i++) ctx.fillRect(M.x + 10, M.y + 8 + i * 5, M.w - 20, 2);
    // 스킬 칸: 얻은 순서대로 (아이콘 + 레벨, 주기 스킬은 남은 대기만큼 어둡게 덮인다). 누르는 버튼이 아니라 지금 빌드의 표시
    var IC = D.data.fx.icon, icons = D.assets.get('acticons'), self = this, icon = function (ic, b, pad) { var fi = ic * 2; if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, b.x + pad, b.y + pad, b.w - pad * 2, b.h - pad * 2); }, skIcon = function (k, b, pad) { if (SK[k].art) SK[k].art(ctx, b.x + pad, b.y + pad, b.w - pad * 2, b.h - pad * 2); else icon(SK[k].icon, b, pad); };   // 캔버스 그림(art)이 있는 스킬은 그것으로
    var cool = function (key, b) { var s = SK[key], l = self.sk[key], r = s.cd && self.tm[key] > 0 ? Math.min(1, self.tm[key] / (s.cd(l) * (1 - self._pv('haste')) * (self.ult === key ? GROW.ultCd : 1))) : 0; if (r > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(b.x + 3, b.y + 3 + (b.h - 6) * (1 - r), b.w - 6, (b.h - 6) * r); } };
    this.hit = [];   // 누를 수 있는 칸들 [{x,y,w,h,key}] (꾹 누르면 설명, 수동 스킬은 짧게 누르면 발동)
    for (i = 0; i < this.slots.length; i++) { var b = this.slots[i], key = this.order[i], isU = key && this.ult === key, ak = key && this._awk(key); ctx.globalAlpha = key ? (isU ? 0.6 : 1) : 0.4; D._plate(b.x, b.y, b.w, b.h, 4, false);
      if (key) { this.hit.push({ x: b.x, y: b.y, w: b.w, h: b.h, key: key }); skIcon(key, b, 4); if (!isU) cool(key, b);
        if (isU) { ctx.globalAlpha = 1; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.fillRect(b.x + 2, b.y + 2, 11, 10); ctx.fillStyle = '#ffd36e'; ctx.fillText('궁', b.x + 3, b.y + 8); }
        if (ak) { ctx.strokeStyle = '#7fe0ff'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3); }   // 각성한 스킬: 하늘색 테
        ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); ctx.fillStyle = ak ? '#7fe0ff' : this._evo(key) ? '#ffd36e' : '#fff'; ctx.fillText(this.sk[key], b.x + b.w - 3, b.y + b.h - 7); } }
    var pas = Object.keys(this.sk).filter(function (k) { return SK[k].tree === 'pas' || SK[k].trait; }); ctx.globalAlpha = 1;   // 패시브: 스킬 줄 위에 작은 칸
    for (i = 0; i < pas.length; i++) { var pb = { x: 8 + i * 28, y: this.slots[0].y - 28, w: 24, h: 24, key: pas[i] }; this.hit.push(pb); D._plate(pb.x, pb.y, pb.w, pb.h, 3, false); skIcon(pas[i], pb, 3);
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#000'; ctx.strokeText(this.sk[pas[i]], pb.x + pb.w - 2, pb.y + pb.h - 5); ctx.fillStyle = '#fff'; ctx.fillText(this.sk[pas[i]], pb.x + pb.w - 2, pb.y + pb.h - 5); }
    this.hit.push({ x: this.blinkBtn.x, y: this.blinkBtn.y, w: this.blinkBtn.w, h: this.blinkBtn.h, key: 'blink' });
    // 궁극기 칸: 고급 스킬 하나를 올려 직접 쓴다 (설명 카드에서 올린다). 준비되면 금빛으로 맥박친다. 올릴 수 있는 스킬이 하나도 없으면 칸을 그리지 않는다
    var B = this.blinkBtn; ctx.globalAlpha = 1; D._plate(B.x, B.y, B.w, B.h, 6, !(this.tm.blink > 0)); icon(SK.blink.icon, B, 6); cool('blink', B);   // 축지법 칸
    var U = this.ultBtn, UD = this.cls && ULT[this.cls];   // 궁극기 칸: 전직한 뒤에만 보인다
    if (UD) { var urdy = !(this.tm.ult > 0), ucd = ULT.cd * (1 - this._pv('haste')); ctx.globalAlpha = 1; D._plate(U.x, U.y, U.w, U.h, 6, urdy); this.hit.push({ x: U.x, y: U.y, w: U.w, h: U.h, key: 'ult' }); if (UD.art) UD.art(ctx, U.x + 5, U.y + 5, U.w - 10, U.h - 10); else icon(UD.icon, U, 6);
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
      if (self.guide) { if (self.guideT > 0.4) { self.guide = false; if (D._raceSnd) D._raceSnd('click'); } return; }   // 시작 안내: 아무 데나 누르면 시작
      D.sfx.unlock(); D.bgm.resume();
      if (self.menu) { self._menuTap(x, y); return; }
      if (self.cards) { self._cardTap(x, y); return; }
      if (self.info) { self._infoTap(x, y); return; }
      if (self.over) { (self.overBtns || []).forEach(function (b) { if (inBox(b, x, y)) { if (b.act === 'rank') D._rankShow(false, self._rankRes()); else if (b.act === 'retry') self.reset(); else self.exit(); } }); return; }
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
  /* 캔버스 스킬 그림(art)의 공용 조각: artBg = 어두운 청록 바탕(save·clip 까지 — 그린 쪽에서 restore), artDag = 단검 한 자루((px, py) = 코등이, ang = 칼끝 방향, L = 길이 기준, s = 그림 크기, dark = 뒤쪽 단검) */
  var artBg = function (ctx, x, y, w, h) { var s = Math.min(w, h), cx = x + w / 2, cy = y + h / 2; ctx.save(); ctx.fillStyle = '#0b1416'; ctx.fillRect(x, y, w, h); var bg = ctx.createRadialGradient(cx, cy, 1, cx, cy, s * 0.7); bg.addColorStop(0, 'rgba(70,170,180,.45)'); bg.addColorStop(1, 'rgba(10,30,35,0)'); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); };
  var artDag = function (ctx, px, py, ang, L, s, dark) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    var bl = ctx.createLinearGradient(0, -L * 0.07, 0, L * 0.07); bl.addColorStop(0, dark ? '#7f969b' : '#f4fbff'); bl.addColorStop(0.5, dark ? '#b9c9cc' : '#ffffff'); bl.addColorStop(0.55, dark ? '#55686c' : '#9fb4ba'); bl.addColorStop(1, dark ? '#3a4a4e' : '#6f868c');
    ctx.fillStyle = bl; ctx.strokeStyle = '#05090a'; ctx.lineWidth = Math.max(1, s * 0.03); ctx.beginPath(); ctx.moveTo(0, -L * 0.065); ctx.lineTo(L * 0.42, -L * 0.05); ctx.lineTo(L * 0.6, 0); ctx.lineTo(L * 0.42, L * 0.05); ctx.lineTo(0, L * 0.065); ctx.closePath(); ctx.fill(); ctx.stroke();   // 날
    ctx.fillStyle = dark ? '#2f5f63' : '#3fa6ad'; ctx.fillRect(-L * 0.035, -L * 0.13, L * 0.07, L * 0.26); ctx.strokeRect(-L * 0.035, -L * 0.13, L * 0.07, L * 0.26);   // 코등이
    ctx.fillStyle = dark ? '#3a2a1c' : '#5c3f24'; ctx.fillRect(-L * 0.26, -L * 0.035, L * 0.225, L * 0.07); ctx.strokeRect(-L * 0.26, -L * 0.035, L * 0.225, L * 0.07);   // 손잡이
    ctx.fillStyle = dark ? '#2f5f63' : '#3fa6ad'; ctx.beginPath(); ctx.arc(-L * 0.29, 0, L * 0.05, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore(); };
  var SK = {
    dagger: { awk: { pas: 'power', name: '관통 단검', text: '맞은 적 옆의 적 하나도 60% 피해' }, name: '단도 던지기', tree: 'throw', icon: 63, slot: 1, evo: { cls: 'trapper', name: '폭탄 던지기' }, dmg: L5([1, 1.2, 1.4, 1.65, 1.9]), sec: L5([1, 0.93, 0.86, 0.8, 0.72]),
      desc: function (l, ev) { return ev ? '가장 가까운 적에게 폭탄을 던집니다. 맞은 자리 반경 ' + (GROW.bomb.r + GROW.bomb.rLv * l) + ' 안의 적 모두에게 피해 ' + pc(this.dmg(l) * GROW.bomb.mul) + ', 던지는 간격 ' + pc(this.sec(l) * GROW.bomb.sec) : '가장 가까운 적에게 단검을 던집니다. 피해 ' + pc(this.dmg(l)) + ', 던지는 간격 ' + pc(this.sec(l)); } },
    double: { awk: { pas: 'haste', name: '연속 드로잉', text: '타격이 한 번 더' }, name: '더블 드로잉', tree: 'throw', icon: 5, slot: 1,
      /* 359번(2026-11-23 사용자 "대도의 더블 쓰로잉의 네이밍을 더블 드로잉으로, 레벨업 될수록 한 번에 던지는 갯수가 2배수로 증가, 크리티컬·더블 크리티컬 확률이 비약적으로 상승 — 몬스터가 쌓이는 걸 방지. 주변의 적에게도 튕겨 가까운 적에게도 데미지 100%"):
         대도의 길이면 — 더 치는 횟수 n = 2·4·6·8·10, 치명타 확률 + crit, 더블 크리티컬 확률 + crit2 (모든 공격에), 더 칠 때마다 맞은 적 둘레 bounce 안의 다른 적 하나에게도 같은 피해(가까운 순으로 돌아가며) */
      evo: { cls: 'venom', name: '더블 드로잉', n: L5([2, 4, 6, 8, 10]), crit: L5([0.06, 0.12, 0.18, 0.24, 0.3]), crit2: L5([0.05, 0.1, 0.15, 0.2, 0.25]), bounce: 84 },
      art: function (ctx, x, y, w, h) {   /* 버튼 그림: 비스듬히 겹친 단검 두 자루 (2026-11-20 사용자 "스킬그림은 단도를 겹친 그림처럼" + 붉은보석 더블 드로잉 아이콘 화면 — 구도만 참고, 캔버스로 이 게임에서 그린 것) */
        var s = Math.min(w, h), cx = x + w / 2, cy = y + h / 2, L = s * 0.98, sh = L * 0.1 * Math.SQRT1_2; artBg(ctx, x, y, w, h);
        artDag(ctx, cx + s * 0.13 - sh, cy - s * 0.01 - sh, 0.785, L, s, true); artDag(ctx, cx - s * 0.1 - sh, cy + s * 0.02 - sh, 0.785, L, s, false);   // 뒤쪽(어둡게) → 앞쪽, 칼끝이 오른쪽 아래
        ctx.restore(); },
      n: L5([1, 1, 2, 2, 3]), dmg: L5([0.6, 0.75, 0.75, 0.9, 0.9]),
      desc: function (l, ev) { return ev ? '단검 하나가 ' + this.evo.n(l) + '번 더 타격하고, 그때마다 가까운 적에게도 튕깁니다 (각 피해 ' + pc(this.dmg(l)) + '). 치명타 +' + pc(this.evo.crit(l)) + ' · 더블 크리티컬 +' + pc(this.evo.crit2(l)) : '단검 하나가 ' + this.n(l) + '번 더 타격합니다 (각 피해 ' + pc(this.dmg(l)) + ')'; } },
    scatter: { name: '단도 흩뿌리기', tree: 'throw', icon: 4, slot: 1, evo: { cls: 'venom', name: '단도 흩뿌리기' },   /* 전직해도 이름 그대로 (2026-11-20 사용자 — 전에는 '단도 총공격') */
      art: function (ctx, x, y, w, h) {   /* 버튼 그림: 손잡이가 아래 한 점에 모이고 칼끝이 위로 부채꼴로 퍼진 단검 다섯 (2026-11-20 사용자 "단도가 부채꼴 모양의 그림으로") */
        var s = Math.min(w, h), cx = x + w / 2, py = y + h * 0.86, L = s * 0.76, A = [-0.62, 0.62, -0.31, 0.31, 0]; artBg(ctx, x, y, w, h);
        A.forEach(function (d) { var a = -1.5708 + d; artDag(ctx, cx + Math.cos(a) * L * 0.3, py + Math.sin(a) * L * 0.3, a, L, s, Math.abs(d) > 0.5); });   // 바깥쪽(어둡게) → 가운데
        ctx.restore(); },
      cd: L5([2.4, 2.4, 2.2, 2.2, 2]), n: L5([6, 8, 10, 12, 14]), m: L5([4, 5, 6, 7, 8]), evoAng: 1.4, ang: L5([50, 65, 80, 95, 110]), far: L5([0.4, 0.55, 0.7, 0.85, 1]), dmg: L5([0.7, 0.8, 0.9, 1, 1.1]),   // 300번(2026-11-20 사용자): 가까운 n명 → 가장 가까운 적 쪽 부채꼴(각도 ang°, 사거리 안)로 단검 m개가 고르게 퍼져 곧게 날아가며 적을 꿰뚫는다(한 번에 n명까지, 같은 적은 한 번). 다팅 피버(단검 없이 제자리에서 돌며 둘레를 즉시 타격)와 연출이 겹치지 않게 — 사용자. far = 사거리 끝에서의 피해 비율(가까울수록 온전히, 5단계는 거리와 무관). 쓰로워 진화 = 각도 ×1.4·단검 +2·대상 +4 (한쪽 방향만)
      desc: function (l, ev) { return '가장 가까운 적 쪽 부채꼴(' + Math.round(this.ang(l) * (ev ? this.evoAng : 1)) + '°)로 단검 ' + (this.m(l) + (ev ? 2 : 0)) + '개를 흩뿌려 꿰뚫습니다 — 한 번에 ' + (this.n(l) + (ev ? 4 : 0)) + '명까지 (피해 ' + pc(this.dmg(l)) + (this.far(l) < 1 ? ', 먼 적은 ' + pc(this.dmg(l) * this.far(l)) + '까지 약해짐' : ', 거리와 무관') + ')'; } },
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
    blink: { name: '축지법', tree: 'shadow', icon: 12, cd: L5([6, 5.5, 5, 4.5, 4]), dist: L5([110, 125, 140, 155, 170]),   /* 355번에서 110·140·170·205·240 으로 늘렸다가 360번(2026-11-23 사용자 "축지법 사거리 원래대로")에 되돌림 */
      desc: function (l) { return '화면을 두 번 누르면 그쪽으로 ' + this.dist(l) + '만큼 순간 이동합니다 (대기 ' + this.cd(l) + '초, 잠깐 무적)'; } },
    surprise: { awk: { pas: 'power', name: '연쇄 기습', text: '가장 튼튼한 적 셋을 한꺼번에' }, man: 1, name: '기습', tree: 'shadow', icon: 85, slot: 1, fx: 74, evo: { cls: 'shadow', name: '교란' }, cd: L5([7, 6.5, 6, 5.5, 5]), dmg: L5([5, 6.5, 8, 10, 12]), range: 230,
      desc: function (l, ev) { return this.cd(l) + '초마다 가장 튼튼한 적을 급습해 피해 ' + pc(this.dmg(l)) + (ev ? ', 둘레의 적을 2초 멈춥니다' : ''); } },
    shadow: { awk: { pas: 'regen', name: '그림자 치유', text: '기습할 때 체력 20% 회복' }, man: 1, only: 'shadow', trait: 1, name: '그림자 숨기', tree: 'shadow', icon: 11, evo: { cls: 'shadow', name: '그림자 동화' }, cd: L5([16, 15, 14, 13, 12]), dur: L5([6, 6.5, 7, 7.5, 8]), crit: L5([0.2, 0.275, 0.35, 0.425, 0.5]), amb: L5([4, 5, 6, 7.5, 9]),
      desc: function (l) { return this.cd(l) + '초마다 숨습니다(최대 ' + this.dur(l) + '초) — 적이 도둑을 놓치고 서성이며, 자동 공격은 멈춥니다. 적을 누르면 그 적 옆으로 가서 기습하고 풀립니다(피해 ' + pc(this.amb(l)) + ', 반드시 치명타)'; } },   /* 2026-11-19 사용자: "모든 적이 멈추는 게 아닌, 어그로만 끌리지 않은 상태에서(게임 진행) 내가 타겟한 적을 공격" */   /* 2026-11-19 사용자 "그림자 숨기 하고 난 후 자동 공격 말고 적을 찍어야 풀리면서 게임 진행되도록" — 전에는 몇 초 숨었다 저절로 풀렸다 */
    assassin: { name: '암살', tree: 'shadow', icon: 41, slot: 1, evo: { cls: 'shadow', name: '암살' }, p: L5([0.03, 0.05, 0.07, 0.09, 0.12]),
      desc: function (l, ev) { return '단검에 맞은 적이 ' + pc(this.p(l) * (ev ? 1.5 : 1)) + ' 확률로 즉사합니다 (우두머리는 5배 피해)'; } },
    /* 그림자 검술 (tree: blade) — 섀도우 인필트레이터로 전직하면 칼 스킬이 전부 이것으로 바뀐다(_toBlade: 단계는 이어받는다). 전직 전에는 카드에 안 나온다 */
    /* Z 가르기 (317번 — 316번에서 궁극기로 만들었던 것을 사용자가 "궁극기가 아닌 일반 스킬로"): 어쌔신이 검을 들고 화면을 Z 자로 가로지르며 지나는 길(폭 w) 위의 적만 한 번씩 벤다. 달리는 동안 무적·조작 불가, 화면은 세워 둔다. 그림자 돌진(가까운 무리 쪽으로 한 줄 150~220)과 달리 화면 전체를 훑는다 */
    /* 환영검 (338번, 2026-11-20 사용자: "설화난영참을 제거하고 — 투검: 360도 방향으로 검들이 쪼개져 나와서 각각의 적을 Z 자로 꿰뚫음. 횟수는 처음엔 각 검당 3번, 업하면서 증가. 처음 쪼개진 검의 개수는 4개, 이것도 점점 증가" + "검 조각들은 한 번 뚫고 지나서 다음번 뚫을 때까지 살짝 딜레이. 모양은 길이는 같되 폭은 작은 검 모양. 스킬 이름: 환영검"):
       무사의 몸에서 검 n 자루가 360° 로 고르게 갈라져 나와(out), 저마다 가까운 적을 꿰뚫고 지나간 뒤(over 만큼 더 나아감) 잠깐 멈춰 방향을 틀고(wait) 다음 적을 꿰뚫는다 — 검마다 hits 번. 곧은 선이 꺾이며 이어져 Z 자가 된다.
       아직 안 찌른 적을 먼저 고르고, 없으면 방금 찌른 적이 아닌 적, 그것도 없으면 같은 적을 다시. 검 그림 = 마법전사 스프라이트의 칼날을 길이는 그대로·폭은 slim 배로 좁힌 것. 무사는 그대로 움직인다 (코드 키는 zrun 그대로) */
    zrun: { name: '환영검', tree: 'blade', icon: 41, slot: 1,
      art: function (ctx, x, y, w, h) {   /* 버튼 그림: 가운데에서 사방으로 뻗어 나가는 가는 칼날 여덟 (2026-11-23 사용자 "여러 칼날이 사방으로 나가는 모양") — 대각선 넷은 조금 짧고 흐리게 */
        var s = Math.min(w, h), cx = x + w / 2, cy = y + h / 2, i; artBg(ctx, x, y, w, h);
        var gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.2); gl.addColorStop(0, 'rgba(235,245,255,.95)'); gl.addColorStop(1, 'rgba(150,200,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, 6.2832); ctx.fill();
        for (i = 0; i < 8; i++) { var dg = i % 2, r0 = s * 0.15, r1 = s * (dg ? 0.4 : 0.49), bw = s * (dg ? 0.045 : 0.06); ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * 0.7854 - 1.5708); ctx.globalAlpha = dg ? 0.8 : 1;
          ctx.beginPath(); ctx.moveTo(r0, -bw); ctx.lineTo(r1 - bw * 2.2, -bw); ctx.lineTo(r1, 0); ctx.lineTo(r1 - bw * 2.2, bw); ctx.lineTo(r0, bw); ctx.closePath(); ctx.fillStyle = '#dcecff'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#27405c'; ctx.stroke();
          ctx.fillStyle = '#7fa6d8'; ctx.fillRect(r0, 0, r1 - r0 - bw * 2.2, bw);   /* 날의 한쪽 면은 어둡게 */
          ctx.fillStyle = '#e8c860'; ctx.fillRect(r0 - s * 0.03, -bw * 2, s * 0.03, bw * 4); ctx.restore(); }   /* 금빛 코등이 */
        ctx.restore(); }, cd: L5([12, 11.5, 11, 10.5, 10]), n: L5([4, 5, 6, 8, 10]), hits: L5([3, 4, 5, 6, 7]), dmg: L5([0.9, 1, 1.1, 1.25, 1.4]), stop: 0.06, push: 5,   /* 354번(2026-11-23 사용자 "스킬 오를수록 갯수 증가와 데미지 증가, 찌르는 횟수 증가" · "찌를 때 임팩트 좀 더 있게"): 검 수는 4·5단계에서 7·8 → 8·10 (찌르는 횟수·피해는 전부터 단계마다 올랐다). 찌르는 순간 — 검이 stop 초 동안 적에게 박혀 멈추고, 적이 push 만큼 밀리고, 꿰뚫는 빛줄기와 큰 섬광 */ spdK: q('zspd', 1.3), stabK: q('zstab', 3.4), out: 46, over: 22, wait: q('zwait', 0.16), seek: 440, slim: 0.55, life: 14,   /* 340번(사용자 "지금보다 좀 더 빠르게 찌르고, 찌른 뒤에 딜레이를 지금 속도로, 그리고 무조건 근접해 있는 적부터 찌르지 말고 맵의 모든 영역에 랜덤하게 퍼지도록"): 적에게 날아가 꿰뚫는 동안은 걸음 × stabK, 꿰뚫은 뒤 더 나아가는 것과 갈라져 나오는 것은 전처럼 × spdK + 멈춤 wait. 대상 = 무사에게서 seek 안(화면 전체)의 적 가운데 **무작위** — 다른 검이 겨눈 적·이미 찌른 적·방금 찌른 적은 뒤로 미룬다 */   /* 339번(사용자 "검 궤적을 보여 줄 필요는 없고, 쪼개진 검들의 이동이 너무 빨라서 플레이어가 걷는 속도보다 약간 더 빠르게만, 그리고 다른 스킬 시전 시에는 나오면 안 됨"): 검의 속도 = 무사 걸음 × spdK(전에는 초당 820), 지나온 선은 그리지 않는다, 천지파열무·회오리 베기·진공참을 쓰는 중이거나 숨어 있을 때는 발동을 미룬다. life = 검이 남아 있는 최대 시간 */
      desc: function (l) { return this.cd(l) + '초마다 검 ' + this.n(l) + '자루가 사방으로 갈라져 나와, 저마다 적을 ' + this.hits(l) + '번씩 Z자로 꿰뚫습니다 (한 번에 피해 ' + pc(this.dmg(l)) + ')'; } },
    slash: { awk: { pas: 'power', name: '초승달 베기', text: '베기가 둘레 전체(원)로 넓어진다' }, name: '수직 베기', tree: 'blade', icon: 0, slot: 1, dmg: L5([1, 1.15, 1.3, 1.5, 1.7]), r: L5([76, 76, 76, 76, 76]), sec: L5([1, 0.92, 0.84, 0.77, 0.7]), crit: L5([0, 0.04, 0.08, 0.12, 0.16]),   /* 316번(2026-11-20 사용자 "기본 스킬을 수평 베기로 하고 올릴수록 빠르기·데미지·크리티컬 확률"): 그림자 베기(단계마다 반경이 커짐 — 회오리 베기와 겹쳤다) → 반경은 그대로 두고 간격·피해·치명타 확률(어쌔신의 모든 타격에 더해진다) */
      desc: function (l) { return '가장 가까운 적 하나를 위에서 아래로 내려 벱니다 — 피해 ' + pc(this.dmg(l)) + ', 베는 간격 ' + pc(this.sec(l)) + ', 치명타 확률 +' + Math.round(this.crit(l) * 100) + '%'; } },
    combo: { name: '연속 베기', tree: 'blade', icon: 10, slot: 1, n: L5([1, 1, 2, 2, 3]), dmg: L5([0.5, 0.6, 0.6, 0.7, 0.75]),
      desc: function (l) { return '벤 적을 ' + this.n(l) + '번 더 칩니다 (각 피해 ' + pc(this.dmg(l)) + ')'; } },
    whirl: { awk: { pas: 'reach', name: '폭풍 칼날', text: '범위 1.5배' }, name: '회오리 베기', tree: 'blade', icon: 59, slot: 1, cd: L5([7, 6.5, 6, 5.5, 5]), w: L5([2, 2, 3, 3, 4]), r: 105, dmg: L5([0.9, 1, 1.1, 1.25, 1.4]),
      desc: function (l) { return this.cd(l) + '초마다 제자리에서 돌며 둘레(반경 ' + this.r + ')의 적을 ' + this.w(l) + '번 벱니다 (피해 ' + pc(this.dmg(l)) + ')'; } },
    /* 진공참 (333번 — 이름은 사용자가 정함: "진공참으로 바꾸자 이름". 2026-11-20 사용자: "적진으로 순간이동해서 공격하는 암살 기능 없애고 검기를 뿌리는 스킬로 — 적진 한가운데로 들어가면 의도치 않게 죽을 수도"): 그림자 돌진(적이 가장 많은 쪽으로 몸이 뛰어듦)을 대체. 무사는 제자리에서 휘두르고, 초승달 모양 검기가 적이 가장 많은 쪽으로 날아가(dist) 길(폭 w) 위의 적을 모두 벤다. 코드 키는 dash 그대로 */
    dash: { awk: { pas: 'last', name: '쌍진공참', text: '곧이어 진공참을 한 번 더 날린다' }, name: '진공참', tree: 'blade', icon: 96, slot: 1, cd: L5([9, 8.5, 8, 7.5, 7]), dist: L5([220, 240, 260, 280, 300]), dmg: L5([1.6, 2, 2.4, 2.9, 3.4]), w: 40, speed: 640,
      desc: function (l) { return this.cd(l) + '초마다 적이 가장 많은 쪽으로 검기를 날려 ' + this.dist(l) + ' 거리까지 길 위의 적 모두에게 피해 ' + pc(this.dmg(l)) + ' (제자리에서 쓴다)'; } },
    after: { name: '잔상', tree: 'blade', icon: 15, slot: 1, p: L5([0.4, 0.5, 0.6, 0.7, 0.8]),
      desc: function (l) { return '벤 자리에 분신이 남아 ' + CFG.BLADE.after + '초 뒤 같은 베기를 한 번 더 합니다 (피해 ' + pc(this.p(l)) + ') — 움직이며 싸우면 두 곳을 벱니다'; } },
    blood: { awk: { pas: 'regen', name: '흡혈 검', text: '처치 회복 2.5배' }, name: '피의 칼날', tree: 'blade', icon: 88, slot: 1, bleed: L5([0.15, 0.2, 0.25, 0.3, 0.4]), heal: L5([0.2, 0.3, 0.4, 0.5, 0.6]), kill: L5([0.02, 0.03, 0.04, 0.05, 0.07]),
      desc: function (l) { return '벤 적이 3초 동안 피를 흘립니다(초당 ' + pc(this.bleed(l)) + '). 쓰러뜨릴 때마다 체력 +' + this.heal(l) + ', ' + pc(this.kill(l)) + ' 확률로 즉사(우두머리 제외)'; } },
    /* 트래퍼 전용 주력 (2026-11-19 사용자 "주력 스킬을 독 묻힌 단도, 폭발 단도 — 적이 맞았을 때 그 자리에서 스플래시"): 전직하면 둘 다 1단계로 생기고 카드로 올린다.
       스킬 칸을 차지하지 않는다(trait — 패시브 줄에 작은 칸). 단검이 맞은 자리에서 터진다(같은 적에게는 0.15초에 한 번 — 더블 드로잉의 추가 타격마다 터지지 않게) */
    /* 트래퍼 주력 둘 (303번, 2026-11-20 사용자 컨셉): 독 묻힌 단도 = 한 적만 세게 치고 중독 — 중독된 채 쓰러지면 그 자리에 독 구름(둘레에 큰 피해).
       암흑 단도(폭발 단도를 대체) = 맞은 적이 sec 초 동안 암흑 물질에 감염 — 그동안 쓰러지면 폭발해 둘레에 피해, sec 초가 지나면 풀린다. 전에는 둘 다 "맞은 자리에서 바로 터지는 범위 피해"라 폭발 함정·유독가스와 겹쳤다 */
    /* 폭탄 다발 투척 (311번, 2026-11-20 사용자 — 붉은보석 공주의 「병 다발 투척」에서 동작만): 트래퍼 전용. 사거리(range) 안에서 적이 가장 뭉친 곳으로 폭탄 n 개를 포물선으로 던진다.
       폭탄은 그 둘레(spread)에 흩어져 떨어져 각각 반경 r 로 터진다(피해 dmg). 따라가지 않는다 — 던진 자리에 떨어진다. 폭탄 던지기(한 발·맞은 자리)·폭발 함정(깔아 두고 기다림)과 달리 "멀리 있는 무리를 한 번에" */
    bunch: { only: 'trapper', name: '폭탄 다발 투척', tree: 'trap', icon: 64, slot: 1, cd: L5([6.5, 6, 5.5, 5, 4.5]), n: L5([3, 4, 5, 6, 7]), dmg: L5([0.7, 0.8, 0.9, 1, 1.15]), r: L5([32, 34, 36, 38, 42]), spread: 52, range: 210, fly: 0.45,
      desc: function (l) { return this.cd(l) + '초마다 적이 가장 뭉친 곳으로 폭탄 ' + this.n(l) + '개를 던집니다. 흩어져 떨어져 각각 반경 ' + this.r(l) + ' 안의 적에게 피해 ' + pc(this.dmg(l)); } },
    toxdag: { only: 'trapper', trait: 1, name: '독 폭탄', tree: 'trap', icon: 106, cd: L5([4, 3.6, 3.2, 2.8, 2.4]), n: L5([1, 1, 2, 2, 3]), dmg: L5([1.2, 1.5, 1.8, 2.1, 2.5]), dot: L5([0.4, 0.5, 0.6, 0.75, 0.9]), sec: 4, r: L5([50, 55, 60, 65, 72]), cloud: L5([1, 1.25, 1.5, 1.75, 2.1]), csec: 3,
      desc: function (l) { return this.cd(l) + '초마다 독 폭탄 ' + this.n(l) + '개를 한 적씩에게 던집니다 (피해 ' + pc(this.dmg(l)) + ', ' + this.sec + '초 동안 초당 ' + pc(this.dot(l)) + '). 중독된 적이 쓰러지면 그 자리에 독 구름 — 반경 ' + this.r(l) + ', ' + this.csec + '초 동안 초당 ' + pc(this.cloud(l)); } },
    darkdag: { only: 'trapper', trait: 1, name: '암흑 폭탄', tree: 'trap', icon: 103, cd: L5([5, 4.5, 4, 3.5, 3]), n: L5([1, 1, 2, 2, 3]), dmg: L5([0.5, 0.6, 0.7, 0.8, 0.9]), sec: 3, r: L5([60, 66, 72, 80, 90]), boom: L5([1.6, 2, 2.5, 3, 3.6]),
      desc: function (l) { return this.cd(l) + '초마다 암흑 폭탄 ' + this.n(l) + '개를 던집니다 (피해 ' + pc(this.dmg(l)) + '). 맞은 적은 ' + this.sec + '초 동안 암흑 물질에 감염 — 그동안 쓰러지면 폭발해 반경 ' + this.r(l) + ' 안의 적 모두에게 피해 ' + pc(this.boom(l)); } },
    sense: { name: '육감', tree: 'pas', icon: 9, v: L5([0.06, 0.12, 0.18, 0.24, 0.3]), desc: function (l) { return '적의 공격을 ' + pc(this.v(l)) + ' 확률로 피합니다'; } },
    pick: { name: '소매치기', tree: 'pas', icon: 53, v: L5([1.25, 1.5, 1.75, 2, 2.3]), desc: function (l) { return '경험치를 끌어오는 범위 ' + pc(this.v(l)); } },
    /* 패시브 5종 추가 (2026-11-19, 뱀서류 분석 글의 "패시브 조건부 진화"): 이름은 붉은보석 도둑의 보조 스킬에서, 효과는 이 게임에 맞게 다시 풀었다 */
    power: { name: '비열한 전략', tree: 'pas', icon: 85, v: L5([0.08, 0.16, 0.24, 0.32, 0.4]), desc: function (l) { return '모든 피해 +' + pc(this.v(l)); } },
    haste: { name: '전문 도구', tree: 'pas', icon: 73, v: L5([0.06, 0.12, 0.18, 0.24, 0.3]), desc: function (l) { return '던지는 간격과 모든 스킬의 대기 −' + pc(this.v(l)); } },
    reach: { name: '함정 개조', tree: 'pas', icon: 57, evo: { cls: 'shadow', name: '검기 확장' }, v: L5([0.1, 0.2, 0.3, 0.4, 0.5]), desc: function (l, ev) { return ev ? '회오리 베기·설화난영참이 닿는 범위 +' + pc(this.v(l)) : '폭발·독 구름·덫이 닿는 범위 +' + pc(this.v(l)); } },   /* 무사의 길에서는 이름·설명이 검술용으로 바뀐다 (332번, 2026-11-20 사용자 "무사는 함정 관련 스킬이 아예 없어야 함") — 효과는 같은 범위 배수 */
    last: { name: '전문가의 기술', tree: 'pas', icon: 71, evo: { cls: 'shadow', name: '전문가의 기술' }, v: L5([0.15, 0.3, 0.45, 0.6, 0.75]), desc: function (l, ev) { return (ev ? '그림자 숨기의 지속 시간 +' : '감속·묶기·독·숨기의 지속 시간 +') + pc(this.v(l)); } },   /* 무사에게는 함정·독 이야기를 빼고 보인다 */
    /* 비켜 피하기 (347번, 2026-11-23 사용자 "후반에 무사가 너무 어려운데 붉은보석 스킬 중에 회피나 무적기 또는 버티기류 아이디어" → 후보 중 "비켜 피하기로 가자" — 무도가의 「비켜 피하기」: 맞으면 재빠르게 옆으로 돌며 후속 공격을 피하고 잠시 무적): 무사 전용 패시브.
       맞은 뒤의 무적 시간이 0.25초 → v 초로 늘어난다(무리에 둘러싸여 연달아 맞는 것을 끊는다). 맞는 순간 옆으로 비켜서는 잔상이 잠깐 보인다 */
    sidestep: { only: 'shadow', name: '비켜 피하기', tree: 'pas', icon: 9, v: L5([0.5, 0.65, 0.8, 1, 1.2]), desc: function (l) { return '맞은 뒤 ' + this.v(l) + '초 동안 다음 공격을 피합니다 (보통은 ' + CFG.HURT.inv + '초)'; } },
    regen: { name: '해독', tree: 'pas', icon: 2, v: L5([0.5, 1, 1.5, 2, 2.5]), desc: function (l) { return '체력을 초당 ' + this.v(l) + ' 회복합니다'; } }
  };
  /* 각성: 스킬 5단계 + 짝이 되는 패시브(단계 무관)를 갖추면 그 스킬에 효과가 하나 더 붙는다 (SK[k].awk = { pas, name, text }). 전직의 상위 스킬(evo)과는 따로 겹친다 */
  var CLS = {
    /* lines = 전직 카드의 설명 — 짧고 쉬운 말로 세 줄(무엇을 하는 갈래인지 · 특징 · 궁극기). 2026-11-20 사용자 "사람이 읽기 쉬운 형태로 길지 않게". 자세한 수치는 스킬 칸을 꾹 눌러 본다 */
    venom: { name: '대도의 길', icon: 61, drop: ['poison', 'gas'],   // 쓰로워는 물리 공격만 — 독 단도·유독가스를 못 쓴다 (2026-11-20 사용자 "쓰로워의 독 단도 제거, 물리 공격만으로 승부"). 출혈은 물리라 그대로
   // 이름 (2026-11-19 사용자): 베놈 쓰로워 → 쓰로워 · 사일런트 트래퍼 → 트래퍼 · 섀도우 인필트레이터 → 어쌔신
 col: '#ffcf7a', lines: ['독 없이 단검만으로 — 가장 많이, 가장 넓게', '맞은 적은 피를 흘리고 다팅 피버가 강해집니다', '궁극기: 무차별 난사 — 화면의 모든 적에게 단검을 퍼붓습니다'] },
    /* 전직은 두 갈래로 확정 (319번, 2026-11-20 사용자: "전직을 두 갈래로 확정. 네이밍은 대도의 길, 무사의 길. 기존의 함정 전문가 전직은 없애자"). 트래퍼의 정의는 CLS_OFF 로 옮겨 두었다 — 폭탄 던지기·독 폭탄·암흑 폭탄·폭탄 다발·폭탄 개미 코드는 남아 있지만 고를 수 없다 */
    shadow: { name: '무사의 길', icon: 80, col: '#c9a8ff', unit: 15, lines: ['마법전사가 되어 칼로 가까이서 벱니다', '그림자에 숨었다가 적을 눌러 기습합니다', '궁극기 「천지파열무」: 대지를 갈라 화면의 모든 적을 칩니다', '한 명씩 베는 길 — 대도의 길보다 어렵습니다'] }
  };
  var CLS_OFF = {
    trapper: { name: '트래퍼', icon: 64, unit: 59, stat: 56,   /* 모습 = 확장판 환술사(59) 그대로 (2026-11-20 사용자 "이제부터 트래퍼의 아트는 확장판의 환술사의 아트를 그대로"). 능력치·단도 던지기는 대도(stat 56) 것 — 그림만 바뀐다. 전에는 대도 그림의 보라색만 녹색으로 돌렸다 */ drop: ['fever', 'scatter', 'double', 'surprise', 'assassin'],   /* 단도 흩뿌리기·더블 드로잉도 못 쓴다 (2026-11-20 사용자 "트래퍼는 단도 흩뿌리기 스킬 없어야 함" · "더블 드로잉도 없어야 해") */ col: '#7fe36a', lines: ['단검 대신 폭탄 — 한 발은 약하지만 둘레까지 터집니다', '독 폭탄·암흑 폭탄과 더 많은 함정(+3개씩)', '궁극기: 폭탄 개미 떼가 화면 곳곳으로 달려가 터집니다'] }
  };
  /* 궁극기 (2026-11-19 사용자 안: "각 전직마다 대표되는 궁극기를 하나씩"): 전직하면 궁극기 칸(축지법 칸 왼쪽)에 그 전직의 궁극기가 들어온다. 직접 누르는 스킬은 축지법과 이것 둘뿐 — 나머지는 전부 자동.
     이름은 붉은보석 도둑의 전직별 상위 스킬에서. 대기 ULT.cd 초(전문 도구 패시브가 줄인다), 준비되면 칸이 금빛으로 맥박친다 */
  var ULT = { cd: q('ultcd', 30),
    venom: { name: '무차별 난사',   /* 343번(사용자): 크레이지 샷 → 무차별 난사. 코드 안의 이름(crazy·cz)과 주석의 '크레이지 샷'은 같은 스킬 */ icon: 54, sec: q('czsec', 3.5), secLv: 0.35, secMax: 5.6, gap: 0.07, per: q('czper', 2), mul: q('czmul', 0.69),   /* 345번(2026-11-23 사용자 "시전 중에 움직일 수 없게, 대신 데미지를 15% 상향, 궁극기 타임이 길어서 지금의 70% 로"): 시간 5(+0.5/10레벨, 최대 8) → 3.5(+0.35, 최대 5.6), 던지는 간격 0.1 → 0.07(시간이 줄어도 던지는 횟수는 그대로), 한 자루 피해 60% → 69%. 쓰는 동안 조작이 안 먹는다 */ crit: q('czcrit', 0.35), critCap: 0.9, near: 560, charge: q('czcharge', 0.7), tail: 0.15, big: q('czbig', 2.4), spark: 1.7,   /* big = 끝에 들어가는 타격의 섬광 크기(다팅 피버 1.7 — 사용자 "타격 이펙트가 더 크게, 궁극기니까"), spark = 난사 중 맞는 자리의 섬광 */ blur: q('czblur', 12), ghost: 0.16, ghostA: q('czalpha', 0.3),   /* 잔상의 진하기 — 0.5 는 "너무 불투명"(사용자) */ speed: 900, life: 1.2,   /* 343번(사용자 "잔영이 캐릭과 너무 멀리 있다 — 던지는 모션이 너무 빨라서 잔영이 생기는 느낌, 적이 없어도 그 기간 동안 계속 난사"): 둘레의 환영 여섯(반지름 64) → 도둑 자신이 던지는 동작을 초당 40 프레임으로 되풀이, 던질 때마다 몸 옆 blur 안에 잔상(ghost 초). 적이 없으면 아무 쪽으로 던진다 */
      /* 342번(2026-11-20 사용자 "크레이지샷: 현재 화면 모든 적 대상으로 단도를 난사한다. 타격 순서는 랜덤하게, 연출은 환영이 보여서 각 방향으로 던지기. 최초는 5초. 위력은 크리티컬 확률 증가로" → 설계안대로): 다팅 퓨리(302번, 한 줄 단검 폭풍)를 대체.
         sec 초(도둑 레벨 10마다 +secLv, 최대 secMax) 동안 gap 마다 per 자루(초당 20). 화면(near) 안의 적을 섞은 목록에서 차례로 꺼내 던지고, 다 꺼내면 다시 섞는다(우두머리는 두 번 넣는다). 한 자루 피해 mul, 이 단검만 치명타 확률 +crit(상한 critCap — 평소 상한 GROW.critMax 를 넘는다).
         도둑 둘레 ring 에 환영 n 개(60°마다) — 대상 쪽에 가장 가까운 환영이 그쪽을 보고 던진다. 단검은 speed 로 날아가 닿을 때 맞는다. 도둑은 자유롭게 움직이고 자동 공격도 계속된다 */
      art: function (ctx, x, y, w, h) {   /* 버튼 그림: 터지는 타격 섬광 셋 — 가시 돋친 빛무리 안의 흰 별 (343번, 사용자가 보인 참고 그림 "이것처럼, 색은 기존 스킬색과 비슷한 톤으로" — 구도만 참고, 바탕은 단검 그림들과 같은 청록, 캔버스로 이 게임에서 그린 것. 그 전의 조준선 그림은 뺐다) */
        var s = Math.min(w, h); artBg(ctx, x, y, w, h);
        var star = function (px, py, r, n, rot, inner, col) { ctx.fillStyle = col; ctx.beginPath(); for (var i = 0; i < n * 2; i++) { var a = rot + i * 3.1416 / n, rr = i % 2 ? r * inner : r * (i % 4 ? 1 : 0.8); ctx[i ? 'lineTo' : 'moveTo'](px + Math.cos(a) * rr, py + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
        [[0.56, 0.34, 0.3, 0.2], [0.27, 0.7, 0.22, 0.9], [0.74, 0.72, 0.24, 0.5]].forEach(function (b) { var px = x + w * b[0], py = y + h * b[1], r = s * b[2];
          var g = ctx.createRadialGradient(px, py, 0, px, py, r * 1.5); g.addColorStop(0, 'rgba(120,230,240,.75)'); g.addColorStop(1, 'rgba(40,150,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r * 1.5, 0, 6.2832); ctx.fill();
          star(px, py, r * 1.25, 9, b[3], 0.62, 'rgba(63,166,173,.9)'); star(px, py, r * 0.95, 7, b[3] + 0.4, 0.5, '#8fe6ee'); star(px, py, r * 0.72, 5, b[3] + 0.9, 0.42, '#ffffff'); });
        ctx.restore(); },
      secOf: function (lv) { return Math.min(this.secMax, this.sec + this.secLv * Math.floor((lv || 1) / 10)); },
      desc: function () { return '잔상이 남을 만큼 빠르게 ' + this.sec + '초 동안(레벨 10마다 +' + this.secLv + '초, 최대 ' + this.secMax + '초) 화면의 모든 적에게 무작위 순서로 단검을 난사합니다 — 그동안 적은 멈추고 도둑은 무적, 피해는 끝난 뒤 한꺼번에. 초당 ' + Math.round(this.per / this.gap) + '자루, 한 자루 피해 ' + Math.round(this.mul * 100) + '%, 치명타 확률 +' + Math.round(this.crit * 100) + '%. 맞은 적은 피를 흘립니다.'; } },
    trapper: { name: '폭탄 개미', icon: 64, unit: 68, n: q('antn', 16), scale: 0.6, speed: 190, near: 460, fuse: 2.3, gap: 0.07, r: 86, mul: q('antmul', 2.8), stun: 1.1,   /* 314번(2026-11-20 사용자 "흑마술파의 개미를 크기를 줄여서 내보내는 쪽으로, 궁극기로, 여러 마리 내보내서 거의 맵 전체에 타격"): 독무(큰 독 구름 + 폭발 함정 여섯)를 대체.
         작은 개미 n 마리가 도둑 둘레에서 나와 화면의 적들에게 흩어져 달려가(서로 가장 멀리 떨어진 적들을 고른다 — 화면 전체에 퍼지게) 붙어 다니다가 fuse 초 뒤 차례로(gap) 터진다. 반경 r, 피해 mul, 맞은 적은 stun 초 굳는다(우두머리 제외). 적은 개미를 공격하지 않는다 */
      desc: function () { return '작은 폭탄 개미 ' + this.n + '마리가 화면의 적들에게 흩어져 달려가 ' + this.fuse + '초 뒤 터집니다 (반경 ' + this.r + ', 피해 ' + Math.round(this.mul * 100) + '%, ' + this.stun + '초 굳음).'; } },
    shadow: { name: '천지파열무', icon: 41,
      art: function (ctx, x, y, w, h) {   /* 버튼 그림: X 자로 불을 뿜는 균열 (322번, 사용자 "천지파열무 스킬 버튼 아트를 X 자로 불 뿜는 그림으로") — 아이콘 시트에 없어 캔버스로 */
        var cx = x + w / 2, cy = y + h / 2, rx = w * 0.42, ry = h * 0.42, i, P2 = [[-1, -1], [1, 1], [1, -1], [-1, 1]], pass = [['rgba(255,60,10,.35)', w * 0.34], ['#ff5a14', w * 0.17], ['#ffb23c', w * 0.10], ['#1a0603', w * 0.045]];
        ctx.save(); ctx.fillStyle = '#16090a'; ctx.fillRect(x, y, w, h); var bgd = ctx.createRadialGradient(cx, cy, 1, cx, cy, w * 0.7); bgd.addColorStop(0, 'rgba(255,120,30,.55)'); bgd.addColorStop(1, 'rgba(60,10,5,0)'); ctx.fillStyle = bgd; ctx.fillRect(x, y, w, h);
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        pass.forEach(function (ps) { ctx.strokeStyle = ps[0]; ctx.lineWidth = ps[1]; for (i = 0; i < 4; i += 2) { var a = P2[i], b = P2[i + 1]; ctx.beginPath(); ctx.moveTo(cx + a[0] * rx, cy + a[1] * ry); ctx.lineTo(cx + a[0] * rx * 0.45 + b[1] * w * 0.05, cy + a[1] * ry * 0.5); ctx.lineTo(cx - a[1] * w * 0.03, cy); ctx.lineTo(cx + b[0] * rx * 0.5 - a[1] * w * 0.05, cy + b[1] * ry * 0.45); ctx.lineTo(cx + b[0] * rx, cy + b[1] * ry); ctx.stroke(); } });
        P2.forEach(function (c, n) { for (i = 0; i < 3; i++) { var k = 0.35 + i * 0.3, fx = cx + c[0] * rx * k, fy = cy + c[1] * ry * k, fh = h * (0.16 + 0.05 * ((n + i) % 2)); ctx.fillStyle = i % 2 ? '#ffd24a' : '#ff8a1e'; ctx.beginPath(); ctx.moveTo(fx - w * 0.06, fy); ctx.lineTo(fx + c[0] * w * 0.02, fy - fh); ctx.lineTo(fx + w * 0.06, fy); ctx.closePath(); ctx.fill(); } });
        var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.2); cg.addColorStop(0, 'rgba(255,250,220,.95)'); cg.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, w * 0.2, 0, 6.2832); ctx.fill(); ctx.restore(); }, mul: q('pamul', 3.2), floorUnit: 54, floor: q('pafloor', 0.8),   /* 362번(2026-11-23 사용자 "무사 궁극기가 갈수록 약해지는 듯" → "흑기사 체력 대비 항상 80%로"): 피해 = 공격력 × mul 과 '지금 시점 흑기사(floorUnit) 체력 × floor' 중 큰 쪽. 적 체력은 레벨·웨이브·최후의 3분에 따라 불어나는데 궁극기는 강화 수단이 없어 6웨이브 20% → 최후의 3분 10% 로 떨어졌었다 */ near: 560, burn: 0.25, fxMax: 36, face: [-1, 1], pose: [0, 1, 1], charge: 0.9, plant: 0.25, grow: 0.7, hold: 0.15, stage: 0.42, bands: [170, 340], tail: 0.05, out: 0.85, life: 4.15,   /* tail: 셋째 폭발이 끝나자마자 피해 (사용자 "1차 폭 → 2차 폭 → 3차 폭 끝나자마자 데미지") */   /* 326번(2026-11-20 사용자 — 창세기전3 영상을 보고): 기 모으기(charge, 보랏빛 기운이 연기처럼 몸으로 모인다) → 칼 꽂기(plant, 흰 섬광·고리·금빛 빛기둥) → 갈라짐(grow + hold) → **터짐 3단계**(stage 초씩, 가까운 곳 bands[0] 안 → 가운데 → 먼 곳) → tail 초 뒤 **모든 적이 한꺼번에 피해** → out 초 동안 사그라짐. life 는 이 합. 끝날 때까지 칼을 꽂은 자세·무적 */ /* plant = 칼을 바닥에 꽂는 시간 — 그 뒤에 땅이 갈라진다 (사용자 "칼을 바닥에 꽂으면 땅이 갈라지고 불꽃이 튀어나오는 느낌") */   /* 317번(2026-11-20 사용자: "진짜 궁극기는 '천지파열무' — 모티브는 창세기전3 의 살라딘·데미안이 쓰는 기술, 전체 맵 대상, 이펙트 최대한 비슷하게" + 참고 화면): 검으로 땅을 내리치면 발밑에서 사방(네 귀퉁이 + 좌우)으로 **용암 빛 균열**이 화면 끝까지 갈라져 나가고, 화면의 모든 적 발밑에서 불기둥이 솟는다.
         화면(near) 안의 적 모두에게 피해 mul, 3초 동안 불탐(초당 burn). 그림은 전부 캔버스로 그린다(균열 = 들쭉날쭉한 꺾은선 + 가지, 주황 빛무리·붉은 속·검은 틈, 가장자리 불꽃) — 원작 그림은 쓰지 않는다 */
      desc: function () { return '검으로 땅을 내리쳐 사방으로 대지를 가릅니다 — 화면의 모든 적에게 피해 ' + Math.round(this.mul * 100) + '%(적어도 흑기사 체력의 ' + Math.round(this.floor * 100) + '%), 3초 동안 불탑니다. 끝날 때까지 움직일 수 없고, 그동안 무적입니다.'; } } };
  /* 숙련 카드 (343번, 2026-11-20 사용자 "레벨 40후반에 이제 스킬업할게 없어서 체력회복만 계속 나오네 — 다른 패시브 스킬이나 스킬 업 조정"): 뽑을 스킬이 3장보다 적어지면 이 카드들이 채운다. 고를 때마다 한 칸 쌓이고(max 까지), 효과 = 쌓인 수 × v.
     dmg = 모든 피해(비열한 전략과 더한다) · spd = 던지는 간격·스킬 대기(전문 도구와 더한다) · crit = 치명타 확률(상한 GROW.critMax 그대로) · hp = 최대 체력(고를 때 그만큼 회복). 넷 다 차면 다시 응급처치만 */
  var MAST = { dmg: { name: '숙련 — 급소 공략', icon: 85, v: 0.05, max: 10, desc: function (n) { return '모든 피해 +' + pc(this.v) + ' (지금 +' + pc(n * this.v) + ')'; } },
    spd: { name: '숙련 — 손놀림', icon: 73, v: 0.025, max: 8, desc: function (n) { return '던지는 간격과 모든 스킬의 대기 −' + (this.v * 100).toFixed(1) + '% (지금 −' + (n * this.v * 100).toFixed(1) + '%)'; } },
    crit: { name: '숙련 — 날카로운 눈', icon: 63, v: 0.02, max: 10, desc: function (n) { return '치명타 확률 +' + pc(this.v) + ' (지금 +' + pc(n * this.v) + ', 최대 ' + pc(GROW.critMax) + '까지)'; } },
    hp: { name: '숙련 — 강인함', icon: 2, v: 25, max: 10, desc: function (n) { return '최대 체력 +' + this.v + ', 그만큼 회복 (지금 +' + n * this.v + ')'; } } };
  var GROW = { chest: { p: [0.5, 0.35], heal: 0.3 }, pasMax: 4, ultPow: 1.5, ultCd: 0.75, item: { meat: q('meat', 0.032), magnet: 0.012, bomb: 0.008, pick: 44, max: 12, life: 45,   /* 327번: 아이템이 떨어지자마자 저절로 먹어지던 버그를 고친 뒤 — 이제 직접 주워야 하므로 나오는 확률을 1.6배쯤, 줍는 거리 26 → 44 */ heal: 0.3, bombR: 330, bombMul: 10 }, classLv: q('classlv', 7), clsUnit: 56, clsHp: 50, pickup: 64, gemSpeed: 330, hpLv: 6, heal: 30, trapR: 16, trapRx: 1.7, trapPlus: 3, bomb: { mul: q('bombmul', 0.6), r: 32, rLv: 3, speed: 0.5, sec: 1.1 },   /* 트래퍼의 기본 공격 = 폭탄 던지기 (309번, 2026-11-20 사용자 "기본 단도 공격보단 약하게, 대신 소범위 공격"): 단도 피해 × mul 을 맞은 자리 반경 r + rLv × 단계 안의 적 모두에게. 날아가는 속도 × speed(보이게), 던지는 간격 × sec */ critMax: 0.6, xpk: q('xpk', 0.33),   /* 0.6 × 0.7 — 한 판이 7분이 되어 같은 굴곡에서 같은 레벨이 나오게 */ need: function (lv) { return Math.max(2, Math.round((3 + lv * 2 + lv * lv * 0.12) * this.xpk)); }   /* 다음 레벨까지: 뒤로 갈수록 가파르게 (2026-11-19 사용자 요청 "레벨 올리기 조금 더 어렵게"). xpk = 곡선 배수 — 285번 공격력 너프(×0.47) 뒤 "경험치 곡선 완화"로 0.5 (레벨 10 에 18, 20 에 46, 30 에 86) */ };
  SurvivalGame.SK = SK; SurvivalGame.CLS = CLS; SurvivalGame.GROW = GROW; SurvivalGame.ULT = ULT;

  P._growReset = function () {
    var self = this, D = this.D;
    this.lv = 1; this.exp = 0; this.expNeed = GROW.need(1); this.pend = 0; this.cards = null; this.cardT = 0; this.cls = null;
    this.sk = { dagger: 1, blink: 1 }; this.mast = {}; this.order = ['dagger']; this.tm = {}; this.traps = []; this.zones = []; this.gems = []; this.queue = [];
    this.stealthUntil = 0; this.hide = null; this.hideT = 0; this.lastDir = [1, 0]; this.lastDown = null; this.fire = {}; this.press = null; this.info = null; this.infoT = 0; this.guide = !D._svGuideSeen && !/[?&](tut=0|ts=)/.test(root.location.search); this.guideT = 0; D._svGuideSeen = true;   // 시작 안내: 들어와서 처음 한 번 (다시 하기에는 안 뜬다, 봇·시험 주소는 건너뜀)
    this.ult = null;   // (281번의 "고급 스킬을 궁극기 칸에 올리기"는 뺐다 — 궁극기는 전직이 준다. this.ult 는 늘 null)
    this.items = []; this.fans = []; this.lobs = []; this.ants = []; this.petals = []; this.waves = []; this.blades = []; this.stabs = []; this.zrun = null; this.rift = null; this.crazy = null; this.freezeUntil = 0; this.flashT = -9; this.awkSeen = {}; this.slashes = []; this.arcs = []; this.ghosts = []; this.puffs = []; this.bladeOn = false;
    Object.keys(SK).forEach(function (k) { var s = SK[k]; [s.arm, s.boom, s.fx].forEach(function (a) { var d = a != null && D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); }); });
    [3, 38].forEach(function (a) { var d = D.data.fx.arms[a]; (d && d.sheets || []).forEach(function (n) { D._loadFxSheet(n); }); });
    var pre = /[?&]sk=([a-z,]+)/.exec(root.location.search); if (pre) pre[1].split(',').forEach(function (k) { if (SK[k]) { if (!self.sk[k] && SK[k].slot) self.order.push(k); self.sk[k] = q('sklv', 3); } });   // ?sk=fever,explo&sklv=5 : 시험용
    var pc0 = /[?&]cls=([a-z]+)/.exec(root.location.search); if (pc0 && CLS[pc0[1]]) { if (this._has(CLS[pc0[1]].unit || GROW.clsUnit)) this._promote(pc0[1]); else { this.cls = pc0[1]; if (this.cls === 'shadow') { this._toBlade(); if (!this.sk.sidestep) this.sk.sidestep = 1; } } }
  };
  /* 전직: 갈래를 정하고 도둑 → 대도로 모습이 바뀐다 (2026-11-19 사용자 요청). 공격력·방어력·걷는 속도·기본 공격(단도 던지기)은 원작 대도의 것, 최대 체력은 GROW.clsHp 만큼만 더한다(원작 차이 +130 을 다 주면 너무 단단하다) */
  P._promote = function (cls) {
    var D = this.D, h = this.hero, T2 = D.types[CLS[cls].unit || GROW.clsUnit]; this.cls = cls; if (CLS[cls].drop) { var selfP = this, back = 0; CLS[cls].drop.forEach(function (k) { if (!selfP.sk[k]) return; back += selfP.sk[k]; delete selfP.sk[k]; selfP.order = selfP.order.filter(function (o) { return o !== k; }); }); if (back) { this.pend += back; this._text(h.x, h.y - h.headY - 40, '안 쓰는 스킬 → 카드 +' + back, '#9cc0ff'); } if (cls === 'venom') this.zones = []; }   // CLS[].drop = 그 갈래가 못 쓰는 스킬 — 전직하면 사라지고 그 단계만큼 카드로 돌려받는다, 카드에도 안 나온다. 트래퍼: 다팅 피버·암살 스킬(기습·암살) 대신 함정을 3개씩 더 둔다 (2026-11-20 사용자 "트래퍼에게 암살 스킬 빼 줘, 대신 기본 함정이 3개씩 추가")   // 2026-11-19 사용자 "전직 후에 다팅 피버는 제거" (어쌔신은 검술로 바뀐다)
    if (cls === 'shadow') { this._toBlade(); if (!this.sk.shadow) { this.sk.shadow = 1; this.tm.shadow = 5; } if (!this.sk.sidestep) this.sk.sidestep = 1;   /* 비켜 피하기 1단계는 무사로 전직하면 그냥 받는다 (2026-11-23 사용자) — 패시브 칸이 찼어도 */ }   // 그림자 숨기는 어쌔신만 — 전직하면 생긴다 (2026-11-20 사용자)
    if (cls === 'trapper') { if (!this.sk.toxdag) this.sk.toxdag = 1; if (!this.sk.darkdag) this.sk.darkdag = 1; } if (!T2 || h.t === T2) return;
    if (this.tm.ult == null) this.tm.ult = 4;
    var sp0 = this.speed, mh = h.maxHp + GROW.clsHp, hp = h.hp + GROW.clsHp; var BT = CLS[cls].stat != null ? D.types[CLS[cls].stat] : null, bact, batk, bsp; if (BT) { h.setType(BT); D._applyType(h); bact = h.act; batk = h.t.atk; bsp = h.speedPx; }   // stat: 능력치·기본 공격은 이 유닛 것, 그림·동작만 unit 것
    h.setType(T2); D._applyType(h); if (BT) { h.act = Object.assign({}, bact); h.atkOv = batk; h.speedPx = bsp; h.imgKey = null; } h.maxHp = mh; h.hp = Math.min(mh, hp); this.speed = h.speedPx * CFG.SPEED;
    // (트래퍼의 녹색 대도 그림 `recolor` 는 쓰지 않는다 — 환술사 그림을 그대로 쓴다)
    if (cls === 'shadow') { this.speed = Math.max(this.speed, sp0); h.act = Object.assign({}, h.act, { k1: 8, arm: -5 }); }   // 마법전사: 걸음은 느리므로 전직 전 속도를 지키고, 공격값의 레벨 계수(원작 16)는 다른 갈래와 같은 8 로(아니면 후반에 두 배로 세진다). arm −5 = 베기 타격 표시용 (−1 은 폭발·출혈과 겹친다)
    this._fx(h.x, h.y - 8, 3); this.ringT = D.time; this.ringN = 12; this.ringA = 0;
    this.tm.ult = 4; this.banner = { s: '궁극기 「' + ULT[cls].name + '」 — 오른쪽 아래 칸', t0: D.time + 0.8, col: CLS[cls].col };
  };
  P._lvOf = function (k) { return this.sk[k] || 0; };
  P._evo = function (k) { var e = SK[k].evo; return !!(e && this.cls === e.cls); };
  P._name = function (k) { return this._evo(k) ? SK[k].evo.name : SK[k].name; };
  P._pv = function (k) { var l = this.sk[k]; return (l ? SK[k].v(l) : 0) + (k === 'haste' ? this._mv('spd') : 0); };   // 패시브 값 (없으면 0) — 전문 도구에는 숙련 '손놀림'이 더해진다
  P._mv = function (k) { return ((this.mast && this.mast[k]) || 0) * MAST[k].v; };   // 숙련 카드 값 (쌓인 수 × v)
  P._awk = function (k) { var a = SK[k].awk; return !!(a && this.sk[k] >= 5 && this.sk[a.pas]); };
  P._base = function () { return this.D.rules.attackValue(this.hero) * (1 + this._pv('power') + this._mv('dmg')) * (this.cls === 'shadow' ? CFG.BLADE.atk : 1); };
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
      if (s.only && self.cls !== s.only) return; if (k === 'fever' && self.cls && self.cls !== 'venom') return; if (self.cls && CLS[self.cls].drop && CLS[self.cls].drop.indexOf(k) >= 0) return;   // 갈래가 못 쓰는 스킬 (CLS[].drop)   // 다팅 피버는 전직 전에만   // 갈래 전용 (트래퍼의 독 묻힌 단도·폭발 단도)
      if (s.tree === 'blade' ? self.cls !== 'shadow' : (self.cls === 'shadow' && s.tree !== 'pas' && k !== 'blink' && k !== 'shadow')) return;   // 그림자 검술은 섀도우만, 섀도우는 칼 스킬이 검술뿐
      if (!l && s.slot && used >= CFG.SLOTS) return; if (!l && s.need === 'trap' && !hasTrap) return; if (!l && s.tree === 'pas' && npas >= GROW.pasMax) return;
      var clsTree = self.cls === 'venom' ? 'throw' : self.cls === 'trapper' ? 'trap' : self.cls === 'shadow' ? 'blade' : null;
      pool.push({ k: k, w: (s.tree === clsTree ? 2 : 1) * (l ? 1.3 : 1) }); });
    if (pool.length < 3) Object.keys(MAST).forEach(function (k) { if ((self.mast[k] || 0) < MAST[k].max) pool.push({ m: k, w: 1 }); });   // 스킬이 거의 다 찼으면 숙련 카드(되풀이해 쌓는 능력치)로 채운다 (343번)
    while (out.length < 3 && pool.length) { var tw = pool.reduce(function (a, b) { return a + b.w; }, 0), r = rng.next() * tw, i = 0; while (i < pool.length - 1 && r >= pool[i].w) { r -= pool[i].w; i++; } out.push(pool[i].m ? { m: pool[i].m } : { k: pool[i].k }); pool.splice(i, 1); }
    if (!out.length) out.push({ heal: 1 });
    return out;
  };
  P._pick = function (c) {
    var h = this.hero, self2 = this;
    if (c.cls) { this._promote(c.cls); this._text(h.x, h.y - h.headY - 22, CLS[c.cls].name, CLS[c.cls].col); }
    else if (c.heal) h.hp = Math.min(h.maxHp, h.hp + GROW.heal);
    else if (c.m) { this.mast[c.m] = (this.mast[c.m] || 0) + 1; if (c.m === 'hp') { h.maxHp += MAST.hp.v; h.hp = Math.min(h.maxHp, h.hp + MAST.hp.v); } }
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
      var M = c.m && MAST[c.m], mn = M ? self.mast[c.m] || 0 : 0, ic = c.cls ? CLS[c.cls].icon : c.heal ? 2 : M ? M.icon : s.icon, fi = ic * 2; if (c.k && !c.cls && !c.heal && s.art) s.art(ctx, b.x + 16, b.y + 20, 40, 40); else if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, b.x + 16, b.y + 18, 40, 44);
      ctx.textAlign = 'left'; ctx.font = 'bold 16px sans-serif'; ctx.fillStyle = c.cls ? CLS[c.cls].col : '#ffe9b0'; ctx.fillText(c.cls ? CLS[c.cls].name : c.heal ? '응급처치' : M ? M.name : self._name(c.k), b.x + 68, b.y + 24);
      if (M) { ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36e'; ctx.fillText(mn + ' → ' + (mn + 1) + ' / ' + M.max, b.x + b.w - 16, b.y + 24); }   // 숙련: 쌓인 수
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = l ? '#9cc0ff' : '#9fe08a'; if (c.k) ctx.fillText(l ? 'Lv ' + l + ' → ' + (l + 1) : '새 스킬', b.x + b.w - 16, b.y + 24);
      if (c.k) { var wk = null; Object.keys(SK).forEach(function (q2) { var a2 = SK[q2].awk; if (!a2 || self._awk(q2)) return; if ((q2 === c.k && l === 4 && self.sk[a2.pas]) || (a2.pas === c.k && !l && self.sk[q2] >= 5)) wk = a2.name; });   // 이 카드를 고르면 각성이 완성된다
        if (wk) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#7fe0ff'; ctx.fillText('각성 「' + wk + '」', b.x + b.w - 16, b.y + 40); } }
      ctx.textAlign = 'left'; ctx.font = '12px sans-serif'; ctx.fillStyle = '#c9d1e3';
      var lines = c.cls ? CLS[c.cls].lines : D._wrap(c.heal ? '체력을 ' + GROW.heal + ' 회복합니다' : M ? M.desc(mn) : s.desc(l + 1, ev), b.w - 84);
      lines.slice(0, 4).forEach(function (ln, n) { ctx.fillText(ln, b.x + 68, b.y + 48 + n * 17, b.w - 80); }); });
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  /* 시작 안내 (2026-11-20 사용자: "서바이벌 모드 시작 시 게임 안내(소개, 전직 레벨, 10분 버티기) 추가"): 게임을 멈춘 채 한 장, 아무 데나 누르면 시작 */
  /* '최후의 3분' 경고 (사용자: "최후의 3분이라는 타이틀로 강력하게 경고하는 문구도"): 시작되는 순간 화면 가운데에 크게 3.4초 — 붉은 띠 + 큰 제목 + 무엇이 달라지는지 두 줄. 그 뒤로는 화면 위 웨이브 자리에 '최후의 3분'만 남는다 */
  P._drawRage = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, a = D.time - this.rageT, R = CFG.RAGE, k = Math.min(1, a / 0.25) * Math.min(1, (R.show - a) / 0.5), cy = Math.round(H * 0.3), sc = 1 + 0.5 * Math.max(0, 1 - a / 0.3), sh = a < 0.6 ? Math.sin(a * 60) * 3 * (1 - a / 0.6) : 0;
    ctx.save(); ctx.globalAlpha = Math.max(0, k);
    var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(160,0,0,0)'); vg.addColorStop(1, 'rgba(190,10,0,' + (0.45 + 0.15 * Math.sin(a * 9)).toFixed(3) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    var bg = ctx.createLinearGradient(0, cy - 62, 0, cy + 62); bg.addColorStop(0, 'rgba(60,0,0,0)'); bg.addColorStop(0.5, 'rgba(40,0,0,.82)'); bg.addColorStop(1, 'rgba(60,0,0,0)'); ctx.fillStyle = bg; ctx.fillRect(0, cy - 62, W, 124);
    ctx.fillStyle = 'rgba(255,70,50,.9)'; ctx.fillRect(0, cy - 44, W, 2); ctx.fillRect(0, cy + 42, W, 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.translate(W / 2 + sh, cy - 12); ctx.scale(sc, sc);
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffb0a0'; ctx.fillText('— 경 고 —', 0, -24);
    ctx.font = '900 34px sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = '#1a0000'; ctx.strokeText('최후의 3분', 0, 4); ctx.fillStyle = '#ff4a34'; ctx.fillText('최후의 3분', 0, 4); ctx.fillStyle = 'rgba(255,220,200,.9)'; ctx.fillText('최후의 3분', 0, 3);
    ctx.fillStyle = '#ff4a34'; ctx.globalCompositeOperation = 'source-atop'; ctx.globalCompositeOperation = 'source-over';
    ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffe2d8'; ctx.fillText('적이 광폭해졌다 — 체력 ' + R.hp + '배 · 속도 ' + R.spd + '배', 0, 34);   // "한 대만 맞아도 체력의 20% 가 사라진다" 줄은 뺐다 (343번, 사용자 — 규칙 자체는 그대로)
    ctx.restore(); ctx.textAlign = 'left';
  };
  P._drawGuide = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, pw = Math.min(W - 28, 330), px = Math.round((W - pw) / 2), mins = Math.round(CFG.TIME / 60), rmin = Math.round(CFG.RAGE.at / 60), k = Math.min(1, this.guideT / 0.25),
      L = [['목표', '사방에서 몰려오는 적을 ' + mins + '분 동안 버티세요. ' + rmin + '분부터는 적이 훨씬 강해집니다.'], ['조작', '화면을 끌어 움직입니다. 공격은 자동입니다.'], ['성장', '적을 잡아 경험치를 모으면 스킬 카드를 고릅니다.'], ['전직', '레벨 ' + GROW.classLv + '에 대도의 길·무사의 길 중 하나로.'], ['버튼', '오른쪽 아래 축지법, 전직 뒤에는 궁극기.']], rows = [], i;
    ctx.font = '13px sans-serif'; L.forEach(function (e) { D._wrap(e[1], pw - 86).forEach(function (ln, n) { rows.push([n ? '' : e[0], ln]); }); });
    var ph = 74 + rows.length * 21 + 40, py = Math.round((H - ph) / 2);
    ctx.globalAlpha = k; ctx.fillStyle = 'rgba(4,6,10,.62)'; ctx.fillRect(0, 0, W, H); D._plate(px, py, pw, ph, 7, false);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#ffe9b0'; ctx.fillText('서바이벌', W / 2, py + 30);
    ctx.font = '12px sans-serif'; ctx.fillStyle = '#9cc0ff'; ctx.fillText('도둑 한 명으로 살아남기', W / 2, py + 52);
    ctx.textAlign = 'left'; for (i = 0; i < rows.length; i++) { var ry = py + 82 + i * 21; if (rows[i][0]) { ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#ffcf7a'; ctx.fillText(rows[i][0], px + 22, ry); } ctx.font = '13px sans-serif'; ctx.fillStyle = '#dfe5f2'; ctx.fillText(rows[i][1], px + 64, ry); }
    ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = 'rgba(255,233,176,' + (0.55 + 0.45 * Math.sin(this.guideT * 4)).toFixed(2) + ')'; ctx.fillText('화면을 누르면 시작', W / 2, py + ph - 22);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  };
  /* 스킬 설명 카드 (칸을 꾹 누르면): 이름·단계·지금 효과·다음 단계. 각성 조건. 고급 스킬(SK.man)은 [궁극기 칸에 올리기] — 올리면 자동으로 안 나가고 궁극기 칸을 눌러 쓴다(위력 ×1.5·대기 −25%) */
  P._drawInfo = function () {
    var D = this.D, ctx = D.ctx, W = D.W, H = D.H, k = this.info.key, isU = k === 'ult', s = isU ? ULT[this.cls] : SK[k], l = isU ? 5 : (this.sk[k] || 1), A = s.awk, akl = A ? D._wrap('각성 「' + A.name + '」 — ' + A.text + '  (조건: 5단계 + ' + SK[A.pas].name + ')', Math.min(W - 24, 350) - 36) : [], ev = !isU && this._evo(k), IC = D.data.fx.icon, icons = D.assets.get('acticons'), pw = Math.min(W - 24, 350), px = Math.round((W - pw) / 2), y;
    ctx.fillStyle = 'rgba(4,6,10,.6)'; ctx.fillRect(0, 0, W, H); ctx.font = '12px sans-serif';
    var cur = D._wrap(s.desc(l, ev), pw - 36), nxt = l < 5 ? D._wrap(s.desc(l + 1, ev), pw - 36) : [], ph = 70 + cur.length * 17 + (nxt.length ? 26 + nxt.length * 17 : 0) + (akl.length ? 10 + akl.length * 17 : 0) + 30, py = Math.round(this.slots[0].y - 44 - ph);
    D._plate(px, py, pw, ph, 7, false); var fi = s.icon * 2; if (s.art) s.art(ctx, px + 16, py + 14, 38, 38); else if (icons && IC) ctx.drawImage(icons, (fi % IC.cols) * IC.w, Math.floor(fi / IC.cols) * IC.h, IC.w, IC.h, px + 16, py + 14, 36, 40);
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
  P._extra = function (s, u) { if (!s.extra) return; var self = this, T = this.D.time, b = this._base() * s.extra.mul; var gap = s.extra.n > 4 ? 0.05 : 0.07, ux = u.x, uy = u.y;
    for (var k = 0; k < s.extra.n; k++) (function (k) { self.queue.push({ at: T + gap * (k + 1), fn: function () { if (u.state !== 'dead') { ux = u.x; uy = u.y; self._hitFoe(u, b * self._onDagger(u), s.arm); }
      if (!s.extra.bounce) return; var F = self.foes, near = []; for (var i = 0; i < F.length; i++) { var f = F[i]; if (f === u || f.state === 'dead') continue; var d = Math.hypot(f.x - ux, (f.y - uy) / 0.62); if (d <= s.extra.bounce) near.push([d, f]); }   /* 튕김: 맞은 적 둘레의 다른 적 하나에게도 같은 피해 */
      if (!near.length) return; near.sort(function (a, c) { return a[0] - c[0]; }); var t2 = near[k % near.length][1], bl = Math.hypot(t2.x - ux, t2.y - uy) || 1;
      self._hitFoe(t2, b * self._onDagger(t2), s.arm); self.stabs.push({ x: t2.x, y: t2.y - 14, vx: (t2.x - ux) / bl, vy: (t2.y - uy) / bl, t0: self.D.time, rgb: '255,225,150', len: Math.min(bl, 40) }); } }); })(k); };
  /* 단검에 맞았을 때 붙는 효과: 독 단도 · 출혈(베놈 쓰로워) · 암살 */
  P._onDagger = function (u) {
    var T = this.D.time, l;
    if ((l = this._lvOf('poison'))) { u.vulnUntil = T + SK.poison.dur * (1 + this._pv('last')); u.vuln = Math.max(u.vuln || 0, SK.poison.v(l)); }
    if (this.cls === 'venom') { u.bleedUntil = T + 3; u.bleed = this._base() * 0.25; }
    if ((l = this._lvOf('assassin')) && this.D.rng.next() < SK.assassin.p(l) * (this._evo('assassin') ? 1.5 : 1)) { if (u.boss) return 5; this._text(u.x, u.y - u.headY - 4, '암살', '#c9a8ff'); return 1e6; }
    return 1;
  };
  /* 트래퍼: 단검이 맞은 자리의 스플래시 — 독(피해 + 3초 독, 녹색 구름) · 폭발(피해, 폭발 이펙트) */
  P._dagSplash = function (x, y, kind) {   // (303번부터 쓰지 않는다 — 표시는 _dagMark, 터지는 것은 _hitFoe 의 쓰러질 때)
    return; };
  P._bombHit = function (s, main) {   // 트래퍼의 폭탄: 맞은 적(main — 부른 쪽이 따로 친다) 둘레의 적도 같은 피해
    var F = this.foes, T = this.D.time, r = s.bomb * (1 + this._pv('reach')), i, u;
    for (i = 0; i < F.length; i++) { u = F[i]; if (u !== main && u.state !== 'dead' && Math.hypot(u.x - main.x, u.y - main.y) <= r) this._hitFoe(u, s.dmg * this._onDagger(u), -1); }
    this._fx(main.x, main.y - 10, 62);   /* 터지는 불꽃(쥐덫의 작은 터짐) + 범위만큼 퍼지는 불빛 + 튀는 불티 + 연기 — 단검의 흰 별과 다르게 (2026-11-20 사용자 "폭탄 맞는 느낌이 들어야") */
    this.bursts.push({ x: main.x, y: main.y - 6, t0: T, a: 0, k: 'b', life: 0.32, r: r }); this.bursts.push({ x: main.x, y: main.y - 8, t0: T, a: this.D.rng.next() * 6.28, k: 'e', life: 0.42, r: r }); if (T - (this.bombSndT || -9) > 0.18) { this.bombSndT = T; this.D._play(5064, 0.16); }
  };
  P._dagMark = function (u, kind) {   // 트래퍼 단검이 맞은 적에게 표시를 남긴다 (그 적이 쓰러질 때 _hitFoe 가 본다)
    var T = this.D.time, l, LS = 1 + this._pv('last');
    if (kind === 'toxdag' && (l = this.sk.toxdag)) { u.toxUntil = T + SK.toxdag.sec * LS; u.toxLv = l; u.bleedUntil = Math.max(u.bleedUntil || 0, u.toxUntil); u.bleed = Math.max(u.bleed || 0, this._base() * SK.toxdag.dot(l)); }
    if (kind === 'darkdag' && (l = this.sk.darkdag)) { u.darkUntil = T + SK.darkdag.sec * LS; u.darkLv = l; }
    if (u.mkT !== T && u.state !== 'dead') { u.mkT = T; this.bursts.push({ x: u.x, y: u.y - u.headY * 0.5, t0: T, a: this.D.rng.next() * 6.28, k: 'b', life: 0.3, r: 26, c: kind === 'toxdag' ? ['210,255,170', '90,220,70', '40,150,30'] : ['230,190,255', '150,70,255', '80,20,180'] }); this.bursts.push({ x: u.x, y: u.y - u.headY * 0.5, t0: T, a: this.D.rng.next() * 6.28, k: 'e', life: 0.4, r: 24, c: kind === 'toxdag' ? '120,230,90' : '180,110,255' }); }   /* 독 폭탄·암흑 폭탄이 터지는 자리: 녹색·보라 불빛과 튀는 방울 */
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
    var near = this._nearest(1, CFG.BLADE.melee, null)[0]; if (!near) return;
    this.atkCd = Math.max(CFG.ATK.min, CFG.ATK.sec - CFG.ATK.lv * (this.lv - 1)) * SK.slash.sec(l) * (1 - this._pv('haste')) * CFG.BLADE.spd;
    var tx = near.x - h.x, ty = near.y - h.y; D._faceVec(h, tx, ty, true); this.aimUntil = T + h.t.anim.atk.n / (D.rules.tps * CFG.ATK.anim) + 0.05; h.state = 'attack'; h.at = 0;
    this._slash(h.x, h.y, Math.atan2(ty, tx), false, SK.slash.dmg(l)); D._play(h.act.snd, 0.3);
  };
  /* 베기 한 번: (x, y) 에서 ang 쪽 반원(full 이면 원). 연속 베기는 맞은 적마다 더 치고, 잔상은 그 자리에서 after 초 뒤 한 번 더 (ghost = 잔상이 벤 것) */
  P._slash = function (x, y, ang, full, mul, ghost, noAfter) {
    var self = this, T = this.D.time, F = this.foes, l = this.sk.slash || 1, r = SK.slash.r(l), wide = full || this._awk('slash'), b = this._base() * mul, xl = this.sk.combo, hitL = [], one = null, i;
    for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead') continue; var dx = u.x - x, dy = u.y - y, d = Math.hypot(dx, dy); if (d > (wide ? r : CFG.BLADE.melee) + 8) continue;
      if (!wide && d > 14) { var da = Math.abs(Math.atan2(dy, dx) - ang); if (da > Math.PI) da = 2 * Math.PI - da; if (da > CFG.BLADE.arc) continue; }
      if (!wide) { if (!one || d < one[0]) one = [d, u]; continue; }   /* 수직 베기: 가장 가까운 한 명만 (321번) */
      this._bladeHit(u, b); if (xl) hitL.push([d, u]); }
    if (one) { this._bladeHit(one[1], b); if (xl) hitL.push(one); }
    if (xl) { hitL.sort(function (p, q) { return p[0] - q[0]; }); hitL.slice(0, CFG.BLADE.comboMax).forEach(function (e) { var fu = e[1]; var cb = self._base() * SK.combo.dmg(xl); for (var k = 0; k < SK.combo.n(xl); k++) self.queue.push({ at: T + 0.06 * (k + 1), fn: function () { self._bladeHit(fu, cb); } }); }); }
    this.arcs.push({ x: x, y: y, a: ang, r: r, full: wide, t0: T, ghost: !!ghost, tx: one ? one[1].x : null, ty: one ? one[1].y - one[1].headY * 0.5 : null });
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
    if (this.rift && T - this.rift.t0 >= ULT.shadow.charge + ULT.shadow.plant * 0.5) { var UZ = ULT.shadow, zi = T - this.rift.t0 - UZ.charge - UZ.plant * 0.5, zf = T - this.rift.t0 > UZ.life - UZ.out ? Math.max(0, (UZ.life - (T - this.rift.t0)) / UZ.out) : 1, zx = this.rift.x + 9, zg = this.rift.y + 1;   // 천지파열무: 무사가 내려찍은 칼끝 자리 — 꽂히는 순간의 빛살과 틈 (칼은 캐릭터의 동작이 보여 준다, 329번)
      ctx.save(); ctx.globalAlpha = zf; ctx.lineCap = 'round';
      if (zi < 0.3) { var zs = 1 - zi / 0.3; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,240,200,' + zs.toFixed(2) + ')'; ctx.lineWidth = 3; for (var zj = 0; zj < 8; zj++) { ctx.beginPath(); ctx.moveTo(zx, zg); ctx.lineTo(zx + Math.cos(zj * 0.785) * (18 + 50 * (1 - zs)), zg + Math.sin(zj * 0.785) * (9 + 25 * (1 - zs))); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; }
      ctx.fillStyle = 'rgba(10,3,2,.8)'; ctx.beginPath(); ctx.ellipse(zx, zg, 7, 3, 0, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,140,40,' + (0.5 + 0.3 * Math.sin(T * 10)).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(zx, zg, 7, 3, 0, 0, 6.2832); ctx.stroke(); ctx.restore(); }
    if (this.rift && T - this.rift.t0 < ULT.shadow.charge + 0.15) { var cq = (T - this.rift.t0) / ULT.shadow.charge, cc = Math.min(1, cq), cxh = h.x, cyh = h.y - h.headY * 0.5, wi2;   // 천지파열무의 기 모으기: 보랏빛 기운이 연기처럼 휘돌며 몸으로 모여든다 (갑자기 쓰지 않게 — 사용자)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (wi2 = 0; wi2 < 18; wi2++) { var wa = wi2 * 0.349 + T * (2.2 + (wi2 % 3) * 0.7) * (wi2 % 2 ? 1 : -1), wr2 = (150 - 20 * (wi2 % 4)) * Math.pow(1 - cc, 0.8) + 10, wx = cxh + Math.cos(wa) * wr2, wy = cyh + Math.sin(wa) * wr2 * 0.6 - 10 * cc, ws = 16 + 14 * (1 - cc) + (wi2 % 3) * 4, wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, ws);
        wg.addColorStop(0, 'rgba(' + (wi2 % 2 ? '170,120,255' : '110,160,255') + ',' + (0.30 * Math.min(1, cq * 3) * (cq > 1 ? Math.max(0, 1 - (cq - 1) * 6) : 1)).toFixed(3) + ')'); wg.addColorStop(1, 'rgba(90,60,200,0)'); ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(wx, wy, ws, 0, 6.2832); ctx.fill(); }
      var cg2 = ctx.createRadialGradient(cxh, cyh, 2, cxh, cyh, 20 + 36 * cc); cg2.addColorStop(0, 'rgba(235,225,255,' + (0.75 * cc * cc * (cq > 1 ? Math.max(0, 1 - (cq - 1) * 6) : 1)).toFixed(3) + ')'); cg2.addColorStop(1, 'rgba(140,90,255,0)'); ctx.fillStyle = cg2; ctx.beginPath(); ctx.arc(cxh, cyh, 20 + 36 * cc, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,255,' + (0.55 * cc).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.y, 60 * (1 - cc) + 14, (60 * (1 - cc) + 14) * 0.5, 0, 0, 6.2832); ctx.stroke(); ctx.restore(); }
    if (this.ghosts.length && h.state !== 'dead') { var hx = h.x, hy = h.y, hp = h.hp, hd = h.dir; h.hp = h.maxHp;
      for (i = 0; i < this.ghosts.length; i++) { var g = this.ghosts[i]; ctx.globalAlpha = 0.42 * Math.max(0, (g.until - T) / (g.until - g.t0)); h.x = g.x; h.y = g.y; h.dir = g.dir; D._drawUnit(h); }
      h.x = hx; h.y = hy; h.hp = hp; h.dir = hd; ctx.globalAlpha = 1; }
    var CZ = this.crazy; if (CZ && T < CZ.go + 0.15 && h.state !== 'dead') { var kq = (T - CZ.t0) / (CZ.go - CZ.t0), kc = Math.min(1, kq), kf = kq > 1 ? Math.max(0, 1 - (kq - 1) * 5) : 1, kx = h.x, ky = h.y - h.headY * 0.5, ki;   // 크레이지 샷의 기 모으기: 푸른 빛줄기들이 사방에서 몸으로 빨려 들고 발밑 고리가 좁혀 든다 (그동안 적은 멈춰 있다)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (ki = 0; ki < 14; ki++) { var ka = ki * 0.449 + (ki % 2 ? 0.2 : 0), kr1 = (130 - (ki % 4) * 18) * (1 - kc) + 16, kr0 = kr1 + 26 + (ki % 3) * 10; ctx.strokeStyle = 'rgba(150,215,255,' + (0.55 * Math.min(1, kq * 4) * kf).toFixed(3) + ')'; ctx.lineWidth = 1.5 + (ki % 2); ctx.beginPath(); ctx.moveTo(kx + Math.cos(ka) * kr0, ky + Math.sin(ka) * kr0 * 0.7); ctx.lineTo(kx + Math.cos(ka) * kr1, ky + Math.sin(ka) * kr1 * 0.7); ctx.stroke(); }
      var kg = ctx.createRadialGradient(kx, ky, 2, kx, ky, 16 + 26 * kc); kg.addColorStop(0, 'rgba(225,245,255,' + (0.7 * kc * kc * kf).toFixed(3) + ')'); kg.addColorStop(1, 'rgba(90,160,255,0)'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 16 + 26 * kc, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(170,220,255,' + (0.6 * kc * kf).toFixed(3) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.y, 64 * (1 - kc) + 14, (64 * (1 - kc) + 14) * 0.5, 0, 0, 6.2832); ctx.stroke(); ctx.restore(); }
    if (CZ && CZ.imgs.length && h.state !== 'dead') { var UV = ULT.venom, zx0 = h.x, zy0 = h.y, zhp = h.hp, zd = h.dir, zs = h.state, za = h.at, ztn = h.tint, zht = h.hitT, ZA = h.t.anim.atk; h.hp = h.maxHp;   // 크레이지 샷의 잔상: 던질 때마다 몸 바로 옆에 그쪽을 보고 던지는 자세가 남아 금방 사라진다 (너무 빨라 몸이 여럿으로 보이게 — 사용자)
      CZ.imgs.forEach(function (g) { var ag = (T - g.t0) / UV.ghost; if (ag < 0 || ag >= 1) return;
        h.ghostA = UV.ghostA * (1 - ag); h.tint = null; h.hitT = null; h.x = zx0 + g.ox; h.y = zy0 + g.oy; D._faceVec(h, Math.cos(g.a), Math.sin(g.a), true); h.state = 'attack'; h.at = ZA && ZA.hit != null ? ZA.hit : 4; D._drawUnit(h); });
      h.x = zx0; h.y = zy0; h.hp = zhp; h.dir = zd; h.state = zs; h.at = za; h.ghostA = null; h.tint = ztn; h.hitT = zht; ctx.globalAlpha = 1; }
    if (this.petals.length && h.state !== 'dead') { var qx = h.x, qy = h.y, qhp = h.hp, qd = h.dir, qs = h.state, qa = h.at, QA = h.t.anim.atk; h.hp = h.maxHp; h.state = 'attack'; h.at = QA && QA.hit != null ? QA.hit : 4;   // 설화난영참: 검을 뻗은 자세의 잔상 넷
      for (i = 0; i < this.petals.length; i++) { var pe = this.petals[i];
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(150,210,255,.45)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(pe.x - pe.vx * 46, pe.y - 14 - pe.vy * 46); ctx.lineTo(pe.x, pe.y - 14); ctx.stroke(); ctx.strokeStyle = 'rgba(240,250,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pe.x - pe.vx * 40, pe.y - 14 - pe.vy * 40); ctx.lineTo(pe.x + pe.vx * 14, pe.y - 14 + pe.vy * 14); ctx.stroke();
        var hg = ctx.createRadialGradient(pe.x, pe.y - 14, 2, pe.x, pe.y - 14, 26); hg.addColorStop(0, 'rgba(170,220,255,.5)'); hg.addColorStop(1, 'rgba(120,180,255,0)'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(pe.x, pe.y - 14, 26, 0, 6.2832); ctx.fill(); ctx.restore();
        ctx.globalAlpha = 0.6; h.x = pe.x; h.y = pe.y; if (!pe.back) h.dir = pe.dir; else D._faceVec(h, pe.vx, pe.vy, true); D._drawUnit(h); }
      h.x = qx; h.y = qy; h.hp = qhp; h.dir = qd; h.state = qs; h.at = qa; ctx.globalAlpha = 1; }
    for (i = this.stabs.length - 1; i >= 0; i--) { var sb = this.stabs[i], sq = 1 - (D.time - sb.t0) / 0.18; if (sq <= 0) { this.stabs.splice(i, 1); continue; }   /* 환영검이 꿰뚫는 순간: 적을 지나 뒤로 길게 빠지는 빛줄기 (푸른 빛 + 흰 속) */
      var sx0 = sb.x - sb.vx * (sb.len || 22), sy0 = sb.y - sb.vy * (sb.len || 22), sfw = sb.rgb ? 6 : 30 + 26 * (1 - sq), sx1 = sb.x + sb.vx * sfw, sy1 = sb.y + sb.vy * sfw; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      var sgd = ctx.createLinearGradient(sx0, sy0, sx1, sy1); var srg = sb.rgb || '150,205,255'; sgd.addColorStop(0, 'rgba(' + srg + ',0)'); sgd.addColorStop(sb.rgb ? 0.7 : 0.45, 'rgba(' + srg + ',' + ((sb.rgb ? 0.6 : 0.85) * sq).toFixed(3) + ')'); sgd.addColorStop(1, 'rgba(' + srg + ',0)'); ctx.strokeStyle = sgd; ctx.lineWidth = (sb.rgb ? 4 : 8) * sq + 1; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke();
      var sgw = ctx.createLinearGradient(sx0, sy0, sx1, sy1); sgw.addColorStop(0, 'rgba(255,255,255,0)'); sgw.addColorStop(0.45, 'rgba(255,255,255,' + sq.toFixed(3) + ')'); sgw.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = sgw; ctx.lineWidth = 2.5 * sq + 0.5; ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1); ctx.stroke(); ctx.restore(); }
    if (this.blades.length) { var SW = this._swordSprite(), ZD = SK.zrun;   // 환영검: 날아가는 쪽을 보는 가는 검 (지나온 선은 그리지 않는다)
      for (i = 0; i < this.blades.length; i++) { var bd = this.blades[i], ba = bd.ph === 'fade' ? Math.max(0, bd.w / 0.18) : 1, bj;
        ctx.save(); ctx.translate(bd.x, bd.y - 14); ctx.rotate(Math.atan2(bd.vy, bd.vx) + 1.5708); ctx.globalAlpha = 0.9 * ba;
        if (SW) { var simg = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false; ctx.drawImage(SW, 0, 0, 11, 37, -5.5 * ZD.slim, -22, 11 * ZD.slim, 37); ctx.imageSmoothingEnabled = simg; }
        else { ctx.strokeStyle = '#eef2fa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 12); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * ba; ctx.fillStyle = 'rgba(150,205,255,1)'; ctx.fillRect(-3, -24, 6, 30); ctx.restore(); } }
    for (i = 0; i < this.waves.length; i++) { var wv = this.waves[i], wk2 = Math.min(1, wv.go / 40) * Math.min(1, (wv.max - wv.go) / 50 + 0.15), wa2 = Math.atan2(wv.vy, wv.vx), wj2;   // 검기: 날아가는 쪽으로 볼록한 초승달 — 푸른 빛무리 + 흰 날, 뒤로 옅은 잔상 둘
      ctx.save(); ctx.translate(wv.x, wv.y - 14); ctx.rotate(wa2); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (wj2 = 2; wj2 >= 0; wj2--) { var wo = -wj2 * 14, wal = wk2 * (wj2 ? 0.28 / wj2 : 1); ctx.strokeStyle = 'rgba(110,170,255,' + (0.55 * wal).toFixed(3) + ')'; ctx.lineWidth = 11; ctx.beginPath(); ctx.arc(wo - 26, 0, 44, -0.95, 0.95); ctx.stroke(); ctx.strokeStyle = 'rgba(240,248,255,' + (0.95 * wal).toFixed(3) + ')'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(wo - 26, 0, 45, -0.85, 0.85); ctx.stroke(); }
      ctx.restore(); }
    for (i = 0; i < this.arcs.length; i++) { var a = this.arcs[i], k = 1 - (T - a.t0) / CFG.BLADE.arcLife, rr = a.r * (0.82 + 0.18 * (1 - k)), al = a.ghost ? 0.55 : 1;
      if (!a.full) { var vx = a.tx != null ? a.tx : a.x + Math.cos(a.a) * 30, vy = a.ty != null ? a.ty : a.y - 14 + Math.sin(a.a) * 18, vk = 1 - k, top = vy - 34, cut = top + 62 * Math.min(1, vk * 2.2);   /* 수직 베기: 겨눈 적 위에서 아래로 내려 긋는 칼자국 (범위 호가 아니다) */
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(150,90,255,' + (0.75 * k * al).toFixed(3) + ')'; ctx.lineWidth = 9 * k + 2; ctx.beginPath(); ctx.moveTo(vx - 5, top); ctx.lineTo(vx + 4, cut); ctx.stroke();
        ctx.strokeStyle = 'rgba(245,235,255,' + (0.95 * k * al).toFixed(3) + ')'; ctx.lineWidth = 2.5 * k + 0.5; ctx.beginPath(); ctx.moveTo(vx - 5, top); ctx.lineTo(vx + 4, cut); ctx.stroke(); ctx.restore(); continue; }
      ctx.save(); ctx.translate(a.x, a.y - 12); ctx.scale(1, 0.62); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      var a0 = a.full ? 0 : a.a - CFG.BLADE.arc, a1 = a.full ? 6.2832 : a.a + CFG.BLADE.arc;
      ctx.strokeStyle = 'rgba(150,90,255,' + (0.7 * k * al).toFixed(3) + ')'; ctx.lineWidth = 14 * k + 2; ctx.beginPath(); ctx.arc(0, 0, rr, a0, a1); ctx.stroke();
      ctx.strokeStyle = 'rgba(245,235,255,' + (0.95 * k * al).toFixed(3) + ')'; ctx.lineWidth = 3 * k + 0.5; ctx.beginPath(); ctx.arc(0, 0, rr + 3, a0 + (a.full ? 0 : 0.25), a1 - (a.full ? 0 : 0.25)); ctx.stroke();
      ctx.restore(); }
  };
  /* 매 프레임: 스킬 타이머 · 덫 · 독 구름 · 경험치 (update 가 부른다. G = 적 격자, near = 사거리 안 가장 가까운 적) */
  P._growStep = function (dt, G, near) {
    var self = this, D = this.D, T = D.time, h = this.hero, F = this.foes, tm = this.tm, l, k, i, ev;
    var due = function (key) { if (!self.sk[key]) return false; tm[key] = (tm[key] == null ? 0.6 : tm[key]) - dt * (self.D.time < self.buff.magic ? CFG.SHRINE.kinds.magic.cd : 1); if (tm[key] > 0) return false;   /* 마력의 성소: 쿨타임이 빨리 돈다 */
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
      if (sn) { tm.scatter = CD('scatter', l); var sa = Math.atan2(sn.y - h.y, sn.x - h.x), half = SC.ang(l) * 0.008727 * (ev ? SC.evoAng : 1), fr = SC.far(l), sd = SC.dmg(l), sides = [sa];   // 쓰로워 진화: 각도 × evoAng, 단검 +2 (처음엔 앞뒤 두 방향이었는데 사용자 "양쪽으로 쏴서 어색함, 한쪽 방향으로만" — 2026-11-20)
        sides.forEach(function (a0) { var m = SC.m(l) + (ev ? 2 : 0), vol = { hit: {}, left: SC.n(l) + (ev ? 4 : 0) }, fi;
          for (fi = 0; fi < m; fi++) { var ra = a0 - half + (fi + 0.5) * (2 * half / m), sh = self._dagger(null, sd, 0, 0, Math.cos(ra) * CFG.ATK.shot, Math.sin(ra) * CFG.ATK.shot); sh.vol = vol; sh.far = fr; sh.x0 = h.x; sh.y0 = h.y; sh.wk = Math.tan(half / m); sh.life = CFG.ATK.range / CFG.ATK.shot; }
          }); } else tm.scatter = 0.3; }   /* 부채꼴 모양(fans)은 그리지 않는다 — 날아가는 단검만 보인다 (2026-11-20 사용자 "부채꼴이 너무 드러나서 투사체만 보이게". 301번에서 넣은 펼쳐지는 부채꼴을 뺌) */
    if (due('fever')) { l = this.sk.fever; ev = this._evo('fever'); if (near || this._nearest(1, CFG.ATK.range * 1.3, null).length) { tm.fever = CD('fever', l);
        var cnt = SK.fever.n(l), frange = CFG.ATK.range * 1.4 * RC * (this._awk('fever') ? 1.3 : 1), waves = SK.fever.w(l) + (ev ? 1 : 0), mul = SK.fever.dmg(l) * (ev ? 1.3 : 1) * UP('fever'), fa = this._awk('fever'); if (fa) cnt += 4; this.feverT0 = T; this.feverUntil = T + (waves - 1) * 0.22 + 0.2;   // 그동안 도둑이 제자리에서 돌며 던진다 (update)
        for (k = 0; k < waves; k++) (function (wi) { self.queue.push({ at: T + wi * 0.22, fn: function () {   // 날아가는 단검은 보이지 않는다 (2026-11-19 사용자 요청 — 붉은보석처럼): 둘레의 적들이 거의 동시에 맞고, 맞는 자리의 섬광을 크게
              var tg = self._nearest(cnt, frange, null), hits = Math.min(cnt, tg.length * 2), a;   // 적이 단검 수보다 적으면 한 적에게 두 발까지
              for (a = 0; a < hits; a++) (function (u, k) { self.queue.push({ at: self.D.time + k * 0.014, fn: function () { if (u.state !== 'dead') self._hitFoe(u, self._base() * mul * self._onDagger(u), self.hero.act.arm, 1.7); } }); })(tg[a % tg.length], a);
              self.ringT = self.D.time; self.ringN = cnt; self.ringA = wi * 0.5 / cnt * 6.2832; D._play(self.hero.act.snd, 0.4); } }); })(k); } else tm.fever = 0.3; }
    // 트래퍼 주력: 독 묻힌 단도 · 폭발 단도 — 대기마다 가까운 적에게 그 단검을 던진다 (2026-11-19 사용자 "패시브가 아닌 쿨타임 존재" — 전에는 모든 단검이 맞을 때마다 터졌다)
    if (due('zrun')) { l = this.sk.zrun; var ZS = SK.zrun; if (!this.hide && !this.rift && !(T < this.feverUntil) && !this.waves.length && this._nearest(1, ZS.seek, null).length) { tm.zrun = CD('zrun', l); var zn = ZS.n(l), za0 = D.rng.next() * 6.2832; for (k = 0; k < zn; k++) { var zang = za0 + k / zn * 6.2832; this.blades.push({ x: h.x, y: h.y, vx: Math.cos(zang), vy: Math.sin(zang), ph: 'out', go: 0, left: ZS.hits(l), hit: {}, last: null, tgt: null, mul: ZS.dmg(l) * UP('zrun'), tr: [[h.x, h.y]], w: 0, t0: T }); } D._play(h.act.snd, 0.6); } else tm.zrun = 0.4; }
    for (k = this.blades.length - 1; k >= 0; k--) { var bl = this.blades[k], ZB = SK.zrun, bst = this.speed * (bl.ph === 'seek' ? ZB.stabK : ZB.spdK) * dt; if (T - bl.t0 > ZB.life && bl.ph !== 'fade') { bl.ph = 'fade'; bl.w = 0.18; } var pick = function (b) { var best = null, bs = 1e9; for (var q4 = 0; q4 < F.length; q4++) { var u4 = F[q4]; if (u4.state === 'dead' || u4.rush) continue; if (Math.hypot(u4.x - h.x, u4.y - h.y) > ZB.seek) continue; var taken = 0; for (var q5 = 0; q5 < self.blades.length; q5++) if (self.blades[q5] !== b && self.blades[q5].tgt === u4) taken = 1; var sc4 = D.rng.next() + taken * 2 + (b.hit[u4.uid] ? 4 : 0) + (u4 === b.last ? 8 : 0); if (sc4 < bs) { bs = sc4; best = u4; } } return best; };   // 환영검: 갈라져 나옴 → 꿰뚫음 → 더 나아감 → 잠깐 멈춤 → 다음 적
      if (bl.ph === 'out') { bl.x += bl.vx * bst; bl.y += bl.vy * bst; bl.go += bst; if (bl.go >= ZB.out) { bl.ph = 'wait'; bl.w = ZB.wait * 0.6; bl.tr.push([bl.x, bl.y]); } }
      else if (bl.ph === 'wait') { bl.w -= dt; if (!bl.tgt || bl.tgt.state === 'dead') bl.tgt = pick(bl); if (bl.tgt) { var tx4 = bl.tgt.x - bl.x, ty4 = bl.tgt.y - bl.y, tl4 = Math.hypot(tx4, ty4) || 1, kk = Math.min(1, dt * 14); bl.vx += (tx4 / tl4 - bl.vx) * kk; bl.vy += (ty4 / tl4 - bl.vy) * kk; var vl4 = Math.hypot(bl.vx, bl.vy) || 1; bl.vx /= vl4; bl.vy /= vl4; }   // 멈춘 동안 다음 적 쪽으로 날을 돌린다
        if (bl.w <= 0) { if (bl.left <= 0 || !bl.tgt) { bl.ph = 'fade'; bl.w = 0.18; } else { bl.ph = 'seek'; } } }
      else if (bl.ph === 'seek') { if (!bl.tgt || bl.tgt.state === 'dead') { bl.tgt = pick(bl); if (!bl.tgt) { bl.ph = 'fade'; bl.w = 0.18; continue; } }
        var sx4 = bl.tgt.x - bl.x, sy4 = bl.tgt.y - bl.y, sl4 = Math.hypot(sx4, sy4) || 1; bl.vx = sx4 / sl4; bl.vy = sy4 / sl4;
        if (sl4 <= bst + 10) { bl.x = bl.tgt.x; bl.y = bl.tgt.y; this._bladeHit(bl.tgt, this._base() * bl.mul); bl.hit[bl.tgt.uid] = 1; if (!bl.tgt.boss && bl.tgt.state !== 'dead') { bl.tgt.x += bl.vx * ZB.push; bl.tgt.y += bl.vy * ZB.push; } bl.last = bl.tgt; bl.left--; bl.tgt = null; bl.ph = 'over'; bl.go = 0; bl.stop = ZB.stop;
          this.stabs.push({ x: bl.x, y: bl.y - 14, vx: bl.vx, vy: bl.vy, t0: T }); if (T - (this.snowT || -9) > 0.02) { this.snowT = T; this.bursts.push({ x: bl.x, y: bl.y - 14, t0: T, a: Math.atan2(bl.vy, bl.vx), k: 'p', life: 0.26, sc: 1.5 }); } }
        else { bl.x += bl.vx * bst; bl.y += bl.vy * bst; } }
      else if (bl.ph === 'over' && bl.stop > 0) { bl.stop -= dt; }   /* 박힌 채 잠깐 멈춤 */
      else if (bl.ph === 'over') { bl.x += bl.vx * bst; bl.y += bl.vy * bst; bl.go += bst; if (bl.go >= ZB.over) { bl.ph = 'wait'; bl.w = ZB.wait; bl.tr.push([bl.x, bl.y]); if (bl.tr.length > 4) bl.tr.shift(); } }
      else { bl.w -= dt; if (bl.w <= 0) this.blades.splice(k, 1); } }
    for (k = this.petals.length - 1; k >= 0; k--) { var pt2 = this.petals[k], ZK = SK.zrun, stp2 = ZK.speed * dt, px0 = pt2.x, py0 = pt2.y, pb = this._base() * pt2.mul * (pt2.back ? ZK.back : 1), tdx, tdy, td2;   // 설화난영참의 잔상: 뻗어 나갔다가(끝에서 눈꽃 섬광) 무사에게 돌아와 합쳐진다
      if (!pt2.back) { pt2.x += pt2.vx * stp2; pt2.y += pt2.vy * stp2; pt2.go += stp2; if (pt2.go >= pt2.max) { pt2.back = true; pt2.hit = {}; this.bursts.push({ x: pt2.x, y: pt2.y - 14, t0: T, a: D.rng.next() * 1.05, k: 'w', life: 0.4, r: 26 }); } }
      else { tdx = h.x - pt2.x; tdy = h.y - pt2.y; td2 = Math.hypot(tdx, tdy); if (td2 <= stp2 + 6) { this.petals.splice(k, 1); continue; } pt2.x += tdx / td2 * stp2; pt2.y += tdy / td2 * stp2; pt2.vx = tdx / td2; pt2.vy = tdy / td2; }
      var sx2 = pt2.x - px0, sy2 = pt2.y - py0, sl3 = sx2 * sx2 + sy2 * sy2 || 1;
      for (var fi2 = 0; fi2 < F.length; fi2++) { var fu2 = F[fi2]; if (fu2.state === 'dead' || pt2.hit[fu2.uid]) continue; var tt = Math.max(0, Math.min(1, ((fu2.x - px0) * sx2 + (fu2.y - py0) * sy2) / sl3)); if (Math.hypot(fu2.x - (px0 + sx2 * tt), fu2.y - (py0 + sy2 * tt)) > ZK.w) continue;
        pt2.hit[fu2.uid] = 1; this._bladeHit(fu2, pb); if (T - (this.snowT || -9) > 0.05) { this.snowT = T; this.bursts.push({ x: fu2.x, y: fu2.y - fu2.headY * 0.5, t0: T, a: D.rng.next() * 1.05, k: 'w', life: 0.3, r: 15 }); } } }
    if (due('bunch')) { l = this.sk.bunch; var BN = SK.bunch, cand = this._nearest(40, BN.range, null), bt = null, bc = -1;   // 폭탄 다발: 가까운 40기 중 둘레 60 안에 적이 가장 많은 놈을 겨눈다
      cand.forEach(function (u) { var c = 0; for (var ci = 0; ci < cand.length; ci++) if (Math.hypot(cand[ci].x - u.x, cand[ci].y - u.y) <= 60) c++; if (c > bc) { bc = c; bt = u; } });
      if (bt) { tm.bunch = CD('bunch', l); var bn = BN.n(l); for (k = 0; k < bn; k++) { var ba2 = k / bn * 6.2832 + D.rng.next() * 0.8, bd2 = k ? BN.spread * (0.45 + 0.55 * D.rng.next()) * RC : 0; this.lobs.push({ x0: h.x, y0: h.y - h.headY * 0.6, x1: bt.x + Math.cos(ba2) * bd2, y1: bt.y + Math.sin(ba2) * bd2 * 0.7, t0: T + k * 0.05, dur: BN.fly, r: BN.r(l), mul: BN.dmg(l) * UP('bunch') }); }
        D._faceVec(h, bt.x - h.x, bt.y - h.y, true); this.aimUntil = T + 0.3; D._play(h.act.snd, 0.4); } else tm.bunch = 0.4; }
    for (k = this.lobs.length - 1; k >= 0; k--) { var lb = this.lobs[k]; if (T >= lb.t0 + lb.dur) { this.lobs.splice(k, 1); this._blast(lb.x1, lb.y1, lb.r, lb.mul, 62); this.bursts.push({ x: lb.x1, y: lb.y1 - 6, t0: T, a: 0, k: 'b', life: 0.32, r: lb.r * RC }); this.bursts.push({ x: lb.x1, y: lb.y1 - 8, t0: T, a: D.rng.next() * 6.28, k: 'e', life: 0.42, r: lb.r * RC }); if (T - (this.bombSndT || -9) > 0.12) { this.bombSndT = T; D._play(5064, 0.22); } } }   // 떨어진 자리에서 터진다
    for (k = this.ants.length - 1; k >= 0; k--) { var an = this.ants[k], AU = ULT.trapper, av = an.u, gx2, gy2;   // 폭탄 개미: 겨눈 적(쓰러졌으면 가장 가까운 적, 없으면 나온 방향으로 곧게)에게 달려가 붙어 다니다 터진다
      if (an.tgt && an.tgt.state === 'dead') { an.tgt = null; var nb = 1e9; F.forEach(function (u) { if (u.state === 'dead' || u.rush) return; var d2 = Math.hypot(u.x - av.x, u.y - av.y); if (d2 < nb && d2 < 200) { nb = d2; an.tgt = u; } }); }
      if (an.tgt) { gx2 = an.tgt.x - av.x; gy2 = an.tgt.y - av.y; } else { gx2 = Math.cos(an.a) * 99; gy2 = Math.sin(an.a) * 99; }
      var gd2 = Math.hypot(gx2, gy2) || 1; if (gd2 > 12) { var st2 = Math.min(gd2 - 10, AU.speed * dt); av.x += gx2 / gd2 * st2; av.y += gy2 / gd2 * st2; av.state = 'move'; av.walkT += dt * 2; D._faceVec(av, gx2, gy2); } else av.state = 'idle';
      if (T >= an.at) { this.ants.splice(k, 1); var ar = AU.r * RC; this._blast(av.x, av.y, AU.r, AU.mul, SK.explo.boom); F.forEach(function (u) { if (u.state !== 'dead' && !u.boss && Math.hypot(u.x - av.x, u.y - av.y) <= ar) u.stunUntil = Math.max(u.stunUntil || 0, T + AU.stun); });
        this.bursts.push({ x: av.x, y: av.y - 6, t0: T, a: 0, k: 'b', life: 0.36, r: ar }); this.bursts.push({ x: av.x, y: av.y - 8, t0: T, a: D.rng.next() * 6.28, k: 'e', life: 0.45, r: ar }); if (T - (this.bombSndT || -9) > 0.1) { this.bombSndT = T; D._play(5064, 0.3); } } }
    ['toxdag', 'darkdag'].forEach(function (key) { if (!due(key)) return; var lv = self.sk[key], tg = self._nearest(SK[key].n(lv) + 4, CFG.ATK.range, null).filter(function (u) { return !((key === 'toxdag' ? u.toxUntil : u.darkUntil) > T); }).slice(0, SK[key].n(lv));   // 이미 표시가 붙은 적은 건너뛴다
      if (!tg.length) { tm[key] = 0.3; return; } tm[key] = CD(key, lv); tg.forEach(function (u) { var bs = self._dagger(u, SK[key].dmg(lv)); bs.spl = key; bs.arm = -2; bs.bv = CFG.ATK.shot * GROW.bomb.speed; bs.life = CFG.ATK.life / GROW.bomb.speed; });   /* 독 폭탄·암흑 폭탄: 폭탄처럼 느리게 날아간다 (이름·모양만 폭탄 — 한 적만 맞히는 것은 그대로. 2026-11-20 사용자 "독과 암흑을 독 폭탄, 암흑 폭탄으로") */ D._play(self.hero.act.snd, 0.35); });
    // 그림자 검술: 회오리 베기 · 그림자 돌진
    if (due('whirl')) { l = this.sk.whirl; var wr = SK.whirl.r * RC * (this._awk('whirl') ? 1.5 : 1), wm = SK.whirl.dmg(l), wn = SK.whirl.w(l);
      if (this._nearest(1, wr, null).length) { tm.whirl = CD('whirl', l); this.feverT0 = T; this.feverUntil = T + wn * 0.13 + 0.05;   // 도는 자세는 다팅 피버의 것을 빌린다
        for (k = 0; k < wn; k++) this.queue.push({ at: T + k * 0.13, fn: function () { var hh = self.hero; self._ring(hh.x, hh.y, wr, wm); D._play(hh.act.snd, 0.35); } }); } else tm.whirl = 0.3; }
    if (due('dash')) { l = this.sk.dash; var dd = SK.dash.dist(l), dm = SK.dash.dmg(l), dw = SK.dash.w, best = null, bc = 0, di, dc;
      for (di = 0; di < 16; di++) { var ca = Math.cos(di * 0.3927), sa = Math.sin(di * 0.3927); dc = 0; for (i = 0; i < F.length; i++) { var fu = F[i]; if (fu.state === 'dead') continue; var px = fu.x - h.x, py = fu.y - h.y, pt = px * ca + py * sa; if (pt >= 0 && pt <= dd && Math.abs(px * sa - py * ca) <= dw) dc++; } if (dc > bc) { bc = dc; best = [ca, sa]; } }
      if (best && bc >= 2) { tm.dash = CD('dash', l); var wv2 = function () { var hh = self.hero; self.waves.push({ x: hh.x, y: hh.y, vx: best[0], vy: best[1], go: 0, max: dd * RC, hit: {}, mul: dm * UP('dash'), t0: self.D.time }); D._faceVec(hh, best[0], best[1], true); hh.state = 'attack'; hh.at = 0; self.aimUntil = self.D.time + 0.3; D._play(hh.act.snd, 0.5); }; wv2(); if (this._awk('dash')) this.queue.push({ at: T + 0.28, fn: wv2 }); } else tm.dash = 0.4; }
    for (k = this.waves.length - 1; k >= 0; k--) { var wv3 = this.waves[k], WK = SK.dash, ws2 = WK.speed * dt, wx0 = wv3.x, wy0 = wv3.y, wb = this._base() * wv3.mul;   // 검기: 곧게 날아가며 길 위의 적을 한 번씩 벤다
      wv3.x += wv3.vx * ws2; wv3.y += wv3.vy * ws2; wv3.go += ws2;
      for (var wf = 0; wf < F.length; wf++) { var wu = F[wf]; if (wu.state === 'dead' || wv3.hit[wu.uid]) continue; var wt = Math.max(0, Math.min(1, ((wu.x - wx0) * wv3.vx + (wu.y - wy0) * wv3.vy) / ws2)); if (Math.hypot(wu.x - (wx0 + wv3.vx * ws2 * wt), wu.y - (wy0 + wv3.vy * ws2 * wt)) > WK.w) continue; wv3.hit[wu.uid] = 1; this._bladeHit(wu, wb); }
      if (wv3.go >= wv3.max) this.waves.splice(k, 1); }
    // 덫 놓기
    ['mouse', 'booby', 'explo'].forEach(function (key) { if (!due(key)) return; var s = SK[key], lv = self.sk[key]; tm[key] = s.cd(lv) * HS;
      var mine = self.traps.filter(function (t) { return t.k === key; }); if (mine.length >= (key === 'mouse' && self._awk('mouse') ? 14 : s.max) + (self.cls === 'trapper' ? GROW.trapPlus : 0)) self.traps.splice(self.traps.indexOf(mine[0]), 1);
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
    // 치명타 확률: 기본 + 그림자 숨기(숨은 동안) + 더블 드로잉(대도의 길)
    this.crit = Math.min(GROW.critMax, CFG.CRIT.p + this._mv('crit') +(T < this.stealthUntil ? SK.shadow.crit(this.sk.shadow || 1) : 0) + (this.sk.double && this._evo('double') ? SK.double.evo.crit(this.sk.double) : 0) + (this.cls === 'shadow' ? SK.slash.crit(this.sk.slash || 1) : 0)); this.crit2 = CFG.CRIT.p2 + (this.sk.double && this._evo('double') ? SK.double.evo.crit2(this.sk.double) : 0);
    // 경험치 보석: 범위 안이면 끌려온다
    var pr = GROW.pickup * ((l = this._lvOf('pick')) ? SK.pick.v(l) : 1);
    this.gems = this.gems.filter(function (g) { var dx = h.x - g.x, dy = h.y - 12 - g.y, d = Math.hypot(dx, dy) || 1; if (g.pull || d <= pr) { g.pull = true; var st = GROW.gemSpeed * dt; if (d <= st + 8) { self._gain(g.v); return false; } g.x += dx / d * st; g.y += dy / d * st; } return true; });
    // 필드 아이템: 닿으면 바로 쓴다 — 고기(체력 30%) · 자석(화면의 경험치 전부) · 폭탄(둘레의 적 모두에게 큰 피해)
    var IT = GROW.item, I0 = this.items; this.items = []; I0 = I0.filter(function (it) {   /* 줍는 동안 생긴 아이템(폭탄에 쓰러진 적의 드롭 — 우두머리 상자 포함)은 새 배열에 쌓였다가 아래에서 합친다. 전에는 걸러 낸 배열로 덮어써 사라졌다 */ if (T - it.t0 > IT.life && it.k !== 'chest') return false; if (Math.hypot(h.x - it.x, h.y - 10 - it.y) > IT.pick) return true;
      if (it.k === 'meat') { var hv = Math.round(h.maxHp * IT.heal); h.hp = Math.min(h.maxHp, h.hp + hv); self._text(h.x, h.y - h.headY - 16, '+' + hv, '#9fe08a'); }
      else if (it.k === 'chest') self._chest();
      else if (it.k === 'magnet') { self.gems.forEach(function (g) { g.pull = true; }); self._text(h.x, h.y - h.headY - 16, '경험치 흡수', '#7fe0ff'); }
      else { var bb = self._base() * IT.bombMul; F.forEach(function (u) { if (u.state !== 'dead' && Math.hypot(u.x - h.x, u.y - h.y) <= IT.bombR) self._hitFoe(u, bb, -1); }); self.flashT = T; self._fx(h.x, h.y - 10, SK.explo.boom); D._play(5064, 0.8); self._text(h.x, h.y - h.headY - 16, '폭탄!', '#ffb86a'); }
      if (D._raceSnd) D._raceSnd('click'); return false; }); this.items = I0.concat(this.items);
    if (this.pend > 0 && !this.cards) { this.cards = this._roll(); this.cardT = 0; this.stick = null; this.keys = {}; }
  };
  /* 궁극기 발동 (궁극기 칸을 누르거나 E 키) */
  P._zStep = function (dt) {   // Z 가르기(어쌔신 검술): Z 자 길을 따라 달리며 길 위의 적을 한 번씩 벤다
    var D = this.D, T = D.time, h = this.hero, F = this.foes, U = SK.zrun, Z = this.zrun, left = U.speed * dt, base = this._base() * Z.mul, i, dx = 1, dy = 0;
    while (left > 0 && Z.i < Z.pts.length) { var p = Z.pts[Z.i]; dx = p[0] - h.x; dy = p[1] - h.y; var d = Math.hypot(dx, dy); if (d < 0.5) { Z.i++; this.slashes.push({ x0: Z.sx, y0: Z.sy - h.headY * 0.5, x1: h.x, y1: h.y - h.headY * 0.5, t0: T }); Z.sx = h.x; Z.sy = h.y; continue; }
      var st = Math.min(d, left, 18); h.x += dx / d * st; h.y += dy / d * st; left -= st; Z.acc += st; if (Z.acc >= 70) { Z.acc = 0; this.slashes.push({ x0: Z.sx, y0: Z.sy - h.headY * 0.5, x1: h.x, y1: h.y - h.headY * 0.5, t0: T }); Z.sx = h.x; Z.sy = h.y; }
      for (i = 0; i < F.length; i++) { var u = F[i]; if (u.state === 'dead' || Z.hit[u.uid] || Math.hypot(u.x - h.x, u.y - h.y) > U.w) continue; Z.hit[u.uid] = 1;
        this._hitFoe(u, base, h.act.arm, 1.5); if (T - (this.zSndT || -9) > 0.07) { this.zSndT = T; D._play(h.act.snd, 0.45); } } }
    D._faceVec(h, dx, dy, true); var ZA = h.t.anim.atk; h.state = 'attack'; h.at = ZA && ZA.hit != null ? ZA.hit : 4; this.aimUntil = T + 0.1;
    if (Z.i >= Z.pts.length) { this.zrun = null; this.invUntil = T + 0.5; h.state = 'idle'; }
  };
  P._ultFire = function () {
    var self = this, D = this.D, T = D.time, h = this.hero, F = this.foes, U = ULT[this.cls], k; if (!U || this.tm.ult > 0 || this.over || this.cards || this.info) return;
    this.tm.ult = ULT.cd * (1 - this._pv('haste')); this._text(h.x, h.y - h.headY - 24, U.name, CLS[this.cls].col); this.flashT = T - 0.18; D._play(5064, 0.7);
    if (this.cls === 'venom') {   // 크레이지 샷: 도둑이 몸이 흐려질 만큼 빠르게 던진다 — 화면의 적을 섞은 차례대로, 적이 없으면 아무 쪽으로나 (끝날 때까지 쉬지 않는다)
      var sec = U.secOf(this.lv), G0 = T + U.charge, CZ = this.crazy = { t0: T, go: G0, until: G0 + sec, bag: [], imgs: [], a: 0, hits: [] }; this.invUntil = Math.max(this.invUntil, G0 + sec + U.tail + 0.3);   // 쓰는 동안 무적 (343번, 사용자 "궁극기 쓸 때는 무적" — 천지파열무와 같은 방식)
      this.freezeUntil = G0 + sec + U.tail;   // 기 모으기부터 피해가 들어갈 때까지 모든 적이 멈춘다 (343번, 사용자 "시전 전 이펙트가 나올 때 모든 적이 멈추고, 궁극기가 끝난 후 데미지 한꺼번에")
      this.queue.push({ at: G0 + sec + U.tail, fn: function () { if (self.over) return; var TT = self.D.time, hh = self.hero; self.flashT = TT; D._play(5064, 0.7);   // 끝: 그동안 맞은 만큼이 한꺼번에 — 적마다 맞은 횟수대로 숫자가 빠르게 쌓인다
        CZ.hits.forEach(function (e) { var st = Math.min(0.04, 0.45 / e.n); for (var hi = 0; hi < e.n; hi++) (function (u, hi) { self.queue.push({ at: TT + hi * st, fn: function () { if (u.state !== 'dead') self._hitFoe(u, self._base() * U.mul * self._onDagger(u), hh.act.arm, U.big, U.crit); } }); })(e.u, hi); }); CZ.hits = []; } });
      var refill = function () { var hh = self.hero, L = []; self.foes.forEach(function (u) { if (u.state !== 'dead' && Math.hypot(u.x - hh.x, u.y - hh.y) <= U.near) { L.push(u); if (u.boss) L.push(u); } }); for (var qi = L.length - 1; qi > 0; qi--) { var qj = Math.floor(D.rng.next() * (qi + 1)), qt = L[qi]; L[qi] = L[qj]; L[qj] = qt; } CZ.bag = L; };
      var pick = function () { var hh = self.hero; for (var tries = 0; tries < 2; tries++) { while (CZ.bag.length) { var u = CZ.bag.pop(); if (u.state !== 'dead' && Math.hypot(u.x - hh.x, u.y - hh.y) <= U.near + 60) return u; } refill(); } return null; };
      for (k = 0; k < Math.round(sec / U.gap); k++) (function (wi) { self.queue.push({ at: G0 + wi * U.gap, fn: function () { if (self.crazy !== CZ || self.over) return; var hh = self.hero, TT = self.D.time, thrown = 0;
        for (var pj = 0; pj < U.per; pj++) { var u = pick(), sy0 = hh.y - hh.headY * 0.6, ua, sdx, sdy, sdd;
          if (u) { sdx = u.x - hh.x; sdy = u.y - u.headY * 0.5 - sy0; ua = Math.atan2(sdy, sdx); } else { ua = D.rng.next() * 6.2832; sdx = Math.cos(ua); sdy = Math.sin(ua); }   // 적이 없으면 아무 쪽으로 — 날아가다 처음 닿는 적을 맞힌다
          sdd = Math.hypot(sdx, sdy) || 1; CZ.a = ua;
          var po = U.blur * (0.4 + D.rng.next() * 0.6), pa = ua + (D.rng.next() < 0.5 ? 1.5708 : -1.5708);   // 잔상: 던지는 쪽과 직각으로 몸 옆에 살짝 비켜서
          if (pj === 0) { CZ.imgs.push({ a: ua, t0: TT, ox: Math.cos(pa) * po + Math.cos(ua) * 3, oy: (Math.sin(pa) * po + Math.sin(ua) * 3) * 0.7 }); if (CZ.imgs.length > 4) CZ.imgs.shift(); }   // 잔상은 틱마다 하나 — 여러 장이 겹치면 불투명해 보인다 (사용자 "너무 불투명, 무사처럼": 무사의 잔상은 한 번에 한 장)
          if (u) { if (!u.czE || u.czE.cz !== CZ) { u.czE = { u: u, n: 0, cz: CZ }; CZ.hits.push(u.czE); } u.czE.n++; u.hitT = TT; self.bursts.push({ x: u.x + (D.rng.next() - 0.5) * 10, y: u.y - u.headY * (0.3 + D.rng.next() * 0.4), t0: TT, a: D.rng.next() * 6.28, k: 'n', life: 0.2, sc: U.spark }); } thrown++; }   // 날아가는 단검은 보이지 않는다(사용자 "다팅 피버처럼") — 맞은 자리의 섬광만 튀고, 피해는 끝난 뒤 한꺼번에. 적이 없으면 던지는 동작·잔상만
        if (thrown && wi % 2 === 0) D._play(hh.act.snd, 0.28); } }); })(k); }
    else if (this.cls === 'trapper') {   // 폭탄 개미: 서로 가장 멀리 떨어진 적들을 차례로 골라(처음은 가장 가까운 적) 한 마리씩 보낸다 — 적이 모자라면 남은 개미는 사방으로
      var cand2 = F.filter(function (u) { return u.state !== 'dead' && !u.rush && Math.hypot(u.x - h.x, u.y - h.y) <= U.near; }), picks = [], md = cand2.map(function (u) { return Math.hypot(u.x - h.x, u.y - h.y); }), ci, bi;
      for (k = 0; k < U.n && cand2.length; k++) { bi = 0; for (ci = 1; ci < cand2.length; ci++) if (k ? md[ci] > md[bi] : md[ci] < md[bi]) bi = ci; if (k && md[bi] < 30) break; var pk = cand2[bi]; picks.push(pk); for (ci = 0; ci < cand2.length; ci++) md[ci] = k ? Math.min(md[ci], Math.hypot(cand2[ci].x - pk.x, cand2[ci].y - pk.y)) : Math.hypot(cand2[ci].x - pk.x, cand2[ci].y - pk.y); }
      for (k = 0; k < U.n; k++) { var aa = k / U.n * 6.2832, au = this._unit(U.unit, 0, h.x + Math.cos(aa) * 14, h.y + Math.sin(aa) * 10); au.state = 'move'; D._faceVec(au, Math.cos(aa), Math.sin(aa), true);
        this.ants.push({ u: au, tgt: picks[k] || null, a: aa, t0: T, at: T + U.fuse + k * U.gap }); }
      D._play(5092, 0.5); }
    else {   // 천지파열무: 균열을 만들고(그리기용), 화면의 모든 적을 균열이 닿는 차례로 친다
      var lines = [], mk = function (x, y, a, len, depth) { var pts = [[x, y]], d = 0, ca, br = [], a0 = a;   /* 들쭉날쭉하되 큰 방향(a0)은 지킨다 */ while (d < len) { var stp = 16 + D.rng.next() * 16; a += (D.rng.next() - 0.5) * 0.95; a += (a0 - a) * 0.35; d += stp; x += Math.cos(a) * stp; y += Math.sin(a) * stp * 0.8; pts.push([x, y]); if (depth < 1 && d > 60 && D.rng.next() < 0.1) br.push([x, y, a + (D.rng.next() < 0.5 ? 1 : -1) * (0.5 + D.rng.next() * 0.5), len * (0.18 + D.rng.next() * 0.2), d / len]); }
          var dense = [pts[0]]; for (var dq = 1; dq < pts.length; dq++) { var pa0 = pts[dq - 1], pb0 = pts[dq], ddx0 = pb0[0] - pa0[0], ddy0 = pb0[1] - pa0[1], ddl0 = Math.hypot(ddx0, ddy0) || 1; for (var dm = 1; dm <= 2; dm++) { var jt = (D.rng.next() - 0.5) * 7; dense.push([pa0[0] + ddx0 * dm / 3 - ddy0 / ddl0 * jt, pa0[1] + ddy0 * dm / 3 + ddx0 / ddl0 * jt * 0.8]); } dense.push(pb0); } pts = dense;
          var hw = pts.map(function (q3, qi) { return (1.2 + D.rng.next() * D.rng.next() * 9) * (depth ? 0.6 : 1) * (1 - 0.6 * qi / pts.length) + (qi % 3 === 0 ? 2 : 0); }), sp = []; for (var si3 = 1; si3 < pts.length; si3++) { var nsp = D.rng.next() < 0.75 ? 1 : 0; for (var sj3 = 0; sj3 < nsp; sj3++) sp.push([si3, D.rng.next(), (D.rng.next() - 0.5) * 1.5, 1 + D.rng.next() * 2.4, D.rng.next() < 0.45 ? 0 : 1, D.rng.next() * 6.28]); }   /* hw = 꼭짓점마다 다른 틈의 반폭(끝으로 갈수록 가늘게), sp = 틈 안의 덩어리 [구간, 구간 안 위치, 좌우 치우침, 크기, 0 식은 암석·1 달아오른 곳, 맥박 위상] */
          lines.push({ p: pts, w: depth ? 0.6 : 1, at: 0, depth: depth, hw: hw, sp: sp }); br.forEach(function (b) { var n0 = lines.length; mk(b[0], b[1], b[2], b[3], depth + 1); for (var q2 = n0; q2 < lines.length; q2++) lines[q2].at = Math.max(lines[q2].at, b[4]); }); };
      [-1.08, 1.08, 3.1416 - 1.08, 3.1416 + 1.08].forEach(function (a) { mk(h.x, h.y, a + (D.rng.next() - 0.5) * 0.16, 640, 0); }); [0, 3.1416].forEach(function (a) { mk(h.x, h.y, a + (D.rng.next() - 0.5) * 0.3, 300, 0); });
      var pil = []; for (k = 0; k < 16; k++) pil.push([(D.rng.next() - 0.5) * 300, (D.rng.next() - 0.5) * 150, 0.5 + D.rng.next() * 0.5]); this.rift = { x: h.x, y: h.y, t0: T, lines: lines, pil: pil }; this.invUntil = Math.max(this.invUntil, T + U.life + 0.2); var HA = h.t.anim.atk; this.aimUntil = T + 0.5; D._play(5092, 0.5);
      var TE = U.charge + U.plant + U.grow + U.hold, TD = TE + U.stage * 3 + U.tail, nfx = 0; this.freezeUntil = Math.max(this.freezeUntil || 0, T + TD + 0.05);   /* 344번(사용자 "천지파열무 시전 시 모든 적들이 멈춰야 하는데 현재는 계속 움직이고 있음"): 기 모으기부터 피해가 들어갈 때까지 모든 적 정지 (무차별 난사와 같은 freezeUntil) */
      var band = function (d) { return d < U.bands[0] ? 0 : d < U.bands[1] ? 1 : 2; };
      this.queue.push({ at: T + U.charge, fn: function () { self.flashT = self.D.time - 0.1; D._play(5064, 0.5); } });   // 칼이 꽂히는 순간
      [0, 1, 2].forEach(function (k) { self.queue.push({ at: T + TE + k * U.stage, fn: function () { D._play(5064, 0.6 + 0.15 * k); if (k === 2) self.flashT = self.D.time; } }); });
      /* 터질 때 균열을 따라 원작 불꽃(플레임 윈드 26 의 불꽃 송이, 가끔 불구름 64)이 솟는다 — 가까운 띠부터 먼 띠까지 세 번에 나눠 */
      var fxn = 0; lines.forEach(function (ln, li) { for (var vi = 6 + (li % 3) * 3; vi < ln.p.length; vi += 15) { if (fxn >= U.fxMax) return; var vp = ln.p[vi], vd = Math.hypot(vp[0] - h.x, vp[1] - h.y); fxn++;
        (function (x, y, arm, at) { self.queue.push({ at: at, fn: function () { self._fx(x, y - 6, arm); } }); })(vp[0], vp[1], (vi + li) % 4 ? 26 : 64, T + TE + band(vd) * U.stage + D.rng.next() * 0.16); } });
      lines.forEach(function (ln, li) { for (var vi = 3 + (li % 2) * 3; vi < ln.p.length; vi += 9) { var vp = ln.p[vi], vd = Math.hypot(vp[0] - h.x, vp[1] - h.y); if (fxn++ >= U.fxMax * 2.2) return; (function (x, y, at) { self.queue.push({ at: at, fn: function () { self._fx(x, y - 4, 26); } }); })(vp[0] + (D.rng.next() - 0.5) * 14, vp[1], T + TE + band(vd) * U.stage + 0.12 + D.rng.next() * 0.3); } });   /* 불꽃 송이(26)를 균열 따라 한 겹 더 — 작아서 화면을 덮지 않는다 */
      F.forEach(function (u) { if (u.state === 'dead') return; var d = Math.hypot(u.x - h.x, u.y - h.y); if (d > U.near) return; var showFx = nfx++ < 46;
        if (showFx) self.queue.push({ at: T + TE + band(d) * U.stage + 0.08, fn: function () { if (u.state === 'dead') return; self._fx(u.x, u.y - 10, 62); self.bursts.push({ x: u.x, y: u.y - 8, t0: self.D.time, a: self.D.rng.next() * 6.28, k: 'e', life: 0.5, r: 34 }); } });   // 불기둥은 띠 차례로 (보이기만)
        self.queue.push({ at: T + TD, fn: function () { if (u.state === 'dead') return; u.bleedUntil = Math.max(u.bleedUntil || 0, self.D.time + 3); u.bleed = Math.max(u.bleed || 0, self._base() * U.burn); var kf = self.D.types[U.floorUnit]; self._hitFoe(u, Math.max(self._base() * U.mul, kf ? kf.hp * CFG.FOE.hp * self._hpK() * U.floor : 0), -1); } }); }); }   // 피해는 연출이 다 끝난 뒤 한꺼번에
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
    var RF = this.rift; if (RF) { var UR = ULT.shadow, raAll = T - RF.t0, ra = raAll - UR.charge; if (raAll > UR.life) this.rift = null; else { var gk2 = Math.max(0, Math.min(1, (ra - UR.plant) / UR.grow)), fade = raAll > UR.life - UR.out ? Math.max(0, (UR.life - raAll) / UR.out) : 1, fl = 0.8 + 0.2 * Math.sin(T * 34), li, pi2;   // 천지파열무: 바닥이 어두워지고 용암 빛 균열이 안쪽에서 바깥으로 갈라져 나간다
        ctx.fillStyle = 'rgba(6,4,10,' + (0.42 * fade * Math.min(1, raAll / 0.5)).toFixed(3) + ')'; ctx.fillRect(RF.x - 700, RF.y - 800, 1400, 1700); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var er = ra - UR.plant - UR.grow - UR.hold, pre = Math.max(0, Math.min(1, (ra - UR.plant) / (UR.grow + UR.hold))), hot = er >= 0 ? Math.min(1, 0.55 + 0.45 * er / (UR.stage * 2)) : 0.12 + 0.5 * pre * pre * (0.75 + 0.25 * Math.sin(T * 26));   /* hot: 터지기 전에는 틈 사이로 붉은빛이 차오르기만 한다 */
        /* 균열 = 틈 아래로 보이는 뜨거운 암석 (334번, 2026-11-20 사용자: "불꽃이 너무 도형 모양의 삼각형이어서 — 갈라진 틈 밑에 보이는 뜨거운 암석 형태로" + 참고 화면): 폭이 들쭉날쭉한 띠(그을린 가장자리 → 달아오른 암석 → 더 밝은 속) 안에 식은 암석 조각(어두운 덩어리)과 달아오른 점(노랗게 맥박치는 곳)이 섞여 있다. 삼각형 불꽃은 없앴다. 터지는 띠는 잠깐 하얗게 달아오르고 작은 불티가 떠오른다 */
        var bandOf = function (px3, py3) { var fd = Math.hypot(px3 - RF.x, py3 - RF.y); return fd < UR.bands[0] ? 0 : fd < UR.bands[1] ? 1 : 2; }, ribbon = function (ln, np, k, grow) { var L = [], R = [], q; for (q = 0; q < np; q++) { var a = ln.p[Math.max(0, q - 1)], b = ln.p[Math.min(ln.p.length - 1, q + 1)], dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1, nx = -dy / dl, ny = dx / dl, w = (ln.hw[q] * k + grow) * (q === np - 1 ? 0.25 : 1); L.push([ln.p[q][0] + nx * w, ln.p[q][1] + ny * w * 0.8]); R.push([ln.p[q][0] - nx * w, ln.p[q][1] - ny * w * 0.8]); }
            ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (q = 1; q < np; q++) ctx.lineTo(L[q][0], L[q][1]); for (q = np - 1; q >= 0; q--) ctx.lineTo(R[q][0], R[q][1]); ctx.closePath(); ctx.fill(); };
        for (li = 0; li < RF.lines.length; li++) { var ln = RF.lines[li], lk2 = (gk2 - ln.at) / Math.max(0.05, 1 - ln.at); if (lk2 <= 0) continue; var np = Math.max(2, Math.ceil(ln.p.length * Math.min(1, lk2)));
          ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,70,10,' + (0.16 * fade * fl * hot).toFixed(3) + ')'; ctx.lineWidth = 22 * ln.w; ctx.beginPath(); ctx.moveTo(ln.p[0][0], ln.p[0][1]); for (pi2 = 1; pi2 < np; pi2++) ctx.lineTo(ln.p[pi2][0], ln.p[pi2][1]); ctx.stroke();   // 틈 둘레의 붉은 기운
          ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = 'rgba(8,3,2,' + (0.97 * fade).toFixed(3) + ')'; ribbon(ln, np, 1.15, 3);                                    // 그을린 가장자리
          ctx.fillStyle = 'rgba(' + Math.round(80 + 175 * hot) + ',' + Math.round(16 + 84 * hot) + ',' + Math.round(6 + 14 * hot) + ',' + fade.toFixed(3) + ')'; ribbon(ln, np, 0.9, 0);    // 달아오른 암석
          ctx.fillStyle = 'rgba(255,' + Math.round(150 + 80 * hot) + ',' + Math.round(40 + 70 * hot) + ',' + (0.9 * hot * fade).toFixed(3) + ')'; ribbon(ln, np, 0.42, 0);                // 더 밝은 속
          for (var sq = 0; sq < ln.sp.length; sq++) { var sp3 = ln.sp[sq]; if (sp3[0] >= np) break; var pa = ln.p[sp3[0] - 1], pb = ln.p[sp3[0]], sx3 = pa[0] + (pb[0] - pa[0]) * sp3[1], sy3 = pa[1] + (pb[1] - pa[1]) * sp3[1], shw = ln.hw[sp3[0]] * 0.55, ddx = pb[0] - pa[0], ddy = pb[1] - pa[1], ddl = Math.hypot(ddx, ddy) || 1; sx3 += -ddy / ddl * sp3[2] * shw; sy3 += ddx / ddl * sp3[2] * shw * 0.8;
            if (sp3[4] === 0) { ctx.fillStyle = 'rgba(38,14,8,' + (0.9 * fade).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(sx3, sy3, sp3[3] * 1.3, sp3[3] * 0.8, sp3[5], 0, 6.2832); ctx.fill(); }                                   // 식은 암석 조각
            else { var pu = 0.55 + 0.45 * Math.sin(T * 5 + sp3[5]); ctx.fillStyle = 'rgba(255,' + Math.round(200 + 40 * pu) + ',' + Math.round(110 + 80 * pu) + ',' + (hot * fade * (0.5 + 0.5 * pu)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(sx3, sy3, sp3[3] * 0.9, sp3[3] * 0.6, sp3[5], 0, 6.2832); ctx.fill(); } }   // 달아오른 점 (맥박)
          for (pi2 = 1; pi2 < np; pi2++) { var vp3 = ln.p[pi2], since = er - bandOf(vp3[0], vp3[1]) * UR.stage; if (since < 0 || since > 1.1) continue; var bo = 1 - since / 1.1;   // 터지는 띠: 그 구간이 하얗게 달아올랐다 식고, 불티가 떠오른다
            ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,235,170,' + (0.8 * bo * bo * fade).toFixed(3) + ')'; ctx.lineWidth = (ln.hw[pi2] * 1.6 + 2) * (0.6 + 0.4 * bo); ctx.beginPath(); ctx.moveTo(ln.p[pi2 - 1][0], ln.p[pi2 - 1][1]); ctx.lineTo(vp3[0], vp3[1]); ctx.stroke();
            ctx.fillStyle = 'rgba(255,' + (150 + (pi2 * 53 % 90)) + ',50,' + (0.9 * bo * fade).toFixed(3) + ')'; for (var eb = 0; eb < 2; eb++) { var ep3 = ((since * 1.3 + eb * 0.5 + pi2 * 0.37) % 1); ctx.fillRect(vp3[0] + Math.sin(pi2 * 7.3 + eb * 2.1 + since * 4) * 9 - 1, vp3[1] - ep3 * 34 - 2, 2, 2); } ctx.globalCompositeOperation = 'source-over'; } }
        ctx.globalCompositeOperation = 'source-over';
        if (ra >= UR.plant && ra - UR.plant < 1.1) { var gp = (ra - UR.plant) / 1.1, gi; ctx.globalCompositeOperation = 'lighter';   /* 꽂는 순간 솟는 금빛 빛기둥 (영상의 세로 빛줄기) — 금방 사그라진다 */
          for (gi = 0; gi < RF.pil.length; gi++) { var pl2 = RF.pil[gi], gx3 = RF.x + pl2[0], gy3 = RF.y + pl2[1], gh3 = 260 * pl2[2], gw3 = 5 + 6 * pl2[2], gg = ctx.createLinearGradient(0, gy3 - gh3, 0, gy3); gg.addColorStop(0, 'rgba(255,200,60,0)'); gg.addColorStop(0.6, 'rgba(255,190,50,' + (0.55 * (1 - gp)).toFixed(3) + ')'); gg.addColorStop(1, 'rgba(255,240,170,' + (0.8 * (1 - gp)).toFixed(3) + ')'); ctx.fillStyle = gg; ctx.fillRect(gx3 - gw3 / 2, gy3 - gh3, gw3, gh3); }
          ctx.globalCompositeOperation = 'source-over'; }
        if (ra < 0) { ctx.globalAlpha = 1; } else {
        var pk = Math.min(1, ra / UR.plant), sy0 = RF.y + 7, tip = sy0, top = sy0 - 34 - (1 - pk) * 46;   // 바닥에 꽂힌 칼: 위에서 내리꽂혀 균열이 사라질 때까지 서 있다 (도둑 발 앞)
        if (pk >= 1 && ra - UR.plant < 0.35) { var rk2 = (ra - UR.plant) / 0.35; ctx.strokeStyle = 'rgba(255,230,170,' + (0.9 * (1 - rk2)).toFixed(3) + ')'; ctx.lineWidth = 3 * (1 - rk2) + 1; ctx.beginPath(); ctx.ellipse(RF.x, sy0, 12 + 80 * rk2, (12 + 80 * rk2) * 0.5, 0, 0, 6.2832); ctx.stroke(); }
        } } }
    for (i = 0; i < this.marks.length; i++) { var mq = this.marks[i], qk = Math.max(0, Math.min(1, (T - mq.t0) / (mq.at - mq.t0)));   // 적 마법 예고: 붉은 원이 안에서부터 차오른다 — 다 차면 폭발
      ctx.save(); ctx.translate(mq.x, mq.y); ctx.scale(1, 0.62); ctx.fillStyle = 'rgba(255,60,40,' + (0.10 + 0.14 * qk).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(0, 0, mq.r * qk, 0, 6.2832); ctx.fill(); ctx.strokeStyle = 'rgba(255,90,60,' + (0.55 + 0.4 * qk).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, mq.r, 0, 6.2832); ctx.stroke(); ctx.restore(); }
    this.fans = this.fans.filter(function (f) { return T - f.t0 < 0.34; }); for (i = 0; i < this.fans.length; i++) { var fn = this.fans[i], ft = T - fn.t0, fR = CFG.ATK.range, fr2 = Math.min(fR, 14 + ft * CFG.ATK.shot), fk = 1 - ft / 0.34, hx2 = this.hero.x, hy2 = this.hero.y;   // 단도 흩뿌리기의 부채꼴: 단검과 함께 바깥으로 펼쳐졌다가 사라진다 (안쪽은 옅게, 앞 가장자리 호와 양옆 선은 또렷하게)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var fg = ctx.createRadialGradient(hx2, hy2, 0, hx2, hy2, fr2); fg.addColorStop(0, 'rgba(190,225,255,0)'); fg.addColorStop(0.55, 'rgba(190,225,255,' + (0.10 * fk).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(210,235,255,' + (0.30 * fk).toFixed(3) + ')');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.arc(hx2, hy2, fr2, fn.a - fn.half, fn.a + fn.half); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(235,245,255,' + (0.75 * fk).toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx2, hy2, fr2, fn.a - fn.half, fn.a + fn.half); ctx.stroke();
      ctx.strokeStyle = 'rgba(210,235,255,' + (0.35 * fk).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx2 + Math.cos(fn.a - fn.half) * fr2, hy2 + Math.sin(fn.a - fn.half) * fr2); ctx.lineTo(hx2, hy2); ctx.lineTo(hx2 + Math.cos(fn.a + fn.half) * fr2, hy2 + Math.sin(fn.a + fn.half) * fr2); ctx.stroke(); ctx.restore(); }
    var SW = this.siegeWarn; if (SW) { var gk = (T - SW.t0) / CFG.SIEGE.warn;   // 포위 예고: 적이 나타날 자리(도둑 둘레)에 붉은 점선 고리 — 가늘게, 전장을 덮지 않는다
      ctx.strokeStyle = 'rgba(255,80,50,' + (0.5 + 0.4 * gk).toFixed(3) + ')'; ctx.lineWidth = 2.5; ctx.setLineDash([12, 9]); ctx.lineDashOffset = -T * 50; ctx.beginPath(); ctx.ellipse(this.hero.x, this.hero.y, CFG.SIEGE.rx, CFG.SIEGE.ry, 0, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]); }
    for (i = 0; i < this.foes.length; i++) { var fu = this.foes[i]; if (fu.state === 'dead') continue;
      if (fu.sup) { var FS = CFG.SUP[fu.sup], ck = fu.castT != null ? Math.max(0, 1 - (T - fu.castT) / 0.6) : 0;   // 치유형(녹색)·소환형(보라): 발밑 고리, 시전할 때 잠깐 퍼진다
        ctx.strokeStyle = 'rgba(' + FS.col + ',' + (0.55 + 0.35 * ck).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, 15, 7, 0, 0, 6.2832); ctx.stroke();
        if (ck > 0 && fu.sup === 'heal') { ctx.strokeStyle = 'rgba(' + FS.col + ',' + (0.4 * ck).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, FS.r * (1 - ck * 0.6), FS.r * 0.5 * (1 - ck * 0.6), 0, 0, 6.2832); ctx.stroke(); } }
      if (fu.darkUntil > T) { var dq = 0.6 + 0.4 * Math.sin(T * 14 + fu.x); ctx.fillStyle = 'rgba(30,0,60,' + (0.55 * dq).toFixed(2) + ')'; ctx.strokeStyle = 'rgba(180,110,255,' + (0.9 * dq).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, 13, 6, 0, 0, 6.2832); ctx.fill(); ctx.stroke(); }   // 암흑 물질 감염: 발밑 검보라 원 (3초)
      if (fu.toxUntil > T) { ctx.strokeStyle = 'rgba(110,230,80,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(fu.x, fu.y, 10, 4.5, 0, 0, 6.2832); ctx.stroke(); }   // 중독: 발밑 녹색 고리
      if (!fu.sup && fu.healT != null && T - fu.healT < 0.5) { var hk = (T - fu.healT) / 0.5; ctx.fillStyle = 'rgba(127,227,106,' + (1 - hk).toFixed(2) + ')'; ctx.fillRect(fu.x - 1, fu.y - fu.headY - 9 - hk * 8, 2, 7); ctx.fillRect(fu.x - 3.5, fu.y - fu.headY - 6.5 - hk * 8, 7, 2); } }   // 회복받은 적 머리 위 작은 녹색 십자
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
    var SH = this.shrine, SC = CFG.SHRINE; if (SH) { var SK2 = SC.kinds[SH.k], sl = SC.life - (T - SH.t0), sa = Math.min(1, (T - SH.t0) / 0.5) * (sl < 5 ? 0.55 + 0.45 * Math.sin(T * 10) : 1), sp = D.bld && D.bld.pics[SC.pic], simg2 = D._bldSheet && D._bldSheet();
      var sg = ctx.createRadialGradient(SH.x, SH.y, 4, SH.x, SH.y, 62); sg.addColorStop(0, 'rgba(' + SK2.rgb + ',' + (0.5 * sa).toFixed(3) + ')'); sg.addColorStop(1, 'rgba(' + SK2.rgb + ',0)'); ctx.save(); ctx.translate(SH.x, SH.y); ctx.scale(1, 0.5); ctx.translate(-SH.x, -SH.y); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(SH.x, SH.y, 62 * (1 + 0.05 * Math.sin(T * 4)), 0, 6.3); ctx.fill(); ctx.restore();
      ctx.save(); ctx.globalAlpha = sa; ctx.translate(SH.x, SH.y); ctx.scale(SC.scale, SC.scale); if (sp && simg2 && simg2.naturalWidth) ctx.drawImage(simg2, sp[0], sp[1], sp[2], sp[3], -sp[2] / 2, -sp[3] * 0.74, sp[2], sp[3]); else { ctx.fillStyle = SK2.col; ctx.fillRect(-30, -120, 60, 120); } ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; var sb2 = ctx.createLinearGradient(0, SH.y - 96, 0, SH.y - 30); sb2.addColorStop(0, 'rgba(' + SK2.rgb + ',0)'); sb2.addColorStop(1, 'rgba(' + SK2.rgb + ',' + (0.32 * sa * (0.8 + 0.2 * Math.sin(T * 5))).toFixed(3) + ')'); ctx.fillStyle = sb2; ctx.fillRect(SH.x - 7, SH.y - 96, 14, 66); ctx.restore(); }
    var SF = this.shrineFx; if (SF) { var fq = (T - SF.t0) / 0.6; if (fq >= 1) this.shrineFx = null; else { ctx.save(); ctx.globalCompositeOperation = 'lighter'; var hh = this.hero, fg = ctx.createRadialGradient(hh.x, hh.y - 14, 2, hh.x, hh.y - 14, 20 + 46 * fq); fg.addColorStop(0, 'rgba(' + SF.rgb + ',' + (0.75 * (1 - fq)).toFixed(3) + ')'); fg.addColorStop(1, 'rgba(' + SF.rgb + ',0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(hh.x, hh.y - 14, 20 + 46 * fq, 0, 6.3); ctx.fill(); ctx.restore(); } }
    var BF = this.buff, bks = ['war', 'magic', 'guard'].filter(function (k) { return T < BF[k]; }); for (i = 0; i < bks.length; i++) { var bh = this.hero, brem = BF[bks[i]] - T, bal = (brem < 3 ? 0.35 + 0.3 * Math.sin(T * 12) : 0.5) ; ctx.strokeStyle = 'rgba(' + SC.kinds[bks[i]].rgb + ',' + bal.toFixed(3) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(bh.x, bh.y + 2, 17 + i * 4, 7 + i * 1.6, 0, 0, 6.3); ctx.stroke(); }   /* 성소 강화 중: 발밑에 종류 색 고리 (끝나기 3초 전부터 깜빡임) */
    if (T < this.stealthUntil) { var h = this.hero; ctx.fillStyle = 'rgba(120,80,200,' + (0.35 + 0.15 * Math.sin(T * 8)).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(h.x, h.y + 2, 22, 9, 0, 0, 6.3); ctx.fill(); }
  };

  MWE.SurvivalGame = SurvivalGame;
})(typeof window !== 'undefined' ? window : globalThis);
