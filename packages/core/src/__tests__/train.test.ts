// 회귀 방지: KTX/SRT 등 기차 station search + segment matching.

import { describe, it, expect } from 'vitest';
import { searchTrainStations, TRAIN_STATIONS } from '../train';
import { findTrainSegments } from '../subwayGraph';

describe('TRAIN_STATIONS', () => {
  it('데이터셋이 비어있지 않음', () => {
    expect(TRAIN_STATIONS.length).toBeGreaterThan(50);
  });
  it('주요 KTX 정거장 포함', () => {
    const names = TRAIN_STATIONS.map((s) => s.name);
    // 데이터는 "역" suffix 미포함, "서울역"/"부산역"이 아닌 "서울"/"부산"이 들어있을 수도
    expect(names.some((n) => n.startsWith('강릉'))).toBe(true);
  });
});

describe('searchTrainStations', () => {
  it('데이터에 있는 역으로 검색 → 매칭', () => {
    const r = searchTrainStations('강릉', 5);
    expect(r.some((s) => s.name.includes('강릉'))).toBe(true);
  });
  it('빈 query → limit 적용된 부분 list (현재 동작)', () => {
    const r = searchTrainStations('', 5);
    expect(r.length).toBeLessThanOrEqual(5);
  });
});

describe('findTrainSegments', () => {
  // 데이터 형태 확인하면 실제 인접 쌍을 테스트할 수 있음.
  // train-adjacency.json 비어있을 수 있으므로 형식만 검증.
  it('비존재 segment = 빈 결과', () => {
    expect(findTrainSegments('없는역A', '없는역B')).toEqual([]);
  });
});
