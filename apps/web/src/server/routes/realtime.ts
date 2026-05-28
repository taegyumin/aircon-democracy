// /realtime/subway/match (swopenAPI), /realtime/bus/match (data.go.kr).
// 외부 API 키는 prod에 wrangler secret으로 주입 (SEOUL_REALTIME_KEY, DATAGOKR_BUS_KEY).

import { Hono } from 'hono';
import { expectedUpdnLine, LINE_SEQUENCES, stripStation } from '@aircon/core/subwayDirection';
import { estimateProgress } from '@aircon/core';
import {
  SubwayMatchBodySchema, BusMatchBodySchema,
  BusRouteSearchQuerySchema, BusRouteStationsQuerySchema, BusRouteVehiclesQuerySchema, BusRegionByCoordsQuerySchema,
  PoiSearchQuerySchema,
  TrainVerifyBodySchema, TrainStationsQuerySchema, RegionalSubwaySearchQuerySchema,
  IntercityBusKindSchema, IntercityBusTerminalsQuerySchema, IntercityBusVerifyBodySchema,
} from '@aircon/core/validation';
import { regionByName, SEOUL_REGION } from '@aircon/core';
import { parseBusRegion, providerFor } from '../busProviders';
import { naverProvider, kakaoProvider, searchPoiCombined } from '../poiProviders';
import { trainInfoProvider, subwayInfoProvider, intercityBusProvider } from '../tagoProviders';
import { everlineProvider, EVERLINE_STATIONS } from '../everlineProvider';
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

  // ── 에버라인 분기 (비공식 everlinecu.com) ──────────────────────────
  // swopenAPI 미커버 노선 — 운영사 자체 endpoint 사용. 응답 schema를 swopenAPI 형식과
  // 동일하게 변환해 frontend(SubwayWizard)가 분기 없이 그대로 사용 가능.
  if (body.line === '에버라인') {
    try {
      const vehicles = await everlineProvider.listVehicles();
      const stByName = new Map(EVERLINE_STATIONS.map((s) => [s.name, s]));
      const stripStn = (n: string) => n.endsWith('역') ? n.slice(0, -1) : n;
      const prevS = stByName.get(body.prev) ?? stByName.get(stripStn(body.prev));
      const nextS = stByName.get(body.next) ?? stByName.get(stripStn(body.next));
      if (!prevS || !nextS) return c.json({ matched: false, reason: 'no_train_at_segment' });
      // prevY < nextY → 에버랜드행(updownCode=2), 반대는 기흥행(1).
      const prevY = parseInt(prevS.stCode.slice(1), 10);
      const nextY = parseInt(nextS.stCode.slice(1), 10);
      const expectedDirection: 'everland' | 'giheung' = prevY < nextY ? 'everland' : 'giheung';
      const dirVehicles = vehicles.filter((v) => v.direction === expectedDirection);
      // tier: nextStop 도착/정차 > prev 정차 > 사이.
      const atNext = dirVehicles.filter((v) => v.stCode === nextS.stCode);
      const atPrev = dirVehicles.filter((v) => v.stCode === prevS.stCode);
      let picked: typeof vehicles[0] | undefined;
      let multi: typeof vehicles | null = null;
      for (const tier of [atNext, atPrev]) {
        if (tier.length === 1) { picked = tier[0]; break; }
        if (tier.length >= 2) { multi = tier; break; }
      }
      if (multi) {
        return c.json({
          matched: false, reason: 'multi_candidate',
          candidates: multi.map((v) => ({
            trainNo: v.trainNo,
            currentStation: v.stationName,
            trainSttus: v.status === 'stopped' ? '1' : v.status === 'running' ? '2' : '0',
            direction: expectedDirection === 'giheung' ? 'up' : 'down',
            destination: v.destName,
            progress: 0.5,
            progressLabel: 'between',
          })),
        });
      }
      if (!picked) return c.json({ matched: false, reason: 'no_train_at_segment' });
      return c.json({
        matched: true,
        trainNo: picked.trainNo,
        direction: expectedDirection === 'giheung' ? 'up' : 'down',
        currentStation: picked.stationName,
        destination: picked.destName,
        progress: picked.stCode === nextS.stCode ? 0.95 : 0.2,
        progressLabel: picked.stCode === nextS.stCode ? 'approaching-next' : 'just-left-prev',
      });
    } catch (e) {
      return c.json({ matched: false, reason: (e as Error).message });
    }
  }

  const key = (c.env as unknown as { SEOUL_REALTIME_KEY?: string }).SEOUL_REALTIME_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  // prev→next가 어느 updnLine 방향인지 결정 (반대 방향 차량 거름).
  const expectedDir = expectedUpdnLine(body.line, body.prev, body.next);
  try {
    const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(body.line)}`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const data = (await res.json()) as {
      errorMessage?: { code?: string };
      status?: number;
      code?: string;
      realtimePositionList?: Array<{ subwayId: string; statnNm: string; trainSttus: string; updnLine: string; trainNo: string; statnTnm?: string }>;
    };
    // swopenAPI는 응답 envelope에 code를 errorMessage.code (일반 응답) 또는 root code
    // (status=500 + INFO-200 같은 special 응답) 둘 다로 줌. 양쪽 다 체크.
    const apiCode = data.errorMessage?.code ?? data.code;
    const allRows = data.realtimePositionList ?? [];
    // INFO-200 "해당하는 데이터가 없습니다" — swopenAPI가 이 노선 데이터 자체를 안 가짐
    // (김포골드라인/의정부경전철/용인경전철 등). 운행 시간 무관.
    if (apiCode === 'INFO-200') {
      return c.json({ matched: false, reason: 'realtime_unsupported' });
    }
    // INFO-000 + 0건 = 운행 종료. 서울 도시철도 헤드웨이 5~8분이라 운행 시간대엔 항상
    // 노선당 최소 10대+ 운행 (2호선 한 바퀴 100분 / 5분 = 20대 등). 0대는 사실상 운행 외.
    if (apiCode === 'INFO-000' && allRows.length === 0) {
      return c.json({ matched: false, reason: 'service_closed' });
    }
    let rows = allRows;
    if (expectedDir !== null) {
      rows = rows.filter((r) => r.updnLine === expectedDir);
    }
    const p = normStation(body.prev);
    const n = normStation(body.next);
    // 1차: 정확 매칭 tier (next 진입/도착 > prev 출발 > prev 정차 > next 정차)
    const atNextEntering = rows.filter((r) => normStation(r.statnNm) === n && (r.trainSttus === '0' || r.trainSttus === '1'));
    const justLeftPrev   = rows.filter((r) => normStation(r.statnNm) === p && r.trainSttus === '2');
    const atPrev         = rows.filter((r) => normStation(r.statnNm) === p && (r.trainSttus === '0' || r.trainSttus === '1'));
    const atNextAny      = rows.filter((r) => normStation(r.statnNm) === n);
    // 출퇴근 시간에는 같은 tier에 차량 2+대 가능 (헤드웨이 2~3분). 그때는 사용자에게
    // picker 노출. tier 안 1대만 있으면 자동.
    let picked: typeof rows[0] | undefined;
    let multiCandidates: typeof rows | null = null;
    for (const tier of [atNextEntering, justLeftPrev, atPrev, atNextAny]) {
      if (tier.length === 1) { picked = tier[0]; break; }
      if (tier.length >= 2) { multiCandidates = tier; break; }
    }
    if (multiCandidates) {
      // 각 후보의 progress 계산 — 카드별 mini bar 표시용.
      return c.json({
        matched: false,
        reason: 'multi_candidate',
        candidates: multiCandidates.map((r) => {
          const { progress, progressLabel } = estimateProgress({
            prev: body.prev,
            next: body.next,
            statnNm: r.statnNm,
            trainSttus: r.trainSttus,
          });
          return {
            trainNo: r.trainNo,
            currentStation: r.statnNm,
            trainSttus: r.trainSttus,
            direction: r.updnLine === '0' ? 'up' : 'down',
            destination: r.statnTnm,
            progress,
            progressLabel,
          };
        }),
      });
    }

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

// Timeline picker — 노선의 모든 vehicle 위치 list. stopName 입력 없이 노선 ID만으로 호출.
realtimeRoutes.get('/realtime/bus/route-vehicles', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteVehiclesQuerySchema.safeParse({ routeId: c.req.query('routeId'), region: c.req.query('region') });
  if (!parsed.success) return c.json({ vehicles: [], reason: 'invalid_query' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ vehicles: [], reason: 'no_api_key' });
  try {
    const vehicles = await providerFor(parseBusRegion(parsed.data.region)).listVehicles(parsed.data.routeId, key);
    return c.json({ vehicles });
  } catch (e) {
    return c.json({ vehicles: [], reason: (e as Error).message });
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

// ── TAGO 간선철도 (TrainInfo) ──────────────────────────────────────
// 사용자 좌석권(trainNo+호차+출도착+runDt)을 받아 TAGO 시각표로 운행 검증.
// matched=true 시 placeId 발급 (train:tago:{trainNo}:{runDt}:car{N}).

realtimeRoutes.get('/realtime/train/cities', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ cities: [], reason: 'no_api_key' });
  try {
    const cities = await trainInfoProvider.listCities(key);
    return c.json({ cities });
  } catch (e) {
    return c.json({ cities: [], reason: (e as Error).message });
  }
});

realtimeRoutes.get('/realtime/train/stations', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = TrainStationsQuerySchema.safeParse({ cityCode: c.req.query('cityCode') });
  if (!parsed.success) return c.json({ stations: [], reason: 'invalid_query' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ stations: [], reason: 'no_api_key' });
  try {
    const stations = await trainInfoProvider.listStations(parsed.data.cityCode, key);
    return c.json({ stations });
  } catch (e) {
    return c.json({ stations: [], reason: (e as Error).message });
  }
});

realtimeRoutes.get('/realtime/train/vehicle-kinds', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ kinds: [], reason: 'no_api_key' });
  try {
    const kinds = await trainInfoProvider.listVehicleKinds(key);
    return c.json({ kinds });
  } catch (e) {
    return c.json({ kinds: [], reason: (e as Error).message });
  }
});

realtimeRoutes.post('/realtime/train/verify', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ matched: false, reason: 'invalid_json' }, 400); }
  const parsed = TrainVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ matched: false, reason: 'invalid_body' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  try {
    const result = await trainInfoProvider.verify(parsed.data, key);
    return c.json(result);
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// ── TAGO 고속·시외버스 (ExpBusInfo / SuburbsBusInfo) ─────────────
// 사용자 좌석권(출도착 터미널 + 정확 출발시각 + 등급)을 받아 당일 배차 검증.
// kind: 'exp'(고속) | 'suburbs'(시외). placeId = intercity-bus:{kind}:{routeId}:{depPlandTime}

realtimeRoutes.get('/realtime/intercity-bus/:kind/cities', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const kindP = IntercityBusKindSchema.safeParse(c.req.param('kind'));
  if (!kindP.success) return c.json({ cities: [], reason: 'invalid_kind' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ cities: [], reason: 'no_api_key' });
  try {
    const cities = await intercityBusProvider.listCities(kindP.data, key);
    return c.json({ cities });
  } catch (e) {
    return c.json({ cities: [], reason: (e as Error).message });
  }
});

realtimeRoutes.get('/realtime/intercity-bus/:kind/terminals', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const kindP = IntercityBusKindSchema.safeParse(c.req.param('kind'));
  if (!kindP.success) return c.json({ terminals: [], reason: 'invalid_kind' }, 400);
  const optsP = IntercityBusTerminalsQuerySchema.safeParse({
    terminalNm: c.req.query('terminalNm'),
    cityCode: c.req.query('cityCode'),
  });
  if (!optsP.success) return c.json({ terminals: [], reason: 'invalid_query' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ terminals: [], reason: 'no_api_key' });
  try {
    const terminals = await intercityBusProvider.listTerminals(kindP.data, optsP.data, key);
    return c.json({ terminals });
  } catch (e) {
    return c.json({ terminals: [], reason: (e as Error).message });
  }
});

realtimeRoutes.get('/realtime/intercity-bus/:kind/grades', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const kindP = IntercityBusKindSchema.safeParse(c.req.param('kind'));
  if (!kindP.success) return c.json({ grades: [], reason: 'invalid_kind' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ grades: [], reason: 'no_api_key' });
  try {
    const grades = await intercityBusProvider.listGrades(kindP.data, key);
    return c.json({ grades });
  } catch (e) {
    return c.json({ grades: [], reason: (e as Error).message });
  }
});

realtimeRoutes.post('/realtime/intercity-bus/:kind/verify', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const kindP = IntercityBusKindSchema.safeParse(c.req.param('kind'));
  if (!kindP.success) return c.json({ matched: false, reason: 'invalid_kind' }, 400);
  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ matched: false, reason: 'invalid_json' }, 400); }
  const parsed = IntercityBusVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ matched: false, reason: 'invalid_body' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  try {
    const result = await intercityBusProvider.verify(kindP.data, parsed.data, key);
    return c.json(result);
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});

// ── 용인에버라인 (비공식 everlinecu.com) ─────────────────────────
// 실시간 차량 위치 + 정적 역 list. 키 불필요. 운영사가 일방 차단 시 즉시 빈 응답.
realtimeRoutes.get('/realtime/everline/positions', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  try {
    const vehicles = await everlineProvider.listVehicles();
    return c.json({ vehicles, stations: EVERLINE_STATIONS });
  } catch (e) {
    return c.json({ vehicles: [], stations: EVERLINE_STATIONS, reason: (e as Error).message });
  }
});

// ── TAGO 지방 도시철도 (SubwayInfo) station 키워드 검색 ──────────
// place_id = subway-station:{subwayStationId}. swopenAPI cover X 노선 station-level 투표.
realtimeRoutes.get('/realtime/regional-subway/search', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = RegionalSubwaySearchQuerySchema.safeParse({
    q: c.req.query('q'),
    region: c.req.query('region'),
  });
  if (!parsed.success) return c.json({ stations: [], reason: 'invalid_query' }, 400);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ stations: [], reason: 'no_api_key' });
  try {
    const stations = await subwayInfoProvider.searchStations(parsed.data.q, parsed.data.region, key);
    return c.json({ stations });
  } catch (e) {
    return c.json({ stations: [], reason: (e as Error).message });
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
