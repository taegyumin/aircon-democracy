// Mobile LoginScreen — Apple Sign In만 지원 (출시 sprint).
// Kakao/Naver/Google OAuth는 cookie 기반인데 mobile은 cookie를 못 받아 작동 X.
// 별도 sprint에서 native callback (deep-link로 sessionJwt 받기) 추가 시 복구.

import { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, Image, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { TOKEN } from '@aircon/core';
import { API_BASE, saveSessionToken } from '../src/lib/apiClient';

export default function LoginScreen() {
  const [pending, setPending] = useState(false);
  // Apple Sign In은 iOS 13+ + 실기기에서만. isAvailableAsync false면 버튼 hide.
  // 초기값 false로 잡으면 simulator/구형기기에서 잠깐 깜빡임 방지.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  // Apple Sign In (iOS only) — App Store 4.8 정책 대응.
  // Replay 방어: server-issued nonce → SHA256 hash → Apple → server가 verify + 1회 소비.
  const startApple = async () => {
    setPending(true);
    try {
      const nonceRes = await fetch(`${API_BASE}/api/auth/apple/nonce`);
      if (!nonceRes.ok) throw new Error('nonce_fetch_failed');
      const { nonce } = (await nonceRes.json()) as { nonce: string };

      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('no_identity_token');

      const res = await fetch(`${API_BASE}/api/auth/apple/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action' },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          nonce,
          fullName: credential.fullName
            ? { givenName: credential.fullName.givenName ?? undefined, familyName: credential.fullName.familyName ?? undefined }
            : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { sessionJwt?: string };
      if (body.sessionJwt) await saveSessionToken(body.sessionJwt);
      // replace로 login 화면을 back stack에서 제거.
      router.replace('/');
    } catch (e) {
      console.warn('[apple sign in]', e);
    } finally {
      setPending(false);
    }
  };

  const hasAnyLogin = Platform.OS === 'ios' && appleAvailable;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Image source={require('../assets/icon.png')} style={styles.icon} />
        <Text style={styles.brand}>에어컨 민주주의</Text>
        <Text style={styles.tagline}>
          {hasAnyLogin
            ? '로그인하면 장소 관리 기능을 쓸 수 있어요.'
            : '로그인 없이도 모든 투표 기능을 사용할 수 있어요.'}
        </Text>

        {hasAnyLogin && (
          <View style={styles.list}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={TOKEN.r.lg}
              style={[styles.appleBtn, pending && { opacity: 0.5 }]}
              onPress={() => { if (!pending) void startApple(); }}
            />
          </View>
        )}

        <Pressable onPress={() => router.replace('/')} style={styles.skip}>
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
  appleBtn: { height: 52 },
  skip: { marginTop: 20 },
  skipText: { fontSize: 13, color: TOKEN.text3, textDecorationLine: 'underline' },
  legalFooter: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8 },
  legalLink: { fontSize: 12, color: TOKEN.text3, textDecorationLine: 'underline' },
  legalSep: { fontSize: 12, color: TOKEN.text3 },
  brandFooter: { marginTop: 6, fontSize: 11, color: TOKEN.text3 },
});
