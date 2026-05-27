// 서울 도시철도 영업 시간 외 추정.
//
// 정확한 노선별 첫차/막차는 별도 정적 데이터셋이 필요한데, 그것 없이도 대부분 작동 가능한
// conservative window: KST 01:00 ~ 05:00 = '운행 종료' 강한 신뢰.
//
// 실제 영업 시간 (서울 도시철도 평균):
//   1호선   04:30 ~ 24:30 (24:30 = 익일 00:30)
//   2~4호선 05:00 ~ 24:30
//   5~9호선 05:30 ~ 24:00
//   신림선   05:30 ~ 24:00
//
// 보수적으로 01:00 (모든 막차 종료) ~ 05:00 (첫차 30분 전) 만 'closed'로 표기. 그 외 시간대에
// API 응답 0건이면 "현재 차량 없음" (헤드웨이 사이) 으로 별도 메시지.

const KST_OFFSET_MIN = 9 * 60;

export function kstNow(now: Date = new Date()): Date {
  // UTC ms → KST ms. Date 객체로 다시 만들면 getHours는 OS timezone 영향이라
  // KST hour/minute만 따로 계산해야. 단순화: ms shift + UTC getter 사용.
  return new Date(now.getTime() + KST_OFFSET_MIN * 60 * 1000);
}

export function kstHour(now: Date = new Date()): number {
  return kstNow(now).getUTCHours();
}

/**
 * 영업 시간 외 추정. true면 첫차 전 또는 막차 후 — 모든 노선 운행 종료.
 * false라도 헤드웨이 사이로 일시적 차량 없음일 수 있음.
 */
export function isSubwayServiceClosed(now: Date = new Date()): boolean {
  const h = kstHour(now);
  // 01:00 ~ 04:59 = 운행 종료 시간대 (전체 막차 후 + 첫차 전).
  return h >= 1 && h < 5;
}
