// 서울대 강의실 — 검색/단과대/건물 3-view state machine + 호실 grid. 디자인 시스템 적용.
// web SNUClassroomWizard.tsx 의 SNU view 부분 RN 포팅.

import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { TOKEN, SPACE, snu } from '@aircon/core';
import { api } from '../../lib/apiClient';
import { loadSnuRooms } from '../../lib/snuRooms';
import { AppText, TopBar, Input, Card, Badge, Button } from '../../ui';

type SNUBuilding = snu.SNUBuilding;
type SNURoom = snu.SNURoom;

type ViewState =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: SNUBuilding };

interface Props {
  onPicked: (placeId: string) => void;
  onExit: () => void; // 학교 변경 (UniversityPicker로 돌아가기)
}

const PUBLIC_KINDS: SNURoom['kind'][] = ['classroom', 'lab', 'lounge', 'other'];
const POPULAR_COLLEGES = [
  '공과대학', '인문대학', '사회과학대학', '자연과학대학', '경영대학',
  '사범대학', '농업생명과학대학', '생활과학대학', '법과대학', '의과대학',
];

export function SnuClassroom({ onPicked, onExit }: Props) {
  const [view, setView] = useState<ViewState>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<SNURoom[] | null>(null);
  const [roomsErr, setRoomsErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [allKinds, setAllKinds] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSnuRooms()
      .then((r) => { if (alive) setRooms(r); })
      .catch((e) => { if (alive) setRoomsErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const hits = useMemo(() => snu.search(query, rooms, 20), [query, rooms]);

  const pickPlace = async (b: SNUBuilding, room?: SNURoom) => {
    const id = snu.snuPlaceId(b, room);
    if (submitting) return;
    setSubmitting(id);
    setSubmitErr(null);
    try {
      await api.upsertPlace({
        id,
        name: snu.snuPlaceName(b, room),
        type: 'classroom',
        district: `서울 관악구 서울대학교 ${b.code}동`,
        detail: snu.snuPlaceDetail(b, room),
      });
      onPicked(id);
    } catch (e) {
      setSubmitErr((e as Error).message || '장소 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setSubmitting(null);
    }
  };

  // 헤더 — view 따라 뒤로가기 동작 변경
  const onBack = () => {
    if (view.mode === 'building' || view.mode === 'college') setView({ mode: 'search' });
    else onExit();
  };
  const headerTitle = view.mode === 'building'
    ? `${view.building.code}동 ${view.building.name}`
    : view.mode === 'college'
      ? view.college
      : '서울대 강의실';

  return (
    <View style={styles.flex}>
      <TopBar title={headerTitle} onBack={onBack} backLabel={view.mode === 'search' ? '학교 변경' : undefined} />

      {view.mode === 'building'
        ? <BuildingView
            b={view.building}
            rooms={rooms}
            allKinds={allKinds}
            setAllKinds={setAllKinds}
            submittingId={submitting}
            submitErr={submitErr}
            onPick={pickPlace}
          />
        : view.mode === 'college'
          ? <CollegeView
              college={view.college}
              onTapBuilding={(b) => setView({ mode: 'building', building: b })}
            />
          : <SearchView
              query={query}
              setQuery={setQuery}
              hits={hits}
              rooms={rooms}
              roomsErr={roomsErr}
              onTapCollege={(c) => setView({ mode: 'college', college: c })}
              onTapBuilding={(b) => setView({ mode: 'building', building: b })}
            />}
    </View>
  );
}

// ───────────────────────── 공용 Row ─────────────────────────

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

// ───────────────────────── Search view ─────────────────────────

function SearchView({
  query, setQuery, hits, rooms, roomsErr, onTapCollege, onTapBuilding,
}: {
  query: string;
  setQuery: (s: string) => void;
  hits: snu.Hit[];
  rooms: SNURoom[] | null;
  roomsErr: string | null;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="동번호·단과대·건물·호실 (예: 301, 공대, 우민홀)"
        clearable
        autoCorrect={false}
      />

      {roomsErr && (
        <Card style={styles.warn}>
          <AppText variant="caption" color={TOKEN.hot}>호실 데이터를 못 불러왔어요 ({roomsErr}). 건물·단과대 검색은 계속 사용할 수 있어요.</AppText>
        </Card>
      )}

      <View style={{ height: SPACE.s4 }} />

      {query.trim()
        ? (hits.length === 0
            ? <AppText variant="body" center color={TOKEN.text3} style={styles.emptyText}>일치하는 결과 없음. 다른 키워드를 입력해 보세요.</AppText>
            : <HitList hits={hits} onTapCollege={onTapCollege} onTapBuilding={onTapBuilding} />)
        : <DefaultLanding rooms={rooms} onTapCollege={onTapCollege} onTapBuilding={onTapBuilding} />}
    </ScrollView>
  );
}

function HitList({ hits, onTapCollege, onTapBuilding }: {
  hits: snu.Hit[];
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  return (
    <View style={styles.list}>
      {hits.map((h, i) => {
        if (h.type === 'college') {
          return <HitRow key={`c-${h.college}-${i}`} kind="단과대" title={h.college} sub={`건물 ${h.buildings.length}개`} onPress={() => onTapCollege(h.college)} />;
        }
        if (h.type === 'building') {
          return <HitRow key={`b-${h.building.code}-${i}`} kind="건물" title={`${h.building.code}동 · ${h.building.name}`} sub={`${h.building.college} · 호실 ${h.building.roomCount}개`} onPress={() => onTapBuilding(h.building)} />;
        }
        return <HitRow key={`r-${h.building.code}-${h.room.room}-${i}`} kind="호실" title={`${h.building.code}-${h.room.room} · ${h.room.label}`} sub={h.building.name} onPress={() => onTapBuilding(h.building)} />;
      })}
    </View>
  );
}

function DefaultLanding({ rooms, onTapCollege, onTapBuilding }: {
  rooms: SNURoom[] | null;
  onTapCollege: (c: string) => void;
  onTapBuilding: (b: SNUBuilding) => void;
}) {
  // 인기 단과대 (탭하면 단과대 view) + 호실 많은 건물 top 6 (찾기 쉬운 진입점)
  const popular = POPULAR_COLLEGES.filter((c) => snu.BUILDINGS.some((b) => b.college === c));
  const topBuildings = [...snu.BUILDINGS]
    .filter((b) => b.roomCount > 0)
    .sort((a, b) => b.roomCount - a.roomCount)
    .slice(0, 6);
  return (
    <View style={{ gap: SPACE.s6 }}>
      <View>
        <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>단과대 둘러보기</AppText>
        <View style={styles.tileGrid}>
          {popular.map((c) => (
            <Card key={c} onPress={() => onTapCollege(c)} accessibilityLabel={c} style={styles.tile}>
              <AppText variant="label" weight="bold" numberOfLines={1}>{c}</AppText>
            </Card>
          ))}
        </View>
      </View>
      <View>
        <AppText variant="micro" color={TOKEN.text3} style={styles.sectionLabel}>자주 가는 건물</AppText>
        {!rooms && <AppText variant="caption" color={TOKEN.text3} style={{ marginBottom: SPACE.s2 }}>호실 데이터 불러오는 중…</AppText>}
        <View style={styles.list}>
          {topBuildings.map((b) => (
            <NavRow key={b.code} title={`${b.code}동 · ${b.name}`} sub={`${b.college} · 호실 ${b.roomCount}개`} onPress={() => onTapBuilding(b)} />
          ))}
        </View>
      </View>
    </View>
  );
}

// ───────────────────────── College view ─────────────────────────

function CollegeView({ college, onTapBuilding }: { college: string; onTapBuilding: (b: SNUBuilding) => void }) {
  const list = useMemo(() => snu.BUILDINGS.filter((b) => b.college === college), [college]);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <AppText variant="caption" color={TOKEN.text3} style={{ marginBottom: SPACE.s3 }}>{list.length}개 건물</AppText>
      <View style={styles.list}>
        {list.map((b) => (
          <NavRow key={b.code} title={`${b.code}동 · ${b.name}`} sub={`호실 ${b.roomCount}개`} onPress={() => onTapBuilding(b)} />
        ))}
      </View>
    </ScrollView>
  );
}

// ───────────────────────── Building view ─────────────────────────

function BuildingView({
  b, rooms, allKinds, setAllKinds, submittingId, submitErr, onPick,
}: {
  b: SNUBuilding;
  rooms: SNURoom[] | null;
  allKinds: boolean;
  setAllKinds: (v: boolean) => void;
  submittingId: string | null;
  submitErr: string | null;
  onPick: (b: SNUBuilding, room?: SNURoom) => void;
}) {
  const allRooms = useMemo(
    () => rooms ? snu.roomsForBuilding(b.code, rooms) : [],
    [b.code, rooms],
  );
  const filtered = useMemo(
    () => allKinds ? allRooms : allRooms.filter((r) => PUBLIC_KINDS.includes(r.kind)),
    [allRooms, allKinds],
  );
  const wholeId = snu.snuPlaceId(b);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.bldgInfo}>
        <AppText variant="caption" color={TOKEN.text2}>{b.college} · {b.campus}캠퍼스</AppText>
        <AppText variant="title2" style={{ marginTop: 2 }}>{b.name} <AppText variant="title2" color={TOKEN.text3}>· {b.code}동</AppText></AppText>
      </Card>

      <Button
        label="이 건물 전체에서 투표 (호실 모름)"
        onPress={() => onPick(b)}
        loading={submittingId === wholeId}
        disabled={submittingId === wholeId}
        style={{ marginBottom: SPACE.s5 }}
      />

      {submitErr && (
        <Card style={styles.warn}><AppText variant="caption" color={TOKEN.hot}>{submitErr}</AppText></Card>
      )}

      <View style={styles.roomHeader}>
        <AppText variant="micro" color={TOKEN.text3}>호실 선택 ({filtered.length}개)</AppText>
        {allRooms.length > filtered.length && (
          <Pressable onPress={() => setAllKinds(!allKinds)} hitSlop={8}>
            <AppText variant="label" weight="bold" color={TOKEN.cold}>{allKinds ? '공용 공간만' : `전체 (${allRooms.length})`}</AppText>
          </Pressable>
        )}
      </View>

      {!rooms && <AppText variant="caption" color={TOKEN.text3}>호실 정보 불러오는 중…</AppText>}
      {rooms && filtered.length === 0 && (
        <AppText variant="caption" color={TOKEN.text3}>등록된 호실이 없어요. 위 버튼으로 건물 단위 투표가 가능합니다.</AppText>
      )}

      <RoomGrid b={b} rooms={filtered} submittingId={submittingId} onPick={onPick} />
    </ScrollView>
  );
}

function RoomGrid({
  b, rooms, submittingId, onPick,
}: {
  b: SNUBuilding;
  rooms: SNURoom[];
  submittingId: string | null;
  onPick: (b: SNUBuilding, room?: SNURoom) => void;
}) {
  // 층별 그룹화 + 정렬 (지하 B → 1 → 2 → … → 옥상 R)
  const groups = useMemo(() => groupByFloor(rooms), [rooms]);
  return (
    <View style={{ gap: SPACE.s4 }}>
      {groups.map(([floor, list]) => (
        <View key={floor}>
          <AppText variant="label" color={TOKEN.text2} style={{ marginBottom: SPACE.s2 }}>{floor}</AppText>
          <View style={styles.roomGrid}>
            {list.map((r) => {
              const id = snu.snuPlaceId(b, r);
              const submitting = submittingId === id;
              return (
                <Pressable
                  key={r.room + r.label}
                  onPress={() => onPick(b, r)}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.room} ${r.label}`}
                  style={[styles.roomBtn, kindStyle(r.kind), submitting && styles.roomBtnDisabled]}
                >
                  <AppText variant="label" weight="bold">{r.room}</AppText>
                  <AppText variant="micro" weight="regular" color={TOKEN.text2} numberOfLines={1} style={styles.roomLabel}>{r.label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function groupByFloor(rooms: SNURoom[]): [string, SNURoom[]][] {
  const map = new Map<string, SNURoom[]>();
  for (const r of rooms) {
    const floor = floorOf(r.room);
    const list = map.get(floor) ?? [];
    list.push(r);
    map.set(floor, list);
  }
  const order = (f: string) => {
    if (f === 'BF') return -10; // 지하 unspecified
    if (f.startsWith('B')) return -Number(f.slice(1));
    if (f === 'R') return 1000;
    const n = Number(f);
    return isNaN(n) ? 500 : n;
  };
  return Array.from(map.entries()).sort((a, b) => order(a[0]) - order(b[0]));
}

function floorOf(room: string): string {
  const m = room.match(/^([Bb])?(\d)/);
  if (!m) return 'BF';
  if (m[1]) return 'B' + m[2];
  return m[2];
}

// 방 종류 색은 토큰 팔레트(cold/ok/중립)로 제한 — 누런/핑크 하드코딩 제거(브랜드 일관성).
// 종류 텍스트(label)가 이미 구분을 주므로 색은 절제. classroom=cold(주류), lounge=ok(green), 나머지=중립.
function kindStyle(kind: SNURoom['kind']) {
  switch (kind) {
    case 'classroom': return { backgroundColor: TOKEN.coldBg, borderColor: TOKEN.cold };
    case 'lounge': return { backgroundColor: TOKEN.okBg, borderColor: TOKEN.ok };
    default: return { backgroundColor: TOKEN.surface, borderColor: TOKEN.border };
  }
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
  bldgInfo: { backgroundColor: TOKEN.coldBg, borderColor: TOKEN.coldBg, marginBottom: SPACE.s4 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACE.s5, marginBottom: SPACE.s3 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  roomBtn: { minWidth: 66, paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s2, borderRadius: TOKEN.r.sm, borderWidth: 1, alignItems: 'center' },
  roomBtnDisabled: { opacity: 0.5 },
  roomLabel: { marginTop: 1, maxWidth: 84 },
});
