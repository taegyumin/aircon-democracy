# 에어컨 민주주의 — 코드 스타일·가독성·lint rule 리뷰 요청 (V4)

수신: 외부 LLM
요청자: PM 겸 비전 결정자 (엔지니어링 디테일 위임)
시점: 2026-05-29
**전제**: V3 (`REFACTOR_REVIEW_PROMPT_V3.md`)는 아키텍처/구조에 집중. 이 V4는 그 아래 레이어 — **코드 스타일·가독성·lint rule·micro idiom**.

---

## 0. V3와의 경계

V3에서 다루지 **않는** 것을 여기서 다룬다:
- 함수/변수/타입 **네이밍 일관성** (영문/한글 혼용 정책 포함)
- 한 함수·한 컴포넌트의 **줄 수 / 책임 분리** 임계
- **early return vs nested if**, **guard clause** 활용도
- **type vs interface**, **as cast vs satisfies**, **Discriminated Union** 패턴 일관성
- **JSDoc / 주석 가이드라인** — "왜"만 쓰고 "무엇"은 안 쓴다 vs 현실
- **import 순서** (외부 / 모노레포 / 상대), **circular import** 위험
- **dead code / unused exports / 미사용 props**
- **magic number / string literal** vs 상수 추출 임계
- **error message 톤 일관성** (사용자 표시 한국어 / 개발자 로그 영문 분리?)
- **RN style 패턴** — StyleSheet.create vs inline, `!!value && styles.X` narrowing 패턴
- **CSS-in-JS 스타일** (`apps/web/src/screens/wizard/styles.ts`) 토큰 사용 일관성

---

## 1. 봐달라는 구체 항목

### 1A. 일관성 (codebase 전반)
1. **네이밍 컨벤션**
   - 파일명: kebab vs camel vs Pascal — wizard 폴더는 PascalCase, route handler는 camelCase 인데 혼재 OK?
   - 함수: `verifyTrain` `listTrainCities` 처럼 동사+명사 vs `tryMatch` `handleDepChange` 처럼 의도 prefix — 정책?
   - 한국어 주석 vs 영어 식별자 — 도메인 용어(역명·노선)는 한글 OK, 코드 식별자는 영문 강제?
   - boolean: `is/has/can/should` prefix 일관성. `matched`, `verifying`, `cancelled` 어디까지 OK?
   - place ID schema 콜론(`subway:platform:...`) vs 하이픈 prefix(`subway-station:...`) inconsistency — 이건 도메인 결정이지만 prefix 패턴은 통일하는 게 좋을지?
2. **타입 선언**
   - `interface` vs `type` 사용 임계 (현재 mixed). 도메인 모델은 `interface`, union·utility는 `type`이 일반적 권장. 코드가 그렇게 되어 있나?
   - `as` cast 사용처 — 도메인 boundary 밖에서 새고 있는 곳?
   - `satisfies` 활용 기회를 놓치고 있는 곳?
   - `unknown` 사용처가 `any`로 회피되고 있지 않은지
3. **함수/컴포넌트 사이즈**
   - 100+ 라인 함수/컴포넌트: 어디? 책임 분리 후보?
   - `useEffect` 안에 100+ 라인 IIFE 패턴 (cherry-pick 후 자주 발생) 발견되면 분리 제안
   - JSX nesting 깊이 4+ 컴포넌트: extract 후보?
4. **Hook 사용 패턴**
   - 같은 데이터 fetching 패턴이 wizard마다 다른 모양으로 반복되고 있는지 (useEffect + cancelled flag + AbortController + race seq ref의 4가지 변형이 존재)
   - 표준 hook (`useCancelableEffect`, `useDebouncedFetch`)으로 묶을 가치 있는 패턴
5. **Error 처리 idiom**
   - `try/catch` 안에서 `setError((e as Error).message)` 패턴 반복 — helper로 빼는 게 좋을지
   - 사용자 표시 메시지의 한국어 mapping이 wizard 안에 inline (예: `error === 'not_found' ? '해당 열차를…'`) — 상수 테이블로?

### 1B. 가독성 (한 파일 단위)
1. **early return / guard clause** — `if (!x) return;` 활용 vs nested if
2. **state 묶기** — 너무 많은 useState (예: TrainTagoVerifyWizard 12개) → useReducer 후보?
3. **계산식 가독성**
   - `${runDt}${depHour.padStart(2, '0')}${depMin.padStart(2, '0')}` 같은 인라인 string concat — 헬퍼?
   - regex 인라인 (예: `/^(.+) \((.+)\)$/`) — 의도 적힌 상수로 빼는 게 좋을지
4. **JSX style props** — web에선 inline `style={{}}`, mobile에선 `StyleSheet.create` — 정책이지만 inline style이 30+ 줄로 길어지는 곳이 있나?
5. **주석**
   - 코드 위 한국어 코멘트가 **왜**를 설명하는가 (좋음), **무엇**을 설명하는가 (나쁨) — 분포 평가
   - 모든 파일 상단의 한 줄 요약 코멘트 일관성 (예: `// Mobile 기차 wizard (RN) — web TrainTagoVerifyWizard 포팅.`)

