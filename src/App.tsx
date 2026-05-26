import { useCallback, useEffect, useState } from 'react';
import { IOSDevice } from './components/IOSDevice';
import { HomeScreen } from './screens/HomeScreen';
import { VoteScreen } from './screens/VoteScreen';
import { QRScreen } from './screens/QRScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { LocationWizardScreen } from './screens/LocationWizardScreen';
import { PrintQRScreen } from './screens/PrintQRScreen';
import type { PlaceType } from './lib/places';

type Screen = 'home' | 'vote' | 'qr' | 'login' | 'register' | 'wizard' | 'print';

interface RouteState {
  screen: Screen;
  placeId: string | null;
}

function pathToRoute(pathname: string): RouteState {
  if (pathname === '/' || pathname === '') return { screen: 'home', placeId: null };
  if (pathname === '/register') return { screen: 'register', placeId: null };
  if (pathname === '/login') return { screen: 'login', placeId: null };
  if (pathname === '/wizard') return { screen: 'wizard', placeId: null };
  if (pathname === '/qr') return { screen: 'qr', placeId: null };
  const printMatch = pathname.match(/^\/print\/(.+?)\/?$/);
  if (printMatch) return { screen: 'print', placeId: decodeURIComponent(printMatch[1]) };
  const placeMatch = pathname.match(/^\/p\/(.+?)\/?$/);
  if (placeMatch) return { screen: 'vote', placeId: decodeURIComponent(placeMatch[1]) };
  return { screen: 'home', placeId: null };
}

function routeToPath(r: RouteState): string {
  switch (r.screen) {
    case 'home': return '/';
    case 'register': return '/register';
    case 'login': return '/login';
    case 'wizard': return '/wizard';
    case 'qr': return '/qr';
    case 'print': return r.placeId ? `/print/${encodeURIComponent(r.placeId)}` : '/';
    case 'vote': return r.placeId ? `/p/${encodeURIComponent(r.placeId)}` : '/';
  }
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => pathToRoute(window.location.pathname));
  const [registerInitialType, setRegisterInitialType] = useState<PlaceType | undefined>(undefined);
  const [arrivedViaQR, setArrivedViaQR] = useState<boolean>(
    () => new URLSearchParams(window.location.search).get('via') === 'qr'
  );

  // Strip ?via=qr (or any other tracking param) once consumed so the URL stays clean
  useEffect(() => {
    if (window.location.search) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('via')) {
        params.delete('via');
        const qs = params.toString();
        const clean = window.location.pathname + (qs ? `?${qs}` : '');
        window.history.replaceState({}, '', clean);
      }
    }
  }, []);

  // Sync browser back/forward → state
  useEffect(() => {
    const onPop = () => setRoute(pathToRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((next: Screen, placeId?: string) => {
    const newRoute: RouteState = { screen: next, placeId: placeId ?? (next === 'vote' ? route.placeId : null) };
    const path = routeToPath(newRoute);
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setRoute(newRoute);
  }, [route.placeId]);

  const { screen, placeId } = route;

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            onSelectPlace={(id) => go('vote', id)}
            onWizard={() => { setRegisterInitialType(undefined); go('wizard'); }}
            onSearch={() => go('wizard')}
            onQR={() => go('qr')}
            onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
            onLogin={() => go('login')}
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
      case 'qr':
        return <QRScreen onBack={() => go('home')} onSuccess={(id) => go('vote', id)} />;
      case 'vote':
        if (!placeId) {
          return (
            <HomeScreen
              onSelectPlace={(id) => go('vote', id)}
              onWizard={() => { setRegisterInitialType(undefined); go('wizard'); }}
              onSearch={() => go('wizard')}
              onQR={() => go('qr')}
              onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
              onLogin={() => go('login')}
            />
          );
        }
        return (
          <VoteScreen
            key={placeId}
            placeId={placeId}
            onBack={() => go('home')}
            onLogin={() => go('login')}
            onChangePlace={() => { setRegisterInitialType(undefined); go('wizard'); }}
            arrivedViaQR={arrivedViaQR}
            onQRConsumed={() => setArrivedViaQR(false)}
          />
        );
      case 'login':
        return <LoginScreen onBack={() => placeId ? go('vote', placeId) : go('home')} />;
      case 'register':
        return (
          <RegisterScreen
            onBack={() => go('home')}
            onComplete={(id) => go('vote', id)}
            onPrint={(id) => go('print', id)}
            initialType={registerInitialType}
          />
        );
      case 'print':
        return placeId ? (
          <PrintQRScreen placeId={placeId} onBack={() => go('home')} />
        ) : (
          <HomeScreen
            onSelectPlace={(id) => go('vote', id)}
            onWizard={() => { setRegisterInitialType(undefined); go('wizard'); }}
            onSearch={() => go('wizard')}
            onQR={() => go('qr')}
            onRegister={() => { setRegisterInitialType(undefined); go('register'); }}
            onLogin={() => go('login')}
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
        fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
      }}
    >
      {isPhoneFrame ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
          <IOSDevice width={390} height={844}>
            <div key={screen + (placeId ?? '')} style={{ height: '100%', animation: 'fadeUp 0.22s ease' }}>
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
        <div key={screen + (placeId ?? '')} style={{ width: '100%', minHeight: '100vh', animation: 'fadeUp 0.22s ease' }}>
          {renderScreen()}
        </div>
      )}
    </div>
  );
}
