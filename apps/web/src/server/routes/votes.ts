// /places/:id/vote — POST(cast or change) / DELETE(withdraw).

import { Hono } from 'hono';
import { PostVoteBodySchema } from '@aircon/core';
import { isBlocked, isKillSwitchOn, checkLimits } from '../_abuse';
import { abuseFor } from '../abuse-adapter';
import { COOLDOWN_MS, EXPIRY_MS, type VoteType, type Env } from '../types';

export const votesRoutes = new Hono<Env>();

// POST /api/places/:id/vote — cast or change vote
votesRoutes.post('/places/:id/vote', async (c) => {
  const id = c.req.param('id');
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = PostVoteBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_vote' }, 400);
  const vote: VoteType = parsed.data.vote;

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
    'SELECT vote, changed_at FROM votes WHERE place_id = ? AND voter_id = ? AND expires_at > ?',
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
  // First-time vote has no cooldown anchor (changed_at = 0). 변경 시에만 changed_at = now.
  const initialChangedAt = existing ? existing.changed_at : 0;
  await c.env.DB.prepare(
    `INSERT INTO votes (place_id, voter_id, vote, voted_at, changed_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(place_id, voter_id) DO UPDATE SET
       vote = excluded.vote,
       voted_at = excluded.voted_at,
       changed_at = CASE WHEN votes.vote <> excluded.vote THEN excluded.voted_at ELSE votes.changed_at END,
       expires_at = excluded.expires_at`,
  )
    .bind(id, voterId, vote, now, initialChangedAt, expiresAt)
    .run();

  await log('vote', 200, { placeId: id, meta: { vote, changed: !!existing } });
  return c.json({ ok: true, vote, expires_at: expiresAt });
});

// DELETE /api/places/:id/vote — withdraw own vote
votesRoutes.delete('/places/:id/vote', async (c) => {
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
