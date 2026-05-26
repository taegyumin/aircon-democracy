import type { Metadata } from 'next';
import QRRoute from './QRRoute';

export const metadata: Metadata = {
  title: 'QR 스캔 — 에어컨 민주주의',
  alternates: { canonical: '/qr' },
  robots: { index: false, follow: true },
};

export default function Page() { return <QRRoute />; }
