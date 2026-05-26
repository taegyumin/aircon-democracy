'use client';

// 버스 차량 매칭 hook.
//
// Race-condition 방지:
//   1. seq 카운터로 stale response를 무시한다 (`tryMatch` 호출마다 ++).
//   2. 응답에 `input` snapshot을 박아둔다 — 호출자(BusWizard) 또는
//      buildBusPlace가 현재 입력과 비교해 stale match를 한 번 더 거를 수 있게.
//   3. `reset()`은 in-flight seq도 무효화한다 (loading도 같이 내림).

import { useCallback, useRef, useState } from 'react';
import { api, type BusMatchResult } from '../../../lib/apiClient';

export interface BusMatchInput {
  routeName: string;
  stopName: string;
}

// Hook이 외부에 노출하는 enriched type. 어떤 입력에서 나온 결과인지 함께 들고있어
// stale match 판별을 가능하게 한다.
export interface BusMatchWithInput extends BusMatchResult {
  input: BusMatchInput;
}

export interface UseBusMatchResult {
  match: BusMatchWithInput | null;
  loading: boolean;
  triggered: boolean;
  tryMatch: (routeName: string, stopName: string) => Promise<void>;
  reset: () => void;
}

export function useBusMatch(): UseBusMatchResult {
  const [match, setMatch] = useState<BusMatchWithInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const seqRef = useRef(0);

  const tryMatch = useCallback(async (routeName: string, stopName: string) => {
    const r = routeName.trim();
    const s = stopName.trim();
    if (!r || !s) return;
    const mySeq = ++seqRef.current;
    setLoading(true);
    setTriggered(true);
    setMatch(null);
    try {
      const result = await api.matchBusVehicle({ routeName: r, stopName: s });
      if (seqRef.current !== mySeq) return; // 다른 요청이 시작/리셋됐다면 결과 버림.
      setMatch({ ...result, input: { routeName: r, stopName: s } });
    } catch (e) {
      if (seqRef.current !== mySeq) return;
      setMatch({ matched: false, reason: (e as Error).message, input: { routeName: r, stopName: s } });
    } finally {
      if (seqRef.current === mySeq) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    seqRef.current++; // 진행 중인 요청 무효화
    setMatch(null);
    setTriggered(false);
    setLoading(false);
  }, []);

  return { match, loading, triggered, tryMatch, reset };
}

// Pure helper: 현재 입력과 match의 input이 일치할 때만 match를 반환.
// 입력이 바뀌었거나 match가 null이면 null 반환 → builder는 fallback 분기를 탄다.
export function freshenBusMatch(
  match: BusMatchWithInput | null,
  currentRouteName: string,
  currentStopName: string,
): BusMatchWithInput | null {
  if (!match) return null;
  const r = currentRouteName.trim();
  const s = currentStopName.trim();
  if (match.input.routeName !== r || match.input.stopName !== s) return null;
  return match;
}
