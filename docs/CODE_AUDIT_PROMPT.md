# 코드 audit 요청 — 에어컨 민주주의 (전체 모노레포)

> 시니어 풀스택 엔지니어로서, **이 저장소를 처음 보는 입장에서** 전체 코드를 디테일하게 조망하고 리팩토링·아키텍처 개선안을 제시해주세요.
> 한국어 OK, 코드 영어 OK. 추측 ≠ 사실. 단정 어려운 부분은 "확인 필요"로 표기.
> **저장소**: https://github.com/taegyumin/aircon-democracy (main branch)
>
> 이전 review 문서(`docs/REFACTORING_CONSULT.md`)는 Phase 1 완료 시점 한정이라 무시하고, 현재 main HEAD를 기준으로 처음부터 조망해주세요.

---

## 1. 서비스 컨텍스트

**에어컨 민주주의** (https://aircondemocracy.com) — 공공장소(지하철·버스·카페·강의실)의 에어컨 체감 온도("추워요/적당해요/더워요")를 익명으로 30초 안에 투표하는 한국어 PWA + 모바일 앱. QR로 첫 방문자가 install 없이 투표하는 게 핵심 UX.

**규모 가정 (1년 후 목표):**
- DAU 100만 (web 33% / iOS 33% / Android 33%)
- 동시 vote ~5만/min, places ~10만 개

**한국 시장 특화 제약:**
- 한국 공공 API 의존: swopenAPI(서울 지하철 실시간), data.go.kr(서울 + 전국 버스 위치), NCP Maps, 카카오/네이버 OAuth
- swopenAPI doc과 실제 응답이 자주 불일치 (예: 2호선 updnLine 반대)
- 일부 도시는 실시간 데이터 자체가 없음 (지방 지하철 etc)

---

## 2. 기술 스택

```
모노레포 (Turborepo + npm workspaces)
├── apps/web         Next.js 15 App Router + Hono (Cloudflare Pages + Workers)
├── apps/mobile      Expo (React Native, Solito 공유 라우팅)
└── packages/core    pure TS, web+mobile 공유 (도메인 + Zod schemas + API client)

배포: Cloudflare Pages (aircon-democracy-next 프로젝트, custom domain aircondemocracy.com)
DB: Cloudflare D1 (SQLite, APAC), 마이그레이션 0001~0004
스토리지: KV (rate limit / kill switch), R2 (예약)
외부 API: swopenAPI (서울 지하철), ws.bus.go.kr (서울 버스), apis.data.go.kr/1613000 (전국 버스)
빌드: `npm run -w apps/web deploy` 한 줄 스크립트 (next build → next-on-pages → wrangler)
```

---

## 3. 최근 큰 변경 (최근 24~48시간)

이번 review 직전 push된 큰 변경들:

1. **지하철 wizard 풀 리디자인** — Claude Design 와이어프레임 반영. PlatformModeBody/TrainModeBody/StationAutocomplete 재작성. RouteViz mini-train 시각화. LineCard amber fallback.
2. **버스 wizard 풀 리디자인** — 3-step state machine (번호 autocomplete → 노선 확정 + GPS → 정류장 선택). Bus*Card 컴포넌트 신설. `apps/web/src/screens/wizard/bus/BusWizard.tsx` 1100+ 라인.
3. **버스 region 분기** — Seoul(ws.bus.go.kr) + TAGO 1613000(전국, 서울 제외) 어댑터. `routes/realtime.ts`. cityCode 138개 → `packages/core/busRegion.ts`. GPS 좌표 → cityCode 자동 추론 endpoint(`/region-by-coords`, NCP reverse-geocode).
4. **사실 검증 데이터** — `LINE_CAR_COUNT` (노선별 차량 수, 신림선=3·9호선=6 등 web search 검증), `stationDisplay` 헬퍼(역역 이중 표기 차단), SNU 브랜드 false-positive regex(서울대입구역 차단).
5. **인프라 회귀 fix** — `apps/web/deploy.sh` 한 줄 deploy(next-on-pages 단계 누락 회귀 대응), 올바른 CF 프로젝트(`aircon-democracy-next`) hardcode, main history 일렬화(rebase + force-with-lease).

이번 변경의 트레이드오프와 함정 점검을 부탁드립니다.

---

## 4. 검토 관점 (체크리스트)

### A. 아키텍처
- monorepo 분리(apps/web · apps/mobile · packages/core)가 합리적인지. 셋이 의존하는 SOT가 정말 packages/core에 있는지.
- BusWizard처럼 1100+ 라인 단일 component가 SoC 위반인지. 어떤 단위로 분리?
- Hono routes 모듈 분리(`routes/{auth,places,votes,realtime}.ts`)가 충분히 작은지.
- `routes/realtime.ts`의 Seoul/TAGO 어댑터가 진짜 Provider 추상화로 분리되어야 하는지, 인라인이 적절한지.

### B. 데이터 무결성 (사용자 우선순위 #1)
- `bus:vehicle:` placeId가 routeId 포함하는지, 노선 변경 시 bucket 분리 보장되는지.
- 사용자 입력(GPS, 노선번호) ↔ 외부 API 응답 매칭 시 ghost entry 가능성.
- 방향성 매칭(subway updnLine, bus 운행방향)이 도시·노선 모두에 검증되었는지.
- `packages/core/__tests__/`가 정합성 회귀 cover 충분한지.

### C. 보안
- CSRF (`X-Aircon-CSRF`) + cookie `SameSite=Lax` 조합 충분한지.
- `realtimeGuard`(rate limit + kill switch) 모든 외부 API에 적용되는지.
- `wrangler pages secret`의 12+ secret 갱신 워크플로우가 단일 source of truth(~/.aircon-env)와 sync 보장되는지.
- `NEXT_PUBLIC_*` 환경변수가 client bundle에 inline될 때 노출 위험 있는 키 있는지.
- OAuth (`routes/auth.ts`, `oauth/{kakao,naver,google}.ts`)의 callback 처리에서 state/code 검증 빈틈.

### D. 한국 공공 API 특화
- swopenAPI / ws.bus.go.kr / apis.data.go.kr 응답 wrapper 다른 구조 어댑터 — `fetchBusJson`(ws) + `fetchTagoJson`(TAGO)의 unification 가능성.
- 외부 API 응답 형태가 doc과 어긋날 때 회귀 방지 패턴(snapshot/contract test 등).
- `realtime.ts` upstream timeout 2초 + worker CPU 30초 한계 안에서 multi-hop fetch가 안전한지.

### E. 프론트엔드
- BusWizard / SubwayWizard의 state machine을 useReducer 또는 XState로 옮길 가치 있는지.
- 자동완성 debounce(200ms)와 race-condition 가드(seqRef)가 모든 hook에 일관되게 적용되는지.
- 컴포넌트 inline style vs CSS-in-JS vs tailwind 선택의 일관성.
- mobile(Expo) 화면이 web와 wizard logic 공유 가능한 만큼 공유하고 있는지.

### F. 성능 / 인프라
- D1 hot path(read-heavy)의 KV cache layer 도입 가치(미구현, task #95 in_progress).
- HomeScreen SSR + 30초 STALE_WINDOW의 client-server hydration 일치성.
- CF Pages catchall route `/api/[[...path]]`의 cold start.
- `next-on-pages` 변환 단계가 빌드 워크플로우에 명시되어 있는지(`apps/web/deploy.sh`).

### G. 테스트
- packages/core unit 129개 + apps/web 일부 + tests/e2e regressions.spec.ts. 빠진 영역?
- E2E가 prod 대상인데 preview env(`aircon-democracy-next` GitHub branch)로 옮길 가치 있는지.
- 외부 API 의존 logic의 mocking 전략 부재.

### H. UX / 디자인 일관성
- 지하철은 원형 배지(노선 번호), 버스는 사각 배지(노선 종류) — 시각 언어 differentiation 잘 됐는지.
- 5개 wizard(subway/bus/train/classroom/cafe·음식점/office)의 단계 수·구성 일관성.
- "정류장 모름 / 칸 모름" 같은 fallback 옵션이 모든 wizard에 일관되게 있는지.

### I. 운영
- `~/.aircon-env` 단일 .env file을 prod CF secret과 sync하는 자동화 부재 — 수동 관리 위험.
- 두 CF Pages 프로젝트(`aircon-democracy` vs `aircon-democracy-next`) 공존 — 옛 프로젝트 삭제해야 하는지.
- `wrangler` + GitHub auto-build 동시 활성 시 promotion 충돌(2026-05-27 회귀로 확인).

---

## 5. 구체 질문

### Q1. BusWizard 1100+ 라인
state machine + autocomplete + GPS + region picker + 정류장 picker + match hook이 한 파일. 적절한 분리 단위 추천?

### Q2. Region 분기 추상화
`routes/realtime.ts`에 region 분기가 인라인 (`if (region.kind === 'tago')` 블록). 향후 경기GBIS(별도 API) / 부산 humetro(자체) 추가 가능성 — Provider 인터페이스로 추출할 가치?

### Q3. 노선별 메타데이터 SOT
`LINE_CAR_COUNT`(노선별 차량 수)·`LINE_COLORS`·`LINE_SEQUENCES`(역 순서)가 `packages/core/subway.ts`에 분산. 한 Line metadata struct로 합칠지?

### Q4. CITY_CODES 138개 hardcoded
TAGO 응답에서 받아온 cityCode list를 frontend bundle에 정적 박음(~5KB). 빌드 시 1613000 호출로 생성하는 codegen이 나을지, 아니면 hardcoded가 더 안전한지?

### Q5. data 무결성 cross-check
지하철 인접역 정합성 검증 스크립트 있나(check-data 같은)? 빠졌다면 추가 가치?

### Q6. 한국 공공 API 응답 정규화
`fetchBusJson`/`fetchTagoJson`/`swopenAPI` 직접 호출 — wrapper 다른 응답을 한 `ApiAdapter<TItem>` 인터페이스로 묶을 가치?

### Q7. mobile + web 공유
현재 wizard 로직은 apps/web에 종속. apps/mobile은 어디까지 공유 가능한지, packages/core로 어떤 단위가 올라가야 하는지?

### Q8. 보안 — secret 관리
12+ secret을 wrangler dashboard와 ~/.aircon-env 양쪽 수동 관리. drift 방지 자동화 패턴(infra-as-code, sealed-secret 등) 추천?

### Q9. 미흡한 테스트 영역
component test(apps/web) 부재. Hono routes integration test 8개 (`apps/web/src/server/__tests__/csrf.test.ts`) — 늘려야 할 영역?

### Q10. 성능 — 1년 후 100만 DAU
D1 read·KV cache·CF Pages worker bundle 크기 — 어디가 먼저 임계가 될지 추측?

### Q11. 디자인 시스템
inline style + CSS-in-style 객체로 토큰 사용 중. Tamagui(task #66) 도입 시 마이그레이션 부담? 또는 그대로 두는 게 낫나?

---

## 6. 검토 형식

다음 형식이 가장 도움됩니다:

1. **P1 (당장 fix)** — 데이터 무결성 / 보안 / prod 동작 영향. 구체 파일·라인.
2. **P2 (다음 sprint)** — 유지보수성 / 회귀 위험 감소.
3. **P3 (장기)** — 아키텍처 evolution / mobile parity 확장.
4. **You missed** — 위 question에 없는데 검토자가 짚어줄 만한 부분.
5. **추측 vs 사실** 표기 — 본인이 단정 못 하는 부분은 명확히.

---

## 7. 핵심 파일 (검토 시 시작점)

### 진입점
- `apps/web/src/app/page.tsx` (HomeScreen SSR 진입)
- `apps/web/src/app/api/[[...path]]/route.ts` (Hono mount)
- `apps/web/src/server/hono.ts` (라우터 조립)
- `apps/web/src/screens/LocationWizardScreen.tsx` (카테고리 라우터)

### Wizard (사용자 입력 흐름)
- `apps/web/src/screens/wizard/bus/BusWizard.tsx` (큰 단일 component)
- `apps/web/src/screens/wizard/subway/{SubwayWizard,TrainModeBody,PlatformModeBody,StationAutocomplete}.tsx`
- `apps/web/src/screens/wizard/train/TrainWizard.tsx`
- `apps/web/src/screens/wizard/{cafe,classroom}/`

### 백엔드 routes
- `apps/web/src/server/routes/{auth,places,votes,realtime}.ts`
- `apps/web/src/server/_abuse.ts` (rate limit + kill switch + voter hash)
- `apps/web/src/server/middleware.ts`, `types.ts`

### 도메인 로직 (packages/core)
- `subway.ts` (STATIONS, LINE_COLORS, LINE_CAR_COUNT, stationDisplay)
- `subwayDirection.ts` (updnLine 2호선 quirk)
- `subwayGraph.ts`, `subwayProgress.ts`
- `busRegion.ts` (138 cityCodes + regionByName)
- `validation.ts` (모든 Zod schema)
- `brands.ts` (SNU regex 등)
- `geo.ts` (haversine), `train.ts`, `places.ts`, `tokens.ts`, `api.ts`

### 테스트
- `packages/core/src/__tests__/*` (unit 129)
- `tests/e2e/regressions.spec.ts` (E2E 회귀 case)
- `apps/web/src/server/__tests__/csrf.test.ts`
- `apps/web/src/screens/wizard/{bus,subway}/__tests__/*`

### 인프라
- `apps/web/wrangler.toml` (CF Pages config)
- `apps/web/deploy.sh` (한 줄 deploy script)
- `apps/web/migrations/000{1,2,3,4}_*.sql`
- `CLAUDE.md` (working agreement)

### 메모리 (참고)
- `~/.claude/projects/.../memory/MEMORY.md` — 사용자 환경 메모리. 시크릿 / 배포 / 한국 공공 API 함정 기록.

---

## 8. 톤

칭찬은 짧게, 비판은 길게. over-engineering 지적 환영. 결정적 데이터 무결성 위험 발견 시 우선 표시.

감사합니다.
