// /places list, get, create, upsert.
// Read 경로(list/get)는 abuse 검증 없음 — 캐시 + 익명 조회용.
// Write 경로는 abuseFor → kill switch → block → rate limit → validate → DB.

import { Hono } from 'hono';
import {
  isBlocked,
  isKillSwitchOn,
  checkLimits,
  validatePlaceInput,
  validateUpsertPlaceInput,
} from '../_abuse';
import { abuseFor } from '../abuse-adapter';
import { COOLDOWN_MS, type Env } from '../types';

interface PlaceRow {
  id: string;
  name: string;
  type: string;
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
  vote: 'cold' | 'ok' | 'hot';
  voted_at: number;
  changed_at: number;
  expires_at: number;
}

export const placesRoutes = new Hono<Env>();

// GET /api/places — list places with live vote counts.
// Cached at the edge for ~30s. Per-place "my vote"는 /places/:id (uncacheable).
// LIMIT 100 — popularity-sorted feed, keyset pagination은 popularity가
// 매 vote마다 바뀌어서 의도적으로 미적용.
placesRoutes.get('/places', async (c) => {
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
     LIMIT 100`,
  )
    .bind(now)
    .all<PlaceWithCounts>();
  c.header('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=120');
  c.header('Vary', 'Accept-Encoding');
  return c.json({ places: results });
});

// GET /api/places/:id — one place + my vote
placesRoutes.get('/places/:id', async (c) => {
  const id = c.req.param('id');
  const now = Date.now();
  const place = await c.env.DB.prepare('SELECT * FROM places WHERE id = ?').bind(id).first<PlaceRow>();
  if (!place) return c.json({ error: 'not_found' }, 404);

  const counts = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN vote='cold' THEN 1 ELSE 0 END), 0) AS cold,
       COALESCE(SUM(CASE WHEN vote='ok'   THEN 1 ELSE 0 END), 0) AS ok,
       COALESCE(SUM(CASE WHEN vote='hot'  THEN 1 ELSE 0 END), 0) AS hot
     FROM votes WHERE place_id = ? AND expires_at > ?`,
  )
    .bind(id, now)
    .first<{ cold: number; ok: number; hot: number }>();

  const me = await c.env.DB.prepare(
    'SELECT vote, voted_at, changed_at, expires_at FROM votes WHERE place_id = ? AND voter_id = ? AND expires_at > ?',
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
placesRoutes.post('/places', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

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
    'INSERT INTO places (id, name, type, district, detail, created_at, created_by, normalized_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(id, v.name, v.type, v.district, v.detail, now, c.get('voterId'), v.normalized)
    .run();

  await log('place_create', 201, { placeId: id, meta: { type: v.type } });
  return c.json({ id, name: v.name, type: v.type, district: v.district, detail: v.detail, created_at: now }, 201);
});

// POST /api/places/upsert — idempotent create (lazy subway station materialization 등).
// id-prefix와 길이/enum 검증은 Zod의 UpsertPlaceBodySchema가 SOT.
placesRoutes.post('/places/upsert', async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }

  const { keys, log } = await abuseFor(c);

  if (await isKillSwitchOn(c.env.DB, 'place_creation_closed')) {
    await log('kill_switch', 503, { reason: 'place_creation_closed' });
    return c.json({ error: 'temporarily_closed' }, 503);
  }
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { reason: 'blocked_subject' });
    return c.json({ error: 'forbidden' }, 403);
  }

  // Upsert는 normal user behaviour (지하철 역 lazy 등록 등). per-minute cap.
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
     ON CONFLICT(id) DO NOTHING`,
  )
    .bind(v.id, v.name, v.type, v.district, v.detail, Date.now(), c.get('voterId'), v.normalized)
    .run();

  await log('place_upsert', 200, { placeId: v.id, meta: { type: v.type } });
  return c.json({ id: v.id });
});
