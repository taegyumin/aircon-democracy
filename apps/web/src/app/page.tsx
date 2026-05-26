// 모노레포 마이그레이션 sprint 1: 첫 page는 placeholder + SSR 검증용.
// 이어지는 sprint에서 HomeScreen → React Server Component 포팅.

import Link from 'next/link';
import { TOKEN } from '@aircon/core';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: TOKEN.bg,
      }}
    >
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: TOKEN.text1, marginBottom: 12 }}>
          에어컨 민주주의
        </h1>
        <p style={{ fontSize: 15, color: TOKEN.text2, lineHeight: 1.6, marginBottom: 24 }}>
          Tier 1 마이그레이션 진행 중 — Next.js 15 App Router로 web 앱 셋업 완료.
        </p>
        <Link
          href="/privacy"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: TOKEN.cold,
            color: '#fff',
            borderRadius: TOKEN.r.lg,
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          개인정보 처리방침 →
        </Link>
      </div>
    </main>
  );
}
