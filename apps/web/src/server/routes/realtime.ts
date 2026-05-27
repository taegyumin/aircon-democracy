// /realtime/subway/match (swopenAPI), /realtime/bus/match (data.go.kr).
// 외부 API 키는 prod에 wrangler secret으로 주입 (SEOUL_REALTIME_KEY, DATAGOKR_BUS_KEY).

import { Hono } from 'hono';
import { expectedUpdnLine, LINE_SEQUENCES, stripStation } from '@aircon/core/subwayDirection';
import { estimateProgress } from '@aircon/core';
import {
  SubwayMatchBodySchema, BusMatchBodySchema,
  BusRouteSearchQuerySchema, BusRouteStationsQuerySchema, BusRegionByCoordsQuerySchema,
  PoiSearchQuerySchema,
} from '@aircon/core/validation';
import { regionByName, SEOUL_REGION } from '@aircon/core';
import { parseBusRegion, providerFor } from '../busProviders';
import { naverProvider, kakaoProvider, searchPoiCombined } from '../poiProviders';
import { isBlocked, isKillSwitchOn, checkLimits } from '../_abuse';
import { abuseFor } from '../abuse-adapter';
import type { Env } from '../types';
import type { Context } from 'hono';

export const realtimeRoutes = new Hono<Env>();

// 외부 API quota + 봇 방어. CSRF header는 봇 막지 못함 (LLM 리뷰 P2).
// 한 voter/IP가 분당 너무 많이 치면 swopenAPI/data.go.kr quota 소진 위험.
// kill switch `realtime_closed`로 외부 API 장애 시 즉시 차단 가능.
async function realtimeGuard(c: Context<Env>): Promise<{ ok: true } | { ok: false; res: Response }> {
  const { keys, log } = await abuseFor(c);
  if (await isKillSwitchOn(c.env.DB, 'realtime_closed')) {
    await log('kill_switch', 503, { reason: 'realtime_closed' });
    return { ok: false, res: c.json({ matched: false, reason: 'temporarily_closed' }, 503) };
  }
  if ((await isBlocked(c.env.DB, keys.voterHash)) || (await isBlocked(c.env.DB, keys.ipPrefixHash))) {
    await log('rejected', 403, { reason: 'blocked_subject' });
    return { ok: false, res: c.json({ matched: false, reason: 'forbidden' }, 403) };
  }
  // realtime은 vote보다 자주 칠 가능성 적음 — 분당 voter 20, IP 100.
  const limits = await checkLimits(c.env.DB, [
    { key: `realtime:voter:${keys.voterHash}`, windowSeconds: 60, limit: 20 },
    { key: `realtime:ip:${keys.ipPrefixHash}`, windowSeconds: 60, limit: 100 },
  ]);
  if (!limits.ok) {
    await log('rate_limited', 429, { reason: limits.failedKey });
    return { ok: false, res: c.json({ matched: false, reason: 'too_many_requests' }, 429) };
  }
  return { ok: true };
}

// 외부 공공 API timeout. worker CPU 시간 (30s) 소진 방지.
// swopenAPI/data.go.kr이 가끔 응답이 매우 늦거나 HTML 에러 페이지를 줌.
const UPSTREAM_TIMEOUT_MS = 2000;

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

// ── Subway (swopenAPI) ─────────────────────────────────────────────
//
// swopenAPI URL은 path에 한글 노선명(body.line)을 그대로 받음.
// 과거에는 LINE_TO_SUBWAY_ID(1001~1009) 화이트리스트로 1~9호선만 허용했지만
// (1) 그 ID들이 URL에 사용되지도 않았고 (2) swopenAPI sample 예시에 서해선 등도 등장 —
// 신림선/신분당선/우이신설선 같은 비-1~9호선이 임의로 막혀 있을 이유가 없음.
// 노선이 swopenAPI에 데이터가 없으면 자연스럽게 'no_train_at_segment'로 떨어짐.

function normStation(s: string): string {
  return s.endsWith('역') ? s.slice(0, -1) : s;
}

