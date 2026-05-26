// Yonsei University 신촌캠퍼스 — building-only dataset.
//
// Unlike SNU (where IST published a Wi-Fi AP PDF with full per-room coverage),
// Yonsei has no public, scrape-friendly room inventory. So we ship a curated
// list of ~40 major buildings and let the user type the room number freeform.
// The trade-off: voters in the same building+room get aggregated; misspellings
// of room numbers split the aggregate. Acceptable for v1.

import buildingsRaw from './data/yonsei-buildings.json';

export interface YonseiBuilding {
  code: string;            // e.g. "102", "B145", "121"
  name: string;            // e.g. "공학원"
  aliases: string[];       // English abbr, old names, romanization
  college: string;         // best-effort 단과대 매핑
}

export const BUILDINGS: YonseiBuilding[] = buildingsRaw as YonseiBuilding[];

const BY_CODE = new Map<string, YonseiBuilding>();
for (const b of BUILDINGS) BY_CODE.set(b.code.toLowerCase(), b);
export function buildingByCode(code: string): YonseiBuilding | undefined {
  return BY_CODE.get(code.toLowerCase());
}

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function choseong(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else out += ch;
  }
  return out;
}

export type YHit =
  | { type: 'building'; building: YonseiBuilding; score: number }
  | { type: 'college'; college: string; buildings: YonseiBuilding[]; score: number };

const COLLEGES = Array.from(new Set(BUILDINGS.map((b) => b.college))).sort();

export function search(query: string, limit = 12): YHit[] {
  const q = query.trim();
  if (!q) return [];
  const qNoSpace = q.replace(/\s+/g, '');
  const qLow = qNoSpace.toLowerCase();
  const qCho = choseong(q);
  const hits: YHit[] = [];

  // Exact code (including "B145")
  const exact = BY_CODE.get(qLow);
  if (exact) hits.push({ type: 'building', building: exact, score: 1000 });

  // Numeric prefix (e.g. "12" matches 121-124)
  if (/^\d/.test(qNoSpace) || /^b\d/i.test(qNoSpace)) {
    for (const b of BUILDINGS) {
      if (b.code.toLowerCase() === qLow) continue;
      if (b.code.toLowerCase().startsWith(qLow)) {
        hits.push({ type: 'building', building: b, score: 800 - (b.code.length - qLow.length) });
      }
    }
  }

  // College exact or partial
  for (const college of COLLEGES) {
    if (college.includes(q) || choseong(college).includes(qCho)) {
      const buildings = BUILDINGS.filter((b) => b.college === college);
      hits.push({ type: 'college', college, buildings, score: 700 + (q === college ? 200 : 0) });
    }
  }

  // Building name / alias substring + 초성
  for (const b of BUILDINGS) {
    if (b.code.toLowerCase() === qLow) continue;
    const hay = [b.name, ...b.aliases].join(' ').toLowerCase();
    if (hay.includes(qLow)) hits.push({ type: 'building', building: b, score: 600 });
    else if (qCho.length >= 2 && choseong([b.name, ...b.aliases].join(' ')).includes(qCho)) {
      hits.push({ type: 'building', building: b, score: 400 });
    }
  }

  // Dedupe (highest score wins)
  const seen = new Map<string, YHit>();
  for (const h of hits) {
    const key = h.type === 'building' ? 'b:' + h.building.code : 'c:' + h.college;
    const prev = seen.get(key);
    if (!prev || prev.score < h.score) seen.set(key, h);
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, limit);
}

// Place ID + names
//   yonsei:신촌:122        ← building only
//   yonsei:신촌:122:407    ← building + room
export function yonseiPlaceId(b: YonseiBuilding, room?: string): string {
  if (!room) return `yonsei:신촌:${b.code}`;
  return `yonsei:신촌:${b.code}:${room}`;
}

export function yonseiPlaceName(b: YonseiBuilding, room?: string): string {
  if (!room) return `연세대 ${b.name} (${b.code}동)`;
  const num = /^\d/.test(room) ? `${room}호` : room;
  return `연세대 ${b.name} ${num}`;
}

export function yonseiPlaceDetail(b: YonseiBuilding, room?: string): string {
  const base = `${b.college} · 신촌캠퍼스`;
  if (!room) return base;
  return `${base} · ${room}`;
}

export const COLLEGE_LIST = COLLEGES;
