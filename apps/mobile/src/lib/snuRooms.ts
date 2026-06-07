// SNU 호실 데이터 lazy fetch — packages/core/src/snu.ts 의 loadRooms() 모바일 변형.
// web은 fetch('/data/snu-rooms.json') (public path)인데 RN은 절대 URL 필요.
// AsyncStorage cache로 두 번째 실행부터는 네트워크 없이 즉시.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { snu } from '@aircon/core';
import { API_BASE } from './apiClient';

type SNURoom = ReturnType<typeof snu.roomsForBuilding>[number];

const CACHE_KEY = '@aircon/snu-rooms';
const CACHE_VERSION_KEY = '@aircon/snu-rooms-version';
const CURRENT_VERSION = '1';

let inMemory: SNURoom[] | null = null;
let pending: Promise<SNURoom[]> | null = null;

export async function loadSnuRooms(): Promise<SNURoom[]> {
  if (inMemory) return inMemory;
  if (pending) return pending;
  pending = (async () => {
    try {
      const ver = await AsyncStorage.getItem(CACHE_VERSION_KEY);
      if (ver === CURRENT_VERSION) {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as SNURoom[];
            inMemory = parsed;
            return parsed;
          } catch {
            // cache 깨짐 → 재다운
          }
        }
      }
    } catch {
      // AsyncStorage 실패 → 그대로 네트워크
    }
    const res = await fetch(`${API_BASE}/data/snu-rooms.json`);
    if (!res.ok) throw new Error(`SNU rooms fetch failed: ${res.status}`);
    const data = (await res.json()) as SNURoom[];
    inMemory = data;
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      await AsyncStorage.setItem(CACHE_VERSION_KEY, CURRENT_VERSION);
    } catch {
      // cache 실패는 무시 (메모리에는 있음)
    }
    return data;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
