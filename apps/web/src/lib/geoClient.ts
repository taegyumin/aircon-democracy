'use client';

// Browser-side wrapper. core/geo는 pure (distanceM, formatDistance) 만 제공.
// navigator.geolocation + localStorage는 platform-specific.

import type { Coords } from '@aircon/core';

const LAST_GRANT_KEY = 'aircon:geo_last_granted_at';

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
