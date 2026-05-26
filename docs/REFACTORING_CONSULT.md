# 엔지니어링 검토 요청 — 에어컨 민주주의 (Phase 1 완료 후)

> 시니어 풀스택 엔지니어로서, **방금 끝낸 Phase 1 리팩토링의 모듈 구조**를 검토해주세요.
> 더불어 남아있는 Phase 2~4 계획에 대한 비판도 환영합니다.
> 한국어 답변 가능하면 한국어로, 코드 예시는 영어 OK.
> **저장소**: https://github.com/taegyumin/aircon-democracy (main branch — Phase 1 머지됨)

---

## 1. 서비스 컨텍스트

**에어컨 민주주의** (https://aircondemocracy.com) — 공공장소(지하철·버스·카페·강의실) 에어컨 체감을 익명으로 30초 안에 투표하는 한국어 PWA + 모바일 앱.

**규모 가정** (1년 후 목표):
- DAU 100만 (iOS 33% / Android 33% / Web 33%)
- 동시 진행 vote ~5만/min, places ~10만 개
- QR 첫 진입자 비율 50%+ (카페·식당에서 install 없이 즉시 사용이 핵심 UX)

**한국 시장 특화**:
- 검색 유입 비중 큼 (Naver/Google) → SEO 필수
- LCP 민감 (지하철 모바일 데이터 환경)
- 카카오/네이버 OAuth, 네이버 지도, 한국 공공 API 등 한국 SDK 의존

---

## 2. 기술 스택 (Phase 1 완료 직후, 2026-05-26)

```
모노레포 (Turborepo + npm workspaces)
├── apps/
│   ├── web/      — Next.js 15 (App Router, RSC + SSR), 배포: Cloudflare Pages
│   └── mobile/   — Expo SDK 51 + Expo Router (RN), iOS/Android (아직 미빌드)
├── packages/
│   └── core/     — 비즈니스 로직 (Vite/React/RN 무관 pure TS)
└── (root: CLAUDE.md, scripts/check-data.mjs, tests/e2e/, .github/workflows/)
```

**Backend**:
- Hono 4.x 단일 worker (`apps/web/src/server/hono.ts`, ~950 lines) — **Phase 2 대상**
- Cloudflare Pages Functions catch-all (`apps/web/src/app/api/[[...path]]/route.ts`) → Hono forward
- Cloudflare D1 (SQLite), KV (예정), `nodejs_compat`
- voter cookie HMAC + session JWT + OAuth(Kakao/Naver/Google) + 매칭(swopenAPI/data.go.kr)

**Frontend (web) — Phase 1 결과**:
- React 18 + Next.js 15 App Router, 거의 모든 화면이 `'use client'`
- `LocationWizardScreen.tsx`: **1402 → 65 라인** (category router만 남음)
- 5개 wizard가 각자 feature module로 분리 (`apps/web/src/screens/wizard/`)
- 스타일: inline style + 디자인 토큰 (Tamagui 미도입 — Phase 3 대상)
- 비즈니스 로직: `@aircon/core/*`

**테스트**:
- E2E (Playwright, prod 대상): **76 tests**
- Unit (Vitest): **packages/core 72 + apps/web 24 = 96 tests** (Phase 1에서 +24 추가)
- CI: GitHub Actions (check + e2e, push/PR)

---

## 3. Phase 1 완료 — 실제 모듈 구조

### 3.1 Before (한 파일)
`apps/web/src/screens/LocationWizardScreen.tsx` — **1402 라인**, 단일 컴포넌트가 모든 책임:
- 5 카테고리 (subway/train/bus/cafe/classroom) state + UI + API 호출
- SubwayWizard 안에 TrainModeBody + PlatformModeBody + StationAutocomplete
- 매번 새 카테고리 추가/필드 추가 시 이 파일이 부풀어남

### 3.2 After (feature module)
```
apps/web/src/screens/
├── LocationWizardScreen.tsx           # 65 lines, category router만
└── wizard/
    ├── categories.ts                  # Category type + CATEGORIES SoT
    ├── Label.tsx, WizardHeader.tsx    # 공통 컴포넌트
    ├── StationRow.tsx                 # WizardLanding의 nearby row
    ├── styles.ts                      # fieldStyle / primaryButtonStyle
    ├── WizardLanding.tsx              # landing (geo + category grid)
    │
    ├── bus/
    │   ├── BusWizard.tsx              # UI
    │   ├── useBusMatch.ts             # state hook (matching)
    │   ├── buildBusPlace.ts           # pure id/name builder
    │   └── __tests__/buildBusPlace.test.ts   # 4 tests
    │
    ├── train/                         # KTX/SRT/무궁화호 등
    │   ├── TrainWizard.tsx
    │   ├── SimpleSuggestInput.tsx     # 텍스트 자동완성 (역명)
    │   ├── buildTrainPlace.ts         # pure builder (segment vs type fallback)
    │   └── __tests__/buildTrainPlace.test.ts # 6 tests
    │
    ├── subway/                        # 1~9호선 + 지방 도시철도
    │   ├── SubwayWizard.tsx           # mode toggle + 두 body 라우팅
    │   ├── TrainModeBody.tsx          # "열차 안" mode
    │   ├── PlatformModeBody.tsx       # "열차 기다리는 중" mode
    │   ├── StationAutocomplete.tsx    # 역 자동완성 (Station 객체 단위)
    │   ├── useSubwayTrainMatch.ts     # 실시간 trainNo 매칭 hook
    │   ├── buildSubwayPlace.ts        # pure builder (train/platform 두 case)
    │   └── __tests__/buildSubwayPlace.test.ts # 6 tests
    │
    ├── cafe/
    │   └── CafeWizard.tsx             # NaverMapPicker wrap
    │
    └── classroom/
        └── ClassroomWizard.tsx        # SNUClassroomWizard wrap (헤더 주입)
```

### 3.3 Phase 1에서 정착한 패턴
각 wizard 모듈은 일관된 3-layer 구조:
1. **`{Name}Wizard.tsx`** — UI + 로컬 state. 부모와의 계약은 `{ onBack, onPicked, ...optional }`.
2. **`use{Name}Match.ts`** (해당 시) — side-effectful state (API call, AbortController, retry nonce 등).
3. **`build{Name}Place.ts`** — 입력 → upsertPlace payload 변환. 순수 함수, 단위 테스트 대상.

### 3.4 LocationWizardScreen.tsx의 최종 형태
```tsx
export function LocationWizardScreen({ onBack, onPicked, onRegisterFreeform }: Props) {
  const [category, setCategory] = useState<Category | null>(null);
  // ... WizardLanding용 renderHeader 1개 ...
  if (!category) return <WizardLanding ... />;
  const back = () => setCategory(null);
  switch (category) {
    case 'other':     return <CafeWizard onBack={back} onPicked={onPicked} />;
    case 'subway':    return <SubwayWizard onBack={back} onPicked={onPicked} />;
    case 'classroom': return <ClassroomWizard onBack={back} onPicked={onPicked} onFreeform={...} />;
    case 'train':     return <TrainWizard onBack={back} onPicked={onPicked} />;
    case 'bus':       return <BusWizard onBack={back} onPicked={onPicked} />;
    default:          return null;
  }
}
```

---

## 4. 검토 요청 (Phase 1 결과 비판)

### Q1. 모듈 경계
- `wizard/{category}/` 의 디렉토리 분리가 적절한가? 너무 잘게 쪼개진 건 아닌지?
- `WizardLanding`은 wizard 디렉토리 안에 있는데, 별도 sibling으로 빼는 게 나은가?
- `cafe/CafeWizard.tsx`와 `classroom/ClassroomWizard.tsx`는 단순 wrap (~30 lines)인데, 모듈로 분리할 가치가 있는지? 아니면 `LocationWizardScreen.tsx`에 inline 두는 게 나은지?

### Q2. 3-layer 패턴 (UI / hook / builder)
- 이 패턴이 React 컴포넌트 분해의 좋은 baseline인지?
- `useBusMatch.ts`와 `useSubwayTrainMatch.ts` 두 hook은 비슷한 구조 (loading + result + retry nonce). 공통 추상화(`useMatchQuery`)로 빼는 게 좋은가? 아니면 미세하게 다르므로 그대로 유지?
- pure builder 분리의 ROI — 매칭 unit test가 정말 가치 있나? E2E로 충분하지 않나?
- builder의 input/output 타입을 `@aircon/core/validation.ts`의 Zod schema와 직접 연결하는 게 옳은가, 아니면 wizard 내부 타입으로 유지하고 boundary에서만 검증?

### Q3. State 관리 (여전히 props drilling)
- TrainModeBody는 prop이 18개. drilling이 심한 편인데, **Context** vs **prop 유지** vs **상태를 더 위로/아래로** 중 어떤 방향이 맞나?
- SubwayWizard의 `bumpNonce()` 패턴 — useEffect 강제 refire를 위한 nonce — 이게 React idiom인가, 아니면 안티패턴인가? (배경: 사용자가 "변경" 버튼으로 같은 역 재선택해도 매칭이 안 됐던 버그 발견 후 추가)

### Q4. 누락된 테스트
- 현재 unit test는 pure builder 3개에 16개. Integration 측면에선 hook (useBusMatch, useSubwayTrainMatch)도 테스트 가치가 있나? react-testing-library + msw로?
- Phase 1의 모든 wizard에 대해 컴포넌트 테스트 (render + interaction)를 도입하는 게 ROI 있나, 아니면 E2E로 충분?

### Q5. SubwayWizard의 복잡도
- 가장 큰 모듈 (`SubwayWizard.tsx` ~220 lines + 5 sub-files). 더 분해할 여지가 있나?
- `prevSuggestions`/`nextSuggestions`의 useMemo 로직 — neighborNames + STATIONS 필터링 — 이걸 hook (`useStationSuggestions`)로 빼는 게 옳은가?

### Q6. 디자인 토큰의 inline style 패턴
- 모든 컴포넌트가 `style={{ background: TOKEN.bg, fontFamily: FONT, ... }}` 형태로 매번 객체 생성. 성능 영향 미미하지만, Vanilla Extract / Tailwind / CSS Modules로 옮길 시점은?
- 이게 Phase 3 (디자인 시스템) 도입의 진짜 motivator 인가, 아니면 web↔mobile 공유가 더 큰 motivator 인가?

---

## 5. 남은 Phase 2~4 계획 (간략)

### Phase 2 — Hono server 분리 (~950 lines → 라우터 조립)
- `apps/web/src/server/routes/` 디렉토리: `auth.ts`, `places.ts`, `votes.ts`, `realtime.ts`, `me.ts`, `health.ts`
- `apps/web/src/server/middleware/`: voter cookie, csrf, rate-limit adapter
- OAuth provider 추상화 (kakao/naver/google 거의 동일 패턴 3번 반복) → `OAuthProvider` interface
- Hono `c.env` 접근 패턴 유지 vs DI 컨테이너 (Effect.TS 등) 도입?

### Phase 3 — 디자인 시스템
- `packages/ui/` 패키지 — web과 mobile 공통 컴포넌트
- 디자인 토큰 single source (현재 `@aircon/core/tokens.ts`)
- **선택지**: Tamagui vs Vanilla Extract vs NativeWind vs Stitches vs 그냥 분리 유지 (토큰만 공유)
- 다크 모드 + 한국 모바일 사파리 호환성

### Phase 4 — State / 데이터 fetching
- TanStack Query 도입 — `/api/places/:id` GET invalidation, optimistic update, polling 패턴 정리
- 클라이언트 state (favorites/recentPlaces localStorage) → Zustand or as-is?
- vote polling (5초 setInterval) → `useQuery({ refetchInterval })` or SSE/WebSocket?

### 그 외 backlog
- `packages/core/src/subwayDirection.ts` station sequence 하드코딩 → JSON 분리 (1~9호선 각 30~50역)
- 97 ghost subway stations cleanup (lat/lng 채우기)
- E2E를 mobile에도 (Maestro)
- 버스 wizard 자동완성 — data.go.kr "버스노선조회" + "버스정류장조회" 데이터셋 활성화 후 dropdown (현재 freeform)
- 단방향 노선 7개 updnLine 매핑 cross-check (2호선만 doc과 반대였음. 1/3/4/5/6/7/8/9호선도 같은 quirk 가능)

---

## 6. 검토 요청 (Phase 2~4 우선순위)

### Q7. Phase 2 (Hono 분리) 우선순위
- Phase 1 직후 Phase 2를 바로 가는 게 맞나, 아니면 **데이터 무결성 backlog** (97 ghost + updnLine cross-check)를 먼저 처리하는 게 ROI 큰가?
- OAuth provider 추상화 — interface 1개 vs base class vs HOF 중 무엇이 적절?

### Q8. Phase 3 (디자인 시스템) 도입 시점
- 100만 DAU 도달 전에 web↔mobile UI 분리 유지하는 게 빠른가, 아니면 지금 합치는 게 미래 부채를 줄이나?
- **Tamagui**가 한국 모바일 사파리 (특히 iOS 15 이하)에서 어떤지 — 실 사용 경험 있으면 공유 부탁.

### Q9. Phase 4 vs 인프라
- TanStack Query 도입의 진짜 가치는 무엇인지 (cache invalidation? optimistic? polling?). DAU 100만에서 D1 read 부하가 임계가 되기 전에 클라이언트 캐싱이 필요한가?
- Cloudflare D1 (SQLite, edge) → PostgreSQL (Neon/Supabase) 이전 시점은? D1의 동시성·쓰기 throughput 한계는?

### Q10. 한국 시장 특화 (Phase 1 결과와 무관, but 자문 환영)
- **swopenAPI doc vs 실제 응답 불일치** (2호선 updnLine 반대). 외부 데이터 doc 신뢰도 낮은 환경에서, **자동 cross-check + 회귀 방지** 패턴 추천?
  - 현재: 또타지하철과 수동 비교로 발견 → 매칭 방향 E2E 회귀 테스트로 박음.
  - 더 robust한 패턴 (snapshot test, contract test 등)?
- Naver bot (Yeti)이 Next.js 15 App Router + edge runtime + 클라이언트 컴포넌트 위주 페이지를 잘 인덱싱하는지?

### Q11. 테스트 전략
- 현재: E2E 76 (prod 대상) + Unit 96 (core 72 + web 24).
- 빠진 영역: integration test (hono routes), 컴포넌트 test (apps/web), mobile e2e (apps/mobile)
- E2E prod 대상 → preview deployment 대상으로 옮기는 시점은? (PR-per-feature에서 GitHub Actions가 매 PR마다 prod 치는 비용이 우려됨)

---

## 7. 검토 형식

다음 형식이 가장 도움됩니다:

1. **Phase 1 결과에 대한 비판** (Q1~Q6) — 어떤 부분이 over-engineered인지, 어떤 부분이 under-engineered인지
2. **Phase 2~4 우선순위 재조정** (Q7~Q9) — 빠진 큰 그림이 있는지
3. **한국 시장 / 인프라 / 테스트** (Q10~Q11) — 자신 있는 영역만
4. **제가 못 본 것** — Phase 1 모듈 구조의 미래 함정, 안티패턴, 더 좋은 아키텍처 대안

---

## 8. 핵심 파일 (검토 시 참고)

### Phase 1 신규 파일
- `apps/web/src/screens/LocationWizardScreen.tsx` (65 lines, category router)
- `apps/web/src/screens/wizard/bus/{BusWizard.tsx, useBusMatch.ts, buildBusPlace.ts}`
- `apps/web/src/screens/wizard/train/{TrainWizard.tsx, SimpleSuggestInput.tsx, buildTrainPlace.ts}`
- `apps/web/src/screens/wizard/subway/{SubwayWizard.tsx, TrainModeBody.tsx, PlatformModeBody.tsx, StationAutocomplete.tsx, useSubwayTrainMatch.ts, buildSubwayPlace.ts}`
- `apps/web/src/screens/wizard/cafe/CafeWizard.tsx`, `wizard/classroom/ClassroomWizard.tsx`

### 비즈니스 로직 / 백엔드 (Phase 2~ 검토 시)
- `apps/web/src/server/hono.ts` (~950 lines, Phase 2 대상)
- `apps/web/src/server/__tests__/csrf.test.ts` (Phase 0에서 추가한 8개 integration test)
- `packages/core/src/validation.ts` (Phase 0에서 추가한 Zod boundary schemas)
- `packages/core/src/subwayDirection.ts` (2호선 quirk swap 처리)
- `packages/core/src/subwayGraph.ts`, `snu.ts`, `yonsei.ts`
- 진입점: `apps/web/src/app/page.tsx`, `apps/web/src/app/api/[[...path]]/route.ts`
- 회귀 테스트: `tests/e2e/regressions.spec.ts`
- 규칙: `CLAUDE.md`

### 최근 완료된 작업 (참고)
- Tier 3 (PWA + Capacitor) → Tier 1 (Expo + Next.js) 마이그레이션 완료
- Phase 0: schema fix(migration 0003) + Zod validation + Hono integration test + swopenAPI cross-check
- Phase 1: LocationWizardScreen 1402 → 65 라인, wizard feature module 5개로 분리 (이 문서가 검토 요청하는 변경)

감사합니다!
