// 회귀 방지: subway-stations.json / subway-adjacency.json 데이터 무결성.
// typo 중복(에버라인 자동완성 깨짐 사고) 사후 도입.

import { describe, it, expect } from 'vitest';
import stationsRaw from '../data/subway-stations.json';
import adjacencyRaw from '../data/subway-adjacency.json';

interface Station {
  name: string;
  city: string;
  lines: string[];
}
interface AdjEdge {
  from: string;
  to: string;
  line: string;
  city: string;
}

const stations = stationsRaw as Station[];
const adjacency = adjacencyRaw as AdjEdge[];

const variants = (name: string): string[] => {
  const out = [name];
  if (name.endsWith('역')) out.push(name.slice(0, -1));
  return out;
};

const normForDup = (s: string): string => s.replace(/[·,\s]+/g, '');

describe('subway data integrity', () => {
  it('typo 중복 0건: 같은 (city, normalized name)에 두 가지 표기 금지', () => {
    const bucket = new Map<string, Set<string>>();
    for (const s of stations) {
      const key = `${s.city}|${normForDup(s.name)}`;
      const set = bucket.get(key) ?? new Set();
      set.add(s.name);
      bucket.set(key, set);
    }
    const dups: Array<{ key: string; names: string[] }> = [];
    for (const [key, names] of bucket) {
      if (names.size > 1) dups.push({ key, names: [...names] });
    }
    expect(dups).toEqual([]);
  });

  it('orphan edge 0건: adjacency의 from/to 모두 stations에 존재', () => {
    const stationKeys = new Set<string>();
    for (const s of stations) {
      for (const v of variants(s.name)) stationKeys.add(`${s.city}|${v}`);
    }
    const orphans: Array<{ city: string; name: string; line: string }> = [];
    for (const e of adjacency) {
      for (const side of ['from', 'to'] as const) {
        const key = `${e.city}|${e[side]}`;
        if (!stationKeys.has(key)) orphans.push({ city: e.city, name: e[side], line: e.line });
      }
    }
    expect(orphans).toEqual([]);
  });

  it('stations.lines 무결성: edge.line은 양끝 station의 lines에 포함', () => {
    const stationLines = new Map<string, Set<string>>();
    for (const s of stations) {
      for (const v of variants(s.name)) stationLines.set(`${s.city}|${v}`, new Set(s.lines));
    }
    const missing: Array<{ city: string; name: string; line: string }> = [];
    for (const e of adjacency) {
      for (const side of ['from', 'to'] as const) {
        const key = `${e.city}|${e[side]}`;
        const lines = stationLines.get(key);
        if (lines && !lines.has(e.line)) missing.push({ city: e.city, name: e[side], line: e.line });
      }
    }
    expect(missing).toEqual([]);
  });

  it('station name 일관성: 모두 "역"으로 끝남', () => {
    const noSuffix = stations.filter((s) => !s.name.endsWith('역')).map((s) => `${s.city}/${s.name}`);
    expect(noSuffix).toEqual([]);
  });

  it('city 화이트리스트', () => {
    const allowed = new Set(['서울', '부산', '대구', '광주', '대전', '인천']);
    const bad = stations.filter((s) => !allowed.has(s.city)).map((s) => `${s.city}/${s.name}`);
    expect(bad).toEqual([]);
  });
});
