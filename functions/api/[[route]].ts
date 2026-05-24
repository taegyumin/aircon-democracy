/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign as jwtSign, verify as jwtVerify } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
  SESSION_SECRET: string;
  KAKAO_REST_API_KEY?: string;
  KAKAO_CLIENT_SECRET?: string;
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

// GET /api/places — list places with live vote counts
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
     LIMIT 200`
  )
    .bind(now)
    .all<PlaceWithCounts>();
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const district = typeof body.district === 'string' ? body.district.trim() || null : null;
  const detail = typeof body.detail === 'string' ? body.detail.trim() || null : null;

  if (!name || name.length > 120) return c.json({ error: 'invalid_name' }, 400);
  if (!PLACE_TYPES.includes(type as PlaceType)) return c.json({ error: 'invalid_type' }, 400);
  if (district && district.length > 60) return c.json({ error: 'invalid_district' }, 400);
  if (detail && detail.length > 200) return c.json({ error: 'invalid_detail' }, 400);

  const id = crypto.randomUUID();
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO places (id, name, type, district, detail, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, name, type, district, detail, now, c.get('voterId'))
    .run();

  return c.json({ id, name, type, district, detail, created_at: now }, 201);
});

// POST /api/places/upsert — idempotent create (used for lazy subway station materialization)
app.post('/places/upsert', async (c) => {
  let body: { id?: unknown; name?: unknown; type?: unknown; district?: unknown; detail?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const district = typeof body.district === 'string' ? body.district.trim() || null : null;
  const detail = typeof body.detail === 'string' ? body.detail.trim() || null : null;

  if (!id || id.length > 200) return c.json({ error: 'invalid_id' }, 400);
  if (!name || name.length > 120) return c.json({ error: 'invalid_name' }, 400);
  if (!PLACE_TYPES.includes(type as PlaceType)) return c.json({ error: 'invalid_type' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO places (id, name, type, district, detail, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  )
    .bind(id, name, type, district, detail, Date.now(), c.get('voterId'))
    .run();

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

  const voterId = c.get('voterId');
  const now = Date.now();

  const place = await c.env.DB.prepare('SELECT id FROM places WHERE id = ?').bind(id).first();
  if (!place) return c.json({ error: 'not_found' }, 404);

  const existing = await c.env.DB.prepare(
    'SELECT vote, changed_at FROM votes WHERE place_id = ? AND voter_id = ? AND expires_at > ?'
  )
    .bind(id, voterId, now)
    .first<{ vote: VoteType; changed_at: number }>();

  if (existing && existing.vote !== vote) {
    const elapsed = now - existing.changed_at;
    if (elapsed < COOLDOWN_MS) {
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

  return c.json({ ok: true, vote, expires_at: expiresAt });
});

// 404 for unknown /api/* routes
app.notFound((c) => c.json({ error: 'not_found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export const onRequest = handle(app);
