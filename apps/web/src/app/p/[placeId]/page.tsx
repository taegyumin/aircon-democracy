import type { Metadata } from 'next';
import { getRequestContext } from '@cloudflare/next-on-pages';
import VoteRoute from './VoteRoute';

// CF Pages는 모든 dynamic route를 edge runtime으로 실행해야 함
export const runtime = 'edge';

interface PageProps {
  params: Promise<{ placeId: string }>;
}

interface PlaceMeta {
  name: string;
  type: string;
  district: string | null;
  detail: string | null;
  is_public: number | null;
}

// SEO 우선순위: 네이버/구글이 첫 HTML에서 장소 이름을 보게 한다.
// fallback은 deterministic id — D1 read 실패해도 페이지가 깨지진 않음.
// is_public=0 (사적 공간)은 noindex — link 직접 알면 접근 가능하지만 검색 엔진 X.
async function fetchPlaceMeta(placeId: string): Promise<PlaceMeta | null> {
  try {
    const { env } = getRequestContext();
    const db = (env as { DB?: D1Database }).DB;
    if (!db) return null;
    return await db
      .prepare('SELECT name, type, district, detail, is_public FROM places WHERE id = ?')
      .bind(placeId)
      .first<PlaceMeta>();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { placeId } = await params;
  const decoded = decodeURIComponent(placeId);
  const place = await fetchPlaceMeta(decoded);
  const title = place?.name ?? decoded;
  const districtPart = place?.district ? ` (${place.district})` : '';
  const description = place
    ? `${place.name}${districtPart}의 에어컨 체감을 익명으로 30초 안에 투표하세요. 추워요·적당해요·더워요.`
    : '추워요 / 적당해요 / 더워요 — 익명 30초 투표';

  const isPrivate = place ? (place.is_public === 0) : false;

  return {
    title: `${title} — 에어컨 민주주의`,
    description,
    alternates: { canonical: `/p/${placeId}` },
    // is_public=0 (사적 공간): 검색 엔진 indexing 차단. link로 직접 접근은 허용.
    ...(isPrivate ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${title} 에어컨 의견`,
      description,
      url: `https://aircondemocracy.com/p/${placeId}`,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { placeId } = await params;
  return <VoteRoute placeId={decodeURIComponent(placeId)} />;
}
