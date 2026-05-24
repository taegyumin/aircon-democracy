# Native 앱 출시 가이드 — iOS / Android

웹 PWA는 이미 라이브: https://aircondemocracy.com
이 문서는 그걸 App Store / Play Store에 올리기 위한 단계.

## 현재 상태 (이미 셋업 완료)

- `@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, splash, status-bar 설치됨
- `capacitor.config.ts` 구성됨 (https://aircondemocracy.com 로드)
- AppID: `com.aircondemocracy.app`
- App Name: `에어컨 민주주의`

## 님이 할 일 — 한 번만

### 1. iOS — Xcode 필요 (Mac)

```bash
# Xcode 설치 확인
xcode-select --install   # 안 깔려 있으면

# iOS 플랫폼 추가 (Xcode 프로젝트 생성됨)
npx cap add ios

# Xcode에서 열기
npx cap open ios
```

Xcode 안에서:
- Signing & Capabilities 탭 → **Team** 선택 (Apple Developer 계정 필요, $99/yr)
- Bundle Identifier 확인: `com.aircondemocracy.app`
- 디바이스/시뮬레이터에서 실행 테스트

### 2. Android — Android Studio 필요

```bash
# Android Studio + JDK 17 설치
brew install --cask android-studio

# Android 플랫폼 추가
npx cap add android

# Android Studio에서 열기
npx cap open android
```

Android Studio 안에서:
- Build → Generate Signed Bundle / APK
- 키스토어 생성 (`keytool`) — 비밀번호 안전하게 보관
- Release 빌드 생성

### 3. 스토어 등록

**Apple App Store ($99/yr)**
1. https://developer.apple.com/programs 가입 ($99/yr 결제)
2. https://appstoreconnect.apple.com 에서 새 앱 생성
3. 메타데이터: 한국어/영어 설명, 키워드, 스크린샷(5+ 사이즈), 카테고리, 등급
4. 개인정보처리방침 URL 필수
5. Xcode에서 Archive → App Store Connect 업로드
6. TestFlight으로 베타 테스트 (선택)
7. 심사 제출 → 1~7일 대기

**Google Play Store ($25 one-time)**
1. https://play.google.com/console 가입 ($25 결제)
2. 새 앱 생성, 메타데이터 입력
3. 개인정보처리방침 URL 필수, 데이터 안전성 설문 응답
4. AAB(Android App Bundle) 업로드
5. Internal Testing → Closed → Open → Production 단계적 출시 가능
6. 심사 1~3일

## 추가 작업 (선택, 추후 개선)

### 푸시 알림
- iOS: APNs 인증서 + Capacitor Push Notifications 플러그인
- Android: Firebase Cloud Messaging
- 백엔드: 알림 트리거 로직 (예: "내 장소 의견이 바뀌었어요")

### 오프라인 지원 강화
현재는 `server.url`로 웹 서버 직접 로드. 비행기 모드면 빈 화면.
- `capacitor.config.ts` 에서 `server.url` 제거
- `npm run build` 결과 dist/를 `npx cap copy`로 네이티브 안에 복사
- API 호출은 https://aircondemocracy.com/api 로 명시
- 백엔드에 CORS 추가:
  ```ts
  // functions/api/[[route]].ts 상단
  import { cors } from 'hono/cors';
  app.use('*', cors({
    origin: ['capacitor://localhost', 'http://localhost', 'https://localhost'],
    credentials: true,
  }));
  ```

### Deep Link
`https://aircondemocracy.com/p/<id>` 링크 클릭 시 앱이 열리도록.
- iOS: Associated Domains capability + Apple App Site Association 파일
- Android: Asset Statements + Intent Filter
- 파일은 도메인 root에 호스팅 (Cloudflare Pages 정적 파일)

## 빌드 자동화 (선택)

GitHub Actions로 .ipa / .aab 자동 빌드:
- iOS: `actions/setup-xcode` + fastlane
- Android: `actions/setup-java` + Gradle
- 매 release 태그마다 자동 빌드 → 아티팩트 다운로드

샘플 워크플로우 필요시 요청하세요.
