// 회귀 방지: 지하철 인접/분기 매칭. 동대문 ghost 버그 재발 방지 포함.

import { describe, it, expect } from 'vitest';
import { findSegments, neighborNames } from '../subwayGraph';
import rawAdjacency from '../data/subway-adjacency.json';
import rawStations from '../data/subway-stations.json';

describe('findSegments', () => {
  it('강남↔교대 = 2호선/신분당선', () => {
    const segs = findSegments('강남', '교대');
    const lines = segs.map((s) => s.line);
    expect(lines).toContain('2호선');
  });

  it('서울 2호선의 강남→교대 1개 segment', () => {
    const segs = findSegments('강남', '교대', '서울');
    expect(segs.filter((s) => s.line === '2호선').length).toBe(1);
  });

  it('비인접 = 빈 결과 (강남↔잠실)', () => {
    expect(findSegments('강남', '잠실', '서울')).toEqual([]);
  });

  it('동대문역사문화공원 ghost 버그 회귀: 정상 이름이 매칭됨', () => {
    // 옛 버그: adjacency에 "문화공원동대문역사" 깨진 이름만 있어서
    // 정상 이름 "동대문역사문화공원"으로는 매칭 안 됐음.
    const segs = findSegments('동대문역사문화공원', '신당', '서울');
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.some((s) => s.line === '2호선')).toBe(true);
  });

  it('"역" suffix tolerant', () => {
    const a = findSegments('강남', '교대');
    const b = findSegments('강남역', '교대역');
    expect(a.length).toBe(b.length);
  });
});

describe('neighborNames', () => {
  it('강남의 인접 = 역삼역, 교대역 (2호선 외선/내선, "역" suffix 포함)', () => {
    const n = new Set(neighborNames('강남'));
    expect(n.has('역삼역')).toBe(true);
    expect(n.has('교대역')).toBe(true);
  });

  it('비존재 역 = 빈 결과', () => {
    expect(neighborNames('없는역')).toEqual([]);
  });
});

describe('data integrity', () => {
  it('subway-adjacency.json에 깨진 이름 (문화공원동대문역사) 없음', () => {
    const bad = rawAdjacency.filter(
      (e: { from: string; to: string }) =>
        e.from.includes('문화공원동대문역사') || e.to.includes('문화공원동대문역사'),
    );
    expect(bad).toHaveLength(0);
  });

  it('subway-stations.json에 ghost 이름 (문화공원동대문역사역) 없음', () => {
    const bad = (rawStations as Array<{ name: string }>).filter((s) =>
      s.name.includes('문화공원동대문역사'),
    );
    expect(bad).toHaveLength(0);
  });

  it('모든 adjacency station name은 stations에 존재 (orphan 검출)', () => {
    const known = new Set(
      (rawStations as Array<{ name: string }>).flatMap((s) => [
        s.name,
        s.name.replace(/역$/, ''),
      ]),
    );
    const orphans = new Set<string>();
    for (const e of rawAdjacency as Array<{ from: string; to: string }>) {
      if (!known.has(e.from) && !known.has(e.from + '역')) orphans.add(e.from);
      if (!known.has(e.to) && !known.has(e.to + '역')) orphans.add(e.to);
    }
    // orphan이 있으면 dead reference. 이 테스트는 미래의 ghost 회귀를 잡음.
    expect(Array.from(orphans)).toEqual([]);
  });
});
