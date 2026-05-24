/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { getCookie, setCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  COOKIE_SECRET: string;
};

type Vars = { voterId: string };

const COOKIE_NAME = 'voter';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const COOLDOWN_MS = 30_000;
const EXPIRY_MS = 60 * 60 * 1000;
const VOTE_TYPES = ['cold', 'ok', 'hot'] as const;
const PLACE_TYPES = ['classroom', 'subway', 'cafe', 'bus', 'library', 'office', 'other'] as const;
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
