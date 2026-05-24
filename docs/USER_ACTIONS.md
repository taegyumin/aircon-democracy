# 님이 직접 하셔야 하는 작업 — 한 묶음 체크리스트

제가 코드/인프라는 다 깔아놨어요. 아래는 **본인 명의 / 결제 / 토큰 발급**이 필요해서 위임 불가능한 작업.
순서대로 따라가시되, **우선순위 ⭐ 만 먼저 해도 90% 완성.**

---

## ⭐ 1. Kakao OAuth (5분, 무료) — 로그인 기능 활성화

배경: 코드는 다 짜뒀고 `KAKAO_REST_API_KEY` env var만 비워둠. 키만 박아주시면 즉시 로그인 동작.

1. https://developers.kakao.com 접속 → 카카오 계정 로그인
2. **내 애플리케이션 → 애플리케이션 추가하기**
   - 앱 이름: `에어컨 민주주의`
   - 사업자명: 본인 또는 회사명
3. 앱 클릭 → **앱 설정 → 요약 정보**
   - **REST API 키** 복사 — 알려주세요 (or env var에 박아주세요)
4. **앱 설정 → 플랫폼 → Web 플랫폼 등록**
   - 사이트 도메인: `https://aircondemocracy.com`
5. **제품 설정 → 카카오 로그인**
   - **활성화 설정 ON**
   - **Redirect URI**: `https://aircondemocracy.com/api/auth/kakao/callback`
   - **동의항목**:
     - 닉네임 → 필수 동의
     - 프로필 사진 → 선택 동의
     - 카카오계정(이메일) → 선택 동의
6. **앱 설정 → 보안 → Client Secret** (권장)
   - "발급" 클릭 → 복사 → "사용함" 활성화 → 알려주세요

저한테 알려주실 것 (2개):
- `KAKAO_REST_API_KEY`
- `KAKAO_CLIENT_SECRET` (선택)

---

## 2. 검색엔진 등록 (10분, 무료) — SEO 완성

배경: 사이트맵·로봇·메타데이터는 다 셋업됨. 검색엔진에 사이트 등록만 하면 인덱싱 시작.

### Google Search Console
1. https://search.google.com/search-console/welcome
2. **URL 접두어** → `https://aircondemocracy.com` 입력
3. **HTML 태그** 인증 선택 → meta 태그 복사
4. 그 meta content 값을 저에게 알려주세요 (저는 index.html에 박을 거임)
5. 인증 후 **Sitemaps** 메뉴 → `sitemap.xml` 제출

### Naver 서치어드바이저
1. https://searchadvisor.naver.com
2. **웹마스터 도구 → 사이트 등록** → `https://aircondemocracy.com`
3. **HTML 태그** 인증 → content 값 알려주세요
4. 인증 후 **사이트맵 제출** → `https://aircondemocracy.com/sitemap.xml`

### Daum 검색
1. https://register.search.daum.net (다음 검색 등록)
2. 사이트 URL 등록 (메타 인증 같은 거 없음, 단순 신청)

---

## 3. 개인정보처리방침 (필수, 모든 출시 전제 조건)

배경: OAuth 로그인 + 앱스토어 출시 모두 개인정보처리방침 URL 요구함.

### 작성 옵션
- **A (간단)**: https://www.privacypolicies.com 같은 generator로 무료 생성 (영어/한국어)
- **B (안전)**: 변호사 의뢰 (10~50만원, 한 번만)
- **C (DIY)**: 카카오 / 네이버 등 비슷한 한국 서비스 정책 참고해서 작성

수집 항목 (작성 시 반드시 포함):
- 카카오 OAuth: 닉네임, 프로필 사진, 이메일 (선택)
- 익명 voter cookie (HMAC-signed UUID)
- IP 주소 (Cloudflare 로그)
- 투표 기록 (1시간 후 자동 삭제)
- 등록한 장소 정보

저장 위치: Cloudflare D1 (서울 region — APAC)

