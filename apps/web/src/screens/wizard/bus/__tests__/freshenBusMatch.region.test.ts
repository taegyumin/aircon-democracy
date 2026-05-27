// 회귀 방지: freshenBusMatch에 region/routeId 비교 추가 (2026-05-27 P1 fix).
// 사용자가 region 변경 후 동일 routeName 입력 시 stale match가 fresh로 잡혀 잘못된
// bucket으로 vote 가는 race를 막음.

import { describe, it, expect } from 'vitest';
import { freshenBusMatch, type BusMatchWithInput } from '../useBusMatch';

const baseMatch = (overrides: Partial<BusMatchWithInput['input']>): BusMatchWithInput => ({
  matched: true,
  vehId: 'V1',
  plainNo: '서울74사1234',
  routeId: 'R272',
  routeName: '272',
  currentStop: '신촌',
  input: { routeName: '272', stopName: '신촌', region: 'seoul', routeId: 'R272', ...overrides },
});

describe('freshenBusMatch — region/routeId 비교', () => {
  it('동일 input — fresh return', () => {
    const m = baseMatch({});
    const result = freshenBusMatch(m, '272', '신촌', 'seoul', 'R272');
    expect(result).toBe(m);
  });

  it('region 다르면 stale (서울 ↔ 부산)', () => {
    const m = baseMatch({ region: 'seoul' });
    const result = freshenBusMatch(m, '272', '신촌', '21', 'R272');
    expect(result).toBe(null);
  });

  it('routeId 다르면 stale (같은 번호 양방향)', () => {
    const m = baseMatch({ routeId: 'R272-up' });
    const result = freshenBusMatch(m, '272', '신촌', 'seoul', 'R272-down');
    expect(result).toBe(null);
  });

  it('routeName / stopName 다르면 stale (기존 동작 유지)', () => {
    const m = baseMatch({});
    expect(freshenBusMatch(m, '5511', '신촌', 'seoul', 'R272')).toBe(null);
    expect(freshenBusMatch(m, '272', '다른정류장', 'seoul', 'R272')).toBe(null);
  });

  it('region/routeId optional — 명시 안 하면 비교 skip (legacy 호출자 호환)', () => {
    const m = baseMatch({ region: 'seoul', routeId: 'R272' });
    const result = freshenBusMatch(m, '272', '신촌');
    expect(result).toBe(m);
  });

  it('match가 null이면 null', () => {
    expect(freshenBusMatch(null, '272', '신촌', 'seoul', 'R272')).toBe(null);
  });
});
