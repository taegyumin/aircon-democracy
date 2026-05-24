import { useState } from 'react';
import { TOKEN, FONT } from '../lib/tokens';
import { api } from '../lib/api';
import type { PlaceType } from '../lib/places';
import { BackIcon } from '../components/Icons';

interface Props {
  onBack: () => void;
  onComplete: (placeId: string) => void;
  initialType?: PlaceType;
}

const TYPE_OPTIONS: { k: PlaceType; icon: string; label: string }[] = [
  { k: 'classroom', icon: '🏫', label: '강의실/세미나실' },
  { k: 'library', icon: '📚', label: '도서관' },
  { k: 'cafe', icon: '☕', label: '카페/식당' },
  { k: 'subway', icon: '🚇', label: '지하철' },
  { k: 'bus', icon: '🚌', label: '버스' },
  { k: 'office', icon: '🏢', label: '사무실' },
];

function MiniQR() {
  const cells = 9;
  const cs = 6;
  const size = cells * cs;
  const dataDots: [number, number][] = [
    [0, 7], [0, 8], [1, 7], [2, 7], [2, 8], [3, 8], [4, 7], [5, 8], [6, 7], [6, 8],
    [7, 0], [7, 1], [7, 3], [7, 5], [8, 0], [8, 2], [8, 4], [8, 6], [8, 8],
  ];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, border: `1px solid ${TOKEN.border}`, borderRadius: 6 }}>
      <rect width={size} height={size} fill="white" />
      {[0, 1, 2, 3, 4, 5, 6].flatMap((r) =>
        [0, 1, 2, 3, 4, 5, 6].map((c) => {
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          if (border || inner) {
            return <rect key={`tl${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill={TOKEN.text1} />;
          }
          return null;
        })
      )}
      {dataDots.map(([r, c]) => (
        <rect key={`d${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill={TOKEN.text1} />
      ))}
    </svg>
  );
}

export function RegisterScreen({ onBack, onComplete, initialType }: Props) {
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
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.k}
                onClick={() => {
                  setType(o.k);
                  setTimeout(() => setStep(2), 180);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  padding: '15px 14px',
                  borderRadius: TOKEN.r.lg,
                  border: `2px solid ${type === o.k ? TOKEN.cold : TOKEN.border}`,
                  background: type === o.k ? TOKEN.coldBg : TOKEN.surface,
                  cursor: 'pointer',
                  fontFamily: FONT,
                  transition: 'all 0.15s',
                  transform: type === o.k ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 22 }}>{o.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: type === o.k ? TOKEN.cold : TOKEN.text1, letterSpacing: '-0.2px' }}>
                  {o.label}
                </span>
              </button>
            ))}
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
            <span style={{ fontSize: 12, color: TOKEN.text3, fontFamily: FONT }}>
              {sel?.icon} {sel?.label}
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

        <div style={{ background: TOKEN.surface, borderRadius: TOKEN.r.lg, padding: 16, marginBottom: 24, alignSelf: 'stretch' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 12 }}>QR 코드 — 다른 사람과 공유하세요</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <MiniQR />
            <div>
              <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.6 }}>
                QR을 스캔하면 바로 투표 화면으로 이동해요. (실제 QR 생성은 다음 업데이트에서)
              </div>
            </div>
          </div>
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
