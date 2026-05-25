/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign as jwtSign, verify as jwtVerify } from 'hono/jwt';
import type { Context } from 'hono';
import {
  abuseKeys,
  audit,
  checkLimits,
  csrfGuard,
  isBlocked,
  isKillSwitchOn,
  validatePlaceInput,
  VALID_PLACE_TYPES,
  type AbuseKeys,
  type AuditContext,
  type AuditMeta,
} from './_abuse';

type Bindings = {
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
};

type Vars = { voterId: string };

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;
const OAUTH_STATE_COOKIE = 'oauth_state';

interface UserRow {
  id: string;
  provider: string;
  provider_user_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  email: string | null;
  created_at: number;
  last_login_at: number;
}

const COOKIE_NAME = 'voter';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COOLDOWN_MS = 30_000;
const EXPIRY_MS = 60 * 60 * 1000;
const VOTE_TYPES = ['cold', 'ok', 'hot'] as const;
const PLACE_TYPES = ['classroom', 'subway', 'train', 'cafe', 'bus', 'library', 'office', 'other'] as const;
type VoteType = (typeof VOTE_TYPES)[number];
type PlaceType = (typeof PLACE_TYPES)[number];

interface PlaceRow {
  id: string;
  name: string;
  type: PlaceType;
  district: string | null;
  detail: string | null;
  created_at: number;
}

interface PlaceWithCounts extends PlaceRow {
  cold: number;
  ok: number;
  hot: number;
}

interface MyVoteRow {
  vote: VoteType;
  voted_at: number;
  changed_at: number;
  expires_at: number;
}

// ── Signed cookie helpers ───────────────────────────────────────────

async function hmacSign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyCookie(raw: string | undefined, secret: string): Promise<string | null> {
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx <= 0) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = await hmacSign(id, secret);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  return id;
}

// ── Abuse-helper adapter ────────────────────────────────────────────
// Bridges Hono Context to the primitive-arg helpers in _abuse.ts.

async function abuseFor(c: Context<{ Bindings: Bindings; Variables: Vars }>): Promise<{
  keys: AbuseKeys;
  auditCtx: AuditContext;
  log: (eventType: string, status: number, info?: AuditMeta) => Promise<void>;
}> {
  const keys = await abuseKeys({
    secret: c.env.ABUSE_SECRET ?? '',
    voterId: c.get('voterId'),
    ip: c.req.header('CF-Connecting-IP') ?? 'unknown',
    ua: c.req.header('User-Agent') ?? 'unknown',
    country: c.req.header('CF-IPCountry') ?? null,
    cfRay: c.req.header('CF-Ray') ?? null,
  });
  const auditCtx: AuditContext = {
    db: c.env.DB,
    url: c.req.url,
    method: c.req.method,
    keys,
  };
  return {
    keys,
    auditCtx,
    log: (eventType, status, info) => audit(auditCtx, eventType, status, info),
  };
}

// ── App ─────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Bindings; Variables: Vars }>().basePath('/api');

// Voter cookie middleware — generate on first hit, verify thereafter
app.use('*', async (c, next) => {
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
});

// CSRF/Origin guard for mutating requests. Exempts OAuth callbacks; see _abuse.ts.
app.use('*', csrfGuard());

// Health check
app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// ── Auth: current user ──────────────────────────────────────────────

app.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || !c.env.SESSION_SECRET) return c.json({ user: null });
  try {
    const payload = (await jwtVerify(token, c.env.SESSION_SECRET)) as { uid?: string };
    if (!payload?.uid) return c.json({ user: null });
    const user = await c.env.DB.prepare(
      'SELECT id, display_name, profile_image_url, provider FROM users WHERE id = ?'
    )
      .bind(payload.uid)
      .first<{ id: string; display_name: string | null; profile_image_url: string | null; provider: string }>();
    return c.json({ user });
  } catch {
    return c.json({ user: null });
  }
});

app.post('/auth/logout', (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

// ── Auth: Kakao OAuth ───────────────────────────────────────────────

app.get('/auth/kakao', (c) => {
  if (!c.env.KAKAO_REST_API_KEY || c.env.KAKAO_REST_API_KEY.startsWith('TODO')) {
    return c.json({ error: 'kakao_not_configured', hint: 'Set KAKAO_REST_API_KEY env var' }, 503);
  }
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 600,
    path: '/',
  });
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/kakao/callback`;
  const params = new URLSearchParams({
    client_id: c.env.KAKAO_REST_API_KEY,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'profile_nickname profile_image account_email',
  });
  return c.redirect(`https://kauth.kakao.com/oauth/authorize?${params.toString()}`);
});

