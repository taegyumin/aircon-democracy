// SNU buildings + rooms with a unified search.
// Data sourced from IST 무선현황 PDF (2024.02), enriched with college.

import buildingsRaw from '../data/snu-buildings.json';

export interface SNUBuilding {
  campus: '관악' | '연건';
  code: string;          // e.g. "301", "15-1", "Y8"
  name: string;          // canonical name
  aliases?: string[];
  college: string;       // e.g. "공과대학"
  roomCount: number;
}

export interface SNURoom {
  campus: '관악' | '연건';
  code: string;          // building code
  name: string;          // building name
  room: string;          // e.g. "108", "201-1", "B116", "1F"
  label: string;         // e.g. "강의실", "우민홀"
  kind: 'classroom' | 'lab' | 'office' | 'lounge' | 'corridor' | 'other';
}

export const BUILDINGS: SNUBuilding[] = buildingsRaw as SNUBuilding[];

// Rooms are lazy-loaded (~320KB JSON). Cached after first fetch.
let roomsPromise: Promise<SNURoom[]> | null = null;
export async function loadRooms(): Promise<SNURoom[]> {
  if (!roomsPromise) {
    roomsPromise = fetch('/data/snu-rooms.json')
      .then((r) => r.json())
      .catch((e) => {
        roomsPromise = null;
        throw e;
      });
  }
  return roomsPromise;
}

// Buildings indexed by code for O(1) lookup
const BUILDING_BY_CODE = new Map<string, SNUBuilding>();
for (const b of BUILDINGS) BUILDING_BY_CODE.set(b.code, b);
export function buildingByCode(code: string): SNUBuilding | undefined {
  return BUILDING_BY_CODE.get(code);
}

// Choseong (초성) extraction for Korean name search ("ㅈㅈㄴ" → "전자전기")
const CHO = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ',
  'ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];
function choseong(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      out += CHO[Math.floor((code - 0xac00) / 588)];
    } else if (CHO.includes(ch)) {
      out += ch;
    } else {
      // Non-Korean chars (digits, latin, hyphens): include as-is so '301' still matches
      out += ch;
    }
  }
  return out;
}

export type Hit =
  | { type: 'building'; building: SNUBuilding; score: number }
  | { type: 'college'; college: string; buildings: SNUBuilding[]; score: number }
  | { type: 'room'; building: SNUBuilding; room: SNURoom; score: number };

const COLLEGES: string[] = Array.from(new Set(BUILDINGS.map((b) => b.college))).sort();

/**
 * Unified search. Routes by query shape:
 *  - All-digits or matches a code exactly (e.g. "301", "15-1", "Y8") → building hit (high score)
 *  - Matches a college name → college hit
 *  - Substring or 초성 match on building name → building hit
 *  - If rooms loaded, substring match on room label or code-room ("301-108") → room hit
 */
export function search(query: string, rooms: SNURoom[] | null, limit = 12): Hit[] {
  const q = query.trim();
  if (!q) return [];
  const qNoSpace = q.replace(/\s+/g, '');
  const qCho = choseong(q);
  const hits: Hit[] = [];

  // 1) Exact code match — surface as #1 result
  const exact = BUILDING_BY_CODE.get(qNoSpace);
  if (exact) {
    hits.push({ type: 'building', building: exact, score: 1000 });
  }

  // 2) Code-prefix or starts-with match on numeric building number
  if (/^\d/.test(qNoSpace)) {
    for (const b of BUILDINGS) {
      if (b.code === qNoSpace) continue;
      if (b.code.startsWith(qNoSpace)) {
        hits.push({ type: 'building', building: b, score: 800 - (b.code.length - qNoSpace.length) });
      }
    }
  }

  // 3) College match (exact substring on canonical college name)
  for (const college of COLLEGES) {
    if (college.includes(q) || choseong(college).includes(qCho)) {
      const buildings = BUILDINGS.filter((b) => b.college === college);
      hits.push({ type: 'college', college, buildings, score: 700 + (q === college ? 200 : 0) });
    }
  }

  // 4) Building name substring + 초성
  for (const b of BUILDINGS) {
    if (b.code === qNoSpace) continue;  // already added
    const hay = [b.name, ...(b.aliases ?? [])].join(' ');
    if (hay.includes(q)) {
      hits.push({ type: 'building', building: b, score: 600 });
    } else if (qCho.length >= 2 && choseong(hay).includes(qCho)) {
      hits.push({ type: 'building', building: b, score: 400 });
    }
  }

  // 5) Room search — only when we have rooms loaded
  if (rooms) {
    // Pattern "301-108" → building 301 room 108
    const codeRoom = q.match(/^([A-Za-z0-9-]+)[\s-]+(\S+)$/);
    if (codeRoom) {
      const [, code, room] = codeRoom;
      const b = BUILDING_BY_CODE.get(code);
      if (b) {
        for (const r of rooms) {
          if (r.code === code && r.room.startsWith(room)) {
            hits.push({ type: 'room', building: b, room: r, score: 900 });
            if (hits.length > limit * 3) break;
          }
        }
      }
    }
    // Pure room-number search (e.g. "108") — too broad, skip unless ≤4 chars
    // Label search (e.g. "우민홀", "광장강의실")
    if (q.length >= 2 && !/^\d+$/.test(q)) {
      for (const r of rooms) {
        if (r.label.includes(q)) {
          const b = BUILDING_BY_CODE.get(r.code);
          if (b) {
            hits.push({ type: 'room', building: b, room: r, score: 500 });
            if (hits.length > limit * 4) break;
          }
        }
      }
    }
  }

  // De-duplicate buildings/rooms (keep highest score)
  const seen = new Map<string, Hit>();
  for (const h of hits) {
    let key: string;
    if (h.type === 'building') key = 'b:' + h.building.code;
    else if (h.type === 'college') key = 'c:' + h.college;
    else key = 'r:' + h.building.code + ':' + h.room.room + ':' + h.room.label;
    const prev = seen.get(key);
    if (!prev || prev.score < h.score) seen.set(key, h);
  }
  return Array.from(seen.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function roomsForBuilding(code: string, rooms: SNURoom[]): SNURoom[] {
  return rooms.filter((r) => r.code === code);
}

// Build a stable placeId for the aircon-democracy backend.
//   snu:관악:301:108        ← building+room
//   snu:관악:301             ← whole building (when user can't pinpoint room)
export function snuPlaceId(b: SNUBuilding, room?: SNURoom): string {
  if (!room) return `snu:${b.campus}:${b.code}`;
  return `snu:${b.campus}:${b.code}:${room.room}`;
}

export function snuPlaceName(b: SNUBuilding, room?: SNURoom): string {
  if (!room) return `서울대 ${b.name} (${b.code}동)`;
  const num = room.room.match(/^\d/) ? `${room.room}호` : room.room;
  return `서울대 ${b.name} ${num} (${room.label})`;
}

export function snuPlaceDetail(b: SNUBuilding, room?: SNURoom): string {
  const base = `${b.college} · ${b.campus}캠퍼스`;
  if (!room) return base;
  return `${base} · ${room.label}`;
}

export const COLLEGE_LIST = COLLEGES;
