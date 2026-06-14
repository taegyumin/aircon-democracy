// 사이트 footer — 개인정보 처리방침 링크 + 저작권.
// 사업자 상세 정보(상호·대표·등록번호·주소)는 제거: 무료·비거래 서비스라 전자상거래법
// 통신판매업자 표시 의무가 적용되지 않고, 익명 서비스에 운영자 개인정보 과노출 방지.
// 개인정보 관련 문의 연락처는 /privacy(8. 문의)에 유지 — PIPA 요건 충족.

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
        <div style={{ marginBottom: 6 }}>
          <a href="/privacy" style={{ color: TOKEN.text2, textDecoration: 'none' }}>개인정보 처리방침</a>
        </div>
        <div style={{ color: TOKEN.text3, fontSize: 10 }}>
          © {new Date().getFullYear()} 에어컨 민주주의 · 시민 참여 플랫폼
        </div>
      </div>
    </footer>
  );
}
