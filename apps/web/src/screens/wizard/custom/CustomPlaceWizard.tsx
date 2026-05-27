'use client';

// '다른 장소 찾기' wizard — 2-step (사용자 결정 2026-05-27):
//   Step 1: 검색 (로그인 불요) — 공개(is_public=1) 장소 list/검색.
//   Step 2: 직접 등록 (로그인 가드) — Step 1에서 못 찾으면 'eee직접 등록' 버튼으로 진입.
//   Step 3: 등록 성공 → 공유 화면 (link/QR/인쇄).
//
// 사적 공간(is_public=0)은 검색 안 보이고, 등록 직후 owner의 link/QR로만 공유.

import { useEffect, useState } from 'react';
import { TOKEN, FONT, type PlaceType } from '@aircon/core';
import { api, type PlaceWithCounts } from '../../../lib/apiClient';
import { WizardHeader } from '../WizardHeader';
import { PlaceCard } from '../../../components/PlaceCard';

interface Props {
  onBack: () => void;
  onPicked: (placeId: string) => void;
}

type Phase = 'search' | 'register' | 'success';

const PLACE_TYPE_OPTIONS: { value: PlaceType; label: string }[] = [
  { value: 'office', label: '사무실·매장' },
  { value: 'classroom', label: '강의실·회의실' },
  { value: 'cafe', label: '카페·식당' },
  { value: 'library', label: '도서관·자습실' },
  { value: 'other', label: '기타' },
];

export function CustomPlaceWizard({ onBack, onPicked }: Props) {
  const [phase, setPhase] = useState<Phase>('search');
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  if (phase === 'success' && created) {
    return <SuccessScreen placeId={created.id} placeName={created.name} onGoVote={() => onPicked(created.id)} onBack={onBack} />;
  }

  if (phase === 'register') {
    return (
      <RegisterStep
        onBack={() => setPhase('search')}
        onCreated={(c) => { setCreated(c); setPhase('success'); }}
      />
    );
  }

  return (
    <SearchStep
      onBack={onBack}
      onPickPlace={onPicked}
      onGoRegister={() => setPhase('register')}
    />
  );
}

// ── Step 1: 검색 (로그인 불요) ─────────────────────────────────────

function SearchStep({
  onBack, onPickPlace, onGoRegister,
}: {
  onBack: () => void;
  onPickPlace: (placeId: string) => void;
  onGoRegister: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceWithCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  // 검색 debounce 250ms.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.searchPublicPlaces(q);
        setResults(res.places ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setTouched(true);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="다른 장소 찾기" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 24px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.3, marginBottom: 8 }}>
          어디서 투표할까요?
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6, marginBottom: 20 }}>
          공개된 장소만 보여요. 못 찾으면 아래에서 직접 등록하실 수 있어요.
        </div>

        {/* 검색 input */}
        <div
          style={{
            background: TOKEN.surface, borderRadius: 12, padding: '13px 14px',
            display: 'flex', alignItems: 'center', gap: 9,
            border: `1.5px solid ${TOKEN.border}`, marginBottom: 14,
          }}
        >
          <SearchIcon size={17} color={TOKEN.text3} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="장소 이름 검색 (예: 삼성전자, 스타벅스 강남점)"
            autoFocus
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 14, color: TOKEN.text1, fontFamily: FONT, padding: 0,
            }}
          />
        </div>

        {/* 결과 list */}
        {loading && (
          <div style={{ padding: '20px 0', fontSize: 13, color: TOKEN.text3, textAlign: 'center' }}>
            검색 중…
          </div>
        )}

        {!loading && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {results.map((p) => (
              <PlaceCard key={p.id} place={p} onTap={() => onPickPlace(p.id)} />
            ))}
          </div>
        )}

        {!loading && touched && query.trim() !== '' && results.length === 0 && (
          <div
            style={{
              padding: '24px 16px', background: TOKEN.surface,
              borderRadius: 12, border: `1px solid ${TOKEN.border}`,
              textAlign: 'center', marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6 }}>
              "{query}" 검색 결과가 없어요.<br />
              아직 등록 안 된 장소면 직접 만들 수 있어요.
            </div>
          </div>
        )}

        {/* 직접 등록 row — 검색과 무관하게 항상 노출 (등록 안 된 공간 발견용). */}
        <button
          onClick={onGoRegister}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            background: TOKEN.coldBg,
            border: `1.5px dashed ${TOKEN.cold}55`,
            borderRadius: 12, padding: '14px 16px',
            cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: TOKEN.cold,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: TOKEN.cold, marginBottom: 2 }}>
              내 공간 직접 등록
            </div>
            <div style={{ fontSize: 11, color: TOKEN.text2, lineHeight: 1.4 }}>
              사무실·회의실 등 — link·QR로만 공유돼요 (로그인 필요)
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Step 2: 등록 (로그인 가드) ────────────────────────────────────

