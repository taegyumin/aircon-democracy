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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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

export const api = {
  listPlaces: () => request<{ places: PlaceWithCounts[] }>('/api/places'),

  getPlace: (id: string) => request<PlaceDetail>(`/api/places/${encodeURIComponent(id)}`),

  createPlace: (input: { name: string; type: PlaceType; district?: string; detail?: string }) =>
    request<ApiPlace>('/api/places', { method: 'POST', body: JSON.stringify(input) }),

  vote: (placeId: string, vote: 'cold' | 'ok' | 'hot') =>
    request<{ ok: true; vote: 'cold' | 'ok' | 'hot'; expires_at: number }>(
      `/api/places/${encodeURIComponent(placeId)}/vote`,
      { method: 'POST', body: JSON.stringify({ vote }) }
    ),
};

export { ApiError };
