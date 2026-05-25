import rawAdjacency from '../data/subway-adjacency.json';

export interface AdjEdge {
  from: string;
  to: string;
  line: string;
}

export const ADJACENCY: AdjEdge[] = rawAdjacency as AdjEdge[];

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
  prev: string;
  next: string;
}

export function findSegments(prev: string, next: string): Segment[] {
  if (!prev || !next || prev === next) return [];
  const p = norm(prev);
  const n = norm(next);
  const out: Segment[] = [];
  for (const e of ADJACENCY) {
    const ef = norm(e.from);
    const et = norm(e.to);
    if ((ef === p && et === n) || (ef === n && et === p)) {
      out.push({ line: e.line, prev, next });
    }
  }
  // Dedup by line (in case the source data has duplicates)
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.line)) return false;
    seen.add(s.line);
    return true;
  });
}

/** Adjacent stations of a given station (optionally filtered by line). */
export function neighborsOf(station: string, line?: string): { name: string; line: string }[] {
  const s = norm(station);
  const out: { name: string; line: string }[] = [];
  for (const e of ADJACENCY) {
    if (line && e.line !== line) continue;
    const ef = norm(e.from);
    const et = norm(e.to);
    // Return the original station-side name (caller may want display form);
    // append "역" to keep parity with STATIONS.name convention.
    if (ef === s) out.push({ name: et + '역', line: e.line });
    else if (et === s) out.push({ name: ef + '역', line: e.line });
  }
  return out;
}

/** Distinct neighbor station names (lines aggregated). */
export function neighborNames(station: string): string[] {
  const seen = new Set<string>();
  for (const n of neighborsOf(station)) seen.add(n.name);
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
