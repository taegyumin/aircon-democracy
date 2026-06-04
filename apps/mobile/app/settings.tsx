// Settings — logged-in user의 로그아웃 + 계정·데이터 삭제 안내.
// App Store 5.1.1(v) + Play Console 정책: in-app account deletion 접근 필수.

import { View, Text, Pressable, StyleSheet, Linking, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';
import { useUser } from '../src/lib/useUser';

const PROVIDER_LABEL: Record<string, string> = {
  apple: 'Apple',
  kakao: 'Kakao',
  naver: 'Naver',
  google: 'Google',
};

export default function SettingsScreen() {
  const { user, loading, logout } = useUser();

  const confirmLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="뒤로">
          <Text style={styles.backTxt}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>설정</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={TOKEN.text2} />
        ) : user ? (
          <>
            <View style={styles.userCard}>
              <Text style={styles.userName}>{user.display_name ?? '이름 없음'}</Text>
              <Text style={styles.userMeta}>{PROVIDER_LABEL[user.provider] ?? user.provider} 계정</Text>
            </View>

            <Pressable onPress={confirmLogout} style={styles.row}>
              <Text style={styles.rowLabel}>로그아웃</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>

            <Pressable
              onPress={() => Linking.openURL('https://aircondemocracy.com/account-deletion')}
              style={styles.row}
            >
              <Text style={[styles.rowLabel, { color: TOKEN.hot }]}>계정·데이터 삭제</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => router.push('/login')} style={styles.row}>
              <Text style={styles.rowLabel}>로그인</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          </>
        )}

        <View style={{ height: 24 }} />

        <Pressable
          onPress={() => Linking.openURL('https://aircondemocracy.com/privacy')}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>개인정보 처리방침</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL('https://aircondemocracy.com')}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>웹사이트</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>© 2026 Minari</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
    backgroundColor: TOKEN.surface,
  },
  backBtn: { width: 60 },
  backTxt: { fontSize: 15, color: TOKEN.cold, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: TOKEN.text1 },
  body: { padding: 16, gap: 8 },
  userCard: {
    backgroundColor: TOKEN.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: TOKEN.border,
  },
  userName: { fontSize: 17, fontWeight: '800', color: TOKEN.text1 },
  userMeta: { fontSize: 13, color: TOKEN.text3, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKEN.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: TOKEN.border,
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: TOKEN.text1 },
  rowArrow: { fontSize: 18, color: TOKEN.text3 },
  footer: { textAlign: 'center', fontSize: 11, color: TOKEN.text3, marginTop: 'auto', marginBottom: 16 },
});
