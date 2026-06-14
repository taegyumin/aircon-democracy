// 홈 — 브랜드 + 즐겨찾기/최근 + 카테고리 picker. 디자인 시스템(src/ui) 전면 적용.

import * as React from 'react';
import { View, ScrollView, StyleSheet, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QrCode, User, Star, Clock } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { CategoryPicker } from '../src/components/CategoryPicker';
import type { Category } from '../src/screens/categories';
import { getRecent, type RecentPlace } from '../src/lib/recentPlaces';
import { listFavorites, type FavoritePlace } from '../src/lib/favorites';
import { useUser } from '../src/lib/useUser';
import { AppText, ListRow, SectionHeader, IconButton } from '../src/ui';

export default function HomeIndex() {
  const { user, refresh } = useUser();
  const [favorites, setFavorites] = React.useState<FavoritePlace[]>([]);
  const [recent, setRecent] = React.useState<RecentPlace[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
      listFavorites().then(setFavorites);
      getRecent(5).then(setRecent);
    }, [refresh]),
  );

  const recentExFaves = recent.filter((r) => !favorites.find((f) => f.id === r.id));
  const hasReturning = favorites.length > 0 || recentExFaves.length > 0;

  const goVote = (id: string) => router.push(`/p/${encodeURIComponent(id)}`);
  const goWizard = (cat?: Category) => router.push(cat ? `/wizard?cat=${cat}` : '/wizard');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../assets/icon.png')} style={styles.brandIcon} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLg" weight="bold">에어컨 민주주의</AppText>
          <AppText variant="micro" color={TOKEN.text3}>AIRCON DEMOCRACY</AppText>
        </View>
        <IconButton label="QR 코드 스캔" variant="filled" onPress={() => router.push('/qr')}>
          <QrCode size={20} color="#FFFFFF" />
        </IconButton>
        <IconButton label={user ? '설정' : '로그인'} variant="tonal" onPress={() => router.push(user ? '/settings' : '/login')}>
          <User size={20} color={TOKEN.text2} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {favorites.length > 0 && (
          <View>
            <SectionHeader>즐겨찾기</SectionHeader>
            <View style={{ gap: SPACE.rowGap }}>
              {favorites.slice(0, 3).map((f) => (
                <ListRow key={f.id} title={f.name} sub={f.district ?? undefined} onPress={() => goVote(f.id)}
                  leading={<View style={styles.favChip}><Star size={20} color="#F59E0B" fill="#F59E0B" /></View>} />
              ))}
            </View>
          </View>
        )}

        {recentExFaves.length > 0 && (
          <View>
            <SectionHeader>최근 방문</SectionHeader>
            <View style={{ gap: SPACE.rowGap }}>
              {recentExFaves.map((p) => (
                <ListRow key={p.id} title={p.name} sub={p.district ?? undefined} onPress={() => goVote(p.id)}
                  leading={<View style={styles.recentChip}><Clock size={20} color={TOKEN.text3} /></View>} />
              ))}
            </View>
          </View>
        )}

        <View style={hasReturning ? styles.headlineReturning : undefined}>
          <AppText variant="display">지금 어디 계세요?</AppText>
          <AppText variant="body" color={TOKEN.text2} style={{ marginTop: SPACE.s2 }}>
            장소만 고르면 30초 익명 투표
          </AppText>
        </View>

        <CategoryPicker onPick={goWizard} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingHorizontal: SPACE.screenPadding,
    paddingVertical: SPACE.s3,
    backgroundColor: TOKEN.bg,
  },
  brandIcon: { width: 36, height: 36, borderRadius: TOKEN.r.sm },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset, gap: SPACE.s6 },
  headlineReturning: { marginTop: SPACE.s2 },
  favChip: { width: 44, height: 44, borderRadius: TOKEN.r.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  recentChip: { width: 44, height: 44, borderRadius: TOKEN.r.md, alignItems: 'center', justifyContent: 'center', backgroundColor: TOKEN.surface2 },
});
