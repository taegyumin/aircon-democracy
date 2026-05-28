# V3 리뷰 답변 진행 상황 (2026-05-29)

## ✅ 처리 완료 (자율)

### P0 데이터·보안 3건
- `07aad16` check-data.mjs duplicate key에 city 포함 — npm run check 복구
- `ba902ad` place_reports.voter_hash raw voterId 저장 fix (익명성 위반)
  - 추가: prod row 0건 확인 (wrangler d1 COUNT) — 마이그레이션 불필요
- `882f0de` 홈 RSC + sitemap is_public=0 필터 추가

### P0 mobile 1건
- `d4ccfd8` mobile cafe invalid placeId + res.ok 누락 fix

### P1 작은 fix 2건
- `3e49388` vote route Zod SOT 통일 (PostVoteBodySchema)
- `8a083c0` RegionalSubway debounce race fix

### 검증
- core test: 170/170 통과
- web test: 64/64 통과
- web tsc: 0 errors
- mobile tsc: 0 errors
- web build: 통과 (180KB shared, /wizard 36.8KB)
- check-data: 통과 (ghost stations 93 < budget 97)

---

## ⏸️ 보류 (사용자 의사결정 필요)

### P0 mobile auth (#139) — release blocker
- voter token / Bearer / SecureStore / server guard
- CSRF/Origin 정책 변경 = prod-affecting
- 깨면 같이 보기

### P1 CSP/header SOT
- next.config.ts ↔ public/_headers drift
- Naver/analytics 도메인 변경 시 deploy 검증 필요
- 깨면 같이 보기

### P1 swopenAPI provider 분리 + reason enum 표준화 (M effort)
- realtime.ts 호출 한 곳만이라 부분 분리는 가치 작음
- reason enum 표준화 (`no_train_at_segment / service_closed / realtime_unsupported / multi_candidate / no_api_key / not_found`) 도입
- type/api.ts 응답 shape도 같이 정의해야
- 깨면 같이 설계

### P1 response satisfies/Zod (M effort)
- packages/core/src/api.ts return type에 satisfies 또는 Zod response schema
- provider error enum과 연결되어 swopenAPI 작업 후

### P2 Bus/Subway DU
- 기능 freeze 후 별도 sprint

### P2 mobile typecheck script + E2E mutation smoke
- mobile auth 완성 후

---

## 📌 LLM V3 (C) 유지 결정 — memory에 박음

미래 회귀 방지용으로 `~/.claude/projects/.../memory/project_review_decisions_v3.md` 저장. 7건:
1. minified JSON 유지
2. place ID 콜론·하이픈 mix 유지
3. realtime failure는 200+reason
4. 차량 식별 불가 노선 = station-level only
5. D1 + edge cache (KV snapshot 보류)
6. Hono route 조립 구조 유지 (microservice X)
7. deploy.sh ritual 유지

---

## 📋 다음 단계

1. V4 (코드 스타일/lint) 답변 오면 같이 확인
2. mobile auth #139 설계 (release blocker)
3. CSP SOT
4. swopenAPI provider + reason enum (V3 P1 묶음)
