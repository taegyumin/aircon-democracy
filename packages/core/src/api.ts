import type { PlaceType } from './places';

export interface ApiPlace {
  id: string;
  name: string;
  type: PlaceType;
  district: string | null;
  detail: string | null;
  created_at: number;
}

export interface PlaceWithCounts extends ApiPlace {
  cold: number;
  ok: number;
  hot: number;
}

export interface MyVote {
  vote: 'cold' | 'ok' | 'hot';
  voted_at: number;
  changed_at: number;
  expires_at: number;
  cooldown_remaining_ms: number;
}

export interface PlaceDetail {
  place: ApiPlace;
  votes: { cold: number; ok: number; hot: number };
  me: MyVote | null;
}

class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface ApiClientOptions {
  /** prefix prepended to all paths. web에선 '' (same-origin), mobile에선 'https://...'. */
  baseUrl?: string;
  /** mobile/native에서 voter/session cookie를 못 쓰는 환경용 — Authorization 등 추가 헤더 주입. */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** 기본 'include' (web cookie). mobile은 cookie 없으므로 'omit' 적합. */
  credentials?: RequestCredentials;
  /** Response 받은 직후 호출 — mobile은 X-Aircon-Voter-Token 헤더 capture해서 SecureStore 저장. */
  onResponse?: (res: Response) => void;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? '';
  const credentials = options.credentials ?? 'include';

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const method = (init?.method ?? 'GET').toUpperCase();
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const authHeaders = options.getAuthHeaders ? await options.getAuthHeaders() : {};
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials,
      headers: {
        'Content-Type': 'application/json',
        // Server's csrfGuard requires this header on mutations in addition
        // to the same-origin Origin check (functions/api/_abuse.ts).
        ...(isMutation ? { 'X-Aircon-Intent': 'user-action' } : {}),
        ...authHeaders,
        ...(init?.headers ?? {}),
      },
    });
    options.onResponse?.(res);
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* tolerate empty body */
    }
    if (!res.ok) {
      const msg = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      throw new ApiError(res.status, body, msg);
    }
    return body as T;
  }

  return {
    listPlaces: () => request<{ places: PlaceWithCounts[] }>('/api/places'),

    getPlace: (id: string) => request<PlaceDetail>(`/api/places/${encodeURIComponent(id)}`),

    createPlace: (input: { name: string; type: PlaceType; district?: string; detail?: string }) =>
      request<ApiPlace>('/api/places', { method: 'POST', body: JSON.stringify(input) }),

    upsertPlace: (input: { id: string; name: string; type: PlaceType; district?: string; detail?: string }) =>
      request<{ id: string }>('/api/places/upsert', { method: 'POST', body: JSON.stringify(input) }),

    vote: (placeId: string, vote: 'cold' | 'ok' | 'hot') =>
      request<{ ok: true; vote: 'cold' | 'ok' | 'hot'; expires_at: number }>(
        `/api/places/${encodeURIComponent(placeId)}/vote`,
        { method: 'POST', body: JSON.stringify({ vote }) },
      ),

    deleteVote: (placeId: string) =>
      request<{ ok: true; removed: boolean }>(
        `/api/places/${encodeURIComponent(placeId)}/vote`,
        { method: 'DELETE' },
      ),

    // ── Realtime: subway train identification ───────────────────────
    matchSubwayTrain: (input: { line: string; prev: string; next: string }) =>
      request<SubwayMatchResult>('/api/realtime/subway/match', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // ── Realtime: bus vehicle identification (stop-based) ───────────
    // region: 'seoul' (default) → ws.bus.go.kr. 그 외 cityCode 숫자 → TAGO 1613000.
    matchBusVehicle: (input: {
      routeName: string; stopName: string;
      region?: string; routeId?: string;
    }) =>
      request<BusMatchResult>('/api/realtime/bus/match', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // ── Bus 리디자인: 노선 자동완성 + 정류장 list ─────────────────────
    searchBusRoutes: (q: string, region?: string) => {
      const params = new URLSearchParams({ q });
      if (region) params.set('region', region);
      return request<{ routes: BusRouteCandidate[]; reason?: string }>(
        `/api/realtime/bus/route-search?${params.toString()}`,
      );
    },

    // Timeline picker용 — 노선의 모든 vehicle 위치 한 번에.
    // BusWizard 3-step (region·route·vehicle) 마지막 단계에서 시각적 선택.
    listBusRouteVehicles: (routeId: string, region?: string) => {
      const params = new URLSearchParams({ routeId });
      if (region) params.set('region', region);
      return request<{ vehicles: BusVehiclePosition[]; reason?: string }>(
        `/api/realtime/bus/route-vehicles?${params.toString()}`,
      );
    },

    listBusRouteStations: (routeId: string, region?: string) => {
      const params = new URLSearchParams({ routeId });
      if (region) params.set('region', region);
      return request<{ stations: BusRouteStation[]; reason?: string }>(
        `/api/realtime/bus/route-stations?${params.toString()}`,
      );
    },

    // GPS 좌표 → region ('seoul' 또는 cityCode). NCP reverse-geocode 래핑.
    busRegionByCoords: (lat: number, lng: number) =>
      request<{ region: string | null; sidoName?: string; sigunguName?: string; reason?: string }>(
        `/api/realtime/bus/region-by-coords?lat=${lat}&lng=${lng}`,
      ),

    // POI (카페·음식점) 검색 — NAVER Local + Kakao Local 합쳐서 dedup된 결과.
    // lat/lng 있으면 Kakao는 위치 기반 검색 (NAVER는 query만, 좌표 미반영).
    searchPoi: (q: string, opts?: { lat?: number; lng?: number }) => {
      const params = new URLSearchParams({ q });
      if (opts?.lat != null) params.set('lat', String(opts.lat));
      if (opts?.lng != null) params.set('lng', String(opts.lng));
      return request<{ results: PoiResult[]; reason?: string }>(
        `/api/realtime/poi/search?${params.toString()}`,
      );
    },

    // 로그인 사용자가 사적 공간 직접 등록. 비로그인 → 401.
    // placeId 받아 /p/<id> 공유 + QR + 인쇄 페이지로 연결.
    createUserPlace: (input: { name: string; type: string; description?: string | null }) =>
      request<{ id: string; name: string; type: string; description: string | null; created_at: number }>(
        '/api/places/user',
        { method: 'POST', body: JSON.stringify(input) },
      ),

    // 공개(is_public=1) 장소 이름 LIKE 검색. 로그인 불요.
    // '다른 장소 찾기' 첫 단계 — 사적 공간(is_public=0)은 노출 X.
    searchPublicPlaces: (q: string) =>
      request<{ places: PlaceWithCounts[] }>(`/api/places/search?q=${encodeURIComponent(q)}`),

    // 장소 정보 신고 (anonymous). 같은 voter + place + reason 중복 시 409.
    reportPlace: (placeId: string, input: { reason: string; note?: string | null }) =>
      request<{ id: string; status: 'pending' }>(
        `/api/places/${encodeURIComponent(placeId)}/report`,
        { method: 'POST', body: JSON.stringify(input) },
      ),

    // ── TAGO 간선철도 (TrainInfo) — 사용자 좌석권 검증 ──────────────────
    // 도시 list (서울=11, 부산=21, …). UI 출도착 도시 picker.
    listTrainCities: () =>
      request<{ cities: TrainCity[]; reason?: string }>('/api/realtime/train/cities'),

    // 도시별 기차역 list (서울 → 서울/용산/영등포/...).
    listTrainStations: (cityCode: string) => {
      const p = new URLSearchParams({ cityCode });
      return request<{ stations: TrainStationApi[]; reason?: string }>(
        `/api/realtime/train/stations?${p.toString()}`,
      );
    },

    // 열차종 enum (KTX/ITX/새마을/무궁화/SRT/…).
    listTrainVehicleKinds: () =>
      request<{ kinds: TrainVehicleKind[]; reason?: string }>('/api/realtime/train/vehicle-kinds'),

    // 좌석권 정보 검증 → 운행 중인 차량이면 placeId 발급.
    // trainNo / depPlandTimeHHMI 둘 중 하나 필수. 사용자 입력 단순화 위해 시각만 받는 경우 多.
    verifyTrain: (input: {
      trainNo?: string;
      depPlandTimeHHMI?: string;       // YYYYMMDDHHMI 12자리
      runDt: string;
      depPlaceId: string; arrPlaceId: string;
      carOrdr: number;
    }) =>
      request<TrainVerifyResult>('/api/realtime/train/verify', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // ── TAGO 고속·시외버스 (ExpBusInfo / SuburbsBusInfo) ─────────────
    listIntercityBusCities: (kind: 'exp' | 'suburbs') =>
      request<{ cities: TrainCity[]; reason?: string }>(`/api/realtime/intercity-bus/${kind}/cities`),

    listIntercityBusTerminals: (kind: 'exp' | 'suburbs', opts?: { terminalNm?: string; cityCode?: string }) => {
      const p = new URLSearchParams();
      if (opts?.terminalNm) p.set('terminalNm', opts.terminalNm);
      if (opts?.cityCode) p.set('cityCode', opts.cityCode);
      const qs = p.toString();
      return request<{ terminals: IntercityBusTerminal[]; reason?: string }>(
        `/api/realtime/intercity-bus/${kind}/terminals${qs ? '?' + qs : ''}`,
      );
    },

    listIntercityBusGrades: (kind: 'exp' | 'suburbs') =>
      request<{ grades: IntercityBusGrade[]; reason?: string }>(`/api/realtime/intercity-bus/${kind}/grades`),

    verifyIntercityBus: (kind: 'exp' | 'suburbs', input: {
      depTerminalId: string; arrTerminalId: string;
      depPlandTime: string;       // YYYYMMDDHHMI 12자리
      busGradeId?: string;
    }) =>
      request<IntercityBusVerifyResult>(`/api/realtime/intercity-bus/${kind}/verify`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    // ── 용인에버라인 (비공식) — 실시간 차량 위치 ─────────────────────
    listEverlineVehicles: () =>
      request<{ vehicles: EverlineVehicle[]; stations: EverlineStation[]; reason?: string }>(
        '/api/realtime/everline/positions',
      ),

    // ── TAGO 지방 도시철도 (SubwayInfo) — station 키워드 검색 ─────────
    // region: 'all' | 'busan' | 'daegu' | 'gwangju' | 'daejeon' | 'incheon2'.
    searchRegionalSubwayStations: (q: string, region?: string) => {
      const p = new URLSearchParams({ q });
      if (region) p.set('region', region);
      return request<{ stations: RegionalSubwayStation[]; reason?: string }>(
        `/api/realtime/regional-subway/search?${p.toString()}`,
      );
    },

    // ── Auth ─────────────────────────────────────────────────────────
    me: () => request<{ user: User | null }>('/api/me'),
    logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

// Default client — web (same-origin, cookie credentials). 기존 import 경로 호환.
export const api = createApiClient();

export interface SubwayMatchCandidate {
  trainNo: string;
  currentStation: string;
  // swopenAPI sttus: 0=진입, 1=도착, 2=출발, 3=전역출발
  trainSttus: string;
  direction: 'up' | 'down';
  destination?: string;
  // mini progress bar 표시용 — backend가 estimateProgress로 미리 계산.
  progress?: number;
  progressLabel?: string;
}

// Subway match failure reasons — 표준 enum.
// 서버는 이 외 임의 string 반환 안 함 (catch error는 'upstream_error'로 normalize).
// client는 이 union으로 매칭 안내 UI 분기.
export const SUBWAY_MATCH_REASONS = [
  'no_train_at_segment',     // 해당 구간에 차량 없음 (운행 시간 무관)
  'multi_candidate',         // 같은 tier에 2+대 — 사용자 picker 필요
  'no_api_key',              // 서버에 SEOUL_REALTIME_KEY 없음
  'realtime_unsupported',    // swopenAPI가 이 노선 데이터 자체를 안 가짐 (지방 경전철 등)
  'service_closed',          // 운행 종료 (헤드웨이 기준 0대)
  'temporarily_closed',      // kill switch
  'forbidden',               // blocked subject
  'too_many_requests',       // rate limit
  'upstream_error',          // swopenAPI/에버라인 호출 실패
] as const;
export type SubwayMatchReason = typeof SUBWAY_MATCH_REASONS[number];

export interface SubwayMatchResult {
  matched: boolean;
  trainNo?: string;
  direction?: 'up' | 'down';
  currentStation?: string;
  destination?: string;
  reason?: SubwayMatchReason;
  // 같은 tier에 차량 2+대일 때 사용자에게 선택 받기 위해. reason='multi_candidate'와 짝.
  candidates?: SubwayMatchCandidate[];
  // 0~1 사이 prev → next 진행도. swopenAPI의 statnNm + trainSttus 조합으로 추정.
  // 정확한 위치(GPS)는 못 줘서 5단계 discrete: 정차/막 출발/이동/거의 도착/도착.
  // UI에서 mini-train slider 표시용.
  progress?: number;
  // 'at-prev' | 'just-left-prev' | 'between' | 'approaching-next' | 'at-next'
  progressLabel?: 'at-prev' | 'just-left-prev' | 'between' | 'approaching-next' | 'at-next';
}

export interface BusMatchCandidate {
  vehId: string;
  plainNo: string;
  stOrd: number;            // 정류장 sequence (1-based)
  stopFlag?: string;        // '1' = 도착, 그 외 = 진입/통과
  // 진행도 (정류장 sequence 기반, 0~1). UI mini bar 표시용.
  progress?: number;
  progressLabel?: 'at-stop' | 'just-left' | 'approaching' | 'between';
}

export interface BusMatchResult {
  matched: boolean;
  vehId?: string;
  plainNo?: string;       // 노출용 차량 번호판
  routeId?: string;
  routeName?: string;
  currentStop?: string;
  nextStop?: string;
  reason?: string;
  // 같은 stop 근처 차량 2+일 때 사용자에게 선택받기 위해. reason='multi_candidate'와 짝.
  candidates?: BusMatchCandidate[];
  // 단일 매칭 시 진행도 (vehId의 위치). UI mini bar.
  progress?: number;
  progressLabel?: 'at-stop' | 'just-left' | 'approaching' | 'between';
}

// 노선 자동완성 row — data.go.kr getBusRouteList 정규화.
export interface BusRouteCandidate {
  id: string;             // busRouteId (9자리 숫자 문자열)
  name: string;           // busRouteNm (예: '271', '9401A')
  type: string;           // routeType raw 코드
  typeLabel: string;      // '간선' | '지선' | '광역' | '순환' | ...
  startStop: string;      // stStationNm (시점 정류장)
  endStop: string;        // edStationNm (종점 정류장)
}

// 노선 정류장 sequence — GPS 기반 nearby pick + 전체 list 둘 다.
export interface PoiResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  source: 'naver' | 'kakao';
  externalId?: string;
}

// Route timeline picker용 — 노선의 모든 vehicle 위치 list (한 시점).
// 사용자가 시각적 timeline에서 자기 탑승 차량 직접 선택.
export interface BusVehiclePosition {
  vehId: string;
  plainNo: string;          // 차량번호판 (사용자에게 노출)
  stOrd: number;            // 1-based sequence
  stopFlag?: string;        // '1' = 도착, 그 외 = 진입/통과
  busType?: string;         // 일반/저상 등 (선택)
}

export interface BusRouteStation {
  seq: number;            // 1부터 시작하는 정차 순서
  name: string;
  x: number | null;       // 경도 (gpsX) — null 가능
  y: number | null;       // 위도 (gpsY)
  arsId: string | null;   // ARS 번호 (사용자에게 노출 시)
}

// ── TAGO 간선철도 (TrainInfo) types ────────────────────────────────
export interface TrainCity {
  cityCode: string;          // "11", "21", …
  cityName: string;          // "서울특별시", "부산광역시"
}

export interface TrainStationApi {
  nodeId: string;            // "NAT010000" (서울), "NATH30000" (수서)
  nodeName: string;          // "서울", "용산", …
}

export interface TrainVehicleKind {
  vehicleKndId: string;      // "00", "07", "17", …
  vehicleKndNm: string;      // "KTX", "KTX-산천(A-type)", "SRT", "ITX-새마을", …
}

export interface TrainVerifyResult {
  matched: boolean;
  // matched=true 시 다 채워짐.
  placeId?: string;           // train:tago:{trainNo}:{runDt}:car{N}
  trainNo?: string;
  runDt?: string;
  carOrdr?: number;
  vehicleKndNm?: string;
  depPlaceNm?: string;
  arrPlaceNm?: string;
  depPlandTime?: string;      // "YYYYMMDDHHMI"
  arrPlandTime?: string;
  // matched=false 시 사유. 'not_found' | 'not_running_today' | 'service_closed' | 'invalid_*'
  reason?: string;
}

// ── TAGO 고속·시외버스 (ExpBusInfo / SuburbsBusInfo) types ───────
export interface IntercityBusTerminal {
  terminalId: string;     // "NAEK020" (고속) / "NAI0671801" (시외)
  terminalNm: string;     // "센트럴시티(서울)", "서울남부"
  cityName?: string;      // 시외버스 응답에만 있음
}

export interface IntercityBusGrade {
  gradeId: string;        // "1"(고속 우등) / "IDG"(시외 일반) 등
  gradeNm: string;        // "우등", "일반", …
}

export type IntercityBusKind = 'exp' | 'suburbs';

export interface IntercityBusVerifyResult {
  matched: boolean;
  placeId?: string;       // intercity-bus:{kind}:{routeId}:{depPlandTime}
  kind?: IntercityBusKind;
  routeId?: string;
  gradeNm?: string;
  depPlaceNm?: string;
  arrPlaceNm?: string;
  depPlandTime?: string;
  arrPlandTime?: string;
  reason?: string;
}

// ── 용인에버라인 (비공식 everlinecu.com) ──────────────────────────
// 실시간 차량 위치 — Y110~Y124 (기흥~전대·에버랜드 15개 역).
// 운영사 자체 endpoint라 ToS 회색지대. 사용자 결정에 따라 production 채택.
export interface EverlineStation {
  stCode: string;       // "Y110", "Y124"
  name: string;         // "기흥", "전대·에버랜드"
}

export interface EverlineVehicle {
  trainNo: string;
  stCode: string;
  stationName: string;          // 역명 (backend가 매핑)
  destCode: string;
  destName: string;
  direction: 'giheung' | 'everland'; // updownCode 1/2 → string
  status: 'returning' | 'stopped' | 'running'; // StatusCode 1/2/3
  elapsedSec: number;           // 현 상태 후 경과 초
}

// ── TAGO 지방 도시철도 (SubwayInfo) types ──────────────────────────
export interface RegionalSubwayStation {
  subwayStationId: string;   // "MTRBS1119" 등
  subwayStationName: string; // "서면", "동대구"
  subwayRouteName: string;   // "1호선", "2호선", "대경선"
  // backend가 stationId prefix로 분류해서 함께 반환 — UI 그룹화·필터에 사용.
  region: 'busan' | 'daegu' | 'gwangju' | 'daejeon' | 'incheon2' | 'other';
}

export interface User {
  id: string;
  display_name: string | null;
  profile_image_url: string | null;
  provider: string;
}

export const KAKAO_LOGIN_URL = '/api/auth/kakao';
export const NAVER_LOGIN_URL = '/api/auth/naver';
export const GOOGLE_LOGIN_URL = '/api/auth/google';

export { ApiError };
