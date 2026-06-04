// OAuth (kakao/naver/google) authorize+callback + Apple native + /me + /auth/logout.
// 3 web provider의 flow는 OAUTH_PROVIDERS 배열을 루프해서 generic하게 등록.
// Apple은 iOS native에서 expo-apple-authentication으로 identity token 받아 POST.

import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign as jwtSign, verify as jwtVerify } from 'hono/jwt';
import { createRemoteJWKSet, jwtVerify as joseVerify } from 'jose';
import { OAUTH_PROVIDERS, type OAuthProvider } from '../oauth';
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  type Env,
} from '../types';

// Apple JWKS — lazy init (모듈 top level에서 URL 평가만, 첫 호출 시 fetch).
// Workers 환경에서 createRemoteJWKSet은 fetch 기반이라 동작 OK.
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const APPLE_BUNDLE_ID = 'com.aircondemocracy.app';

// ── helpers ─────────────────────────────────────────────────────────

async function upsertUserAndIssueSession(
  c: Context<Env>,
  provider: string,
  providerUserId: string,
  displayName: string,
  profileImageUrl: string | null,
  email: string | null,
): Promise<{ userId: string; sessionJwt: string }> {
  const now = Date.now();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE provider = ? AND provider_user_id = ?',
  )
    .bind(provider, providerUserId)
    .first<{ id: string }>();
  let userId: string;
  if (existing) {
    userId = existing.id;
    // COALESCE: 새 값 null이면 기존 DB 값 유지. Apple 재로그인 시 fullName/email 누락 케이스.
    // 'Apple User' default도 null과 다르게 — null만 fallback.
    const dn = displayName === 'Apple User' || displayName === '' ? null : displayName;
    await c.env.DB.prepare(
      'UPDATE users SET display_name = COALESCE(?, display_name), profile_image_url = COALESCE(?, profile_image_url), email = COALESCE(?, email), last_login_at = ? WHERE id = ?',
    )
      .bind(dn, profileImageUrl, email, now, userId)
      .run();
  } else {
    userId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO users (id, provider, provider_user_id, display_name, profile_image_url, email, created_at, last_login_at) VALUES (?,?,?,?,?,?,?,?)',
    )
      .bind(userId, provider, providerUserId, displayName, profileImageUrl, email, now, now)
      .run();
  }
  const expSeconds = Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const sessionJwt = await jwtSign({ uid: userId, exp: expSeconds }, c.env.SESSION_SECRET, 'HS256');
  // web cookie 흐름은 그대로 — mobile native는 응답 body에서 sessionJwt 받음.
  setCookie(c, SESSION_COOKIE, sessionJwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
  return { userId, sessionJwt };
}

function setOAuthState(c: Context<Env>): string {
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });
  return state;
}

function consumeOAuthState(c: Context<Env>, state: string): boolean {
  const saved = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  return !!saved && saved === state;
}

function registerOAuthProvider(app: Hono<Env>, provider: OAuthProvider): void {
  app.get(`/auth/${provider.id}`, (c) => {
    const cfg = provider.isConfigured(c.env);
    if (!cfg.ok) return c.json({ error: cfg.error }, 503);
    const state = setOAuthState(c);
    const origin = new URL(c.req.url).origin;
    const redirectUri = `${origin}/api/auth/${provider.id}/callback`;
    return c.redirect(provider.authorizeUrl({ state, redirectUri, env: c.env }));
  });

  app.get(`/auth/${provider.id}/callback`, async (c) => {
    const { code, state, error } = c.req.query();
    if (error) return c.redirect(`/login?error=${encodeURIComponent(error)}`);
    if (!code || !state) return c.redirect('/login?error=missing_code');
    if (!consumeOAuthState(c, state)) return c.redirect('/login?error=state_mismatch');

    const cfg = provider.isConfigured(c.env);
    if (!cfg.ok) return c.redirect('/login?error=not_configured');

    const origin = new URL(c.req.url).origin;
    const redirectUri = `${origin}/api/auth/${provider.id}/callback`;
    const tok = await provider.exchangeCode({ code, state, redirectUri, env: c.env });
    if (!tok.ok) return c.redirect(`/login?error=token_${encodeURIComponent(tok.error)}`);

    const user = await provider.fetchUser(tok.accessToken);
    if (!user) return c.redirect('/login?error=user_fetch_failed');

    await upsertUserAndIssueSession(
      c,
      provider.id,
      user.providerUserId,
      user.displayName,
      user.profileImageUrl,
      user.email,
    );
    return c.redirect('/');
  });
}

// ── routes ──────────────────────────────────────────────────────────

export const authRoutes = new Hono<Env>();

