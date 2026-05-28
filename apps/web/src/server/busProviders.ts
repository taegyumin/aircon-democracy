// BusProvider 추출 — Seoul(ws.bus.go.kr) + TAGO(apis.data.go.kr/1613000) 어댑터.
// LLM P2: routes/realtime.ts에 인라인이었던 700+ 라인 분기를 별도 모듈로.
// minimal 3-method interface — over-engineering(전반적 ApiAdapter<T>) 회피.

import type { BusMatchResult, BusRouteCandidate, BusRouteStation } from '@aircon/core';

// 응답 정규화 형식 — frontend가 받는 것과 동일.
export interface BusProvider {
  searchRoutes(q: string, key: string): Promise<BusRouteCandidate[]>;
  listStations(routeId: string, key: string): Promise<BusRouteStation[]>;
  matchVehicle(routeName: string, stopName: string, key: string, passedRouteId?: string): Promise<BusMatchResult>;
}

// TAGO 응답이 평소엔 ~1s지만 가끔 3-5s까지 늘어남. 2초는 false-negative timeout 잦아
// 실측에서 인천/부산/울산이 자주 끊겼음 (2026-05-27).
// 5초도 부산 BusRouteInfoInqireService에서 timeout 재발 (2026-05-28 q=10 실측). 8초로 여유.
const UPSTREAM_TIMEOUT_MS = 8000;
function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

function normStop(s: string): string {
  return s.replace(/[\s,·.()-]/g, '').toLowerCase();
}

// ── Seoul (ws.bus.go.kr) ─────────────────────────────────────────────

interface SeoulRouteItem {
  busRouteId: string; busRouteNm: string; routeType: string;
  stStationNm?: string; edStationNm?: string;
}
interface SeoulStationItem { stationNm: string; seq: string; gpsX?: string; gpsY?: string; arsId?: string }
interface SeoulPosItem { vehId: string; plainNo: string; busType: string; stOrd: string; stopFlag: string; busRouteId: string }

const SEOUL_HOST = 'http://ws.bus.go.kr/api/rest';
const SEOUL_ROUTE_TYPE_LABEL: Record<string, string> = {
  '1': '공항', '2': '마을', '3': '간선', '4': '지선', '5': '순환',
  '6': '광역', '7': '인천', '8': '경기', '9': '폐지', '10': '관광', '11': '공항순환',
};

