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
    matchBusVehicle: (input: { routeName: string; stopName: string }) =>
      request<BusMatchResult>('/api/realtime/bus/match', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

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
