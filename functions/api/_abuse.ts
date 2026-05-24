/// <reference types="@cloudflare/workers-types" />
// Cloudflare Pages Functions ignores files starting with `_` for routing,
// so this module is safe to import from [[route]].ts.
import type { Context, MiddlewareHandler } from 'hono';

// ── Environment ─────────────────────────────────────────────────────

export interface AbuseEnv {
  DB: D1Database;
  ABUSE_SECRET: string;
}

// ── HMAC / hashing ──────────────────────────────────────────────────

export async function hmacHex(secret: string, value: string): Promise<string> {
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

// IPv4 → /24, IPv6 → first 4 groups (≈ /64). Day-rotating HMAC outside.
export function ipPrefix(ip: string): string {
  if (!ip) return 'unknown';
  if (ip.includes(':')) {
    const groups = ip.split(':').filter(Boolean);
    return groups.length === 0 ? 'unknown' : groups.slice(0, 4).join(':');
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return 'unknown';
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

export interface AbuseKeys {
  voterId: string;
  voterHash: string;
  ipPrefixHash: string;
  uaHash: string;
  ip: string;
  ua: string;
  country: string | null;
  cfRay: string | null;
}

export async function abuseKeys(
  c: Context<{ Bindings: AbuseEnv; Variables: { voterId: string } }>
): Promise<AbuseKeys> {
  const secret = c.env.ABUSE_SECRET ?? '';
  const day = new Date().toISOString().slice(0, 10);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const ua = c.req.header('User-Agent') ?? 'unknown';
  const voterId = c.get('voterId');
  const [voterHash, ipPrefixHash, uaHash] = await Promise.all([
    hmacHex(secret, `voter:${voterId}`),
    hmacHex(secret, `ip:${day}:${ipPrefix(ip)}`),
    hmacHex(secret, `ua:${ua}`),
  ]);
  return {
    voterId,
    voterHash,
    ipPrefixHash,
    uaHash,
    ip,
    ua,
    country: c.req.header('CF-IPCountry') ?? null,
    cfRay: c.req.header('CF-Ray') ?? null,
  };
}

// ── Rate limiting ───────────────────────────────────────────────────

// Fixed window counter in D1. Returns true if request is allowed.
// Fixed window is acceptable for our scale (a few writes/sec/place);
// a sliding window would need 2-3× the D1 writes per request.
export async function rateLimit(
  env: AbuseEnv,
  key: string,
  windowSeconds: number,
  limit: number
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expiresAt = windowStart + windowSeconds * 3;

  const row = await env.DB.prepare(
    `INSERT INTO rate_limit_buckets (key, window_start, count, expires_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(key, window_start)
     DO UPDATE SET count = count + 1, expires_at = excluded.expires_at
     RETURNING count`
  )
    .bind(key, windowStart, expiresAt)
    .first<{ count: number }>();

  return (row?.count ?? 1) <= limit;
}

export interface RateLimitSpec {
  key: string;
  windowSeconds: number;
  limit: number;
}

// Check several buckets and report which one (if any) was exceeded.
// All buckets are incremented even on failure — that matches how token-bucket
// abuse scoring works in practice (the attacker's "spend" still counts).
export async function checkLimits(
  env: AbuseEnv,
  specs: RateLimitSpec[]
): Promise<{ ok: boolean; failedKey: string | null }> {
  let failedKey: string | null = null;
  for (const spec of specs) {
    const ok = await rateLimit(env, spec.key, spec.windowSeconds, spec.limit);
    if (!ok && failedKey === null) failedKey = spec.key;
  }
  return { ok: failedKey === null, failedKey };
}

// ── Kill switch ─────────────────────────────────────────────────────

// `value='true'` → permanently closed until row deleted/updated.
// `value='<epoch_ms>'` → closed until that ms.
// `value='false'` or row missing → open.
export async function isKillSwitchOn(env: AbuseEnv, key: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT value FROM app_config WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  if (!row) return false;
  if (row.value === 'true') return true;
  if (row.value === 'false') return false;
  const until = Number(row.value);
  return Number.isFinite(until) && Date.now() < until;
}

export async function isBlocked(env: AbuseEnv, subjectHash: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT expires_at FROM blocked_subjects WHERE subject_hash = ?`
  )
    .bind(subjectHash)
    .first<{ expires_at: number }>();
  if (!row) return false;
  return row.expires_at > Date.now();
}

// ── Audit ───────────────────────────────────────────────────────────

export interface AuditMeta {
  placeId?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(
  c: Context<{ Bindings: AbuseEnv; Variables: { voterId: string } }>,
  eventType: string,
  status: number,
  keys: AbuseKeys,
  info: AuditMeta = {}
): Promise<void> {
  try {
    const url = new URL(c.req.url);
    await c.env.DB.prepare(
      `INSERT INTO audit_events
         (id, ts, event_type, route, method, status,
          place_id, voter_hash, ip_prefix_hash, ua_hash,
          country, cf_ray, reason, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        Date.now(),
        eventType,
        url.pathname,
        c.req.method,
        status,
        info.placeId ?? null,
        keys.voterHash,
        keys.ipPrefixHash,
        keys.uaHash,
        keys.country,
        keys.cfRay,
        info.reason ?? null,
        info.meta ? JSON.stringify(info.meta) : null
      )
      .run();
  } catch (err) {
    // Never fail user request because of audit problems; the abuse policy
    // is "open + audit", not "audit-or-deny". Log and move on.
    console.error('[audit failed]', err);
  }
}

// ── CSRF / Origin guard ─────────────────────────────────────────────

// Production + www. Capacitor app loads https://aircondemocracy.com directly
// (see capacitor.config.ts), so no native-only origins required.
const ALLOWED_ORIGINS = new Set<string>([
  'https://aircondemocracy.com',
  'https://www.aircondemocracy.com',
]);

// Routes that legitimately have no Origin (OAuth top-level redirects).
function isCsrfExempt(pathname: string): boolean {
  return pathname.startsWith('/api/auth/kakao'); // covers /auth/kakao and /auth/kakao/callback
}

// Local dev (vite, wrangler pages dev) typically uses http://localhost:* —
// allow any localhost origin only when CF-Ray header is missing (= not edge).
function isAllowedOrigin(origin: string, cfRay: string | null): boolean {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (!cfRay && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

export function csrfGuard(): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

    const url = new URL(c.req.url);
    if (isCsrfExempt(url.pathname)) return next();

    const origin = c.req.header('Origin') ?? '';
    const intent = c.req.header('X-Aircon-Intent') ?? '';
    const cfRay = c.req.header('CF-Ray') ?? null;

    if (!origin || !isAllowedOrigin(origin, cfRay) || intent !== 'user-action') {
      return c.json({ error: 'forbidden', reason: 'csrf_origin' }, 403);
    }
    return next();
  };
}

// ── Place input validation ──────────────────────────────────────────

export const VALID_PLACE_TYPES = new Set<string>([
  'classroom',
  'subway',
  'train',
  'cafe',
  'bus',
  'library',
  'office',
  'other',
]);

// URLs, KR phone numbers, common spam/contact keywords.
const BAD_NAME =
  /(https?:\/\/|www\.|010[-\s]?\d{3,4}[-\s]?\d{4}|\d{2,3}-\d{3,4}-\d{4}|카톡|오픈채팅|텔레그램|무료\s*상담|상담\s*문의)/i;

export function normalizePlaceName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PlaceInputResult {
  ok: true;
  name: string;
  type: string;
  district: string | null;
  detail: string | null;
  normalized: string;
}

export type PlaceValidationError =
  | 'invalid_json'
  | 'invalid_name_length'
  | 'invalid_type'
  | 'invalid_district'
  | 'invalid_detail'
  | 'blocked_name_pattern'
  | 'repeated_chars'
  | 'empty_normalized_name';

export function validatePlaceInput(
  body: { name?: unknown; type?: unknown; district?: unknown; detail?: unknown }
): PlaceInputResult | { ok: false; error: PlaceValidationError } {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const type = typeof body.type === 'string' ? body.type : '';
  const district = typeof body.district === 'string' ? body.district.trim() || null : null;
  const detail = typeof body.detail === 'string' ? body.detail.trim() || null : null;

  if (!VALID_PLACE_TYPES.has(type)) return { ok: false, error: 'invalid_type' };
  if (name.length < 2 || name.length > 40) return { ok: false, error: 'invalid_name_length' };
  if (BAD_NAME.test(name)) return { ok: false, error: 'blocked_name_pattern' };
  if (/(.)\1{6,}/u.test(name)) return { ok: false, error: 'repeated_chars' };
  if (district && district.length > 60) return { ok: false, error: 'invalid_district' };
  if (detail && detail.length > 80) return { ok: false, error: 'invalid_detail' };

  const normalized = normalizePlaceName(name);
  if (!normalized) return { ok: false, error: 'empty_normalized_name' };

  return { ok: true, name, type, district, detail, normalized };
}
