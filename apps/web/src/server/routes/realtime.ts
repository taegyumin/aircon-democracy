// /realtime/subway/match (swopenAPI), /realtime/bus/match (data.go.kr).
// 외부 API 키는 prod에 wrangler secret으로 주입 (SEOUL_REALTIME_KEY, DATAGOKR_BUS_KEY).

import { Hono } from 'hono';
import { expectedUpdnLine, LINE_SEQUENCES, stripStation } from '@aircon/core/subwayDirection';
import { estimateProgress } from '@aircon/core';
import { SubwayMatchBodySchema, BusMatchBodySchema, BusRouteSearchQuerySchema, BusRouteStationsQuerySchema } from '@aircon/core/validation';
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

// 서울 시내버스 노선 종류 코드 (data.go.kr routeType).
//   1=공항 2=마을 3=간선 4=지선 5=순환 6=광역 7=인천 8=경기 9=폐지 10=관광 11=공항순환
const ROUTE_TYPE_LABEL: Record<string, string> = {
  '1': '공항', '2': '마을', '3': '간선', '4': '지선', '5': '순환',
  '6': '광역', '7': '인천', '8': '경기', '9': '폐지', '10': '관광', '11': '공항순환',
};

interface BusRouteItem {
  busRouteId: string; busRouteNm: string; routeType: string;
  // 자동완성 결과에 노출. data.go.kr 응답에 포함 (시점/종점).
  stStationNm?: string; edStationNm?: string;
}
interface BusStationItem { stationNm: string; seq: string }
interface BusPosItem { vehId: string; plainNo: string; busType: string; stOrd: string; stopFlag: string; busRouteId: string }

function normStop(s: string): string {
  return s.replace(/[\s,·.()-]/g, '').toLowerCase();
}

async function fetchBusJson<T>(url: string): Promise<T[]> {
  const res = await timedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const text = await res.text();
  const body = JSON.parse(text) as { msgHeader?: { headerCd: string; headerMsg: string }; msgBody?: { itemList?: T[] | T | null } };
  const header = body.msgHeader ?? { headerCd: '?', headerMsg: 'no header' };
  if (header.headerCd !== '0' && header.headerCd !== '4') {
    throw new Error(`api_${header.headerCd}_${header.headerMsg}`);
  }
  const raw = body.msgBody?.itemList;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

// 노선 자동완성 — 사용자가 버스 번호 일부 입력하면 후보 노선 list.
// 디자인 wireframe: "271 [간선] 서울역 → 불광동" 같은 row.
// 한 routeId는 양방향 1쌍의 종점 (stStationNm/edStationNm)을 가짐.
realtimeRoutes.get('/realtime/bus/route-search', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteSearchQuerySchema.safeParse({ q: c.req.query('q') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const { q } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ routes: [], reason: 'no_api_key' });
  const HOST = 'http://ws.bus.go.kr/api/rest';
  try {
    const items = await fetchBusJson<BusRouteItem>(
      `${HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(q)}&resultType=json`,
    );
    // 정확히 q와 일치하는 노선을 위로. (예: '271' 입력 시 '271'이 '2711'보다 앞).
    items.sort((a, b) => (a.busRouteNm === q ? 0 : 1) - (b.busRouteNm === q ? 0 : 1));
    const routes = items.slice(0, 12).map((r) => ({
      id: r.busRouteId,
      name: r.busRouteNm,
      type: r.routeType,
      typeLabel: ROUTE_TYPE_LABEL[r.routeType] ?? '버스',
      startStop: r.stStationNm ?? '',
      endStop: r.edStationNm ?? '',
    }));
    return c.json({ routes });
  } catch (e) {
    return c.json({ routes: [], reason: (e as Error).message });
  }
});

// 노선 정류장 sequence — 자동완성에서 노선 확정 후 정류장 picker용.
realtimeRoutes.get('/realtime/bus/route-stations', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteStationsQuerySchema.safeParse({ routeId: c.req.query('routeId') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const { routeId } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ stations: [], reason: 'no_api_key' });
  const HOST = 'http://ws.bus.go.kr/api/rest';
  try {
    interface FullStation { stationNm: string; seq: string; gpsX?: string; gpsY?: string; arsId?: string }
    const items = await fetchBusJson<FullStation>(
      `${HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(routeId)}&resultType=json`,
    );
    const stations = items.map((s) => ({
      seq: parseInt(s.seq, 10),
      name: s.stationNm,
      // GPS (NearbyStopCard에서 distance 계산용). 비어있을 수 있어 number|null로.
      x: s.gpsX ? parseFloat(s.gpsX) : null,
      y: s.gpsY ? parseFloat(s.gpsY) : null,
      arsId: s.arsId ?? null,
    }));
    return c.json({ stations });
  } catch (e) {
    return c.json({ stations: [], reason: (e as Error).message });
  }
});

realtimeRoutes.post('/realtime/bus/match', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;

  let raw: unknown;
  try { raw = await c.req.json(); } catch { return c.json({ error: 'invalid_json' }, 400); }
  const parsed = BusMatchBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const { routeName, stopName } = parsed.data;
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });
  const HOST = 'http://ws.bus.go.kr/api/rest';
  try {
    const routes = await fetchBusJson<BusRouteItem>(
      `${HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(routeName)}&resultType=json`,
    );
    routes.sort((a, b) => (a.busRouteNm === routeName ? 0 : 1) - (b.busRouteNm === routeName ? 0 : 1));
    const target = normStop(stopName);
    for (const route of routes) {
      try {
        const stations = await fetchBusJson<BusStationItem>(
          `${HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`,
        );
        const hit = stations.find((s) => normStop(s.stationNm).includes(target) || target.includes(normStop(s.stationNm)));
        if (!hit) continue;
        const stopSeq = parseInt(hit.seq, 10);
        const positions = await fetchBusJson<BusPosItem>(
          `${HOST}/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`,
        );
        const atStopFlagged = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq && p.stopFlag === '1');
        const atStop = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq);
        const justBefore = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq - 1);
        const veh = atStopFlagged ?? atStop ?? justBefore;
        if (!veh) {
          return c.json({ matched: false, reason: 'no_vehicle_at_stop', routeId: route.busRouteId, routeName: route.busRouteNm, currentStop: hit.stationNm });
        }
        const nextStation = stations.find((s) => parseInt(s.seq, 10) === stopSeq + 1);
        return c.json({
          matched: true,
          vehId: veh.vehId,
          plainNo: veh.plainNo,
          routeId: route.busRouteId,
          routeName: route.busRouteNm,
          routeType: route.routeType,
          currentStop: hit.stationNm,
          nextStop: nextStation?.stationNm,
        });
      } catch { /* try next candidate */ }
    }
    return c.json({ matched: false, reason: 'route_or_stop_not_found' });
  } catch (e) {
    return c.json({ matched: false, reason: (e as Error).message });
  }
});