### 1C. Lint rule 후보 (자동화 가능한 것)
이 codebase에 추가하면 좋을 ESLint rule들:
- `@typescript-eslint/no-explicit-any` (이미 적용?)
- `@typescript-eslint/consistent-type-definitions` (interface 또는 type 강제)
- `@typescript-eslint/consistent-type-imports`
- `@typescript-eslint/no-unnecessary-condition`
- `react/jsx-key` — 이미 적용?
- `react-hooks/exhaustive-deps` — 적용된 걸로 알고 있는데 violation 잔존?
- `no-magic-numbers` — 너무 strict? wizard car 1~20 같은 건 OK?
- `unicorn/prefer-*` — 부분 적용 가치?
- import 순서: `eslint-plugin-import` 순서 규칙
- React Native: `react-native/no-inline-styles` 같은 RN 전용

권장 rule + 위반 예시 + 우선순위 (P0/P1/P2) 형식으로.

### 1D. RN 특화 idiom
1. `style={[styles.X, condition && styles.Y]}` 의 `condition`이 empty string일 때 narrowing fail (`!!` 강제 필요) — sweep으로 다 잡혔는지
2. `Pressable` vs `TouchableOpacity` 일관성
3. `keyboardType="numeric"` vs `inputMode` (web)
4. `SafeAreaView` from `react-native-safe-area-context` vs RN 내장 일관성
5. `expo-router`의 `router.push` vs `replace` 사용 — back-stack 의도가 맞는지

---

## 2. 산출물 형식

### (A) 일관성 점수 (1~5) per 항목 + 한 줄 평가
| 항목 | 점수 | 평가 |
|---|---|---|
| 네이밍 (파일/함수/타입) | ? | |
| 타입 선언 (interface/type/cast) | ? | |
| 함수·컴포넌트 사이즈 | ? | |
| Hook 사용 패턴 | ? | |
| 에러 처리 idiom | ? | |
| 주석 가이드라인 | ? | |
| RN/web style 일관성 | ? | |
| import 순서·구조 | ? | |

### (B) "지금 당장 자동화 가능" — ESLint rule 추가 권장 목록
- rule 이름 / 적용 패키지 / 예상 위반 건수 (대략) / 우선순위 / 수정 노력

### (C) "사람이 봐야 잡힘" — 가독성 개선 후보 Top 10
- 파일:라인 + 현재 / 제안 / 이유 (한 줄씩)
- 한 코드블록 줄 수 ≤ 10줄로 압축한 before/after 보여주기

### (D) 코드 스타일 가이드 한 페이지 (.md 형식)
이 codebase 에 맞춘 미니멀 스타일 가이드. 다음 항목:
- 네이밍 (파일/함수/변수/boolean/type)
- 한국어/영어 사용 정책 (주석/식별자/사용자 메시지)
- 타입 선언 (interface vs type, as 금지 영역)
- 에러 처리 (사용자 표시 vs 개발자 log)
- Hook 패턴 (race 방지 표준)
- 주석 (왜만 쓴다 — 예시 포함)
- import 순서

가독성 위주, 강제 rule은 1A/1B/1C로 분리. PM이 그대로 `CODE_STYLE_GUIDE.md`로 commit 가능한 수준이면 좋음.

---

## 3. 톤·범위

- "best practice"를 일반론으로 들이밀지 말기. **이 codebase에서 발생한 패턴** 기준.
- 큰 그림 (모노레포 split, framework 교체 등) 은 V3 영역 — 여기선 다루지 말기.
- prod-affecting change (API signature 변경 등)도 V3 영역.
- 여기서 다루는 변경은 모두 **behavior preserving refactor** 한정.
- "이 정도면 OK"라고 판단되는 영역은 점수+근거만 적고 작업 목록에 안 올림.

---

## 4. 참고 파일

- 기존 docs: `CODE_AUDIT_PROMPT.md`, `CODE_REVIEW_FRESH.md`, `CODE_REVIEW_ROUND3.md`, `REVIEW_V2_FINAL_REPORT.md` — 과거 리뷰 결과/지적 사항. 중복 회피.
- V3: `REFACTOR_REVIEW_PROMPT_V3.md` — 큰 그림 + 디테일(아키텍처 레벨)
- 헌법: `CLAUDE.md`
- ESLint 현재 설정: 루트의 eslint config (확인하고 빠진 rule만 제안)

---

## 5. 시작 추천

1. `eslint.config.*` 먼저 읽고 현재 rule 파악
2. `apps/web/src/screens/wizard/` 에서 wizard 3개 (subway/train/bus) 정독 — 패턴 비교 가능
3. `apps/mobile/app/wizard/` 와 비교 — RN/web idiom diff
4. `packages/core/src/` — 도메인 타입 / hook / data
5. 산출물 (D) 스타일 가이드는 마지막에 쓰면 모순 안 남음
