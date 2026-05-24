import rawStations from '../data/subway-stations.json';

export interface Station {
  id: string;
  name: string;
  city: string;
  areas: string[];
  lines: string[];
  lat: number;
  lng: number;
}

interface RawStation {
  name: string;
  city: string;
  areas?: string[];
  lines: string[];
  lat: number;
  lng: number;
}

// Normalize line names — dataset has minor inconsistencies
function normalizeLine(line: string): string {
  const map: Record<string, string> = {
    '경의중앙': '경의중앙선',
    '김포 골드라인': '김포골드라인',
    '신림역': '신림선',
  };
  return map[line] ?? line;
}

export const STATIONS: Station[] = (rawStations as RawStation[]).map((s) => {
  const lines = Array.from(new Set(s.lines.map(normalizeLine))).sort();
  const id = `subway:${s.name}:${lines.join(',')}`;
  return {
    id,
    name: s.name,
    city: s.city,
    areas: s.areas ?? [],
    lines,
    lat: s.lat,
    lng: s.lng,
  };
});

// All distinct lines, sorted by display priority
const LINE_ORDER = [
  '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선',
  '신분당선', '수인분당선', '경의중앙선', '공항철도', '경춘선', '경강선', '서해선',
  '인천1호선', '인천2호선', '신림선', '우이신설선', '김포골드라인', '에버라인', '의정부선',
  '동해선', 'GTX-A', '부산김해경전철선',
];

export const ALL_LINES: string[] = Array.from(
  new Set(STATIONS.flatMap((s) => s.lines))
).sort((a, b) => {
  const ai = LINE_ORDER.indexOf(a);
  const bi = LINE_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
});

// Official line colors (Seoul Metro standard, fallback gray)
export const LINE_COLORS: Record<string, string> = {
  '1호선': '#0052A4',
  '2호선': '#00A84D',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
  '신분당선': '#D4003B',
  '수인분당선': '#FABE00',
  '경의중앙선': '#77C4A3',
  '공항철도': '#0090D2',
  '경춘선': '#0C8E72',
  '경강선': '#003DA5',
  '서해선': '#81A914',
  '인천1호선': '#7CA8D5',
  '인천2호선': '#ED8B00',
  '신림선': '#6789CA',
  '우이신설선': '#B7C452',
  '김포골드라인': '#A17E46',
  '에버라인': '#509F22',
  '의정부선': '#FDA600',
  '동해선': '#0072BC',
  'GTX-A': '#9A6292',
  '부산김해경전철선': '#8D5E2A',
};

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? '#888';
}

// ── Hangul chosung (초성) decomposition ─────────────────────────────
const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];

const CHOSUNG_SET = new Set(CHOSUNG);

export function toChosung(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const idx = Math.floor((code - 0xac00) / 588);
      out += CHOSUNG[idx];
    } else {
      out += ch;
    }
  }
  return out;
}

function isAllChosung(s: string): boolean {
  if (!s) return false;
  for (const ch of s) {
    if (!CHOSUNG_SET.has(ch)) return false;
  }
  return true;
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchOptions {
  query: string;
  lineFilter?: string | null;
  city?: string | null;
  limit?: number;
}

export function searchStations({ query, lineFilter, city, limit = 60 }: SearchOptions): Station[] {
  const q = query.trim();
  const useChosung = q.length > 0 && isAllChosung(q);
  const qChosung = useChosung ? q : toChosung(q);

  let pool = STATIONS;
  if (city) pool = pool.filter((s) => s.city === city);
  if (lineFilter) pool = pool.filter((s) => s.lines.includes(lineFilter));

  if (!q) {
    return pool.slice(0, limit);
  }

  type Scored = { s: Station; rank: number };
  const scored: Scored[] = [];

  for (const s of pool) {
    let rank = 99;
    if (s.name === q) rank = 0;
    else if (s.name.startsWith(q)) rank = 1;
    else if (s.name.includes(q)) rank = 2;
    else if (useChosung) {
      const sc = toChosung(s.name);
      if (sc.startsWith(qChosung)) rank = 3;
      else if (sc.includes(qChosung)) rank = 4;
    } else {
      const sc = toChosung(s.name);
      if (sc.startsWith(qChosung)) rank = 5;
    }
    // Match areas/city for partial credit
    if (rank === 99) {
      if (s.areas.some((a) => a.includes(q))) rank = 7;
      else if (s.city.includes(q)) rank = 8;
    }
    if (rank < 99) scored.push({ s, rank });
  }

  scored.sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name));
  return scored.slice(0, limit).map((x) => x.s);
}

export function stationLabel(s: Station): string {
  return `${s.name} · ${s.lines.join('·')}`;
}
