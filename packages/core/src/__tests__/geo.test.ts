// 회귀 방지: Haversine 거리 + formatDistance bucket. pure 함수.

import { describe, it, expect } from 'vitest';
import { distanceM, formatDistance } from '../geo';

describe('distanceM (Haversine)', () => {
  it('동일 좌표 = 0', () => {
    expect(distanceM({ lat: 37.5, lng: 127.0 }, { lat: 37.5, lng: 127.0 })).toBe(0);
  });
  it('강남역 ↔ 교대역 ≈ 1.2km (실측 1~1.5km 범위)', () => {
    const d = distanceM(
      { lat: 37.4979, lng: 127.0276 }, // 강남
      { lat: 37.4937, lng: 127.0145 }, // 교대
    );
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1500);
  });
  it('대칭 (a→b == b→a)', () => {
    const a = { lat: 37.5, lng: 127.0 };
    const b = { lat: 37.6, lng: 127.1 };
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 1);
  });
});

describe('formatDistance', () => {
  it('< 100m → "~100m"', () => {
    expect(formatDistance(50)).toBe('~100m');
    expect(formatDistance(99)).toBe('~100m');
  });
  it('< 1km → 50m bucket', () => {
    expect(formatDistance(123)).toBe('100m');
    expect(formatDistance(475)).toBe('500m'); // round-half-up
    expect(formatDistance(999)).toBe('1000m');
  });
  it('1~10km → 한 자리 소수', () => {
    expect(formatDistance(1234)).toBe('1.2km');
    expect(formatDistance(9876)).toBe('9.9km');
  });
  it('≥ 10km → 정수', () => {
    expect(formatDistance(12345)).toBe('12km');
    expect(formatDistance(100000)).toBe('100km');
  });
});
