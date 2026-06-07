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
          contentStyle: { backgroundColor: '#F2F2F7' },
        }}
      >
        <Stack.Screen name="index" options={{ title: '에어컨 민주주의' }} />
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
