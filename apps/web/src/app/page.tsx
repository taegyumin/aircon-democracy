// 홈 entry. Edge runtime RSC가 D1에서 인기 장소 list를 직접 가져와서
// 클라이언트 HomeRoute에 initial state로 주입 (LLM 리뷰 P2: SEO + LCP 개선).
// D1 read 실패해도 client fetch가 fallback 작동 — 페이지 안 깨짐.

import { getRequestContext } from '@cloudflare/next-on-pages';
import type { PlaceWithCounts } from '../lib/apiClient';
import HomeRoute from './HomeRoute';

export const runtime = 'edge';

async function fetchPlaces(): Promise<PlaceWithCounts[] | null> {
  try {
    const { env } = getRequestContext();
    const db = (env as { DB?: D1Database }).DB;
    if (!db) return null;
    const now = Date.now();
    const { results } = await db
      .prepare(
        `SELECT
           p.id, p.name, p.type, p.district, p.detail, p.created_at,
           COALESCE(SUM(CASE WHEN v.vote='cold' AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS cold,
           COALESCE(SUM(CASE WHEN v.vote='ok'   AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS ok,
           COALESCE(SUM(CASE WHEN v.vote='hot'  AND v.expires_at > ?1 THEN 1 ELSE 0 END), 0) AS hot
         FROM places p
         LEFT JOIN votes v ON v.place_id = p.id
         WHERE COALESCE(p.is_public, 1) = 1
         GROUP BY p.id
         HAVING (cold + ok + hot) > 0
         ORDER BY (cold + ok + hot) DESC, p.created_at DESC
         LIMIT 50`,
      )
      .bind(now)
      .all<PlaceWithCounts>();
    return results;
  } catch {
    return null;
  }
}

export default async function Page() {
  const places = await fetchPlaces();
  return <HomeRoute initialPlaces={places ?? undefined} />;
}
