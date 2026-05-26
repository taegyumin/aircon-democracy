'use client';

import { useRouter } from 'next/navigation';
import { QRScreen } from '../../screens/QRScreen';

export default function QRRoute() {
  const router = useRouter();
  return (
    <QRScreen
      onBack={() => router.push('/')}
      onSuccess={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
    />
  );
}
