// Pure service: 버스 wizard 입력 + (옵션) 매칭 결과 → place upsert payload.
// web + mobile 공유 — 같은 id schema 보장 (LLM 리뷰 P2: builder drift 방지).

import type { BusMatchResult } from './api';

export interface BusPlaceInput {
  routeName: string;
  stopName: string;
  match: BusMatchResult | null;
}

export interface BusPlacePayload {
  id: string;
  name: string;
  type: 'bus';
  detail?: string;
}

export function buildBusPlace({ routeName, stopName, match }: BusPlaceInput): BusPlacePayload {
  const route = routeName.trim();
  const stop = stopName.trim();
  if (match?.matched && match.vehId) {
    // vehId는 data.go.kr 차량 영구 ID — 노선이 바뀌어도 같은 vehId.
    // routeId(없으면 routeName)도 id에 포함해서 차량 + 운행 단위로 bucket 분리.
    // 그렇지 않으면 같은 차량의 다른 노선 vote가 같은 bucket에 섞이는데
    // place name은 "<route>번 [차량 ...]"으로 노선 표시라 사용자 기대와 불일치.
    const routeKey = match.routeId ?? match.routeName ?? route;
    return {
      id: `bus:vehicle:${routeKey}:${match.vehId}`,
      name: `${match.routeName ?? route}번 [차량 ${match.plainNo ?? match.vehId}]`,
      type: 'bus',
      detail: match.currentStop ? `${match.currentStop} 지남` : undefined,
    };
  }
  return {
    id: stop ? `bus:${route}:${stop}` : `bus:${route}`,
    name: stop ? `${route}번 버스 (${stop})` : `${route}번 버스`,
    type: 'bus',
    detail: stop || undefined,
  };
}
