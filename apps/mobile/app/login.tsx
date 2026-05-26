// Mobile LoginScreen — 3개 provider OAuth.
// Expo WebBrowser.openAuthSessionAsync 사용 — iOS는 ASWebAuthenticationSession,
// Android는 Custom Tabs. 시스템 브라우저와 cookie 공유돼 자연스러운 SSO 동작.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { TOKEN } from '@aircon/core';
import { API_BASE } from '../src/lib/apiClient';

WebBrowser.maybeCompleteAuthSession();

interface Provider {
  id: 'kakao' | 'naver' | 'google';
  label: string;
  bg: string;
  color: string;
  border?: string;
}

const PROVIDERS: Provider[] = [
  { id: 'kakao',  label: '카카오로 계속하기', bg: '#FEE500', color: '#191919' },
  { id: 'naver',  label: '네이버로 계속하기', bg: '#03C75A', color: '#ffffff' },
  { id: 'google', label: 'Google로 계속하기', bg: '#FFFFFF', color: '#1F1F1F', border: '#DADCE0' },
];

// app.json scheme = 'aircondemocracy'. Native OAuth callback redirect는
// 향후 별도 endpoint (예: /api/auth/{provider}/native-callback) 가 deep-link로
// 돌아오게 만드는 게 정석. 이 sprint는 시스템 브라우저로 OAuth 시작만.
const OAUTH_RETURN = 'aircondemocracy://oauth-return';

export default function LoginScreen() {
  const [pending, setPending] = useState<string | null>(null);

  const start = async (provider: Provider['id']) => {
    setPending(provider);
    try {
      const result = await WebBrowser.openAuthSessionAsync(
        `${API_BASE}/api/auth/${provider}`,
        OAUTH_RETURN,
      );
      // result.type === 'success' | 'cancel' | 'dismiss'
      if (result.type === 'success') {
        router.push('/');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Image source={require('../assets/icon.png')} style={styles.icon} />
        <Text style={styles.brand}>에어컨 민주주의</Text>
        <Text style={styles.tagline}>로그인하면 장소 관리 기능을 쓸 수 있어요.</Text>

        <View style={styles.list}>
          {PROVIDERS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => start(p.id)}
              disabled={!!pending}
              style={[styles.btn, { backgroundColor: p.bg, borderColor: p.border ?? p.bg, borderWidth: 1.5 }]}
            >
              {pending === p.id
                ? <ActivityIndicator color={p.color} />
                : <Text style={[styles.btnText, { color: p.color }]}>{p.label}</Text>}
            </Pressable>
          ))}
        </View>

        <Pressable onPress={() => router.push('/')} style={styles.skip}>
          <Text style={styles.skipText}>로그인 없이 계속하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  body: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center', gap: 20 },
  icon: { width: 76, height: 76, borderRadius: 18 },
  brand: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: TOKEN.text2, textAlign: 'center', marginBottom: 20 },
  list: { width: '100%', gap: 10, maxWidth: 360 },
  btn: { padding: 15, borderRadius: TOKEN.r.lg, alignItems: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },
  skip: { marginTop: 20 },
  skipText: { fontSize: 13, color: TOKEN.text3, textDecorationLine: 'underline' },
});