작성 후 URL 알려주시면 (예: https://aircondemocracy.com/privacy) — 정적 페이지로 호스팅해드릴게요.

---

## 4. (선택) 네이버 OAuth 추가 — 한국 사용자 풀 확장

1. https://developers.naver.com/apps/#/register 가입
2. **사용 API: 네이버 로그인** 선택
3. **서비스 URL**: `https://aircondemocracy.com`
4. **Callback URL**: `https://aircondemocracy.com/api/auth/naver/callback`
5. **Client ID + Secret** 발급 → 알려주세요

저: 네이버 OAuth 백엔드 핸들러 추가 (~30분 작업)

---

## 5. 안드로이드 앱 출시 ($25 one-time)

1. https://play.google.com/console 가입 ($25 결제, 평생 1회)
2. 본인 명의 신용카드 + 신분증 인증
3. 새 앱 생성 → 카테고리: **도구 / 시민 참여**
4. 데이터 안전성 설문 작성
5. 개인정보처리방침 URL 입력
6. 저에게 알려주시면 → Capacitor로 안드로이드 빌드 추가 + AAB 생성해드림
7. Android Studio 설치 (없으면): `brew install --cask android-studio`
8. 자세한 절차: `docs/NATIVE_APP_SETUP.md` 참고

---

## 6. iOS 앱 출시 ($99/yr)

1. https://developer.apple.com/programs 가입 ($99/yr, 매년 갱신)
2. 본인 명의 + Apple ID + 신용카드
3. https://appstoreconnect.apple.com 에서 앱 생성
4. Xcode 설치 필수 (Mac App Store에서 무료)
5. 저에게 알려주시면 → Capacitor로 iOS 빌드 추가 + Xcode 프로젝트 열기 가이드
6. 심사 가이드라인 통과 (가장 까다로움)
7. 자세한 절차: `docs/NATIVE_APP_SETUP.md` 참고

---

## 7. 도메인 갱신 알림 (2027년 5월쯤)

- `aircondemocracy.com` 갱신 ($10.46/yr) — Cloudflare가 알림 자동 발송
- 미갱신 시 도메인 만료 → 사이트 사라짐

---

## 8. (선택) 브랜드 로고 보강

5개 카페/대학교 로고가 사각 비율로 안 구해져서 Lucide 아이콘으로 fallback 중:
- 이디야커피, 컴포즈커피, 메가MGC커피, 연세대, 고려대

- `docs/BRAND_LOGOS_SOURCING.md` 를 다른 LLM에 통째로 던지시면 됩니다 (소싱 절차 자체 완결형)
- 또는 본인이 직접 정사각 비율 로고 찾아서 `public/brands/` 에 넣으면 됩니다

---

## 우선순위 정리

| 순서 | 작업 | 비용 | 시간 | 효과 |
|---|---|---|---|---|
| ⭐ 1 | Kakao OAuth | 무료 | 5분 | 로그인 활성화 |
| ⭐ 2 | Search Console (Google+Naver) | 무료 | 10분 | 검색 노출 시작 |
| ⭐ 3 | 개인정보처리방침 | 0~50만원 | 1~3일 | 출시 가능 |
| 4 | 네이버 OAuth | 무료 | 5분 | 사용자 풀 +30% |
| 5 | Google Play 출시 | $25 | 1주 | 안드로이드 사용자 |
| 6 | App Store 출시 | $99/yr | 2주 | iOS 사용자 |
| 7 | 도메인 갱신 알림 | $10/yr | 자동 | 사이트 유지 |
| 8 | 브랜드 로고 보강 | 무료 | 30분 | 시각적 완성도 |

**⭐ 1, 2, 3 만 끝나면 정식 출시 가능 상태.** 나머지는 그 뒤로 점진적.

알려주실 정보 → 다음 메시지에 모아서 한꺼번에:
1. KAKAO_REST_API_KEY
2. KAKAO_CLIENT_SECRET (선택)
3. Google Search Console 인증 메타 content
4. Naver Search Advisor 인증 메타 content