app.get('/auth/kakao/callback', async (c) => {
  const { code, state, error } = c.req.query();
  if (error) return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  if (!code || !state) return c.redirect('/login?error=missing_code');

  const savedState = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  if (!savedState || savedState !== state) {
    return c.redirect('/login?error=state_mismatch');
  }

  const apiKey = c.env.KAKAO_REST_API_KEY;
  const clientSecret = c.env.KAKAO_CLIENT_SECRET;
  if (!apiKey || apiKey.startsWith('TODO')) return c.redirect('/login?error=not_configured');

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/kakao/callback`;

  // Exchange code → token
  const tokenForm = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: apiKey,
    redirect_uri: redirectUri,
    code,
  });
  if (clientSecret && !clientSecret.startsWith('TODO')) tokenForm.set('client_secret', clientSecret);

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenForm.toString(),
  });
  const tokenBody = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenBody.access_token) {
    return c.redirect(`/login?error=token_${encodeURIComponent(tokenBody.error ?? 'unknown')}`);
  }

  // Fetch user info
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const ku = (await userRes.json()) as {
    id?: number;
    kakao_account?: {
      email?: string;
      profile?: { nickname?: string; profile_image_url?: string };
    };
  };
  if (!ku.id) return c.redirect('/login?error=user_fetch_failed');

  const providerUserId = String(ku.id);
  const profile = ku.kakao_account?.profile ?? {};
  const displayName = profile.nickname ?? '카카오 사용자';
  const profileImageUrl = profile.profile_image_url ?? null;
  const email = ku.kakao_account?.email ?? null;
  const now = Date.now();

  // Upsert user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE provider = ? AND provider_user_id = ?'
  )
    .bind('kakao', providerUserId)
    .first<{ id: string }>();

  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB.prepare(
      'UPDATE users SET display_name = ?, profile_image_url = ?, email = ?, last_login_at = ? WHERE id = ?'
    )
      .bind(displayName, profileImageUrl, email, now, userId)
      .run();
  } else {
    userId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO users (id, provider, provider_user_id, display_name, profile_image_url, email, created_at, last_login_at) VALUES (?,?,?,?,?,?,?,?)'
    )
      .bind(userId, 'kakao', providerUserId, displayName, profileImageUrl, email, now, now)
      .run();
  }

  // Issue session JWT
  const expSeconds = Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const sessionJwt = await jwtSign({ uid: userId, exp: expSeconds }, c.env.SESSION_SECRET);
  setCookie(c, SESSION_COOKIE, sessionJwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });

  return c.redirect('/');
});

// ── OAuth helpers (shared by naver/google) ──────────────────────────

async function upsertUserAndIssueSession(
  c: Context<{ Bindings: Bindings; Variables: Vars }>,
  provider: string,
  providerUserId: string,
  displayName: string,
  profileImageUrl: string | null,
  email: string | null,
): Promise<void> {
  const now = Date.now();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE provider = ? AND provider_user_id = ?'
  )
    .bind(provider, providerUserId)
    .first<{ id: string }>();
  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB.prepare(
      'UPDATE users SET display_name = ?, profile_image_url = ?, email = ?, last_login_at = ? WHERE id = ?'
    )
      .bind(displayName, profileImageUrl, email, now, userId)
      .run();
  } else {
    userId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO users (id, provider, provider_user_id, display_name, profile_image_url, email, created_at, last_login_at) VALUES (?,?,?,?,?,?,?,?)'
    )
      .bind(userId, provider, providerUserId, displayName, profileImageUrl, email, now, now)
      .run();
  }
  const expSeconds = Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const sessionJwt = await jwtSign({ uid: userId, exp: expSeconds }, c.env.SESSION_SECRET);
  setCookie(c, SESSION_COOKIE, sessionJwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

function consumeOAuthState(c: Context<{ Bindings: Bindings; Variables: Vars }>, state: string): boolean {
  const saved = getCookie(c, OAUTH_STATE_COOKIE);
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: '/' });
  return !!saved && saved === state;
}

function setOAuthState(c: Context<{ Bindings: Bindings; Variables: Vars }>): string {
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

// ── Auth: Naver OAuth ───────────────────────────────────────────────

app.get('/auth/naver', (c) => {
  if (!c.env.NAVER_CLIENT_ID || c.env.NAVER_CLIENT_ID.startsWith('TODO')) {
    return c.json({ error: 'naver_not_configured' }, 503);
  }
  const state = setOAuthState(c);
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/naver/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: c.env.NAVER_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
  });
  return c.redirect(`https://nid.naver.com/oauth2.0/authorize?${params.toString()}`);
});

