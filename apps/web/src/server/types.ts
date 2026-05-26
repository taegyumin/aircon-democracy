// Shared Hono bindings & vars. Server routes 모듈이 같은 타입을 참조하도록 SOT.

import type { Hono } from 'hono';

export interface Bindings {
  DB: D1Database;
  COOKIE_SECRET: string;
  SESSION_SECRET: string;
  ABUSE_SECRET: string;
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export interface Vars {
  voterId: string;
}

export type Env = { Bindings: Bindings; Variables: Vars };

// 각 route module이 main app에 mount될 때 사용하는 타입.
export type AppHono = Hono<Env>;

// Cookie names — server-wide single source.
export const COOKIE_NAME = 'voter';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 30;
export const OAUTH_STATE_COOKIE = 'oauth_state';

// Vote business rules.
export const COOLDOWN_MS = 30_000;
export const EXPIRY_MS = 60 * 60 * 1000;

// Vote types (string union). Zod의 VOTE_TYPES와 같아야 함 — 검증은 packages/core/validation.ts.
export const VOTE_TYPES = ['cold', 'ok', 'hot'] as const;
export type VoteType = (typeof VOTE_TYPES)[number];
