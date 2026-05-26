import { describe, it, expect } from 'vitest';
import { buildBusPlace } from '../buildBusPlace';

describe('buildBusPlace', () => {
  it('vehicle-precise when match.matched + vehId', () => {
    const p = buildBusPlace({
      routeName: '272',
      stopName: '신촌오거리',
      match: {
        matched: true,
        vehId: '107900172',
        plainNo: '서울74사1234',
        routeName: '272',
        currentStop: '신촌오거리',
        nextStop: '연세대학교',
      } as any,
    });
    expect(p.id).toBe('bus:vehicle:107900172');
    expect(p.name).toBe('272번 [차량 서울74사1234]');
    expect(p.detail).toBe('신촌오거리 지남');
    expect(p.type).toBe('bus');
  });

  it('falls back to route+stop when not matched', () => {
    const p = buildBusPlace({
      routeName: '5511',
      stopName: '관악구청',
      match: { matched: false, reason: 'no_vehicle_at_stop' },
    });
    expect(p.id).toBe('bus:5511:관악구청');
    expect(p.name).toBe('5511번 버스 (관악구청)');
    expect(p.detail).toBe('관악구청');
  });

  it('falls back to route-only when no stop', () => {
    const p = buildBusPlace({
      routeName: 'M7106',
      stopName: '',
      match: null,
    });
    expect(p.id).toBe('bus:M7106');
    expect(p.name).toBe('M7106번 버스');
    expect(p.detail).toBeUndefined();
  });

  it('trims whitespace from inputs', () => {
    const p = buildBusPlace({
      routeName: '  272  ',
      stopName: '  신촌  ',
      match: null,
    });
    expect(p.id).toBe('bus:272:신촌');
  });
});
