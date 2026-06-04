// 2026-06-04: 본체를 @aircon/core/buildSubwayPlace로 이동 (web + mobile 공유).
// 호환성 위해 re-export만 유지. 새 import는 @aircon/core에서 직접.

export {
  buildSubwayTrainPlace,
  buildSubwayPlatformPlace,
  type SubwayMatchSummary,
  type SubwayTrainPlaceInput,
  type SubwayPlatformPlaceInput,
  type SubwayPlacePayload,
} from '@aircon/core';
