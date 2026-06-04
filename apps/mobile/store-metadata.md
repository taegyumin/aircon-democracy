# Store Metadata — 에어컨 민주주의

배포자: **Minari** / Team `RWC9Y2BDAS` / Bundle `com.aircondemocracy.app`

## App Store Connect

### 기본 정보
- **이름**: 에어컨 민주주의
- **부제**: 30초 익명 투표 (subtitle, 30자 이내)
- **카테고리**: 주 — 라이프스타일 / 보조 — 유틸리티
- **콘텐츠 등급**: 4+
- **저작권**: © 2026 Minari

### 프로모션 텍스트 (170자)
지금 탄 열차·버스가 추워요? 더워요? 30초 익명 투표로 같은 차량 사람들 의견을 실시간으로 봐요. 강의실·카페까지 전국 어디든.

### 설명 (4000자)
**더우세요? 추우세요? 30초 익명 투표로 같이 알아봐요.**

지하철, 버스, 강의실, 카페 — 에어컨 온도 때문에 불편했던 적 있으신가요?
"나만 추운가?" 싶을 때, 같은 공간 사람들의 의견을 30초 안에 확인할 수 있어요.

📍 **지원 장소**
- 지하철: 수도권 1~9호선 실시간 차량 단위 식별 + 전국 station 단위
- 기차: KTX·SRT·ITX·새마을·무궁화호 (좌석권 정보로 차량 검증)
- 버스: 서울 시내버스 차량 단위 + 전국 시내버스
- 고속·시외버스: 승차권 정보로 차량 검증
- 강의실: 서울대·연세대 강의동 단위 + 다른 대학 자유 등록
- 카페·음식점: 주소 기반 등록

⚡ **30초 익명 투표**
- 회원가입 없이 바로 투표
- 추워요 · 적당해요 · 더워요 3가지 선택
- 같은 차량/공간 사람들의 의견 실시간 집계

🔒 **개인정보 보호**
- 위치는 서버에 저장 안 됨
- 익명 식별자만 사용 (cookie 또는 device token)
- 신고 기록도 hash 처리

🚇 **실시간 데이터**
- 서울 swopenAPI + 전국 TAGO API + 용인 에버라인
- 김포골드라인·의정부경전철 등 일부 노선은 station 단위만 지원

지금 어디 계세요? 30초 투표로 시작해보세요.

웹: https://aircondemocracy.com

### 키워드 (100자, 쉼표 구분)
에어컨,온도,투표,익명,지하철,버스,강의실,카페,KTX,SRT

### 지원 URL
- 마케팅 URL: https://aircondemocracy.com
- 지원 URL: https://aircondemocracy.com (현재 별도 지원 페이지 없음 — 차후 GitHub Issues 안내)
- 개인정보 처리방침: https://aircondemocracy.com/privacy

### 심사용 데모 계정
- **불요** — 회원가입 없는 익명 앱. 심사관에게 "Just open the app, tap a category, search for a location, and tap one of three temperature buttons" 안내.

### 첨부 메모 (Review Notes)
```
이 앱은 회원가입 없이 익명으로 사용 가능합니다.
모든 vote 데이터는 익명 hash 식별자로 저장되며, 위치 정보는 서버에 저장되지 않습니다.

External API 사용:
- 서울 swopenAPI (지하철 실시간) — Seoul Open Data
- data.go.kr TAGO (전국 교통) — Korean government public data
- 용인에버라인 (비공식 endpoint) — 운영사 사이트 그대로

심사관님 테스트: 앱 시작 → "지하철" 선택 → 강남역 검색 → "추워요/적당해요/더워요" 중 하나 탭하면 익명 투표 완료.
```

## Google Play Console

### 기본 정보
- **앱 이름**: 에어컨 민주주의 (Play Console은 30자 제한)
- **간단한 설명** (80자): 30초 익명 투표로 지하철·버스·강의실 에어컨 온도 공유. 같은 차량 사람들 의견 실시간.
- **자세한 설명**: App Store 설명과 동일 (4000자)
- **카테고리**: 라이프스타일
- **콘텐츠 등급**: 만 3세 이상 (광고 없음, 사용자 생성 컨텐츠 없음 — 익명 vote만)

### 데이터 안전 (Data Safety) — 새 Play Console 필수
| 데이터 타입 | 수집 | 공유 | 선택/필수 | 용도 |
|---|---|---|---|---|
| 익명 식별자 (device token) | ✅ | ❌ | 필수 | vote 중복 방지 |
| 대략 위치 (선택) | ✅ | ❌ | 선택 | 근처 정류장 추천 (서버 저장 X) |
| 카메라 (선택) | ❌ 수집 X | — | 선택 | QR 스캔 (로컬만) |

### 개인정보 처리방침
- 동일 URL: https://aircondemocracy.com/privacy

### 광고 ID 사용
- ❌ 사용 안 함

### 대상 사용자
- 만 13세 이상

## Screenshots (필수)

### iOS (App Store)
- **6.7" Display** (iPhone 14 Pro Max 등): 1290 × 2796 — **필수**
- **6.5" Display** (iPhone 11 Pro Max 등): 1242 × 2688 — 권장
- **5.5" Display** (iPhone 8 Plus): 1242 × 2208 — Apple 더 이상 필수 아님 (선택)
- iPad: 지원 안 함 (supportsTablet: false)

### Android (Play Store)
- Phone: 1080 × 1920 이상, 16:9 또는 9:16
- 7-inch tablet: optional
- 10-inch tablet: optional
- **최소 2장, 최대 8장**

### 캡처할 화면 (5장 권장)
1. **홈** — CategoryPicker (지하철/기차/버스/강의실/카페)
2. **지하철 wizard** — "방금 지나간 역 / 다음 도착 역" 매칭 완료 + RouteViz
3. **투표 화면** — 추워요/적당해요/더워요 3 button
4. **결과 화면** — 차량별 vote 분포 시각화
5. **버스 RouteTimeline** — 노선 timeline + 차량 pill picker

### Screenshot 생성 명령 (자동화)
```bash
# iOS Simulator (각 디바이스별)
xcrun simctl boot "iPhone 15 Pro Max"  # 6.7"
# expo run:ios 로 앱 실행 후
xcrun simctl io "iPhone 15 Pro Max" screenshot ~/Desktop/ios-1.png

# Android Emulator
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png ~/Desktop/android-1.png
```

## App Icon / Feature Graphic

- iOS Icon: `apps/mobile/assets/icon.png` (1024×1024 필수, 이미 있음 — 확인 필요)
- Android Adaptive Icon: `apps/mobile/assets/adaptive-icon.png` (512×512 + 배경)
- Play Store Feature Graphic: 1024×500 (별도 그래픽 필요 — 현재 없음, 제작 필요)
- Splash: 이미 #1B53E5 + splash.png 설정됨

## 체크리스트

- [ ] App Store Connect에 앱 등록 + ASC App ID 받기
- [ ] Apple ID (App Store Connect 로그인 이메일) eas.json에 입력
- [ ] Play Console에 앱 등록 + 위 metadata 입력
- [ ] Google Service Account JSON 생성 + Play Console 권한 부여
- [ ] Screenshots 5장 생성 (iOS 6.7" + Android phone 둘 다)
- [ ] Feature Graphic (1024×500) 제작
- [ ] App Icon 1024×1024 확인 (alpha channel 없어야 — iOS 거부 사유 #1)
- [ ] privacy policy 페이지 데이터 안전 항목 일치 확인
- [ ] app.json version 0.1.0 → 1.0.0 변경
