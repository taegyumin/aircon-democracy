import { describe, it, expect } from 'vitest';
import { buildSubwayTrainPlace, buildSubwayPlatformPlace } from '../buildSubwayPlace';
import type { Station } from '@aircon/core';

describe('buildSubwayTrainPlace', () => {
  it('train-aware id when realtime match succeeded', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선',
      prev: '강남',
      next: '역삼',
      car: 4,
      trainMatch: { matched: true, trainNo: '2017', destination: '성수' },
    });
    expect(p.id).toBe('subway:train:2호선:2017:4');
    expect(p.name).toBe('2호선 2017번 열차 (성수행) 4호차');
    expect(p.type).toBe('subway');
    expect(p.detail).toContain('2017번 열차');
  });

  it('train-aware id with unknown car', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선',
      prev: '강남',
      next: '역삼',
      car: 'unknown',
      trainMatch: { matched: true, trainNo: '2017' },
    });
    expect(p.id).toBe('subway:train:2호선:2017:x');
    expect(p.name).toBe('2호선 2017번 열차');
  });

  it('falls back to segment id when not matched', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선',
      prev: '강남',
      next: '역삼',
      car: 4,
      trainMatch: { matched: false },
    });
    expect(p.id).toContain('2호선');
    expect(p.id).toContain('강남');
    expect(p.id).toContain('역삼');
    expect(p.id).not.toContain('subway:train:');
    expect(p.name).toBe('2호선 강남→역삼 4호차');
    expect(p.detail).toBe('2호선 · 강남→역삼 구간');
  });

  it('falls back to segment id when no match data', () => {
    const p = buildSubwayTrainPlace({
      line: '경의중앙선',
      prev: '용산',
      next: '이촌',
      car: 'unknown',
      trainMatch: null,
    });
    expect(p.name).toBe('경의중앙선 용산→이촌');
    expect(p.type).toBe('subway');
  });
});

describe('buildSubwayPlatformPlace', () => {
  it('platform id from station', () => {
    const station: Station = {
      id: 'st-gangnam',
      name: '강남',
      lines: ['2호선', '신분당선'],
      city: '서울',
      areas: ['강남구'],
    };
    const p = buildSubwayPlatformPlace({ station });
    expect(p.name).toBe('강남 승강장');
    expect(p.detail).toBe('2호선 · 신분당선');
    expect(p.district).toBe('서울 강남구');
    expect(p.type).toBe('subway');
  });

  it('district handles missing areas', () => {
    const station: Station = {
      id: 'st-x',
      name: '테스트역',
      lines: ['1호선'],
      city: '서울',
      areas: [],
    };
    const p = buildSubwayPlatformPlace({ station });
    expect(p.district).toBe('서울');
  });
});
