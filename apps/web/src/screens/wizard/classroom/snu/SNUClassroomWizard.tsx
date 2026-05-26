'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, GraduationCap, Building2, DoorOpen, Check, Edit3 } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import { api } from '../../../../lib/apiClient';
import { BackIcon } from '../../../../components/Icons';
import {
  BUILDINGS,
  loadRooms,
  roomsForBuilding,
  search,
  snuPlaceDetail,
  snuPlaceId,
  snuPlaceName,
  type Hit,
  type SNUBuilding,
  type SNURoom,
} from '@aircon/core/snu';
import { BUILDINGS as YONSEI_BUILDINGS } from '@aircon/core/yonsei';
import { YonseiClassroomWizard } from '../yonsei/YonseiClassroomWizard';
import { WizardHeader } from '../../WizardHeader';

interface Props {
  onPicked: (placeId: string) => void;
  onFreeform: () => void;
  onBack: () => void;
}

type View =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: SNUBuilding };

// Coarse kinds we surface as the default "공용 공간" tab. Offices we hide unless
// the user explicitly toggles "전체" — voting on a private office is meaningless.
const PUBLIC_KINDS: SNURoom['kind'][] = ['classroom', 'lab', 'lounge', 'other'];

// Universities with building/room data. Each entry drives a card in the picker
// and routes to the school-specific wizard. Adding 고려대/카이스트 등 = one
// more entry + one more wizard component.
interface KnownUniv {
  id: 'snu' | 'yonsei';
  name: string;
  aliases: string[];
  badge: string;          // small chip text shown on the card
  buildingCount: number;
  roomCount?: number;     // omitted when we only have building-level data
  note?: string;          // extra hint shown under the badge (e.g. "호실 직접 입력")
}

const KNOWN_UNIVS: KnownUniv[] = [
  {
    id: 'snu',
    name: '서울대학교',
    aliases: ['서울대', 'SNU', '관악', '관악캠퍼스', '연건', '서울대학'],
    badge: '관악·연건',
    buildingCount: 160,
    roomCount: 1976,
  },
  {
    id: 'yonsei',
    name: '연세대학교',
    aliases: ['연세대', '연대', 'Yonsei', '신촌', '신촌캠퍼스', '연세대학'],
    badge: '신촌',
    buildingCount: YONSEI_BUILDINGS.length,
    note: '호실은 직접 입력',
  },
];

