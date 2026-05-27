import { describe, it, expect } from 'vitest';
import { classifySubwayRegion } from '../tagoProviders';

describe('classifySubwayRegion', () => {
  // TAGO SubwayInfo의 subwayStationId prefix → 지역 매핑 검증.
  // 실측 데이터 (2026-05-28 GetKwrdFndSubwaySttnList):
  it.each([
    // 부산
    ['MTRBS1119', 'busan'],   // 서면 1호선
    ['MTRBS2206', 'busan'],   // 센텀시티 2호선
    // 대구
    ['MTRDG10135', 'daegu'],  // 동대구역 1호선
    ['MTRDG10128', 'daegu'],  // 교대 1호선
    // 대전
    ['MTRDJ10001', 'daejeon'],// 판암(대전대) 1호선
    ['MTRDJ10004', 'daejeon'],// 대전 1호선
    // 광주
    ['MTRGJ1104', 'gwangju'], // 문화전당 1호선
    // 인천2 (인천1은 swopenAPI cover라 'other'로 분류)
    ['MTRICI2227', 'incheon2'],// 운연 인천2호선
    // 서울/수도권은 'other' — 차량 단위(swopenAPI)로 처리.
    ['MTRS11133', 'other'],   // 서울역 1호선
    ['MTRS12223', 'other'],   // 교대 2호선
    ['MTRKR1P177', 'other'],  // 신창(순천향대)
    ['MTRKRK6K113', 'other'], // 동해선 교대
    ['MTRKRK7K118', 'other'], // 대경선 동대구역
    // 인천1은 수도권과 같이 처리 — 우리 매칭은 swopenAPI 우선이므로 'other'.
    ['MTRICI1115', 'other'],  // 경인교대입구 인천1호선
  ])('%s → %s', (id, expected) => {
    expect(classifySubwayRegion(id)).toBe(expected);
  });
});
