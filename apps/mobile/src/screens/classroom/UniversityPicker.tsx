// 학교 선택 — 검색 + 카드 list. web SNUClassroomWizard.tsx 의 UniversityPicker RN 포팅. 디자인 시스템 적용.

import { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TOKEN, SPACE } from '@aircon/core';
import { AppText, TopBar, Input, ListRow, EmptyState } from '../../ui';
import { KNOWN_UNIVS, type KnownUniv } from './types';

interface Props {
  onPick: (id: string) => void;
  onBack: () => void;
}

export function UniversityPicker({ onPick, onBack }: Props) {
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
    <View style={styles.flex}>
      <TopBar title="강의실" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AppText variant="title">어느 대학교?</AppText>
        <AppText variant="body" color={TOKEN.text2} style={styles.hint}>
          전국 {KNOWN_UNIVS.length}개 학교 데이터가 있어요. 못 찾으면 검색해 보세요.
        </AppText>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="학교명·약어 (예: 카이스트, 부산대, KU)"
          clearable
          autoCorrect={false}
        />

        {list.length === 0 ? (
          <View style={styles.empty}>
            <EmptyState title="일치하는 학교가 없어요" desc="학교명을 줄여서 입력해 보세요 (예: '서울', 'KU')." />
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((u) => (
              <ListRow key={u.id} title={u.name} sub={subOf(u)} accent={u.kind !== 'generic'} onPress={() => onPick(u.id)} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function subOf(u: KnownUniv): string {
  const parts: string[] = [u.badge, `건물 ${u.buildingCount}개`];
  if (u.roomCount) parts.push(`호실 ${u.roomCount.toLocaleString('ko')}개`);
  if (u.note) parts.push(u.note);
  return parts.join(' · ');
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset },
  hint: { marginTop: SPACE.s2, marginBottom: SPACE.s4, lineHeight: 21 },
  list: { marginTop: SPACE.s4, gap: SPACE.rowGap },
  empty: { marginTop: SPACE.s6 },
});
