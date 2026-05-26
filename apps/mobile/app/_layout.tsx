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
        <Stack.Screen name="wizard" options={{ title: '지금 어디 계세요?' }} />
        <Stack.Screen name="p/[placeId]" options={{ title: '투표' }} />
        <Stack.Screen name="login" options={{ title: '로그인', presentation: 'modal' }} />
        <Stack.Screen name="qr" options={{ title: 'QR 스캔' }} />
      </Stack>
    </>
  );
}
