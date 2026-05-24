// Pinned favorite places (localStorage, anonymous).
// Server-independent — no impact on익명성.

import type { PlaceType } from './places';

const KEY = 'aircon:favorites';
const MAX = 8;

export interface FavoritePlace {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
  pinnedAt: number;
}

function read(): FavoritePlace[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoritePlace[]) : [];
  } catch {
    return [];
  }
}

function write(items: FavoritePlace[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function listFavorites(): FavoritePlace[] {
  return read().sort((a, b) => b.pinnedAt - a.pinnedAt);
}

export function isFavorite(id: string): boolean {
  return read().some((x) => x.id === id);
}

export function addFavorite(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): void {
  const cur = read();
  if (cur.some((x) => x.id === p.id)) return;
  cur.unshift({ ...p, pinnedAt: Date.now() });
  write(cur);
}

export function removeFavorite(id: string): void {
  write(read().filter((x) => x.id !== id));
}

export function toggleFavorite(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): boolean {
  if (isFavorite(p.id)) {
    removeFavorite(p.id);
    return false;
  }
  addFavorite(p);
  return true;
}
