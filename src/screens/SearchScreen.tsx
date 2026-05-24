import { useState } from 'react';
import { TOKEN, FONT } from '../lib/tokens';
import { PLACES, type Place } from '../lib/places';
import { PlaceCard } from '../components/PlaceCard';
import { BackIcon } from '../components/Icons';

interface Props {
  onBack: () => void;
  onSelectPlace: (p: Place) => void;
  onRegister: () => void;
}

export function SearchScreen({ onBack, onSelectPlace, onRegister }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(true);

  const chips = ['강의실', '지하철', '도서관', '카페', '버스'];

  const filtered = query.trim()
    ? PLACES.filter((p) => p.name.includes(query) || p.district.includes(query) || p.type.includes(query))
    : [];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px 14px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="뒤로"
          >
            <BackIcon />
          </button>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: TOKEN.bg,
              borderRadius: TOKEN.r.lg,
              padding: '10px 14px',
              border: `2px solid ${focused ? TOKEN.cold : 'transparent'}`,
              transition: 'border-color 0.18s',
            }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke={TOKEN.text3} strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke={TOKEN.text3} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="장소 또는 건물 이름 검색"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                color: TOKEN.text1,
                fontFamily: FONT,
                minWidth: 0,
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: TOKEN.text3,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="검색어 지우기"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>
        {!query && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>빠른 검색</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              {chips.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  style={{
                    padding: '8px 14px',
                    background: TOKEN.surface,
                    border: `1px solid ${TOKEN.border}`,
                    borderRadius: 999,
                    fontSize: 13,
                    color: TOKEN.text1,
                    cursor: 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>모든 장소</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PLACES.map((p) => (
                <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p)} />
              ))}
            </div>
          </>
        )}

        {query && filtered.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: TOKEN.text3, marginBottom: 10 }}>"{query}" 결과 {filtered.length}개</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((p) => (
                <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p)} />
              ))}
            </div>
          </>
        )}

        {query && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '52px 20px 0' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: TOKEN.r.xl,
                background: TOKEN.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
              }}
            >
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke={TOKEN.text3} strokeWidth="1.8" />
                <path d="M21 21l-4.35-4.35" stroke={TOKEN.text3} strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8.5 11h5M11 8.5v5" stroke={TOKEN.text3} strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text2, marginBottom: 8 }}>"{query}" 장소를 찾지 못했어요</div>
            <div style={{ fontSize: 13, color: TOKEN.text3, marginBottom: 28, lineHeight: 1.6 }}>
              다른 이름으로 검색하거나<br />새 장소를 등록해보세요
            </div>
            <button
              onClick={onRegister}
              style={{
                padding: '13px 28px',
                background: TOKEN.cold,
                color: '#fff',
                border: 'none',
                borderRadius: TOKEN.r.lg,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: FONT,
                boxShadow: `0 4px 16px ${TOKEN.cold}30`,
              }}
            >
              + 장소 등록하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
