// API boundary validation 회귀 방지.

import { describe, it, expect } from 'vitest';
import {
  PlaceTypeSchema,
  VoteTypeSchema,
  UpsertPlaceBodySchema,
  PostVoteBodySchema,
  SubwayMatchBodySchema,
  BusMatchBodySchema,
  parseBody,
} from '../validation';

describe('PlaceTypeSchema', () => {
  it('알려진 type 통과', () => {
    expect(PlaceTypeSchema.safeParse('subway').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('train').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('bus').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('cafe').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('classroom').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('library').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('office').success).toBe(true);
    expect(PlaceTypeSchema.safeParse('other').success).toBe(true);
  });
  it('미지원 type 차단', () => {
    expect(PlaceTypeSchema.safeParse('park').success).toBe(false);
    expect(PlaceTypeSchema.safeParse('').success).toBe(false);
    expect(PlaceTypeSchema.safeParse(123).success).toBe(false);
  });
});

describe('VoteTypeSchema', () => {
  it('cold/ok/hot 통과', () => {
    expect(VoteTypeSchema.safeParse('cold').success).toBe(true);
    expect(VoteTypeSchema.safeParse('ok').success).toBe(true);
    expect(VoteTypeSchema.safeParse('hot').success).toBe(true);
  });
  it('다른 값 차단', () => {
    expect(VoteTypeSchema.safeParse('lukewarm').success).toBe(false);
    expect(VoteTypeSchema.safeParse(null).success).toBe(false);
  });
});

describe('UpsertPlaceBodySchema', () => {
  it('정상 케이스', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:강남:2호선,신분당선',
      name: '강남역',
      type: 'subway',
    });
    expect(r.success).toBe(true);
  });
  it('id prefix가 type과 다르면 거부', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:fake',
      name: 'fake',
      type: 'other',
    });
    expect(r.success).toBe(false);
  });
  it('빈 name 거부', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: '',
      type: 'subway',
    });
    expect(r.success).toBe(false);
  });
  it('id 형식 위반 거부 (특수문자)', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test<script>',
      name: 'test',
      type: 'subway',
    });
    expect(r.success).toBe(false);
  });
  it('한글 name 통과', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:강남:2호선',
      name: '강남역',
      type: 'subway',
    });
    expect(r.success).toBe(true);
  });
  // 회귀: 길이 제한은 prod DB 제약과 같아야 함 (name 2~40, detail 80, district 60).
  // 이전에는 name 120 / detail 240으로 느슨해서 server _abuse.ts가 다시 좁히는 drift.
  it('name 40자 초과 거부 (prod 제한)', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: 'a'.repeat(41),
      type: 'subway',
    });
    expect(r.success).toBe(false);
  });
  it('name 2자 미만 거부 (prod 제한)', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: 'x',
      type: 'subway',
    });
    expect(r.success).toBe(false);
  });
  it('detail 80자 초과 거부', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: 'OK',
      type: 'subway',
      detail: 'a'.repeat(81),
    });
    expect(r.success).toBe(false);
  });
  it('district 60자 초과 거부', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: 'OK',
      type: 'subway',
      district: 'a'.repeat(61),
    });
    expect(r.success).toBe(false);
  });
  it('detail 80자 통과', () => {
    const r = UpsertPlaceBodySchema.safeParse({
      id: 'subway:test',
      name: 'OK',
      type: 'subway',
      detail: 'a'.repeat(80),
    });
    expect(r.success).toBe(true);
  });

  // 회귀: prefix는 type과 1:1이 아님. snu/yonsei는 classroom, venue는 other.
  // 이전 buggy refine은 startsWith(type+':')로 강제해서 강의실/카페 흐름 전부
  // 400으로 막혔음 (prod 버그 LLM 리뷰 P1, 2026-05-26).
  describe('id prefix → type 매핑 (실제 wizard 흐름)', () => {
    it('snu: + classroom 통과 (서울대 강의실)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'snu:관악:301:402', name: '서울대 시뮬레이션', type: 'classroom',
      }).success).toBe(true);
    });
    it('yonsei: + classroom 통과 (연세대 강의실)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'yonsei:신촌:122', name: '연세대 백양관', type: 'classroom',
      }).success).toBe(true);
    });
    it('venue: + other 통과 (네이버 지도 카페)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'venue:gps:37.4980:127.0280', name: '스타벅스 강남대로점', type: 'other',
      }).success).toBe(true);
    });
    it('bus:vehicle:* + bus 통과 (차량)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'bus:vehicle:R272:V123', name: '272번 [차량 V123]', type: 'bus',
      }).success).toBe(true);
    });
    it('classroom: + classroom 통과 (자유 입력)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'classroom:공학관 401', name: '공학관 401호', type: 'classroom',
      }).success).toBe(true);
    });
    // 안전망: type 위장 시도 거부.
    it('snu: + subway 거부 (type 위장)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'snu:관악:301', name: '시도', type: 'subway',
      }).success).toBe(false);
    });
    it('subway: + other 거부 (type 위장)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'subway:fake', name: '시도', type: 'other',
      }).success).toBe(false);
    });
    it('알 수 없는 prefix 거부 (안전 fail-closed)', () => {
      expect(UpsertPlaceBodySchema.safeParse({
        id: 'random:xyz', name: 'OK', type: 'other',
      }).success).toBe(false);
    });
  });
});

describe('PostVoteBodySchema', () => {
  it('정상', () => {
    expect(PostVoteBodySchema.safeParse({ vote: 'cold' }).success).toBe(true);
  });
  it('잘못된 vote', () => {
    expect(PostVoteBodySchema.safeParse({ vote: 'lukewarm' }).success).toBe(false);
  });
});

describe('SubwayMatchBodySchema / BusMatchBodySchema', () => {
  it('subway match 정상', () => {
    expect(SubwayMatchBodySchema.safeParse({ line: '2호선', prev: '강남', next: '교대' }).success).toBe(true);
  });
  it('subway match 빈 필드 거부', () => {
    expect(SubwayMatchBodySchema.safeParse({ line: '', prev: '강남', next: '교대' }).success).toBe(false);
  });
  it('bus match 정상', () => {
    expect(BusMatchBodySchema.safeParse({ routeName: '146', stopName: '강남역.강남대로' }).success).toBe(true);
  });
});

describe('parseBody helper', () => {
  it('성공 시 { ok: true, data }', () => {
    const r = parseBody(VoteTypeSchema, 'cold');
    expect(r).toEqual({ ok: true, data: 'cold' });
  });
  it('실패 시 { ok: false, error }', () => {
    const r = parseBody(VoteTypeSchema, 'bad');
    expect(r.ok).toBe(false);
  });
});
