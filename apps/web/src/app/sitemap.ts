// Next.js native sitemap. Cloudflare Pages edge runtime에서 D1 query로
// places 목록 가져와 동적 sitemap 생성.

import type { MetadataRoute } from 'next';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const SITE = 'https://aircondemocracy.com';

interface PlaceRow {
  id: string;
  updated_at?: number;
  created_at: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE}/wizard`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const { env } = getRequestContext();
    const db = (env as { DB?: D1Database }).DB;
    if (!db) return staticEntries;
    const { results } = await db
      .prepare('SELECT id, created_at FROM places ORDER BY created_at DESC LIMIT 1000')
      .all<PlaceRow>();
    const placeEntries: MetadataRoute.Sitemap = results.map((p) => ({
      url: `${SITE}/p/${encodeURIComponent(p.id)}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'hourly',
      priority: 0.6,
    }));
    return [...staticEntries, ...placeEntries];
  } catch {
    return staticEntries;
  }
}
