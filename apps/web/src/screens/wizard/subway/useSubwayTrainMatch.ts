'use client';

// 실시간 지하철 열차 매칭 hook — resolved segment가 있으면 자동 fire.
// 1~9호선만 swopenAPI 대상 (그 외 노선은 segment 단위로만 투표).
// matchNonce: 같은 역 재선택해도 강제 re-fetch.

import { useEffect, useState } from 'react';
import { api, type SubwayMatchResult } from '../../../lib/apiClient';

export interface ResolvedSegment {
  line: string;
  prev: string;
  next: string;
}

export interface UseSubwayTrainMatchResult {
  trainMatch: SubwayMatchResult | null;
  matchLoading: boolean;
  bumpNonce: () => void;
}

export function useSubwayTrainMatch(resolvedSegment: ResolvedSegment | null): UseSubwayTrainMatchResult {
  const [trainMatch, setTrainMatch] = useState<SubwayMatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchNonce, setMatchNonce] = useState(0);

  useEffect(() => {
    setTrainMatch(null);
    if (!resolvedSegment) return;
    if (!/^[1-9]호선$/.test(resolvedSegment.line)) return;
    let cancelled = false;
    setMatchLoading(true);
    api.matchSubwayTrain({
      line: resolvedSegment.line,
      prev: resolvedSegment.prev,
      next: resolvedSegment.next,
    })
      .then((res) => { if (!cancelled) setTrainMatch(res); })
      .catch(() => { if (!cancelled) setTrainMatch({ matched: false, reason: 'network' }); })
      .finally(() => { if (!cancelled) setMatchLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedSegment?.line, resolvedSegment?.prev, resolvedSegment?.next, matchNonce]);

  return {
    trainMatch,
    matchLoading,
    bumpNonce: () => setMatchNonce((n) => n + 1),
  };
}
