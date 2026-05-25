import rawAdjacency from '../data/subway-adjacency.json';
import rawTrainAdjacency from '../data/train-adjacency.json';

export interface AdjEdge {
  from: string;
  to: string;
  line: string;
  /** 도시 — 다중 도시 "1호선" 충돌 해소용. 수도권 라인은 "서울"로 통일. */
  city: string;
}

export interface TrainAdjEdge {
  from: string;
  to: string;
  line: string;
  operator: string;
}

export const ADJACENCY: AdjEdge[] = rawAdjacency as AdjEdge[];
export const TRAIN_ADJACENCY: TrainAdjEdge[] = rawTrainAdjacency as TrainAdjEdge[];

// Stations dataset names end with "역" (서울대입구역) but the upstream graph
// (parsed from GML) stripped it (서울대입구). Normalize at the boundary so
// callers can pass either form.
function norm(s: string): string {
  return s.endsWith('역') ? s.slice(0, -1) : s;
}

/**
 * Given two stations the user observed (just-passed → about-to-arrive),
 * return all matching same-line segments. Edges in GML are undirected;
 * we match either ordering. Direction is captured by the order the user
 * input them — so prev/next is canonical for bucket ID.
 *
 * Returns multiple if the segment exists on more than one line
 * (e.g., 회기→청량리 is shared by 경의중앙선 and 경춘선).
 */
export interface Segment {
  line: string;
  city: string;
  prev: string;
  next: string;
}

/**
 * @param city - optional filter; multi-city "1호선" disambiguation. When the
 *   caller knows the user is in 부산 (from station selection), pass "부산" to
 *   avoid matching the 서울 1호선 segment with the same station name pair.
 */
export function findSegments(prev: string, next: string, city?: string): Segment[] {
  if (!prev || !next || prev === next) return [];
  const p = norm(prev);
  const n = norm(next);
  const out: Segment[] = [];
  for (const e of ADJACENCY) {
    if (city && e.city !== city) continue;
    const ef = norm(e.from);
    const et = norm(e.to);
    if ((ef === p && et === n) || (ef === n && et === p)) {
      out.push({ line: e.line, city: e.city, prev, next });
    }
  }
  // Dedup by (city, line)
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.city}::${s.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface TrainSegment {
  line: string;
  operator: string;
  prev: string;
  next: string;
}

/** KTX/SRT/ITX/무궁화호 인접역 매칭. */
export function findTrainSegments(prev: string, next: string): TrainSegment[] {
  if (!prev || !next || prev === next) return [];
  const p = norm(prev);
  const n = norm(next);
  const out: TrainSegment[] = [];
  for (const e of TRAIN_ADJACENCY) {
    const ef = norm(e.from);
    const et = norm(e.to);
    if ((ef === p && et === n) || (ef === n && et === p)) {
      out.push({ line: e.line, operator: e.operator, prev, next });
    }
  }
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = `${s.operator}::${s.line}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Adjacent stations of a given station (optionally filtered by line and city). */
export function neighborsOf(
  station: string,
  opts?: { line?: string; city?: string },
): { name: string; line: string; city: string }[] {
  const s = norm(station);
  const out: { name: string; line: string; city: string }[] = [];
  for (const e of ADJACENCY) {
    if (opts?.line && e.line !== opts.line) continue;
    if (opts?.city && e.city !== opts.city) continue;
    const ef = norm(e.from);
    const et = norm(e.to);
    // Return the original station-side name (caller may want display form);
    // append "역" to keep parity with STATIONS.name convention.
    if (ef === s) out.push({ name: et + '역', line: e.line, city: e.city });
    else if (et === s) out.push({ name: ef + '역', line: e.line, city: e.city });
  }
  return out;
}

/** Distinct neighbor station names (lines aggregated). City filter avoids
 *  mixing neighbors of different cities' same-named stations (교대역, 시청역). */
export function neighborNames(station: string, city?: string): string[] {
  const seen = new Set<string>();
  for (const n of neighborsOf(station, { city })) seen.add(n.name);
  return Array.from(seen);
}

// ── Place ID helpers ────────────────────────────────────────────────

/** 열차 안 — directional segment bucket. */
export function segmentPlaceId(line: string, prev: string, next: string, car?: number | 'unknown'): string {
  const carPart = car === undefined ? '' : `:${car === 'unknown' ? 'x' : car}`;
  return `subway:seg:${line}:${prev}-${next}${carPart}`;
}

/** 플랫폼 대기 — single-station bucket aggregated across lines that station serves. */
export function platformPlaceId(station: string, lines: string[]): string {
  return `subway:platform:${station}:${[...lines].sort().join(',')}`;
}

export function segmentDisplayName(seg: Segment, car?: number | 'unknown'): string {
  const carPart = car === undefined || car === null ? '' : car === 'unknown' ? ' · 칸 미정' : ` · ${car}호차`;
  return `${seg.line} ${seg.prev}→${seg.next}${carPart}`;
}

export function platformDisplayName(station: string, lines: string[]): string {
  return `${station} 플랫폼 (${lines.join(', ')})`;
}
