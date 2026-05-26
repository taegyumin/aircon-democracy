import { describe, it, expect } from 'vitest';
import { freshenBusMatch, type BusMatchWithInput } from '../useBusMatch';

// 회귀 시나리오 (P1):
// 1. 사용자가 272/신촌 → tryMatch 호출
// 2. 응답 도착 전에 입력을 5511/관악으로 바꿈 (reset() 호출됨)
// 3. 그런데 272 응답이 늦게 도착해서 match에 박힘 (hook의 seq guard 실패한 경우 가정)
// 4. 사용자가 "투표하기" 누르면 → buildBusPlace가 stale 272 vehicle로 place 생성
//
// freshenBusMatch가 두 번째 안전망. hook이 실패해도 builder는 stale match를 못 본다.

function makeMatch(routeName: string, stopName: string, partial: Partial<BusMatchWithInput> = {}): BusMatchWithInput {
  return {
    matched: true,
    vehId: 'V-272-001',
    plainNo: '서울74사1234',
    routeName: '272',
    currentStop: '신촌오거리',
    ...partial,
    input: { routeName, stopName },
  };
}

describe('freshenBusMatch', () => {
  it('returns match when input matches exactly', () => {
    const m = makeMatch('272', '신촌오거리');
    expect(freshenBusMatch(m, '272', '신촌오거리')).toBe(m);
  });

  it('returns null when routeName changed (stale)', () => {
    const m = makeMatch('272', '신촌오거리');
    expect(freshenBusMatch(m, '5511', '신촌오거리')).toBeNull();
  });

  it('returns null when stopName changed (stale)', () => {
    const m = makeMatch('272', '신촌오거리');
    expect(freshenBusMatch(m, '272', '관악구청')).toBeNull();
  });

  it('returns null when both changed (race scenario)', () => {
    const m = makeMatch('272', '신촌오거리');
    expect(freshenBusMatch(m, '5511', '관악구청')).toBeNull();
  });

  it('trims current input before comparing (typing whitespace ≠ staleness)', () => {
    const m = makeMatch('272', '신촌오거리');
    expect(freshenBusMatch(m, '  272  ', '  신촌오거리  ')).toBe(m);
  });

  it('returns null when match is null', () => {
    expect(freshenBusMatch(null, '272', '신촌')).toBeNull();
  });

  it('also guards non-matched results (no_vehicle_at_stop reason should not leak across inputs)', () => {
    const m: BusMatchWithInput = {
      matched: false,
      reason: 'no_vehicle_at_stop',
      input: { routeName: '272', stopName: '신촌오거리' },
    };
    expect(freshenBusMatch(m, '5511', '관악')).toBeNull();
    expect(freshenBusMatch(m, '272', '신촌오거리')).toBe(m);
  });
});
