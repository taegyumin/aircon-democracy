// Mobile pinned favorites (AsyncStorage).

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaceType } from '@aircon/core';

const KEY = 'aircon:favorites';
const MAX = 8;

export interface FavoritePlace {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
  pinnedAt: number;
}

async function read(): Promise<FavoritePlace[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoritePlace[]) : [];
  } catch {
    return [];
  }
}

async function write(items: FavoritePlace[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export async function listFavorites(): Promise<FavoritePlace[]> {
  const items = await read();
  return items.sort((a, b) => b.pinnedAt - a.pinnedAt);
}

export async function isFavorite(id: string): Promise<boolean> {
  const items = await read();
  return items.some((x) => x.id === id);
}

export async function addFavorite(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): Promise<void> {
  const cur = await read();
  if (cur.some((x) => x.id === p.id)) return;
  cur.unshift({ ...p, pinnedAt: Date.now() });
  await write(cur);
}

export async function removeFavorite(id: string): Promise<void> {
  const cur = await read();
  await write(cur.filter((x) => x.id !== id));
}

export async function toggleFavorite(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): Promise<boolean> {
  if (await isFavorite(p.id)) {
    await removeFavorite(p.id);
    return false;
  }
  await addFavorite(p);
  return true;
}
