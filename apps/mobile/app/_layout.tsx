import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTitleStyle: { fontWeight: '700', color: '#1A1A1F' },
          headerShadowVisible: false,
          // iOS back button label hide (default가 이전 화면 title이라 긴 한글이 현재 title 밀어냄).
          headerBackTitle: '',
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: '#F2F2F7' },
        }}
      >
        {/* 홈은 자체 brand row(로고+QR+사용자) 있어서 default Stack header 숨김 — 안 그러면 2중 헤더. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="wizard/index" options={{ title: '지금 어디 계세요?' }} />
        <Stack.Screen name="wizard/subway" options={{ title: '지하철' }} />
        <Stack.Screen name="wizard/bus" options={{ title: '시내·마을버스' }} />
        <Stack.Screen name="wizard/intercity-bus" options={{ title: '고속·시외버스' }} />
        <Stack.Screen name="wizard/train" options={{ title: '기차' }} />
        <Stack.Screen name="wizard/cafe" options={{ title: '카페·음식점' }} />
        <Stack.Screen name="wizard/classroom" options={{ title: '강의실' }} />
        <Stack.Screen name="wizard/custom" options={{ title: '다른 장소 찾기' }} />
        <Stack.Screen name="p/[placeId]" options={{ title: '투표' }} />
        <Stack.Screen name="login" options={{ title: '로그인', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: '설정', headerShown: false }} />
        <Stack.Screen name="qr" options={{ title: 'QR 스캔', headerShown: false }} />
      </Stack>
    </>
  );
}
