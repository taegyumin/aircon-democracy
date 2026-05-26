'use client';

import { useState, useCallback } from 'react';
import { api, type BusMatchResult } from '../../../lib/apiClient';

export interface UseBusMatchResult {
  match: BusMatchResult | null;
  loading: boolean;
  triggered: boolean;
  tryMatch: (routeName: string, stopName: string) => Promise<void>;
  reset: () => void;
}

export function useBusMatch(): UseBusMatchResult {
  const [match, setMatch] = useState<BusMatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const tryMatch = useCallback(async (routeName: string, stopName: string) => {
    const r = routeName.trim();
    const s = stopName.trim();
    if (!r || !s) return;
    setLoading(true);
    setTriggered(true);
    setMatch(null);
    try {
      setMatch(await api.matchBusVehicle({ routeName: r, stopName: s }));
    } catch (e) {
      setMatch({ matched: false, reason: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMatch(null);
    setTriggered(false);
  }, []);

  return { match, loading, triggered, tryMatch, reset };
}
