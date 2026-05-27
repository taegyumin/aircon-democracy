'use client';

// Next.js router로 callback prop을 라우팅 push로 매핑.
// HomeScreen은 height:100% 의존이라 100vh wrapper 필수.
// 카테고리 picker가 직접 노출되므로 onWizard(cat?)으로 /wizard?cat=... 라우팅.

import { useRouter } from 'next/navigation';
import { HomeScreen } from '../screens/HomeScreen';
import type { PlaceWithCounts } from '../lib/apiClient';

interface Props {
  initialPlaces?: PlaceWithCounts[];
}

export default function HomeRoute({ initialPlaces }: Props) {
  const router = useRouter();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HomeScreen
        onSelectPlace={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
        onWizard={(cat) => router.push(cat ? `/wizard?cat=${cat}` : '/wizard')}
        onQR={() => router.push('/qr')}
        onLogin={() => router.push('/login')}
        initialPlaces={initialPlaces}
      />
    </div>
  );
}
