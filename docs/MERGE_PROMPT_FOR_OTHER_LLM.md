# 머지 부탁 프롬프트 (다른 LLM 용)

`claude/seoul-univs-research` 브랜치를 `main`에 머지·배포하는 작업입니다. 데이터셋(108→112교, 624→817 건물) + Wizard 버그 fix가 들어 있습니다.

---

## 작업 컨텍스트

당신은 **에어컨 민주주의(Aircon Democracy)** 프로젝트의 `claude/seoul-univs-research` 브랜치를 `main`에 머지하고, 배포(Cloudflare Pages)까지 진행합니다.

**이 브랜치가 들어 있는 변경**:
- 한국 4년제 대학 112교 / 118 캠퍼스 / 817 건물 데이터셋 (`packages/core/src/universities/`)
- Generic classroom wizard 컴포넌트 (`apps/web/src/screens/wizard/classroom/generic/`)
- SNU classroom wizard 라우팅 확장 (`apps/web/src/screens/wizard/classroom/snu/SNUClassroomWizard.tsx`)
- 검증 문서 6개 (`docs/SEOUL_UNIVERSITIES.md`, `REVIEW_PROMPT_*.md`, `UNIVERSITY_DATASET_VALIDATION_*.md`, 등)

**상태**: 브랜치는 origin/main 대비 약 +32 / -19 (양쪽 diverged). 머지가 fast-forward 안 되므로 **rebase 또는 merge commit** 필요.

**작업 위치**: `/Users/taegyumin/.claude/worktrees/seoul-univs` (별도 워크트리)

## 5대 금지 사항 (위반 시 즉시 중단)

1. ❌ `git push --force` / `git push -f` / force-with-lease (main 브랜치)
2. ❌ `git commit --amend` (기존 commit 수정)
3. ❌ `git rebase -i` 로 commit squash/drop (history 변형)
4. ❌ `git push` 사용자 명시 동의 없이 (Phase 6 OK 받기 전 push 금지)
5. ❌ Pre-commit hook skip (`--no-verify`)

## Phase 1: 현재 상태 진단

```bash
cd /Users/taegyumin/.claude/worktrees/seoul-univs
git status                                       # 워크트리 clean인지
git fetch origin                                 # main 최신 가져오기
git log --oneline --graph --all -30              # 분기 시각화
git rev-list --left-right --count claude/seoul-univs-research...origin/main
```

각각의 출력 짧게 보고. ahead/behind 숫자 명시.

## Phase 2: 변경 파일 충돌 가능성 사전 분석

```bash
# 브랜치가 변경한 파일들
git diff --name-only origin/main...claude/seoul-univs-research | sort > /tmp/branch_files.txt

# main이 (분기 후) 변경한 파일들  
git diff --name-only claude/seoul-univs-research...origin/main | sort > /tmp/main_files.txt

# 양쪽이 모두 손댄 파일 (충돌 후보)
comm -12 /tmp/branch_files.txt /tmp/main_files.txt
```

**충돌 후보 파일이 있으면 그 파일들의 git log를 양쪽 다 확인**. 두 변경이 같은 줄을 건드렸는지 미리 가늠.

특히 주의:
- `apps/web/src/screens/wizard/classroom/snu/SNUClassroomWizard.tsx` (브랜치에서 import 추가 + 라우팅 분기)
- `packages/core/package.json` (브랜치에서 `./universities` export 추가)
- `apps/web/src/screens/LocationWizardScreen.tsx` (만약 main에서 손댔다면 위험)

## Phase 3: 머지 전 typecheck baseline

```bash
cd packages/core && npx tsc --noEmit
cd ../../apps/web && npx tsc --noEmit
```

둘 다 통과해야 머지 진행. 실패하면 Phase 1로.

## Phase 4: 머지 전략 결정

### Strategy A (권장 우선): Rebase

```bash
git checkout claude/seoul-univs-research
git rebase origin/main
```

- 충돌 없음 → Phase 5로
- 충돌 있음 → 각 conflict 파일을 열어 의도 파악 후 수동 해결. **추측 금지** — 모호하면 사용자에게 묻기.
- 너무 많이 충돌(>3 파일)이면 **abort 후 Strategy B로**:
  ```bash
  git rebase --abort
  ```