authRoutes.get('/me', async (c) => {
  // Web cookie 또는 mobile X-Aircon-Session 헤더. 둘 다 같은 JWT (HS256, uid claim).
  const token = c.req.header('X-Aircon-Session') ?? getCookie(c, SESSION_COOKIE);
  if (!token || !c.env.SESSION_SECRET) return c.json({ user: null });
  try {
    const payload = (await jwtVerify(token, c.env.SESSION_SECRET, 'HS256')) as { uid?: string };
    if (!payload?.uid) return c.json({ user: null });
    const user = await c.env.DB.prepare(
      'SELECT id, display_name, profile_image_url, provider FROM users WHERE id = ?',
    )
      .bind(payload.uid)
      .first<{ id: string; display_name: string | null; profile_image_url: string | null; provider: string }>();
    return c.json({ user });
  } catch {
    return c.json({ user: null });
  }
});

authRoutes.post('/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// SHA256 hex — server가 raw nonce를 hash해서 Apple identityToken의 nonce claim과 비교.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const APPLE_NONCE_TTL_MS = 5 * 60 * 1000;

// GET /api/auth/apple/nonce — mobile이 sign-in 시작 전에 server-발급 nonce 받음.
// 1회 소비 + 5분 만료. mobile은 SHA256(nonce)을 signInAsync에 넣고 raw nonce를 POST 본문에 첨부.
authRoutes.get('/auth/apple/nonce', async (c) => {
  const nonce = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = Date.now() + APPLE_NONCE_TTL_MS;
  await c.env.DB.prepare('INSERT INTO apple_nonces (nonce, expires_at) VALUES (?, ?)')
    .bind(nonce, expiresAt).run();
  return c.json({ nonce, expiresAt });
});

// POST /api/auth/apple/native — identityToken verify + nonce 1회 소비 + session 발급.
// expo-apple-authentication이 받은 identityToken (RS256 JWT, Apple 서명)을 본 endpoint로 전송.
// mobile은 sessionJwt를 AsyncStorage 저장 후 X-Aircon-Session 헤더로 재전송.
//
// fullName은 첫 sign-in에만 옵션으로 전달됨 (Apple privacy 정책). 그 후엔 silent — 기존 값 유지.
authRoutes.post('/auth/apple/native', async (c) => {
  let body: { identityToken?: string; nonce?: string; fullName?: { givenName?: string; familyName?: string } };
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const token = body.identityToken;
  const rawNonce = body.nonce;
  if (!token || typeof token !== 'string') return c.json({ error: 'missing_token' }, 400);
  if (!rawNonce || typeof rawNonce !== 'string') return c.json({ error: 'missing_nonce' }, 400);

  // Nonce 1회 소비 — 같은 nonce 두 번 사용 X. expired면 reject.
  const now = Date.now();
  const consumed = await c.env.DB.prepare(
    'DELETE FROM apple_nonces WHERE nonce = ? AND expires_at > ? RETURNING nonce',
  ).bind(rawNonce, now).first();
  if (!consumed) return c.json({ error: 'invalid_or_expired_nonce' }, 401);

  let payload: { sub?: string; email?: string; nonce?: string };
  try {
    const verified = await joseVerify(token, APPLE_JWKS, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_BUNDLE_ID,
    });
    payload = verified.payload as typeof payload;
  } catch {
    return c.json({ error: 'invalid_apple_token' }, 401);
  }

  // identityToken의 nonce claim은 SHA256(raw nonce) — Apple 정책.
  const expectedHash = await sha256Hex(rawNonce);
  if (payload.nonce !== expectedHash) return c.json({ error: 'nonce_mismatch' }, 401);

  const appleSub = payload.sub;
  if (!appleSub) return c.json({ error: 'no_sub' }, 401);

  const email = payload.email ?? null;
  const fn = body.fullName;
  const displayName = (fn?.givenName || fn?.familyName)
    ? `${fn.givenName ?? ''} ${fn.familyName ?? ''}`.trim()
    : null;

  // 첫 로그인엔 fullName/email 받지만 그 후엔 null. upsertUserAndIssueSession이
  // null이면 기존 값 유지하도록 COALESCE 처리. (Codex review 지적)
  const { userId, sessionJwt } = await upsertUserAndIssueSession(
    c, 'apple', appleSub, displayName ?? 'Apple User', null, email,
  );

  const user = await c.env.DB.prepare(
    'SELECT id, display_name, profile_image_url, provider FROM users WHERE id = ?',
  ).bind(userId).first();
  return c.json({ user, sessionJwt });
});

for (const p of OAUTH_PROVIDERS) registerOAuthProvider(authRoutes, p);
