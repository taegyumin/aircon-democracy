export const TOKEN = {
  hot: '#E52B1E',
  cold: '#1B53E5',
  ok: '#16A34A',
  hotBg: '#FFF1F0',
  coldBg: '#EFF4FF',
  okBg: '#F0FDF4',
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surface2: '#F7F7FA',
  text1: '#1A1A1F',
  text2: '#6B6B7A',
  text3: '#A0A0AE',
  border: '#E2E2EC',
  r: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
} as const;

export type VoteType = 'cold' | 'ok' | 'hot';

export const VOTE_CONFIG: Record<VoteType, { label: string; color: string; bg: string }> = {
  cold: { label: '추워요', color: TOKEN.cold, bg: TOKEN.coldBg },
  ok: { label: '적당해요', color: TOKEN.ok, bg: TOKEN.okBg },
  hot: { label: '더워요', color: TOKEN.hot, bg: TOKEN.hotBg },
};

export const FONT = "'Noto Sans KR', sans-serif";
