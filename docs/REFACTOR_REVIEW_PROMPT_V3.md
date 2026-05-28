# 에어컨 민주주의 — 리팩토링 & 구조 리뷰 요청

수신: 외부 LLM (Claude / Gemini / GPT 등)
요청자: PM 겸 비전 결정자 (엔지니어링 디테일은 위임)
시점: 2026-05-29

---

## 0. 한 줄로

**대한민국 공공 교통(지하철·기차·고속/시외/시내버스)과 공공 장소(카페·강의실)의 "지금 이 차량/이 자리"가 더우냐 추우냐를 익명 다수결로 시각화하는 PWA + RN 모노레포.**
prod URL: https://aircondemocracy.com
모노레포: Turborepo + Next.js 15 + Hono + Cloudflare Pages/D1 + Expo

코드 규모(2026-05-29 현재):
- apps + packages: ~19,870 LOC TS/TSX
- packages/core 테스트: 170개 (data 무결성 포함)
- D1 schema migrations: 0001~0004

---

## 1. 무엇을 봐달라

두 가지 시야를 동시에:

### 1A. 큰 그림 (architecture·boundary·long-term sustainability)
1. **모노레포 경계가 맞는지** — `packages/core` (도메인 로직 + 공유 타입) / `apps/web` (Next.js + Hono on Pages Functions) / `apps/mobile` (Expo + RN). 경계 위반/leak/중복이 있나?
2. **Backend ↔ Frontend 경계** — `apps/web/src/server/routes/*.ts` (Hono routes) ↔ `packages/core/src/api.ts` (typed client) ↔ `apps/{web,mobile}/src/lib/apiClient.ts` (factory). Zod schema가 SOT인지, route handler가 직접 Zod로 parse하고 있는지.
3. **Provider 추상화** — 외부 API 통합 패턴:
   - `busProviders.ts`: 서울(ws.bus.go.kr) + TAGO(전국 시내버스)
   - `tagoProviders.ts`: TrainInfo, ExpBusInfo, SuburbsBusInfo, SubwayInfo (4서비스)
   - `everlineProvider.ts`: 용인에버라인 비공식(everlinecu.com/api/api009.json)
   - `poiProviders.ts`: 카페/POI
   - swopenAPI(서울 지하철 실시간) — 별도 분리 필요?
   질문: 각 provider가 동일 interface로 추상화되어 있는지? "장애/timeout/no-key" failure mode가 일관되게 다뤄지는지? 새 도시·새 노선 추가가 한 곳 수정으로 끝나는지?
4. **State machine 패턴** — wizard들의 phase 진행 (BusWizard 3-step, TrainTagoVerifyWizard verify→confirm 등)이 일관된 패턴인지. enum + Discriminated Union으로 가는 게 좋은지.
5. **Realtime fetching 패턴** — 폴링 주기, AbortController, race 방지가 wizard마다 일관된지. `useSubwayTrainMatch` / `useBusMatch` 같은 hook이 표준인지.
6. **D1 hot path** — votes 집계 read 성능. 캐싱 layer (KV snapshot)이 필요한 시점은 언제인지, 지금 task #95 in_progress 상태인데 우선순위는?
7. **Cloudflare Pages constraints** — `_worker.js` vs `functions/`, Hono adapter, 5xx body 가로채기 같은 platform-specific 제약이 코드에 잘 격리되어 있는지.
8. **Mobile RN 상태** — Expo + expo-router. `createApiClient` factory로 web과 server type 공유. 현재 wizard 진척:
   - ✅ subway (platform 모드만 — segment 기반)
   - ✅ bus (서버 매칭 + builder 공유)
   - ✅ cafe / classroom
   - ✅ train / intercity-bus (2026-05-29 신규)
   - ❌ subway 차량 모드 (swopenAPI realtime + 에버라인 dispatch) — 차후 sprint
   - ❌ bus RouteTimeline (시각 vehicle picker + GPS scroll) — 차후 sprint
9. **테스트 커버리지의 균형** — 170개가 어느 layer에 몰려 있는지. integration / E2E (Playwright) 정착 정도. 회귀 케이스가 `tests/e2e/regressions.spec.ts` 와 `packages/core/src/__tests__/` 두 군데에 어떻게 분포해 있는지.

