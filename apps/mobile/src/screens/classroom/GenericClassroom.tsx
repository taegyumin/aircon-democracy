// Generic university classroom — UNIVERSITIES dataset (서울+전국). 호실 freeform. 디자인 시스템 적용.
// web GenericUniversityWizard.tsx RN 포팅.

import { useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { TOKEN, SPACE } from '@aircon/core';
import {
  searchUniversity,
  univPlaceId,
  univPlaceName,
  univPlaceDetail,
  type University,
  type UnivCampus,
  type UnivBuilding,
  type UnivHit,
} from '@aircon/core/universities';
import { api } from '../../lib/apiClient';
import { AppText, TopBar, Input, Field, Card, Badge, Button } from '../../ui';

interface Props {
  univ: University;
  onPicked: (placeId: string) => void;
  onExit: () => void;
}

type ViewState =
  | { mode: 'campus' }
  | { mode: 'search'; campus: UnivCampus }
  | { mode: 'college'; campus: UnivCampus; college: string }
  | { mode: 'building'; campus: UnivCampus; building: UnivBuilding };

export function GenericClassroom({ univ, onPicked, onExit }: Props) {
  const multiCampus = univ.campuses.length > 1;
  const [view, setView] = useState<ViewState>(
    multiCampus ? { mode: 'campus' } : { mode: 'search', campus: univ.campuses[0] },
  );
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const submit = async (campus: UnivCampus, b: UnivBuilding) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const r = room.trim() || undefined;
      const id = univPlaceId(univ, campus, b, r);
      await api.upsertPlace({
        id,
        name: univPlaceName(univ, campus, b, r),
        type: 'classroom',
        district: campus.district,
        detail: univPlaceDetail(univ, campus, b, r),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') { setView({ mode: 'search', campus: view.campus }); setRoom(''); }
    else if (view.mode === 'search' && multiCampus) setView({ mode: 'campus' });
    else onExit();
  };

  const headerTitle = view.mode === 'campus'
    ? `${univ.shortName} 캠퍼스 선택`
    : view.mode === 'building'
      ? `${view.building.code} ${view.building.name}`
      : view.mode === 'college'
        ? view.college
        : multiCampus
          ? `${univ.shortName} · ${view.campus.name}`
          : `${univ.shortName} 강의실`;

  const backLabel = view.mode === 'campus' || (!multiCampus && view.mode === 'search') ? '학교 변경' : undefined;

  return (
    <View style={styles.flex}>
      <TopBar title={headerTitle} onBack={onBack} backLabel={backLabel} />

      {view.mode === 'campus' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <AppText variant="caption" color={TOKEN.text3} style={{ marginBottom: SPACE.s3 }}>{univ.name} · {univ.campuses.length}개 캠퍼스</AppText>
          <View style={styles.list}>
            {univ.campuses.map((c) => (
              <NavRow key={c.id} title={c.name} sub={`${c.district} · 건물 ${c.buildings.length}개`} onPress={() => setView({ mode: 'search', campus: c })} />
            ))}
          </View>
        </ScrollView>
      ) : view.mode === 'building' ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.bldgInfo}>
            {view.building.college && <AppText variant="caption" color={TOKEN.text2}>{view.building.college} · {view.campus.name}</AppText>}
            <AppText variant="title2" style={{ marginTop: view.building.college ? 2 : 0 }}>
              {view.building.name} <AppText variant="title2" color={TOKEN.text3}>· {/^\d/.test(view.building.code) ? `${view.building.code}동` : view.building.code}</AppText>
            </AppText>
          </Card>

          <Field
            label="호실 (선택)"
            value={room}
            onChangeText={setRoom}
            placeholder="예: 407, B106, 강당"
            helper="같은 호실 번호끼리 의견이 모입니다. 모르면 비워둬도 됩니다."
            autoFocus
          />

          <View style={{ marginTop: SPACE.s5 }}>
            <Button
              label={room.trim() ? `${room.trim()}호로 투표` : '건물 전체에서 투표'}
              onPress={() => submit(view.campus, view.building)}
              loading={submitting}
            />
          </View>

          {submitErr && (
            <Card style={styles.warn}><AppText variant="caption" color={TOKEN.hot}>{submitErr}</AppText></Card>
          )}
        </ScrollView>
      ) : view.mode === 'college' ? (
        <CollegeView
          campus={view.campus}
          college={view.college}
          onTapBuilding={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
        />
      ) : (
        <SearchView
          univ={univ}
          campus={view.campus}
          query={query}
          setQuery={setQuery}
          onTapCollege={(c) => setView({ mode: 'college', campus: view.campus, college: c })}
          onTapBuilding={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
        />
      )}
    </View>
  );
}

function HitRow({ kind, title, sub, onPress }: { kind: string; title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <Badge label={kind} />
      <View style={styles.rowText}>
        <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>{title}</AppText>
        {sub ? <AppText variant="caption" color={TOKEN.text2} numberOfLines={1} style={{ marginTop: 1 }}>{sub}</AppText> : null}
      </View>
      <ChevronRight size={20} color={TOKEN.text3} />
    </Pressable>
  );
}

function NavRow({ title, sub, onPress }: { title: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
      <View style={styles.rowText}>
        <AppText variant="bodyLg" weight="semibold" numberOfLines={1}>{title}</AppText>
        {sub ? <AppText variant="caption" color={TOKEN.text2} numberOfLines={1} style={{ marginTop: 1 }}>{sub}</AppText> : null}
      </View>
      <ChevronRight size={20} color={TOKEN.text3} />
    </Pressable>
  );
}

function SearchView({
  univ, campus, query, setQuery, onTapCollege, onTapBuilding,
}: {
  univ: University;
  campus: UnivCampus;
  query: string;
  setQuery: (s: string) => void;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: UnivBuilding) => void;
}) {
  const hits: UnivHit[] = useMemo(() => searchUniversity(univ, query, 20), [univ, query]);
  const collegesInCampus = useMemo(
    () => Array.from(new Set(campus.buildings.map((b) => b.college).filter(Boolean) as string[])).sort(),
    [campus],
  );
  const popularBuildings = useMemo(() => campus.buildings.slice(0, 6), [campus]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="건물명·코드·단과대"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      <View style={{ height: SPACE.s4 }} />
      {query.trim() ? (
        hits.length === 0 ? (
          <AppText variant="body" center color={TOKEN.text3} style={styles.emptyText}>일치하는 결과 없음.</AppText>
        ) : (
          <View style={styles.list}>
            {hits.map((h, i) => h.type === 'college'
              ? <HitRow key={`c-${h.college}-${i}`} kind="단과대" title={h.college} sub={`건물 ${h.matches.length}개`} onPress={() => onTapCollege(h.college)} />
              : <HitRow key={`b-${h.campus.id}-${h.building.code}-${i}`} kind="건물" title={`${h.building.code} · ${h.building.name}`} sub={h.building.college ?? undefined} onPress={() => onTapBuilding(h.building)} />,
            )}
          </View>
        )
      ) : (
        <View style={{ gap: SPACE.s6 }}>
          {collegesInCampus.length > 0 && (
            <View>
              <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>단과대 둘러보기</AppText>
              <View style={styles.tileGrid}>
                {collegesInCampus.slice(0, 8).map((c) => (
                  <Card key={c} onPress={() => onTapCollege(c)} accessibilityLabel={c} style={styles.tile}>
                    <AppText variant="label" weight="bold" numberOfLines={1}>{c}</AppText>
                  </Card>
                ))}
              </View>
            </View>
          )}
          <View>
            <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>건물 목록 ({campus.buildings.length}개)</AppText>
            <View style={styles.list}>
              {popularBuildings.map((b) => (
                <NavRow key={b.code} title={`${b.code} · ${b.name}`} sub={b.college ?? undefined} onPress={() => onTapBuilding(b)} />
              ))}
            </View>
            {campus.buildings.length > popularBuildings.length && (
              <AppText variant="caption" color={TOKEN.text3} style={{ marginTop: SPACE.s2 }}>· 검색창에서 더 찾을 수 있어요</AppText>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function CollegeView({ campus, college, onTapBuilding }: {
  campus: UnivCampus;
  college: string;
  onTapBuilding: (b: UnivBuilding) => void;
}) {
  const list = useMemo(() => campus.buildings.filter((b) => b.college === college), [campus, college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <AppText variant="caption" color={TOKEN.text3} style={{ marginBottom: SPACE.s3 }}>{list.length}개 건물</AppText>
      <View style={styles.list}>
        {list.map((b) => (
          <NavRow key={b.code} title={`${b.code} · ${b.name}`} onPress={() => onTapBuilding(b)} />
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
