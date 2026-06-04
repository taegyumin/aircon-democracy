// Mobile LoginScreen — 3개 provider OAuth.
// Expo WebBrowser.openAuthSessionAsync 사용 — iOS는 ASWebAuthenticationSession,
// Android는 Custom Tabs. 시스템 브라우저와 cookie 공유돼 자연스러운 SSO 동작.

import { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, ActivityIndicator, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { TOKEN } from '@aircon/core';
import { API_BASE, saveSessionToken } from '../src/lib/apiClient';

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
  // Apple Sign In은 iOS 13+ + 실기기에서만. isAvailableAsync false면 버튼 hide.
  // 초기값 true로 잡으면 simulator/구형기기에서 잠깐 깜빡임 발생 → false로 시작 후 effect에서 ON.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

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

  // Apple Sign In (iOS only) — App Store 4.8 정책 대응.
  // Replay 방어: server-issued nonce → SHA256 hash → Apple → server가 verify + 1회 소비.
  const startApple = async () => {
    setPending('apple');
    try {
      // 1. server-issued nonce 받기 (1회 소비 + 5분 만료).
      const nonceRes = await fetch(`${API_BASE}/api/auth/apple/nonce`);
      if (!nonceRes.ok) throw new Error('nonce_fetch_failed');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      // 2. SHA256(nonce) → Apple 전달. identityToken에 hash가 nonce claim으로 박힘.
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('no_identity_token');

      // 3. server: identityToken verify + payload.nonce === SHA256(raw nonce) + nonce 소비.
      const res = await fetch(`${API_BASE}/api/auth/apple/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action' },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          nonce, // raw nonce — server가 SHA256해서 token nonce claim과 비교.
          fullName: credential.fullName
            ? { givenName: credential.fullName.givenName ?? undefined, familyName: credential.fullName.familyName ?? undefined }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { sessionJwt?: string };
      if (body.sessionJwt) await saveSessionToken(body.sessionJwt);
      router.push('/');
    } catch (e) {
      // 사용자 취소(ERR_REQUEST_CANCELED)는 silent. 그 외만 alert 가능 — 현재는 silent.
      console.warn('[apple sign in]', e);
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
          {/* Apple Sign In은 iOS only + isAvailableAsync 통과한 기기에만. Apple HIG에 따라 더 prominent. */}
          {Platform.OS === 'ios' && appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={TOKEN.r.lg}
              style={styles.appleBtn}
              onPress={startApple}
            />
          )}
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

        {/* App Store 5.1.1(i) + Play Console 필수: 앱 내 개인정보처리방침 링크. */}
        <View style={styles.legalFooter}>
          <Pressable onPress={() => Linking.openURL('https://aircondemocracy.com/privacy')}>
            <Text style={styles.legalLink}>개인정보처리방침</Text>
          </Pressable>
          <Text style={styles.legalSep}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://aircondemocracy.com/account-deletion')}>
            <Text style={styles.legalLink}>계정·데이터 삭제</Text>
          </Pressable>
        </View>
        <Text style={styles.brandFooter}>© 2026 Minari</Text>
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
  appleBtn: { height: 52 }, // Apple HIG: 44pt 이상. 다른 버튼과 동등 size.
  skip: { marginTop: 20 },
  skipText: { fontSize: 13, color: TOKEN.text3, textDecorationLine: 'underline' },
  legalFooter: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 12, color: TOKEN.text3, textDecorationLine: 'underline' },
  legalSep: { fontSize: 12, color: TOKEN.text3 },
  brandFooter: { marginTop: 6, fontSize: 11, color: TOKEN.text3 },
});
