# 코드 리뷰 요청 — 에어컨 민주주의 (원점에서 검토)

> 시니어 풀스택 엔지니어로서, **이전 검토 이력은 무시하고** 이 코드베이스를 처음 보는 사람의 시각으로 봐주세요.
> 무엇이든 — 아키텍처, 모듈 경계, 데이터 모델, 보안, 성능, 테스트, 문서, 빌드/배포, 의존성, 한국 시장 특화, 운영성 — 리팩토링하거나 개선할 부분이 있으면 지적해주세요.
> 한국어 답변 OK, 코드 예시는 영어 OK.
> **저장소**: https://github.com/taegyumin/aircon-democracy (main branch)

---

## 1. 서비스 한 줄

**에어컨 민주주의** (https://aircondemocracy.com) — 공공장소(지하철·기차·버스·카페·강의실)의 에어컨 체감을 익명으로 30초 안에 투표하는 한국어 PWA + (예정) iOS/Android 앱.

**핵심 가치**: 익명·즉시·집계. 사용자가 어디에 있는지 자동/수동으로 식별 → 같은 장소·차량 단위로 cold/ok/hot 투표가 모임 → 다음 사람이 그 결과를 본다.

**목표 규모** (12개월): DAU 100만, 동시 vote ~5만/min, places 10만 개.

**한국 시장 특화**: 카카오/네이버/구글 OAuth, 네이버 지도, swopenAPI(실시간 지하철), data.go.kr(버스 위치), Naver/Google SEO.

---

## 2. 코드베이스 한 눈에

```
aircon-democracy/                       (Turborepo + npm workspaces)
├── apps/
│   ├── web/                            Next.js 15 (App Router) + Hono on CF Pages
│   │   ├── src/
│   │   │   ├── app/                    RSC pages, /api/[[...path]] catch-all
│   │   │   ├── components/             8 client components (Icons, NaverMapPicker, ...)
│   │   │   ├── lib/                    apiClient, geoClient, recentPlaces, favorites
│   │   │   ├── screens/                client-side screens
│   │   │   │   ├── HomeScreen.tsx
│   │   │   │   ├── VoteScreen.tsx
│   │   │   │   ├── RegisterScreen.tsx
│   │   │   │   ├── QRScreen.tsx
│   │   │   │   ├── LocationWizardScreen.tsx  (47 lines, category router)
│   │   │   │   ├── SNUClassroomWizard.tsx    (678 lines, 학교/건물/호실 picker)
│   │   │   │   ├── YonseiClassroomWizard.tsx
│   │   │   │   └── wizard/
│   │   │   │       ├── WizardLanding.tsx, WizardHeader.tsx, Label.tsx, styles.ts
│   │   │   │       ├── categories.ts, StationRow.tsx
│   │   │   │       ├── bus/   {BusWizard, useBusMatch, buildBusPlace} + tests
│   │   │   │       ├── train/ {TrainWizard, SimpleSuggestInput, buildTrainPlace} + tests
│   │   │   │       ├── subway/{SubwayWizard, TrainModeBody, PlatformModeBody,
│   │   │   │       │           StationAutocomplete, useSubwayTrainMatch, buildSubwayPlace} + tests
│   │   │   │       ├── cafe/CafeWizard.tsx
│   │   │   │       └── classroom/ClassroomWizard.tsx
│   │   │   └── server/
│   │   │       ├── hono.ts             (932 lines, 단일 worker — Phase 2 대상)
│   │   │       ├── _abuse.ts           (371 lines, voter cookie/csrf/rate-limit/validation)
│   │   │       └── __tests__/csrf.test.ts
│   │   ├── wrangler.toml, next.config.ts
│   │   └── public/ (manifest, og-image, brands/, data/)
│   └── mobile/                         Expo SDK 51 (RN, 아직 미빌드)
│       └── app/ (Expo Router file-based: index, login, qr, wizard/, p/)
└── packages/
    ├── core/                           pure TS 비즈니스 로직
    │   └── src/
    │       ├── api.ts                  HTTP client (web+mobile 공유)
    │       ├── places.ts, brands.ts, brandIcons.ts
    │       ├── subway.ts (227 lines)   서울/부산/대구/광주/대전 역 graph + search
    │       ├── subwayGraph.ts          findSegments + neighborNames
    │       ├── subwayDirection.ts      expectedUpdnLine + LINE_SEQUENCES (1~9호선)
    │       ├── train.ts                KTX/SRT/무궁화호 station chains + findTrainSegments
    │       ├── snu.ts, yonsei.ts       대학별 건물/호실 데이터
    │       ├── geo.ts                  haversine distance
    │       ├── tokens.ts               디자인 토큰 (web+mobile 공유)
    │       ├── validation.ts           Zod boundary schemas (SOT)
    │       ├── data/                   subway-stations.json (~3500 행, 97개 ghost),
    │       │                           train-routes.json, snu-rooms.json
    │       └── __tests__/              77 tests
    └── ui/                             (빈 폴더 — Phase 3 대상)
```

**규모**: 102 TS/TSX 파일, ~10,855 라인 (테스트 포함).

**가장 큰 파일** (검토 우선순위):
- `hono.ts` 932 — 단일 worker. 13개 endpoint, OAuth × 3 provider 거의 동일 패턴 반복.
- `SNUClassroomWizard.tsx` 678 — 학교/건물/호실 picker. 내부 sub-component 많음.
- `VoteScreen.tsx` 440 — 투표 화면. polling, vote/withdraw, 결과 카운트.
- `RegisterScreen.tsx` 428 — 장소 등록 폼.
- `_abuse.ts` 371 — voter cookie HMAC, csrf, rate-limit, place validation.
- `HomeScreen.tsx` 340 — 홈 (favorites + recent + 검색).
- `YonseiClassroomWizard.tsx` 336.

---

## 3. 인프라

- **Frontend 호스팅**: Cloudflare Pages (`aircondemocracy.com` + `www`, project `aircon-democracy-next`).
- **Backend**: 같은 CF Pages 프로젝트의 Functions catch-all `/api/[[...path]]` → Hono app 한 인스턴스.
- **DB**: Cloudflare D1 (SQLite, single-region) — `places`, `votes`, `audit_events`, `kv_buckets` (rate limit), `users`.
- **KV**: 아직 사용 안 함 (예정).
- **Secrets**: `~/.aircon-env`에 로컬 보관, wrangler secret으로 prod 주입 (`COOKIE_SECRET`, `SESSION_SECRET`, `ABUSE_SECRET`, OAuth client_id/secret × 3, `SEOUL_REALTIME_KEY`, `DATAGOKR_BUS_KEY`).
- **Auth**: 카카오/네이버/구글 OAuth → 서버에서 JWT(SESSION_SECRET) 발급, voter cookie(HMAC,익명 voter tracking)와 별도 운영.
- **CSP/CORS**: same-origin only, `X-Aircon-Intent: user-action` header + Origin allowlist (`aircondemocracy.com`, `www.aircondemocracy.com`, `localhost`).
- **빌드/배포**: `npm run deploy:web` = `source ~/.aircon-env && next build && @cloudflare/next-on-pages && wrangler pages deploy ...`. CI는 GitHub Actions (check + e2e on PR).

---

## 4. 데이터 모델 (요지)

```sql
places:
  id TEXT PRIMARY KEY,                  -- "subway:강남:2호선,신분당선", "bus:vehicle:V123",
                                        --   "train:seg:KORAIL:경부선:대전-김천:5" 등 deterministic id
  name TEXT, type TEXT, district TEXT, detail TEXT,
  created_at, created_by, normalized_name
votes:
  voter_id TEXT, place_id TEXT, vote TEXT,
  voted_at, changed_at, expires_at,     -- vote는 1시간 후 expire
  PRIMARY KEY (voter_id, place_id)
audit_events:                           -- 모든 mutation + rejection 로그
kv_buckets:                             -- 자체 rate limit (D1 위에 구현)
users:                                  -- OAuth user (display_name, provider, ...)
```

- **vote는 1인 1 place 1 vote** (cooldown 30s, expire 1h).
- **place.id는 deterministic** (같은 입력 → 같은 id, upsert로 중복 회피).
- **익명 voter** (cookie HMAC)와 **로그인 user** 모두 vote 가능 (현재 cookie만으로 충분, user 연결은 부가).

---

## 5. 최근 작업 이력 (참고용)

- 2026-05-XX: PWA + Capacitor + Vite (Tier 3) → Expo + Next.js + Hono (Tier 1) 마이그레이션 완료. prod 도메인 cutover 완료.
- 2026-05-26: Phase 0 — D1 migration 0003 (places.type CHECK 제거), Zod validation 도입, csrf integration tests 8개 추가, swopenAPI 2호선 updnLine quirk 발견 (doc과 반대) 수동 수정.
- 2026-05-26: Phase 1 — `LocationWizardScreen` 1402 → 47 라인. 5개 wizard를 `wizard/<category>/` feature module로 분리. 3-layer 패턴 정착 (UI / hook / pure builder). builder들 unit test (16개).
- 2026-05-26: Phase 1.5 hotfix —
  - useBusMatch race condition (seq guard + freshen helper)
  - useSubwayTrainMatch loading stuck fix
  - WizardHeader 일원화 (renderHeader callback 제거)
  - Zod schema를 진짜 SOT로 정착 (`_abuse.ts validatePlaceInput`이 Zod safeParse 사용, hono의 `UPSERT_ID_RE` 등 수동 검증 제거, realtime 두 endpoint도 Zod)

**테스트 현황**:
- Unit: core 77 + web 31 = **108 tests** (Vitest)
- E2E: **76 tests** (Playwright, prod-target)
- CI: GitHub Actions `npm run check && npm run test:e2e:prod`

---

## 6. 우리가 인지하고 있는 기술 부채 (단, 이걸 신경 쓰지 말고 자유롭게 봐주세요)

이 목록은 우리가 이미 알고 있는 거니까, 새로 발견하는 게 있으면 더 가치 있어요.

- `hono.ts` 932 라인 단일 worker — Phase 2 대상 (라우터 분리 예정).
- 디자인 시스템 없음 — inline style + 토큰 상수. web/mobile UI 중복.
- `packages/ui` 빈 디렉토리.
- TanStack Query 없음 — vote polling은 `setInterval`로 자체 구현.
- D1 단일 DB가 5만 vote/min hot write를 받을 수 있는지 미검증.
- 97개 ghost subway stations (lat/lng 누락).
- 2호선만 updnLine swap 처리. 단방향 7개 노선(1/3/4/5/6/7/8/9호선)은 doc 신뢰. cross-check 예정.
- 모바일 (Expo) 아직 빌드/스토어 등록 안 됨.

---

## 7. 검토 요청

원점에서 봐주시되, **다음 카테고리는 빠짐없이 한 번씩 훑어주세요**:

1. **아키텍처 경계** — apps/web과 packages/core 사이 의존이 옳은가? `wizard/` 디렉토리 구조가 자연스러운가? hono single worker vs split?
2. **데이터 모델** — place.id deterministic 패턴이 견고한가? vote expire 1h가 적절한가? audit_events scale-out 어떻게?
3. **보안** — CSRF (Origin + intent header) 충분한가? voter cookie HMAC 패턴이 옳은가? OAuth 3 provider 추상화 가능?
4. **성능** — Next.js 15 App Router에서 거의 모든 화면이 `'use client'`. RSC로 점진 이전 가능 지점? LCP 최적화?
5. **외부 의존** — swopenAPI / data.go.kr 호출 패턴 (retry, timeout, key 분리)이 prod-grade?
6. **테스트 전략** — 108 unit + 76 E2E. 빠진 layer 있는지 (integration, mobile, contract).
7. **운영성** — observability (현재 audit_events만), error budget, kill switch, feature flag, blue-green이 가능한가?
8. **코드 품질** — 안티패턴, 미래 함정, 컨벤션, 네이밍, 주석 quality.
9. **한국 시장 특화** — 한국 사용자/SEO/모바일 환경에서 빠진 것.
10. **의존성** — overengineered 한 곳, underengineered 한 곳. `package.json`의 dep 적정?

**검토 형식 추천**:
- "당장 고쳐야" (P1) / "다음 sprint" (P2) / "장기" (P3)로 우선순위.
- 각 항목에 **파일/라인 reference + 구체적 수정 방향**.
- 가능하면 작은 코드 예시 1~2개.
- 우리가 의도적으로 한 결정을 비판할 수도 있고, 사실 잘한 부분도 칭찬해주세요 (어디가 안전한지 알면 더 큰 시간을 다른 곳에 쓸 수 있어요).

---

## 8. 검토 시 가장 유용한 진입점

| 무엇을 보고 싶나 | 어떤 파일부터 |
|---|---|
| 백엔드 전체 | `apps/web/src/server/hono.ts`, `_abuse.ts`, `__tests__/csrf.test.ts` |
| 핵심 도메인 로직 | `packages/core/src/{subwayDirection,subwayGraph,validation,places}.ts` |
| Wizard UX 패턴 | `apps/web/src/screens/LocationWizardScreen.tsx`, `wizard/subway/SubwayWizard.tsx`, `wizard/bus/useBusMatch.ts` |
| 외부 API 호출 | `hono.ts` `/realtime/subway/match`, `/realtime/bus/match` |
| 데이터 모델 | `apps/web/src/server/hono.ts` `interface PlaceRow`, migrations |
| 빌드/배포 | root `package.json`, `apps/web/wrangler.toml`, `next.config.ts` |
| 회귀 케이스 | `tests/e2e/regressions.spec.ts`, `packages/core/src/__tests__/` |
| 규칙 | `CLAUDE.md` |
| 메모리 | `~/.claude/projects/-Users-taegyumin-github-aircon-democracy/memory/` (자동 로드 — 결정 이력) |

감사합니다.
