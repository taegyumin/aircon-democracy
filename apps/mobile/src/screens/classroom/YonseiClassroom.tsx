// 연세대 강의실 — 건물 검색/picker + 호실 freeform 입력. 호실 dataset 없음. 디자인 시스템 적용.
// web YonseiClassroomWizard.tsx RN 포팅.

import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { TOKEN, SPACE, yonsei } from '@aircon/core';
import { api } from '../../lib/apiClient';
import { AppText, TopBar, Input, Field, Card, Badge, Button } from '../../ui';

type YonseiBuilding = yonsei.YonseiBuilding;

interface Props {
  onPicked: (placeId: string) => void;
  onExit: () => void;
}

type ViewState =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: YonseiBuilding };

export function YonseiClassroom({ onPicked, onExit }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const hits = useMemo(() => yonsei.search(query, 20), [query]);

  const submit = async (b: YonseiBuilding) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const r = room.trim() || undefined;
      const id = yonsei.yonseiPlaceId(b, r);
      await api.upsertPlace({
        id,
        name: yonsei.yonseiPlaceName(b, r),
        type: 'classroom',
        district: `서울 서대문구 연세대학교 ${b.code}동`,
        detail: yonsei.yonseiPlaceDetail(b, r),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') { setView({ mode: 'search' }); setRoom(''); }
    else onExit();
  };
  const headerTitle = view.mode === 'building'
    ? `${view.building.code}동 ${view.building.name}`
    : view.mode === 'college'
      ? view.college
      : '연세대 강의실';

  return (
    <View style={styles.flex}>
      <TopBar title={headerTitle} onBack={onBack} backLabel={view.mode === 'search' ? '학교 변경' : undefined} />

      {view.mode === 'building' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.bldgInfo}>
            <AppText variant="caption" color={TOKEN.text2}>{view.building.college} · 신촌캠퍼스</AppText>
            <AppText variant="title2" style={{ marginTop: 2 }}>{view.building.name} <AppText variant="title2" color={TOKEN.text3}>· {view.building.code}동</AppText></AppText>
          </Card>

          <Field
            label="호실 (선택)"
            value={room}
            onChangeText={setRoom}
            placeholder="예: 407, B106, N311, 강당"
            helper="같은 호실 번호끼리 의견이 모입니다. 모르면 비워둬도 됩니다."
            autoFocus
          />

          <View style={{ marginTop: SPACE.s5 }}>
            <Button
              label={room.trim() ? `${room.trim()}호로 투표` : '건물 전체에서 투표'}
              onPress={() => submit(view.building)}
              loading={submitting}
            />
          </View>

          {submitErr && (
            <Card style={styles.warn}><AppText variant="caption" color={TOKEN.hot}>{submitErr}</AppText></Card>
          )}
        </ScrollView>
      ) : view.mode === 'college' ? (
        <CollegeView college={view.college} onTapBuilding={(b) => setView({ mode: 'building', building: b })} />
      ) : (
        <SearchView
          query={query}
          setQuery={setQuery}
          hits={hits}
          onTapCollege={(c) => setView({ mode: 'college', college: c })}
          onTapBuilding={(b) => setView({ mode: 'building', building: b })}
        />
      )}
    </View>
  );
}

function HitRow({ kind, title, sub, onPress }: { kind: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <Badge label={kind} />
      <View style={styles.rowText}>
        <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>{title}</AppText>
        <AppText variant="caption" color={TOKEN.text2} numberOfLines={1} style={{ marginTop: 1 }}>{sub}</AppText>
      </View>
      <ChevronRight size={20} color={TOKEN.text3} />
    </Pressable>
  );
}

function NavRow({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <View style={styles.rowText}>
        <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>{title}</AppText>
        <AppText variant="caption" color={TOKEN.text2} numberOfLines={1} style={{ marginTop: 1 }}>{sub}</AppText>
      </View>
      <ChevronRight size={20} color={TOKEN.text3} />
    </Pressable>
  );
}

function SearchView({ query, setQuery, hits, onTapCollege, onTapBuilding }: {
  query: string; setQuery: (s: string) => void; hits: yonsei.YHit[];
  onTapCollege: (c: string) => void; onTapBuilding: (b: YonseiBuilding) => void;
}) {
  // 자주 가는 건물 (alphabet 우선 6개)
  const popular = yonsei.BUILDINGS.slice(0, 6);
  const popularColleges = yonsei.COLLEGE_LIST.slice(0, 6);
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="건물명·코드·단과대 (예: 공학원, 102, 상경)"
        clearable
        autoCorrect={false}
      />
      <View style={{ height: SPACE.s4 }} />
      {query.trim() ? (
        hits.length === 0 ? (
          <AppText variant="body" center color={TOKEN.text3} style={styles.emptyText}>일치하는 결과 없음.</AppText>
        ) : (
          <View style={styles.list}>
            {hits.map((h, i) => h.type === 'college'
              ? <HitRow key={`c-${h.college}-${i}`} kind="단과대" title={h.college} sub={`건물 ${h.buildings.length}개`} onPress={() => onTapCollege(h.college)} />
              : <HitRow key={`b-${h.building.code}-${i}`} kind="건물" title={`${h.building.code}동 · ${h.building.name}`} sub={h.building.college} onPress={() => onTapBuilding(h.building)} />,
            )}
          </View>
        )
      ) : (
        <View style={{ gap: SPACE.s6 }}>
          <View>
            <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>단과대 둘러보기</AppText>
            <View style={styles.tileGrid}>
              {popularColleges.map((c) => (
                <Card key={c} onPress={() => onTapCollege(c)} accessibilityLabel={c} style={styles.tile}>
                  <AppText variant="label" weight="bold" numberOfLines={1}>{c}</AppText>
                </Card>
              ))}
            </View>
          </View>
          <View>
            <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>자주 가는 건물</AppText>
            <View style={styles.list}>
              {popular.map((b) => (
                <NavRow key={b.code} title={`${b.code}동 · ${b.name}`} sub={b.college} onPress={() => onTapBuilding(b)} />
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function CollegeView({ college, onTapBuilding }: { college: string; onTapBuilding: (b: YonseiBuilding) => void }) {
  const list = useMemo(() => yonsei.BUILDINGS.filter((b) => b.college === college), [college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <AppText variant="caption" color={TOKEN.text3} style={{ marginBottom: SPACE.s3 }}>{list.length}개 건물</AppText>
      <View style={styles.list}>
        {list.map((b) => (
          <NavRow key={b.code} title={`${b.code}동 · ${b.name}`} sub={b.college} onPress={() => onTapBuilding(b)} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: SPACE.screenPadding, paddingBottom: SPACE.bottomInset + SPACE.s5 },
  list: { gap: SPACE.rowGap },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.s3, minHeight: 60,
    paddingVertical: SPACE.s3, paddingHorizontal: SPACE.s4,
    backgroundColor: TOKEN.surface, borderRadius: TOKEN.r.lg, borderWidth: 1, borderColor: TOKEN.border,
  },
  rowText: { flex: 1, minWidth: 0 },
  warn: { marginTop: SPACE.s3, backgroundColor: TOKEN.hotBg, borderColor: TOKEN.hotBg },
  emptyText: { paddingVertical: SPACE.s7 },
  sectionLabel: { marginBottom: SPACE.s3 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  tile: { width: '48.5%', minHeight: 56, justifyContent: 'center' },
  bldgInfo: { backgroundColor: TOKEN.coldBg, borderColor: TOKEN.coldBg, marginBottom: SPACE.s5 },
});
