#!/usr/bin/env node
// 단방향 노선 (1/3/4/5/6/7/8/9호선)의 swopenAPI updnLine 매핑 cross-check.
//
// 가설: doc에서 '1' = 하행. packages/core/src/subwayDirection.ts의 expectedUpdnLine은
// LINE_X_DOWN sequence에서 prev→next가 정방향(인덱스 +1)이면 '1'을 반환.
// 2호선은 doc과 반대(사용자가 또타지하철과 비교로 발견)였기에 swap 처리.
// 1/3/4/5/6/7/8/9도 같은 quirk가 있는지 실제 응답으로 검증.
//
// 검증 방법:
//   1. swopenAPI realtimePosition으로 노선 차량들 조회.
//   2. 각 차량의 statnTnm (목적지) 봐서 정방향/역방향 판정 — 종점이 LINE_X_DOWN의 끝역이면 정방향.
//   3. 우리 코드가 가정하는 expected updnLine (정방향 '1', 역방향 '0')과 실제 차량의 updnLine 비교.
//   4. mismatch 비율 ≥ 80% → swap 필요. ≤ 20% → doc과 일치.
//
// 사용:
//   source ~/.aircon-env && node scripts/check-updnline.mjs
//   특정 노선만: node scripts/check-updnline.mjs 1호선 5호선

import { readFileSync } from 'node:fs';

// inline mirror of LINE_X_DOWN (subwayDirection.ts와 동기화 유지).
// 다음번 시퀀스 변경 시 여기도 같이 업데이트 — `check-data.mjs`에 link 검증을 박아도 됨.
const SEQUENCES = {
  '1호선': ['소요산','동두천','보산','동두천중앙','지행','덕정','덕계','양주','녹양','가능','의정부','회룡','망월사','도봉산','도봉','방학','창동','녹천','월계','광운대','석계','신이문','외대앞','회기','청량리','제기동','신설동','동묘앞','동대문','종로5가','종로3가','종각','시청','서울역','남영','용산','노량진','대방','신길','영등포','신도림','구로','가산디지털단지','독산','금천구청','석수','관악','안양','명학','금정','군포','당정','의왕','성균관대','화서','수원','세류','병점','세마','오산대','오산','진위','송탄','서정리','평택지제','평택','성환','직산','두정','천안'],
  '3호선': ['대화','주엽','정발산','마두','백석','대곡','화정','원당','삼송','지축','구파발','연신내','불광','녹번','홍제','무악재','독립문','경복궁','안국','종로3가','을지로3가','충무로','동대입구','약수','금호','옥수','압구정','신사','잠원','고속터미널','교대','남부터미널','양재','매봉','도곡','대치','학여울','대청','일원','수서','가락시장','경찰병원','오금'],
  '4호선': ['당고개','상계','노원','창동','쌍문','수유','미아','미아사거리','길음','성신여대입구','한성대입구','혜화','동대문','동대문역사문화공원','충무로','명동','회현','서울역','숙대입구','삼각지','신용산','이촌','동작','이수','사당','남태령','선바위','경마공원','대공원','과천','정부과천청사','인덕원','평촌','범계','금정','산본','수리산','대야미','반월','상록수','한대앞','중앙','고잔','초지','안산','신길온천','정왕','오이도'],
  '5호선': ['방화','개화산','김포공항','송정','마곡','발산','우장산','화곡','까치산','신정','목동','오목교','양평','영등포구청','영등포시장','신길','여의도','여의나루','마포','공덕','애오개','충정로','서대문','광화문','종로3가','을지로4가','동대문역사문화공원','청구','신금호','행당','왕십리','마장','답십리','장한평','군자','아차산','광나루','천호','강동','길동','굽은다리','명일','고덕','상일동','강일','미사','하남풍산','하남시청','하남검단산'],
  '6호선': ['응암','역촌','불광','독바위','연신내','구산','새절','증산','디지털미디어시티','월드컵경기장','마포구청','망원','합정','상수','광흥창','대흥','공덕','효창공원앞','삼각지','녹사평','이태원','한강진','버티고개','약수','청구','신당','동묘앞','창신','보문','안암','고려대','월곡','상월곡','돌곶이','석계','태릉입구','화랑대','봉화산','신내'],
  '7호선': ['장암','도봉산','수락산','마들','노원','중계','하계','공릉','태릉입구','먹골','중화','상봉','면목','사가정','용마산','중곡','군자','어린이대공원','건대입구','뚝섬유원지','청담','강남구청','학동','논현','반포','고속터미널','내방','이수','남성','숭실대입구','상도','장승배기','신대방삼거리','보라매','신풍','대림','남구로','가산디지털단지','철산','광명사거리','천왕','온수','까치울','부천종합운동장','춘의','신중동','부천시청','상동','삼산체육관','굴포천','부평구청','산곡','석남'],
  '8호선': ['별내','다산','동구릉','구리','장자호수공원','암사역사공원','암사','천호','강동구청','몽촌토성','잠실','석촌','송파','가락시장','문정','장지','복정','산성','남한산성입구','단대오거리','신흥','수진','모란'],
  '9호선': ['개화','김포공항','공항시장','신방화','마곡나루','양천향교','가양','증미','등촌','염창','신목동','선유도','당산','국회의사당','여의도','샛강','노량진','노들','흑석','동작','구반포','신반포','고속터미널','사평','신논현','언주','선정릉','삼성중앙','봉은사','종합운동장','삼전','석촌고분','석촌','송파나루','한성백제','올림픽공원','둔촌오륜','중앙보훈병원'],
};