app.get('/auth/naver/callback', async (c) => {
  const { code, state, error } = c.req.query();
  if (error) return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  if (!code || !state) return c.redirect('/login?error=missing_code');
  if (!consumeOAuthState(c, state)) return c.redirect('/login?error=state_mismatch');

  const clientId = c.env.NAVER_CLIENT_ID;
  const clientSecret = c.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.redirect('/login?error=not_configured');

  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    state,
  });
  const tokenRes = await fetch(`https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`);
  const tokenBody = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenBody.access_token) {
    return c.redirect(`/login?error=token_${encodeURIComponent(tokenBody.error ?? 'unknown')}`);
  }

  const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const nu = (await userRes.json()) as {
    resultcode?: string;
    response?: { id?: string; nickname?: string; profile_image?: string; email?: string; name?: string };
  };
  if (nu.resultcode !== '00' || !nu.response?.id) return c.redirect('/login?error=user_fetch_failed');

  await upsertUserAndIssueSession(
    c,
    'naver',
    nu.response.id,
    nu.response.nickname ?? nu.response.name ?? '네이버 사용자',
    nu.response.profile_image ?? null,
    nu.response.email ?? null,
  );
  return c.redirect('/');
});

// ── Auth: Google OAuth ──────────────────────────────────────────────

app.get('/auth/google', (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID.startsWith('TODO')) {
    return c.json({ error: 'google_not_configured' }, 503);
  }
  const state = setOAuthState(c);
  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

app.get('/auth/google/callback', async (c) => {
  const { code, state, error } = c.req.query();
  if (error) return c.redirect(`/login?error=${encodeURIComponent(error)}`);
  if (!code || !state) return c.redirect('/login?error=missing_code');
  if (!consumeOAuthState(c, state)) return c.redirect('/login?error=state_mismatch');

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.redirect('/login?error=not_configured');

  const origin = new URL(c.req.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;

  const tokenForm = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenForm.toString(),
  });
  const tokenBody = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenBody.access_token) {
    return c.redirect(`/login?error=token_${encodeURIComponent(tokenBody.error ?? 'unknown')}`);
  }

  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
  });
  const gu = (await userRes.json()) as {
    sub?: string;
    name?: string;
    picture?: string;
    email?: string;
  };
  if (!gu.sub) return c.redirect('/login?error=user_fetch_failed');

  await upsertUserAndIssueSession(
    c,
    'google',
    gu.sub,
    gu.name ?? '구글 사용자',
    gu.picture ?? null,
    gu.email ?? null,
  );
  return c.redirect('/');
});

// GET /api/places — list places with live vote counts.
// Cached at the edge for ~30s (per-place "my vote" is fetched separately
// via /places/:id, which is uncacheable). LIMIT is bounded to keep D1
// row reads predictable; popularity-sorted feed is intentionally not
// keyset-paginated yet (popularity changes every vote).
app.get('/places', async (c) => {
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `SELECT
       p.id, p.name, p.type, p.district, p.detail, p.created_at,
       COALESCE(SUM(CASE WHEN v.vote='cold' AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS cold,
       COALESCE(SUM(CASE WHEN v.vote='ok'   AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS ok,
       COALESCE(SUM(CASE WHEN v.vote='hot'  AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS hot
     FROM places p
     LEFT JOIN votes v ON v.place_id = p.id
     GROUP BY p.id
     ORDER BY (cold + ok + hot) DESC, p.created_at DESC
     LIMIT 100`
  )
    .bind(now)
    .all<PlaceWithCounts>();
  c.header('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=120');
  c.header('Vary', 'Accept-Encoding');
  return c.json({ places: results });
});

