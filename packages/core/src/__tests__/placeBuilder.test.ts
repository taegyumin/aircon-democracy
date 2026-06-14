// 회귀 방지: placeId 빌더 — vote bucket 무결성의 핵심.
// web+mobile wizard가 공유. 매칭/fallback 분기와 id 네임스페이스가 어긋나면
// 서로 다른 차량/노선/지역 투표가 같은 bucket으로 섞임 (데이터 무결성 위반).
// 과거 회귀 #94(vehId에 routeId 포함), #115(fallback에 region+routeId 포함)를 박는다.

import { describe, it, expect } from 'vitest';
import { buildSubwayTrainPlace } from '../buildSubwayPlace';
import { buildBusPlace } from '../buildBusPlace';
import { segmentPlaceId } from '../subwayGraph';
import type { BusMatchResult } from '../api';

describe('buildSubwayTrainPlace', () => {
  it('실시간 매칭 + 호차 → 차량 단위 id (subway:train:...)', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 3,
      trainMatch: { matched: true, trainNo: '2034', destination: '성수' },
    });
    expect(p.id).toBe('subway:train:2호선:2034:3');
    expect(p.type).toBe('subway');
    expect(p.name).toContain('3호차');
    expect(p.name).toContain('성수행');
  });

  it("호차 모름 → id의 car 파트는 'x', name엔 호차 없음", () => {
    const p = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 'unknown',
      trainMatch: { matched: true, trainNo: '2034' },
    });
    expect(p.id).toBe('subway:train:2호선:2034:x');
    expect(p.name).not.toContain('호차');
  });

  it('매칭 실패 → segment fallback (공유 segmentPlaceId와 동일)', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 3,
      trainMatch: { matched: false },
    });
    expect(p.id).toBe(segmentPlaceId('2호선', '강남', '역삼', 3));
    expect(p.id.startsWith('subway:seg:')).toBe(true);
  });

  it('matched=true지만 trainNo 없으면 segment fallback (반쪽 매칭 방지)', () => {
    const p = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 3,
      trainMatch: { matched: true },
    });
    expect(p.id).toBe(segmentPlaceId('2호선', '강남', '역삼', 3));
  });

  it('불변식: 매칭/실패 bucket은 절대 같은 id가 아니다', () => {
    const matched = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 3,
      trainMatch: { matched: true, trainNo: '2034' },
    });
    const fallback = buildSubwayTrainPlace({
      line: '2호선', prev: '강남', next: '역삼', car: 3, trainMatch: null,
    });
    expect(matched.id).not.toBe(fallback.id);
  });
});

const match = (over: Partial<BusMatchResult>): BusMatchResult => ({ matched: true, ...over });

describe('buildBusPlace', () => {
  it('매칭 차량 → bus:vehicle:{region}:{routeId}:{vehId}', () => {
    const p = buildBusPlace({
      routeName: '272', stopName: '신촌오거리',
      match: match({ vehId: '7001', plainNo: '서울70사1234', routeId: '100100118', routeName: '272', currentStop: '신촌오거리' }),
      region: 'seoul',
    });
    expect(p.id).toBe('bus:vehicle:seoul:100100118:7001');
    expect(p.type).toBe('bus');
  });

  it('#94 회귀: 같은 vehId라도 routeId 다르면 bucket 분리', () => {
    const a = buildBusPlace({ routeName: '272', stopName: '', match: match({ vehId: 'V1', routeId: 'R-A' }) });
    const b = buildBusPlace({ routeName: '272', stopName: '', match: match({ vehId: 'V1', routeId: 'R-B' }) });
    expect(a.id).not.toBe(b.id);
  });

  it('#115 회귀: fallback은 region을 포함 — 서울 10번 vs 부산 10번 분리', () => {
    const seoul = buildBusPlace({ routeName: '10', stopName: '시청', match: null, region: 'seoul' });
    const busan = buildBusPlace({ routeName: '10', stopName: '시청', match: null, region: '21' });
    expect(seoul.id).not.toBe(busan.id);
    expect(seoul.id).toContain(':seoul:');
    expect(busan.id).toContain(':21:');
  });

  it('fallback은 routeId가 있으면 routeName 대신 routeId로 — 양방향/지선 분리', () => {
    const p = buildBusPlace({ routeName: '6', stopName: '강남역', match: null, routeId: '4930006', region: 'seoul' });
    expect(p.id).toBe('bus:seoul:4930006:stop:강남역');
  });

  it('region 미지정이면 seoul default (legacy 호환)', () => {
    const p = buildBusPlace({ routeName: '271', stopName: '', match: null });
    expect(p.id).toBe('bus:seoul:271');
  });

  it('정류장 없으면 :stop: 파트 없음', () => {
    const p = buildBusPlace({ routeName: '271', stopName: '   ', match: null, region: 'seoul' });
    expect(p.id).toBe('bus:seoul:271');
  });

  it('idSafe: 공백·콜론은 id에서 제거', () => {
    const p = buildBusPlace({ routeName: '강남 02', stopName: '역삼:1번', match: null, region: 'seoul' });
    expect(p.id).toBe('bus:seoul:강남02:stop:역삼1번');
  });
});
