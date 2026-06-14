// 디자인 토큰 — 웹·모바일 공유 SSOT (DESIGN.md). 색·radius·타입스케일·스페이스·elevation.
// 하드코딩 색/숫자는 여기서만. 화면 코드는 TOKEN/TYPE/SPACE/ELEVATION을 import해서 쓴다.

export const TOKEN = {
  // 의미색 (브랜드의 핵심 — 추워요/적당해요/더워요)
  hot: '#E52B1E',
  cold: '#1B53E5',
  ok: '#16A34A',
  hotBg: '#FFF1F0',
  coldBg: '#EFF4FF',
  okBg: '#F0FDF4',
  // 중립 — 따뜻한 off-white canvas (Thermal Civic: cold/hot 액센트가 POP하도록). web+mobile 공유.
  bg: '#F6F5F1',
  surface: '#FFFFFF',
  surface2: '#F8F7F4',
  text1: '#1A1A1F',
  text2: '#6B6B7A',
  text3: '#A0A0AE',
  border: '#E7E5DF',
  r: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 },
} as const;

// ── 타입 스케일 (8단계) ──────────────────────────────────────────────
// 한글(Pretendard) 기준: 본문 letterSpacing 0 (음수 자간은 큰 글씨/접근성 크기에서 뭉침),
// display/title만 미세 음수. lineHeight는 한글 가독 위해 넉넉히. 굵기 강조는 <AppText weight>로.
export const TYPE = {
  display: { fontSize: 30, fontWeight: '800', lineHeight: 38, letterSpacing: -0.6 },
  title:   { fontSize: 22, fontWeight: '800', lineHeight: 29, letterSpacing: -0.4 },
  title2:  { fontSize: 18, fontWeight: '700', lineHeight: 24, letterSpacing: -0.2 },
  bodyLg:  { fontSize: 16, fontWeight: '600', lineHeight: 24, letterSpacing: 0 },
  body:    { fontSize: 15, fontWeight: '500', lineHeight: 22, letterSpacing: 0 },
  label:   { fontSize: 13, fontWeight: '600', lineHeight: 18, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0 },
  micro:   { fontSize: 11, fontWeight: '700', lineHeight: 14, letterSpacing: 0.3 },
} as const;

export type TypeVariant = keyof typeof TYPE;
// weight modifier — variant는 그대로 두고 굵기만 (variant 폭증 방지)
export const WEIGHT = { regular: '500', medium: '600', semibold: '700', bold: '800' } as const;
export type WeightKey = keyof typeof WEIGHT;

// ── 스페이스 스케일 (4px 그리드) + semantic alias ────────────────────
export const SPACE = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32, s8: 40,
  // semantic — 재난립 방지
  screenPadding: 20,
  bottomInset: 40,
  topBarHeight: 52,
  stackGap: 12,
  fieldGap: 14,
  rowGap: 8,
  touchMin: 44,
} as const;

// ── elevation (그림자) ───────────────────────────────────────────────
export const ELEVATION = {
  sh1: { shadowColor: '#1A1A1F', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sh2: { shadowColor: '#1A1A1F', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sh3: { shadowColor: '#1A1A1F', shadowOpacity: 0.12, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
} as const;

export type VoteType = 'cold' | 'ok' | 'hot';

export const VOTE_CONFIG: Record<VoteType, { label: string; color: string; bg: string }> = {
  cold: { label: '추워요', color: TOKEN.cold, bg: TOKEN.coldBg },
  ok: { label: '적당해요', color: TOKEN.ok, bg: TOKEN.okBg },
  hot: { label: '더워요', color: TOKEN.hot, bg: TOKEN.hotBg },
};

// 온도 스펙트럼 — 결과 시각화 순서 (cold → ok → hot)
export const SPECTRUM: VoteType[] = ['cold', 'ok', 'hot'];

export const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