realtimeRoutes.post('/realtime/subway/match', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;

  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = SubwayMatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const key = (c.env as unknown as { SEOUL_REALTIME_KEY?: string }).SEOUL_REALTIME_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  // prev→next가 어느 updnLine 방향인지 결정 (반대 방향 차량 거름).
  const expectedDir = expectedUpdnLine(body.line, body.prev, body.next);
  try {
    const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(body.line)}`;
    const res = await timedFetch(url);
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
    // 진행도 추정 — UI의 mini-train slider 표시용 (시안 A).
    const { progress, progressLabel } = estimateProgress({
      prev: body.prev,
      next: body.next,
      statnNm: picked.statnNm,
      trainSttus: picked.trainSttus,
    });
    return c.json({
      matched: true,
      trainNo: picked.trainNo,
      direction: picked.updnLine === '0' ? 'up' : 'down',
      currentStation: picked.statnNm,
      destination: picked.statnTnm,
      progress,
      progressLabel,
    });
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// ── Bus (data.go.kr) ───────────────────────────────────────────────
// region 분기: 'seoul' (ws.bus.go.kr) / TAGO cityCode (apis.data.go.kr/1613000).
// Provider 추상화 → apps/web/src/server/busProviders.ts (BusProvider 인터페이스).

// GPS 좌표 → region. NCP Reverse Geocoding API 래핑.
// 응답의 region.area1.name(시·도) + region.area2.name(시·군·구) 받아 busRegion.regionByName으로 매핑.
//   서울특별시 → 'seoul' (ws.bus.go.kr 분기).
//   광역시(부산/대구/…) → area1만으로 매칭.
//   경기/강원/… → area2(시·군) 우선 매칭 (TAGO는 시·군 단위 cityCode).
realtimeRoutes.get('/realtime/bus/region-by-coords', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRegionByCoordsQuerySchema.safeParse({ lat: c.req.query('lat'), lng: c.req.query('lng') });
  if (!parsed.success) return c.json({ region: null, reason: 'invalid_coords' }, 400);
  const { lat, lng } = parsed.data;
  // prod env: NCP_MAPS_CLIENT_ID 또는 VITE_NCP_MAPS_CLIENT_ID 둘 중 어느 거든 OK.
  const env = c.env as unknown as {
    NCP_MAPS_CLIENT_ID?: string; VITE_NCP_MAPS_CLIENT_ID?: string; NCP_MAPS_CLIENT_SECRET?: string;
  };
  const id = env.NCP_MAPS_CLIENT_ID ?? env.VITE_NCP_MAPS_CLIENT_ID;
  const secret = env.NCP_MAPS_CLIENT_SECRET;
  if (!id || !secret) return c.json({ region: null, reason: 'no_ncp_key' });
  try {
    const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&orders=admcode&output=json`;
    const res = await timedFetch(url, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': id,
        'X-NCP-APIGW-API-KEY': secret,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return c.json({ region: null, reason: `upstream_${res.status}` });
    interface NcpResponse {
      results?: Array<{
        region?: {
          area1?: { name?: string };
          area2?: { name?: string };
        };
      }>;
    }
    const body = (await res.json()) as NcpResponse;
    const r = body.results?.[0]?.region;
    const sidoName = r?.area1?.name ?? '';
    const sigunguName = r?.area2?.name ?? '';
    // 매칭 우선순위: 시·군(area2) > 시·도(area1). 시·군이 TAGO cityCode와 직결.
    const fromSigungu = sigunguName ? regionByName(sigunguName) : null;
    const fromSido = sidoName ? regionByName(sidoName) : null;
    const matched = fromSigungu ?? fromSido;
    if (!matched) return c.json({ region: null, sidoName, sigunguName, reason: 'unmapped' });
    return c.json({ region: matched === SEOUL_REGION ? 'seoul' : String(matched), sidoName, sigunguName });
  } catch (e) {
    return c.json({ region: null, reason: (e as Error).message });
  }
});

// 노선 자동완성 — region 별 provider dispatch.
realtimeRoutes.get('/realtime/bus/route-search', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteSearchQuerySchema.safeParse({ q: c.req.query('q'), region: c.req.query('region') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const { q } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ routes: [], reason: 'no_api_key' });
  try {
    const routes = await providerFor(parseBusRegion(parsed.data.region)).searchRoutes(q, key);
    return c.json({ routes });
  } catch (e) {
    return c.json({ routes: [], reason: (e as Error).message });
  }
});

// 노선 정류장 sequence — region 별 provider dispatch.
realtimeRoutes.get('/realtime/bus/route-stations', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteStationsQuerySchema.safeParse({ routeId: c.req.query('routeId'), region: c.req.query('region') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ stations: [], reason: 'no_api_key' });
  try {
    const stations = await providerFor(parseBusRegion(parsed.data.region)).listStations(parsed.data.routeId, key);
    return c.json({ stations });
  } catch (e) {
    return c.json({ stations: [], reason: (e as Error).message });
  }
});

// 차량 위치 매칭 — region 별 provider dispatch.
realtimeRoutes.post('/realtime/bus/match', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = BusMatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const { routeName, stopName, routeId: passedRouteId } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  try {
    const result = await providerFor(parseBusRegion(parsed.data.region))
      .matchVehicle(routeName, stopName, key, passedRouteId);
    return c.json(result);
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// POI (카페·음식점) 검색 — NAVER Search Local + Kakao Local 동시 호출, dedup된 결과 반환.
// 한쪽 키 없으면 그쪽 skip. 둘 다 실패해도 5xx 안 띄움 (UI에서 빈 결과 처리).
realtimeRoutes.get('/realtime/poi/search', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = PoiSearchQuerySchema.safeParse({
    q: c.req.query('q'),
    lat: c.req.query('lat'),
    lng: c.req.query('lng'),
  });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  // NAVER 키는 OAuth(로그인)용과 동일한 application의 ID/Secret 재사용 가능.
  // SEARCH_* override 있으면 우선, 없으면 NAVER_CLIENT_* fallback.
  const env = c.env as unknown as {
    NAVER_SEARCH_CLIENT_ID?: string;
    NAVER_SEARCH_CLIENT_SECRET?: string;
    NAVER_CLIENT_ID?: string;
    NAVER_CLIENT_SECRET?: string;
    KAKAO_REST_API_KEY?: string;
  };
  const naverId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID;
  const naverSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET;
  const providers: { naver?: ReturnType<typeof naverProvider>; kakao?: ReturnType<typeof kakaoProvider> } = {};
  if (naverId && naverSecret) {
    providers.naver = naverProvider(naverId, naverSecret);
  }
  if (env.KAKAO_REST_API_KEY) {
    providers.kakao = kakaoProvider(env.KAKAO_REST_API_KEY);
  }
  if (!providers.naver && !providers.kakao) {
    return c.json({ results: [], reason: 'no_api_key' });
  }
  try {
    const results = await searchPoiCombined(parsed.data.q, { lat: parsed.data.lat, lng: parsed.data.lng }, providers);
    return c.json({ results });
  } catch (e) {
    return c.json({ results: [], reason: (e as Error).message });
  }
});
