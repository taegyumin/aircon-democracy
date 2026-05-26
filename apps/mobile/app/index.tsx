// Mobile HomeScreen — RN port. core 비즈니스 로직은 그대로 (@aircon/core).
// 첫 sprint: minimal CTA + 카테고리 진입. 점진 보강.

import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TOKEN } from '@aircon/core';

export default function HomeIndex() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>에어컨 민주주의</Text>
          <Text style={styles.tagline}>AIRCON DEMOCRACY</Text>
        </View>

        <Pressable style={styles.searchBar} onPress={() => router.push('/wizard')}>
          <Text style={styles.searchPlaceholder}>장소 이름 또는 건물 검색</Text>
        </Pressable>

        <Pressable style={styles.cta} onPress={() => router.push('/wizard')}>
          <Text style={styles.ctaText}>지금 어디 계세요?</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.push('/qr')}>
          <Text style={styles.secondaryText}>QR 코드 스캔</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => router.push('/login')}>
          <Text style={styles.secondaryText}>로그인</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKEN.bg },
  scroll: { padding: 20, gap: 12 },
  header: { marginBottom: 24, alignItems: 'center' },
  brand: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, letterSpacing: -0.5 },
  tagline: { fontSize: 10, color: TOKEN.text3, letterSpacing: 2, marginTop: 4 },
  searchBar: {
    padding: 14, backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.lg, borderWidth: 1, borderColor: TOKEN.border,
  },
  searchPlaceholder: { fontSize: 14, color: TOKEN.text3 },
  cta: {
    padding: 18, backgroundColor: TOKEN.cold,
    borderRadius: TOKEN.r.lg, marginTop: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  secondary: {
    padding: 14, backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.md, borderWidth: 1, borderColor: TOKEN.border,
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: TOKEN.text1 },
});
