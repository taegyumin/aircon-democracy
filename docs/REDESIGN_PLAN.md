# 모바일 전면 재설계 plan — "Thermal Civic"

목표(사용자): **쓰고 싶게 예쁘고(심미) · 직관적이고 · 일관적.** 토스/당근 출시 기준.
이 문서가 "어떻게 고칠지"의 정본. Codex 이중검수 → 구현.

## 0. rubric (모든 결정은 이 3개로 판정)

1. **직관**: 처음 본 사람이 설명 없이 다음 행동을 안다. 탭 깊이 최소, 상태가 항상 보임.
2. **일관**: 같은 요소는 같은 모양. 화면별 "감"이 아니라 토큰·primitive 한 곳에서.
3. **심미**: 이 앱"다운" 정체성. 제네릭 파란 유틸 ❌.

## 1. 미감 방향 — Thermal Civic

앱의 영혼 = **추워요(파랑)↔더워요(빨강)**. 무채색 파란 유틸이 아니라 **체온계 같은 따뜻함·차가움의
대비**를 정체성으로. 30초 사용이라 refined-minimal(명료) 위에 thermal 시그니처 한 스푼.
- 배경: 차가운 회색(#F2F2F7) → **따뜻한 off-white(#F6F5F2)**. 그래야 cold/hot 액센트가 POP.
- 시그니처: cold→ok→hot **온도 스펙트럼 바**(파랑·초록·빨강)를 투표 결과·홈 브랜드 모먼트에 절제 사용.
- 폰트: **Pretendard 유지** (한국어 gold standard — Latin "Inter-generic"과 다른 결). display는 더 굵고 타이트하게.
- 보이스: 시민적+친근 ("지금 여기 어때요?"). 과장 금지(디자인 리뷰 지적 반영).

## 2. 토큰 — 타입·스페이스 스케일 신설 (packages/core/src/tokens.ts, 공유)

기존 base 값은 유지(web 41파일 영향) + **추가**. 색 일부 refine은 web fast-follow로 통일(브랜드 SSOT).

**TYPE (9단계, lineHeight·letterSpacing 내장):**
| 이름 | size/weight/lh/ls | 용도 |
|---|---|---|
| display | 30/800/38/-0.6 | 화면 hero 헤드라인 |
| title | 22/800/29/-0.5 | 섹션 타이틀 |
| title2 | 18/700/24/-0.3 | 카드 타이틀·장소명 |
| bodyLg | 16/600/23/-0.2 | 강조 본문·버튼 |
| body | 15/500/22/-0.1 | 기본 본문 |
| bodyStrong | 15/700/22/-0.1 | 강조 본문 |
| label | 13/600/18/0 | 폼 라벨·메타 |
| caption | 12/500/16/0 | 보조 설명 |
| micro | 11/700/14/0.4 | 배지·섹션 라벨(uppercase) |

→ 현 fontSize 16종을 이 9개로 매핑. raw fontSize는 design 가드 ratchet으로 축소.

**SPACE (4px 그리드):** `s1=4 s2=8 s3=12 s4=16 s5=20 s6=24 s7=32 s8=40`. gap/padding/margin은 이 값만.
**RADIUS:** 기존 `r{xs6 sm10 md14 lg18 xl24}` + `pill=999`. raw 16 → lg(18)로 통일.
**ELEVATION:** `sh1`(카드 subtle) `sh2`(raised) `sh3`(modal) shadow 객체 토큰.
**색 refine(브랜드):** `canvas=#F6F5F2`(따뜻 bg), 중립 미세 warm 보정, `spectrum`(cold→ok→hot) 헬퍼.
hot/cold/ok 의미색은 유지(이게 브랜드).

## 3. 공용 primitive (apps/mobile/src/ui/) — 복붙 제거

모두 접근성(role/label/state) + 44pt 터치타겟 + 폰트 스케일(동적 타입) 내장.
- `Text({variant})` — TYPE 매핑 + 사용자 글씨크기 곱(a11y). 모든 화면이 RN Text 대신 이걸 import.
- `Button({variant: primary|secondary|ghost|danger, size, loading, disabled, full})` — min h48, role+state.
- `Input` / `Field({label, helper, error})` — 일관 radius/padding/focus/error.
- `Card`, `ListRow({title, sub, leading, trailing, onPress})` — 일관 shadow/radius, 44pt+.
- `Badge`, `Chip`, `SectionHeader`, `ScreenTitle`.
- `EmptyState({icon, title, desc, action})`, `ErrorState({message, onRetry})`(친근 문구+재시도), `Skeleton`.
- `IconButton` — 44pt, accessibilityLabel 필수.
- 아이콘: 이모지(🔒📌📍) → **SVG 아이콘**(react-native-svg 기존 사용 / lucide-react-native). DESIGN.md 자기모순 해소.

**시그니처 컴포넌트:**
- `ThermoVote` — 투표 화면 hero. 추워요(cold)·적당해요(ok)·더워요(hot) **큰 thermal 버튼** 3개,
  선택 시 해당 온도색으로 채워지고 press 피드백(scale/opacity). 직관·심미의 핵심 모먼트.
- `ResultSpectrum` — 결과를 cold|ok|hot **온도 스펙트럼 바** + % + n명. 막대 3개 나열 대신 하나의 스펙트럼.

## 4. 지적사항 → fix 매핑 (전부)

| 지적 | fix |
|---|---|
| fontSize 16종 | TYPE 9단계 + `Text` variant, raw ratchet |
| 스페이싱 임의값 | SPACE 토큰만 사용, primitive가 강제 |
| radius raw 16/999 혼용 | r 스케일 + pill, primitive 내장 |
| input/submit/card 복붙 | Button/Input/Field/Card/ListRow primitive |
| "자주 선택" 배지 남발 | 지하철만(또는 제거) — 데이터 없으면 장식 금지 |
| sub:'' 빈 subtitle 렌더 | sub 없으면 미렌더 |
| Yonsei "자주가는건물"=알파벳6 | 라벨을 "건물 둘러보기"로 정직화 |
| 상태 spinner+raw error | EmptyState/ErrorState/Skeleton, vote 에러 친근 문구 |
| 접근성 role/label/44pt | primitive에 내장 |
| 이모지 아이콘 vs DESIGN.md | SVG 아이콘 교체 |
| 브랜드 제네릭 | Thermal Civic(warm canvas + 스펙트럼 + 로고 모먼트) |

## 5. 화면별 재설계 의도

- **홈(index)**: warm canvas. 상단 브랜드(로고 swirl 모먼트). "지금 어디 계세요?" display. 카테고리 =
  일관 Card/ListRow. 배지 절제. "이동 중/머무르는 곳" 위계 유지(좋은 IA). 하단 "다른 장소 찾기" 1개로(중복 divider 제거).
- **투표(p/[placeId])**: hero = `ThermoVote`. 로딩=Skeleton, 에러=ErrorState(재시도), 결과=`ResultSpectrum`.
  공유·즐겨찾기 IconButton. 직관·심미 최우선 화면.
- **CategoryPicker**: ListRow/Card 통일, sub 빈 항목 정리, 배지 규칙.
- **wizard 7종**(subway/bus/train/intercity/cafe/classroom/custom): Field/Button/Input/EmptyState로 재구성. 입력 흐름 동일 패턴.
- **classroom 5종**: ListRow 통일, 정직 라벨.
- **login/settings/qr**: Button/Text 통일.

## 6. 구현 순서

1. 토큰(TYPE/SPACE/elevation/canvas) — 추가. 2. ui/ primitive + 단위테스트. 3. 홈+CategoryPicker.
4. 투표(hero). 5. wizard 7종. 6. classroom. 7. login/settings/qr. 8. design 가드 ratchet 축소. 9. 검증.

각 단계 후 tsc/build + 화면 캡처 시각 확인. 큰 묶음마다 Codex 이중검수.

## 7. 테스트 보강 + 버그픽스 (오버피팅 금지)

- **e2e(web prod 대상)**: 핵심 여정 회귀 강화 — 홈 렌더+카테고리, 각 wizard 입력 도달, 투표 화면(3버튼+투표후 결과),
  classroom 114, custom 검색, privacy 200. copy/pixel 정확매칭 ❌(churn). 흐름·존재 위주.
- **unit(core)**: 기존 170 유지 + 신규 순수로직(type resolver, vote 집계 math)만 추가. UI 과도 snapshot ❌.
- **mobile**: Maestro 여정 flow를 스모크로(sim-shots 패턴 재사용).
- **버그 프로토콜**: 재설계 중 발견한 기능오류 즉시 fix + 회귀테스트 1개 박기 (regressions.spec / unit).

## 8. 스코핑·안전

- 모바일 우선. 공유 토큰은 **추가** 위주 → web 무영향. 색 refine(canvas 등)은 web fast-follow로 통일(브랜드 SSOT, web 시각 재확인 필요 — 별도 단계).
- 출시 중: 이 재설계는 **새 빌드**라 현 TestFlight #16을 대체. 재설계 완료 후 새 빌드 → 제출. (현 제출 보류 권고.)
- design 가드 baseline은 primitive가 raw를 흡수하며 ratchet 축소.

## 9. Codex 이중검수 반영 (확정 — persistent 019ec64a / fresh 019ec6f8)

사용자 지시("전부 다 고쳐 + 예쁘게")가 검수자 "v1.1로 미뤄라"보다 우선. 단 검수자의 **안전장치는 전부 채택**:
다 고치되 staged + 테스트 먼저.

- **AppText**(이름 Text 아님). 수동 fontScale 곱 ❌ → 네이티브 scaling + `maxFontSizeMultiplier` + `TextProps` pass-through (`numberOfLines`/nested Text 보존). React19/RN0.81 Text 회귀 회피.
- **TYPE**: `body`/`bodyStrong` 분리 ❌ → `<AppText variant weight>` modifier. 한글 본문 letterSpacing **0** (display/title만 미세 음수). lineHeight는 한글 기준 충분히(body 15/22).
- **SPACE**: `s1..s8` + **semantic alias** `screenPadding(20) bottomInset(40) topBarHeight stackGap fieldGap rowGap touchMin(44)`. raw 전면금지 완화(safe-area 여백 허용).
- **primitive 추가**: `SegmentedControl`(intercity 토글), `SelectionGrid`(차량/호차/방), `TopBar`(헤더 SSOT). 이게 ThermoVote보다 먼저.
- **canvas**: core에 추가하되 **web+mobile 동시 적용**(SSOT 유지). web 시각 재확인 단계 포함.
- **ThermoVote**: 선택 전 = neutral surface, 선택 후 = thermal fill + check 아이콘 + "내 선택" + `accessibilityState{selected}`. 색만으로 상태 구분 ❌.
- **ResultSpectrum**: 순수 그라데이션 ❌ → 분절 막대 + 라벨 + % (색약·수치 판독).
- **RN smoke 먼저**: Maestro flow에 `assertVisible` 추가해 핵심 여정(홈→카테고리→각 wizard 입력→투표) 회귀 감지. `npm run smoke:mobile`. web e2e는 RN 회귀 못 잡으므로 필수.
- Skeleton은 지연 체감되는 곳(검색/검증/투표)만. 로고 "모먼트"는 최소 — 브랜드 = 일관 UI 언어.

**구현 순서(확정)**: 토큰 → primitive + 단위테스트 → RN smoke 안전망 → 투표(hero) → 홈 → CategoryPicker
→ wizard 7종 → classroom → login/settings/qr → 가드 ratchet → 검증 → 새 EAS 빌드(#16 대체).
각 큰 묶음마다 tsc/build/시각캡처, 파운데이션·전체완료 시점 Codex 재검수.

