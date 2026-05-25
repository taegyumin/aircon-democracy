import { useMemo, useState } from 'react';
import { Search, GraduationCap, Building2 } from 'lucide-react';
import { TOKEN, FONT } from '../lib/tokens';
import { api } from '../lib/api';
import {
  BUILDINGS,
  search,
  yonseiPlaceDetail,
  yonseiPlaceId,
  yonseiPlaceName,
  type YHit,
  type YonseiBuilding,
} from '../lib/yonsei';

interface Props {
  onPicked: (placeId: string) => void;
  onFreeform: () => void;
  // Custom header so the back button can go back to the university picker
  // instead of the category list. The wrapper component passes a handler in.
  renderHeader: (title: string, onBack: () => void) => React.ReactNode;
  onExit: () => void;  // back from the wizard's root → univ picker
}

type View =
  | { mode: 'search' }
  | { mode: 'college'; college: string }
  | { mode: 'building'; building: YonseiBuilding };

export function YonseiClassroomWizard({ onPicked, onFreeform, renderHeader, onExit }: Props) {
  const [view, setView] = useState<View>({ mode: 'search' });
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const hits = useMemo(() => search(query, 20), [query]);

  const submit = async (b: YonseiBuilding, withRoom?: string) => {
    const id = yonseiPlaceId(b, withRoom);
    if (submitting) return;
    setSubmitting(id);
    try {
      await api.upsertPlace({
        id,
        name: yonseiPlaceName(b, withRoom),
        type: 'classroom',
        district: `서울 서대문구 연세대학교 ${b.code}동`,
        detail: yonseiPlaceDetail(b, withRoom),
      });
      onPicked(id);
    } catch {
      setSubmitting(null);
    }
  };

  // ─── Building detail ────────────────────────────────────────────────
  if (view.mode === 'building') {
    const b = view.building;
    const rTrim = room.trim();
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader(`${b.code}동 ${b.name}`, () => { setView({ mode: 'search' }); setRoom(''); })}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ padding: '14px 16px', background: TOKEN.coldBg, borderRadius: TOKEN.r.md, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>{b.college} · 신촌캠퍼스</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
              {b.name} <span style={{ color: TOKEN.text3, fontWeight: 600 }}>· {b.code}동</span>
            </div>
            {b.aliases.length > 0 && (
              <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 4 }}>{b.aliases.join(' · ')}</div>
            )}
          </div>

          <Label>호실 번호 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(선택)</span></Label>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="예: 407, B106, N311, 강당"
            style={fieldStyle(!!rTrim)}
            autoFocus
          />
          <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 6, lineHeight: 1.6 }}>
            같은 호실 번호로 입력한 사람들끼리 의견이 모입니다.<br />
            호실을 모르면 비워두고 건물 전체 투표로 넘어가셔도 돼요.
          </div>

          <div style={{ height: 22 }} />

          <button
            onClick={() => submit(b, rTrim || undefined)}
            disabled={submitting === yonseiPlaceId(b, rTrim || undefined)}
            style={primaryButtonStyle(true)}
          >
            {submitting
              ? '이동 중…'
              : rTrim
                ? `${rTrim}호로 투표하러 가기`
                : '건물 전체에서 투표 (호실 모름)'}
          </button>
        </div>
      </div>
    );
  }

  // ─── College detail ─────────────────────────────────────────────────
  if (view.mode === 'college') {
    const list = BUILDINGS.filter((b) => b.college === view.college);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader(view.college, () => setView({ mode: 'search' }))}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ fontSize: 12, color: TOKEN.text2, marginBottom: 10 }}>{list.length}개 건물</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((b) => (
              <BuildingRow key={b.code} b={b} onTap={() => setView({ mode: 'building', building: b })} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Search ──────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {renderHeader('연세대 신촌캠퍼스', onExit)}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: TOKEN.surface, border: `1.5px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: '12px 14px', marginBottom: 14 }}>
          <Search size={18} color={TOKEN.text3} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="동번호·단과대·건물 (예: 122, 공대, 백양관)"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1, minWidth: 0 }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, padding: 0 }}>×</button>
          )}
        </div>

        {!query.trim() ? (
          <DefaultLanding
            onCollegeTap={(c) => setView({ mode: 'college', college: c })}
            onBuildingTap={(b) => setView({ mode: 'building', building: b })}
            onFreeform={onFreeform}
          />
        ) : hits.length === 0 ? (
          <NoResults query={query} onFreeform={onFreeform} />
        ) : (
          <HitList
            hits={hits}
            onBuilding={(b) => setView({ mode: 'building', building: b })}
            onCollege={(c) => setView({ mode: 'college', college: c })}
          />
        )}

        <div style={{ marginTop: 22, padding: '10px 12px', background: TOKEN.surface2, borderRadius: TOKEN.r.md, fontSize: 11, color: TOKEN.text3, lineHeight: 1.6 }}>
          ⓘ 연세대는 주요 건물 {BUILDINGS.length}개가 등록돼 있어요. 빠진 건물이 있으면 "직접 입력하기"로 추가해 주세요.
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DefaultLanding({
  onCollegeTap, onBuildingTap, onFreeform,
}: {
  onCollegeTap: (c: string) => void;
  onBuildingTap: (b: YonseiBuilding) => void;
  onFreeform: () => void;
}) {
  const popular = ['공과대학', '경영대학', '문과대학', '이과대학', '사회과학대학', '신과대학'];
  const examples: YonseiBuilding[] = [
    BUILDINGS.find((b) => b.code === '122'),
    BUILDINGS.find((b) => b.code === '310'),
    BUILDINGS.find((b) => b.code === '301'),
    BUILDINGS.find((b) => b.code === '606'),
  ].filter(Boolean) as YonseiBuilding[];

  return (
    <>
      <Label>단과대로 찾기</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 22 }}>
        {popular.map((c) => (
          <button key={c} onClick={() => onCollegeTap(c)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '11px 12px',
            background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
            borderRadius: TOKEN.r.md, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}>
            <GraduationCap size={14} color="#7C3AED" strokeWidth={2.2} />
            <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{c}</span>
          </button>
        ))}
      </div>

      <Label>자주 가는 건물</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {examples.map((b) => <BuildingRow key={b.code} b={b} onTap={() => onBuildingTap(b)} />)}
      </div>

      <button onClick={onFreeform} style={{
        width: '100%', padding: '12px',
        background: 'none', border: `1px dashed ${TOKEN.border}`,
        borderRadius: TOKEN.r.md, fontSize: 12, color: TOKEN.text2,
        cursor: 'pointer', fontFamily: FONT,
      }}>
        등록 안 된 건물이에요 — 직접 입력
      </button>
    </>
  );
}

function HitList({
  hits, onBuilding, onCollege,
}: {
  hits: YHit[];
  onBuilding: (b: YonseiBuilding) => void;
  onCollege: (c: string) => void;
}) {
  const colleges = hits.filter((h) => h.type === 'college') as Extract<YHit, { type: 'college' }>[];
  const buildings = hits.filter((h) => h.type === 'building') as Extract<YHit, { type: 'building' }>[];
  return (
    <>
      {colleges.length > 0 && (
        <>
          <Label>단과대</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {colleges.map((h) => (
              <button key={h.college} onClick={() => onCollege(h.college)} style={rowButtonStyle()}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {buildings.map((h) => <BuildingRow key={h.building.code} b={h.building} onTap={() => onBuilding(h.building)} />)}
          </div>
        </>
      )}
    </>
  );
}

function BuildingRow({ b, onTap }: { b: YonseiBuilding; onTap: () => void }) {
  return (
    <button onClick={onTap} style={rowButtonStyle()}>
      <Building2 size={16} color={TOKEN.text2} strokeWidth={2.2} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: TOKEN.cold, fontVariantNumeric: 'tabular-nums', marginRight: 6 }}>{b.code}</span>
          {b.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {b.college}{b.aliases[0] ? ' · ' + b.aliases[0] : ''}
        </div>
      </div>
    </button>
  );
}

function NoResults({ query, onFreeform }: { query: string; onFreeform: () => void }) {
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 16 }}>
        "<b>{query}</b>"에 해당하는 건물이 없어요.
      </div>
      <button onClick={onFreeform} style={primaryButtonStyle(true)}>직접 입력하기</button>
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

function fieldStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '13px 14px',
    border: `2px solid ${active ? TOKEN.cold : TOKEN.border}`,
    borderRadius: TOKEN.r.md,
    fontSize: 14,
    fontFamily: FONT,
    color: TOKEN.text1,
    background: TOKEN.bg,
    outline: 'none',
    transition: 'border-color 0.18s',
    boxSizing: 'border-box',
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
