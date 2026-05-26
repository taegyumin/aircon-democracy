// 회귀 방지: 역 검색 (chosung 한글초성, 부분일치, line filter, 도시 우선).

import { describe, it, expect } from 'vitest';
import { searchStations, toChosung, lineColor } from '../subway';

describe('toChosung (한글 초성 분리)', () => {
  it('완전 한글', () => {
    expect(toChosung('강남')).toBe('ㄱㄴ');
    expect(toChosung('동대문역사문화공원')).toBe('ㄷㄷㅁㅇㅅㅁㅎㄱㅇ');
  });
  it('이미 초성', () => {
    expect(toChosung('ㄱㄴ')).toBe('ㄱㄴ');
  });
  it('영문/숫자 통과', () => {
    expect(toChosung('GTX')).toBe('GTX');
  });
});

describe('searchStations', () => {
  it('정확 매칭 (강남)', () => {
    const r = searchStations({ query: '강남', limit: 5 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((s) => s.name === '강남역')).toBe(true);
  });
  it('초성 매칭 (ㄱㄴ → 강남 포함)', () => {
    const r = searchStations({ query: 'ㄱㄴ', limit: 20 });
    expect(r.some((s) => s.name === '강남역')).toBe(true);
  });
  it('부분 일치 (동대문 → 동대문역사문화공원역 포함)', () => {
    const r = searchStations({ query: '동대문역사', limit: 10 });
    expect(r.some((s) => s.name === '동대문역사문화공원역')).toBe(true);
  });
  it('빈 query → 전체 list slice (limit 적용)', () => {
    const r = searchStations({ query: '', limit: 5 });
    expect(r.length).toBeLessThanOrEqual(5);
  });
  it('도시 필터 (서울만)', () => {
    const r = searchStations({ query: '교대', city: '서울', limit: 10 });
    expect(r.every((s) => s.city === '서울')).toBe(true);
  });
});

describe('lineColor', () => {
  it('알려진 노선들에 색 매핑', () => {
    expect(lineColor('1호선')).toMatch(/^#[0-9A-F]{6}$/i);
    expect(lineColor('2호선')).toMatch(/^#[0-9A-F]{6}$/i);
    expect(lineColor('9호선')).toMatch(/^#[0-9A-F]{6}$/i);
  });
  it('미지정 노선도 fallback hex 색 반환', () => {
    expect(lineColor('GTX-Z')).toMatch(/^#[0-9A-F]{3,6}$/i);
  });
});
