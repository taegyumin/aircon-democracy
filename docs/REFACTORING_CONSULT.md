# 리팩토링 자문 요청 — 에어컨 민주주의 (Aircon Democracy)

> 시니어 풀스택 엔지니어로서 아래 코드베이스의 리팩토링 전략을 자문해주세요.
> 제가 세운 계획에 대한 **비판 + 더 나은 대안** 둘 다 환영합니다.
> 한국어 답변 가능하면 한국어로, 코드 예시는 영어 OK.

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

## 2. 기술 스택 (Tier 1 마이그레이션 직후)

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
- Hono 4.x 단일 worker (`apps/web/src/server/hono.ts`, ~950 lines)
- Cloudflare Pages Functions catch-all route handler (`apps/web/src/app/api/[[...path]]/route.ts`) → Hono forward
- Cloudflare D1 (SQLite), KV (예정), `nodejs_compat`
- 같은 worker가 voter cookie (HMAC), session JWT, OAuth (Kakao/Naver/Google), 매칭(Seoul subway/data.go.kr bus) 다 처리

**Frontend (web)**:
- React 18 + Next.js 15 App Router
- 거의 모든 화면이 `'use client'` (mobile-first SPA-like UX, 점진 RSC 마이그레이션 예정)
- `LocationWizardScreen.tsx` — **~1200 lines 단일 파일** (4가지 카테고리 wizard + SubwayWizard + WizardLanding + helpers)
- 스타일: inline style (CSS-in-JS 없음, Tamagui 미도입)
- 비즈니스 로직 의존: `@aircon/core/*` (subway graph, 매칭 알고리즘, brands, snu/yonsei 데이터)

**Frontend (mobile)**:
- Expo Router file-based routes (`apps/mobile/app/`)
- 같은 `@aircon/core` 의존
- UI는 RN primitives (View/Text/Pressable), 디자인 토큰만 공유

**테스트**:
- E2E (Playwright, prod 대상): **76 tests** (회귀 + 핵심 흐름 + API + 매칭 방향 + SSR/Hydration + sitemap)
- Unit (Vitest, packages/core): **56 tests** (subwayDirection, subwayGraph, geo, search, train, universities)
- CI: GitHub Actions (check + e2e, push/PR)

**최근 마이그레이션 상태 (2026-05-26)**:
- Tier 3 (PWA + Capacitor + Vite) → Tier 1 (Expo + Next.js + Hono) 완료
- prod 도메인 cutover 완료, legacy root (`src/`, `vite.config.ts`, `functions/`, `public/`, `wrangler.toml`, `android/`, `ios/`) 다 폐기됨
- Capacitor 전면 제거 (Expo로 대체), Vite 제거 (Next.js로 대체)

**저장소**: https://github.com/taegyumin/aircon-democracy

---

## 3. 발견된 코드 냄새 / 페인 포인트

### A. `apps/web/src/screens/LocationWizardScreen.tsx` (1200 lines)
하나의 컴포넌트가 너무 많은 책임을 짐:
- 4가지 카테고리 (subway/bus/cafe/classroom) state + UI 한 곳에
- SubwayWizard 내부에 TrainModeBody + PlatformModeBody + 매칭 흐름
- WizardLanding(랜딩) + 카테고리 picker
- API 호출 (`api.matchSubwayTrain`, `api.upsertPlace`) 와 UI가 강결합
- 매번 새 카테고리 추가할 때마다 이 파일이 부풀어남

### B. `apps/web/src/server/hono.ts` (~950 lines)
- 13개 endpoint (auth × 6 + places × 4 + realtime × 2 + me + logout) 한 파일
- voter cookie 미들웨어, csrf guard adapter, place validation, rate limit, audit log 다 inline
- `_abuse.ts`에 helpers 있지만 hono.ts 안에서 여전히 길다
- OAuth provider별 (kakao/naver/google) 패턴 거의 동일한 코드 3번 반복

### C. 클라이언트 컴포넌트 boundary
- `apps/web/src/components/*` 8개 다 `'use client'` (점진 RSC로 옮길 후보 있음 — Icons, ResultBar, PlaceTypeIcon)
- 비즈니스 로직 (favorites/recentPlaces localStorage) 이 hooks와 컴포넌트에 분산

### D. State 관리
- 현재: 컴포넌트 local `useState` + props drilling
- favorites/recentPlaces — localStorage 직접 (TanStack Query / Zustand / Jotai 미사용)
- vote 결과 polling (5초 setInterval) — invalidation 패턴 깔끔하지 않음

### E. 스타일링
- 모든 화면이 inline style + token 상수 (`@aircon/core/tokens.ts`)
- Tailwind/Tamagui/Stitches 등 미사용
- 다크 모드 미지원
- 디자인 토큰이 코드에 박혀있음 (`TOKEN.cold`, `TOKEN.bg` 등)
- web과 mobile의 컴포넌트 코드 분리 (공유 X)

