// POI (카페·음식점) 검색 provider — NAVER Search Local + Kakao Local 추상화.
//
// 사용자가 카페·음식점 wizard에서 가게명/위치 검색 시 양쪽 동시 호출 → 결과 합쳐서
// 클라이언트에 정규화된 형식으로 반환. 클라이언트는 좌표 양자화로 dedup + place id 생성.
//
// 좌표:
//   - NAVER local: mapx (경도 * 1e7), mapy (위도 * 1e7) — WGS84 (2022 이후, 옛 KATEC 변경됨)
//   - Kakao local: x (경도 문자열), y (위도 문자열) — WGS84 그대로

const UPSTREAM_TIMEOUT_MS = 5000;
function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
}

export interface PoiResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  source: 'naver' | 'kakao';
  // 원본 provider id — 디버그/링크용. dedup은 좌표 양자화로 클라이언트에서 처리.
  externalId?: string;
}

export interface PoiSearchOpts {
  lat?: number;
  lng?: number;
  radiusM?: number;
}

export interface PoiProvider {
  search(q: string, opts: PoiSearchOpts): Promise<PoiResult[]>;
}

// HTML <b> 태그 등 NAVER 검색이 highlighting하는 마크업 제거.
function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}

// ── NAVER Search Local ────────────────────────────────────────────────
// docs: https://developers.naver.com/docs/serviceapi/search/local/local.md
// 5건 max, 페이징 X. server-side 호출만 가능 (referer 검사 없음).

interface NaverLocalItem {
  title: string;
  link?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  mapx: string; // 경도 * 1e7
  mapy: string; // 위도 * 1e7
}

export function naverProvider(clientId: string, clientSecret: string): PoiProvider {
  return {
    async search(q) {
      const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&sort=random`;
      const res = await timedFetch(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      });
      if (!res.ok) throw new Error(`naver_upstream_${res.status}`);
      const body = (await res.json()) as { items?: NaverLocalItem[] };
      const items = body.items ?? [];
      return items.map((it) => ({
        name: stripHtmlTags(it.title),
        address: it.roadAddress || it.address || '',
        lat: parseInt(it.mapy, 10) / 1e7,
        lng: parseInt(it.mapx, 10) / 1e7,
        category: it.category,
        source: 'naver' as const,
        externalId: it.link,
      }));
    },
  };
}

// ── Kakao Local ───────────────────────────────────────────────────────
// docs: https://developers.kakao.com/docs/latest/ko/local/dev-guide
// 15건/페이지, 페이징 가능. 좌표 + 반경으로 거리 기반 검색.

interface KakaoLocalDoc {
  id: string;
  place_name: string;
  category_name?: string;
  category_group_code?: string;
  address_name?: string;
  road_address_name?: string;
  x: string; // 경도 (문자열)
  y: string; // 위도 (문자열)
  distance?: string;
}

// CE7 = 카페, FD6 = 음식점. 사용자 wizard 컨텍스트가 '카페·음식점'이라 두 카테고리만 필터.
const KAKAO_CATEGORIES = 'CE7,FD6';

export function kakaoProvider(restApiKey: string): PoiProvider {
  return {
    async search(q, opts) {
      let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=15&category_group_code=${KAKAO_CATEGORIES}`;
      if (opts.lat != null && opts.lng != null) {
        const radius = opts.radiusM ?? 5000;
        url += `&x=${opts.lng}&y=${opts.lat}&radius=${radius}`;
      }
      const res = await timedFetch(url, {
        headers: { Authorization: `KakaoAK ${restApiKey}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`kakao_upstream_${res.status}_${text.slice(0, 80)}`);
      }
      const body = (await res.json()) as { documents?: KakaoLocalDoc[] };
      const docs = body.documents ?? [];
      return docs.map((d) => ({
        name: d.place_name,
        address: d.road_address_name || d.address_name || '',
        lat: parseFloat(d.y),
        lng: parseFloat(d.x),
        category: d.category_name,
        source: 'kakao' as const,
        externalId: d.id,
      }));
    },
  };
}

// ── 양쪽 동시 호출 + 좌표 기반 dedup ──────────────────────────────────────
// 같은 가게가 NAVER + Kakao 양쪽에 등록되면 좌표가 거의 같음 (11m 격자). dedup으로
// 한 결과만 남김. NAVER 우선 (점포 풍부 + name이 NAVER가 정확한 경향).

export async function searchPoiCombined(
  q: string,
  opts: PoiSearchOpts,
  providers: { naver?: PoiProvider; kakao?: PoiProvider },
): Promise<PoiResult[]> {
  const promises: Array<Promise<PoiResult[]>> = [];
  if (providers.naver) promises.push(providers.naver.search(q, opts).catch(() => [] as PoiResult[]));
  if (providers.kakao) promises.push(providers.kakao.search(q, opts).catch(() => [] as PoiResult[]));
  const lists = await Promise.all(promises);
  const merged = lists.flat();
  // 좌표 양자화 키로 dedup. 11m 격자 (4 decimal places).
  const seen = new Map<string, PoiResult>();
  for (const r of merged) {
    const key = `${Math.round(r.lat * 10000) / 10000}:${Math.round(r.lng * 10000) / 10000}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
}
