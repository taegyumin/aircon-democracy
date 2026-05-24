import { useCallback, useState } from 'react';
import { IOSDevice } from './components/IOSDevice';
import { HomeScreen } from './screens/HomeScreen';
import { VoteScreen } from './screens/VoteScreen';
import { SearchScreen } from './screens/SearchScreen';
import { QRScreen } from './screens/QRScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { LocationWizardScreen } from './screens/LocationWizardScreen';
import type { PlaceType } from './lib/places';

type Screen = 'home' | 'vote' | 'search' | 'qr' | 'login' | 'register' | 'wizard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [registerInitialType, setRegisterInitialType] = useState<PlaceType | undefined>(undefined);

  const go = useCallback((next: Screen, placeId?: string) => {
    if (placeId) setSelectedPlaceId(placeId);
    setScreen(next);
  }, []);

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            onSelectPlace={(id) => go('vote', id)}
            onWizard={() => { setRegisterInitialType(undefined); go('wizard'); }}
            onSearch={() => go('search')}
            onQR={() => go('qr')}
            onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
          />
        );
      case 'wizard':
        return (
          <LocationWizardScreen
            onBack={() => go('home')}
            onPicked={(id) => go('vote', id)}
            onRegisterFreeform={(t) => { setRegisterInitialType(t); go('register'); }}
          />
        );
      case 'search':
        return (
          <SearchScreen
            onBack={() => go('home')}
            onSelectPlace={(id) => go('vote', id)}
            onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
          />
        );
      case 'qr':
        return <QRScreen onBack={() => go('home')} onSuccess={(id) => go('vote', id)} />;
      case 'vote':
        if (!selectedPlaceId) {
          return (
            <HomeScreen
              onSelectPlace={(id) => go('vote', id)}
              onWizard={() => { setRegisterInitialType(undefined); go('wizard'); }}
              onSearch={() => go('search')}
              onQR={() => go('qr')}
              onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
            />
          );
        }
        return (
          <VoteScreen
            key={selectedPlaceId}
            placeId={selectedPlaceId}
            onBack={() => go('home')}
            onLogin={() => go('login')}
          />
        );
      case 'login':
        return <LoginScreen onBack={() => go('vote')} />;
      case 'register':
        return (
          <RegisterScreen
            onBack={() => go('home')}
            onComplete={(id) => go('vote', id)}
            initialType={registerInitialType}
          />
        );
    }
  };

  const isPhoneFrame = window.matchMedia('(min-width: 768px)').matches;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isPhoneFrame ? 'linear-gradient(160deg, #ECE9E2 0%, #E4E0D8 100%)' : '#F2F2F7',
        padding: isPhoneFrame ? '32px 16px' : 0,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      {isPhoneFrame ? (
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
      ) : (
        <div key={screen} style={{ width: '100%', minHeight: '100vh', animation: 'fadeUp 0.22s ease' }}>
          {renderScreen()}
        </div>
      )}
    </div>
  );
}
