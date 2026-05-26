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
export const voterCookieMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const raw = getCookie(c, COOKIE_NAME);
  let voterId = await verifyCookie(raw, c.env.COOKIE_SECRET);
  if (!voterId) {
    voterId = crypto.randomUUID();
    const sig = await hmacSign(voterId, c.env.COOKIE_SECRET);
    setCookie(c, COOKIE_NAME, `${voterId}.${sig}`, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
  }
  c.set('voterId', voterId);
  await next();
};
