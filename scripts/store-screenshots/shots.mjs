// 스토어 스크린샷 SHOTS — 헤드라인 단일 목록 (compose가 공유).
//
// ★원판 소스 = iOS 시뮬레이터(실제 출시 앱). 웹 PWA가 아니다.
//   왜: 스토어는 모바일 앱 리스팅이다. 웹은 모바일에 없는 UI(지하철 모드토글, 카페 네이버지도)를
//   노출해 "앱에 없는 기능 광고" = 심사 리젝(Apple/Google accurate-metadata)이 된다 (이중검수 catch).
//   capture.mjs가 시뮬레이터를 Maestro로 돌려 실제 화면을 raw/로 가져온다.
//
// 헤드라인은 실제 흐름과 일치해야 한다(과장 금지). 예: 지하철은 이전·다음 역 입력이 필요하므로
// "장소만 고르면 30초" 같은 과장 대신 실제 동작을 적는다.

export const SHOTS = [
  { name: '01-categories', headline: '지금 어디 계세요?\n지하철·기차·버스·강의실·카페' },
  { name: '02-subway', headline: '지하철, 이전·다음 역만\n입력하면 차량까지' },
  { name: '03-classroom', headline: '전국 대학교 강의실\n건물·호실 단위로 투표' },
  { name: '04-train', headline: 'KTX·SRT·무궁화호\n승차권 정보로 차량 검증' },
];

// 캔버스 규격 — Apple 1290×2796은 6.7"/6.9" 디스플레이 공용(현행 필수 대형 슬롯 충족).
// Play는 1080×2160(업로드 허용; 권장 노출은 9:16 1080×1920). iPad 미지원(supportsTablet:false).
export const TARGETS = {
  ios: { w: 1290, h: 2796 },
  play: { w: 1080, h: 2160 },
};
