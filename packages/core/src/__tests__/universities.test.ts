// 회귀 방지: 대학교 데이터 + place ID 생성.

import { describe, it, expect } from 'vitest';
import * as snu from '../snu';
import * as yonsei from '../yonsei';

describe('SNU buildings', () => {
  it('데이터셋 비어있지 않음 (>= 100동)', () => {
    expect(snu.BUILDINGS.length).toBeGreaterThan(100);
  });
  it('주요 건물 (301동) 존재', () => {
    expect(snu.buildingByCode('301')).toBeDefined();
  });
  it('잘못된 code → undefined', () => {
    expect(snu.buildingByCode('999XXX')).toBeUndefined();
  });
  it('search "공대" → 공과대학 건물 포함', () => {
    const hits = snu.search('공대', null, 30);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('Yonsei buildings', () => {
  it('데이터셋 비어있지 않음 (>= 20동)', () => {
    expect(yonsei.BUILDINGS.length).toBeGreaterThan(20);
  });
  it('search "공학" → 공학 관련 건물', () => {
    const hits = yonsei.search('공학', 10);
    expect(hits.length).toBeGreaterThan(0);
  });
  it('yonseiPlaceId 일관성 (같은 건물 + 호실 = 같은 id)', () => {
    const b = yonsei.BUILDINGS[0];
    expect(yonsei.yonseiPlaceId(b, '101')).toBe(yonsei.yonseiPlaceId(b, '101'));
  });
});
