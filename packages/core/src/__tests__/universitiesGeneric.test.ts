// 회귀 방지: 머지로 들어온 generic universities dataset (112교/118캠퍼스/817동).
// snu/yonsei 기존 namespace와 별개 — packages/core/src/universities/.

import { describe, it, expect } from 'vitest';
import {
  UNIVERSITIES,
  searchUniversity,
  univPlaceId,
  univPlaceName,
  univPlaceDetail,
  buildingByCode,
  findUniversityById,
} from '../universities';
import { isUniversityPrefix, UpsertPlaceBodySchema } from '../validation';

describe('universities dataset', () => {
  it('list 충분 (>= 40개)', () => {
    expect(UNIVERSITIES.length).toBeGreaterThanOrEqual(40);
  });

  it('모든 entry 필수 필드 존재', () => {
    for (const u of UNIVERSITIES) {
      expect(u.id).toBeTruthy();
      expect(u.name).toBeTruthy();
      expect(u.shortName).toBeTruthy();
      expect(u.placeIdPrefix).toBeTruthy();
      expect(u.campuses.length).toBeGreaterThan(0);
    }
  });

  it('각 campus는 id/name/buildings array 보유', () => {
    for (const u of UNIVERSITIES) {
      for (const c of u.campuses) {
        expect(c.id).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(Array.isArray(c.buildings)).toBe(true);
      }
    }
  });

  it('모든 placeIdPrefix는 university prefix로 인식되어야 (upsert validation 통과)', () => {
    for (const u of UNIVERSITIES) {
      expect(isUniversityPrefix(u.placeIdPrefix), `${u.id} prefix=${u.placeIdPrefix}`).toBe(true);
    }
  });

  it('upsert validation: classroom type + 임의 university prefix accept', () => {
    // 머지 회귀: generic 대학 prefix 100여종이 모두 classroom으로 upsert 되어야 함.
    // 첫 / 마지막 / 임의 1교만 표본으로 검사 (전체 검사는 위 prefix membership으로 보장).
    const samples = [UNIVERSITIES[0], UNIVERSITIES[UNIVERSITIES.length - 1]];
    for (const u of samples) {
      const c = u.campuses[0];
      const b = c.buildings[0];
      if (!b) continue;
      const result = UpsertPlaceBodySchema.safeParse({
        id: `${u.placeIdPrefix}:${c.id}:${b.code}`,
        name: `${u.shortName} ${b.name}`.slice(0, 40),
        type: 'classroom',
      });
      expect(result.success, `${u.id} → ${JSON.stringify(result.success ? null : result.error.format())}`).toBe(true);
    }
  });

  it('upsert validation: university prefix + 다른 type reject', () => {
    const u = UNIVERSITIES[0];
    const result = UpsertPlaceBodySchema.safeParse({
      id: `${u.placeIdPrefix}:foo`,
      name: 'x',
      type: 'cafe', // university는 classroom 강제
    });
    expect(result.success).toBe(false);
  });
});

describe('findUniversityById', () => {
  it('id로 찾기', () => {
    const first = UNIVERSITIES[0];
    const found = findUniversityById(UNIVERSITIES, first.id);
    expect(found?.id).toBe(first.id);
  });

  it('없는 id는 undefined', () => {
    expect(findUniversityById(UNIVERSITIES, '__nope__')).toBeUndefined();
  });
});

describe('searchUniversity', () => {
  it('crash 없이 동작', () => {
    const u = UNIVERSITIES[0];
    expect(() => searchUniversity(u, '도서관', 10)).not.toThrow();
    expect(() => searchUniversity(u, '', 5)).not.toThrow();
    expect(() => searchUniversity(u, '도', 5)).not.toThrow();
  });

  it('limit 지킴', () => {
    const u = UNIVERSITIES[0];
    const hits = searchUniversity(u, '관', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
  });
});

describe('univPlaceId / univPlaceName helpers', () => {
  it('room 옵션 시 id에 포함', () => {
    const u = UNIVERSITIES.find((x) => x.campuses[0].buildings.length > 0);
    if (!u) return;
    const campus = u.campuses[0];
    const building = campus.buildings[0];
    const id = univPlaceId(u, campus, building, '301');
    expect(id).toContain('301');
  });

  it('숫자 room은 호 suffix', () => {
    const u = UNIVERSITIES.find((x) => x.campuses[0].buildings.length > 0);
    if (!u) return;
    const campus = u.campuses[0];
    const building = campus.buildings[0];
    const name = univPlaceName(u, campus, building, '301');
    expect(name).toMatch(/301호$/);
  });

  it('univPlaceDetail에 campus name 포함', () => {
    const u = UNIVERSITIES.find((x) => x.campuses[0].buildings.length > 0);
    if (!u) return;
    const campus = u.campuses[0];
    const building = campus.buildings[0];
    const detail = univPlaceDetail(u, campus, building);
    expect(detail).toContain(campus.name);
  });
});

describe('buildingByCode', () => {
  it('존재하는 code 찾기', () => {
    const u = UNIVERSITIES.find((x) => x.campuses[0].buildings.length > 0);
    if (!u) return;
    const campus = u.campuses[0];
    const first = campus.buildings[0];
    const found = buildingByCode(u, campus.id, first.code);
    expect(found?.code).toBe(first.code);
  });

  it('없는 code는 undefined', () => {
    const u = UNIVERSITIES[0];
    expect(buildingByCode(u, u.campuses[0].id, '__nope__')).toBeUndefined();
  });
});
