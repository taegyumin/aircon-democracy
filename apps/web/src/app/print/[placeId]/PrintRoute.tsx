'use client';

import { useRouter } from 'next/navigation';
import { PrintQRScreen } from '../../../screens/PrintQRScreen';

export default function PrintRoute({ placeId }: { placeId: string }) {
  const router = useRouter();
  return <PrintQRScreen placeId={placeId} onBack={() => router.push('/')} />;
}
