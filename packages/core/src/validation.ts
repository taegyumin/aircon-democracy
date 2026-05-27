// Runtime API boundary validation.
// 자문 LLM 권장: Zod는 클라이언트 폼보다 'API body / place id / 공공 API response
// normalizer' 경계에 쓰는 게 더 효과적.

import { z } from 'zod';
import { UNIVERSITIES } from './universities';

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
  // 사용자가 직접 등록한 사적 공간. type은 user가 선택 (office/classroom/cafe/other 중).
  // owner_user_id로 묶이고 default is_public=0이라 검색에는 안 나옴.
  // 그래서 user: prefix는 multiple type을 가질 수 있어 ID_PREFIX_TYPE에는 'other' fallback.
  // upsert validation에서 user: 는 별도 처리 (refine bypass).
  user: 'other',
};

// user: prefix는 type 자유라 refine bypass.
const PLACE_ID_TYPE_FREE_PREFIXES = new Set(['user']);
export function isFreeTypePrefix(prefix: string): boolean {
  return PLACE_ID_TYPE_FREE_PREFIXES.has(prefix);
}

// 머지로 들어온 generic universities (112교) — 모두 type='classroom'으로 강제 매핑.
// snu/yonsei처럼 일일이 ID_PREFIX_TYPE에 넣지 않고 데이터에서 자동 도출.
const UNIVERSITY_PREFIXES = new Set<string>(UNIVERSITIES.map((u) => u.placeIdPrefix));
export function isUniversityPrefix(prefix: string): boolean {
  return UNIVERSITY_PREFIXES.has(prefix);
}

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
    if (isFreeTypePrefix(prefix)) return true; // user: 는 type 자유.
    if (isUniversityPrefix(prefix)) return v.type === 'classroom'; // generic 대학 prefix 전부 강의실.
    const expected = ID_PREFIX_TYPE[prefix];
    return expected === v.type;
  },
  { message: 'invalid_id' },
);
export type UpsertPlaceBody = z.infer<typeof UpsertPlaceBodySchema>;

// 사용자 직접 등록 공간 — login 필수 endpoint POST /api/places/user.
// type은 자유 (사무실/강의실/카페/기타). description은 짧은 설명.
export const UserPlaceCreateBodySchema = z.object({
  name: z.string().trim().min(2, 'invalid_name_length').max(60, 'invalid_name_length'),
  type: PlaceTypeSchema,
  description: z.string().trim().max(200, 'invalid_description').optional().nullable(),
});
export type UserPlaceCreateBody = z.infer<typeof UserPlaceCreateBodySchema>;

// 장소 정보 신고 — anonymous (voter cookie 기반).
// 5 reason 중 하나 + 선택 note (수정 제안 / 삭제 이유 등).
export const REPORT_REASONS = ['not-here', 'wrong-name', 'duplicate', 'delete', 'other'] as const;
export const ReportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const PlaceReportBodySchema = z.object({
  reason: ReportReasonSchema,
  note: z.string().trim().max(300, 'invalid_note').optional().nullable(),
});
export type PlaceReportBody = z.infer<typeof PlaceReportBodySchema>;

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

// region: 'seoul' 또는 TAGO cityCode(숫자 문자열). 비어 있으면 'seoul' 기본.
// (서울은 ws.bus.go.kr 분기, 그 외는 TAGO 1613000 분기로 라우팅.)
// LLM P2: cityCode CITY_CODES set으로 refine — 임의 숫자 거부.
// busRegion에서 VALID_REGION_VALUES import (cycle 없음 — busRegion은 zod 사용 안 함).
import { VALID_REGION_VALUES } from './busRegion';
const RegionSchema = z
  .string()
  .trim()
  .max(10)
  .optional()
  .refine(
    (v) => v === undefined || v === '' || VALID_REGION_VALUES.has(v),
    { message: 'invalid_region' },
  );

export const BusMatchBodySchema = z.object({
  routeName: z.string().trim().min(1).max(20),
  stopName: z.string().trim().min(1).max(60),
  region: RegionSchema,
  // TAGO 매칭은 routeId 직접 필요 (사용자 검색 후 routeId 알려짐).
  routeId: z.string().trim().max(40).optional(),
});

// Bus 리디자인: 노선 자동완성 / 정류장 list. data.go.kr 래핑 endpoint들.
// query는 URL param. 한글 노선명도 받아야 해서 길이 여유.
export const BusRouteSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(20),
  region: RegionSchema,
});

export const BusRouteStationsQuerySchema = z.object({
  // data.go.kr의 busRouteId. 보통 9자리 숫자 문자열.
  routeId: z.string().trim().min(1).max(40),
  region: RegionSchema,
});

// GPS 좌표 → cityCode (또는 'seoul'). NCP reverse-geocode 래핑용.
export const BusRegionByCoordsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// POI (카페·음식점) 검색 — NAVER Search Local + Kakao Local 동시 호출 wrapper.
// lat/lng는 optional (Kakao는 위치 기반 검색 가능, NAVER는 query만).
export const PoiSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(40),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

// Helper for hono routes
export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? 'invalid_body' };
}
