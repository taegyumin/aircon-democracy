'use client';

// Wizard for any school registered in @aircon/core/universities.
// Pattern: campus picker (if multi) → building search → building detail → freeform room.
// Single-campus schools skip the first step.

import { useMemo, useState } from 'react';
import { Search, GraduationCap, Building2 } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import {
  type University,
  type UnivCampus,
  type UnivBuilding,
  type UnivHit,
  searchUniversity,
  univPlaceDetail,
  univPlaceId,
  univPlaceName,
} from '@aircon/core/universities';
import { api } from '../../../../lib/apiClient';
import { BackIcon } from '../../../../components/Icons';

interface Props {
  university: University;
  onPicked: (placeId: string) => void;
  onFreeform: () => void;
  onExit: () => void;  // back to university picker
}

type View =
  | { mode: 'campus' }
  | { mode: 'search'; campus: UnivCampus }
  | { mode: 'college'; campus: UnivCampus; college: string }
  | { mode: 'building'; campus: UnivCampus; building: UnivBuilding };

export function GenericUniversityWizard({ university, onPicked, onFreeform, onExit }: Props) {
  const isMultiCampus = university.campuses.length > 1;
  const initialView: View = isMultiCampus
    ? { mode: 'campus' }
    : { mode: 'search', campus: university.campuses[0] };

  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState('');
  const [room, setRoom] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const back = () => {
    if (view.mode === 'building') setView({ mode: 'search', campus: view.campus });
    else if (view.mode === 'college') setView({ mode: 'search', campus: view.campus });
    else if (view.mode === 'search' && isMultiCampus) setView({ mode: 'campus' });
    else onExit();
  };

  const header = (title: string) => (
    <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button
          onClick={back}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
      </div>
    </div>
  );

  const submit = async (campus: UnivCampus, building: UnivBuilding, withRoom?: string) => {
    const id = univPlaceId(university, campus, building, withRoom);
    if (submitting) return;
    setSubmitting(id);
    try {
      await api.upsertPlace({
        id,
        name: univPlaceName(university, campus, building, withRoom),
        type: 'classroom',
        district: campus.district,
        detail: univPlaceDetail(university, campus, building, withRoom),
      });
      onPicked(id);
    } catch {
      setSubmitting(null);
    }
  };

  // ─── Campus picker (multi-campus only) ─────────────────────────────
  if (view.mode === 'campus') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {header(university.shortName)}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
            어느 캠퍼스에 계세요?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 18, lineHeight: 1.6 }}>
            {university.shortName}는 여러 캠퍼스로 나뉘어 있어요.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {university.campuses.map((c) => (
              <button
                key={c.id}
                onClick={() => setView({ mode: 'search', campus: c })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '14px 16px',
                  background: TOKEN.surface, border: `1.5px solid ${TOKEN.cold}40`,
                  borderRadius: TOKEN.r.lg, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: TOKEN.coldBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} color={TOKEN.cold} strokeWidth={2.2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
                    {c.district} · 건물 {c.buildings.length}개
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentCampus = view.campus;
  const hits = useMemo(() => searchUniversity(university, query, 20), [university, query]);
  const visibleHits = hits.filter((h) =>
    h.type === 'building' ? h.campus.id === currentCampus.id : h.matches.some((m) => m.campus.id === currentCampus.id)
  );

  // ─── Building detail ────────────────────────────────────────────────
  if (view.mode === 'building') {
    const b = view.building;
    const rTrim = room.trim();
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {header(`${b.code} ${b.name}`)}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ padding: '14px 16px', background: TOKEN.coldBg, borderRadius: TOKEN.r.md, marginBottom: 18 }}>
            <div style={{ fontSize: 11, color: TOKEN.text2, marginBottom: 4 }}>
              {b.college ? `${b.college} · ` : ''}{currentCampus.name}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>
              {b.name} <span style={{ color: TOKEN.text3, fontWeight: 600 }}>· {b.code}</span>
            </div>
            {b.aliases && b.aliases.length > 0 && (
              <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 4 }}>{b.aliases.join(' · ')}</div>
            )}
          </div>

          <Label>호실 번호 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(선택)</span></Label>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="예: 407, B106, 101, 강당"
            style={fieldStyle(!!rTrim)}
            autoFocus
          />
          <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 6, lineHeight: 1.6 }}>
            같은 호실 번호를 입력한 사람들끼리 의견이 모입니다.<br />
            호실을 모르면 비워두고 건물 전체 투표로 가셔도 돼요.
          </div>

          <div style={{ height: 22 }} />

          <button
            onClick={() => submit(currentCampus, b, rTrim || undefined)}
            disabled={submitting === univPlaceId(university, currentCampus, b, rTrim || undefined)}
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
    const list = view.campus.buildings.filter((b) => b.college === view.college);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {header(view.college)}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
          <div style={{ fontSize: 12, color: TOKEN.text2, marginBottom: 10 }}>{list.length}개 건물</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {list.map((b) => (
              <BuildingRow key={b.code} b={b} onTap={() => setView({ mode: 'building', campus: view.campus, building: b })} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Search ──────────────────────────────────────────────────────────
  const campus = currentCampus;
  const buildingsInCampus = campus.buildings;
  const headerTitle = isMultiCampus ? `${university.shortName} · ${campus.name}` : university.shortName;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {header(headerTitle)}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: TOKEN.surface, border: `1.5px solid ${TOKEN.border}`, borderRadius: TOKEN.r.lg, padding: '12px 14px', marginBottom: 14 }}>
          <Search size={18} color={TOKEN.text3} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`동번호·단과대·건물 (${campus.buildings.length}개 등록)`}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, fontFamily: FONT, color: TOKEN.text1, minWidth: 0 }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="지우기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text3, fontSize: 18, padding: 0 }}>×</button>
          )}
        </div>

        {!query.trim() ? (
          <DefaultLanding
            campus={campus}
            onBuildingTap={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
            onCollegeTap={(c) => setView({ mode: 'college', campus: view.campus, college: c })}
            onFreeform={onFreeform}
            notes={university.notes}
          />
        ) : visibleHits.length === 0 ? (
          <NoResults query={query} onFreeform={onFreeform} />
        ) : (
          <HitList
            hits={visibleHits}
            onBuilding={(b) => setView({ mode: 'building', campus: view.campus, building: b })}
            onCollege={(c) => setView({ mode: 'college', campus: view.campus, college: c })}
          />
        )}

        {buildingsInCampus.length === 0 && (
          <div style={{ marginTop: 22, padding: '16px', background: TOKEN.surface2, borderRadius: TOKEN.r.md, fontSize: 12, color: TOKEN.text2, lineHeight: 1.6 }}>
            이 캠퍼스는 아직 등록된 건물이 없어요. <br />
            "직접 입력하기"로 건물·강의실을 자유롭게 적어 주세요. 등록된 의견이 쌓이면 데이터를 보강합니다.
            <div style={{ height: 12 }} />
            <button onClick={onFreeform} style={primaryButtonStyle(true)}>직접 입력하기</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function DefaultLanding({
  campus, onBuildingTap, onCollegeTap, onFreeform, notes,
}: {
  campus: UnivCampus;
  onBuildingTap: (b: UnivBuilding) => void;
  onCollegeTap: (c: string) => void;
  onFreeform: () => void;
  notes?: string;
}) {
  const colleges = Array.from(new Set(campus.buildings.map((b) => b.college).filter(Boolean) as string[])).sort();
  const examples = campus.buildings.slice(0, 6);

  if (campus.buildings.length === 0) return null;

  return (
    <>
      {colleges.length > 0 && (
        <>
          <Label>단과대·소속으로 찾기</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 22 }}>
            {colleges.slice(0, 10).map((c) => (
              <button key={c} onClick={() => onCollegeTap(c)} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 12px',
                background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
                borderRadius: TOKEN.r.md, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
              }}>
                <GraduationCap size={14} color="#7C3AED" strokeWidth={2.2} />
                <span style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Label>주요 건물</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
        {examples.map((b) => <BuildingRow key={b.code} b={b} onTap={() => onBuildingTap(b)} />)}
      </div>

      {notes && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: TOKEN.surface2, borderRadius: TOKEN.r.md, fontSize: 11, color: TOKEN.text3, lineHeight: 1.6 }}>
          ⓘ {notes}
        </div>
      )}

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
  hits: UnivHit[];
  onBuilding: (b: UnivBuilding) => void;
  onCollege: (c: string) => void;
}) {
  const colleges = hits.filter((h) => h.type === 'college') as Extract<UnivHit, { type: 'college' }>[];
  const buildings = hits.filter((h) => h.type === 'building') as Extract<UnivHit, { type: 'building' }>[];
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
                  <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>{h.matches.length}개 건물</div>
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

function BuildingRow({ b, onTap }: { b: UnivBuilding; onTap: () => void }) {
  return (
    <button onClick={onTap} style={rowButtonStyle()}>
      <Building2 size={16} color={TOKEN.text2} strokeWidth={2.2} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ color: TOKEN.cold, fontVariantNumeric: 'tabular-nums', marginRight: 6 }}>{b.code}</span>
          {b.name}
        </div>
        <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {b.college ?? ''}{b.aliases && b.aliases[0] ? (b.college ? ' · ' : '') + b.aliases[0] : ''}
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
