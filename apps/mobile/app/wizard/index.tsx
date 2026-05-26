// Mobile wizard landing — 4가지 카테고리 카드 grid.
// 사용자가 verbatim 강조한 4개 핵심 흐름이 메인 (기차/사무실은 secondary 안 함).

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';

interface Category {
  key: 'subway' | 'bus' | 'cafe' | 'classroom';
  label: string;
  sub: string;
  tint: string;
}

const CATEGORIES: Category[] = [
  { key: 'subway',    label: '지하철',     sub: '도시철도 · 노선 자동 매칭',  tint: '#1B53E5' },
  { key: 'bus',       label: '버스',       sub: '시내·시외 · 차량 식별',     tint: '#16A34A' },
  { key: 'cafe',      label: '카페·음식점', sub: '지도에서 위치 찍기',        tint: '#F97316' },
  { key: 'classroom', label: '강의실',     sub: '서울대 · 연세대',            tint: '#7C3AED' },
];

export default function WizardLanding() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>지금 어디 계세요?</Text>
        <Text style={styles.hint}>장소 유형을 골라주세요.</Text>

        <View style={styles.grid}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.card, { borderColor: c.tint }]}
              onPress={() => router.push(`/wizard/${c.key}`)}
            >
              <View style={[styles.dot, { backgroundColor: c.tint }]} />
              <Text style={styles.cardLabel}>{c.label}</Text>
              <Text style={styles.cardSub}>{c.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20 },
  intro: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.5, marginBottom: 6 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 20 },
  grid: { gap: 10 },
  card: {
    padding: 18,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.lg,
    borderWidth: 1.5,
  },
  dot: { width: 12, height: 12, borderRadius: 6, marginBottom: 8 },
  cardLabel: { fontSize: 16, fontWeight: '800', color: TOKEN.text1, letterSpacing: -0.3 },
  cardSub: { fontSize: 12, color: TOKEN.text2, marginTop: 4 },
});
