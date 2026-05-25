/// <reference types="@cloudflare/workers-types" />

// 실시간 버스 차량 매칭 endpoint.
//
// 흐름: 클라이언트가 "노선번호 + 지나는 정류장" 전달 → 우리 Worker가
// data.go.kr (ws.bus.go.kr) 호출 → 그 노선의 정류장 순번 → 차량 위치 매칭
// → 1대 식별 → vehId 반환.
//
// 비매칭 시: 호출자는 route+stop 폴백 ID 사용.
//
// 보안: DATAGOKR_BUS_KEY는 서버 전용. encodeURIComponent으로 URL-인코딩.

interface Env {
  DATAGOKR_BUS_KEY?: string;
  CACHE?: KVNamespace;
}

interface ReqBody {
  routeName: string; // "146", "5511", "M7106"
  stopName: string;  // "강남역.강남대로", "신촌오거리"
}

interface MatchResponse {
  matched: boolean;
  vehId?: string;
  plainNo?: string;
  routeId?: string;
  routeName?: string;
  routeType?: string;
  currentStop?: string;
  nextStop?: string;
  reason?: string;
}

interface RouteListItem {
  busRouteId: string;
  busRouteNm: string;
  routeType: string;
  stStationNm?: string;
  edStationNm?: string;
}

interface RouteStationItem {
  station: string;       // 정류장 ID
  stationNm: string;     // 정류장명
  seq: string;           // 순번
  direction?: string;
}

interface BusPosItem {
  vehId: string;
  plainNo: string;
  busType: string;
  stOrd: string;         // 현재 정류장 순번
  stopFlag: string;      // 1=정류장 도착, 0=운행중
  isLast?: string;
  isFullFlag?: string;
  busRouteId: string;
  sectOrd?: string;
}

const HOST = 'http://ws.bus.go.kr/api/rest';

function normStop(s: string): string {
  // "강남역.강남대로" / "강남역,강남대로" / "강남역 강남대로" 정규화
  return s.replace(/[\s,·.()-]/g, '').toLowerCase();
}

async function fetchJson<T>(url: string): Promise<{ headerCd: string; headerMsg: string; itemList: T[] }> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  // ws.bus.go.kr는 resultType=json 추가해도 XML 반환하는 경우 있음 → 안전하게 텍스트 → 시도
  const text = await res.text();
  let body: { msgHeader?: { headerCd: string; headerMsg: string; itemCount: number }; msgBody?: { itemList?: T[] | T | null } };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('upstream_not_json');
  }
  const header = body.msgHeader ?? { headerCd: '?', headerMsg: 'no header', itemCount: 0 };
  if (header.headerCd !== '0' && header.headerCd !== '4') {
    // 4 = "결과가 없습니다" (정상의 빈 케이스로 취급)
    throw new Error(`api_${header.headerCd}_${header.headerMsg}`);
  }
  const raw = body.msgBody?.itemList;
  const itemList: T[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return { headerCd: header.headerCd, headerMsg: header.headerMsg, itemList };
}

async function searchRoutes(key: string, routeName: string): Promise<RouteListItem[]> {
  const url = `${HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(routeName)}&resultType=json`;
  const { itemList } = await fetchJson<RouteListItem>(url);
  // 정확 일치 우선 정렬
  return itemList.sort((a, b) => {
    const ae = a.busRouteNm === routeName ? 0 : 1;
    const be = b.busRouteNm === routeName ? 0 : 1;
    return ae - be;
  });
}

async function getStationsForRoute(key: string, busRouteId: string): Promise<RouteStationItem[]> {
  const url = `${HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(busRouteId)}&resultType=json`;
  const { itemList } = await fetchJson<RouteStationItem>(url);
  return itemList;
}

async function getBusPositions(key: string, busRouteId: string): Promise<BusPosItem[]> {
  const url = `${HOST}/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(busRouteId)}&resultType=json`;
  const { itemList } = await fetchJson<BusPosItem>(url);
  return itemList;
}

interface RouteMatch {
  route: RouteListItem;
  stations: RouteStationItem[];
  stopSeq: number;
  stopName: string;
}

async function findRouteAndStop(key: string, routeName: string, stopName: string): Promise<RouteMatch | null> {
  const routes = await searchRoutes(key, routeName);
  const target = normStop(stopName);
  for (const route of routes) {
    try {
      const stations = await getStationsForRoute(key, route.busRouteId);
      const hit = stations.find((s) => normStop(s.stationNm).includes(target) || target.includes(normStop(s.stationNm)));
      if (hit) {
        return { route, stations, stopSeq: parseInt(hit.seq, 10), stopName: hit.stationNm };
      }
    } catch {
      // 해당 노선 데이터 조회 실패 → 다음 후보로
    }
  }
  return null;
}

function pickVehicle(positions: BusPosItem[], stopSeq: number): BusPosItem | null {
  // 우선순위:
  //  1. stOrd === stopSeq && stopFlag === '1' (정류장 도착 직후)
  //  2. stOrd === stopSeq (해당 정류장 구간)
  //  3. stOrd === stopSeq - 1 (직전 정류장에서 다음으로 가는 중)
  const atStopFlagged = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq && p.stopFlag === '1');
  if (atStopFlagged) return atStopFlagged;
  const atStop = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq);
  if (atStop) return atStop;
  const justBefore = positions.find((p) => parseInt(p.stOrd, 10) === stopSeq - 1);
  if (justBefore) return justBefore;
  return null;
}

function nextStopName(stations: RouteStationItem[], seq: number): string | undefined {
  const next = stations.find((s) => parseInt(s.seq, 10) === seq + 1);
  return next?.stationNm;
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
  }
  let body: ReqBody;
  try {
    body = (await ctx.request.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const routeName = body.routeName?.trim();
  const stopName = body.stopName?.trim();
  if (!routeName || !stopName) {
    return new Response(JSON.stringify({ error: 'missing_route_or_stop' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const key = ctx.env.DATAGOKR_BUS_KEY;
  if (!key || key.startsWith('TODO')) {
    return new Response(JSON.stringify({ matched: false, reason: 'no_api_key' } satisfies MatchResponse), {
      status: 503, headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const found = await findRouteAndStop(key, routeName, stopName);
    if (!found) {
      return new Response(JSON.stringify({ matched: false, reason: 'route_or_stop_not_found' } satisfies MatchResponse), {
        headers: { 'content-type': 'application/json' },
      });
    }
    const positions = await getBusPositions(key, found.route.busRouteId);
    const veh = pickVehicle(positions, found.stopSeq);
    if (!veh) {
      return new Response(JSON.stringify({
        matched: false,
        reason: 'no_vehicle_at_stop',
        routeId: found.route.busRouteId,
        routeName: found.route.busRouteNm,
        currentStop: found.stopName,
      } satisfies MatchResponse), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      matched: true,
      vehId: veh.vehId,
      plainNo: veh.plainNo,
      routeId: found.route.busRouteId,
      routeName: found.route.busRouteNm,
      routeType: found.route.routeType,
      currentStop: found.stopName,
      nextStop: nextStopName(found.stations, found.stopSeq),
    } satisfies MatchResponse), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const msg = (e as Error).message;
    // Return 200 + matched:false so Cloudflare doesn't replace our JSON body
    // with its platform-level "error code: 502" plain text. Real upstream
    // errors are surfaced in `reason` for the client to act on.
    return new Response(JSON.stringify({ matched: false, reason: msg } satisfies MatchResponse), {
      headers: { 'content-type': 'application/json' },
    });
  }
};
