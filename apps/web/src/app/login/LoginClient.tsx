'use client';

import { useRouter } from 'next/navigation';
import { TOKEN } from '@aircon/core';
import { KAKAO_LOGIN_URL, NAVER_LOGIN_URL, GOOGLE_LOGIN_URL } from '@/lib/apiClient';

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

interface Provider {
  id: 'kakao' | 'naver' | 'google';
  label: string;
  bg: string;
  color: string;
  href: string;
  border?: string;
}

const PROVIDERS: Provider[] = [
  { id: 'kakao',  label: '카카오로 계속하기', bg: '#FEE500', color: '#191919', href: KAKAO_LOGIN_URL },
  { id: 'naver',  label: '네이버로 계속하기', bg: '#03C75A', color: '#ffffff', href: NAVER_LOGIN_URL },
  { id: 'google', label: 'Google로 계속하기', bg: '#FFFFFF', color: '#1F1F1F', href: GOOGLE_LOGIN_URL, border: '#DADCE0' },
];

const ERROR_HINTS: Record<string, string> = {
  state_mismatch: 'OAuth 인증 토큰이 만료됐어요. 다시 시도해주세요.',
  missing_code: '인증 코드가 누락됐어요. 다시 시도해주세요.',
  user_fetch_failed: '사용자 정보를 못 받았어요. 동의 항목을 확인해주세요.',
  not_configured: '서비스 설정 문제예요. 잠시 후 다시 시도해주세요.',
  access_denied: '동의를 취소하셨어요.',
};

function describeError(code: string): string {
  if (ERROR_HINTS[code]) return ERROR_HINTS[code];
  if (code.startsWith('token_')) {
    const sub = code.slice('token_'.length);
    if (sub === 'invalid_grant' || sub === 'KOE320') return '인증 코드가 만료됐거나 redirect URI가 콘솔과 일치하지 않습니다.';
    if (sub === 'redirect_uri_mismatch') return 'Redirect URI가 OAuth 콘솔 등록값과 다릅니다.';
    return `토큰 교환 실패: ${sub}`;
  }
  return `로그인 실패: ${code}`;
}

export default function LoginClient({ error: errorParam }: { error: string | null }) {
  const router = useRouter();

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 14px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="뒤로"
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke={TOKEN.text1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN.text1 }}>로그인</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 32px 40px',
        }}
      >
        <img src="/icon.png" alt="" style={{ width: 76, height: 76, borderRadius: 18, marginBottom: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.13)' }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: TOKEN.text1, marginBottom: 6, letterSpacing: '-0.5px' }}>에어컨 민주주의</div>
        <div style={{ fontSize: 14, color: TOKEN.text2, marginBottom: errorParam ? 18 : 40, textAlign: 'center', lineHeight: 1.7 }}>
          로그인하면 장소 관리 기능을 쓸 수 있어요.
        </div>
        {errorParam && (
          <div
            role="alert"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: TOKEN.hotBg,
              border: `1px solid ${TOKEN.hot}33`,
              borderRadius: TOKEN.r.md,
              fontSize: 12,
              color: TOKEN.hot,
              marginBottom: 22,
              lineHeight: 1.5,
            }}
          >
            {describeError(errorParam)}
            <div style={{ fontSize: 10, color: TOKEN.text3, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              code: {errorParam}
            </div>
          </div>
        )}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => { window.location.href = p.href; }}
              style={{
                padding: '15px',
                background: p.bg,
                color: p.color,
                border: p.border ? `1.5px solid ${p.border}` : 'none',
                borderRadius: TOKEN.r.lg,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                width: '100%',
                fontFamily: FONT,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            marginTop: 28,
            fontSize: 13,
            color: TOKEN.text3,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT,
            textDecoration: 'underline',
          }}
        >
          로그인 없이 계속하기
        </button>
      </div>
    </div>
  );
}