### F. 데이터 무결성
- `packages/core/src/data/subway-stations.json`에 **lat/lng 누락 ghost 97개** (warning 처리 중)
- 1회 동대문역 ghost 사용자 발견 후 check-data.mjs로 known bad fail. 다른 ghost는 backlog

### G. 매칭 알고리즘
- `packages/core/src/subwayDirection.ts`에 1~9호선 sequence 정적 하드코딩 (각 노선 ~30~50역)
- 향후 노선 변경/신설 시 코드 수정. JSON 데이터로 빼는 게 좋을 수도
- 2호선만 외선/내선 wrap-around 특수 처리 (switch-case 늘어남)
- **외부 API doc vs 실제 응답 불일치**: swopenAPI 공식 doc은 `updnLine '0' = 상행/내선, '1' = 하행/외선`이라 하지만 2호선 실제 응답은 반대. 사용자가 또타지하철과 비교로 발견. 단방향 노선(1/3/4/5/6/7/8/9호선)도 같은 quirk 가능. 외부 데이터 doc 신뢰도 검증 + 자동 cross-check 패턴 필요.
- 거리 기반 fallback (±3 정거장 sequence 내 가장 가까운 차량) 추가됨 — 차량 헤드웨이 큰 시점 대비.

### H. 모바일 ↔ 웹 UI 중복
- HomeScreen, SubwayWizard, VoteScreen, LoginScreen — 거의 동일한 시각 디자인을 web (React DOM) + mobile (RN) 두 번 작성
- 비즈니스 로직만 `@aircon/core` 공유, UI는 별도

---

## 4. 제가 세운 리팩토링 계획 (4단계, ROI 순)

### Phase 1 — LocationWizardScreen 분해
- `apps/web/src/screens/wizard/` 디렉토리 생성
  - `WizardLanding.tsx` (랜딩 — 4 카테고리 grid + nearby geo)
  - `SubwayWizard.tsx` (TrainModeBody + PlatformModeBody 분리, 매칭 carved out)
  - `BusWizard.tsx`, `CafeWizard.tsx`, `ClassroomWizard.tsx` (이미 분리된 형태로 추출)
  - `SubwayTrainMatchCard.tsx` (매칭 결과 카드 + 호차 picker)
  - `useStationAutocomplete.ts` (인접역 자동완성 hook)

### Phase 2 — Hono server 분리
- `apps/web/src/server/routes/` 디렉토리:
  - `auth.ts` (kakao/naver/google OAuth — provider config로 추상화)
  - `places.ts` (list/get/upsert/create)
  - `votes.ts` (post/delete)
  - `realtime.ts` (subway/bus match)
  - `me.ts`, `health.ts`
- `apps/web/src/server/middleware/` (voter cookie, csrf, rate-limit adapter)
- `apps/web/src/server/hono.ts` → 라우터 조립만 (~50 lines)
- OAuth 추상화: `OAuthProvider` interface (authorizeUrl, tokenExchange, userInfo) 로 3개 provider 공통화

### Phase 3 — 디자인 시스템 (Tamagui 또는 Vanilla Extract)
- `packages/ui/` 패키지 생성
- web과 mobile 공통 컴포넌트: `<Button>`, `<Card>`, `<Pressable>`, `<Text>`
- 디자인 토큰은 single source of truth (현재 `@aircon/core/tokens.ts`)
- 다크 모드 지원 + 한국 모바일 사파리 호환성 검증

### Phase 4 — State 관리 + 데이터 fetching
- TanStack Query (React Query) 도입
  - `/api/places/:id` GET → invalidation + optimistic update
  - vote post → cache invalidate
  - polling 패턴 `useQuery({ refetchInterval })` 로 깔끔하게
- 클라이언트 state (favorites, recentPlaces) → Zustand 또는 그대로 (localStorage hook)

### 그 외 (별도 sprint)
- `packages/core/src/subwayDirection.ts` 데이터를 JSON으로 분리
- 97 ghost stations cleanup (lat/lng 채우기)
- E2E를 mobile에도 (Maestro)
- **버스 wizard 자동완성** — data.go.kr "서울특별시_버스노선조회" + "버스정류장조회" 데이터셋 활성화 후 노선/정류장 dropdown (현재 freeform)
- 단방향 노선 7개 updnLine 매핑 cross-check (2호선처럼 doc과 다를 가능성)

---

## 5. 자문 요청 항목

### Q1. 우선순위
이 4 phase 순서가 합리적인지? 더 큰 ROI 가진 작업이 있는지?

### Q2. LocationWizardScreen 분해 전략
- 그냥 파일 쪼개기 (Phase 1) vs **state machine (XState)** 도입
- React Hook Form? Zod 검증?
- 카테고리별 wizard는 정말 별도 컴포넌트인가, 아니면 step 패턴(common shell + step config)?

