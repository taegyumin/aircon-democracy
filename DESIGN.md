# 에어컨 민주주의 — 디자인·릴리스 헌법

> 우선순위: **사용자(회장) 지시 > 이 문서 > 기본 동작.**
> 이 문서는 디자인 시스템과 배포 에셋의 "어떻게/왜"를 고정한다. 코드를 만지는 모든 에이전트(사람·LLM)는
> 작업 전 한 번 떠올린다. (snuboard 방법론 이식 — 도메인 아닌 메커니즘만.)

## 0. 메타 원칙 (뿌리)

> **규율은 사람의 선의가 아니라 기계가 강제한다. 그리고 모든 가드는 실제로 한 번 데인 사고에서
> 태어나며, 그 사고를 주석에 남긴다.**

- 디자인 시스템이 무너지는 건 항상 "급해서 하드코딩 한 번"에서 시작한다. 사람은 반드시 드리프트한다.
- 처음엔 가드가 없어도 된다. **한 번 데이면 그 자리에서 lint/CI 가드 + "왜" 주석으로 박아** 재발을 구조적으로 막는다.
- "근본 해결" 선언은 사용자 검증 후에만. 가설 ≥2개 + sweep 후 batch fix.

## 1. 토큰 SSOT — 이미 성립 (snuboard와 다른 출발점)

aircon은 웹·모바일이 `@aircon/core`의 **`TOKEN`을 직접 import**한다 (웹 ~755회 / 모바일 ~415회).
- → 변환 0, 단일 소스. **snuboard의 토큰 브리지(makeTheme→gen-theme-css→CSS변수→NativeWind className)는
  우리에겐 불필요(N/A).** 우리는 NativeWind를 안 쓰고 inline style + RN StyleSheet에 TOKEN을 직접 박는다.
  CSS-var 직렬화 레이어를 새로 만들면 오히려 **두 번째 SSOT가 생겨 드리프트의 원천**이 된다 — 만들지 마라.
- 색·radius·폰트는 `packages/core/src/tokens.ts`의 `TOKEN`/`FONT`/`VOTE_CONFIG`가 정본.
- **다크모드 미도입(v1).** 단일 라이트 팔레트. `app.json userInterfaceStyle: "light"` 고정.
  다크는 제품 결정이 선 뒤 별도 sprint (TOKEN을 makeTheme 형태로 바꾸는 큰 작업).

## 2. 규율 (지금은 사람이, 곧 기계가 강제)

- **하드코딩 색 금지.** `#RRGGBB`·`rgba(컬러)` 리터럴 금지 → `TOKEN.x`. 알파 틴트는 헬퍼로
  (`${TOKEN.cold}15` 식 8자리 hex suffix는 현행 관행, 추후 hexToRGBA 헬퍼로 통일 검토).
  흑백 오버레이/그림자(`rgba(0,0,0,x)`)만 예외.
- **타이포는 토큰 지향.** 반복되는 fontSize raw 리터럴(12/13/14…)은 점진적으로 타입 스케일 토큰화 대상.
- **컴포넌트를 새로 발명하지 않는다.** 기존 화면/컴포넌트가 출발점(개선 모드). 임의 시그니처·새 디자인 언어 발명 금지.
- **이모지를 아이콘 대용으로 쓰지 않는다.** 아이콘은 SVG(react-native-svg / lucide). (단 카피·헤드라인 속 이모지는 OK.)
- **헤더는 단일 출처.** expo-router Stack 헤더를 정본으로. 화면이 `insets.top`으로 자체 상단바를 만들면
  화면마다 높이가 어긋난다 (홈 2중 헤더 사고 2026-06-07). 자체 헤더가 꼭 필요하면 단일 공용 컴포넌트로.

현재 드리프트 실측(2026-06-07): 하드코딩 hex 웹 152 / 모바일 72, fontSize raw 웹 396 / 모바일 218.
→ lint 가드는 **baseline 모드**(기존 위반 스냅샷 허용, **신규만 차단**)로 도입하고, 출시 후 ratchet으로 줄인다.
baseline은 "ratchet 안 하면 영원한 면죄부"가 되므로 줄이는 이슈를 항상 연다.

