// Lazy loader for NCP Maps Web Dynamic v3.
//
// 보안: Client ID는 origin 검증으로 보호되므로 빌드 시 inline OK.
// `~/.aircon-env` → `VITE_NCP_MAPS_CLIENT_ID` 로 alias 되어 있어야 함.

declare global {
  interface Window {
    naver?: typeof naver;
  }
}

interface NaverMapsModule {
  Map: NaverMapConstructor;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  Marker: new (opts: { position: NaverLatLng; map?: unknown; icon?: unknown }) => NaverMarker;
  Event: { addListener: (target: unknown, eventName: string, handler: (...args: unknown[]) => void) => unknown };
  Service?: {
    reverseGeocode: (
      opts: { coords: NaverLatLng; orders?: string },
      cb: (status: number, response: NaverReverseGeocodeResponse) => void,
    ) => void;
    Status: { OK: number; ERROR: number };
    OrderType: { ROAD_ADDR: string; ADDR: string };
  };
}

export interface NaverLatLng { lat(): number; lng(): number; }
export interface NaverMarker { setPosition(p: NaverLatLng): void; setMap(m: unknown): void; }
export interface NaverMap {
  setCenter(p: NaverLatLng): void;
  panTo(p: NaverLatLng): void;
  getCenter(): NaverLatLng;
  destroy(): void;
}
type NaverMapConstructor = new (el: HTMLElement | string, opts?: Record<string, unknown>) => NaverMap;

export interface NaverReverseGeocodeResponse {
  v2?: {
    address?: { roadAddress?: string; jibunAddress?: string };
  };
}

declare const naver: { maps: NaverMapsModule };
export type { naver };

let loadPromise: Promise<NaverMapsModule> | null = null;

export function loadNaverMaps(): Promise<NaverMapsModule> {
  if (loadPromise) return loadPromise;
  const clientId = import.meta.env.VITE_NCP_MAPS_CLIENT_ID as string | undefined;
  if (!clientId) {
    loadPromise = Promise.reject(new Error('VITE_NCP_MAPS_CLIENT_ID is not configured'));
    return loadPromise;
  }
  loadPromise = new Promise((resolve, reject) => {
    if (window.naver?.maps) {
      resolve(window.naver.maps);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.onload = () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error('naver.maps not available after load'));
    };
    script.onerror = () => reject(new Error('Failed to load Naver Maps script'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// 좌표를 ~11m 그리드로 양자화 — 같은 가게 안 클릭은 한 셀로 모이게.
// 4 decimal places ≈ 11.1m at 서울 위도.
export function quantizeCoord(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000,
  };
}

export function venuePlaceId(lat: number, lng: number): string {
  const q = quantizeCoord(lat, lng);
  return `venue:gps:${q.lat.toFixed(4)}:${q.lng.toFixed(4)}`;
}