export function SNUClassroomWizard({ onPicked, onFreeform, onBack }: Props) {
  // Step 1: which university? null = picker showing.
  const [univ, setUniv] = useState<KnownUniv['id'] | null>(null);
  // Step 2 state (SNU wizard) — only meaningful once univ is set.
  const [view, setView] = useState<View>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [rooms, setRooms] = useState<SNURoom[] | null>(null);
  const [roomsErr, setRoomsErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Hooks must run on every render — DO NOT move below the early returns
  // (Rules of Hooks). loadRooms is idempotent so it's safe to invoke even
  // when the user ends up picking 연세대 instead of 서울대.
  useEffect(() => {
    let alive = true;
    loadRooms()
      .then((r) => { if (alive) setRooms(r); })
      .catch((e) => { if (alive) setRoomsErr((e as Error).message); });
    return () => { alive = false; };
  }, []);

  const hits = useMemo(() => search(query, rooms, 20), [query, rooms]);

  // Custom header used inside the SNU sub-wizard so the back button goes to
  // the university picker instead of the category picker.
  const innerHeader = (title: string) => (
    <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button
          onClick={() => {
            if (view.mode === 'building') setView({ mode: 'search' });
            else if (view.mode === 'college') setView({ mode: 'search' });
            else setUniv(null);
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
      </div>
    </div>
  );

  // ─── Step 1: university picker ─────────────────────────────────────
  if (univ === null) {
    return (
      <UniversityPicker
        onPick={(id) => setUniv(id)}
        onFreeform={onFreeform}
        onBack={onBack}
      />
    );
  }

  // ─── Step 2a: Yonsei wizard ────────────────────────────────────────
  if (univ === 'yonsei') {
    // Yonsei's wizard renders its own header with custom back handlers, so
    // we provide a (title, onBack) renderer that styles the bar the same way.
    const yRenderHeader = (title: string, onBack: () => void) => (
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="뒤로"
          >
            <BackIcon />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
        </div>
      </div>
    );
    return (
      <YonseiClassroomWizard
        onPicked={onPicked}
        onFreeform={onFreeform}
        renderHeader={yRenderHeader}
        onExit={() => setUniv(null)}
      />
    );
  }

  const pickPlace = async (b: SNUBuilding, room?: SNURoom) => {
    const id = snuPlaceId(b, room);
    if (submitting) return;
    setSubmitting(id);
    try {
      await api.upsertPlace({
        id,
        name: snuPlaceName(b, room),
        type: 'classroom',
        district: `서울 관악구 서울대학교 ${b.code}동`,
        detail: snuPlaceDetail(b, room),
      });
      onPicked(id);
    } catch {
      setSubmitting(null);
    }
  };

  // ─── Building detail view ───────────────────────────────────────────
  if (view.mode === 'building') {
    const b = view.building;
    const allRooms = rooms ? roomsForBuilding(b.code, rooms) : [];
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {innerHeader(`${b.code}동 ${b.name}`)}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ padding: '14px 16px', background: TOKEN.coldBg, borderRadius: TOKEN.r.md, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>{b.college} · {b.campus}캠퍼스</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
              {b.name} <span style={{ color: TOKEN.text3, fontWeight: 600 }}>· {b.code}동</span>
            </div>
          </div>

          {/* 건물 전체 단위로 투표 */}
          <button
            onClick={() => pickPlace(b)}
            disabled={submitting === snuPlaceId(b)}
            style={primaryButtonStyle(true)}
          >
            {submitting === snuPlaceId(b) ? '이동 중…' : `이 건물 전체에서 투표 (호실 모름)`}
          </button>

          <div style={{ height: 18 }} />

          <Label>호실 선택 ({allRooms.length}개)</Label>
          {allRooms.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: TOKEN.text3 }}>
              {rooms ? '등록된 호실이 없어요. 위 버튼으로 건물 단위 투표가 가능합니다.' : '호실 정보 불러오는 중…'}
            </div>
          )}
          <RoomGrid rooms={allRooms} onPick={(r) => pickPlace(b, r)} submittingId={submitting} buildingCode={b.code} />
        </div>
      </div>
    );
  }

  // ─── College detail view ────────────────────────────────────────────
  if (view.mode === 'college') {
    const list = BUILDINGS.filter((b) => b.college === view.college);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {innerHeader(view.college)}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ fontSize: 12, color: TOKEN.text2, marginBottom: 10 }}>
            {list.length}개 건물
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((b) => (
              <BuildingRow key={b.code + b.name} b={b} onTap={() => setView({ mode: 'building', building: b })} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Search view ─────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {innerHeader('서울대 강의실')}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: TOKEN.surface, border: `1.5px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: '12px 14px', marginBottom: 14 }}>
          <Search size={18} color={TOKEN.text3} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="동번호·단과대·건물·호실 (예: 301, 공대, 우민홀, 301-108)"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1, minWidth: 0 }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, padding: 0 }}>×</button>
          )}
        </div>

        {!query.trim() ? (
          <DefaultLanding onCollegeTap={(c) => setView({ mode: 'college', college: c })} onBuildingTap={(b) => setView({ mode: 'building', building: b })} onFreeform={onFreeform} />
        ) : roomsErr ? (
          <div style={{ padding: '14px', background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
            호실 데이터를 불러오지 못했어요 ({roomsErr}). 건물·단과대 검색은 계속 사용할 수 있어요.
          </div>
        ) : hits.length === 0 ? (
          <NoResults query={query} onFreeform={onFreeform} />
        ) : (
          <HitList hits={hits} onBuilding={(b) => setView({ mode: 'building', building: b })} onCollege={(c) => setView({ mode: 'college', college: c })} onRoom={pickPlace} submittingId={submitting} />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DefaultLanding({
  onCollegeTap,
  onBuildingTap,
  onFreeform,
}: {
  onCollegeTap: (c: string) => void;
  onBuildingTap: (b: SNUBuilding) => void;
  onFreeform: () => void;
}) {
  // Most-search-worthy colleges first (the ones with classroom buildings)
  const popular = [
    '공과대학', '인문대학', '사회과학대학', '자연과학대학', '경영대학',
    '사범대학', '법과대학', '농업생명과학대학', '미술대학', '음악대학',
  ];
  const examples: SNUBuilding[] = [
    BUILDINGS.find((b) => b.code === '301'),
    BUILDINGS.find((b) => b.code === '15'),
    BUILDINGS.find((b) => b.code === '83'),
    BUILDINGS.find((b) => b.code === '220'),
  ].filter(Boolean) as SNUBuilding[];

  return (
    <>
      <Label>단과대로 찾기</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 22 }}>
        {popular.map((c) => (
          <button
            key={c}
            onClick={() => onCollegeTap(c)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '11px 12px',
              background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.r.md, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
            }}
          >
            <GraduationCap size={14} color="#7C3AED" strokeWidth={2.2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{c}</span>
          </button>
        ))}
      </div>

      <Label>자주 가는 건물</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {examples.map((b) => (
          <BuildingRow key={b.code + b.name} b={b} onTap={() => onBuildingTap(b)} />
        ))}
      </div>

      <button
        onClick={onFreeform}
        style={{
          width: '100%', padding: '12px',
          background: 'none', border: `1px dashed ${TOKEN.border}`,
          borderRadius: TOKEN.r.md, fontSize: 12, color: TOKEN.text2,
          cursor: 'pointer', fontFamily: FONT,
        }}
      >
        서울대가 아니에요 — 직접 입력
      </button>
    </>
  );
}

function HitList({
  hits, onBuilding, onCollege, onRoom, submittingId,
}: {
  hits: Hit[];
  onBuilding: (b: SNUBuilding) => void;
  onCollege: (c: string) => void;
  onRoom: (b: SNUBuilding, r: SNURoom) => void;
  submittingId: string | null;
}) {
  // Group by type for clearer scanning
  const buildings = hits.filter((h) => h.type === 'building') as Extract<Hit, { type: 'building' }>[];
  const colleges = hits.filter((h) => h.type === 'college') as Extract<Hit, { type: 'college' }>[];
  const rms = hits.filter((h) => h.type === 'room') as Extract<Hit, { type: 'room' }>[];

  return (
    <>
      {colleges.length > 0 && (
        <>
          <Label>단과대</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {colleges.map((h) => (
              <button
                key={h.college}
                onClick={() => onCollege(h.college)}
                style={rowButtonStyle()}
              >
                <GraduationCap size={16} color="#7C3AED" strokeWidth={2.2} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{h.college}</div>
                  <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>{h.buildings.length}개 건물</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {buildings.length > 0 && (
        <>
          <Label>건물</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {buildings.map((h) => (
              <BuildingRow key={h.building.code + h.building.name} b={h.building} onTap={() => onBuilding(h.building)} />
            ))}
          </div>
        </>
      )}

      {rms.length > 0 && (
        <>
          <Label>호실</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rms.map((h) => {
              const id = snuPlaceId(h.building, h.room);
              return (
                <button
                  key={id + h.room.label}
                  onClick={() => onRoom(h.building, h.room)}
                  disabled={submittingId === id}
                  style={rowButtonStyle(submittingId === id)}
                >
                  <DoorOpen size={16} color={TOKEN.cold} strokeWidth={2.2} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.room.room} {h.room.label}
                    </div>
                    <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.building.code}동 {h.building.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function BuildingRow({ b, onTap }: { b: SNUBuilding; onTap: () => void }) {
  return (
    <button onClick={onTap} style={rowButtonStyle()}>
      <Building2 size={16} color={TOKEN.text2} strokeWidth={2.2} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: TOKEN.cold, fontVariantNumeric: 'tabular-nums', marginRight: 6 }}>{b.code}</span>
          {b.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {b.college} · 호실 {b.roomCount}개
        </div>
      </div>
    </button>
  );
}

function RoomGrid({
  rooms, onPick, submittingId, buildingCode,
}: {
  rooms: SNURoom[];
  onPick: (r: SNURoom) => void;
  submittingId: string | null;
  buildingCode: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const filtered = showAll ? rooms : rooms.filter((r) => PUBLIC_KINDS.includes(r.kind));

  // Group by floor for orientation
  const byFloor = new Map<string, SNURoom[]>();
  for (const r of filtered) {
    const m = r.room.match(/^([B]?\d+)/);
    const floor = m ? m[1].replace(/(\d)\d\d.*/, '$1') + 'F' : 'etc';
    const arr = byFloor.get(floor) ?? [];
    arr.push(r);
    byFloor.set(floor, arr);
  }
  const floors = Array.from(byFloor.keys()).sort((a, b) => {
    const na = a === 'etc' ? 999 : a.startsWith('B') ? -1 : parseInt(a);
    const nb = b === 'etc' ? 999 : b.startsWith('B') ? -1 : parseInt(b);
    return na - nb;
  });

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => setShowAll(false)}
          style={tabStyle(!showAll)}
        >공용 공간</button>
        <button
          onClick={() => setShowAll(true)}
          style={tabStyle(showAll)}
        >전체 ({rooms.length})</button>
      </div>
      {floors.map((f) => (
        <div key={f} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, marginBottom: 6 }}>{f}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {byFloor.get(f)!.map((r) => {
              const isClass = r.kind === 'classroom';
              const submitting = submittingId === `snu:관악:${buildingCode}:${r.room}` || submittingId === `snu:연건:${buildingCode}:${r.room}`;
              return (
                <button
                  key={r.room + r.label}
                  onClick={() => onPick(r)}
                  disabled={submitting}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '9px 12px',
                    background: isClass ? TOKEN.coldBg : TOKEN.surface,
                    border: `1.5px solid ${isClass ? TOKEN.cold + '55' : TOKEN.border}`,
                    borderRadius: TOKEN.r.md,
                    cursor: submitting ? 'wait' : 'pointer',
                    fontFamily: FONT,
                    opacity: submitting ? 0.6 : 1,
                    minWidth: 80,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800, color: TOKEN.text1, fontVariantNumeric: 'tabular-nums' }}>{r.room}</span>
                  <span style={{ fontSize: 10, color: TOKEN.text2, marginTop: 1 }}>{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function NoResults({ query, onFreeform }: { query: string; onFreeform: () => void }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 16 }}>
        "<b>{query}</b>"에 해당하는 건물/단과대/호실이 없어요.
      </div>
      <button onClick={onFreeform} style={primaryButtonStyle(true)}>
        직접 입력하기
      </button>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 8, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
}

function rowButtonStyle(loading = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '12px 14px',
    background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
    borderRadius: TOKEN.r.md, textAlign: 'left',
    cursor: loading ? 'wait' : 'pointer', fontFamily: FONT,
    opacity: loading ? 0.6 : 1,
  };
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '9px 12px',
    background: active ? TOKEN.cold : TOKEN.surface,
    color: active ? '#fff' : TOKEN.text2,
    border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
    borderRadius: TOKEN.r.md,
    fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: FONT,
  };
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '14px',
    background: enabled ? TOKEN.cold : TOKEN.border,
    color: '#fff',
    border: 'none',
    borderRadius: TOKEN.r.lg,
    fontSize: 14,
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: FONT,
    boxShadow: enabled ? `0 6px 20px ${TOKEN.cold}30` : 'none',
  };
}

// ─── University picker ───────────────────────────────────────────────

function UniversityPicker({
  onPick,
  onFreeform,
  onBack,
}: {
  onPick: (id: KnownUniv['id']) => void;
  onFreeform: () => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? KNOWN_UNIVS.filter((u) =>
        u.name.toLowerCase().includes(ql) || u.aliases.some((a) => a.toLowerCase().includes(ql))
      )
    : KNOWN_UNIVS;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="강의실" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
          어느 학교에 계세요?
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 18, lineHeight: 1.6 }}>
          데이터가 등록된 학교를 골라주세요.<br />없으면 직접 입력하실 수 있어요.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: TOKEN.surface, border: `1.5px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: '12px 14px', marginBottom: 16 }}>
          <Search size={18} color={TOKEN.text3} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="학교 이름 검색"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1, minWidth: 0 }}
            autoFocus
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, padding: 0 }}>×</button>
          )}
        </div>

        {filtered.length > 0 ? (
          <>
            <Label>데이터 등록된 학교</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onPick(u.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '14px 16px',
                    background: TOKEN.surface, border: `1.5px solid ${TOKEN.cold}40`,
                    borderRadius: TOKEN.r.lg, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: TOKEN.coldBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <GraduationCap size={20} color={TOKEN.cold} strokeWidth={2.2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
                      {u.badge} · 건물 {u.buildingCount}개{u.roomCount ? ` · 호실 ${u.roomCount.toLocaleString()}개` : ''}
                      {u.note ? <span style={{ marginLeft: 6, color: TOKEN.text2 }}>({u.note})</span> : null}
                    </div>
                  </div>
                  <Check size={16} color={TOKEN.cold} strokeWidth={2.5} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: '20px 14px', background: TOKEN.surface, border: `1px dashed ${TOKEN.border}`, borderRadius: TOKEN.r.md, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 4 }}>
              "<b>{q}</b>"는 아직 등록되지 않았어요.
            </div>
            <div style={{ fontSize: 11, color: TOKEN.text3 }}>
              아래 "직접 입력하기"로 강의실을 등록할 수 있어요.
            </div>
          </div>
        )}

        <Label>내 학교가 없어요</Label>
        <button
          onClick={onFreeform}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '14px 16px',
            background: TOKEN.surface, border: `1.5px dashed ${TOKEN.border}`,
            borderRadius: TOKEN.r.lg, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 11, background: TOKEN.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Edit3 size={18} color={TOKEN.text2} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>직접 입력하기</div>
            <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
              학교·건물·강의실 이름을 자유롭게 적을 수 있어요
            </div>
          </div>
        </button>

        <div style={{ marginTop: 22, fontSize: 11, color: TOKEN.text3, textAlign: 'center', lineHeight: 1.6 }}>
          다른 학교는 곧 추가될 예정이에요.<br />
          학교 데이터 제보·요청은 언제든 환영합니다.
        </div>
      </div>
    </div>
  );
}
