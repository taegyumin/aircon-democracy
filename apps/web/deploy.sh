#!/usr/bin/env bash
# Aircon Democracy — prod deploy. fail-fast + post-deploy 검증.
#
# 한 줄: `npm run -w apps/web deploy`
#
# 빠지면 prod 깨지는 단계 (2026-05-27 회귀로 다 한 번씩 당함, fail-fast 강화):
#   1. ~/.aircon-env 로드
#   2. NEXT_PUBLIC_ alias (Next.js client bundle inline)
#   3. next build (fail → abort)
#   4. next-on-pages 변환 (fail → abort) — 빠지면 .vercel/output/static 옛 빌드 그대로
#   5. wrangler pages deploy (aircon-democracy-next — custom domain 매핑된 프로젝트)
#   6. ★ post-deploy verify: prod /wizard 200 + 새 deployment commit이 main HEAD인지
#
# 함정:
# - `--project-name=aircon-democracy` (대시) → 잘못된 프로젝트.
# - next-on-pages 단계 빼면 .vercel/output/static 옛 빌드 그대로 deploy.
# - NEXT_PUBLIC_ alias 없으면 client 번들에 NCP 키 빠짐 → 지도 안 뜸.
# - next build fail 시에도 .vercel 옛 빌드 남아 있어 wrangler가 "success" 메시지.
#   → 빌드 단계 별도 종료 코드 체크 + 빌드 산물 fresh 검증.

set -euo pipefail

# 모든 명령에 색깔 표시 — 실패 단계 한눈에.
red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
step() { printf '\033[36m→ %s\033[0m\n' "$*"; }

cd "$(dirname "$0")"

# 1. env 로드
if [[ ! -f "$HOME/.aircon-env" ]]; then
  red "❌ ~/.aircon-env 못 찾음"
  exit 1
fi
# shellcheck disable=SC1091
source "$HOME/.aircon-env"

# 1.5 게이트 — 모든 배포 경로의 단일 관문.
# 왜: root predeploy 훅만으론 `npm run -w @aircon/web deploy`·`bash deploy.sh` 직접 호출이
# 우회된다 (Codex 이중검수 지적 2026-06-07). 실제 wrangler deploy로 가는 길목은 여기뿐이라,
# 여기서 게이트를 돌리면 어떤 경로로 호출해도 typecheck+lint+unit+data+store+design을 통과해야만 배포된다.
step "gate (typecheck + lint + unit + data + store + design)"
REPO_ROOT="$(git rev-parse --show-toplevel)"
if ! ( cd "$REPO_ROOT" && npm run gate ); then
  red "❌ gate 실패 — deploy 중단"
  exit 1
fi

# 2. NEXT_PUBLIC alias
export NEXT_PUBLIC_NCP_MAPS_CLIENT_ID="${NEXT_PUBLIC_NCP_MAPS_CLIENT_ID:-${NCP_MAPS_CLIENT_ID:-}}"
if [[ -z "$NEXT_PUBLIC_NCP_MAPS_CLIENT_ID" ]]; then
  yellow "⚠️  NCP_MAPS_CLIENT_ID 없음 — 지도 안 뜰 수 있음"
fi

# 3. clean rebuild (stale .vercel/.next 회귀 방지)
step "clean .vercel .next"
rm -rf .vercel .next

# 4. next build — fail-fast
step "next build"
if ! npx next build; then
  red "❌ next build 실패 — deploy 중단"
  exit 2
fi

# 5. next-on-pages — fail-fast
step "next-on-pages 변환"
if ! npx @cloudflare/next-on-pages; then
  red "❌ next-on-pages 실패 — deploy 중단"
  exit 3
fi

# 6. 빌드 산물 무결성 확인 — _worker.js + functions가 다 있어야.
if [[ ! -f .vercel/output/static/_worker.js/index.js ]]; then
  red "❌ .vercel/output/static/_worker.js/index.js 없음 — 빌드 산물 손상"
  exit 4
fi
if [[ ! -f ".vercel/output/functions/api/[[...path]].func/index.js" ]]; then
  red "❌ /api/[[...path]] function 빌드 산물 없음 — Hono routes 깨짐"
  exit 5
fi

# 7. deploy. 프로젝트 이름 hardcode — 잘못된 프로젝트 회귀 방지.
PROJECT="aircon-democracy-next"
BRANCH="${1:-main}"
MSG="${2:-prod-deploy}"

step "wrangler pages deploy ($PROJECT, branch=$BRANCH)"
if ! npx wrangler pages deploy .vercel/output/static \
  --project-name="$PROJECT" \
  --branch="$BRANCH" \
  --commit-message="$MSG"; then
  red "❌ wrangler deploy 실패"
  exit 6
fi

# 8. post-deploy verify — prod 응답 + deployment list의 latest commit이 git HEAD인지.
step "post-deploy verify"
HEAD_SHA="$(git rev-parse --short=7 HEAD 2>/dev/null || echo unknown)"
sleep 2  # CF Pages alias 갱신 lag (보통 즉시지만 안전 buffer).

PROD_STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "https://aircondemocracy.com/wizard" --max-time 10 || echo "000")
if [[ "$PROD_STATUS" != "200" ]]; then
  red "❌ prod /wizard HTTP $PROD_STATUS — 검증 실패"
  exit 7
fi

# latest production deployment의 source commit이 HEAD와 일치하는지.
LATEST_SOURCE=$(npx wrangler pages deployment list --project-name="$PROJECT" 2>/dev/null \
  | awk -F'│' '/Production/ && /main/ {gsub(/ /,"",$5); print $5; exit}')
if [[ -n "$LATEST_SOURCE" && -n "$HEAD_SHA" && "$LATEST_SOURCE" != "$HEAD_SHA"* ]]; then
  yellow "⚠️  prod latest deployment source ($LATEST_SOURCE) ≠ git HEAD ($HEAD_SHA). CF Pages alias가 옛 deploy로 lock됐을 수 있음."
fi

green "✅ deploy complete — https://aircondemocracy.com (HEAD=$HEAD_SHA, prod=200)"