// GET /api/places/:id — one place + my vote
app.get('/places/:id', async (c) => {
  const id = c.req.param('id');
  const now = Date.now();
  const place = await c.env.DB.prepare('SELECT * FROM places WHERE id = ?').bind(id).first<PlaceRow>();
  if (!place) return c.json({ error: 'not_found' }, 404);

  const counts = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN vote='cold' THEN 1 ELSE 0 END), 0) AS cold,
       COALESCE(SUM(CASE WHEN vote='ok'   THEN 1 ELSE 0 END), 0) AS ok,
       COALESCE(SUM(CASE WHEN vote='hot'  THEN 1 ELSE 0 END), 0) AS hot
     FROM votes WHERE place_id = ? AND expires_at > ?`
  )
    .bind(id, now)
    .first<{ cold: number; ok: number; hot: number }>();

  const me = await c.env.DB.prepare(
    'SELECT vote, voted_at, changed_at, expires_at FROM votes WHERE place_id = ? AND voter_id = ? AND expires_at > ?'
  )
    .bind(id, c.get('voterId'), now)
    .first<MyVoteRow>();

  return c.json({
    place,
    votes: counts ?? { cold: 0, ok: 0, hot: 0 },
    me: me
      ? {
          vote: me.vote,
          voted_at: me.voted_at,
          changed_at: me.changed_at,
          expires_at: me.expires_at,
          cooldown_remaining_ms: Math.max(0, COOLDOWN_MS - (now - me.changed_at)),
        }
      : null,
  });
});

// POST /api/places — register a new place
app.post('/places', async (c) => {
  let body: { name?: unknown; type?: unknown; district?: unknown; detail?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const { keys, log } = await abuseFor(c);

  if (await isKillSwitchOn(c.env.DB, 'place_creation_closed')) {
    await log('kill_switch', 503, { reason: 'place_creation_closed' });
    return c.json({ error: 'temporarily_closed' }, 503);
  }
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { reason: 'blocked_subject' });
    return c.json({ error: 'forbidden' }, 403);
  }

  const limits = await checkLimits(c.env.DB, [
    { key: `place:voter:${keys.voterHash}`, windowSeconds: 86400, limit: 5 },
    { key: `place:ip:${keys.ipPrefixHash}`, windowSeconds: 86400, limit: 30 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { reason: limits.failedKey });
    return c.json({ error: 'too_many_requests' }, 429);
  }

  const v = validatePlaceInput(body);
  if (!v.ok) {
    await log('rejected', 400, { reason: v.error });
    return c.json({ error: v.error }, 400);
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO places (id, name, type, district, detail, created_at, created_by, normalized_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, v.name, v.type, v.district, v.detail, now, c.get('voterId'), v.normalized)
    .run();

  await log('place_create', 201, { placeId: id, meta: { type: v.type } });
  return c.json({ id, name: v.name, type: v.type, district: v.district, detail: v.detail, created_at: now }, 201);
});

// POST /api/places/upsert — idempotent create (used for lazy subway station materialization)
// Caller passes a deterministic id like "subway:강남:2호선,신분당선"; we require
// the id to be prefixed with the declared type so a `type: 'cafe'` body can't
// claim a `subway:…` id.
const UPSERT_ID_RE = /^[a-z]+:[\p{L}\p{N}\s,()/:·.\-]{1,180}$/u;

app.post('/places/upsert', async (c) => {
  let body: { id?: unknown; name?: unknown; type?: unknown; district?: unknown; detail?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const { keys, log } = await abuseFor(c);

  if (await isKillSwitchOn(c.env.DB, 'place_creation_closed')) {
    await log('kill_switch', 503, { reason: 'place_creation_closed' });
    return c.json({ error: 'temporarily_closed' }, 503);
  }
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { reason: 'blocked_subject' });
    return c.json({ error: 'forbidden' }, 403);
  }

  // Upsert is normal user behaviour (loading several subway stations), so
  // the cap is per-minute rather than per-day. The hard guard is the
  // id-prefix check below.
  const limits = await checkLimits(c.env.DB, [
    { key: `upsert:voter:${keys.voterHash}`, windowSeconds: 60, limit: 60 },
    { key: `upsert:ip:${keys.ipPrefixHash}`, windowSeconds: 60, limit: 300 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { reason: limits.failedKey });
    return c.json({ error: 'too_many_requests' }, 429);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';

  if (!id || id.length > 200) {
    await log('rejected', 400, { reason: 'invalid_id' });
    return c.json({ error: 'invalid_id' }, 400);
  }
  if (!VALID_PLACE_TYPES.has(type)) {
    await log('rejected', 400, { reason: 'invalid_type' });
    return c.json({ error: 'invalid_type' }, 400);
  }
  if (!UPSERT_ID_RE.test(id) || !id.startsWith(`${type}:`)) {
    await log('rejected', 400, { reason: 'invalid_id_prefix', placeId: id });
    return c.json({ error: 'invalid_id' }, 400);
  }

  const v = validatePlaceInput(body);
  if (!v.ok) {
    await log('rejected', 400, { reason: v.error, placeId: id });
    return c.json({ error: v.error }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO places (id, name, type, district, detail, created_at, created_by, normalized_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  )
    .bind(id, v.name, v.type, v.district, v.detail, Date.now(), c.get('voterId'), v.normalized)
    .run();

  await log('place_upsert', 200, { placeId: id, meta: { type: v.type } });
  return c.json({ id });
});

// POST /api/places/:id/vote — cast or change vote
app.post('/places/:id/vote', async (c) => {
  const id = c.req.param('id');
  let body: { vote?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const vote = body.vote as string;
  if (!VOTE_TYPES.includes(vote as VoteType)) return c.json({ error: 'invalid_vote' }, 400);

  const { keys, log } = await abuseFor(c);

  if (await isKillSwitchOn(c.env.DB, 'votes_closed')) {
    await log('kill_switch', 503, { placeId: id, reason: 'votes_closed' });
    return c.json({ error: 'temporarily_closed' }, 503);
  }
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { placeId: id, reason: 'blocked_subject' });
    return c.json({ error: 'forbidden' }, 403);
  }

  const limits = await checkLimits(c.env.DB, [
    { key: `vote:voter:${keys.voterHash}`, windowSeconds: 60, limit: 10 },
    { key: `vote:ip:${keys.ipPrefixHash}`, windowSeconds: 60, limit: 120 },
    { key: `vote:place_ip:${id}:${keys.ipPrefixHash}`, windowSeconds: 3600, limit: 80 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { placeId: id, reason: limits.failedKey });
    return c.json({ error: 'too_many_requests' }, 429);
  }

  const voterId = keys.voterId;
  const now = Date.now();

  const place = await c.env.DB.prepare('SELECT id FROM places WHERE id = ?').bind(id).first();
  if (!place) {
    await log('rejected', 404, { placeId: id, reason: 'not_found' });
    return c.json({ error: 'not_found' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT vote, changed_at FROM votes WHERE place_id = ? AND voter_id = ? AND expires_at > ?'
  )
    .bind(id, voterId, now)
    .first<{ vote: VoteType; changed_at: number }>();

  if (existing && existing.vote !== vote) {
    const elapsed = now - existing.changed_at;
    if (elapsed < COOLDOWN_MS) {
      await log('rejected', 429, { placeId: id, reason: 'cooldown' });
      return c.json({ error: 'cooldown', remaining_ms: COOLDOWN_MS - elapsed }, 429);
    }
  }

  const expiresAt = now + EXPIRY_MS;
  // First-time vote has no cooldown anchor (changed_at = 0).
  // Subsequent CHANGES set changed_at = now via the ON CONFLICT clause.
  const initialChangedAt = existing ? existing.changed_at : 0;
  await c.env.DB.prepare(
    `INSERT INTO votes (place_id, voter_id, vote, voted_at, changed_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(place_id, voter_id) DO UPDATE SET
       vote = excluded.vote,
       voted_at = excluded.voted_at,
       changed_at = CASE WHEN votes.vote <> excluded.vote THEN excluded.voted_at ELSE votes.changed_at END,
       expires_at = excluded.expires_at`
  )
    .bind(id, voterId, vote, now, initialChangedAt, expiresAt)
    .run();

  await log('vote', 200, { placeId: id, meta: { vote, changed: !!existing } });
  return c.json({ ok: true, vote, expires_at: expiresAt });
});

// DELETE /api/places/:id/vote — withdraw own vote (used by PlaceCorrectionBar)
app.delete('/places/:id/vote', async (c) => {
  const id = c.req.param('id');
  const { keys, log } = await abuseFor(c);
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { placeId: id, reason: 'blocked_subject' });
    return c.json({ error: 'forbidden' }, 403);
  }
  const limits = await checkLimits(c.env.DB, [
    { key: `vote_delete:voter:${keys.voterHash}`, windowSeconds: 60, limit: 20 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { placeId: id, reason: limits.failedKey });
    return c.json({ error: 'too_many_requests' }, 429);
  }
  const res = await c.env.DB.prepare('DELETE FROM votes WHERE place_id = ? AND voter_id = ?')
    .bind(id, keys.voterId)
    .run();
  const removed = (res.meta?.changes ?? 0) > 0;
  await log('vote_delete', 200, { placeId: id, meta: { removed } });
  return c.json({ ok: true, removed });
});

// 404 for unknown /api/* routes
app.notFound((c) => c.json({ error: 'not_found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export const onRequest = handle(app);
