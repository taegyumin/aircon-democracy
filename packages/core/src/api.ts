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

    // 로그인 사용자가 사적 공간 직접 등록. 비로그인 → 401.
    // placeId 받아 /p/<id> 공유 + QR + 인쇄 페이지로 연결.
    createUserPlace: (input: { name: string; type: string; description?: string | null }) =>
      request<{ id: string; name: string; type: string; description: string | null; created_at: number }>(
        '/api/places/user',
        { method: 'POST', body: JSON.stringify(input) },
      ),

    // ── Auth ─────────────────────────────────────────────────────────
    me: () => request<{ user: User | null }>('/api/me'),
    logout: () => request<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

// Default client — web (same-origin, cookie credentials). 기존 import 경로 호환.
export const api = createApiClient();

export interface SubwayMatchResult {
  matched: boolean;
  trainNo?: string;
  direction?: 'up' | 'down';
  currentStation?: string;
  destination?: string;
  reason?: string;
  // 0~1 사이 prev → next 진행도. swopenAPI의 statnNm + trainSttus 조합으로 추정.
  // 정확한 위치(GPS)는 못 줘서 5단계 discrete: 정차/막 출발/이동/거의 도착/도착.
  // UI에서 mini-train slider 표시용.
  progress?: number;
  // 'at-prev' | 'just-left-prev' | 'between' | 'approaching-next' | 'at-next'
  progressLabel?: 'at-prev' | 'just-left-prev' | 'between' | 'approaching-next' | 'at-next';
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
export interface BusRouteStation {
  seq: number;            // 1부터 시작하는 정차 순서
  name: string;
  x: number | null;       // 경도 (gpsX) — null 가능
  y: number | null;       // 위도 (gpsY)
  arsId: string | null;   // ARS 번호 (사용자에게 노출 시)
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
