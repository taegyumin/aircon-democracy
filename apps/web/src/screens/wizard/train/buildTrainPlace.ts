// Pure service: 기차 wizard 입력 → place upsert payload.
// 두 경로: segment-precise (prev+next 매칭 성공) OR type-based (KTX/SRT/... 선택).

export interface TrainSegment {
  operator: string;
  line: string;
  prev: string;
  next: string;
}

export interface TrainPlaceInput {
  trainCar: number | 'unknown';
  trainType: string | null;
  trainDest: string;
  segment: TrainSegment | null;
}

export interface TrainPlacePayload {
  id: string;
  name: string;
  type: 'train';
  detail: string;
}

export function buildTrainPlace({ trainCar, trainType, trainDest, segment }: TrainPlaceInput): TrainPlacePayload {
  const carLabel = trainCar === 'unknown' ? '호차 미정' : `${trainCar}호차`;
  const carIdPart = trainCar === 'unknown' ? 'x' : String(trainCar);
  if (segment) {
    return {
      id: `train:seg:${segment.operator}:${segment.line}:${segment.prev}-${segment.next}:${carIdPart}`,
      name: `${segment.line} ${segment.prev}→${segment.next} · ${carLabel}`,
      type: 'train',
      detail: `${segment.operator} · ${segment.line} · ${segment.prev}→${segment.next}`,
    };
  }
  const dest = trainDest.trim();
  const destPart = dest ? `:${dest}` : '';
  return {
    id: `train:${trainType}${destPart}:${carIdPart}`,
    name: dest ? `${trainType} ${carLabel} (${dest}행)` : `${trainType} ${carLabel}`,
    type: 'train',
    detail: dest ? `${trainType} · ${dest}행` : (trainType ?? ''),
  };
}
