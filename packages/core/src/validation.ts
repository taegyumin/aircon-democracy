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

// Place id format: <type>:<rest> (type prefix가 type 필드와 일치해야 upsert OK)
const PLACE_ID_RE = /^[a-z]+:[\p{L}\p{N}\s,()/:·.\-]{1,180}$/u;
export const PlaceIdSchema = z.string().regex(PLACE_ID_RE, 'invalid_place_id');

// Place inputs
const PlaceCoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: PlaceTypeSchema,
  district: z.string().trim().max(120).optional().nullable(),
  detail: z.string().trim().max(240).optional().nullable(),
});

export const CreatePlaceBodySchema = PlaceCoreSchema;
export type CreatePlaceBody = z.infer<typeof CreatePlaceBodySchema>;

export const UpsertPlaceBodySchema = PlaceCoreSchema.extend({
  id: PlaceIdSchema,
}).refine((v) => v.id.startsWith(`${v.type}:`), {
  message: 'id_prefix_must_match_type',
});
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

// Helper for hono routes
export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? 'invalid_body' };
}
