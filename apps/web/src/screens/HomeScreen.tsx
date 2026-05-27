'use client';

// Home Redesign v2 — Claude Design 권장안 적용 (2026-05-27).
// 구조:
//   1. 헤더 (로고 + QR + 사용자)
//   2. (선택) 즐겨찾기 — pinned places, inline vote
//   3. (선택) 최근 방문 — recent voted, inline vote
//   4. 헤드라인 "지금 어디 계세요?" + 부제
//   5. 카테고리 picker (TransitGroup + PlacesGroup + 다른 장소 찾기)
//
// 의도적으로 제거:
//   - 통합 검색바 (디자인에 없음 + Place Select Redesign에서도 제거된 결정)
//   - 큰 "지금 어디 계세요?" CTA (카테고리 picker가 직접 노출되니 중복)
//   - "지금 의견이 모이고 있어요" SSR 인기 장소 list — 디자인은 favorites/recents
//     기반 재방문에 집중 (initialPlaces prop은 호환성 유지로 receive만).

import { useState } from 'react';
import { ScanLine, Star } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import type { PlaceWithCounts } from '../lib/apiClient';
import { useUser } from '../lib/useUser';
import { getRecent, type RecentPlace } from '../lib/recentPlaces';
import { listFavorites, type FavoritePlace } from '../lib/favorites';
import { QuickVoteCard } from '../components/QuickVoteCard';
import { CategoryPicker } from './wizard/CategoryPicker';
import type { Category } from './wizard/categories';

interface Props {
  onSelectPlace: (id: string) => void;
  onWizard: (cat?: Category) => void;
  onQR: () => void;
  onLogin?: () => void;
  // SSR이 D1에서 가져왔지만 v2 디자인은 인기 장소 list를 노출하지 않음.
  // 호환성 유지로 prop는 받되 무시. RSC 호출자 정리할 때 같이 빼면 됨.
  initialPlaces?: PlaceWithCounts[];
}

export function HomeScreen({ onSelectPlace, onWizard, onQR, onLogin }: Props) {
  const { user, logout } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent] = useState<RecentPlace[]>(() => getRecent(5));
  const [favorites] = useState<FavoritePlace[]>(() => listFavorites());
  const recentExFaves = recent.filter((r) => !favorites.find((f) => f.id === r.id));
  const hasReturning = favorites.length > 0 || recentExFaves.length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: TOKEN.surface, paddingTop: 62, flexShrink: 0, borderBottom: `1px solid ${TOKEN.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 16px 14px' }}>
          <img src="/icon.png" alt="" style={{ width: 30, height: 30, borderRadius: 8 }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              에어컨 민주주의
            </div>
            <div style={{ fontSize: 9, color: TOKEN.text3, letterSpacing: '1.8px', marginTop: 1 }}>AIRCON DEMOCRACY</div>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onQR}
            aria-label="QR 코드 스캔"
            style={{
              width: 38, height: 38, background: TOKEN.cold, borderRadius: 10, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              marginRight: 4,
            }}
          >
            <ScanLine size={18} color="#fff" strokeWidth={2.2} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (user) setMenuOpen((v) => !v);
                else onLogin?.();
              }}
              style={{
                background: TOKEN.bg, border: `1px solid ${TOKEN.border}`, borderRadius: '50%',
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0, overflow: 'hidden',
              }}
              aria-label={user ? '계정 메뉴' : '로그인'}
            >
              {user?.profile_image_url ? (
                <img src={user.profile_image_url} alt="" width={34} height={34} style={{ display: 'block', objectFit: 'cover' }} />
              ) : (
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke={TOKEN.text3} strokeWidth="1.8" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={TOKEN.text3} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
            {user && menuOpen && (
              <div
                style={{
                  position: 'absolute', right: 0, top: 42, minWidth: 180,
                  background: TOKEN.surface, border: `1px solid ${TOKEN.border}`,
                  borderRadius: TOKEN.r.md, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 100, padding: '8px 0',
                }}
              >
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${TOKEN.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{user.display_name ?? '사용자'}</div>
                  <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 2 }}>{user.provider}</div>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                    fontSize: 13, color: TOKEN.text1, cursor: 'pointer', textAlign: 'left', fontFamily: FONT,
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 60px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* 즐겨찾기 */}
        {favorites.length > 0 && (
          <div>
            <SectionHeader icon="star" label="즐겨찾기" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {favorites.slice(0, 3).map((f) => (
                <QuickVoteCard
                  key={f.id}
                  place={{ id: f.id, name: f.name, type: f.type, district: f.district, lastVoteAt: f.pinnedAt }}
                  onVoted={(id) => onSelectPlace(id)}
                  onOpen={(id) => onSelectPlace(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 최근 방문 */}
        {recentExFaves.length > 0 && (
          <div>
            <SectionHeader icon="clock" label="최근 방문" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentExFaves.map((p) => (
                <QuickVoteCard
                  key={p.id}
                  place={p}
                  onVoted={(id) => onSelectPlace(id)}
                  onOpen={(id) => onSelectPlace(id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 구분선 — 재방문 컨텍스트가 있을 때만 */}
        {hasReturning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: TOKEN.border }} />
            <span style={{ fontSize: 12, color: TOKEN.text3, fontWeight: 500 }}>다른 장소 찾기</span>
            <div style={{ flex: 1, height: 1, background: TOKEN.border }} />
          </div>
        )}

        {/* 헤드라인 — 첫 방문이면 강조, 재방문이면 카테고리 그리드 위 가벼운 안내 */}
        {!hasReturning && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, letterSpacing: '-0.5px', lineHeight: 1.35, marginBottom: 6 }}>
              지금 어디 계세요?
            </div>
            <div style={{ fontSize: 13, color: TOKEN.text2, lineHeight: 1.6 }}>
              장소 유형을 고르면 바로 투표할 수 있어요
            </div>
          </div>
        )}

        {/* 카테고리 picker — 탭 시 wizard로 cat 파라미터 전달 */}
        <CategoryPicker onPick={(k) => onWizard(k)} />
      </div>
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: 'star' | 'clock'; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {icon === 'star' && <Star size={13} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />}
      {icon === 'clock' && (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={TOKEN.text3} strokeWidth="1.8" />
          <path d="M12 7v5l3 3" stroke={TOKEN.text3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, letterSpacing: '0.3px' }}>{label}</span>
    </div>
  );
}
