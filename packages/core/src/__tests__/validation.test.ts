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
