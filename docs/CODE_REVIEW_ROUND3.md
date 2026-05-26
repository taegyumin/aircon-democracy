# 코드 리뷰 요청 (3차) — 에어컨 민주주의

> 시니어 풀스택 엔지니어로서, **이전 검토 이력은 무시하고 fresh eyes로** 이 코드베이스를 검토해주세요.
> 우리가 이미 받은 두 번의 리뷰가 있었고 대부분 반영했습니다. 그래서 이번엔 **다른 시각의 새 발견**을 기대하고 있습니다.
> 한국어 답변 OK, 코드 예시는 영어 OK.
> **저장소**: https://github.com/taegyumin/aircon-democracy (main branch)

---

## 1. 서비스 한 줄

**에어컨 민주주의** (https://aircondemocracy.com) — 공공장소(지하철·기차·버스·카페·강의실)의 에어컨 체감을 익명으로 30초 안에 투표하는 한국어 PWA + (예정) iOS/Android 앱.

**목표 규모** (12개월): DAU 100만, 동시 vote ~5만/min, places 10만 개. 현재 prod 트래픽은 그 일부.

**핵심 흐름**: QR/지도/카테고리로 장소 식별 → cold/ok/hot 익명 vote (1시간 후 expire, voter당 1 vote, 변경 시 30s cooldown) → 결과 즉시 표시.

---

## 2. 기술 스택 + 코드베이스 (현재 상태)

```
aircon-democracy/                       Turborepo + npm workspaces
├── apps/
│   ├── web/                            Next.js 15 (App Router) + Hono on CF Pages
│   │   ├── src/app/                    page.tsx(SSR), HomeRoute, /p/[id]/, /api/[[...path]]/, sitemap
│   │   ├── src/screens/                client screens
│   │   │   ├── LocationWizardScreen.tsx (47 lines — category router)
│   │   │   ├── HomeScreen.tsx          (345 lines, initialPlaces prop으로 SSR-injected)
│   │   │   ├── VoteScreen.tsx          (440)
│   │   │   ├── RegisterScreen.tsx      (428)
│   │   │   ├── QRScreen.tsx, LoginScreen.tsx
│   │   │   └── wizard/                 5개 feature module + landing
│   │   │       ├── WizardLanding.tsx, WizardHeader.tsx, Label.tsx, styles.ts
│   │   │       ├── categories.ts, StationRow.tsx
│   │   │       ├── bus/   {BusWizard, useBusMatch + freshenBusMatch helper, buildBusPlace} + 2 test files
│   │   │       ├── train/ {TrainWizard, SimpleSuggestInput, buildTrainPlace} + tests
│   │   │       ├── subway/{SubwayWizard, TrainModeBody, PlatformModeBody, StationAutocomplete,
│   │   │       │           useSubwayTrainMatch, buildSubwayPlace} + tests
│   │   │       ├── cafe/CafeWizard.tsx
│   │   │       └── classroom/
│   │   │           ├── ClassroomWizard.tsx       (entry wrap)
│   │   │           ├── snu/SNUClassroomWizard.tsx (678 — 가장 큰 파일)
│   │   │           └── yonsei/YonseiClassroomWizard.tsx (336)
│   │   └── src/server/
│   │       ├── hono.ts                 (35 lines — composition only)
│   │       ├── types.ts                (Bindings, Vars, cookie/business consts)
│   │       ├── cookies.ts              (hmacSign, verifyCookie, voterCookieMiddleware)
│   │       ├── abuse-adapter.ts        (Hono Context → _abuse.ts adapter + durMs observability)
│   │       ├── _abuse.ts               (csrfGuard, rate-limit, place validation — Zod 위임)
│   │       ├── oauth/                  {types, kakao, naver, google, index}
│   │       ├── routes/                 {auth, places, votes, realtime}.ts
│   │       └── __tests__/csrf.test.ts  (8 integration tests)
│   └── mobile/                         Expo SDK 51 (RN, 아직 미빌드)
└── packages/
    ├── core/                           pure TS 도메인 로직
    │   ├── api.ts                      createApiClient factory + default `api`
    │   ├── validation.ts               Zod boundary schemas (실제 SOT)
    │   ├── subwayDirection.ts          1~9호선 + 2호선 swap quirk + cross-check 자동화 스크립트
    │   ├── subway.ts, subwayGraph.ts, train.ts
    │   ├── snu.ts, yonsei.ts           학교 데이터
    │   ├── data/                       subway-stations.json(~3500행, 97 ghost),
    │   │                               train-routes.json, snu-rooms.json
    │   └── __tests__/                  77 tests
    └── ui/                             (빈 — Phase 3)
```

**규모**: 102 TS/TSX 파일, ~11,133 라인 (테스트 포함).

**가장 큰 파일들 (검토 우선순위)**:
- `SNUClassroomWizard.tsx` 678 — 학교 picker + SNU search/college/building views + Yonsei wrap
- `VoteScreen.tsx` 440 — 투표 + polling + withdraw
- `RegisterScreen.tsx` 428 — freeform 장소 등록
- `_abuse.ts` 371 — voter cookie HMAC, csrf, rate-limit, validatePlaceInput
- `HomeScreen.tsx` 345
- `YonseiClassroomWizard.tsx` 336

---

## 3. 인프라 + 데이터 모델 (간략)

- **호스팅**: Cloudflare Pages (Next.js + Hono Worker as catch-all `/api/*`).
- **DB**: Cloudflare D1 (SQLite, single-region) — `places`, `votes`, `audit_events`, `kv_buckets`(rate-limit), `users`.
- **Secrets**: `~/.aircon-env`에 로컬, wrangler secret으로 prod.
- **Auth**: 카카오/네이버/구글 OAuth → JWT (SESSION_SECRET), 별도로 익명 voter cookie HMAC.
- **CSP/CORS**: same-origin only + `X-Aircon-Intent: user-action` 헤더 + Origin allowlist.
- **place.id deterministic**: `subway:강남:2호선,신분당선`, `bus:vehicle:<routeId>:<vehId>`, `train:seg:<operator>:<line>:<prev>-<next>:<car>` 등. upsert로 중복 회피.
- **vote 정책**: voter당 1 place 1 vote, 1시간 expire, 변경 시 30s cooldown.

---

## 4. 최근 작업 history (지난 두 리뷰 이후, ~30 commits)

**Phase 0 (boundary 안전):**
- migration 0003 (places.type CHECK 제거)
- Zod validation schemas (validation.ts SOT, hono의 enum/length 검증 위임)
- migration 0004 (users 테이블 IF NOT EXISTS — fresh deploy 안전)
- err.message leak fix
- swopenAPI fetch timeout 2s

**Phase 1 (LocationWizardScreen 분해):**
- 1402 → 47 라인. 5개 wizard를 wizard/<category>/ 모듈로.
- 3-layer 패턴 정착 (UI / hook / pure builder).
- builder들 unit tests (16 → 33 web tests).

**Phase 1.5 hotfix (LLM 리뷰 P1/P2 대응):**
- useBusMatch race condition (seq guard + freshenBusMatch defense)
- useSubwayTrainMatch loading stuck fix
- WizardHeader 일원화

**Phase 2 (Hono 분리):**
- routes/{auth, places, votes, realtime}.ts (각 100~200 라인 단일 책임)
- types.ts (Bindings/Vars/consts SOT)
- cookies.ts + abuse-adapter.ts
- OAuth: OAuthProvider interface + 3 provider 구현, registerOAuthProvider 루프
- hono.ts: 932 → 35 라인 (composition only)

**부수:**
- bus:vehicle id에 routeId 포함 (충돌 fix)
- updnLine cross-check 자동화 (`scripts/check-updnline.mjs`) — 1/3/4/5/6/7/8/9호선 100% docOk 검증
- check-data: ghost/dupe budget (회귀 시 fail)
- /p/[id] metadata DB-driven (SEO)
- HomeScreen SSR (페이지 첫 HTML에 100 places 포함)
- mobile-ready API factory (createApiClient) + server voter Authorization 헤더 수용
- audit_events.meta.durMs observability
- CI: PR에서 E2E 제거 (prod mutate 누적 회피), check에 next build 추가
- CSP fix on dynamic 라우트 (next.config.headers)

**테스트**: core 88 + web 33 = **121 unit**, **76 E2E** (prod-target). CI는 PR에서 check (unit + data + build + lint), main push에서 E2E.

---

## 5. 의도적으로 deferred한 큰 작업 (왜 안 했는지 설명)

검토자가 "왜 안 했냐"가 아니라 **타이밍/방식**을 비판해주세요.

### 5.1. D1 hot path 최적화 (KV cache layer)
- **이유**: 현재 prod 트래픽은 목표(100만 DAU)의 일부. observability(audit_events.durMs) 박았으니 실측 후 결정 예정.
- **deferred 위험**: 트래픽 spike 시 늦게 발견 → 응급 대응.

### 5.2. 모바일 client side OAuth + SecureStore
- **이유**: server side는 준비 끝 (Authorization 헤더 수용). client side는 모바일 빌드/스토어 등록 임박 시 도입.
- **deferred 위험**: 모바일 빌드 일정 잡힐 때까지 미사용 코드 누적.

### 5.3. E2E preview deployment + 별 D1 (PR-level E2E)
- **이유**: 인프라 작업 큼. 임시로 PR에서 E2E 빼고 check (unit + build)로 안전망 처리.
- **deferred 위험**: build pass + unit pass + lint pass에서 못 잡는 RSC/edge boundary 회귀.

### 5.4. 디자인 시스템 (packages/ui — Tamagui or alternative)
- **이유**: web과 mobile UI 중복은 있지만 mobile 미빌드 상태. 디자인 토큰만 공유 중. 큰 결정 (Tamagui vs Vanilla Extract vs NativeWind) 사용자 결정 필요.
- **deferred 위험**: mobile 빌드 시점에 UI 중복이 더 커짐.

### 5.5. SNUClassroomWizard 내부 sub-component 추출
- **이유**: 678 라인이지만 sub-components (DefaultLanding, HitList, RoomGrid 등)가 main에 강결합. 위치는 wizard/classroom/snu/로 이동 완료.

---

## 6. 검토 요청 — 무엇을 봐주시면 좋나

### A. premature vs timely optimization 판단
1. **observability를 audit_events.meta.durMs로만 둔 게 충분한가?** 더 박아야 할 핵심 metric은?
2. **D1 hot path를 정말 deferred 해도 되는가?** 트래픽 milestone 기준으로 어떤 신호가 보이면 시작해야 하나? (예: durMs p95 > X ms, D1 read row count > Y/sec, …)
3. **observability 자체를 더 무거운 stack (Cloudflare Analytics, Logpush → external store)으로 옮길 시점은?**

### B. 코드 quality / 안티패턴
1. `routes/places.ts`와 `routes/votes.ts`에 공통 보일러플레이트(kill_switch, isBlocked, rate-limit, log)가 매번 반복. middleware로 추상화할 만한 패턴인지?
2. SNUClassroomWizard 678 라인 — 더 쪼개야 하는지, 아니면 sub-components가 main 흐름에 강결합이라 그대로가 나은지?
3. `createApiClient` factory가 mobile 빌드 전엔 사실상 미사용 (web은 default `api`). 지금 추상화한 게 옳은 결정인가, 아니면 YAGNI 위반?
4. `_abuse.ts`의 `validatePlaceInput` + `validateUpsertPlaceInput` 두 함수 — 더 깔끔한 통합 가능?

### C. 보안 / 운영성
1. **익명 voter cookie HMAC**가 어뷰징/시빌 공격에 충분한가? rotate / device-bind 패턴이 필요한 시점은?
2. **CSP 두 SOT** (public/_headers + next.config.headers) — 같은 내용 유지하려면 어떻게? 한 곳에 모을 수 있나?
3. **audit_events 무한 누적** — retention 정책 + analytics 빼내는 시점은?
4. **OAuth callback error path**가 항상 `/login?error=...` redirect. 로그인 실패 자체가 누적 audit_events에 어떻게 남는지? 어뷰징 신호로 활용 가능?

### D. 외부 의존 / 데이터
1. **swopenAPI 2호선 quirk** — doc과 실제 응답이 다른 경우의 추가 cross-check 패턴? snapshot test? contract test?
2. **97 ghost subway stations** — lat/lng 채우는 가장 효율적 방법? (Naver Maps geocoding API? 데이터 정정 PR 자동화?)
3. **data.go.kr 버스 노선 자동완성** (현재 신청 대기 중) — 도입 시 ID schema, KV cache, 데이터 빈도 등 미리 설계해둘 게?

### E. 한국 시장 특화
1. **네이버 SEO** — 첫 HTML SSR은 됐는데 (홈, /p/[id]) Yeti bot이 RSC + edge runtime 잘 인덱싱하는지?
2. **카카오 OAuth quirks** — profile_nickname consent issue 있었음. 다른 한국 OAuth 함정?
3. **QR-first 사용자 (50%+ 목표)**의 진입 흐름이 최적화돼 있나?

### F. 아키텍처 / 미래
1. **D1 → PostgreSQL (Neon/Supabase)** 이전 시점? 어떤 신호가 트리거?
2. **Durable Objects WebSocket으로 hot place 실시간 vote fanout** — DAU 기준 도입 시점?
3. **mobile launch timing** — server-side mobile auth만 준비됨. 모바일을 prod에 내놓기 전에 무엇을 더 봐야 하나?

---

## 7. 검토 형식 (추천)

다음 형식이 가장 도움됩니다:

1. **이번 round에서 새로 발견한 것** (이전 두 리뷰가 놓친 것 위주) — P1/P2/P3 분류
2. **deferred한 작업의 timing 판단** — 5.1~5.5 각각 "지금 하라" / "기다려" / "다른 트리거 기다려"
3. **칭찬 + 비판 둘 다** — 어디가 안전한지 알면 다른 곳에 시간 쓸 수 있음
4. **구체적 파일/라인 reference + 코드 예시**

---

## 8. 검토 시 진입점

| 무엇을 보고 싶나 | 어떤 파일부터 |
|---|---|
| 백엔드 라우터/조립 | `apps/web/src/server/hono.ts`, `routes/*.ts`, `cookies.ts`, `abuse-adapter.ts` |
| OAuth 추상화 | `apps/web/src/server/oauth/{types,kakao,naver,google,index}.ts`, `routes/auth.ts` |
| Zod boundary | `packages/core/src/validation.ts`, `apps/web/src/server/_abuse.ts:validatePlaceInput` |
| Hot path read 후보 | `routes/places.ts` (GET /places, GET /places/:id), `apps/web/src/app/page.tsx` (SSR) |
| Hot path write 후보 | `routes/votes.ts` (POST/DELETE), `routes/places.ts` (POST /upsert) |
| Wizard 패턴 (3-layer) | `wizard/bus/{BusWizard,useBusMatch,buildBusPlace}.ts(x)`, `wizard/subway/SubwayWizard.tsx` |
| 가장 큰 wizard | `wizard/classroom/snu/SNUClassroomWizard.tsx` (678 라인) |
| 매칭 로직 + cross-check | `packages/core/src/subwayDirection.ts`, `scripts/check-updnline.mjs` |
| 외부 API 호출 | `routes/realtime.ts` (swopenAPI + data.go.kr, 2s timeout) |
| Mobile-ready | `packages/core/src/api.ts` (createApiClient), `apps/web/src/server/cookies.ts` (Authorization) |
| Observability | `apps/web/src/server/abuse-adapter.ts` (durMs in audit log) |
| CI | `.github/workflows/{check,e2e}.yml` |
| 데이터 무결성 | `scripts/check-data.mjs` (budget pattern) |
| 회귀 케이스 | `tests/e2e/regressions.spec.ts`, `packages/core/src/__tests__/`, `apps/web/src/screens/wizard/*/__tests__/` |
| 규칙 | `CLAUDE.md` |

감사합니다.
