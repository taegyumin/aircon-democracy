// Generic search across a University dataset.
// Mirrors the search logic in snu.ts/yonsei.ts but operates on the generic
// `University` shape so all newly-added schools share one implementation.

import type { University, UnivBuilding, UnivCampus } from './types';

const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

export function choseong(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else out += ch;
  }
  return out;
}

export type UnivHit =
  | { type: 'building'; campus: UnivCampus; building: UnivBuilding; score: number }
  | { type: 'college'; college: string; matches: { campus: UnivCampus; building: UnivBuilding }[]; score: number };

/**
 * Search across all campuses of one university.
 *  - Exact code match (1000)
 *  - Code prefix (800)
 *  - College exact/partial (700)
 *  - Building name substring (600)
 *  - Building name 초성 (400)
 */
export function searchUniversity(univ: University, query: string, limit = 12): UnivHit[] {
  const q = query.trim();
  if (!q) return [];
  const qNoSpace = q.replace(/\s+/g, '');
  const qLow = qNoSpace.toLowerCase();
  const qCho = choseong(q);
  const hits: UnivHit[] = [];

  // Flatten (campus, building) pairs
  const pairs = univ.campuses.flatMap((c) => c.buildings.map((b) => ({ campus: c, building: b })));
  const colleges = Array.from(new Set(pairs.map((p) => p.building.college).filter(Boolean) as string[])).sort();

  // Exact code
  for (const { campus, building } of pairs) {
    if (building.code.toLowerCase() === qLow) {
      hits.push({ type: 'building', campus, building, score: 1000 });
    }
  }

  // Code prefix (numeric or alpha)
  if (qLow.length >= 1 && qLow.length < 6) {
    for (const { campus, building } of pairs) {
      const codeL = building.code.toLowerCase();
      if (codeL === qLow) continue;
      if (codeL.startsWith(qLow)) {
        hits.push({ type: 'building', campus, building, score: 800 - (codeL.length - qLow.length) });
      }
    }
  }

  // College match
  for (const college of colleges) {
    if (college.includes(q) || choseong(college).includes(qCho)) {
      const matches = pairs.filter((p) => p.building.college === college);
      hits.push({ type: 'college', college, matches, score: 700 + (q === college ? 200 : 0) });
    }
  }

  // Building name / alias substring + 초성
  for (const { campus, building } of pairs) {
    const codeL = building.code.toLowerCase();
    if (codeL === qLow) continue;
    const hay = [building.name, ...(building.aliases ?? [])].join(' ').toLowerCase();
    if (hay.includes(qLow)) {
      hits.push({ type: 'building', campus, building, score: 600 });
    } else if (qCho.length >= 2 && choseong([building.name, ...(building.aliases ?? [])].join(' ')).includes(qCho)) {
      hits.push({ type: 'building', campus, building, score: 400 });
    }
  }

  // Dedupe
  const seen = new Map<string, UnivHit>();
  for (const h of hits) {
    const key = h.type === 'building'
      ? `b:${h.campus.id}:${h.building.code}`
      : `c:${h.college}`;
    const prev = seen.get(key);
    if (!prev || prev.score < h.score) seen.set(key, h);
  }
  return Array.from(seen.values()).sort((a, b) => b.score - a.score).slice(0, limit);
}

// Place ID / display helpers
export function univPlaceId(univ: University, campus: UnivCampus, building: UnivBuilding, room?: string): string {
  const base = univ.campuses.length > 1
    ? `${univ.placeIdPrefix}:${campus.id}:${building.code}`
    : `${univ.placeIdPrefix}:${building.code}`;
  return room ? `${base}:${room}` : base;
}

export function univPlaceName(univ: University, campus: UnivCampus, building: UnivBuilding, room?: string): string {
  const campusPart = univ.campuses.length > 1 ? ` ${campus.name}` : '';
  const codeLabel = /^\d/.test(building.code) ? `${building.code}동` : building.code;
  if (!room) return `${univ.shortName}${campusPart} ${building.name} (${codeLabel})`;
  const num = /^\d/.test(room) ? `${room}호` : room;
  return `${univ.shortName}${campusPart} ${building.name} ${num}`;
}

export function univPlaceDetail(univ: University, campus: UnivCampus, building: UnivBuilding, room?: string): string {
  const collegePart = building.college ? `${building.college} · ` : '';
  const base = `${collegePart}${campus.name}`;
  return room ? `${base} · ${room}` : base;
}

export function buildingByCode(univ: University, campusId: string, code: string): UnivBuilding | undefined {
  const campus = univ.campuses.find((c) => c.id === campusId);
  if (!campus) return undefined;
  return campus.buildings.find((b) => b.code === code);
}

export function findUniversityById(list: University[], id: string): University | undefined {
  return list.find((u) => u.id === id);
}
