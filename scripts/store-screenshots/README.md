# 스토어 스크린샷 생성기

실제 앱 화면(iOS 시뮬레이터) 캡처 → 헤드라인 + 기기프레임 합성 → iOS/Play 규격 산출. (snuboard 방법론 이식.)

```bash
npm run screenshots            # capture(시뮬레이터) + compose 한 번에
npm run screenshots:capture    # 시뮬레이터를 Maestro로 돌려 raw/{name}.png
npm run screenshots:compose    # raw/ → out/ios/{name}.png (1290×2796), out/play/{name}.png (1080×2160)
```

## ★ 원판 소스 = 실제 앱 (웹 아님)

스토어는 **모바일 앱** 리스팅이다. 웹 PWA는 모바일에 없는 UI(지하철 모드 토글, 카페 네이버지도)를
노출해 "앱에 없는 기능 광고"가 되고, 이는 Apple/Google **accurate-metadata 위반(심사 리젝)**이다
(Codex 이중검수 catch 2026-06-07). 그래서 원판은 **iOS 시뮬레이터의 실제 앱**에서 찍는다.

### 전제 (로컬 전용, CI 불요)
1. iOS 시뮬레이터에 앱 설치 + 실행: `npm run -w @aircon/mobile ios`
2. Metro 실행 중 (위 명령이 띄움)
3. Maestro 설치 (`curl -Ls https://get.maestro.mobile.dev | bash`)

`capture.mjs`가 `sim-shots.yaml`(Maestro flow)로 홈→지하철→강의실→기차를 탐색하며 `takeScreenshot`,
결과 PNG를 `raw/`로 복사한다. **read-only** — 탐색만, 투표·등록 안 함.

### 자동 캡처가 안 되는 화면
홈 카테고리 라벨이 바뀌면 `sim-shots.yaml`의 `tapOn` 텍스트를 보정한다. 특정 화면이 실패하면
시뮬레이터를 직접 그 화면으로 옮긴 뒤 수동 캡처:

```bash
xcrun simctl io booted screenshot scripts/store-screenshots/raw/05-vote.png
# shots.mjs에 { name: '05-vote', headline: '...' } 추가 → npm run screenshots:compose
```

compose는 `raw/{name}.png`가 어디서 왔든(Maestro 자동 / 수동) 동일하게 프레이밍한다.

## 헤드라인 정직성

`shots.mjs`의 headline은 **실제 흐름과 일치**해야 한다(과장 금지). 예: 지하철은 이전·다음 역 입력이
필요하므로 "장소만 고르면 30초" 같은 과장 대신 "이전·다음 역만 입력하면 차량까지"로 적는다.

## 규격 (출시 직전 새로 생성, stale 방지)

- iOS `1290×2796` — 6.7"/6.9" 디스플레이 공용(현행 필수 대형 슬롯 충족). iPad 미지원(supportsTablet:false).
- Play `1080×2160` — 업로드 허용. (Google 권장 노출은 9:16 `1080×1920`, 기기프레임 지양 — 필요 시 조정.)
- `raw/`, `out/`은 gitignore (생성물). 제출 직전 `npm run screenshots`로 새로 만든다.

## 디테일 (snuboard 교훈)

- **2× 슈퍼샘플 → sharp 다운스케일**: 라운드 모서리·텍스트 계단현상 방지, 정확한 픽셀 규격.
- **동심원 규칙**: 스크린 라운드 = 베젤 라운드 − 베젤 두께.
