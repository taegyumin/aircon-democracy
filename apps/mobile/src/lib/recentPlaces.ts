// Mobile recent places (AsyncStorage). Web localStorage 버전과 동일 shape — packages/core 공유 못 하는 이유는
// platform-specific storage 때문. 도메인 모델 (RecentPlace)은 동일.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaceType } from '@aircon/core';

const KEY = 'aircon:recent_places';
const MAX = 5;
const TTL_MS = 10 * 24 * 60 * 60 * 1000; // 10일

export interface RecentPlace {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
  lastVoteAt: number;
}

async function read(): Promise<RecentPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<RecentPlace & { lastVisitedAt?: number }>;
    const cutoff = Date.now() - TTL_MS;
    return parsed
      .filter((x): x is RecentPlace => typeof x.lastVoteAt === 'number')
      .filter((x) => x.lastVoteAt >= cutoff)
      .sort((a, b) => b.lastVoteAt - a.lastVoteAt);
  } catch {
    return [];
  }
}

async function write(items: RecentPlace[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function recordVote(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): Promise<void> {
  const cur = await read();
  const now = Date.now();
  const idx = cur.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    cur[idx] = { ...cur[idx], ...p, lastVoteAt: now };
  } else {
    cur.unshift({ id: p.id, name: p.name, type: p.type, district: p.district ?? null, lastVoteAt: now });
  }
  cur.sort((a, b) => b.lastVoteAt - a.lastVoteAt);
  await write(cur.slice(0, MAX));
}

export async function getRecent(limit = MAX): Promise<RecentPlace[]> {
  const items = await read();
  return items.slice(0, limit);
}

export async function removePlace(id: string): Promise<void> {
  const items = await read();
  await write(items.filter((x) => x.id !== id));
}
