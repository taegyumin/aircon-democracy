'use client';

import { useEffect, useState } from 'react';
import { LocateFixed, Star, ScanLine } from 'lucide-react';
import { TOKEN, FONT } from '@aircon/core';
import { api, type PlaceWithCounts } from '../lib/apiClient';
import { useUser } from '../lib/useUser';
import { getRecent, type RecentPlace } from '../lib/recentPlaces';
import { listFavorites, type FavoritePlace } from '../lib/favorites';
import { PlaceCard } from '../components/PlaceCard';
import { QuickVoteCard } from '../components/QuickVoteCard';

interface Props {
  onSelectPlace: (id: string) => void;
  onWizard: () => void;
  onSearch: () => void;
  onQR: () => void;
  onLogin?: () => void;
  // Server-fetched 인기 장소 list. RSC가 D1에서 가져와서 첫 HTML에 박음 (SEO + LCP).
  // 없으면 client에서 fetch (fallback — D1 binding 없는 환경 등).
  initialPlaces?: PlaceWithCounts[];
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

// SSR 이후 client refetch까지 두면 같은 LEFT JOIN GROUP BY가 1~2번 돔 (LLM 리뷰 P1/P2).
// initialPlaces가 있으면 STALE_WINDOW_MS 동안 refetch skip — SSR 결과 신뢰.
// window 지나면 background refetch로 갱신.
const STALE_WINDOW_MS = 30_000;

export function HomeScreen({ onSelectPlace, onWizard, onSearch: _onSearch, onQR, onLogin, initialPlaces }: Props) {
  const [places, setPlaces] = useState<PlaceWithCounts[] | null>(initialPlaces ?? null);
  const [error, setError] = useState<string | null>(null);
  const { user, logout } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent] = useState<RecentPlace[]>(() => getRecent(5));
  const [favorites] = useState<FavoritePlace[]>(() => listFavorites());

  useEffect(() => {
    // SSR이 30초 안에 fresh data 줬으면 immediate refetch skip — D1 read 절약.
    // initialPlaces 없으면 (D1 read 실패 fallback, dev 환경 등) 즉시 fetch.
    if (initialPlaces && initialPlaces.length > 0) {
      const refreshAfter = setTimeout(() => {
        api.listPlaces()
          .then((res) => setPlaces(res.places))
          .catch((e: Error) => setError(e.message));
      }, STALE_WINDOW_MS);
      return () => clearTimeout(refreshAfter);
    }
    let cancelled = false;
    api.listPlaces()
      .then((res) => { if (!cancelled) setPlaces(res.places); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [initialPlaces]);

  const active = places?.filter((p) => p.cold + p.ok + p.hot > 0) ?? [];

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
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                if (user) setMenuOpen((v) => !v);
                else onLogin?.();
              }}
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
                padding: 0,
                overflow: 'hidden',
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
                  position: 'absolute',
                  right: 0,
                  top: 42,
                  minWidth: 180,
                  background: TOKEN.surface,
                  border: `1px solid ${TOKEN.border}`,
                  borderRadius: TOKEN.r.md,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  padding: '8px 0',
                }}
              >
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${TOKEN.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: TOKEN.text1 }}>{user.display_name ?? '사용자'}</div>
                  <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 2 }}>{user.provider}</div>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    fontSize: 13,
                    color: TOKEN.text1,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONT,
                  }}
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 20px 16px' }}>
          <button
            onClick={onWizard}
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
            aria-label="QR 코드 스캔"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            <ScanLine size={22} color="#fff" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 80px' }}>
        {/* Primary CTA: location wizard — ALWAYS top (under search bar) */}
        <button
          onClick={onWizard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            width: '100%',
            padding: '18px 18px',
            background: TOKEN.cold,
            border: 'none',
            borderRadius: TOKEN.r.lg,
            cursor: 'pointer',
            fontFamily: FONT,
            color: '#fff',
            boxShadow: `0 8px 24px ${TOKEN.cold}40`,
            marginBottom: 22,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LocateFixed size={20} color="#fff" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.4px' }}>지금 어디 계세요?</div>
          </div>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Favorites: pinned places */}
        {favorites.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
              <span>고정한 장소</span>
            </div>
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

        {/* QuickVote: recently voted places with inline vote buttons */}
        {recent.filter((r) => !favorites.find((f) => f.id === r.id)).length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TOKEN.text2, marginBottom: 10, letterSpacing: '0.3px' }}>
              최근 투표한 곳
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.filter((r) => !favorites.find((f) => f.id === r.id)).map((p) => (
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

        {error && (
          <div style={{ padding: 14, background: TOKEN.hotBg, color: TOKEN.hot, borderRadius: TOKEN.r.md, fontSize: 13, marginBottom: 16 }}>
            장소를 불러오지 못했어요: {error}
          </div>
        )}

        {!places && !error && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: TOKEN.text3, fontSize: 13 }}>
            불러오는 중…
          </div>
        )}

        {active.length > 0 && (
          <>
            <SectionHeader icon="location" label="지금 의견이 모이고 있어요" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {active.map((p) => (
                <PlaceCard key={p.id} place={p} onTap={() => onSelectPlace(p.id)} />
              ))}
            </div>
          </>
        )}

        {/* 2026-05-27: '장소가 없나요? 직접 등록하기' CTA 제거. 사용자 피드백: 메인에서
            아직 탐색도 안 했는데 '없냐'고 묻는 게 어색. 등록은 wizard → 다른 장소 찾기
            (custom)로 흐름 통합. */}
      </div>
    </div>
  );
}
