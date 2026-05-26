// Pure: swopenAPI realtime row → prev/next 사이 진행도(0~1) 추정.
//
// swopenAPI는 "역 단위"만 제공. 정확한 위치(GPS) 안 줌. 대신 statnNm + trainSttus
// 조합으로 5단계 discrete 추정 가능 — 충분히 의미 있는 시각화 (디자인 시안 A).
//
// trainSttus:
//   '0' = 해당역 진입 중 (직전 segment 끝)
//   '1' = 해당역 도착·정차
//   '2' = 해당역 출발 (다음 segment 시작)
//   '3' = 전역에서 출발

import { stripStation } from './subwayDirection';

export type ProgressLabel =
  | 'at-prev'           // prev 정차 중 — pos 0
  | 'just-left-prev'    // prev 막 출발 — pos 0.15
  | 'between'           // 중간 (fallback fetch에서 다른 역으로 검출됨) — pos 0.5
  | 'approaching-next'  // next 진입 중 — pos 0.85
  | 'at-next';          // next 도착 — pos 1.0

export interface ProgressEstimate {
  progress: number;
  progressLabel: ProgressLabel;
}

export function estimateProgress(args: {
  prev: string;
  next: string;
  statnNm: string;
  trainSttus: string;
}): ProgressEstimate {
  const p = stripStation(args.prev);
  const n = stripStation(args.next);
  const cur = stripStation(args.statnNm);
  const sttus = args.trainSttus;

  if (cur === n) {
    // next 도달 또는 진입.
    //   '0' (진입 중): 거의 도착 — pos 0.85
    //   '1' (도착·정차): 도착 — pos 1.0
    //   '2' (출발): 이미 next 떠남, 사용자 입장에서 어쨌든 next에 닿음 — pos 1.0
    if (sttus === '0') return { progress: 0.85, progressLabel: 'approaching-next' };
    return { progress: 1.0, progressLabel: 'at-next' };
  }
  if (cur === p) {
    // prev 위치.
    //   '0' (진입 중): 이미 prev에 닿는 중이므로 출발 아직 — pos 0
    //   '1' (도착·정차): prev 정차 — pos 0
    //   '2' (출발): prev 막 출발 — pos 0.15
    //   '3' (전역 출발): 출발선이라 pos 0 취급
    if (sttus === '2') return { progress: 0.15, progressLabel: 'just-left-prev' };
    return { progress: 0, progressLabel: 'at-prev' };
  }
  // 다른 역에서 검출 (fallback fetch). prev와 next 사이 어딘가 — 중간으로 가정.
  return { progress: 0.5, progressLabel: 'between' };
}
