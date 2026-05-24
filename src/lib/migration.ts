// Single-shot pending vote migration.
// Used when user corrects place: keep their vote intent across navigation.

const KEY = 'aircon:pending_vote';
const TTL_MS = 60_000;

type VoteKind = 'cold' | 'ok' | 'hot';

interface Pending {
  vote: VoteKind;
  expiresAt: number;
}

export function setPendingVote(vote: VoteKind): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ vote, expiresAt: Date.now() + TTL_MS }));
  } catch {
    /* ignore */
  }
}

export function consumePendingVote(): VoteKind | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const p = JSON.parse(raw) as Pending;
    if (typeof p?.expiresAt !== 'number' || p.expiresAt < Date.now()) return null;
    return p.vote;
  } catch {
    return null;
  }
}

export function peekPendingVote(): VoteKind | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (typeof p?.expiresAt !== 'number' || p.expiresAt < Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return p.vote;
  } catch {
    return null;
  }
}

export function clearPendingVote(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
