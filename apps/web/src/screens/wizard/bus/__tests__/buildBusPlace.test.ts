import { describe, it, expect } from 'vitest';
import { buildBusPlace } from '../buildBusPlace';
import type { BusMatchResult } from '@aircon/core';

// 2026-05-27 LLM P1: placeId에 region이 포함되어 "서울 10번 / 부산 10번" bucket 분리.
// region 미지정 시 'seoul' default — legacy 호환.

describe('buildBusPlace', () => {
  it('vehicle-precise when match.matched + vehId (region + routeId in id key)', () => {
    const p = buildBusPlace({
      routeName: '272', stopName: '신촌오거리',
      region: 'seoul',
      match: {
        matched: true,
        vehId: '107900172', plainNo: '서울74사1234',
        routeId: '100100027', routeName: '272',
        currentStop: '신촌오거리', nextStop: '연세대학교',
      } as BusMatchResult,
    });
    expect(p.id).toBe('bus:vehicle:seoul:100100027:107900172');
    expect(p.name).toBe('272번 [차량 서울74사1234]');
    expect(p.detail).toBe('신촌오거리 지남');
    expect(p.type).toBe('bus');
  });

  it('같은 vehId라도 routeId 다르면 별도 bucket', () => {
    const m272 = buildBusPlace({
      routeName: '272', stopName: '신촌',
      match: { matched: true, vehId: 'V1', routeId: 'R272' } as BusMatchResult,
    });
    const m5511 = buildBusPlace({
      routeName: '5511', stopName: '관악',
      match: { matched: true, vehId: 'V1', routeId: 'R5511' } as BusMatchResult,
    });
    expect(m272.id).not.toBe(m5511.id);
  });

  it('routeId 없으면 routeName으로 fallback', () => {
    const p = buildBusPlace({
      routeName: '272', stopName: '신촌',
      match: { matched: true, vehId: 'V1', routeName: '272' } as BusMatchResult,
    });
    expect(p.id).toBe('bus:vehicle:seoul:272:V1');
  });

  it('falls back to route+stop when not matched (region+routeId 포함)', () => {
    const p = buildBusPlace({
      routeName: '5511', stopName: '관악구청',
      region: 'seoul', routeId: '100200055',
      match: { matched: false, reason: 'no_vehicle_at_stop' } as BusMatchResult,
    });
    expect(p.id).toBe('bus:seoul:100200055:stop:관악구청');
    expect(p.name).toBe('5511번 버스 (관악구청)');
    expect(p.detail).toBe('관악구청');
  });

  it('falls back to route-only when no stop', () => {
    const p = buildBusPlace({
      routeName: 'M7106', stopName: '', match: null,
    });
    expect(p.id).toBe('bus:seoul:M7106');
    expect(p.name).toBe('M7106번 버스');
    expect(p.detail).toBeUndefined();
  });

  it('trims whitespace from inputs', () => {
    const p = buildBusPlace({
      routeName: '  272  ', stopName: '  신촌  ', match: null,
    });
    expect(p.id).toBe('bus:seoul:272:stop:신촌');
  });

  // 핵심 회귀: region 다르면 같은 routeName/stop이라도 bucket 분리.
  it('서울 10번 ↔ 부산 10번 bucket 분리 (LLM P1 회귀 방지)', () => {
    const seoul = buildBusPlace({
      routeName: '10', stopName: '시청', region: 'seoul', match: null,
    });
    const busan = buildBusPlace({
      routeName: '10', stopName: '시청', region: '21', match: null,
    });
    expect(seoul.id).not.toBe(busan.id);
    expect(seoul.id).toBe('bus:seoul:10:stop:시청');
    expect(busan.id).toBe('bus:21:10:stop:시청');
  });

  it('같은 region + 같은 routeName이라도 routeId 다르면 분리 (양방향/지선)', () => {
    const a = buildBusPlace({
      routeName: '271', stopName: '광화문', region: 'seoul', routeId: '100100023', match: null,
    });
    const b = buildBusPlace({
      routeName: '271', stopName: '광화문', region: 'seoul', routeId: '100100024', match: null,
    });
    expect(a.id).not.toBe(b.id);
  });
});
