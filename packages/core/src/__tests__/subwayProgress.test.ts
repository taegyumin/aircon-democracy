import { describe, it, expect } from 'vitest';
import { estimateProgress } from '../subwayProgress';

describe('estimateProgress — swopenAPI statnNm + trainSttus → 0~1 추정', () => {
  // 5 STATES (Claude Design 시안 A 기준):
  // 0   = prev 정차      (at-prev)
  // 0.15 = prev 막 출발  (just-left-prev)
  // 0.5  = 중간 (fallback fetch)
  // 0.85 = next 거의 도착 (approaching-next)
  // 1.0  = next 정차      (at-next)

  it('prev에 도착·정차 (statnNm=prev, sttus=1) → at-prev', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '강남', trainSttus: '1' }))
      .toEqual({ progress: 0, progressLabel: 'at-prev' });
  });

  it('prev에 진입 중 (statnNm=prev, sttus=0) → at-prev (아직 안 떠남)', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '강남', trainSttus: '0' }))
      .toEqual({ progress: 0, progressLabel: 'at-prev' });
  });

  it('prev 막 출발 (statnNm=prev, sttus=2) → just-left-prev', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '강남', trainSttus: '2' }))
      .toEqual({ progress: 0.15, progressLabel: 'just-left-prev' });
  });

  it('next 진입 중 (statnNm=next, sttus=0) → approaching-next', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '역삼', trainSttus: '0' }))
      .toEqual({ progress: 0.85, progressLabel: 'approaching-next' });
  });

  it('next 도착·정차 (statnNm=next, sttus=1) → at-next', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '역삼', trainSttus: '1' }))
      .toEqual({ progress: 1.0, progressLabel: 'at-next' });
  });

  it('next 출발 (statnNm=next, sttus=2) → at-next (이미 도달)', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '역삼', trainSttus: '2' }))
      .toEqual({ progress: 1.0, progressLabel: 'at-next' });
  });

  it('다른 역에서 검출 (fallback) → between', () => {
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '선릉', trainSttus: '2' }))
      .toEqual({ progress: 0.5, progressLabel: 'between' });
  });

  it('역 이름 끝 "역" 접미사 자동 strip', () => {
    expect(estimateProgress({ prev: '강남역', next: '역삼', statnNm: '강남', trainSttus: '1' }))
      .toEqual({ progress: 0, progressLabel: 'at-prev' });
    expect(estimateProgress({ prev: '강남', next: '역삼', statnNm: '역삼역', trainSttus: '1' }))
      .toEqual({ progress: 1.0, progressLabel: 'at-next' });
  });
});
