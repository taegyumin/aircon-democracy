// Pure service: 지하철 wizard 입력 → place upsert payload.
// 두 mode:
//   - train: 두 역(prev+next) → segment 매칭 → (옵션) 실시간 trainNo 매칭 + car
//   - platform: 단일 역 승강장 단위

import { segmentPlaceId, platformPlaceId, type Station } from '@aircon/core';

export interface SubwayMatchSummary {
  matched: boolean;
  trainNo?: string;
  destination?: string;
}

export interface SubwayTrainPlaceInput {
  line: string;
  prev: string;
  next: string;
  car: number | 'unknown';
  trainMatch: SubwayMatchSummary | null;
}

export interface SubwayPlatformPlaceInput {
  station: Station;
}

export interface SubwayPlacePayload {
  id: string;
  name: string;
  type: 'subway';
  district?: string;
  detail: string;
}

export function buildSubwayTrainPlace({ line, prev, next, car, trainMatch }: SubwayTrainPlaceInput): SubwayPlacePayload {
  const carPart = car === 'unknown' ? '' : ` ${car}호차`;
  const carIdPart = car === 'unknown' ? 'x' : String(car);
  if (trainMatch?.matched && trainMatch.trainNo) {
    const dest = trainMatch.destination ? ` (${trainMatch.destination}행)` : '';
    return {
      id: `subway:train:${line}:${trainMatch.trainNo}:${carIdPart}`,
      name: `${line} ${trainMatch.trainNo}번 열차${dest}${carPart}`,
      type: 'subway',
      detail: `${line} · ${trainMatch.trainNo}번 열차 · ${prev}→${next}`,
    };
  }
  return {
    id: segmentPlaceId(line, prev, next, car),
    name: `${line} ${prev}→${next}${carPart}`,
    type: 'subway',
    detail: `${line} · ${prev}→${next} 구간`,
  };
}

export function buildSubwayPlatformPlace({ station }: SubwayPlatformPlaceInput): SubwayPlacePayload {
  return {
    id: platformPlaceId(station.name, station.lines),
    name: `${station.name} 승강장`,
    type: 'subway',
    district: station.city + (station.areas[0] ? ' ' + station.areas[0] : ''),
    detail: station.lines.join(' · '),
  };
}