### 1B. 디테일 (cross-cutting concerns)
1. **TS union 좁히기 (narrowing)** — 특히 hono route response shape. `vehicleMatch` 같은 union이 timeline override / 실제 match 둘 다 같은 shape로 정규화되어 있나? `as` cast가 도메인 boundary에서 새고 있나?
2. **Hook race / leak**
   - `AbortController`로 이전 fetch 취소 (task #75 fix 이후 표준)
   - `useEffect` cleanup에서 setState 호출 방지 (cancelled 플래그 패턴)
   - 사용자 입력 snapshot으로 stale 결과 방지
   - Rules of Hooks 위반 (cherry-pick 후 자주 발생 — 메모리에 박힘)
3. **Error handling 일관성**
   - 외부 API 호출 timeout (`apps/web/src/server/`의 `timedFetch` 패턴)
   - `onError` (Hono)에서 err.message leak 방지
   - 5xx + body intercept (CF Pages 제약)
   - 사용자 표시 에러 코드 mapping: `not_found / service_closed / no_vehicle_at_stop / no_api_key` …
4. **Build hygiene**
   - `npm run build` + ESLint react-hooks 가 항상 통과하는지
   - cherry-pick / merge 시 type narrowing 깨짐
   - deploy.sh 의 incremental vs fresh build 차이
   - wrangler commit-message ASCII 우회 (한글 commit msg → CF API 8000111)
5. **Data integrity**
   - `packages/core/src/data/subway-stations.json` (928 stations, minified) + `subway-adjacency.json`
   - 2026-05-29 sweep: typo dup 12건 + ghost station 3건 제거. `subwayDataIntegrity.test.ts` 추가 (typo / orphan / lines / 역suffix / city whitelist 5 assertion)
   - 남은 isolated 20건은 실재 역이지만 adjacency 누락 — 별도 작업
   - 회귀 방지 패턴이 다른 데이터셋(bus, 카페, 대학교)에도 필요한지
6. **Place ID schema 일관성**
   - `subway:platform:{line}:{prev}:{next}:{car}`
   - `subway-station:MTRBSxxxx` (TAGO SubwayInfo)
   - `train:tago:{trainNo}:{runDt}:car{N}`
   - `intercity-bus:{kind}:{routeId}:{depPlandTime}`
   - `bus:vehicle:{region}:{routeId}:{vehId}`
   - everline: 어떻게 fit? swopenAPI 응답 shape로 translate
   질문: regex `PLACE_ID_RE` 가 모두 cover하는지. 콜론 vs 하이픈 inconsistency.
7. **Auth / abuse**
   - voter cookie (web) vs Authorization Bearer (mobile)
   - csrfGuard: `X-Aircon-Intent` 헤더 + Origin check
   - rate limit + kill switch (realtime endpoints)
   - voter middleware는 mutation route에만 적용
8. **Backwards compat & migration discipline**
   - prod cutover 전 staging 검증 (D1 migrations)
   - `routes/auth + me + health`, `routes/places + votes`, `routes/realtime` — 분리 후 조립 패턴이 유지되는지

---

## 2. 도메인 맥락 (사용자 정책)

차량 단위 실시간 식별 가능 = swopenAPI 수도권 + 용인에버라인 (모두 trainNo 포함 검증됨). 그 외 차량 식별:
- 간선철도(KTX/SRT/ITX/무궁화) = TAGO TrainInfo로 좌석권 검증
- 고속·시외버스 = TAGO ExpBusInfo/SuburbsBusInfo로 승차권 검증
- 지방 도시철도(부산·대구·광주·대전·인천) = TAGO SubwayInfo로 station-level만, 차량 단위 ❌
- 김포골드/의정부/인천1·2/부산김해/동해/대경/대구·광주·대전 자체/부산 humetro: 2026-05-29 두 LLM cross-check + DarkTornado/subway OSS 분류 일치로 **차량 단위 endpoint 부재 확정**. 재조사 금지.

**핵심**: "차량 단위 식별이 불가능한 노선은 station/노선 단위로만 fallback". UX에서 "지금 이 구간에 차량이 없어요" headline 분기 처리.

## 3. 코어 원칙 (CLAUDE.md 발췌)

1. **사실 ≠ 추측** — 외부 API는 curl/문서로 검증 후 발화.
2. **prod 신성** — branch + staging 검증 후 cutover.
3. **데이터 무결성 > 기능** — typo/ghost는 회귀의 핵심.
4. **사용자 시간 = 가장 비싼 자원** — 같은 디버깅 두 번 안 시킴.
5. **의미 단위 commit** — 한 commit = 한 결정.

---

## 4. 어디부터 보면 좋은가 (큰→작은)

```
/CLAUDE.md                                      # 헌법
/docs/                                          # 정책/검증 sourcing
/apps/web/wrangler.toml                         # 배포 환경
/apps/web/src/server/hono.ts                    # backend entry + route 조립
/apps/web/src/server/routes/                    # routes 분리 (auth/places/votes/realtime)
/apps/web/src/server/{bus,tago,everline,poi}Providers.ts   # 외부 API 추상화
/packages/core/src/api.ts                       # typed client (양쪽 공유)
/packages/core/src/validation.ts                # Zod SOT
/packages/core/src/data/                        # 정적 데이터 + 무결성 테스트
/apps/web/src/screens/wizard/                   # web wizard 구현
/apps/mobile/app/wizard/                        # mobile wizard 구현
/tests/e2e/                                     # Playwright 회귀
```

읽는 순서 권장: `CLAUDE.md` → `hono.ts` → `routes/realtime.ts` (가장 크고 dynamic) → 하나의 wizard end-to-end (예: `train/TrainTagoVerifyWizard.tsx` ↔ `tagoProviders.ts` ↔ `routes/realtime.ts` → mobile `wizard/train.tsx`) → 데이터 무결성 테스트.

---

## 5. 산출물 형식

다음 4가지를 보고서로:

### (A) 큰 그림 평가 — 5~10 항목
- 모노레포 경계, provider 추상화, state machine, hook 패턴, 데이터 무결성, 테스트 균형 등
- 각 항목: 현재 상태 한 줄 + 위험/이상 한 줄 + 권장 한 줄

### (B) 우선순위 매겨진 리팩토링 작업 목록
- P0 (회귀 위험 / 보안 / 데이터 무결성), P1 (성능/유지보수), P2 (DX/cosmetic)
- 각 작업: 한 문장 설명 + 영향받는 파일/경로 + 추정 노력 (XS/S/M/L) + 의존 관계
- 사용자가 그대로 task list에 옮길 수 있는 수준

### (C) "지금 이대로 두는 게 맞다" 목록
- 외부에서 보면 어색해도 도메인 이유로 유지해야 하는 결정
- 예: minified JSON, place ID 콜론/하이픈 mix, CF Pages 5xx body 가로채기 …
- 잘못 건드리면 회귀를 일으킬 것들을 명시

### (D) 발견된 잠재 버그 / TODO
- 코드를 읽다 발견한 race condition, dead code, broken invariant, 잘못된 type narrowing
- 각 항목: 파일:라인 + 재현 시나리오 1줄 + 제안 fix 1줄

---

## 6. 톤 / 제약

- 짧고 정확하게. PM이 결정 가능한 단위로.
- "이거 별로다"는 안 됨. "왜 별로인지" + "대안" 같이.
- Cloudflare Pages / D1 / Hono 특화 제약 잘 알고 있다고 가정하지 말기 — 다른 stack의 best practice 강요 금지.
- 모노레포 split → microservices, RN → Flutter, Tamagui 도입 같은 **거시 시스템 결정은 PM 동의 영역** — 그냥 제안만, 자율 푸시 X.
- 마이그레이션 cutover 같은 **prod-affecting change는 별도 노트**.

---

## 7. 비고 — 이 프로젝트의 특이점

- 사용자가 PM 겸 단일 개발자. AI agent (Claude Code) 와 페어 프로그래밍.
- 익명 다수결 PWA → 봇/조작에 취약 → abuse policy / rate limit 중요
- 외부 API 의존이 큼 (swopenAPI / TAGO / ws.bus.go.kr / 에버라인 비공식) → failure mode 풍부
- 지역별 정책 차이 → 차량 식별 가능 노선과 불가능 노선이 도메인적으로 섞임
- prod = https://aircondemocracy.com (Cloudflare Pages + D1)
