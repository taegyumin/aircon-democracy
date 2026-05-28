// TAGO 4-service wrap (TrainInfo, ExpBusInfo, SuburbsBusInfo, SubwayInfo).
// 모두 동일 service base (1613000), 동일 serviceKey (DATAGOKR_BUS_KEY).
//
// 핵심: data.go.kr API는 PascalCase op (`GetCtyCodeList`) + HTTP scheme.
// 첫 시도에서 lowerCamelCase + HTTPS 둘 다 잘못해서 시간 잃었음 (2026-05-28). 메모리 박음.

import type {
  TrainCity, TrainStationApi, TrainVehicleKind,
  TrainVerifyResult, RegionalSubwayStation,
  IntercityBusTerminal, IntercityBusGrade, IntercityBusVerifyResult,
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
    trainNo?: string; depPlandTimeHHMI?: string;
    runDt: string; depPlaceId: string; arrPlaceId: string;
    carOrdr: number;
  }, key: string): Promise<TrainVerifyResult> {
    // TAGO는 trainNo 단건 검색 op가 없음. 출도착지+날짜 list → 사용자 입력으로 filter.
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

    // 매칭 우선: trainNo (구체적) → depPlandTimeHHMI (시각).
    // trainNo 비교는 zero-pad 차이 무시 위해 Number 변환. 응답 depplandtime은 14자리 (slice(0,12)).
    const userTrainNo = input.trainNo ? Number(input.trainNo) : null;
    const userDepTime = input.depPlandTimeHHMI ?? null;
    const hit = rows.find((r) => {
      if (userTrainNo !== null) return Number(r.trainno) === userTrainNo;
      if (userDepTime !== null) return String(r.depplandtime).slice(0, 12) === userDepTime;
      return false;
    });
    if (!hit) return { matched: false, reason: 'not_found' };

    const trainNoOut = String(hit.trainno).replace(/^0+/, '') || '0';
    const placeId = `train:tago:${trainNoOut}:${input.runDt}:car${input.carOrdr}`;
    return {
      matched: true,
      placeId,
      trainNo: trainNoOut,
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

// ── ExpBusInfo / SuburbsBusInfo (고속·시외버스) ───────────────────
// 좌석권 정보(출도착 터미널 + 출발일+시각 + 등급)를 받아 당일 배차 검증.
// 두 service schema 거의 동일: terminal list / grade list / 출도착 시각표.
// placeId = intercity-bus:{kind}:{routeId}:{depPlandTime} 예) intercity-bus:exp:NAEK010300:202605281200

// ExpBusInfo/SuburbsBusInfo는 가이드 docx의 camelCase 그대로 (cityCode, cityName).
// TrainInfo는 실측에서 소문자 (citycode, cityname) — 시리즈 간 일관성 없음.
interface CityCodeRow { cityCode: string | number; cityName: string }
interface TerminalRow { terminalId: string; terminalNm: string; cityName?: string }
interface GradeRow { gradeId: string | number; gradeNm: string }
interface IntercityScheduleRow {
  routeId: string;
  gradeNm: string;
  depPlandTime: string | number;   // YYYYMMDDHHMI (실측 14자리 가능)
  arrPlandTime: string | number;
  depPlaceNm: string;
  arrPlaceNm: string;
  charge?: number;
}

type IntercityKind = 'exp' | 'suburbs';

const KIND_TO_SERVICE: Record<IntercityKind, string> = {
  exp: 'ExpBusInfo',
  suburbs: 'SuburbsBusInfo',
};

const KIND_GRADE_OP: Record<IntercityKind, string> = {
  exp: 'GetExpBusGradList',
  suburbs: 'GetSuberbsBusGradList',
};

const KIND_TERMINAL_OP: Record<IntercityKind, string> = {
  exp: 'GetExpBusTrminlList',
  suburbs: 'GetSuberbsBusTrminlList',
};

const KIND_SCHEDULE_OP: Record<IntercityKind, string> = {
  exp: 'GetStrtpntAlocFndExpbusInfo',
  suburbs: 'GetStrtpntAlocFndSuberbsBusInfo',
};

export const intercityBusProvider = {
  async listCities(kind: IntercityKind, key: string): Promise<TrainCity[]> {
    // 두 service 모두 GetCtyCodeList 동일 path.
    const url = `${TAGO_BASE}/${KIND_TO_SERVICE[kind]}/GetCtyCodeList?serviceKey=${key}&_type=json`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<CityCodeRow>;
    return normalizeItems(body).map((r) => ({ cityCode: String(r.cityCode), cityName: r.cityName }));
  },

  async listTerminals(kind: IntercityKind, opts: { terminalNm?: string; cityCode?: string }, key: string): Promise<IntercityBusTerminal[]> {
    const params = new URLSearchParams({ serviceKey: key, _type: 'json', numOfRows: '50', pageNo: '1' });
    if (opts.terminalNm) params.set('terminalNm', opts.terminalNm);
    if (opts.cityCode) params.set('cityCode', opts.cityCode);
    const url = `${TAGO_BASE}/${KIND_TO_SERVICE[kind]}/${KIND_TERMINAL_OP[kind]}?${params.toString()}`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<TerminalRow>;
    return normalizeItems(body).map((r) => ({
      terminalId: r.terminalId,
      terminalNm: r.terminalNm,
      cityName: r.cityName,
    }));
  },

  async listGrades(kind: IntercityKind, key: string): Promise<IntercityBusGrade[]> {
    const url = `${TAGO_BASE}/${KIND_TO_SERVICE[kind]}/${KIND_GRADE_OP[kind]}?serviceKey=${key}&_type=json`;
    const res = await timedFetch(url);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as TagoEnvelope<GradeRow>;
    return normalizeItems(body).map((r) => ({ gradeId: String(r.gradeId), gradeNm: r.gradeNm }));
  },

  async verify(kind: IntercityKind, input: {
    depTerminalId: string; arrTerminalId: string;
    depPlandTime: string;        // YYYYMMDDHHMI — 좌석권상 출발 시각
    busGradeId?: string;
  }, key: string): Promise<IntercityBusVerifyResult> {
    // TAGO는 trainNo 같은 차량 단위 ID가 없음. 매칭 키는 routeId + 정확한 depPlandTime.
    const runDt = input.depPlandTime.slice(0, 8); // YYYYMMDD
    const params = new URLSearchParams({
      serviceKey: key,
      _type: 'json',
      depTerminalId: input.depTerminalId,
      arrTerminalId: input.arrTerminalId,
      depPlandTime: runDt,
      numOfRows: '200',
      pageNo: '1',
    });
    if (input.busGradeId) params.set('busGradeId', input.busGradeId);
    const url = `${TAGO_BASE}/${KIND_TO_SERVICE[kind]}/${KIND_SCHEDULE_OP[kind]}?${params.toString()}`;
    const res = await timedFetch(url);
    if (!res.ok) return { matched: false, reason: `upstream_${res.status}` };
    const body = (await res.json()) as TagoEnvelope<IntercityScheduleRow>;
    if (body.response?.header?.resultCode !== '00') {
      return { matched: false, reason: body.response?.header?.resultMsg ?? 'upstream_error' };
    }
    const rows = normalizeItems(body);
    if (rows.length === 0) return { matched: false, reason: 'service_closed' };

    // 사용자 입력 depPlandTime(12자리)와 응답 row의 depPlandTime 비교.
    // 분 단위 정확 일치 필요 (사용자가 좌석권에서 정확한 출발시각 입력 가정).
    const target = input.depPlandTime.slice(0, 12);
    const hit = rows.find((r) => String(r.depPlandTime).slice(0, 12) === target);
    if (!hit) return { matched: false, reason: 'not_found' };

    const placeId = `intercity-bus:${kind}:${hit.routeId}:${target}`;
    return {
      matched: true,
      placeId,
      kind,
      routeId: hit.routeId,
      gradeNm: hit.gradeNm,
      depPlaceNm: hit.depPlaceNm,
      arrPlaceNm: hit.arrPlaceNm,
      depPlandTime: String(hit.depPlandTime),
      arrPlandTime: String(hit.arrPlandTime),
    };
  },
};

// ── SubwayInfo (지방 도시철도 station 키워드 검색) ─────────────────

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
