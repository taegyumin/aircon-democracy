import type { Metadata } from 'next';
import PrintRoute from './PrintRoute';

interface PageProps {
  params: Promise<{ placeId: string }>;
}

export const metadata: Metadata = {
  title: 'QR 인쇄 — 에어컨 민주주의',
  robots: { index: false, follow: true },
};

export default async function Page({ params }: PageProps) {
  const { placeId } = await params;
  return <PrintRoute placeId={decodeURIComponent(placeId)} />;
}
