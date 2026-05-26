// Catch-all Route Handler — Hono app을 그대로 forward.
// getRequestContext()로 cloudflare bindings (DB, secrets) 주입.

export const runtime = 'edge';

import { getRequestContext } from '@cloudflare/next-on-pages';
import app from '@/server/hono';

async function handler(req: Request) {
  const { env, ctx } = getRequestContext();
  return app.fetch(req, env, ctx);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
