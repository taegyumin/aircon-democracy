import { TOKEN, FONT } from '../lib/tokens';
import { PLACES, type Place } from '../lib/places';
import { PlaceCard } from '../components/PlaceCard';

interface Props {
  onSelectPlace: (p: Place) => void;
  onSearch: () => void;
  onQR: () => void;
  onRegister: () => void;
}

function SectionHeader({ icon, label }: { icon: 'location' | 'clock'; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {icon === 'location' && (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4" fill={TOKEN.cold} />
          <circle cx="12" cy="12" r="9" stroke={TOKEN.cold} strokeWidth="1.5" strokeDasharray="4 2" />
        </svg>
      )}
      {icon === 'clock' && (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={TOKEN.text2} strokeWidth="1.8" />
          <path d="M12 7v5l3 3" stroke={TOKEN.text2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, letterSpacing: '0.3px' }}>{label}</span>
    </div>
  );
}

export function HomeScreen({ onSelectPlace, onSearch, onQR, onRegister }: Props) {
  const nearby = PLACES.slice(0, 3);
  const recent = PLACES.slice(3, 6);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, flexShrink: 0, borderBottom: `1px solid ${TOKEN.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 4px' }}>
          <img src="/icon.png" alt="" style={{ width: 34, height: 34, borderRadius: 9 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              에어컨 민주주의
            </div>
            <div style={{ fontSize: 9, color: TOKEN.text3, letterSpacing: '1.8px', marginTop: 1 }}>AIRCON DEMOCRACY</div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            style={{
              background: TOKEN.bg,
              border: 'none',
              borderRadius: 999,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="프로필"
          >
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke={TOKEN.text3} strokeWidth="1.8" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={TOKEN.text3} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 20px 16px' }}>
          <button
            onClick={onSearch}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 16px',
              background: TOKEN.bg,
              borderRadius: TOKEN.r.lg,
              cursor: 'pointer',
              border: 'none',
              textAlign: 'left',
              fontFamily: FONT,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke={TOKEN.text3} strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke={TOKEN.text3} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 14, color: TOKEN.text3 }}>장소 이름 또는 건물 검색</span>
          </button>
          <button
            onClick={onQR}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: '0 16px',
              background: TOKEN.cold,
              borderRadius: TOKEN.r.lg,
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              minWidth: 58,
              fontFamily: FONT,
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
              <path d="M14 14h2v2h-2zM18 14v2h2M14 18h2v2M20 18v2h-2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: 700 }}>QR</span>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 80px' }}>
        <SectionHeader icon="location" label="내 주변" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {nearby.map((p) => (
            <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p)} />
          ))}
        </div>

        <SectionHeader icon="clock" label="최근 방문" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {recent.map((p) => (
            <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p)} />
          ))}
        </div>

        <button
          onClick={onRegister}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '14px 16px',
            background: TOKEN.coldBg,
            border: `1.5px dashed ${TOKEN.cold}55`,
            borderRadius: TOKEN.r.lg,
            cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: TOKEN.r.md,
              background: TOKEN.cold,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.cold }}>장소가 없나요? 직접 등록하기</div>
            <div style={{ fontSize: 11, color: TOKEN.text2, marginTop: 2 }}>등록하면 QR 코드도 바로 받을 수 있어요</div>
          </div>
        </button>
      </div>
    </div>
  );
}
