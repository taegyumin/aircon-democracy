import { TOKEN, FONT } from '../lib/tokens';
import { BackIcon } from '../components/Icons';
import { KAKAO_LOGIN_URL } from '../lib/api';

interface Props {
  onBack: () => void;
}

interface Provider {
  id: 'kakao' | 'naver' | 'apple';
  label: string;
  bg: string;
  color: string;
  href?: string;
  disabledNote?: string;
}

const PROVIDERS: Provider[] = [
  { id: 'kakao', label: '카카오로 계속하기', bg: '#FEE500', color: '#191919', href: KAKAO_LOGIN_URL },
  { id: 'naver', label: '네이버로 계속하기 (준비 중)', bg: '#03C75A', color: '#ffffff', disabledNote: 'soon' },
  { id: 'apple', label: '애플로 계속하기 (준비 중)',  bg: '#000000', color: '#ffffff', disabledNote: 'soon' },
];

export function LoginScreen({ onBack }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: TOKEN.bg, fontFamily: FONT }}>
      <div style={{ background: TOKEN.surface, paddingTop: 62, borderBottom: `1px solid ${TOKEN.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 14px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
            aria-label="뒤로"
          >
            <BackIcon />
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
        <div style={{ fontSize: 14, color: TOKEN.text2, marginBottom: 40, textAlign: 'center', lineHeight: 1.7 }}>
          로그인하면 장소 관리 기능을 쓸 수 있어요.
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PROVIDERS.map((p) => {
            const disabled = !p.href;
            return (
              <button
                key={p.id}
                onClick={() => p.href && (window.location.href = p.href)}
                disabled={disabled}
                style={{
                  padding: '15px',
                  background: p.bg,
                  color: p.color,
                  border: 'none',
                  borderRadius: TOKEN.r.lg,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  width: '100%',
                  fontFamily: FONT,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onBack}
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
