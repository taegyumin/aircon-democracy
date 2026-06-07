// 학교 선택 — 검색 + 카드 list. web SNUClassroomWizard.tsx 의 UniversityPicker RN 포팅.

import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { TOKEN } from '@aircon/core';
import { KNOWN_UNIVS, type KnownUniv } from './types';

interface Props {
  onPick: (id: string) => void;
}

export function UniversityPicker({ onPick }: Props) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return KNOWN_UNIVS;
    return KNOWN_UNIVS.filter((u) =>
      u.name.toLowerCase().includes(q) ||
      u.aliases.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>어느 대학교?</Text>
      <Text style={styles.hint}>전국 {KNOWN_UNIVS.length}개 학교 데이터가 있어요. 못 찾으면 검색해 보세요.</Text>

      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="학교명·약어 (예: 카이스트, 부산대, KU)"
          placeholderTextColor={TOKEN.text3}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={styles.clearBtn}>×</Text>
          </Pressable>
        )}
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>일치하는 학교가 없어요.</Text>
          <Text style={styles.emptySub}>학교명을 줄여서 입력해 보세요 (예: '서울', 'KU').</Text>
        </View>
      ) : (
        list.map((u) => <UnivCard key={u.id} u={u} onPick={() => onPick(u.id)} />)
      )}
    </ScrollView>
  );
}

function UnivCard({ u, onPick }: { u: KnownUniv; onPick: () => void }) {
  const isBespoke = u.kind !== 'generic';
  const subParts: string[] = [u.badge, `건물 ${u.buildingCount}개`];
  if (u.roomCount) subParts.push(`호실 ${u.roomCount.toLocaleString('ko')}개`);
  if (u.note) subParts.push(u.note);
  return (
    <Pressable onPress={onPick} style={[styles.card, isBespoke && styles.cardBespoke]}>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardName}>{u.name}</Text>
        <Text style={styles.cardSub}>{subParts.join(' · ')}</Text>
      </View>
      <Text style={styles.cardChevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '900', color: TOKEN.text1, marginBottom: 6, letterSpacing: -0.5 },
  hint: { fontSize: 13, color: TOKEN.text2, marginBottom: 18, lineHeight: 18 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TOKEN.surface,
    borderWidth: 1.5,
    borderColor: TOKEN.border,
    borderRadius: TOKEN.r.lg,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: TOKEN.text1 },
  clearBtn: { fontSize: 22, color: TOKEN.text3, paddingHorizontal: 6 },
  empty: { padding: 24, alignItems: 'center', gap: 6 },
  emptyText: { fontSize: 14, color: TOKEN.text2, fontWeight: '600' },
  emptySub: { fontSize: 12, color: TOKEN.text3, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: TOKEN.surface,
    borderRadius: TOKEN.r.lg,
    borderWidth: 1,
    borderColor: TOKEN.border,
    marginBottom: 8,
  },
  cardBespoke: { borderColor: TOKEN.cold, borderWidth: 1.5 },
  cardTextWrap: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: '800', color: TOKEN.text1, marginBottom: 2 },
  cardSub: { fontSize: 11, color: TOKEN.text2 },
  cardChevron: { fontSize: 22, color: TOKEN.text3, fontWeight: '300' },
});
