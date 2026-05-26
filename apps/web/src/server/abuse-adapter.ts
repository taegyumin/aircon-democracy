// Hono Context → _abuse.ts의 primitive-arg helpers를 잇는 adapter.
// _abuse.ts는 의도적으로 Bindings/Variables 의존을 피해서 D1/headers를 직접 받음.
// route들이 매번 같은 boilerplate를 쓰지 않도록 여기서 한 번에 묶는다.

import type { Context } from 'hono';
import { abuseKeys, audit, type AbuseKeys, type AuditContext, type AuditMeta } from './_abuse';
import type { Env } from './types';

export interface AbuseAdapterResult {
  keys: AbuseKeys;
  auditCtx: AuditContext;
  log: (eventType: string, status: number, info?: AuditMeta) => Promise<void>;
}

export async function abuseFor(c: Context<Env>): Promise<AbuseAdapterResult> {
  // Observability seed (LLM 리뷰 P1: D1 hot path 결정 위한 실측 데이터).
  // 모든 audit log entry에 자동으로 handler duration 포함 — 어느 endpoint가
  // 느린지 audit_events.meta.durMs로 사후 분석 가능. D1 query 단위 counter는
  // binding proxy 필요라 risky → duration이 1차 신호.
  const startedAt = Date.now();
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
    log: (eventType, status, info) => {
      const merged: AuditMeta = {
        ...info,
        meta: { ...(info?.meta ?? {}), durMs: Date.now() - startedAt },
      };
      return audit(auditCtx, eventType, status, merged);
    },
  };
}
