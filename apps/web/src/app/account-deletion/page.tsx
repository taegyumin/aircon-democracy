import type { Metadata } from 'next';
import { SiteFooter } from '../../components/Footer';

export const metadata: Metadata = {
  title: '계정·데이터 삭제 — 에어컨 민주주의',
  alternates: { canonical: '/account-deletion' },
  robots: { index: true, follow: true },
};

const styles = {
  body: {
    maxWidth: 720,
    margin: '40px auto',
    padding: '0 20px',
    lineHeight: 1.7,
    color: '#1A1A1F',
  } as const,
  h1: { fontSize: 24, marginBottom: 8 } as const,
  updated: { color: '#6B6B7A', fontSize: 13, marginBottom: 28 } as const,
  h2: { fontSize: 17, marginTop: 28, marginBottom: 8 } as const,
  p: { fontSize: 14, marginBottom: 12 } as const,
  ul: { fontSize: 14, paddingLeft: 22, marginBottom: 12 } as const,
  note: {
    fontSize: 13,
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 8,
    padding: '12px 14px',
    marginTop: 16,
    color: '#92400E',
  } as const,
};

export default function AccountDeletionPage() {
  return (
    <>
      <main style={styles.body}>
        <h1 style={styles.h1}>계정·데이터 삭제</h1>
        <div style={styles.updated}>최종 업데이트: 2026-06-05</div>

        <p style={styles.p}>
          에어컨 민주주의의 데이터 삭제 정책입니다. Google Play / App Store 정책에 따라 사용자가 자신의 계정과 데이터를
          삭제할 수 있는 경로를 제공합니다.
        </p>

        <h2 style={styles.h2}>1. 익명 사용자 — 별도 삭제 불요</h2>
        <p style={styles.p}>
          로그인 없이 사용한 경우, 서버에는 다음 데이터만 보관됩니다.
        </p>
        <ul style={styles.ul}>
          <li>익명 vote 기록 (단방향 hash로 식별 — 사용자 신원 역추적 불가)</li>
          <li>익명 식별자 (cookie 또는 device token, 1년 후 자동 만료)</li>
        </ul>
        <p style={styles.p}>
          앱을 삭제하거나 브라우저의 cookie/site data를 비우면 더 이상 본인 식별 불가합니다. 별도 요청 없이 자동 무효화됩니다.
        </p>

        <h2 style={styles.h2}>2. 로그인 사용자 — 인앱·이메일 삭제 요청</h2>
        <p style={styles.p}>
          Kakao / Naver / Google로 로그인했거나 Apple Sign In 사용 시, 다음 방법으로 계정 및 관련 데이터를 삭제할 수 있습니다.
        </p>

        <h3 style={{ ...styles.h2, fontSize: 15 }}>방법 1. 인앱 삭제 (권장)</h3>
        <p style={styles.p}>
          모바일 앱 또는 웹의 <strong>설정 → 계정 → 계정 삭제</strong> 메뉴를 통해 즉시 삭제할 수 있습니다.
        </p>

        <h3 style={{ ...styles.h2, fontSize: 15 }}>방법 2. 이메일 요청</h3>
        <p style={styles.p}>
          <a href="mailto:mtg821@gmail.com?subject=%5B에어컨민주주의%5D%20계정%20삭제%20요청">
            mtg821@gmail.com
          </a>
          으로 가입에 사용한 이메일을 알려주시면 영업일 기준 7일 이내 삭제 처리합니다.
        </p>

        <h2 style={styles.h2}>3. 삭제되는 데이터</h2>
        <ul style={styles.ul}>
          <li>OAuth provider 식별자 (Kakao/Naver/Google/Apple sub)</li>
          <li>가입 시 받은 이메일·닉네임</li>
          <li>사용자가 등록한 사적 장소 (user:* prefix)</li>
          <li>vote 기록은 익명 hash라 사용자 신원과 연결되지 않은 상태로 통계에 남습니다 (개별 삭제 불가).</li>
        </ul>

        <div style={styles.note}>
          <strong>참고:</strong> vote 데이터는 익명화되어 있어 특정 사용자 vote만 골라 삭제하는 것은 기술적으로 불가능합니다.
          이 데이터는 위치(예: "2호선 2233번 열차")의 통계로만 남습니다.
        </div>

        <h2 style={styles.h2}>4. 보관 기간</h2>
        <p style={styles.p}>
          탈퇴 후 30일간 임시 보관(악용 방지 목적) 후 영구 삭제됩니다. 법적 의무 보관(통신비밀보호법 등)이 있는 경우 그
          기간이 우선합니다.
        </p>

        <h2 style={styles.h2}>5. 문의</h2>
        <p style={styles.p}>
          <a href="mailto:mtg821@gmail.com">mtg821@gmail.com</a> — Minari · 에어컨 민주주의
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
