import { useEffect, useState } from 'react';
import { TOKEN, FONT } from '../lib/tokens';
import { PLACES, type Place } from '../lib/places';

interface Props {
  onBack: () => void;
  onSuccess: (place: Place) => void;
}

function QRScanFrame() {
  return (
    <svg width={220} height={220} viewBox="0 0 220 220" style={{ display: 'block', margin: '0 auto' }}>
      <rect width="220" height="220" fill="rgba(0,0,0,0.35)" />
      <rect x="15" y="15" width="190" height="190" fill="transparent" />
      <path d="M45 15 L15 15 L15 45" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M175 15 L205 15 L205 45" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M15 175 L15 205 L45 205" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M205 175 L205 205 L175 205" stroke="white" strokeWidth="4" strokeLinecap="round" fill="none" />
      <line x1="20" y1="110" x2="200" y2="110" stroke={TOKEN.cold} strokeWidth="2.5" strokeLinecap="round" opacity="0.95">
        <animateTransform attributeName="transform" type="translate" values="0,-88;0,88;0,-88" dur="2.4s" repeatCount="indefinite" />
      </line>
      <line x1="20" y1="110" x2="200" y2="110" stroke={TOKEN.cold} strokeWidth="8" strokeLinecap="round" opacity="0.15">
        <animateTransform attributeName="transform" type="translate" values="0,-88;0,88;0,-88" dur="2.4s" repeatCount="indefinite" />
      </line>
    </svg>
  );
}

export function QRScreen({ onBack, onSuccess }: Props) {
  const [phase, setPhase] = useState<'scanning' | 'found'>('scanning');
  const [foundPlace, setFoundPlace] = useState<Place | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFoundPlace(PLACES[0]);
      setPhase('found');
    }, 2400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ height: '100%', background: '#0D0D13', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '68px 20px 16px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          aria-label="뒤로"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, fontWeight: 700 }}>QR 코드 스캔</span>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        {phase === 'scanning' && (
          <div style={{ textAlign: 'center' }}>
            <QRScanFrame />
            <div style={{ marginTop: 24 }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 600 }}>QR 코드를 프레임 안에</div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 5 }}>위치시켜 주세요</div>
            </div>
          </div>
        )}

        {phase === 'found' && foundPlace && (
          <div style={{ textAlign: 'center', padding: '0 24px', animation: 'fadeUp 0.4s ease' }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: TOKEN.ok,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 22px',
                boxShadow: `0 12px 40px ${TOKEN.ok}50`,
              }}
            >
              <svg width={38} height={38} viewBox="0 0 24 24" fill="none">
                <path d="M4.5 12.5l5 5L19.5 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 900, marginBottom: 8 }}>장소를 찾았어요!</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 36, lineHeight: 1.5 }}>{foundPlace.name}</div>
            <button
              onClick={() => onSuccess(foundPlace)}
              style={{
                padding: '16px 52px',
                background: TOKEN.cold,
                color: 'white',
                border: 'none',
                borderRadius: TOKEN.r.xl,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                boxShadow: `0 10px 36px ${TOKEN.cold}55`,
              }}
            >
              투표하러 가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
