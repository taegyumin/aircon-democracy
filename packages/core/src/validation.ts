// Runtime API boundary validation.
// 자문 LLM 권장: Zod는 클라이언트 폼보다 'API body / place id / 공공 API response
// normalizer' 경계에 쓰는 게 더 효과적.

import { z } from 'zod';

// Place types — must match VALID_PLACE_TYPES in apps/web/src/server/_abuse.ts.
// schema-as-truth: 새 type 추가 시 여기만 바꾸면 클라/서버 둘 다 적용.
export const PLACE_TYPES = ['classroom', 'subway', 'train', 'cafe', 'bus', 'library', 'office', 'other'] as const;
export const PlaceTypeSchema = z.enum(PLACE_TYPES);
export type PlaceType = z.infer<typeof PlaceTypeSchema>;

// Vote enum
export const VOTE_TYPES = ['cold', 'ok', 'hot'] as const;
export const VoteTypeSchema = z.enum(VOTE_TYPES);
export type VoteType = z.infer<typeof VoteTypeSchema>;

// Place id format: <prefix>:<rest>
const PLACE_ID_RE = /^[a-z]+:[\p{L}\p{N}\s,()/:·.\-]{1,180}$/u;
export const PlaceIdSchema = z.string().regex(PLACE_ID_RE, 'invalid_place_id');

// id prefix → type 매핑.
//
// **중요한 도메인 사실**: prefix는 type과 1:1이 아님. 예:
//   snu:관악:301:402     → type='classroom' (서울대 강의실)
//   yonsei:신촌:122      → type='classroom' (연세대 강의실)
//   venue:gps:37.5:127.0 → type='other' (네이버 지도 좌표 기반 카페·식당)
//   bus:vehicle:R272:V1  → type='bus' (차량 단위)
//   bus:272:신촌오거리   → type='bus' (정류장 fallback)
//
// 이전엔 `id.startsWith(type + ':')`로 단순 매칭 — snu/yonsei/venue 흐름이
// 전부 400으로 실패. LLM 리뷰 P1: prod 강의실/카페 vote 차단 버그.
//
// 새 prefix 추가 시 여기에도 등록. 등록 안 된 prefix는 invalid_id로 거부 (안전).
export const ID_PREFIX_TYPE: Record<string, PlaceType> = {
  subway: 'subway',
  train: 'train',
  bus: 'bus',
  snu: 'classroom',
  yonsei: 'classroom',
  classroom: 'classroom',  // 자유 입력 (RegisterScreen)
  venue: 'other',          // 네이버 지도 좌표 기반
  cafe: 'cafe',            // 추후 전용 카페 식별
  library: 'library',
  office: 'office',
  other: 'other',
};

// Place inputs.
// 길이 제한은 prod DB의 실제 제약과 일치. 이전에는 Zod가 name 120/detail 240으로
// 느슨해서 서버가 _abuse.ts에서 40/80으로 다시 거르는 drift가 있었음. Zod가 SOT.
const PlaceCoreSchema = z.object({
  name: z.string().trim().min(2, 'invalid_name_length').max(40, 'invalid_name_length'),
  type: PlaceTypeSchema,
  district: z.string().trim().max(60, 'invalid_district').optional().nullable(),
  detail: z.string().trim().max(80, 'invalid_detail').optional().nullable(),
});

export const CreatePlaceBodySchema = PlaceCoreSchema;
export type CreatePlaceBody = z.infer<typeof CreatePlaceBodySchema>;

export const UpsertPlaceBodySchema = PlaceCoreSchema.extend({
  id: PlaceIdSchema,
}).refine(
  (v) => {
    const prefix = v.id.split(':', 1)[0];
    const expected = ID_PREFIX_TYPE[prefix];
    return expected === v.type;
  },
  { message: 'invalid_id' },
);
export type UpsertPlaceBody = z.infer<typeof UpsertPlaceBodySchema>;

// Vote
export const PostVoteBodySchema = z.object({
  vote: VoteTypeSchema,
});

// Realtime
export const SubwayMatchBodySchema = z.object({
  line: z.string().min(1).max(20),
  prev: z.string().min(1).max(40),
  next: z.string().min(1).max(40),
});

export const BusMatchBodySchema = z.object({
  routeName: z.string().trim().min(1).max(20),
  stopName: z.string().trim().min(1).max(60),
});

// Bus 리디자인: 노선 자동완성 / 정류장 list. data.go.kr 래핑 endpoint들.
// query는 URL param. 한글 노선명도 받아야 해서 길이 여유.
export const BusRouteSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(20),
});

export const BusRouteStationsQuerySchema = z.object({
  // data.go.kr의 busRouteId. 보통 9자리 숫자 문자열.
  routeId: z.string().trim().min(1).max(40),
});

// Helper for hono routes
export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? 'invalid_body' };
}
