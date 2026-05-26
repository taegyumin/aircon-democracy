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
//
// region 분기:
//   - 'seoul' 또는 undefined → ws.bus.go.kr (서울 시내버스).
//   - TAGO cityCode (숫자 문자열) → apis.data.go.kr/1613000/* (전국, 서울 제외).
// Seoul과 TAGO는 응답 구조/필드 다른 별도 시스템 — 어댑터로 정규화.

type Region = { kind: 'seoul' } | { kind: 'tago'; cityCode: number };

function parseRegion(raw: string | undefined): Region {
  if (!raw || raw === 'seoul' || raw === '11') return { kind: 'seoul' };
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return { kind: 'tago', cityCode: n };
  return { kind: 'seoul' };
}

// 서울 시내버스 노선 종류 코드 (data.go.kr routeType).
//   1=공항 2=마을 3=간선 4=지선 5=순환 6=광역 7=인천 8=경기 9=폐지 10=관광 11=공항순환
const ROUTE_TYPE_LABEL: Record<string, string> = {
  '1': '공항', '2': '마을', '3': '간선', '4': '지선', '5': '순환',
  '6': '광역', '7': '인천', '8': '경기', '9': '폐지', '10': '관광', '11': '공항순환',
};

// TAGO routetp 분류 (각 cityCode별 의미 다를 수 있어 일반화 라벨).
const TAGO_ROUTE_TYPE_LABEL: Record<string, string> = {
  '11': '직행좌석', '12': '좌석', '13': '일반', '14': '광역', '15': '따복',
  '16': '경기순환', '21': '직행좌석', '22': '광역급행', '23': '광역', '30': '마을',
  '41': '시내', '42': '농어촌', '43': '마을', '51': '시외', '52': '공항',
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

// TAGO 1613000 응답 wrapper. ws.bus.go.kr와 구조 다름.
//   { response: { header: { resultCode, resultMsg }, body: { items: { item: [...] | {...} } | '' } } }
async function fetchTagoJson<T>(url: string): Promise<T[]> {
  const res = await timedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const text = await res.text();
  let body: { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: T[] | T } | '' | null } } };
  try { body = JSON.parse(text); } catch { throw new Error(`tago_nonjson_${text.slice(0, 40)}`); }
  const header = body.response?.header;
  if (header?.resultCode && header.resultCode !== '00') {
    throw new Error(`tago_${header.resultCode}_${header.resultMsg ?? ''}`);
  }
  const items = body.response?.body?.items;
  if (!items || items === '') return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 노선 자동완성 — region 별로 dispatch.
//   Seoul (ws.bus.go.kr): strSrch=q로 노선명 부분 검색.
//   TAGO  (1613000): routeNo=q로 노선번호 검색. cityCode 필요.
realtimeRoutes.get('/realtime/bus/route-search', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteSearchQuerySchema.safeParse({ q: c.req.query('q'), region: c.req.query('region') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const { q } = parsed.data;
  const region = parseRegion(parsed.data.region);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ routes: [], reason: 'no_api_key' });

  try {
    if (region.kind === 'seoul') {
      const HOST = 'http://ws.bus.go.kr/api/rest';
      const items = await fetchBusJson<BusRouteItem>(
        `${HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(q)}&resultType=json`,
      );
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
    }
    // TAGO
    interface TagoRouteItem { routeid: string; routeno: string; routetp?: string; startnodenm?: string; endnodenm?: string }
    const items = await fetchTagoJson<TagoRouteItem>(
      `http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteNoList?serviceKey=${encodeURIComponent(key)}&cityCode=${region.cityCode}&routeNo=${encodeURIComponent(q)}&_type=json&numOfRows=20`,
    );
    items.sort((a, b) => (a.routeno === q ? 0 : 1) - (b.routeno === q ? 0 : 1));
    const routes = items.slice(0, 12).map((r) => ({
      id: r.routeid,
      name: r.routeno,
      type: r.routetp ?? '',
      typeLabel: TAGO_ROUTE_TYPE_LABEL[r.routetp ?? ''] ?? r.routetp ?? '버스',
      startStop: r.startnodenm ?? '',
      endStop: r.endnodenm ?? '',
    }));
    return c.json({ routes });
  } catch (e) {
    return c.json({ routes: [], reason: (e as Error).message });
  }
});

