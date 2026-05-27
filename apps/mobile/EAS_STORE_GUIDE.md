# EAS Build + App Store / Google Play 제출 가이드

이 mobile (Expo) 앱을 실제 iOS / Android 앱으로 빌드 + 스토어 출시하기 위한 단계.

## 1. EAS 계정 + 프로젝트 연결 (1회만)

```bash
npm i -g eas-cli
eas login                     # Expo 계정 (없으면 가입 — 무료)
cd apps/mobile
eas init                      # 이 프로젝트를 EAS에 등록 (app.json에 projectId 자동 추가)
```

## 2. Apple Developer 계정 ($99/년) + Google Play Console ($25 일회)

- **Apple**: https://developer.apple.com — 본인 명의로 가입. App Store Connect 자동 연결.
- **Google**: https://play.google.com/console — 본인 명의로 가입.

각 콘솔에서 앱 만들기:
- Apple App Store Connect → 새 앱 → Bundle ID `com.aircondemocracy.app`
- Google Play Console → 앱 만들기 → Application ID `com.aircondemocracy.app`

`eas.json`의 production submit 섹션에 발급된 ID 채우기:
- `appleId`: 본인 Apple ID 이메일
- `ascAppId`: App Store Connect의 앱 ID (숫자, 앱 만들면 자동 발급)
- `appleTeamId`: Apple Developer Team ID
- `serviceAccountKeyPath`: Google Play Console → API access → 서비스 계정 키 JSON

## 3. 첫 빌드

```bash
cd apps/mobile

# iOS — 클라우드 빌드, 인증서/프로비저닝 EAS가 자동 처리 (Apple 자격증명 묻고 진행)
eas build -p ios --profile production

# Android — 클라우드 빌드, 키스토어 EAS가 자동 생성 또는 본인 keystore 업로드
eas build -p android --profile production
```

빌드 완료 후 EAS dashboard (`https://expo.dev/accounts/.../projects/aircon-democracy`)에서 결과 확인.

## 4. 스토어 제출

```bash
# iOS — TestFlight 또는 App Store
eas submit -p ios --latest

# Android — Internal/Closed/Production track
eas submit -p android --latest
```

## 5. 스토어 metadata 준비

각 스토어가 요구하는 것:
- **앱 아이콘**: `assets/icon.png` (이미 있음, 1024×1024 권장)
- **스크린샷**:
  - iOS: 6.5" iPhone (1284×2778), 5.5" iPhone (1242×2208) — 각 최소 3장
  - Android: 폰 (1080×1920 이상) — 최소 2장
  - 권장: 홈/카테고리 picker, 투표 화면, 카페·음식점 wizard, 즐겨찾기 화면
- **앱 설명** (한국어):
  ```
  지하철·버스·강의실·카페 등 공공 공간의 냉방 상태를 시민이 익명으로 한 표 던지는
  공익 서비스. 추워요/적당해요/더워요 3가지 선택지로 30초면 끝.
  ```
- **카테고리**: 라이프스타일 또는 도구
- **개인정보 처리방침 URL**: `https://aircondemocracy.com/privacy` (이미 있음)
- **연령 등급**: 4+
- **광고 없음** 명시

## 6. iOS 심사 주의

Apple 심사 가이드라인:
- **4.2 Minimum Functionality** — WebView wrapper 거부. 우리는 RN native 화면이라 문제 없음.
- **5.1.1 Privacy** — 카메라(QR scan) + 위치(지하철역 근처) 사용 사유 명시. `app.json`의 `NSCameraUsageDescription` + `NSLocationWhenInUseUsageDescription` 이미 한국어로 설명됨.
- **3.1 Payments** — 우리는 무료 서비스 + 광고/IAP 없음. 통과 쉬움.
- **로그인 화면**: '로그인 없이 계속하기' 옵션 명확 (이미 구현됨) — Apple은 강제 로그인을 싫어함.

심사 통상 24~72시간. 거부 시 reviewer 코멘트 보고 수정 후 재제출.

## 7. Google Play 심사 주의

- **앱 콘텐츠 신고** 양식 채우기 (광고 X, 데이터 수집 X, 14+ 등급)
- **데이터 안전성 섹션** — 익명 투표라 personal data 거의 없음 (선택 로그인 시 이메일/이름만, 광고 ID X)
- 통상 몇 시간 ~ 1일.

## 8. OTA 업데이트 (선택)

EAS Updates로 native 빌드 없이 JS 코드만 즉시 업데이트 가능:
```bash
eas update --branch production --message "vote 화면 fix"
```

## TODO

- [ ] Apple Developer 계정 가입
- [ ] Google Play Console 계정 가입
- [ ] App Store Connect에서 앱 만들기 (Bundle ID 등록)
- [ ] Google Play Console에서 앱 만들기 (Application ID 등록)
- [ ] `eas init` 실행 → app.json에 projectId
- [ ] `eas.json` production submit에 ID 채우기
- [ ] 스크린샷 6장 준비 (iOS/Android 각)
- [ ] 첫 빌드 → 내부 테스트
- [ ] 스토어 제출