### Strategy B: Merge commit (Strategy A 실패 시)

```bash
git checkout main
git pull --ff-only origin main          # main 최신 동기
git merge --no-ff claude/seoul-univs-research -m "Merge classroom dataset + wizard"
```

이 방법은 history에 머지 commit이 남지만 conflict 해결이 한 번에 끝남.

## Phase 5: 머지 후 검증

```bash
# 머지 결과 브랜치가 main에 들어가야 함
git log --oneline -5    # 최신 commit 확인

# 타입체크 재실행
cd packages/core && npx tsc --noEmit
cd ../../apps/web && npx tsc --noEmit

# 실제 빌드 (시간 좀 걸림)
cd apps/web && npm run build 2>&1 | tail -20

# 테스트 (있다면)
cd /Users/taegyumin/github/aircon-democracy  # 메인 디렉토리
npm run test:unit 2>&1 | tail -20
```

빌드/테스트 실패하면 **push 안 함**. 사용자에게 보고하고 결정 기다림.

## Phase 6: Push 전 사용자 확인 (필수)

머지·빌드 성공해도 **즉시 push 금지**. 사용자에게:

```
머지 + 빌드 성공. 다음 사항 확인 부탁드립니다:
- 머지된 commit: <hash>
- 추가된 파일: <개수>
- 변경된 파일: <개수>
- 빌드 시간: <시간>
- 빌드 산출물 크기: <크기>

push해도 될까요? (yes/no)
```

**사용자 "yes" 없으면 push 금지**. 위 정보 보여주고 대기.

## Phase 7: Push + 배포 확인

사용자 OK 받은 후:

```bash
git push origin main
```

Cloudflare Pages가 자동 deploy 트리거. 배포 상태 확인:

```bash
# wrangler 설치돼 있으면
wrangler pages deployment list --project-name=aircon-democracy-next
```

또는 사용자에게 `https://aircondemocracy.com` 직접 확인 부탁.

## Phase 8: 클린업

```bash
# 워크트리 정리 (사용자 확인 받은 후)
git worktree remove /Users/taegyumin/.claude/worktrees/seoul-univs
git branch -d claude/seoul-univs-research
```

원격 브랜치도 있다면 (없을 가능성 높음):
```bash
git push origin --delete claude/seoul-univs-research
```

## 정직 보고 기준

매 Phase 끝나면 짧게 보고:
- ✅ 통과 / ⚠️ 주의 / ❌ 실패 + 이유
- 자동으로 다음 Phase 진행 OK. 단 충돌·실패 시 멈추고 사용자 확인.

## Anti-patterns (이전 LLM 작업에서 흔한 실수)

- "충돌 잘 모르겠지만 적당히 해결" → **모호하면 사용자에게 묻기**
- "빌드 시간 오래 걸려서 스킵" → **하지 마세요. typecheck만 했다고 보고하면 위험**
- "push까지 한꺼번에 진행" → **Phase 6에서 무조건 사용자 확인**
- "git rebase -i 로 commit 깔끔하게 정리" → **금지. history 변형 금지**
- "main에 직접 commit으로 머지" → **rebase 또는 merge commit만**

## 만약 다른 LLM이 동시 작업 중이라면

작업 시작 전 `git status`를 메인 디렉토리(`/Users/taegyumin/github/aircon-democracy`)에서도 확인:

```bash
cd /Users/taegyumin/github/aircon-democracy
git status                          # 다른 LLM의 미커밋 변경 있나?
git worktree list                   # 다른 워크트리 활성 중?
```

다른 워크트리 있고 그쪽이 main을 손대고 있으면 작업 보류, 사용자에게 보고.

## 산출물

작업 끝나면:
1. main에 머지된 commit hash + 머지 방식 (rebase/merge commit) 보고
2. 빌드 결과 (성공/실패 + 시간)
3. 배포 상태 (트리거됨 vs 확인 필요)
4. 워크트리·브랜치 정리 여부

## 톤

사용자(PM)는 한국어 짧게 선호. 결과 + 다음 액션. Phase별 1-2줄 보고.

---

(이 프롬프트는 데이터셋·wizard 변경의 안전한 머지·배포를 위해 작성. 데이터 자체는 v2 리뷰까지 거쳐 검증된 상태. 머지·빌드만 안전하게 하면 됨.)
