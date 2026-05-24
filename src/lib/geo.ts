// Geolocation helpers — used only client-side. raw coords NEVER sent to server.

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

const LAST_GRANT_KEY = 'aircon:geo_last_granted_at';

/** True if user previously granted in this browser (heuristic — actual permission may have been revoked). */
export function hasGrantedBefore(): boolean {
  try {
    return !!localStorage.getItem(LAST_GRANT_KEY);
  } catch {
    return false;
  }
}

export async function requestCoords(timeoutMs = 6000): Promise<Coords> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('unavailable');
  }
  return new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(LAST_GRANT_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('denied'));
        else if (err.code === err.TIMEOUT) reject(new Error('timeout'));
        else reject(new Error('unavailable'));
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}