type AuthState = 'unknown' | 'logged-in' | 'logged-out';

function RegisterStep({ onBack, onCreated }: { onBack: () => void; onCreated: (c: { id: string; name: string }) => void }) {
  const [authState, setAuthState] = useState<AuthState>('unknown');

  useEffect(() => {
    api.me()
      .then((res) => setAuthState(res.user ? 'logged-in' : 'logged-out'))
      .catch(() => setAuthState('logged-out'));
  }, []);

  if (authState === 'unknown') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
        <WizardHeader title="장소 등록" onBack={onBack} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TOKEN.text3, fontSize: 13 }}>
          로그인 상태 확인 중…
        </div>
      </div>
    );
  }

  if (authState === 'logged-out') {
    return <LoginGate onBack={onBack} />;
  }

  return <RegisterForm onBack={onBack} onCreated={onCreated} />;
}

function LoginGate({ onBack }: { onBack: () => void }) {
  const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/wizard';
  const loginUrl = `/login?next=${encodeURIComponent(here)}`;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="장소 등록" onBack={onBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center', gap: 18 }}>
        <div
          style={{
            width: 64, height: 64, borderRadius: '50%', background: TOKEN.coldBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}
          aria-hidden
        >🔒</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: TOKEN.text1, letterSpacing: '-0.4px', lineHeight: 1.4 }}>
          공간을 등록하려면<br />로그인이 필요해요
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6 }}>
          본인이 등록한 공간만 link·QR로 공유해서<br />
          단체 단위 익명 투표를 받을 수 있어요.
        </div>
        <a
          href={loginUrl}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '14px 28px', background: TOKEN.cold, color: '#fff',
            borderRadius: 12, fontSize: 15, fontWeight: 700, textDecoration: 'none',
            boxShadow: `0 6px 22px ${TOKEN.cold}40`,
          }}
        >
          로그인 페이지로 이동
        </a>
      </div>
    </div>
  );
}

