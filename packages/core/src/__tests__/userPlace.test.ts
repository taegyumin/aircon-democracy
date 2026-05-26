// 회귀 방지: 사용자 직접 등록 공간 schema.
//   - user: prefix는 ID_PREFIX_TYPE 기본 매핑이 'other'지만 free-type이라
//     upsert refine에서 bypass.
//   - UserPlaceCreateBody는 name 60자 + description 200자.

import { describe, it, expect } from 'vitest';
import {
  UserPlaceCreateBodySchema,
  UpsertPlaceBodySchema,
  isFreeTypePrefix,
} from '../validation';

describe('UserPlaceCreateBodySchema', () => {
  it('accept — name + type', () => {
    const r = UserPlaceCreateBodySchema.safeParse({
      name: '삼성전자 서초사옥 3층 312호',
      type: 'office',
    });
    expect(r.success).toBe(true);
  });

  it('accept — with description', () => {
    const r = UserPlaceCreateBodySchema.safeParse({
      name: '내 카페',
      type: 'cafe',
      description: '단골만 알면 됩니다',
    });
    expect(r.success).toBe(true);
  });

  it('reject — name too short', () => {
    const r = UserPlaceCreateBodySchema.safeParse({ name: 'a', type: 'office' });
    expect(r.success).toBe(false);
  });

  it('reject — name too long (60자 초과)', () => {
    const r = UserPlaceCreateBodySchema.safeParse({
      name: 'a'.repeat(61),
      type: 'office',
    });
    expect(r.success).toBe(false);
  });

  it('reject — description too long (200자 초과)', () => {
    const r = UserPlaceCreateBodySchema.safeParse({
      name: '공간',
      type: 'office',
      description: '가'.repeat(201),
    });
    expect(r.success).toBe(false);
  });

  it('reject — invalid type', () => {
    const r = UserPlaceCreateBodySchema.safeParse({ name: '공간', type: 'invalid' });
    expect(r.success).toBe(false);
  });
});

describe('user: prefix free-type bypass', () => {
  it('isFreeTypePrefix("user") = true', () => {
    expect(isFreeTypePrefix('user')).toBe(true);
  });

  it('isFreeTypePrefix("subway") = false (기존 prefix는 type 1:1)', () => {
    expect(isFreeTypePrefix('subway')).toBe(false);
    expect(isFreeTypePrefix('snu')).toBe(false);
    expect(isFreeTypePrefix('venue')).toBe(false);
  });

  it('upsert validation — user: id는 어떤 type이든 통과', () => {
    // 'user:abc123' + type='office' — OK
    expect(UpsertPlaceBodySchema.safeParse({
      id: 'user:abc123', name: '내 회의실', type: 'office',
    }).success).toBe(true);
    // 'user:abc123' + type='cafe' — OK (자유)
    expect(UpsertPlaceBodySchema.safeParse({
      id: 'user:abc123', name: '내 카페', type: 'cafe',
    }).success).toBe(true);
    // 'user:abc123' + type='classroom' — OK
    expect(UpsertPlaceBodySchema.safeParse({
      id: 'user:abc123', name: '스터디룸', type: 'classroom',
    }).success).toBe(true);
  });

  it('upsert validation — subway: id는 여전히 type 강제', () => {
    expect(UpsertPlaceBodySchema.safeParse({
      id: 'subway:강남:2호선', name: '강남역', type: 'subway',
    }).success).toBe(true);
    // subway: + cafe는 reject (free-type 아님)
    expect(UpsertPlaceBodySchema.safeParse({
      id: 'subway:강남:2호선', name: '강남역', type: 'cafe',
    }).success).toBe(false);
  });
});