## 3. 배포 에셋 자동화

- **스토어 카피 SSOT**: `docs/store/store-copy.json` 하나. `npm run store:sync`로 iOS(store.config.json,
  EAS metadata) + Play(`docs/store/play/*.txt`) 생성. `npm run store:check`가 드리프트/길이초과를 CI에서 차단.
  iOS 반영 `npm run store:push:ios`(`eas metadata:push`). Play는 EAS Metadata 미지원 → 생성된 .txt 붙여넣기.
  **카피를 .md·콘솔에 손으로 적지 마라.** (snuboard '허위표기' 교훈.)
- **카피 진위 = 코드와 일치해야.** 스토어 문구가 실제 동작과 모순되면 심사 리젝/허위표기. 예: "위치 저장 안 함"은
  거짓이었음(카페 핀 좌표는 `venue:gps`로 영구 저장) → 이중검수가 잡음(2026-06-07).
- **게이트**: `npm run gate` = check:data + store:check + design:check + typecheck(core+web+mobile) +
  lint(next lint) + test:unit (빌드 없음 = 빠름). **단일 관문은 `apps/web/deploy.sh` 초입** — 게이트를
  거기서 돌려서 `npm run deploy:web`·`npm run -w @aircon/web deploy`·`bash deploy.sh` **어떤 경로로 불러도**
  게이트 통과해야만 wrangler deploy까지 간다(npm predeploy 훅은 root 경로만 막아 불충분 — 이중검수 지적).
  CI(check.yml)도 **같은 `npm run gate`** 단일 소스 + web build(boundary).
  - 렌더 크래시(Rules of Hooks)는 typecheck/unit이 못 잡고 build/e2e만 잡는다. deploy.sh가 자체 next build를
    하므로 배포 경로는 boundary 커버됨. 독립 사전점검은 `npm run gate:full`(= gate + build:web).
  - 배포 후 라이브 스모크: `npm run smoke`(**read-only** — prod DB 오염 금지). mutating 회귀(regressions.spec)는
    e2e.yml(push·nightly)에서만. (e2e.yml의 deploy-commit SHA 비교 미구현은 알려진 후속 — 별도 task.)
- **OTA 지문 가드(예정)**: OTA(eas update) 켜면 `@expo/fingerprint`로 네이티브 지문을 기준선과 비교해
  네이티브 변경 시 OTA 차단. 현재 OTA 비활성 → 켤 때 도입(#177).

## 4. 검수 — Codex 이중검수

큰 설계 결정·작업 완료 시 persistent(맥락 누적) + fresh(맥락 0) 두 Codex(gpt-5.5/xhigh, read-only)로
적대적 검수. **맹목 수용 금지** — 수렴하면 고신뢰, 갈리면 ground-truth로 파고들어 취사. (규칙은 글로벌 ~/.claude/CLAUDE.md.)

## 5. Things that bit us (가드의 출처)

| 사고 | 날짜 | 가드/교훈 |
|---|---|---|
| 기차 카테고리 누락 — `find()`로 primary 첫 1개만 노출 | 2026-06-07 | `filter()`로 전체. CategoryPicker. |
| 홈 2중 헤더 + iOS back button title 누출 | 2026-06-07 | index `headerShown:false` + `headerBackButtonDisplayMode:minimal`. |
| EAS Build ERRORED — root expo-router 완전 제거 | 2026-06-07 | monorepo babel-preset-expo가 root resolve 필요. 버전 정렬(제거 X). |
| 스토어 "위치 저장 안 함" 허위 — 카페 좌표는 저장 | 2026-06-07 | store-copy 진실화. 카피↔코드 일치 원칙. (이중검수 catch.) |
| copyright를 store.config root에 배치 (스키마는 apple.copyright) | 2026-06-07 | 원 JSON 스키마로 검증. doc 요약 신뢰 금지. |

새 사고가 나면 이 표에 1줄 + 코드에 "왜" 주석 + (가능하면) 가드를 추가한다.
