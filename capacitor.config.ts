import type { CapacitorConfig } from '@capacitor/cli';

// 에어컨 민주주의 native shell config.
// MVP strategy: load https://aircondemocracy.com directly via `server.url`
// so the native app behaves identically to web + zero CORS work.
// Future: bundle dist/ for offline support + add CORS to API.
const config: CapacitorConfig = {
  appId: 'com.aircondemocracy.app',
  appName: '에어컨 민주주의',
  webDir: 'dist',
  server: {
    url: 'https://aircondemocracy.com',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#F2F2F7',
  },
  android: {
    backgroundColor: '#F2F2F7',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#1B53E5',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1B53E5',
    },
  },
};

export default config;