### Q3. Hono 서버 분리
- 13 endpoint 단일 worker 유지 vs Cloudflare Workers Routes 분리
- OAuth provider 추상화의 옳은 추상도? (interface 1개 vs base class vs HOF)
- D1 binding 접근 패턴 — Hono의 `c.env` vs DI 컨테이너 (Effect.TS 등)

### Q4. 디자인 시스템
- **Tamagui** vs Vanilla Extract vs Stitches vs NativeWind vs UnoCSS — 우리 use case (단일 codebase로 web + mobile + 한국 SDK 호환) 에서 무엇이 최적?
- 또는 **분리 유지** + 디자인 토큰만 공유?

### Q5. State / 데이터 fetching
- TanStack Query vs SWR vs Server Components + Server Actions
- vote polling을 SSE/WebSocket으로 옮기는 시점은 언제 (DAU 기준)?
- localStorage 기반 favorites를 server-synced로 옮기는 트레이드오프

### Q6. 데이터 모델 / 비즈니스 로직
- `packages/core/src/subwayDirection.ts` 의 station sequence 하드코딩 → JSON 분리 ROI
- `subwayGraph.ts` 의 city/line 디스앰비기 로직 — graph library (graphlib 등) 도입?
- 매칭 알고리즘 (방향 검증 + sequence 거리 fallback) — 더 robust한 패턴?

### Q7. 테스트 전략
- 현재: E2E 76 (prod 대상) + Unit 56 (packages/core)
- 빠진 영역: integration test (hono routes), 컴포넌트 test (apps/web), mobile e2e (apps/mobile)
- vitest + react-testing-library 도입 시점?
- e2e prod 대상 → CI에서 매번 prod 치기 vs preview deployment 대상

### Q8. 모노레포 도구
- Turborepo로 충분 vs Nx 이전
- packages 더 쪼개기 (`@aircon/api-client`, `@aircon/ui`, `@aircon/data`)?

### Q9. Cloudflare 의존
- 100만 DAU에서 Cloudflare Pages + D1로 충분한가?
- D1 → PostgreSQL (Neon/Supabase) 이전 시점?
- Workers KV의 일관성 모델 (eventual) 이 vote count에 OK?

### Q10. 보안 / 어뷰징
- 현재: voter cookie HMAC + rate limit (D1 buckets) + CSRF origin check + audit_events
- "100만 DAU + QR 인쇄/스캔" 환경에서 봇/스팸/협동 어뷰징 방어 충분?
- Cloudflare Turnstile, hCaptcha 도입 시점?

### Q11. 한국 시장 특화
- SEO: Naver bot (Yeti) 가 RSC + edge runtime 잘 인덱싱하나? 사전 렌더 vs SSG 전략?
- 카카오 SDK quirks?
- 한국 PG (결제) 도입 시 (앱 등록자 유료 기능 등) 어떤 라이브러리?
- **한국 공공 API의 doc 신뢰도가 낮음** (swopenAPI updnLine, data.go.kr response shape 등). 자동 cross-check + 회귀 방지 패턴? 빌드 단계 데이터셋 sanity check 어떻게 박을지?

---

## 6. 추가 정보

### 핵심 파일 (검토 시 참고)
- 비즈니스 로직: `packages/core/src/subwayDirection.ts`, `subwayGraph.ts`, `snu.ts`, `yonsei.ts`
- 백엔드: `apps/web/src/server/hono.ts`, `apps/web/src/server/_abuse.ts`
- 가장 큰 화면: `apps/web/src/screens/LocationWizardScreen.tsx`
- 진입점: `apps/web/src/app/page.tsx`, `apps/web/src/app/api/[[...path]]/route.ts`
- 테스트: `tests/e2e/regressions.spec.ts`, `packages/core/src/__tests__/*.test.ts`
- 인프라: `apps/web/wrangler.toml`, `apps/web/next.config.ts`
- 규칙: `CLAUDE.md`

### 최근 결정사항 (참고)
- Tier 3 (PWA + Capacitor) → Tier 1 (Expo + Next.js) 마이그레이션 완료 (1주 작업)
- Capacitor 전면 폐기, mobile은 Expo만
- 검색창 제거 (UX 흐름이 카테고리별로 너무 달라 통합 검색 의미 없음)
- 카카오/네이버/구글 OAuth 동작 중, 카카오는 동의항목 / 일부 quirks
- prod 도메인 이미 cutover 완료 (`aircondemocracy.com` → 새 CF Pages project)

---

## 7. 자문 형식

다음 형식으로 답변해주시면 가장 도움됩니다:

1. **제 계획에 대한 비판** (어떤 phase가 우선순위 잘못 됐는지, 빠진 게 무엇인지)
2. **각 Q에 대한 답변** (모든 Q 답할 필요는 없음 — 가장 자신 있는 영역 위주로)
3. **제가 못 본 것** (코드 냄새, 안티패턴, 미래의 함정)
4. **구체적 코드 예시** (특히 OAuth 추상화, Hono 분리 패턴)

감사합니다!
