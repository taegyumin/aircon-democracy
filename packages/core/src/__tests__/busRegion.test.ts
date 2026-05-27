// 회귀 방지: regionByName 매핑. NCP reverse-geocode 응답이 우리 cityCode와 호환되어야 함.

import { describe, it, expect } from 'vitest';
import { regionByName, SEOUL_REGION, CITY_CODES } from '../busRegion';

describe('regionByName', () => {
  it('서울특별시 → SEOUL_REGION sentinel', () => {
    expect(regionByName('서울특별시')).toBe(SEOUL_REGION);
    expect(regionByName('서울')).toBe(SEOUL_REGION);
    expect(regionByName('Seoul')).toBe(SEOUL_REGION);
  });

  it('광역시 정확 일치 → cityCode 숫자', () => {
    expect(regionByName('부산광역시')).toBe(21);
    expect(regionByName('대구광역시')).toBe(22);
    expect(regionByName('인천광역시')).toBe(23);
    expect(regionByName('광주광역시')).toBe(24);
    expect(regionByName('울산광역시')).toBe(26);
    expect(regionByName('세종특별시')).toBe(12);
  });

  it('광역시 prefix 매칭 (NCP가 "부산" 같이 짧게 줄 때)', () => {
    expect(regionByName('부산')).toBe(21);
    expect(regionByName('대구')).toBe(22);
  });

  it('경기도 시·군 정확 일치 → cityCode 5자리', () => {
    expect(regionByName('수원시')).toBe(31010);
    expect(regionByName('성남시')).toBe(31020);
    expect(regionByName('고양시')).toBe(31100);
    expect(regionByName('용인시')).toBe(31190);
  });

  it('빈/unmatched 입력 → null', () => {
    expect(regionByName('')).toBe(null);
    expect(regionByName('   ')).toBe(null);
    expect(regionByName('알수없는도시')).toBe(null);
  });

  it('대전광역시 prefix가 "대전광역시/계룡시" 합쳐진 코드와 매칭', () => {
    // NCP가 "대전광역시" 또는 "대전" 줄 수 있고, 둘 다 매칭되어야.
    expect(regionByName('대전광역시')).toBe(25);
    expect(regionByName('대전')).toBe(25);
  });

  it('합쳐진 이름의 alias도 매칭 (LLM P2 회귀 방지)', () => {
    // "원주시/횡성군"의 두 번째 alias "횡성군"이 단독 entry 없어 합쳐진 코드에 매칭.
    expect(regionByName('횡성군')).toBe(32020);
    expect(regionByName('횡성')).toBe(32020);
    // 주의: "계룡시"는 충남에 단독 entry(34070) 있어 alias 우선순위가 정확 일치로 그쪽.
    // 둘 다 valid한 cityCode라 어느 쪽이든 TAGO API가 답함. 단독 entry 우선이 일관.
    expect(regionByName('계룡시')).toBe(34070);
  });
});

describe('CITY_CODES data integrity', () => {
  it('서울(11)은 TAGO list에 없음 — Seoul 분기는 sentinel만 사용', () => {
    expect(CITY_CODES.find((c) => c.code === 11)).toBeUndefined();
  });

  it('광역시 8개 모두 (광역시 + 세종 + 제주) 포함', () => {
    const codes = new Set(CITY_CODES.map((c) => c.code));
    expect(codes.has(12)).toBe(true); // 세종
    expect(codes.has(21)).toBe(true); // 부산
    expect(codes.has(22)).toBe(true); // 대구
    expect(codes.has(23)).toBe(true); // 인천
    expect(codes.has(24)).toBe(true); // 광주
    expect(codes.has(25)).toBe(true); // 대전
    expect(codes.has(26)).toBe(true); // 울산
    expect(codes.has(39)).toBe(true); // 제주
  });

  it('경기도 시·군 31xxx, 강원도 32xxx 등 prefix가 올바름', () => {
    const gyeonggi = CITY_CODES.filter((c) => c.code >= 31000 && c.code < 32000);
    expect(gyeonggi.length).toBeGreaterThanOrEqual(30);
    const gangwon = CITY_CODES.filter((c) => c.code >= 32000 && c.code < 33000);
    expect(gangwon.length).toBeGreaterThanOrEqual(5);
  });
});
