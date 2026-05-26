/// <reference types="@cloudflare/workers-types" />
// Top-level Hono app — middleware + route module 조립만.
// 실제 endpoint 로직은 routes/{auth,places,votes,realtime}.ts에.

import { Hono } from 'hono';
import { csrfGuard } from './_abuse';
import { voterCookieMiddleware } from './cookies';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { placesRoutes } from './routes/places';
import { votesRoutes } from './routes/votes';
import { realtimeRoutes } from './routes/realtime';

const app = new Hono<Env>().basePath('/api');

// 1. Voter cookie — 첫 요청에 UUID 발급 + 서명. 이후 c.get('voterId') 가능.
app.use('*', voterCookieMiddleware);

// 2. CSRF/Origin guard for mutating requests. Exempts OAuth callbacks (_abuse.ts).
app.use('*', csrfGuard());

// 3. Route modules. 순서는 명시적이지만 prefix가 안 겹치므로 register 순서는 무관.
app.route('/', authRoutes);       // /me, /auth/*, /health
app.route('/', placesRoutes);     // /places, /places/:id, /places/upsert
app.route('/', votesRoutes);      // /places/:id/vote POST/DELETE
app.route('/', realtimeRoutes);   // /realtime/subway/match, /realtime/bus/match

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  console.error('[api error]', err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

export default app;
