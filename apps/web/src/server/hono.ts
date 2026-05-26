/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { expectedUpdnLine, LINE_SEQUENCES, stripStation } from '@aircon/core/subwayDirection';
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
  validateUpsertPlaceInput,
  type AbuseKeys,
  type AuditContext,
  type AuditMeta,
} from './_abuse';
import { SubwayMatchBodySchema, BusMatchBodySchema } from '@aircon/core/validation';
import { OAUTH_PROVIDERS, type OAuthProvider } from './oauth';

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
    const payload = (await jwtVerify(token, c.env.SESSION_SECRET, 'HS256')) as { uid?: string };
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

// ── OAuth helpers ───────────────────────────────────────────────────

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
  const sessionJwt = await jwtSign({ uid: userId, exp: expSeconds }, c.env.SESSION_SECRET, 'HS256');
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

// ── Auth: OAuth (kakao/naver/google) — provider-driven ──────────────
// 3개 provider의 authorize → token-exchange → userinfo 패턴이 동일.
// 각 provider 구현은 oauth/{kakao,naver,google}.ts. 여기는 generic loop.

function registerOAuthProvider(provider: OAuthProvider): void {
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

for (const p of OAUTH_PROVIDERS) registerOAuthProvider(p);

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
// Caller passes a deterministic id like "subway:강남:2호선,신분당선"; id-prefix와
// 길이/enum 검증은 Zod의 UpsertPlaceBodySchema가 담당 (validation.ts SOT).
app.post('/places/upsert', async (c) => {
  let body: unknown;
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
  // the cap is per-minute rather than per-day.
  const limits = await checkLimits(c.env.DB, [
    { key: `upsert:voter:${keys.voterHash}`, windowSeconds: 60, limit: 60 },
    { key: `upsert:ip:${keys.ipPrefixHash}`, windowSeconds: 60, limit: 300 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { reason: limits.failedKey });
    return c.json({ error: 'too_many_requests' }, 429);
  }

  const v = validateUpsertPlaceInput(body);
  if (!v.ok) {
    await log('rejected', 400, { reason: v.error });
    return c.json({ error: v.error }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO places (id, name, type, district, detail, created_at, created_by, normalized_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`
  )
    .bind(v.id, v.name, v.type, v.district, v.detail, Date.now(), c.get('voterId'), v.normalized)
    .run();

  await log('place_upsert', 200, { placeId: v.id, meta: { type: v.type } });
  return c.json({ id: v.id });
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

// ── Realtime: Seoul subway 매칭 ─────────────────────────────────────

const LINE_TO_SUBWAY_ID: Record<string, string> = {
  '1호선': '1001', '2호선': '1002', '3호선': '1003', '4호선': '1004',
  '5호선': '1005', '6호선': '1006', '7호선': '1007', '8호선': '1008', '9호선': '1009',
};

function normStation(s: string): string {
  return s.endsWith('역') ? s.slice(0, -1) : s;
}

app.post('/realtime/subway/match', async (c) => {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = SubwayMatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const subwayId = LINE_TO_SUBWAY_ID[body.line];
  if (!subwayId) return c.json({ matched: false, reason: 'line_not_supported' });
  const key = (c.env as unknown as { SEOUL_REALTIME_KEY?: string }).SEOUL_REALTIME_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  // prev→next가 어느 updnLine 방향인지 결정 (반대 방향 차량 거름).
  const expectedDir = expectedUpdnLine(body.line, body.prev, body.next);
  try {
    const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(body.line)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const data = (await res.json()) as { realtimePositionList?: Array<{ subwayId: string; statnNm: string; trainSttus: string; updnLine: string; trainNo: string; statnTnm?: string }> };
    let rows = data.realtimePositionList ?? [];
    if (expectedDir !== null) {
      rows = rows.filter((r) => r.updnLine === expectedDir);
    }
    const p = normStation(body.prev);
    const n = normStation(body.next);
    // 1차: 정확 매칭 (next 진입/도착 > prev 출발 > prev 정차 > next 정차)
    const atNextEntering = rows.filter((r) => normStation(r.statnNm) === n && (r.trainSttus === '0' || r.trainSttus === '1'));
    const justLeftPrev   = rows.filter((r) => normStation(r.statnNm) === p && r.trainSttus === '2');
    const atPrev         = rows.filter((r) => normStation(r.statnNm) === p && (r.trainSttus === '0' || r.trainSttus === '1'));
    const atNextAny      = rows.filter((r) => normStation(r.statnNm) === n);
    let picked: typeof rows[0] | undefined = atNextEntering[0] ?? justLeftPrev[0] ?? atPrev[0] ?? atNextAny[0];

    // 2차 (fallback): 정확 매칭 실패 시 sequence 거리 기반 ±3 정거장 내 가장 가까운 차량.
    // 차량 헤드웨이가 길어 prev/next에 차량 없을 때 사용. 같은 방향(이미 필터됨) 보장.
    if (!picked) {
      const seq = LINE_SEQUENCES[body.line];
      if (seq) {
        const pi = seq.indexOf(p);
        const ni = seq.indexOf(n);
        if (pi >= 0 && ni >= 0) {
          let bestDist = 4;
          for (const r of rows) {
            const idx = seq.indexOf(stripStation(r.statnNm));
            if (idx < 0) continue;
            const d = Math.min(Math.abs(idx - pi), Math.abs(idx - ni));
            if (d < bestDist) { picked = r; bestDist = d; }
          }
        }
      }
    }

    if (!picked) return c.json({ matched: false, reason: 'no_train_at_segment' });
    return c.json({
      matched: true,
      trainNo: picked.trainNo,
      direction: picked.updnLine === '0' ? 'up' : 'down',
      currentStation: picked.statnNm,
      destination: picked.statnTnm,
    });
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// ── Realtime: 버스 차량 매칭 (data.go.kr) ──────────────────────────

interface BusRouteItem { busRouteId: string; busRouteNm: string; routeType: string }
interface BusStationItem { stationNm: string; seq: string }
interface BusPosItem { vehId: string; plainNo: string; busType: string; stOrd: string; stopFlag: string; busRouteId: string }

function normStop(s: string): string {
  return s.replace(/[\s,·.()-]/g, '').toLowerCase();
}

async function fetchBusJson<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const text = await res.text();
  const body = JSON.parse(text) as { msgHeader?: { headerCd: string; headerMsg: string }; msgBody?: { itemList?: T[] | T | null } };
  const header = body.msgHeader ?? { headerCd: '?', headerMsg: 'no header' };
  if (header.headerCd !== '0' && header.headerCd !== '4') {
    throw new Error(`api_${header.headerCd}_${header.headerMsg}`);
  }
  const raw = body.msgBody?.itemList;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

app.post('/realtime/bus/match', async (c) => {
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = BusMatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const { routeName, stopName } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  const HOST = 'http://ws.bus.go.kr/api/rest';
  try {
    const routes = await fetchBusJson<BusRouteItem>(
      `${HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(routeName)}&resultType=json`
    );
    routes.sort((a, b) => (a.busRouteNm === routeName ? 0 : 1) - (b.busRouteNm === routeName ? 0 : 1));
    const target = normStop(stopName);
    for (const route of routes) {
      try {
        const stations = await fetchBusJson<BusStationItem>(
          `${HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`
        );
        const hit = stations.find((s) => normStop(s.stationNm).includes(target) || target.includes(normStop(s.stationNm)));
        if (!hit) continue;
        const stopSeq = parseInt(hit.seq, 10);
        const positions = await fetchBusJson<BusPosItem>(
          `${HOST}/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`
        );
        const atStopFlagged = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq && p.stopFlag === '1');
        const atStop = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq);
        const justBefore = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq - 1);
        const veh = atStopFlagged ?? atStop ?? justBefore;
        if (!veh) {
          return c.json({ matched: false, reason: 'no_vehicle_at_stop', routeId: route.busRouteId, routeName: route.busRouteNm, currentStop: hit.stationNm });
        }
        const nextStation = stations.find((s) => parseInt(s.seq, 10) === stopSeq + 1);
        return c.json({
          matched: true,
          vehId: veh.vehId,
          plainNo: veh.plainNo,
          routeId: route.busRouteId,
          routeName: route.busRouteNm,
          routeType: route.routeType,
          currentStop: hit.stationNm,
          nextStop: nextStation?.stationNm,
        });
      } catch { /* try next candidate */ }
    }
    return c.json({ matched: false, reason: 'route_or_stop_not_found' });
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// 404 for unknown /api/* routes
app.notFound((c) => c.json({ error: 'not_found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export default app;
