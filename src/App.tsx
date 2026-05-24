import { useCallback, useState } from 'react';
import { PLACES, type Place } from './lib/places';
import { IOSDevice } from './components/IOSDevice';
import { HomeScreen } from './screens/HomeScreen';
import { VoteScreen } from './screens/VoteScreen';
import { SearchScreen } from './screens/SearchScreen';
import { QRScreen } from './screens/QRScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';

type Screen = 'home' | 'vote' | 'search' | 'qr' | 'login' | 'register';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedPlace, setSelectedPlace] = useState<Place>(PLACES[0]);

  const go = useCallback((next: Screen, place?: Place | null) => {
    if (place) setSelectedPlace(place);
    setScreen(next);
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            onSelectPlace={(p) => go('vote', p)}
            onSearch={() => go('search')}
            onQR={() => go('qr')}
            onRegister={() => go('register')}
          />
        );
      case 'search':
        return (
          <SearchScreen
            onBack={() => go('home')}
            onSelectPlace={(p) => go('vote', p)}
            onRegister={() => go('register')}
          />
        );
      case 'qr':
        return <QRScreen onBack={() => go('home')} onSuccess={(p) => go('vote', p)} />;
      case 'vote':
        return (
          <VoteScreen
            key={selectedPlace.id}
            place={selectedPlace}
            onBack={() => go('home')}
            onLogin={() => go('login')}
          />
        );
      case 'login':
        return <LoginScreen onBack={() => go('vote')} />;
      case 'register':
        return <RegisterScreen onBack={() => go('home')} onComplete={(p) => go('vote', p)} />;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #ECE9E2 0%, #E4E0D8 100%)',
        padding: '32px 16px',
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <IOSDevice width={390} height={844}>
          <div key={screen} style={{ height: '100%', animation: 'fadeUp 0.22s ease' }}>
            {renderScreen()}
          </div>
        </IOSDevice>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.4 }}>
          <img src="/icon.png" alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3px', color: '#1A1A1F' }}>
            에어컨 민주주의 · Aircon Democracy
          </span>
        </div>
      </div>
    </div>
  );
}
