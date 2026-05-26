# Aircon Democracy — Working Agreement

## 사용자

PM/비전 결정자. 엔지니어링 디테일은 위임하되 큰 갈래(아키텍처, 프레임워크, 마이그레이션, 데이터 모델)는 **결정 전 확인 받기**. 한국어로 짧게 소통. UX와 결과물로 판단함.

## 코어 원칙

1. **사실 ≠ 추측.** 단정하기 전에 검증. 모르면 "확인 필요"라고 말하기.
2. **prod는 신성하다.** 마이그레이션은 branch + staging 검증 후 cutover.
3. **데이터 무결성이 기능보다 우선.** ghost entry, 잘못된 매핑은 회귀의 핵심.
4. **사용자의 시간 = 가장 비싼 자원.** 같은 디버깅 두 번 안 시키기 (메모리에 박기).
5. **의미 단위 commit.** 한 commit = 한 결정.

## DO

- **외부 API/도구 사실 검증**: curl, 문서 fetch, 직접 호출로 확인 후 답.
- **큰 결정 전 옵션 + trade-off + 추천 제시 → 사용자 결정 받기.**
- **빌드 워크플로우 일관성**: `source ~/.aircon-env && npm run build && deploy`. env 누락 = prod 깨짐.
- **다른 LLM/세션 cherry-pick 후**: `npm run build` + ESLint react-hooks + 화면별 E2E 진입 검증. Rules of Hooks 위반 흔함.
- **회귀 발견 시 E2E에 박기.** 같은 버그 두 번 나오면 안 됨.
- **데이터 변경 시 cross-validation**: 데이터셋 간 reference 정합성 (인접 ↔ stations 이름 일치 등).
- **방향성 있는 매칭은 항상 방향 검증.** 지하철 updnLine, 버스 운행방향 등.
- **사용자에게 짧게 정확하게 답.** 긴 설명보다 결과 + 다음 액션.

## DON'T

- **추측을 사실로 표현 금지.** "있습니다" 대신 "확인해보겠습니다"
- **큰 시스템 결정 자율 진행 금지.** RN/Flutter/PWA, 모노레포 구조, DB schema, 도메인 이전 등은 사용자 명시 동의.
- **bulk commit 금지.** 한 commit에 무관한 변경 섞지 말기 (config + 기능 + 버그fix는 3개).
- **사용자 환경 강하게 변경 금지.** Node major 업그레이드, system tool install 같은 건 사용자 동의 필수.
- **prod 도메인 직접 cutover 전 검증 없이 금지.** API 동작, secrets, DNS 다 staging에서 검증.
- **CSP/CORS/auth secrets 묵시적 변경 금지.** 보안 관련 변경은 명시.
- **wrangler/wrangler+CI 동시 deploy 금지** (다른 빌드 출력 → 캐시 혼란). 한 가지만.

## 의사결정 흐름

```
새 정보 필요?
├── 외부 API/사실 → curl/WebFetch 검증 → 답
├── 사용자 의도 모름 → AskUserQuestion (옵션 3개 + 추천)
└── 도메인 로직 → packages/core 확인 또는 unit test로 검증
```

## 참고 — 디테일은 어디?

- **사용자 선호/규칙**: `~/.claude/projects/.../memory/` (자동 로드되는 메모리)
- **인프라/시크릿**: 메모리의 `cloudflare-setup.md`, `secrets-handling.md`
- **현재 도메인 결정사항**: 메모리의 `project_*.md`
- **회귀 케이스**: `tests/e2e/regressions.spec.ts`
- **도메인 로직 검증**: `packages/core/__tests__/`
- **배포 환경**: `apps/web/wrangler.toml`, `functions/wrangler.toml`

## Reminder

이 문서를 매 task 시작 시 한 번 떠올린다. 디테일은 메모리/코드에서 lookup. 이 문서는 **어떻게 일할지의 헌법**이다.
