// Client-only place history (localStorage).
// 익명성 100% 유지 — 서버에 voter 활동 영구 기록 안 함.

import type { PlaceType } from './places';

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

function read(): RecentPlace[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<RecentPlace & { lastVisitedAt?: number }>;
    // Migrate old shape (lastVisitedAt-based) → drop entries without a vote.
    const cutoff = Date.now() - TTL_MS;
    return parsed
      .filter((x): x is RecentPlace => typeof x.lastVoteAt === 'number')
      .filter((x) => x.lastVoteAt >= cutoff)
      .sort((a, b) => b.lastVoteAt - a.lastVoteAt);
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

export function recordVote(p: {
  id: string;
  name: string;
  type: PlaceType;
  district?: string | null;
}): void {
  const cur = read();
  const now = Date.now();
  const idx = cur.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    cur[idx] = { ...cur[idx], ...p, lastVoteAt: now };
  } else {
    cur.unshift({ id: p.id, name: p.name, type: p.type, district: p.district ?? null, lastVoteAt: now });
  }
  cur.sort((a, b) => b.lastVoteAt - a.lastVoteAt);
  write(cur.slice(0, MAX));
}

export function getRecent(limit = MAX): RecentPlace[] {
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
