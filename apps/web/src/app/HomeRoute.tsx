'use client';

// Next.js router로 callback prop을 라우팅 push로 매핑.
// HomeScreen은 height:100% 의존이라 100vh wrapper 필수.
// initialPlaces는 server (page.tsx)에서 D1으로 가져온 인기 장소 list — SSR 첫 HTML에 포함.

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
        onWizard={() => router.push('/wizard')}
        onSearch={() => router.push('/wizard')}
        onQR={() => router.push('/qr')}
        onRegister={() => router.push('/register')}
        onLogin={() => router.push('/login')}
        initialPlaces={initialPlaces}
      />
    </div>
  );
}
