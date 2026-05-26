'use client';

// Next.js router로 callback prop을 라우팅 push로 매핑.
// HomeScreen은 height:100% 의존이라 100vh wrapper 필수.

import { useRouter } from 'next/navigation';
import { HomeScreen } from '../screens/HomeScreen';

export default function HomeRoute() {
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
      />
    </div>
  );
}
