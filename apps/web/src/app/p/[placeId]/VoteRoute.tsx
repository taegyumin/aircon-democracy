'use client';

import { useRouter } from 'next/navigation';
import { VoteScreen } from '../../../screens/VoteScreen';

export default function VoteRoute({ placeId }: { placeId: string }) {
  const router = useRouter();
  return (
    <VoteScreen
      placeId={placeId}
      onBack={() => router.push('/')}
      onLogin={() => router.push('/login')}
      onChangePlace={() => router.push('/wizard')}
    />
  );
}
