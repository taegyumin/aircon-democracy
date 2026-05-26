// HMAC-signed cookie 도구 + voter cookie middleware.

import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import { COOKIE_NAME, COOKIE_MAX_AGE, type Env } from './types';

export async function hmacSign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyCookie(raw: string | undefined, secret: string): Promise<string | null> {
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx <= 0) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = await hmacSign(id, secret);
  if (sig.length !== expected.length) return null;
  // constant-time compare (XOR diff).
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? id : null;
}

// First-hit에 voter UUID 발급 + 서명. 이후 모든 요청에 c.get('voterId') 가능.
//
// Voter token 전달 채널 — 두 source 모두 수용:
//   1. Authorization: Bearer voter:<id>.<sig>  ← mobile/native (cookie jar 없음)
//   2. Cookie 'voter'                          ← web
// 신규 발급 시 Set-Cookie + X-Aircon-Voter-Token 헤더 둘 다 응답.
// mobile은 헤더 값을 SecureStore에 저장 후 다음 요청부터 Authorization으로 전송.
const BEARER_PREFIX = 'Bearer voter:';

export const voterCookieMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  let voterId: string | null = null;

  // 1. Authorization (mobile/native 우선).
  const auth = c.req.header('Authorization');
  if (auth && auth.startsWith(BEARER_PREFIX)) {
    voterId = await verifyCookie(auth.slice(BEARER_PREFIX.length), c.env.COOKIE_SECRET);
  }
  // 2. Cookie (web fallback).
  if (!voterId) {
    voterId = await verifyCookie(getCookie(c, COOKIE_NAME), c.env.COOKIE_SECRET);
  }
  // 3. 신규 발급.
  if (!voterId) {
    voterId = crypto.randomUUID();
    const sig = await hmacSign(voterId, c.env.COOKIE_SECRET);
    const token = `${voterId}.${sig}`;
    setCookie(c, COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
    // mobile이 캡처해 SecureStore에 저장 후 Authorization으로 재사용.
    // 이름이 X-Aircon-* 인 이유: CORS expose-headers 명시 필요 (별도 작업 시).
    c.header('X-Aircon-Voter-Token', token);
  }
  c.set('voterId', voterId);
  await next();
};
