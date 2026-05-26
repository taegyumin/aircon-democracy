import type { Metadata } from 'next';
import VoteRoute from './VoteRoute';

interface PageProps {
  params: Promise<{ placeId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { placeId } = await params;
  const decoded = decodeURIComponent(placeId);
  return {
    title: `${decoded} — 에어컨 민주주의`,
    alternates: { canonical: `/p/${placeId}` },
    openGraph: {
      title: `${decoded} 에어컨 의견`,
      description: '추워요 / 적당해요 / 더워요 — 익명 30초 투표',
      url: `https://aircondemocracy.com/p/${placeId}`,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { placeId } = await params;
  return <VoteRoute placeId={decodeURIComponent(placeId)} />;
}
