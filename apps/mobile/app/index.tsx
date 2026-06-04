// Home Redesign v2 (RN port). Web HomeScreen 구조와 동일:
//   1. 헤더 (로고 + QR + 사용자)
//   2. (있으면) 즐겨찾기 — pinned places
//   3. (있으면) 최근 방문
//   4. 첫 방문이면 헤드라인 + CategoryPicker / 재방문이면 구분선 + picker
//   5. CategoryPicker (탭 → /wizard?cat=...)

import * as React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { TOKEN } from '@aircon/core';
import { CategoryPicker } from '../src/components/CategoryPicker';
import type { Category } from '../src/screens/categories';
import { getRecent, type RecentPlace } from '../src/lib/recentPlaces';
import { listFavorites, type FavoritePlace } from '../src/lib/favorites';
import { useUser } from '../src/lib/useUser';

export default function HomeIndex() {
  const { user, refresh } = useUser();
  const [favorites, setFavorites] = React.useState<FavoritePlace[]>([]);
  const [recent, setRecent] = React.useState<RecentPlace[]>([]);

  // Settings에서 logout/계정삭제 후 router.replace('/')로 돌아올 때 stale user 방지.
  // recent/favorites도 함께 refresh — vote 후 home 돌아왔을 때 즉시 반영.
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/icon.png')} style={styles.brandIcon} />
          <View>
            <Text style={styles.brandText}>에어컨 민주주의</Text>
            <Text style={styles.brandTag}>AIRCON DEMOCRACY</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => router.push('/qr')}
            style={styles.qrBtn}
            accessibilityLabel="QR 코드 스캔"
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 7h4V3h0M21 7v0h-4V3M3 17v4h4M17 21h4v-4M7 9h2v2H7zM15 9h2v2h-2zM7 15h2v2H7z"
                stroke="#fff"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Pressable
            onPress={() => router.push(user ? '/settings' : '/login')}
            style={styles.userBtn}
            accessibilityLabel={user ? '설정' : '로그인'}
          >
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="8" r="4" stroke={TOKEN.text3} strokeWidth={1.8} />
              <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={TOKEN.text3} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 즐겨찾기 */}
        {favorites.length > 0 && (
          <View>
            <SectionHeader icon="star" label="즐겨찾기" />
            <View style={{ gap: 8 }}>
              {favorites.slice(0, 3).map((f) => (
                <RecentCard key={f.id} place={f} onPress={() => goVote(f.id)} />
              ))}
            </View>
          </View>
        )}

        {/* 최근 방문 */}
        {recentExFaves.length > 0 && (
          <View>
            <SectionHeader icon="clock" label="최근 방문" />
            <View style={{ gap: 8 }}>
              {recentExFaves.map((p) => (
                <RecentCard key={p.id} place={p} onPress={() => goVote(p.id)} />
              ))}
            </View>
          </View>
        )}

        {/* 구분선 — 재방문 컨텍스트 있을 때만 */}
        {hasReturning && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>다른 장소 찾기</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* 헤드라인 — 첫 방문이면 강조 */}
        {!hasReturning && (
          <View>
            <Text style={styles.headline}>지금 어디 계세요?</Text>
            <Text style={styles.subhead}>장소 유형을 고르면 바로 투표할 수 있어요</Text>
          </View>
        )}

        {/* 카테고리 picker */}
        <CategoryPicker onPick={(k) => goWizard(k)} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, label }: { icon: 'star' | 'clock'; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
        {icon === 'star' && (
          <Path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            fill="#F59E0B"
            stroke="#F59E0B"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        )}
        {icon === 'clock' && (
          <>
            <Circle cx="12" cy="12" r="9" stroke={TOKEN.text3} strokeWidth={1.8} />
            <Path d="M12 7v5l3 3" stroke={TOKEN.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
      <Text style={{ fontSize: 12, fontWeight: '700', color: TOKEN.text2, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

interface CardPlace {
  id: string;
  name: string;
  type: string;
  district?: string | null;
}
function RecentCard({ place, onPress }: { place: CardPlace; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardName} numberOfLines={1}>
          {place.name}
        </Text>
        {(place.district || place.type) && (
          <Text style={styles.cardSub} numberOfLines={1}>
            {place.district ? `${place.district} · ` : ''}
            {place.type}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  header: {
    backgroundColor: TOKEN.surface,
    borderBottomWidth: 1,
    borderBottomColor: TOKEN.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  brandIcon: { width: 30, height: 30, borderRadius: 8 },
  brandText: { fontSize: 15, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.4, lineHeight: 18 },
  brandTag: { fontSize: 9, color: TOKEN.text3, letterSpacing: 1.8, marginTop: 1 },
  qrBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TOKEN.cold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  userBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TOKEN.bg,
    borderWidth: 1,
    borderColor: TOKEN.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 16, paddingBottom: 60, gap: 22 },
  headline: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.5, lineHeight: 30, marginBottom: 6 },
  subhead: { fontSize: 13, color: TOKEN.text2, lineHeight: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: TOKEN.border },
  dividerText: { fontSize: 12, color: TOKEN.text3, fontWeight: '500' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TOKEN.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: TOKEN.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardName: { fontSize: 14, fontWeight: '700', color: TOKEN.text1, letterSpacing: -0.2 },
  cardSub: { fontSize: 12, color: TOKEN.text3, marginTop: 2 },
});
