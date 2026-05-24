import { useState } from 'react';
import { GraduationCap, Library, Coffee, TrainFront, Bus, Building2, Printer } from 'lucide-react';
import { PlaceQR } from '../components/PlaceQR';
import type { LucideIcon } from 'lucide-react';
import { TOKEN, FONT } from '../lib/tokens';
import { api } from '../lib/api';
import type { PlaceType } from '../lib/places';
import { BackIcon } from '../components/Icons';

interface Props {
  onBack: () => void;
  onComplete: (placeId: string) => void;
  onPrint?: (placeId: string) => void;
  initialType?: PlaceType;
}

const TYPE_OPTIONS: { k: PlaceType; Icon: LucideIcon; tint: string; label: string }[] = [
  { k: 'classroom', Icon: GraduationCap, tint: '#7C3AED', label: '강의실/세미나실' },
  { k: 'library',   Icon: Library,       tint: '#0891B2', label: '도서관' },
  { k: 'cafe',      Icon: Coffee,        tint: '#A16207', label: '카페/식당' },
  { k: 'subway',    Icon: TrainFront,    tint: '#1B53E5', label: '지하철' },
  { k: 'bus',       Icon: Bus,           tint: '#16A34A', label: '버스' },
  { k: 'office',    Icon: Building2,     tint: '#475569', label: '사무실' },
];


