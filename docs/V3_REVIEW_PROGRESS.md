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

## ✅ V4 답변 후 자율 처리

- `1f9ba23` react-hooks/exhaustive-deps warning 3건 → 0 (QRScreen tickRef, BusWizard useCallback, useSubwayTrainMatch 필드 추출)
- `54914b9` dead state + unused vars 제거 (SubwayWizard platQuery 외 5건, PlatformModeBody 파일 삭제, regionLabel chain, RegionPicker label prop)
- `b413499` joinYmdHm + TRAIN/INTERCITY_BUS_VERIFY_ERROR_COPY 추출 (3곳 중복 제거, JSX inline ternary → 테이블)
- `bc617ac` CODE_STYLE_GUIDE.md 추가

lint warning 23 → 6 (남은 6은 모두 no-explicit-any, P1 별도).

## ✅ 추가 자율 처리 (V3 P1 묶음)

- `b0fd585` swopenAPI provider 분리 + SubwayMatchReason enum 표준화 (9 reasons)
- `1615a17` CSP/security headers SOT 추출 + Naver/CF Insights drift fix
- `6fb8d7f` /realtime/subway/match 응답 SubwayMatchResult 강제 (ok() helper)

## ⏸️ 보류 (사용자 의사결정 필요)

### P0 mobile auth (#139) — release blocker
- voter token / Bearer / SecureStore / server guard
- CSRF/Origin 정책 변경 = prod-affecting
- 깨면 같이 보기

### P2 _headers 자동 generator (#146)
- 현재 SOT 변경 시 수동 sync
- prebuild script로 자동화

### P2 bus/train/intercity verify에도 ok() 패턴 적용 (#147)
- subway/match에 도입한 패턴 횡전개

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
