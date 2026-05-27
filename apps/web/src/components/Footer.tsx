// 사이트 footer — 사업자 정보 + 개인정보 처리방침 링크.
// Kakao 비즈 인증 + 전자상거래법 표시 의무 충족.
// 모든 페이지 layout에 마운트. 시각적으로 가볍게 (작은 회색 글씨).

import { TOKEN, FONT } from '@aircon/core';

export function SiteFooter() {
  return (
    <footer
      style={{
        background: TOKEN.surface,
        borderTop: `1px solid ${TOKEN.border}`,
        padding: '20px 16px 28px',
        fontFamily: FONT,
        color: TOKEN.text3,
        fontSize: 11,
        lineHeight: 1.7,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontWeight: 700, color: TOKEN.text2, marginBottom: 4 }}>
          미나리 (Minari)
        </div>
        <div>대표자: 민태규 · 사업자등록번호: 147-33-01631</div>
        <div>충청남도 천안시 서북구 1공단4길 25, 4층 416호 (두정동, 팰리스타워2)</div>
        <div>문의: <a href="mailto:mtg821@gmail.com" style={{ color: TOKEN.text3, textDecoration: 'none' }}>mtg821@gmail.com</a></div>
        <div style={{ marginTop: 8 }}>
          <a href="/privacy" style={{ color: TOKEN.text2, marginRight: 12 }}>개인정보 처리방침</a>
        </div>
        <div style={{ marginTop: 6, color: TOKEN.text3, fontSize: 10 }}>
          © {new Date().getFullYear()} 미나리 · 시민 참여 플랫폼
        </div>
      </div>
    </footer>
  );
}
