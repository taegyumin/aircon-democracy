// Geolocation pure helpers. Platform-specific I/O (requestCoords, persistence)
// belongs to apps/{web,mobile} since web uses navigator.geolocation +
// localStorage and mobile uses expo-location + AsyncStorage.

export interface Coords {
  lat: number;
  lng: number;
  accuracyM?: number;
}

export type GeoStatus = 'idle' | 'prompting' | 'granted' | 'denied' | 'unavailable' | 'timeout';

/** Haversine distance in meters. */
export function distanceM(a: Coords, b: { lat: number; lng: number }): number {
  const R = 6371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const dφ = ((b.lat - a.lat) * Math.PI) / 180;
  const dλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Format distance for UI (rounded to friendly buckets). */
export function formatDistance(m: number): string {
  if (m < 100) return '~100m';
  if (m < 1000) return `${Math.round(m / 50) * 50}m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)}km`;
}