function RegisterForm({ onBack, onCreated }: { onBack: () => void; onCreated: (c: { id: string; name: string }) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PlaceType>('office');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length >= 2 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const res = await api.createUserPlace({
        name: name.trim(),
        type,
        description: description.trim() || null,
      });
      onCreated({ id: res.id, name: res.name });
    } catch (e) {
      setError((e as Error).message);
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="장소 등록" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 16px' }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.3, marginBottom: 8 }}>
          어떤 공간인가요?
        </div>
        <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6, marginBottom: 22 }}>
          내 사무실·회의실·매장 등 자유롭게 등록할 수 있어요.<br />
          link·QR로만 공유되고, 검색에는 노출되지 않아요.
        </div>

        <FieldLabel>공간 이름 *</FieldLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 삼성전자 서초사옥 3층 312호"
          maxLength={60}
          autoFocus
          style={inputStyle}
        />
        <Hint>최대 60자. 2자 이상.</Hint>

        <div style={{ height: 14 }} />
        <FieldLabel>종류 *</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {PLACE_TYPE_OPTIONS.map((opt) => (
            <TypeChip key={opt.value} active={type === opt.value} onClick={() => setType(opt.value)}>
              {opt.label}
            </TypeChip>
          ))}
        </div>

        <div style={{ height: 14 }} />
        <FieldLabel>짧은 설명 (선택)</FieldLabel>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="누구를 위한 공간인지, 어디인지 등 (200자 이내)"
          maxLength={200}
          rows={3}
          style={{ ...inputStyle, height: 'auto', minHeight: 72, resize: 'vertical', fontFamily: FONT }}
        />
        <Hint>{description.length}/200</Hint>

        {error && (
          <div style={{ marginTop: 14, padding: 10, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px 24px', flexShrink: 0 }}>
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '17px 0',
            background: canSubmit ? TOKEN.cold : '#CDD2DA',
            color: canSubmit ? '#fff' : '#A0A8B3',
            border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'default', fontFamily: FONT,
            boxShadow: canSubmit ? `0 6px 24px ${TOKEN.cold}40` : 'none',
          }}
        >
          {submitting ? '등록 중…' : '공간 등록하기'}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: 성공 (link/QR/인쇄) ────────────────────────────────────

function SuccessScreen({
  placeId, placeName, onGoVote, onBack,
}: {
  placeId: string;
  placeName: string;
  onGoVote: () => void;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://aircondemocracy.com';
  const placeUrl = `${origin}/p/${encodeURIComponent(placeId)}`;
  const printUrl = `${origin}/print/${encodeURIComponent(placeId)}`;
  const [QRCode, setQRCode] = useState<typeof import('qrcode.react') | null>(null);
  useEffect(() => {
    import('qrcode.react').then(setQRCode).catch(() => {/* skip */});
  }, []);

  const copyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(placeUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = placeUrl; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: placeName,
          text: `'${placeName}' 에어컨 온도 투표`,
          url: placeUrl,
        });
        return;
      } catch { /* fallback */ }
    }
    void copyLink();
  };

  const downloadQR = () => {
    const svg = document.querySelector('#user-place-qr svg') as SVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `aircon-${placeId.replace(/:/g, '-')}.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${svg64}`;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <WizardHeader title="등록 완료" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: '50%', background: '#F0FDF4',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 10,
            }}
            aria-hidden
          >✓</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px', marginBottom: 6 }}>
            등록됐어요
          </div>
          <div style={{ fontSize: 13, color: TOKEN.text2 }}>{placeName}</div>
        </div>

        <div style={{ background: TOKEN.surface, borderRadius: 16, padding: 18, marginBottom: 14, textAlign: 'center', boxShadow: '0 1px 5px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 12 }}>
            QR 코드
          </div>
          <div id="user-place-qr" style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 12 }}>
            {QRCode ? (
              <QRCode.QRCodeSVG value={placeUrl} size={180} level="M" includeMargin={false} />
            ) : (
              <div style={{ width: 180, height: 180, background: TOKEN.bg }} />
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={downloadQR} style={secondaryButton}>QR 이미지 저장</button>
            <a href={printUrl} target="_blank" rel="noopener noreferrer" style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              인쇄 페이지 열기
            </a>
          </div>
        </div>

        <div style={{ background: TOKEN.surface, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 1px 5px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TOKEN.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
            공유 link
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div
              style={{
                flex: 1, padding: '10px 12px', background: TOKEN.bg, borderRadius: 8,
                fontSize: 12, color: TOKEN.text2, fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {placeUrl}
            </div>
            <button onClick={copyLink} style={secondaryButton}>{copied ? '복사됨 ✓' : '복사'}</button>
          </div>
          <button onClick={share} style={{ ...primaryButton, width: '100%', marginTop: 10 }}>
            공유하기
          </button>
        </div>

        <div style={{ fontSize: 12, color: TOKEN.text3, lineHeight: 1.6, padding: '0 4px' }}>
          📌 검색에 노출되지 않아요. link 또는 QR로만 접근 가능.<br />
          📌 인쇄 페이지를 출력해 카페·식당에 비치하면 손님이 QR 스캔으로 바로 투표.
        </div>
      </div>
      <div style={{ padding: '0 16px 24px', flexShrink: 0 }}>
        <button onClick={onGoVote} style={{ ...primaryButton, width: '100%' }}>
          {placeName}에서 투표하기
        </button>
      </div>
    </div>
  );
}

// ── UI 헬퍼 ──────────────────────────────────────────────────────

function SearchIcon({ size = 17, color = '#A0A0AE' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2" />
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px',
  background: TOKEN.surface,
  border: `1.5px solid ${TOKEN.border}`,
  borderRadius: 12, fontSize: 15, color: TOKEN.text1,
  fontFamily: FONT, outline: 'none',
};

const primaryButton: React.CSSProperties = {
  padding: '13px 22px', background: TOKEN.cold, color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
  cursor: 'pointer', fontFamily: FONT,
  boxShadow: `0 4px 14px ${TOKEN.cold}30`,
};

const secondaryButton: React.CSSProperties = {
  padding: '9px 14px', background: TOKEN.bg, color: TOKEN.text2,
  border: `1px solid ${TOKEN.border}`, borderRadius: 8, fontSize: 12,
  cursor: 'pointer', fontFamily: FONT, fontWeight: 600,
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: TOKEN.text3, marginTop: 6 }}>{children}</div>;
}

function TypeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 8px',
        background: active ? TOKEN.cold : TOKEN.surface,
        color: active ? '#fff' : TOKEN.text1,
        border: `1.5px solid ${active ? TOKEN.cold : TOKEN.border}`,
        borderRadius: 12, fontSize: 13, fontWeight: 700,
        cursor: 'pointer', fontFamily: FONT,
      }}
    >
      {children}
    </button>
  );
}