async function fetchSeoulJson<T>(url: string): Promise<T[]> {
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

export const seoulProvider: BusProvider = {
  async searchRoutes(q, key) {
    const items = await fetchSeoulJson<SeoulRouteItem>(
      `${SEOUL_HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(q)}&resultType=json`,
    );
    items.sort((a, b) => (a.busRouteNm === q ? 0 : 1) - (b.busRouteNm === q ? 0 : 1));
    return items.slice(0, 12).map((r) => ({
      id: r.busRouteId, name: r.busRouteNm, type: r.routeType,
      typeLabel: SEOUL_ROUTE_TYPE_LABEL[r.routeType] ?? '버스',
      startStop: r.stStationNm ?? '', endStop: r.edStationNm ?? '',
    }));
  },

  async listStations(routeId, key) {
    const items = await fetchSeoulJson<SeoulStationItem>(
      `${SEOUL_HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(routeId)}&resultType=json`,
    );
    return items.map((s) => ({
      seq: parseInt(s.seq, 10), name: s.stationNm,
      x: s.gpsX ? parseFloat(s.gpsX) : null,
      y: s.gpsY ? parseFloat(s.gpsY) : null,
      arsId: s.arsId ?? null,
    }));
  },

  async matchVehicle(routeName, stopName, key, passedRouteId) {
    // 2026-05-27 P1: passedRouteId 있으면 routeName 검색 생략 — 사용자가 명시적으로
    // 고른 routeId 그대로 사용해야 양방향/지선 잘못 잡지 않음.
    const routes: SeoulRouteItem[] = passedRouteId
      ? [{ busRouteId: passedRouteId, busRouteNm: routeName, routeType: '' }]
      : await fetchSeoulJson<SeoulRouteItem>(
          `${SEOUL_HOST}/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(key)}&strSrch=${encodeURIComponent(routeName)}&resultType=json`,
        );
    if (!passedRouteId) {
      routes.sort((a, b) => (a.busRouteNm === routeName ? 0 : 1) - (b.busRouteNm === routeName ? 0 : 1));
    }
    const target = normStop(stopName);
    for (const route of routes) {
      try {
        const stations = await fetchSeoulJson<SeoulStationItem>(
          `${SEOUL_HOST}/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`,
        );
        const hit = stations.find((s) => normStop(s.stationNm).includes(target) || target.includes(normStop(s.stationNm)));
        if (!hit) continue;
        const stopSeq = parseInt(hit.seq, 10);
        const positions = await fetchSeoulJson<SeoulPosItem>(
          `${SEOUL_HOST}/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(key)}&busRouteId=${encodeURIComponent(route.busRouteId)}&resultType=json`,
        );
        // Tier 우선순위: 도착(stopFlag=1) > 진입(같은 stOrd) > 막 출발(stOrd-1).
        const atStopFlagged = positions.filter((p) => parseInt(p.stOrd, 10) === stopSeq && p.stopFlag === '1');
        const atStop        = positions.filter((p) => parseInt(p.stOrd, 10) === stopSeq);
        const justBefore    = positions.filter((p) => parseInt(p.stOrd, 10) === stopSeq - 1);
        let picked: SeoulPosItem | undefined;
        let multi: SeoulPosItem[] | null = null;
        for (const tier of [atStopFlagged, atStop, justBefore]) {
          if (tier.length === 1) { picked = tier[0]; break; }
          if (tier.length >= 2) { multi = tier; break; }
        }
        const nextStation = stations.find((s) => parseInt(s.seq, 10) === stopSeq + 1);
        if (multi) {
          // 출퇴근 시 같은 stop 근처 차량 2+. 사용자에게 picker 노출.
          return {
            matched: false,
            reason: 'multi_candidate',
            routeId: route.busRouteId,
            routeName: route.busRouteNm,
            currentStop: hit.stationNm,
            nextStop: nextStation?.stationNm,
            candidates: multi.map((v) => {
              const vOrd = parseInt(v.stOrd, 10);
              const { progress, progressLabel } = busProgressFrom(vOrd, stopSeq, v.stopFlag);
              return { vehId: v.vehId, plainNo: v.plainNo, stOrd: vOrd, stopFlag: v.stopFlag, progress, progressLabel };
            }),
          };
        }
        if (!picked) {
          return { matched: false, reason: 'no_vehicle_at_stop', routeId: route.busRouteId, routeName: route.busRouteNm, currentStop: hit.stationNm };
        }
        const { progress, progressLabel } = busProgressFrom(parseInt(picked.stOrd, 10), stopSeq, picked.stopFlag);
        return {
          matched: true,
          vehId: picked.vehId, plainNo: picked.plainNo,
          routeId: route.busRouteId, routeName: route.busRouteNm,
          currentStop: hit.stationNm, nextStop: nextStation?.stationNm,
          progress, progressLabel,
        };
      } catch { /* try next candidate */ }
    }
    return { matched: false, reason: 'route_or_stop_not_found' };
  },
};

// 정류장 sequence 기반 진행도 — vehStOrd 가 stopSeq 대비 어디 있는지.
// 0 = stop-1 출발 직후, 0.5 = 진입 중, 1 = 도착. UI mini bar.
function busProgressFrom(
  vehStOrd: number,
  stopSeq: number,
  stopFlag?: string,
): { progress: number; progressLabel: 'at-stop' | 'just-left' | 'approaching' | 'between' } {
  if (vehStOrd === stopSeq && stopFlag === '1') return { progress: 1, progressLabel: 'at-stop' };
  if (vehStOrd === stopSeq) return { progress: 0.85, progressLabel: 'approaching' };
  if (vehStOrd === stopSeq - 1) return { progress: 0.2, progressLabel: 'just-left' };
  return { progress: 0.5, progressLabel: 'between' };
}

// ── TAGO (apis.data.go.kr/1613000) ─────────────────────────────────

const TAGO_HOST = 'http://apis.data.go.kr/1613000';
const TAGO_ROUTE_TYPE_LABEL: Record<string, string> = {
  '11': '직행좌석', '12': '좌석', '13': '일반', '14': '광역', '15': '따복',
  '16': '경기순환', '21': '직행좌석', '22': '광역급행', '23': '광역', '30': '마을',
  '41': '시내', '42': '농어촌', '43': '마을', '51': '시외', '52': '공항',
};

// TAGO 응답: { response: { header, body: { items: { item: T|T[] } | '' } } }
async function fetchTagoJson<T>(url: string): Promise<T[]> {
  const res = await timedFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const text = await res.text();
  let body: { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: unknown } } };
  try { body = JSON.parse(text); } catch { throw new Error(`tago_nonjson_${text.slice(0, 40)}`); }
  const header = body.response?.header;
  if (header?.resultCode && header.resultCode !== '00') {
    throw new Error(`tago_${header.resultCode}_${header.resultMsg ?? ''}`);
  }
  const items = body.response?.body?.items;
  if (!items || typeof items === 'string') return [];
  const item = (items as { item?: T | T[] }).item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// TAGO는 cityCode 필수 — provider factory.
