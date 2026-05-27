// 회귀 방지: 지하철 영업 시간 외 추정 (KST 01:00 ~ 05:00).
//
// 정확한 노선별 첫차/막차 데이터 없이 conservative window로 운행 종료 신호.
// 그 외 시간대 + API 0건 = 헤드웨이 사이 일시 차량 없음 (별도 reason).

import { describe, it, expect } from 'vitest';
import { isSubwayServiceClosed, kstHour } from '../subwayHours';

// UTC 입력으로 KST hour 검증. KST = UTC+9.
function utc(year: number, month: number, day: number, hour: number, min = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, min));
}

describe('kstHour', () => {
  it('UTC 00:00 = KST 09:00', () => {
    expect(kstHour(utc(2026, 5, 27, 0))).toBe(9);
  });

  it('UTC 16:00 = KST 다음날 01:00 (영업 시간 외 시작)', () => {
    expect(kstHour(utc(2026, 5, 27, 16))).toBe(1);
  });

  it('UTC 20:00 = KST 다음날 05:00 (영업 시간 외 끝)', () => {
    expect(kstHour(utc(2026, 5, 27, 20))).toBe(5);
  });
});

describe('isSubwayServiceClosed', () => {
  it('KST 01:00 (UTC 16:00) — 막차 직후, 운행 종료', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 16))).toBe(true);
  });

  it('KST 03:00 (UTC 18:00) — 한밤중, 운행 종료', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 18))).toBe(true);
  });

  it('KST 04:59 (UTC 19:59) — 첫차 직전, 운행 종료', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 19, 59))).toBe(true);
  });

  it('KST 05:00 (UTC 20:00) — 첫차 시작, 운행 중', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 20))).toBe(false);
  });

  it('KST 12:00 (UTC 03:00) — 한낮, 운행 중', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 3))).toBe(false);
  });

  it('KST 23:30 (UTC 14:30) — 막차 시간대, 운행 중 (보수적 처리)', () => {
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 14, 30))).toBe(false);
  });

  it('KST 00:30 (UTC 15:30) — 막차 끝나는 시각, 보수적으로 운행 중 처리', () => {
    // 00:00 ~ 01:00 사이는 일부 노선 마지막 차량 가능 — 영업 시간 외로 단정 안 함.
    expect(isSubwayServiceClosed(utc(2026, 5, 27, 15, 30))).toBe(false);
  });
});
