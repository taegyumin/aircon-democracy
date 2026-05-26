// CSRF / Origin guard integration tests. D1 binding 없이 동작하는 영역만 검증.
//
// 자문 LLM 권장: Phase 0 — Hono integration tests. route handler 직접 fetch로
// 검증해서 회귀 방지 안전망.

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { csrfGuard } from '../_abuse';

function makeApp() {
  const app = new Hono();
  app.use('*', csrfGuard());
  app.get('/get', (c) => c.json({ ok: true }));
  app.post('/mutate', (c) => c.json({ ok: true }));
  return app;
}

describe('csrfGuard', () => {
  let app: ReturnType<typeof makeApp>;
  beforeEach(() => { app = makeApp(); });

  it('GET은 origin 무관하게 통과', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/get'));
    expect(res.status).toBe(200);
  });

  it('POST + 정상 Origin + Intent header 통과', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'https://aircondemocracy.com', 'X-Aircon-Intent': 'user-action' },
    }));
    expect(res.status).toBe(200);
  });

  it('POST + Origin 없으면 403', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { 'X-Aircon-Intent': 'user-action' },
    }));
    expect(res.status).toBe(403);
    const body = await res.json() as { reason?: string };
    expect(body.reason).toBe('csrf_origin');
  });

  it('POST + Intent 헤더 없으면 403', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'https://aircondemocracy.com' },
    }));
    expect(res.status).toBe(403);
  });

  it('POST + 외부 Origin 차단', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com', 'X-Aircon-Intent': 'user-action' },
    }));
    expect(res.status).toBe(403);
  });

  it('POST + Pages preview origin 통과 (*.aircon-democracy-next.pages.dev)', async () => {
    const res = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'https://abc123.aircon-democracy-next.pages.dev', 'X-Aircon-Intent': 'user-action' },
    }));
    expect(res.status).toBe(200);
  });

  it('POST + localhost는 CF-Ray 헤더 없을 때만 (로컬 dev) 통과', async () => {
    const ok = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'X-Aircon-Intent': 'user-action' },
    }));
    expect(ok.status).toBe(200);
    // edge에 도착한 localhost origin (cf-ray 있음)은 차단
    const blocked = await app.fetch(new Request('https://aircondemocracy.com/mutate', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'X-Aircon-Intent': 'user-action', 'CF-Ray': 'fake' },
    }));
    expect(blocked.status).toBe(403);
  });

  it('OAuth callback 경로는 csrf 면제', async () => {
    const app2 = new Hono();
    app2.use('*', csrfGuard());
    app2.get('/api/auth/kakao/callback', (c) => c.json({ ok: true }));
    app2.get('/api/auth/naver/callback', (c) => c.json({ ok: true }));
    app2.get('/api/auth/google/callback', (c) => c.json({ ok: true }));
    for (const p of ['kakao', 'naver', 'google']) {
      const res = await app2.fetch(new Request(`https://aircondemocracy.com/api/auth/${p}/callback?code=x&state=y`));
      expect(res.status).toBe(200);
    }
  });
});