export function tagoProvider(cityCode: number): BusProvider {
  return {
    async searchRoutes(q, key) {
      interface TagoRouteItem { routeid: string; routeno: string; routetp?: string; startnodenm?: string; endnodenm?: string }
      const items = await fetchTagoJson<TagoRouteItem>(
        `${TAGO_HOST}/BusRouteInfoInqireService/getRouteNoList?serviceKey=${encodeURIComponent(key)}&cityCode=${cityCode}&routeNo=${encodeURIComponent(q)}&_type=json&numOfRows=20`,
      );
      items.sort((a, b) => (a.routeno === q ? 0 : 1) - (b.routeno === q ? 0 : 1));
      return items.slice(0, 12).map((r) => ({
        id: r.routeid, name: r.routeno, type: r.routetp ?? '',
        typeLabel: TAGO_ROUTE_TYPE_LABEL[r.routetp ?? ''] ?? r.routetp ?? '버스',
        startStop: r.startnodenm ?? '', endStop: r.endnodenm ?? '',
      }));
    },

    async listStations(routeId, key) {
      interface TagoStation { nodeid: string; nodenm: string; nodeord: number; gpslati?: number; gpslong?: number }
      const items = await fetchTagoJson<TagoStation>(
        `${TAGO_HOST}/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=${encodeURIComponent(key)}&cityCode=${cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
      );
      return items.map((s) => ({
        seq: typeof s.nodeord === 'number' ? s.nodeord : parseInt(String(s.nodeord), 10),
        name: s.nodenm,
        x: typeof s.gpslong === 'number' ? s.gpslong : null,
        y: typeof s.gpslati === 'number' ? s.gpslati : null,
        arsId: s.nodeid ?? null,
      }));
    },

    async matchVehicle(routeName, stopName, key, passedRouteId) {
      let routeId = passedRouteId;
      if (!routeId) {
        interface TagoRouteItem { routeid: string; routeno: string }
        const routes = await fetchTagoJson<TagoRouteItem>(
          `${TAGO_HOST}/BusRouteInfoInqireService/getRouteNoList?serviceKey=${encodeURIComponent(key)}&cityCode=${cityCode}&routeNo=${encodeURIComponent(routeName)}&_type=json&numOfRows=5`,
        );
        const exact = routes.find((r) => r.routeno === routeName) ?? routes[0];
        if (!exact) return { matched: false, reason: 'route_or_stop_not_found' };
        routeId = exact.routeid;
      }
      interface TagoStation { nodeid: string; nodenm: string; nodeord: number }
      const stations = await fetchTagoJson<TagoStation>(
        `${TAGO_HOST}/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=${encodeURIComponent(key)}&cityCode=${cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
      );
      const target = normStop(stopName);
      const hit = stations.find((s) => normStop(s.nodenm).includes(target) || target.includes(normStop(s.nodenm)));
      if (!hit) return { matched: false, reason: 'route_or_stop_not_found', routeId };
      const stopOrd = typeof hit.nodeord === 'number' ? hit.nodeord : parseInt(String(hit.nodeord), 10);
      interface TagoPos { vehicleno: string; nodenm: string; nodeord: number; routenm?: string; routetp?: string }
      const positions = await fetchTagoJson<TagoPos>(
        `${TAGO_HOST}/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=${encodeURIComponent(key)}&cityCode=${cityCode}&routeId=${encodeURIComponent(routeId)}&_type=json&numOfRows=200`,
      );
      const ordOf = (p: TagoPos) => typeof p.nodeord === 'number' ? p.nodeord : parseInt(String(p.nodeord), 10);
      // TAGO는 stopFlag 없음 — 같은 stOrd 도착/진입 구분 불가. tier: atStop > justBefore.
      const atStop = positions.filter((p) => ordOf(p) === stopOrd);
      const justBefore = positions.filter((p) => ordOf(p) === stopOrd - 1);
      let picked: TagoPos | undefined;
      let multi: TagoPos[] | null = null;
      for (const tier of [atStop, justBefore]) {
        if (tier.length === 1) { picked = tier[0]; break; }
        if (tier.length >= 2) { multi = tier; break; }
      }
      const nextStation = stations.find((s) => (typeof s.nodeord === 'number' ? s.nodeord : parseInt(String(s.nodeord), 10)) === stopOrd + 1);
      if (multi) {
        return {
          matched: false,
          reason: 'multi_candidate',
          routeId, routeName, currentStop: hit.nodenm,
          nextStop: nextStation?.nodenm,
          candidates: multi.map((v) => {
            const vOrd = ordOf(v);
            const { progress, progressLabel } = busProgressFrom(vOrd, stopOrd, undefined);
            return { vehId: v.vehicleno, plainNo: v.vehicleno, stOrd: vOrd, progress, progressLabel };
          }),
        };
      }
      if (!picked) {
        return { matched: false, reason: 'no_vehicle_at_stop', routeId, routeName, currentStop: hit.nodenm };
      }
      const { progress, progressLabel } = busProgressFrom(ordOf(picked), stopOrd, undefined);
      return {
        matched: true,
        vehId: picked.vehicleno, plainNo: picked.vehicleno,
        routeId, routeName, currentStop: hit.nodenm,
        nextStop: nextStation?.nodenm,
        progress, progressLabel,
      };
    },
  };
}

// region → provider 선택.
export type BusRegionKind = { kind: 'seoul' } | { kind: 'tago'; cityCode: number };

export function parseBusRegion(raw: string | undefined): BusRegionKind {
  if (!raw || raw === 'seoul' || raw === '11') return { kind: 'seoul' };
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return { kind: 'tago', cityCode: n };
  return { kind: 'seoul' };
}

export function providerFor(region: BusRegionKind): BusProvider {
  return region.kind === 'seoul' ? seoulProvider : tagoProvider(region.cityCode);
}
