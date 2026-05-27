import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보 처리방침 — 에어컨 민주주의',
  alternates: { canonical: '/privacy' },
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
  ul: { paddingLeft: 20 } as const,
  code: {
    background: '#F2F2F7',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 13,
  } as const,
};

export default function PrivacyPage() {
  return (
    <main style={styles.body}>
      <h1 style={styles.h1}>개인정보 처리방침</h1>
      <p style={styles.updated}>시행일: 2026년 5월 26일</p>

      <h2 style={styles.h2}>1. 수집 항목</h2>
      <ul style={styles.ul}>
        <li><b>익명 투표자 식별자</b>: 디바이스에 저장되는 무작위 UUID 쿠키. 개인을 식별하지 않습니다.</li>
        <li><b>로그인 사용자 (선택)</b>: 카카오/네이버/구글 로그인 시 별명, 프로필 사진(선택), 이메일(선택), provider ID. 익명 투표만 쓰실 거면 로그인은 필요 없습니다.</li>
        <li>
          <b>위치 정보</b>: 두 경우로 나뉩니다.
          <ul style={styles.ul}>
            <li>
              <b>일시 전송 (저장 안 함)</b>: 버스 wizard의 "📍 GPS" 버튼을 직접 누르면
              네이버 지도 reverse-geocode API에 좌표를 1회 보내 시·도 cityCode만 받아오고
              즉시 폐기. 좌표는 서버에 저장되지 않습니다.
            </li>
            <li>
              <b>좌표 저장 (장소 식별용)</b>: 카페·음식점을 지도 핀으로 등록할 때만
              해당 핀의 좌표를 약 11m 격자로 양자화해 place id(<code>venue:gps:...</code>)
              + 표시용 좌표로 영구 저장. 다른 사용자가 같은 가게에 투표하려면 같은
              좌표로 식별되어야 하기 때문. 사용자 본인 위치(GPS 시점)는 보내지 않습니다.
            </li>
          </ul>
        </li>
        <li><b>카메라</b>: QR 코드 스캔 시점에만 사용. 영상은 디바이스를 떠나지 않습니다.</li>
        <li><b>접속 로그</b>: 어뷰징 방지(rate limit, 차단)를 위해 IP 접두사 + User Agent의 해시값을 일시 보관 (HMAC). 원본 값은 저장하지 않습니다.</li>
      </ul>

      <h2 style={styles.h2}>2. 수집 목적</h2>
      <ul style={styles.ul}>
        <li>공공장소 에어컨 의견 익명 집계 (서비스 핵심 기능)</li>
        <li>중복 투표 방지 (1인 1표 / 1시간 단위)</li>
        <li>장난·악용 방지 (속도 제한, 차단)</li>
      </ul>

      <h2 style={styles.h2}>3. 보관 기간</h2>
      <ul style={styles.ul}>
        <li>투표 데이터: 1시간 (개별 투표는 만료)</li>
        <li>로그인 사용자 정보: 회원 탈퇴 또는 90일간 미접속 시 삭제</li>
        <li>어뷰징 방지용 해시 로그: 30일</li>
      </ul>

      <h2 style={styles.h2}>4. 제3자 제공</h2>
      <p>제공하지 않습니다. 외부 API(서울시 실시간 지하철·버스, 네이버 지도, 카카오/네이버/구글 로그인) 호출은 사용자 식별 정보 없이 호출 파라미터만 전달합니다.</p>

      <h2 style={styles.h2}>5. 위탁</h2>
      <ul style={styles.ul}>
        <li>Cloudflare (인프라, 미국): Pages·Workers·D1 호스팅</li>
        <li>카카오·네이버·구글 (선택적 로그인): OAuth 인증 위탁</li>
        <li>네이버 클라우드 플랫폼 (NCP): 지도 표시 (한국)</li>
      </ul>

      <h2 style={styles.h2}>6. 사용자 권리</h2>
      <ul style={styles.ul}>
        <li>익명 사용자: 브라우저 쿠키 삭제 또는 시크릿 모드 사용으로 모든 활동 분리 가능</li>
        <li>로그인 사용자: 앱 메뉴 → 로그아웃 → 회원 탈퇴 요청은 <code style={styles.code}>mtg821@gmail.com</code> 으로 이메일</li>
      </ul>

      <h2 style={styles.h2}>7. 보안</h2>
      <ul style={styles.ul}>
        <li>모든 통신 HTTPS 강제 (HSTS)</li>
        <li>세션 쿠키: HttpOnly + Secure + SameSite=Lax + HMAC 서명</li>
        <li>CSRF 보호: Origin 검증 + 의도 헤더</li>
      </ul>

      <h2 style={styles.h2}>8. 문의</h2>
      <p>개인정보 관련 문의: <code style={styles.code}>mtg821@gmail.com</code></p>
    </main>
  );
}
