// OAuth (kakao/naver/google) authorize+callback + /me + /auth/logout.
// 3 provider의 flow는 OAUTH_PROVIDERS 배열을 루프해서 generic하게 등록.

import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign as jwtSign, verify as jwtVerify } from 'hono/jwt';
import { OAUTH_PROVIDERS, type OAuthProvider } from '../oauth';
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DAYS,
  type Env,
} from '../types';

// ── helpers ─────────────────────────────────────────────────────────

async function upsertUserAndIssueSession(
  c: Context<Env>,
  provider: string,
  providerUserId: string,
  displayName: string,
  profileImageUrl: string | null,
  email: string | null,
): Promise<void> {
  const now = Date.now();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE provider = ? AND provider_user_id = ?',
  )
    .bind(provider, providerUserId)
    .first<{ id: string }>();
  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB.prepare(
      'UPDATE users SET display_name = ?, profile_image_url = ?, email = ?, last_login_at = ? WHERE id = ?',
    )
      .bind(displayName, profileImageUrl, email, now, userId)
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
  setCookie(c, SESSION_COOKIE, sessionJwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
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
  const token = getCookie(c, SESSION_COOKIE);
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

for (const p of OAUTH_PROVIDERS) registerOAuthProvider(authRoutes, p);
