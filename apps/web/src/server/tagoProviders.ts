// TAGO 4-service wrap (TrainInfo, ExpBusInfo, SuburbsBusInfo, SubwayInfo).
// 모두 동일 service base (1613000), 동일 serviceKey (DATAGOKR_BUS_KEY).
//
// 핵심: data.go.kr API는 PascalCase op (`GetCtyCodeList`) + HTTP scheme.
// 첫 시도에서 lowerCamelCase + HTTPS 둘 다 잘못해서 시간 잃었음 (2026-05-28). 메모리 박음.

import type {
  TrainCity, TrainStationApi, TrainVehicleKind,
  TrainVerifyResult, RegionalSubwayStation,
} from '@aircon/core';

const TAGO_BASE = 'http://apis.data.go.kr/1613000';
const UPSTREAM_TIMEOUT_MS = 5000;

function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

// TAGO JSON envelope. items는 0건이면 빈 문자열, 1건이면 {item:{...}}, n건이면 {item:[...]}.
interface TagoEnvelope<TItem> {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items?: { item?: TItem | TItem[] } | '' | null;
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
}

function normalizeItems<T>(env: TagoEnvelope<T>): T[] {
  const items = env.response?.body?.items;
  // TAGO는 0건일 때 items가 빈 문자열 또는 null로 옴 (object 아님). typeof로 narrowing.
  if (!items || typeof items !== 'object') return [];
  const raw = items.item;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

// 부산/대구/광주/대전/인천2 prefix → region 매핑.
const SUBWAY_REGION_PREFIX: Array<[RegExp, RegionalSubwayStation['region']]> = [
  [/^MTRBS/, 'busan'],
  [/^MTRDG/, 'daegu'],
  [/^MTRGJ/, 'gwangju'],
  [/^MTRDJ/, 'daejeon'],
  [/^MTRICI2/, 'incheon2'],
];

export function classifySubwayRegion(stationId: string): RegionalSubwayStation['region'] {
  for (const [re, r] of SUBWAY_REGION_PREFIX) if (re.test(stationId)) return r;
  return 'other';
}

// ── TrainInfo (간선철도) ───────────────────────────────────────────

interface TrainInfoCityRow { citycode: string | number; cityname: string }
interface TrainInfoStationRow { nodeid: string; nodename: string }
interface TrainInfoVhcleRow { vehiclekndid: string; vehiclekndnm: string }
interface TrainInfoScheduleRow {
  trainno: string | number;
  // 실측 (2026-05-28): 가이드 docx의 `vehiclekndnm`이 아니라 `traingradename`.
  // 값은 GetVhcleKndList의 vehiclekndnm과 같은 형식 ("KTX", "KTX-산천(A-type)", "SRT", …).
  traingradename: string;
  depplacename: string;
  arrplacename: string;
  // 실측: 12자리 'YYYYMMDDHHMI'가 아닌 14자리 'YYYYMMDDHHMMSS'. slice(8,10)+slice(10,12)로 HH:MM 추출은 동일.
  depplandtime: string | number;
  arrplandtime: string | number;
  adultcharge?: number;
}

export const trainInfoProvider = {
  async listCities(key: string): Promise<TrainCity[]> {
    const url = `${TAGO_BASE}/TrainInfo/GetCtyCodeList?serviceKey=${key}&_type=json&numOfRows=50&pageNo=1`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<TrainInfoCityRow>;
    return normalizeItems(body).map((r) => ({
      cityCode: String(r.citycode),
      cityName: r.cityname,
    }));
  },

  async listStations(cityCode: string, key: string): Promise<TrainStationApi[]> {
    const url = `${TAGO_BASE}/TrainInfo/GetCtyAcctoTrainSttnList?serviceKey=${key}&_type=json&cityCode=${encodeURIComponent(cityCode)}&numOfRows=100&pageNo=1`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<TrainInfoStationRow>;
    return normalizeItems(body).map((r) => ({ nodeId: r.nodeid, nodeName: r.nodename }));
  },

  async listVehicleKinds(key: string): Promise<TrainVehicleKind[]> {
    const url = `${TAGO_BASE}/TrainInfo/GetVhcleKndList?serviceKey=${key}&_type=json`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<TrainInfoVhcleRow>;
    return normalizeItems(body).map((r) => ({
      vehicleKndId: r.vehiclekndid,
      vehicleKndNm: r.vehiclekndnm,
    }));
  },

  // 좌석권(trainNo + runDt + 출도착)을 받아 TAGO 시각표로 운행 검증.
  // matched=true 시 placeId 발급. 매칭 키 = train:tago:{trainNo}:{runDt}:car{N}
  async verify(input: {
    trainNo: string; runDt: string;
    depPlaceId: string; arrPlaceId: string;
    carOrdr: number;
  }, key: string): Promise<TrainVerifyResult> {
    // TAGO는 trainNo 단건 검색 op가 없음. 출도착지+날짜 list → trainno로 filter.
    const url = `${TAGO_BASE}/TrainInfo/GetStrtpntAlocFndTrainInfo`
      + `?serviceKey=${key}&_type=json`
      + `&depPlaceId=${encodeURIComponent(input.depPlaceId)}`
      + `&arrPlaceId=${encodeURIComponent(input.arrPlaceId)}`
      + `&depPlandTime=${encodeURIComponent(input.runDt)}`
      + `&numOfRows=200&pageNo=1`;
    const res = await timedFetch(url);
    if (!res.ok) return { matched: false, reason: `upstream_${res.status}` };
    const body = (await res.json()) as TagoEnvelope<TrainInfoScheduleRow>;
    if (body.response?.header?.resultCode !== '00') {
      return { matched: false, reason: body.response?.header?.resultMsg ?? 'upstream_error' };
    }
    const rows = normalizeItems(body);
    if (rows.length === 0) return { matched: false, reason: 'service_closed' };

    // trainNo 비교 — 사용자 입력 "123"과 TAGO 응답 "00123" 둘 다 가능. 숫자로 비교.
    const userTrainNo = Number(input.trainNo);
    const hit = rows.find((r) => Number(r.trainno) === userTrainNo);
    if (!hit) return { matched: false, reason: 'not_found' };

    const placeId = `train:tago:${input.trainNo}:${input.runDt}:car${input.carOrdr}`;
    return {
      matched: true,
      placeId,
      trainNo: input.trainNo,
      runDt: input.runDt,
      carOrdr: input.carOrdr,
      vehicleKndNm: hit.traingradename,
      depPlaceNm: hit.depplacename,
      arrPlaceNm: hit.arrplacename,
      depPlandTime: String(hit.depplandtime),
      arrPlandTime: String(hit.arrplandtime),
    };
  },
};

// ── SubwayInfo (지방 도시철도 station 키워드 검색) ─────────────────

interface SubwayInfoStationRow {
  subwayStationId: string;
  subwayStationName: string;
  subwayRouteName: string;
}

export const subwayInfoProvider = {
  async searchStations(q: string, region: RegionalSubwayStation['region'] | 'all', key: string): Promise<RegionalSubwayStation[]> {
    const url = `${TAGO_BASE}/SubwayInfo/GetKwrdFndSubwaySttnList`
      + `?serviceKey=${key}&_type=json`
      + `&subwayStationName=${encodeURIComponent(q)}`
      + `&numOfRows=50&pageNo=1`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<SubwayInfoStationRow>;
    const rows = normalizeItems(body);
    const mapped: RegionalSubwayStation[] = rows.map((r) => ({
      subwayStationId: r.subwayStationId,
      subwayStationName: r.subwayStationName,
      subwayRouteName: r.subwayRouteName,
      region: classifySubwayRegion(r.subwayStationId),
    }));
    if (region === 'all') return mapped;
    return mapped.filter((s) => s.region === region);
  },
};
