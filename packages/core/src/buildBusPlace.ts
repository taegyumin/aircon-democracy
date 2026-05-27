// Pure service: 버스 wizard 입력 + (옵션) 매칭 결과 → place upsert payload.
// web + mobile 공유 — 같은 id schema 보장 (LLM 리뷰 P2: builder drift 방지).
//
// 2026-05-27 LLM P1: fallback id에 region/routeId 누락 → "서울 10번 / 부산 10번"
// 같은 bucket으로 섞이는 데이터 무결성 위험. region + routeId(매칭 실패해도 사용자가
// 노선 picker로 선택한 거)를 id에 포함.

import type { BusMatchResult } from './api';

export interface BusPlaceInput {
  routeName: string;
  stopName: string;
  match: BusMatchResult | null;
  // region: 'seoul' or TAGO cityCode string. 없으면 'seoul' fallback (legacy 호환).
  region?: string;
  // 사용자가 노선 picker에서 선택한 data.go.kr routeId. 매칭 실패해도 region 안에서
  // 유일하게 노선 식별. 없으면 routeName으로 fallback.
  routeId?: string;
}

export interface BusPlacePayload {
  id: string;
  name: string;
  type: 'bus';
  detail?: string;
}

// id-safe: ':' 와 공백 등 placeId regex 어긋나는 문자 제거.
function idSafe(s: string): string {
  return s.replace(/[\s:]/g, '');
}

export function buildBusPlace({ routeName, stopName, match, region, routeId }: BusPlaceInput): BusPlacePayload {
  const route = routeName.trim();
  const stop = stopName.trim();
  // region prefix: seoul은 'seoul', TAGO는 cityCode 숫자. 'seoul'이 default라
  // 옛 placeId (bus:271:신촌오거리)는 자연스럽게 'seoul'로 흘러간다.
  // 다만 fallback id에 region을 박으면 옛 vote 데이터와 bucket이 달라지는데,
  // 안전 측면이 우선 — 잘못된 합산보다는 새 bucket이 낫다 (LLM P1).
  const regionKey = region ?? 'seoul';
  // 매칭된 차량 id — vehId가 영구 ID라 차량 단위 vote.
  if (match?.matched && match.vehId) {
    const routeKey = idSafe(match.routeId ?? routeId ?? match.routeName ?? route);
    return {
      id: `bus:vehicle:${regionKey}:${routeKey}:${idSafe(match.vehId)}`,
      name: `${match.routeName ?? route}번 [차량 ${match.plainNo ?? match.vehId}]`,
      type: 'bus',
      detail: match.currentStop ? `${match.currentStop} 지남` : undefined,
    };
  }
  // Fallback: 매칭 실패 / 정류장 모름. region + routeId(또는 routeName) + stop.
  // routeId가 있으면 같은 번호의 다른 노선(양방향/지선)이 분리됨.
  const routeKey = idSafe(routeId ?? route);
  const stopPart = stop ? `:stop:${idSafe(stop)}` : '';
  return {
    id: `bus:${regionKey}:${routeKey}${stopPart}`,
    name: stop ? `${route}번 버스 (${stop})` : `${route}번 버스`,
    type: 'bus',
    detail: stop || undefined,
  };
}
