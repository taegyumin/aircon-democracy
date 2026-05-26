// 회귀 방지: stationDisplay + carCountFor — UI 표기 정확성.
//
// 사용자 회귀 보고 2026-05-27:
//   1. "서울대입구역역", "봉천역역", "신림역역" 이중 표기.
//   2. 신림선 차량 selector가 10량까지 — 실제 3량.

import { describe, it, expect } from 'vitest';
import { stationDisplay, carCountFor, LINE_CAR_COUNT } from '../subway';

describe('stationDisplay', () => {
  it('STATIONS의 name이 이미 "역"으로 끝나면 그대로', () => {
    expect(stationDisplay('서울대입구역')).toBe('서울대입구역');
    expect(stationDisplay('봉천역')).toBe('봉천역');
    expect(stationDisplay('신림역')).toBe('신림역');
    expect(stationDisplay('강남역')).toBe('강남역');
  });

  it('"역"으로 안 끝나면 "역" 추가', () => {
    expect(stationDisplay('강남')).toBe('강남역');
    expect(stationDisplay('잠실')).toBe('잠실역');
  });

  it('빈 문자열은 그대로 (UI 측에서 guard)', () => {
    expect(stationDisplay('')).toBe('역'); // 사실상 호출 안 됨, but no crash
  });
});

describe('carCountFor', () => {
  it('서울 본선 — 표준 차량 수', () => {
    expect(carCountFor('1호선')).toBe(10);
    expect(carCountFor('2호선')).toBe(10);
    expect(carCountFor('3호선')).toBe(10);
    expect(carCountFor('4호선')).toBe(10);
    expect(carCountFor('5호선')).toBe(8);
    expect(carCountFor('6호선')).toBe(8);
    expect(carCountFor('7호선')).toBe(8);
    expect(carCountFor('8호선')).toBe(6);
    // 9호선은 2019 하반기까지 6량화 완료 (서울시 보도).
    expect(carCountFor('9호선')).toBe(6);
  });

  it('경전철 — 신림선/우이신설/김포골드라인', () => {
    // 신림선은 3량 (서울시 미디어허브 검증). 이전에 2량으로 잘못 박았던 회귀.
    expect(carCountFor('신림선')).toBe(3);
    expect(carCountFor('우이신설선')).toBe(2);
    expect(carCountFor('김포골드라인')).toBe(2);
    expect(carCountFor('인천2호선')).toBe(2);
  });

  it('광역철도', () => {
    expect(carCountFor('신분당선')).toBe(6);
    expect(carCountFor('공항철도')).toBe(6);
    expect(carCountFor('경의중앙선')).toBe(8);
    expect(carCountFor('경춘선')).toBe(8);
    expect(carCountFor('수인분당선')).toBe(10); // 6/10량 혼용 → 최대값
  });

  it('미정의 노선은 fallback (8량)', () => {
    expect(carCountFor('알수없는노선')).toBe(8);
  });

  it('LINE_CAR_COUNT는 정의된 모든 노선이 양의 정수', () => {
    for (const [line, n] of Object.entries(LINE_CAR_COUNT)) {
      expect(n, line).toBeGreaterThan(0);
      expect(Number.isInteger(n), line).toBe(true);
    }
  });
});
