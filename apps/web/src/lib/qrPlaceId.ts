// QR 코드에 담긴 URL/문자열에서 placeId 추출.
// 우리 사이트 URL (https://aircondemocracy.com/p/<placeId>) 에서만 placeId 추출 — 다른 사이트 URL은
// null 반환해서 외부 QR로 우리 vote 페이지 진입 못 하게. trailing slash·www. prefix·query string 허용.

const SITE_HOST = 'aircondemocracy.com';

export function extractPlaceId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== SITE_HOST && u.hostname !== `www.${SITE_HOST}`) return null;
    const m = u.pathname.match(/^\/p\/([^/]+)\/?$/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}
