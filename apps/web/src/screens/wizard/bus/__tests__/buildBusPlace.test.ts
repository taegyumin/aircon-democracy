import { describe, it, expect } from 'vitest';
import { buildBusPlace } from '../buildBusPlace';

describe('buildBusPlace', () => {
  it('vehicle-precise when match.matched + vehId (routeId in id key)', () => {
    const p = buildBusPlace({
      routeName: '272',
      stopName: '신촌오거리',
      match: {
        matched: true,
        vehId: '107900172',
        plainNo: '서울74사1234',
        routeId: '100100027',
        routeName: '272',
        currentStop: '신촌오거리',
        nextStop: '연세대학교',
      } as any,
    });
    expect(p.id).toBe('bus:vehicle:100100027:107900172');
    expect(p.name).toBe('272번 [차량 서울74사1234]');
    expect(p.detail).toBe('신촌오거리 지남');
    expect(p.type).toBe('bus');
  });

  // 회귀: 같은 vehId가 다른 routeId일 때 id가 충돌하면 안 됨.
  // data.go.kr vehId는 차량 영구 ID (노선 바뀌어도 그대로). 한 bucket에
  // 다른 노선 vote가 섞이면 place name이 "<route>번"으로 노선 표시라
  // 사용자 기대와 다름.
  it('같은 vehId라도 routeId 다르면 별도 bucket', () => {
    const m272 = buildBusPlace({
      routeName: '272', stopName: '신촌',
      match: { matched: true, vehId: 'V1', routeId: 'R272' } as any,
    });
    const m5511 = buildBusPlace({
      routeName: '5511', stopName: '관악',
      match: { matched: true, vehId: 'V1', routeId: 'R5511' } as any,
    });
    expect(m272.id).not.toBe(m5511.id);
  });

  // routeId가 없으면 routeName으로 fallback. 그것도 없으면 사용자 입력 route.
  it('routeId 없으면 routeName으로 fallback', () => {
    const p = buildBusPlace({
      routeName: '272', stopName: '신촌',
      match: { matched: true, vehId: 'V1', routeName: '272' } as any,
    });
    expect(p.id).toBe('bus:vehicle:272:V1');
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
