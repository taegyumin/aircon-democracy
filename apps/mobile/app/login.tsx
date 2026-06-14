// LoginScreen — Apple Sign In(iOS) + 로그인 없이 계속. 디자인 시스템 적용.
// Kakao/Naver/Google은 cookie 기반이라 mobile 미지원 (별도 sprint).

import { useEffect, useState } from 'react';
import { Platform, View, StyleSheet, Image, Linking, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { TOKEN, SPACE } from '@aircon/core';
import { API_BASE, saveSessionToken } from '../src/lib/apiClient';
import { AppText, Button } from '../src/ui';

export default function LoginScreen() {
  const [pending, setPending] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const startApple = async () => {
    setPending(true);
    try {
      const nonceRes = await fetch(`${API_BASE}/api/auth/apple/nonce`);
      if (!nonceRes.ok) throw new Error('nonce_fetch_failed');
      const { nonce } = (await nonceRes.json()) as { nonce: string };
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('no_identity_token');
      const res = await fetch(`${API_BASE}/api/auth/apple/native`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Aircon-Intent': 'user-action' },
        body: JSON.stringify({
          identityToken: credential.identityToken,
          nonce,
          fullName: credential.fullName ? { givenName: credential.fullName.givenName ?? undefined, familyName: credential.fullName.familyName ?? undefined } : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { sessionJwt?: string };
      if (body.sessionJwt) await saveSessionToken(body.sessionJwt);
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
        <AppText variant="title">에어컨 민주주의</AppText>
        <AppText variant="body" center color={TOKEN.text2} style={{ marginBottom: SPACE.s5 }}>
          {hasAnyLogin ? '로그인하면 장소 관리 기능을 쓸 수 있어요.' : '로그인 없이도 모든 투표 기능을 사용할 수 있어요.'}
        </AppText>

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

        <Button label="로그인 없이 계속하기" variant="ghost" onPress={() => router.replace('/')} style={{ marginTop: SPACE.s4 }} />

        <View style={styles.legalFooter}>
          <Pressable onPress={() => Linking.openURL('https://aircondemocracy.com/privacy')} hitSlop={8}>
            <AppText variant="caption" color={TOKEN.text3}>개인정보처리방침</AppText>
          </Pressable>
          <AppText variant="caption" color={TOKEN.text3}>·</AppText>
          <Pressable onPress={() => Linking.openURL('https://aircondemocracy.com/account-deletion')} hitSlop={8}>
            <AppText variant="caption" color={TOKEN.text3}>계정·데이터 삭제</AppText>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  body: { flex: 1, padding: SPACE.s8, alignItems: 'center', justifyContent: 'center', gap: SPACE.s5 },
  icon: { width: 76, height: 76, borderRadius: TOKEN.r.lg },
  list: { width: '100%', maxWidth: 360 },
  appleBtn: { height: 52 },
  legalFooter: { marginTop: SPACE.s6, flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
});
