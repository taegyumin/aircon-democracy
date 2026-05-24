// Client-only place history (localStorage).
// 익명성 100% 유지 — 서버에 voter 활동 영구 기록 안 함.

import type { PlaceType } from './places';

const KEY = 'aircon:recent_places';
const MAX = 10;

export interface RecentPlace {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
  lastVisitedAt: number;
  lastVoteAt?: number;
}

function read(): RecentPlace[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentPlace[]) : [];
  } catch {
    return [];
  }
}

function write(items: RecentPlace[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function recordVisit(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): void {
  const cur = read();
  const now = Date.now();
  const existing = cur.find((x) => x.id === p.id);
  if (existing) {
    existing.lastVisitedAt = now;
    existing.name = p.name;
    existing.district = p.district ?? existing.district ?? null;
  } else {
    cur.unshift({ ...p, lastVisitedAt: now });
  }
  cur.sort((a, b) => b.lastVisitedAt - a.lastVisitedAt);
  write(cur.slice(0, MAX));
}

export function recordVote(placeId: string): void {
  const cur = read();
  const existing = cur.find((x) => x.id === placeId);
  if (existing) {
    existing.lastVoteAt = Date.now();
    write(cur);
  }
}

export function getRecent(limit = 5): RecentPlace[] {
  return read().slice(0, limit);
}

export function removePlace(id: string): void {
  write(read().filter((x) => x.id !== id));
}

// ── Recent lines (for wizard) ────────────────────────────────────────

const LINES_KEY = 'aircon:recent_lines';
const LINES_MAX = 5;

export function recordLine(line: string): void {
  try {
    const raw = localStorage.getItem(LINES_KEY);
    const cur: string[] = raw ? JSON.parse(raw) : [];
    const next = [line, ...cur.filter((l) => l !== line)].slice(0, LINES_MAX);
    localStorage.setItem(LINES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getRecentLines(): string[] {
  try {
    const raw = localStorage.getItem(LINES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
