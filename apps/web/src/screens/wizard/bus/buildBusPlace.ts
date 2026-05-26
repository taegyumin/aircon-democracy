// Pure service: 버스 wizard 입력 + (옵션) 매칭 결과 → place upsert payload.

import type { BusMatchResult } from '../../../lib/apiClient';

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
    return {
      id: `bus:vehicle:${match.vehId}`,
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
