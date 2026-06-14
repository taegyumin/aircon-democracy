// Settings — 로그아웃 + 계정·데이터 삭제(App Store 5.1.1(v)/Play 필수) + 법률 링크. 디자인 시스템 적용.

import { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN, SPACE } from '@aircon/core';
import { api, clearSessionToken } from '../src/lib/apiClient';
import { useUser } from '../src/lib/useUser';
import { AppText, TopBar, Card, ListRow, Loading } from '../src/ui';

const PROVIDER_LABEL: Record<string, string> = { apple: 'Apple', kakao: 'Kakao', naver: 'Naver', google: 'Google' };

export default function SettingsScreen() {
  const { user, loading, logout } = useUser();
  const [deleting, setDeleting] = useState(false);

  const confirmLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      '계정·데이터 삭제',
      '내 계정과 등록한 장소가 모두 삭제됩니다. 익명 투표 기록은 voter token에 묶여 있어 그대로 남습니다. 계속하시겠어요?',
      [
        { text: '취소', style: 'cancel' },
        { text: '다음', style: 'destructive', onPress: () => {
          Alert.alert('정말 삭제하시겠어요?', '복구할 수 없습니다.', [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: async () => {
              setDeleting(true);
              try {
                await api.deleteAccount();
                await clearSessionToken();
                Alert.alert('삭제 완료', '계정이 삭제되었습니다.', [{ text: '확인', onPress: () => router.replace('/') }]);
              } catch {
                Alert.alert('삭제 실패', '네트워크 오류로 삭제하지 못했습니다. 다시 시도해주세요.');
              } finally { setDeleting(false); }
            } },
          ]);
        } },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title="설정" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <Loading />
        ) : user ? (
          <>
            <Card style={{ marginBottom: SPACE.s2 }}>
              <AppText variant="title2">{user.display_name ?? '이름 없음'}</AppText>
              <AppText variant="caption" color={TOKEN.text3} style={{ marginTop: 2 }}>{PROVIDER_LABEL[user.provider] ?? user.provider} 계정</AppText>
            </Card>
            <ListRow title="로그아웃" titleVariant="bodyLg" onPress={confirmLogout} />
            <ListRow title={deleting ? '삭제 중…' : '계정·데이터 삭제'} titleVariant="bodyLg" titleColor={TOKEN.hot} onPress={confirmDelete} disabled={deleting} loading={deleting} />
          </>
        ) : (
          <ListRow title="로그인" titleVariant="bodyLg" onPress={() => router.push('/login')} />
        )}

        <View style={{ height: SPACE.s5 }} />
        <ListRow title="개인정보 처리방침" titleVariant="bodyLg" onPress={() => Linking.openURL('https://aircondemocracy.com/privacy')} />
        <ListRow title="웹사이트" titleVariant="bodyLg" onPress={() => Linking.openURL('https://aircondemocracy.com')} />

        <AppText variant="caption" center color={TOKEN.text3} style={{ marginTop: SPACE.s7 }}>© 2026 에어컨 민주주의</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  body: { padding: SPACE.screenPadding, gap: SPACE.rowGap, paddingBottom: SPACE.bottomInset },
});
