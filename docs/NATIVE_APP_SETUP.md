# 네이티브 앱 셋업 (iOS / Android)

## 현재 상태 (2026-05-26)

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| Android | ✅ `npx cap add android` 성공, `cap sync` OK | Android Studio 설치 후 `npx cap open android` 로 빌드 |
| iOS | ⚠️ 디렉토리만 생성 (Xcode framework 이슈로 add 중 실패) | Xcode 업데이트 + `xcodebuild -runFirstLaunch` 후 `npx cap sync ios` |

Capacitor 버전: v6 (Node 20 호환). 향후 Node 22로 업그레이드하면 v8로 다시 올림.

## 아키텍처

`capacitor.config.ts`에 `server.url = https://aircondemocracy.com`. 네이티브 앱은 **WebView로 prod 서버를 직접 로드**. dist 번들 안 함.

장점:
- 웹 변경이 즉시 앱에도 반영 (서버 사이드 업데이트만으로)
- 오프라인 캐싱은 PWA의 Service Worker가 처리
- CORS, OAuth callback 등 모두 같은 도메인이라 추가 작업 없음

단점:
- 인터넷 연결 없으면 첫 로드 불가 (PWA 캐시로 일부 보완)
- 앱 스토어 심사 시 "단순한 웹 wrapper" 우려 가능 → 카메라/위치 권한 (QR 스캔, 근처역) 같은 native API 활용 명시로 통과

## App 식별자

- iOS Bundle ID / Android package: `com.aircondemocracy.app`
- App name: `에어컨 민주주의`
- Splash screen: 1.5s, background `#1B53E5` (브랜드 컬러)
- Status bar: light icons, background `#1B53E5`

## 권한 (스토어 등록 시 명시)

- **Camera** — QR 코드 스캔 (navigator.mediaDevices)
- **Geolocation** — 근처역 추천 (navigator.geolocation)
- 알림은 추후

## 유저 액션 — Android 빌드/배포

1. Android Studio 설치
2. `npx cap open android`
3. AndroidManifest.xml 권한 확인 (CAMERA, ACCESS_FINE_LOCATION)
4. 앱 아이콘: `android/app/src/main/res/mipmap-*` 에 변환본 넣기 (Android Asset Studio)
5. 서명 키 생성:
   ```
   keytool -genkey -v -keystore aircondemocracy.keystore \
     -alias aircondemocracy -keyalg RSA -keysize 2048 -validity 10000
   ```
6. 키스토어 안전 보관 (잃으면 앱 업데이트 불가)
7. Build → Generate Signed Bundle → AAB
8. Play Console 업로드
9. **Google Play Developer 계정**: $25 (1회)

## 유저 액션 — iOS 빌드/배포

1. **Xcode 업데이트** (현재 framework error)
2. `xcodebuild -runFirstLaunch` 실행
3. `npx cap add ios` 재실행 (or `rm -rf ios && npx cap add ios`)
4. `npx cap open ios` → Xcode
5. Signing & Capabilities → Team 선택 (Apple Developer 필요)
6. Info.plist 권한 설명문:
   - `NSCameraUsageDescription`: "QR 코드를 스캔하기 위해 카메라를 사용합니다."
   - `NSLocationWhenInUseUsageDescription`: "근처 지하철역을 추천하기 위해 사용합니다. 위치는 서버에 저장되지 않습니다."
7. 앱 아이콘: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`에 1024x1024 + 모든 사이즈
8. `npx cap sync ios`
9. Xcode → Product → Archive → App Store Connect 업로드
10. **Apple Developer Program**: $99/년

## 스토어 메타

### 앱 이름
- 한국어: `에어컨 민주주의`
- English: `Aircon Democracy`

### 부제 (iOS Subtitle ≤30자, Android short_description ≤80자)
- 한국어: `지하철·카페·강의실 에어컨 익명 투표`
- English: `Anonymous voting on AC comfort`

### 설명
```
지금 이 공간 에어컨이 추워요? 더워요? 적당해요?
지하철, 버스, 카페, 강의실 어디든 익명으로 한 표.
30초면 끝나는 시민 투표 서비스.

✓ 회원가입 없이 익명 투표 (카카오/네이버/구글 로그인은 선택)
✓ 지하철 노선 + 차량 단위로 정확하게 매칭
✓ 버스 노선 + 차량번호 자동 식별
✓ 카페·음식점은 네이버 지도에서 핀 찍기
✓ 대학교 강의실은 동·호실 단위
✓ QR 코드로 매장 등록 가능
```

### 키워드
에어컨, 민주주의, 익명 투표, 지하철, 카페, 강의실, 시민 참여, 실시간 의견

### 카테고리
- iOS: Utilities 또는 Social Networking
- Android: Tools 또는 Lifestyle

### 스크린샷 (필수, 향후 작업)
- iOS: 6.7" (1290×2796), 6.5" (1242×2688), 5.5" (1242×2208) — 각 3~10장
- Android: phone (16:9 또는 9:16) — 2~8장

스크린샷 후보 화면:
1. HomeScreen (지금 어디 계세요? CTA)
2. SubwayWizard (두 역 입력 + 자동 매칭 카드)
3. VoteScreen (3개 vote 버튼)
4. NaverMapPicker (카페 위치 찍기)
5. SNUClassroomWizard (대학·건물 선택)

### 개인정보 처리방침 URL
`https://aircondemocracy.com/privacy` — **생성 필요** (다음 task)

### 지원 URL
`https://aircondemocracy.com`

### 가격
무료, 인앱 결제 없음

## 위치기반서비스사업 신고

위치 정보(geolocation, 카메라)는 **사용자 디바이스 안에서만 처리** + 서버 저장 없음. 위치정보보호법 제2조 1호 "위치정보처리시스템" 정의에 해당 안 함. 다만 앱 스토어 등록 시 "위치 정보 사용" 표시 + 개인정보처리방침에 명시.

## OAuth provider 콘솔에 native redirect URI 추가

iOS / Android 앱이 OAuth 흐름 사용하려면 각 provider 콘솔에 deep link redirect URI 추가:

- 카카오: 콘솔 > 카카오 로그인 > Redirect URI 에 `com.aircondemocracy.app://oauth/kakao/callback`
- 네이버: 같은 패턴
- 구글: Bundle ID 기반 client (별도 OAuth 클라이언트 ID 생성 필요)

근데 현재는 `server.url = https://aircondemocracy.com` 이라 웹과 동일하게 https callback 사용. 즉 별도 등록 안 해도 동작 가능. 다만 앱 안에서 OAuth 시 system 브라우저 열리고 callback이 외부 브라우저로 가는 문제가 있을 수 있어, 향후 Capacitor Browser 플러그인 또는 Custom Tabs 사용 검토.
