export interface Brand {
  id: string;
  iconUrl: string;
  /** True if the given place name matches this brand. */
  matches: (placeName: string) => boolean;
}

export const BRANDS: Brand[] = [
  {
    id: 'starbucks',
    iconUrl: '/brands/starbucks.svg',
    matches: (n) => n.includes('스타벅스') || /starbucks/i.test(n),
  },
];

export function brandFor(placeName: string): Brand | null {
  return BRANDS.find((b) => b.matches(placeName)) ?? null;
}
