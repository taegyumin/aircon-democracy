import { useMemo, useState } from 'react';
import { TrainFront, Bus, GraduationCap, Building2, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TOKEN, FONT } from '../lib/tokens';
import { api } from '../lib/api';
import type { PlaceType } from '../lib/places';
import { ALL_LINES, lineColor, searchStations, type Station } from '../lib/subway';
import { BackIcon } from '../components/Icons';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
  onRegisterFreeform: (initialType: PlaceType) => void;
}

type Category = 'subway' | 'bus' | 'classroom' | 'office' | 'other';

const CATEGORIES: { key: Category; Icon: LucideIcon; tint: string; label: string; sub: string }[] = [
  { key: 'subway',    Icon: TrainFront,    tint: '#1B53E5', label: '지하철',  sub: '열차 안' },
  { key: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스',    sub: '시내·시외' },
  { key: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실',  sub: '학교' },
  { key: 'office',    Icon: Building2,     tint: '#475569', label: '사무실',  sub: '회사' },
  { key: 'other',     Icon: MapPin,        tint: '#F97316', label: '기타',    sub: '카페·도서관 등' },
];

const CAR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);

  // Subway state
  const [subLine, setSubLine] = useState<string | null>(null);
  const [subCar, setSubCar] = useState<number | 'unknown' | null>(null);
  const [subStationQuery, setSubStationQuery] = useState('');
  const [subStation, setSubStation] = useState<Station | null>(null);

  // Bus state
  const [busRoute, setBusRoute] = useState('');
  const [busStop, setBusStop] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitSubway = async () => {
    if (!subLine || !subCar) return;
    setSubmitting(true);
    setError(null);
    try {
      const carLabel = subCar === 'unknown' ? '칸 미정' : `${subCar}번칸`;
      const carIdPart = subCar === 'unknown' ? 'x' : String(subCar);
      const stationPart = subStation ? `:${subStation.name}` : '';
      const id = `subway:${subLine}${stationPart}:${carIdPart}`;
      const name = subStation ? `${subLine} ${subStation.name} ${carLabel}` : `${subLine} ${carLabel}`;
      const district = subStation ? `${subStation.city}${subStation.areas[0] ? ' ' + subStation.areas[0] : ''}` : null;
      await api.upsertPlace({
        id,
        name,
        type: 'subway',
        district: district ?? undefined,
        detail: subStation ? `${subLine} · ${subStation.areas.join(', ')}` : subLine,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitBus = async () => {
    const route = busRoute.trim();
    if (!route) return;
    setSubmitting(true);
    setError(null);
    try {
      const stop = busStop.trim();
      const id = stop ? `bus:${route}:${stop}` : `bus:${route}`;
      const name = stop ? `${route}번 버스 (${stop})` : `${route}번 버스`;
      await api.upsertPlace({
        id,
        name,
        type: 'bus',
        district: undefined,
        detail: stop || undefined,
      });
      onPicked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Header
  const renderHeader = (title: string, onBackOverride?: () => void) => (
    <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 14px' }}>
        <button
          onClick={onBackOverride ?? onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <BackIcon />
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>{title}</span>
      </div>
    </div>
  );

  // ── STEP 1: Category ─────────────────────────────────────────────
  if (!category) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('지금 어디 계세요?')}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.5px' }}>
            지금 계신 곳은?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 28, lineHeight: 1.6 }}>
            장소 유형을 골라주시면 빠르게 투표할 수 있어요
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {CATEGORIES.map((c) => {
              const Icon = c.Icon;
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    if (c.key === 'subway' || c.key === 'bus') setCategory(c.key);
                    else onRegisterFreeform(c.key);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '16px 18px',
                    borderRadius: TOKEN.r.lg,
                    border: `1.5px solid ${TOKEN.border}`,
                    background: TOKEN.surface,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: c.tint + '15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={22} color={c.tint} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.3px' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>{c.sub}</div>
                  </div>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <path d="M9 6l6 6-6 6" stroke={TOKEN.text3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP 2: SUBWAY ────────────────────────────────────────────────
  if (category === 'subway') {
    return <SubwayWizard
      line={subLine} setLine={setSubLine}
      car={subCar} setCar={setSubCar}
      stationQuery={subStationQuery} setStationQuery={setSubStationQuery}
      station={subStation} setStation={setSubStation}
      submitting={submitting}
      error={error}
      onBack={() => { setCategory(null); setSubLine(null); setSubCar(null); setSubStation(null); setSubStationQuery(''); }}
      onSubmit={submitSubway}
      renderHeader={(t) => renderHeader(t, () => { setCategory(null); setSubLine(null); setSubCar(null); setSubStation(null); })}
    />;
  }

  // ── STEP 2: BUS ───────────────────────────────────────────────────
  if (category === 'bus') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        {renderHeader('버스', () => setCategory(null))}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
            어떤 버스 타고 계세요?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 1.6 }}>
            노선 번호를 입력해주세요
          </div>

          <Label>노선 번호 *</Label>
          <input
            value={busRoute}
            onChange={(e) => setBusRoute(e.target.value)}
            placeholder="예: 272, 5511, M7106"
            style={fieldStyle(!!busRoute)}
            inputMode="text"
            autoFocus
          />

          <div style={{ height: 14 }} />

          <Label>정류장 (선택)</Label>
          <input
            value={busStop}
            onChange={(e) => setBusStop(e.target.value)}
            placeholder="예: 신촌오거리, 강남역.강남대로"
            style={fieldStyle(false)}
          />

          {error && (
            <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
          )}

          <div style={{ height: 28 }} />

          <button
            onClick={submitBus}
            disabled={!busRoute.trim() || submitting}
            style={primaryButtonStyle(!!busRoute.trim() && !submitting)}
          >
            {submitting ? '이동 중…' : '투표하러 가기'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Subway wizard sub-component ─────────────────────────────────────

interface SubwayWizardProps {
  line: string | null;
  setLine: (v: string | null) => void;
  car: number | 'unknown' | null;
  setCar: (v: number | 'unknown' | null) => void;
  stationQuery: string;
  setStationQuery: (v: string) => void;
  station: Station | null;
  setStation: (v: Station | null) => void;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
  renderHeader: (title: string) => React.ReactNode;
}

function SubwayWizard({
  line, setLine,
  car, setCar,
  stationQuery, setStationQuery,
  station, setStation,
  submitting, error,
  onBack: _onBack,
  onSubmit,
  renderHeader,
}: SubwayWizardProps) {
  const stationResults = useMemo(() => {
    if (!stationQuery.trim()) return [];
    return searchStations({ query: stationQuery, lineFilter: line, limit: 8 });
  }, [stationQuery, line]);

  const canSubmit = !!line && !!car && !submitting;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {renderHeader('지하철')}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 80px' }}>
        {/* Line picker */}
        <Label>어느 노선 타고 계세요? *</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
          {ALL_LINES.map((l) => {
            const active = line === l;
            return (
              <button
                key={l}
                onClick={() => { setLine(active ? null : l); if (active) setStation(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  background: active ? lineColor(l) : TOKEN.surface,
                  color: active ? '#fff' : TOKEN.text1,
                  border: `1.5px solid ${active ? lineColor(l) : TOKEN.border}`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#fff' : lineColor(l), flexShrink: 0 }} />
                {l}
              </button>
            );
          })}
        </div>

        {/* Car picker */}
        <Label>몇 번 칸이에요? *</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 8 }}>
          {CAR_OPTIONS.map((n) => {
            const active = car === n;
            return (
              <button
                key={n}
                onClick={() => setCar(active ? null : n)}
                style={{
                  padding: '14px 0',
                  background: active ? TOKEN.cold : TOKEN.surface,
                  color: active ? '#fff' : TOKEN.text1,
                  border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
                  borderRadius: TOKEN.r.md,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.12s',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setCar(car === 'unknown' ? null : 'unknown')}
          style={{
            width: '100%',
            padding: '10px',
            background: car === 'unknown' ? TOKEN.text1 : 'transparent',
            color: car === 'unknown' ? '#fff' : TOKEN.text3,
            border: `1px dashed ${car === 'unknown' ? TOKEN.text1 : TOKEN.border}`,
            borderRadius: TOKEN.r.md,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            marginBottom: 24,
          }}
        >
          {car === 'unknown' ? '✓ 칸 모름 (전체 평균)' : '잘 모르겠어요'}
        </button>

        {/* Station (optional) */}
        <Label>지나고 있는 역 <span style={{ fontWeight: 400, color: TOKEN.text3 }}>(선택)</span></Label>
        {station ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              background: TOKEN.coldBg,
              border: `2px solid ${TOKEN.cold}`,
              borderRadius: TOKEN.r.lg,
              marginBottom: 24,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.text1 }}>{station.name}</div>
              <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 2 }}>
                {station.lines.join(' · ')} {station.city ? '· ' + station.city : ''}
              </div>
            </div>
            <button
              onClick={() => { setStation(null); setStationQuery(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: TOKEN.text2, fontSize: 13, fontFamily: FONT }}
            >
              변경
            </button>
          </div>
        ) : (
          <>
            <input
              value={stationQuery}
              onChange={(e) => setStationQuery(e.target.value)}
              placeholder={line ? `${line} 역 검색 (초성도 OK)` : '역 검색 (초성도 OK)'}
              style={fieldStyle(!!stationQuery)}
            />
            {stationResults.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                {stationResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setStation(s); setStationQuery(''); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      background: TOKEN.surface,
                      border: `1px solid ${TOKEN.border}`,
                      borderRadius: TOKEN.r.md,
                      cursor: 'pointer',
                      fontFamily: FONT,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 1 }}>
                        {s.lines.join(' · ')} · {s.city}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!stationResults.length && <div style={{ height: 24 }} />}
          </>
        )}

        {error && (
          <div style={{ marginBottom: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>{error}</div>
        )}

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          style={primaryButtonStyle(canSubmit)}
        >
          {submitting ? '이동 중…' : '투표하러 가기'}
        </button>
      </div>
    </div>
  );
}

// ── Style helpers ───────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
      {children}
    </div>
  );
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
    padding: '16px',
    background: enabled ? TOKEN.cold : TOKEN.border,
    color: '#fff',
    border: 'none',
    borderRadius: TOKEN.r.lg,
    fontSize: 15,
    fontWeight: 700,
    cursor: enabled ? 'pointer' : 'default',
    fontFamily: FONT,
    boxShadow: enabled ? `0 6px 20px ${TOKEN.cold}35` : 'none',
    transition: 'all 0.15s',
  };
}
