export interface Brand {
  id: string;
  iconUrl: string;
  /** True if the given place name matches this brand. */
  matches: (placeName: string) => boolean;
}

const includesAny = (n: string, ...needles: string[]) => needles.some((k) => n.includes(k));

export const BRANDS: Brand[] = [
  // ── Cafes ─────────────────────────────────────────────────────────
  { id: 'starbucks', iconUrl: '/brands/starbucks.svg', matches: (n) => includesAny(n, '스타벅스') || /starbucks/i.test(n) },
  { id: 'twosome',   iconUrl: '/brands/twosome.png',   matches: (n) => includesAny(n, '투썸') || /twosome/i.test(n) },
  { id: 'ediya',     iconUrl: '/brands/ediya.svg',     matches: (n) => includesAny(n, '이디야') || /ediya/i.test(n) },
  { id: 'mega',      iconUrl: '/brands/mega.png',      matches: (n) => includesAny(n, '메가커피', '메가MGC', '메가 커피') || /mega\s*(mgc)?\s*coffee/i.test(n) },
  { id: 'compose',   iconUrl: '/brands/compose.svg',   matches: (n) => includesAny(n, '컴포즈') || /compose\s*coffee/i.test(n) },
  { id: 'paik',      iconUrl: '/brands/paik.png',      matches: (n) => includesAny(n, '빽다방') || /paik('?s)?\s*(coffee|bread)?/i.test(n) },
  // ── Universities ──────────────────────────────────────────────────
  { id: 'snu',       iconUrl: '/brands/snu.svg',       matches: (n) => includesAny(n, '서울대학교', '서울대') || /seoul\s*national\s*university/i.test(n) },
  { id: 'yonsei',    iconUrl: '/brands/yonsei.png',    matches: (n) => includesAny(n, '연세대학교', '연세대') || /yonsei/i.test(n) },
  { id: 'ku',        iconUrl: '/brands/ku.svg',        matches: (n) => includesAny(n, '고려대학교', '고려대') || /korea\s*university/i.test(n) },
  { id: 'hanyang',   iconUrl: '/brands/hanyang.svg',   matches: (n) => includesAny(n, '한양대학교', '한양대') || /hanyang/i.test(n) },
  { id: 'kaist',     iconUrl: '/brands/kaist.svg',     matches: (n) => includesAny(n, '카이스트', 'KAIST') || /kaist/i.test(n) },
];

export function brandFor(placeName: string): Brand | null {
  return BRANDS.find((b) => b.matches(placeName)) ?? null;
}
