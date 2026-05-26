'use client';

// Next.js router로 callback prop을 라우팅 push로 매핑.
// HomeScreen의 callback 시그니처는 그대로 두고 wrapper만 들어감.

import { useRouter } from 'next/navigation';
import { HomeScreen } from '../screens/HomeScreen';

export default function HomeRoute() {
  const router = useRouter();
  return (
    <HomeScreen
      onSelectPlace={(id) => router.push(`/p/${encodeURIComponent(id)}`)}
      onWizard={() => router.push('/wizard')}
      onSearch={() => router.push('/wizard')}
      onQR={() => router.push('/qr')}
      onRegister={() => router.push('/register')}
      onLogin={() => router.push('/login')}
    />
  );
}