// 노선 정류장 sequence — region 별 dispatch.
realtimeRoutes.get('/realtime/bus/route-stations', async (c) => {
  const guard = await realtimeGuard(c);
  if (!guard.ok) return guard.res;
  const parsed = BusRouteStationsQuerySchema.safeParse({ routeId: c.req.query('routeId'), region: c.req.query('region') });
  if (!parsed.success) return c.json({ error: 'invalid_query' }, 400);
  const { routeId } = parsed.data;
  const region = parseRegion(parsed.data.region);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ stations: [], reason: 'no_api_key' });

  try {
    if (region.kind === 'seoul') {
      const HOST = 'http://ws.bus.go.kr/api/rest';
      interface FullStation { stationNm: string; seq: string; gpsX?: string; gpsY?: string; arsId?: string }
      const items = await fetchBusJson<FullStation>(
        `${HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(routeId)}&resultType=json`,
      );
      const stations = items.map((s) => ({
        seq: parseInt(s.seq, 10),
        name: s.stationNm,
        x: s.gpsX ? parseFloat(s.gpsX) : null,
        y: s.gpsY ? parseFloat(s.gpsY) : null,
        arsId: s.arsId ?? null,
      }));
      return c.json({ stations });
    }
    // TAGO
    interface TagoStation { nodeid: string; nodenm: string; nodeord: number; gpslati?: number; gpslong?: number }
    const items = await fetchTagoJson<TagoStation>(
      `http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=${encodeURIComponent(key)}&cityCode=${region.cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
    );
    const stations = items.map((s) => ({
      seq: typeof s.nodeord === 'number' ? s.nodeord : parseInt(String(s.nodeord), 10),
      name: s.nodenm,
      x: typeof s.gpslong === 'number' ? s.gpslong : null,
      y: typeof s.gpslati === 'number' ? s.gpslati : null,
      arsId: s.nodeid ?? null,
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
  const { routeName, stopName, routeId: passedRouteId } = parsed.data;
  const region = parseRegion(parsed.data.region);
  const key = (c.env as unknown as { DATAGOKR_BUS_KEY?: string }).DATAGOKR_BUS_KEY;
  if (!key) return c.json({ matched: false, reason: 'no_api_key' });

  // ─── TAGO 분기 (서울 외) ───────────────────────────────────────
  // frontend가 노선 검색 → 정류장 list 받은 상태라 routeId 직접 넘김.
  // routeId 없으면 routeName으로 검색 후 first match — 정확도 떨어지지만 fallback.
  if (region.kind === 'tago') {
    try {
      let routeId = passedRouteId;
      if (!routeId) {
        interface TagoRouteItem { routeid: string; routeno: string }
        const routes = await fetchTagoJson<TagoRouteItem>(
          `http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteNoList?serviceKey=${encodeURIComponent(key)}&cityCode=${region.cityCode}&routeNo=${encodeURIComponent(routeName)}&_type=json&numOfRows=5`,
        );
        const exact = routes.find((r) => r.routeno === routeName) ?? routes[0];
        if (!exact) return c.json({ matched: false, reason: 'route_or_stop_not_found' });
        routeId = exact.routeid;
      }
      // 정류장 sequence로 stopName 위치 결정 + 차량 위치 매칭.
      interface TagoStation { nodeid: string; nodenm: string; nodeord: number }
      const stations = await fetchTagoJson<TagoStation>(
        `http://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=${encodeURIComponent(key)}&cityCode=${region.cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
      );
      const target = normStop(stopName);
      const hit = stations.find((s) => normStop(s.nodenm).includes(target) || target.includes(normStop(s.nodenm)));
      if (!hit) return c.json({ matched: false, reason: 'route_or_stop_not_found', routeId });
      const stopOrd = typeof hit.nodeord === 'number' ? hit.nodeord : parseInt(String(hit.nodeord), 10);
      // 차량 위치 list.
      interface TagoPos { vehicleno: string; nodenm: string; nodeord: number; routenm?: string; routetp?: string }
      const positions = await fetchTagoJson<TagoPos>(
        `http://apis.data.go.kr/1613000/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=${encodeURIComponent(key)}&cityCode=${region.cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
      );
      const ordOf = (p: TagoPos) => typeof p.nodeord === 'number' ? p.nodeord : parseInt(String(p.nodeord), 10);
      const atStop = positions.find((p) => ordOf(p) === stopOrd);
      const justBefore = positions.find((p) => ordOf(p) === stopOrd - 1);
      const veh = atStop ?? justBefore;
      if (!veh) {
        return c.json({ matched: false, reason: 'no_vehicle_at_stop', routeId, routeName, currentStop: hit.nodenm });
      }
      const nextStation = stations.find((s) => (typeof s.nodeord === 'number' ? s.nodeord : parseInt(String(s.nodeord), 10)) === stopOrd + 1);
      return c.json({
        matched: true,
        vehId: veh.vehicleno,
        plainNo: veh.vehicleno,
        routeId,
        routeName,
        routeType: veh.routetp ?? '',
        currentStop: hit.nodenm,
        nextStop: nextStation?.nodenm,
      });
    } catch (e) {
      return c.json({ matched: false, reason: (e as Error).message });
    }
  }

  // ─── Seoul 분기 (기존 ws.bus.go.kr) ─────────────────────────────
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