export function RegisterScreen({ onBack, onComplete, onPrint, initialType }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(initialType ? 2 : 1);
  const [type, setType] = useState<PlaceType | null>(initialType ?? null);
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [district, setDistrict] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const stepLabels = ['유형 선택', '이름 입력', '등록 완료'];
  const sel = TYPE_OPTIONS.find((o) => o.k === type);

  const submit = async () => {
    if (!type || !name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createPlace({
        name: name.trim(),
        type,
        district: district.trim() || undefined,
        detail: detail.trim() || undefined,
      });
      setCreatedId(created.id);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <div style={{ padding: '0 0 24px' }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.4px' }}>
            어떤 공간인가요?
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 22, lineHeight: 1.5 }}>
            유형을 선택하면 검색에서 더 잘 찾을 수 있어요
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {TYPE_OPTIONS.map((o) => {
              const Icon = o.Icon;
              const active = type === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => {
                    setType(o.k);
                    setTimeout(() => setStep(2), 180);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 10,
                    padding: '14px 12px',
                    borderRadius: TOKEN.r.lg,
                    border: `2px solid ${active ? TOKEN.cold : TOKEN.border}`,
                    background: active ? TOKEN.coldBg : TOKEN.surface,
                    cursor: 'pointer',
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                    transform: active ? 'scale(1.02)' : 'scale(1)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: o.tint + (active ? '22' : '15'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color={o.tint} strokeWidth={2.1} />
                  </div>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: active ? TOKEN.cold : TOKEN.text1,
                      letterSpacing: '-0.2px',
                      lineHeight: 1.25,
                      textAlign: 'left',
                    }}
                  >
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div>
          <button
            onClick={() => setStep(1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, padding: 0 }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke={TOKEN.text3} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 12, color: TOKEN.text3, fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {sel && <sel.Icon size={13} color={sel.tint} strokeWidth={2.2} />}
              {sel?.label}
            </span>
          </button>
          <div style={{ fontSize: 19, fontWeight: 900, color: TOKEN.text1, marginBottom: 22, letterSpacing: '-0.4px' }}>
            장소 이름을 알려주세요
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, display: 'block', marginBottom: 8 }}>장소 이름 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 공학관 302호 강의실"
              style={{
                width: '100%',
                padding: '13px 14px',
                border: `2px solid ${name ? TOKEN.cold : TOKEN.border}`,
                borderRadius: TOKEN.r.md,
                fontSize: 14,
                fontFamily: FONT,
                color: TOKEN.text1,
                background: TOKEN.bg,
                outline: 'none',
                transition: 'border-color 0.18s',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, display: 'block', marginBottom: 8 }}>지역 (선택)</label>
            <input
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="예: 관악구"
              style={{
                width: '100%',
                padding: '13px 14px',
                border: `2px solid ${TOKEN.border}`,
                borderRadius: TOKEN.r.md,
                fontSize: 14,
                fontFamily: FONT,
                color: TOKEN.text1,
                background: TOKEN.bg,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, display: 'block', marginBottom: 8 }}>추가 설명 (선택)</label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="예: 2층 복도 끝, 3번 출구 앞"
              style={{
                width: '100%',
                padding: '13px 14px',
                border: `2px solid ${TOKEN.border}`,
                borderRadius: TOKEN.r.md,
                fontSize: 14,
                fontFamily: FONT,
                color: TOKEN.text1,
                background: TOKEN.bg,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
              등록 실패: {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={!name.trim() || submitting}
            style={{
              width: '100%',
              padding: '16px',
              background: name.trim() && !submitting ? TOKEN.cold : TOKEN.border,
              color: '#fff',
              border: 'none',
              borderRadius: TOKEN.r.lg,
              fontSize: 15,
              fontWeight: 700,
              cursor: name.trim() && !submitting ? 'pointer' : 'default',
              fontFamily: FONT,
              transition: 'background 0.18s',
              boxShadow: name.trim() && !submitting ? `0 6px 20px ${TOKEN.cold}35` : 'none',
            }}
          >
            {submitting ? '등록 중…' : '장소 등록하기'}
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: TOKEN.okBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            boxShadow: `0 8px 28px ${TOKEN.ok}25`,
          }}
        >
          <svg width={34} height={34} viewBox="0 0 24 24" fill="none">
            <path d="M4.5 12.5l5 5L19.5 7" stroke={TOKEN.ok} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, textAlign: 'center', letterSpacing: '-0.4px' }}>
          "{name}" 등록 완료!
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, marginBottom: 28, textAlign: 'center', lineHeight: 1.6 }}>
          다른 사람들도 이 장소를 검색할 수 있어요.<br />바로 투표해볼까요?
        </div>

        <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.lg, padding: 16, marginBottom: 16, alignSelf: 'stretch' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 12 }}>
            🎯 이 장소의 QR — 매장에 부착하면 손님들이 바로 투표 가능
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {createdId && <PlaceQR placeId={createdId} size={120} showDownload />}
            <div style={{ fontSize: 11, color: TOKEN.text3, lineHeight: 1.6, flex: 1 }}>
              인쇄용 페이지에서 A4로 출력해 카운터·벽에 붙이세요. 손님이 폰 카메라로 비추면 바로 투표 화면 열려요.
            </div>
          </div>
          {createdId && onPrint && (
            <button
              onClick={() => onPrint(createdId)}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px',
                background: TOKEN.text1,
                color: '#fff',
                border: 'none',
                borderRadius: TOKEN.r.md,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Printer size={14} color="#fff" /> 인쇄용 페이지 열기 (A4)
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignSelf: 'stretch' }}>
          <button
            onClick={() => createdId && onComplete(createdId)}
            disabled={!createdId}
            style={{
              width: '100%',
              padding: '15px',
              background: TOKEN.cold,
              color: '#fff',
              border: 'none',
              borderRadius: TOKEN.r.lg,
              fontSize: 15,
              fontWeight: 700,
              cursor: createdId ? 'pointer' : 'default',
              fontFamily: FONT,
              boxShadow: `0 6px 20px ${TOKEN.cold}35`,
              opacity: createdId ? 1 : 0.5,
            }}
          >
            지금 바로 투표하기
          </button>
          <button
            onClick={onBack}
            style={{
              width: '100%',
              padding: '15px',
              background: 'none',
              color: TOKEN.text2,
              border: `1px solid ${TOKEN.border}`,
              borderRadius: TOKEN.r.lg,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 10px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }} aria-label="뒤로">
            <BackIcon />
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>장소 등록</span>
        </div>

        {step < 3 && (
          <div style={{ padding: '6px 20px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
            {stepLabels.map((l, i) => (
              <div
                key={l}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: i < stepLabels.length - 1 ? 1 : 'none',
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: i + 1 <= step ? TOKEN.cold : TOKEN.border,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1 < step ? (
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                        <path d="M4 12l6 6L20 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: i + 1 === step ? '#fff' : TOKEN.text3 }}>{i + 1}</span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: i + 1 === step ? TOKEN.cold : TOKEN.text3,
                      fontWeight: i + 1 === step ? 700 : 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {l}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      minWidth: 8,
                      height: 1,
                      background: i + 1 < step ? TOKEN.cold : TOKEN.border,
                      transition: 'background 0.3s',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 60px' }}>
        <div key={step} style={{ animation: 'fadeUp 0.22s ease' }}>{renderStep()}</div>
      </div>
    </div>
  );
}