function stripStation(s) { return s?.endsWith('역') ? s.slice(0, -1) : s; }

async function fetchLine(key, line) {
  const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(line)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${line}: HTTP ${res.status}`);
  const data = await res.json();
  return data.realtimePositionList ?? [];
}

function analyze(line, rows) {
  const seq = SEQUENCES[line];
  if (!seq) return null;
  // 정방향 종점 = seq[seq.length-1], 역방향 종점 = seq[0].
  // 차량의 statnTnm을 보고 정방향 차량인지 역방향 차량인지 판정.
  const forwardEnd = stripStation(seq[seq.length - 1]);
  const reverseEnd = stripStation(seq[0]);
  // 우리 코드 가정: 정방향 prev→next는 '1'을 반환. 즉 정방향 차량의 updnLine이
  // doc대로면 '1', swap이면 '0'.
  let docOk = 0;
  let docSwap = 0;
  let ambiguous = 0;
  const samples = [];
  for (const r of rows) {
    const dest = stripStation(r.statnTnm);
    const updn = r.updnLine;
    let dir; // 'forward' | 'reverse'
    if (dest === forwardEnd) dir = 'forward';
    else if (dest === reverseEnd) dir = 'reverse';
    else {
      // 중간역 종점 (회차) — 시퀀스에서 index로 비교.
      const di = seq.findIndex((s) => stripStation(s) === dest);
      const mid = seq.length / 2;
      if (di < 0) { ambiguous++; continue; }
      dir = di > mid ? 'forward' : 'reverse';
    }
    const expectedUpdn = dir === 'forward' ? '1' : '0';
    const swappedUpdn  = dir === 'forward' ? '0' : '1';
    if (updn === expectedUpdn) docOk++;
    else if (updn === swappedUpdn) docSwap++;
    else ambiguous++;
    if (samples.length < 3) {
      samples.push({ trainNo: r.trainNo, currentStation: r.statnNm, dest: r.statnTnm, updn, dir, expectedUpdn });
    }
  }
  const total = docOk + docSwap + ambiguous;
  return { total, docOk, docSwap, ambiguous, samples };
}

async function main() {
  const key = process.env.SEOUL_REALTIME_KEY;
  if (!key) {
    console.error('SEOUL_REALTIME_KEY 환경변수 없음 — source ~/.aircon-env 했는지 확인');
    process.exit(1);
  }
  const targetLines = process.argv.slice(2).filter((a) => /호선$/.test(a));
  const lines = targetLines.length ? targetLines : Object.keys(SEQUENCES);
  const report = {};
  for (const line of lines) {
    try {
      const rows = await fetchLine(key, line);
      const r = analyze(line, rows);
      report[line] = r;
      const verdict = !r.total ? 'NO_DATA'
        : r.docOk / r.total >= 0.8 ? 'DOC_OK'
        : r.docSwap / r.total >= 0.8 ? 'NEEDS_SWAP'
        : 'AMBIGUOUS';
      console.log(`\n[${line}] verdict=${verdict}  rows=${rows.length}  docOk=${r.docOk}  docSwap=${r.docSwap}  ambiguous=${r.ambiguous}`);
      for (const s of r.samples) {
        console.log(`  trainNo=${s.trainNo} at=${s.currentStation} dest=${s.dest} → dir=${s.dir} expected=${s.expectedUpdn} actual=${s.updn}`);
      }
    } catch (e) {
      console.log(`\n[${line}] ERROR: ${e.message}`);
      report[line] = { error: e.message };
    }
    // swopenAPI 호출 사이 100ms 간격 (rate limit 회피).
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('\n=== SUMMARY ===');
  for (const [line, r] of Object.entries(report)) {
    if (r.error) { console.log(`${line}: ERROR ${r.error}`); continue; }
    if (!r.total) { console.log(`${line}: NO_DATA`); continue; }
    const verdict = r.docOk / r.total >= 0.8 ? 'DOC_OK' : r.docSwap / r.total >= 0.8 ? 'NEEDS_SWAP' : 'AMBIGUOUS';
    console.log(`${line}: ${verdict} (docOk=${r.docOk}/${r.total}, docSwap=${r.docSwap})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
