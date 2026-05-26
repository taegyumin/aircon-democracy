#!/usr/bin/env bash
# Aircon Democracy — prod deploy.
#
# 풀 워크플로우 한 줄로:
#   1. ~/.aircon-env 로드 (모든 secrets + API 키)
#   2. NEXT_PUBLIC_NCP_MAPS_CLIENT_ID alias (Next.js client bundle inline용)
#   3. next build → next-on-pages → wrangler pages deploy
#   4. **올바른 프로젝트 (aircon-democracy-next)** 에 deploy. 도메인은 여기 매핑.
#
# 함정 (한 번씩 다 당함, 메모리에 박힘):
# - `--project-name=aircon-democracy` (대시) → 잘못된 프로젝트. custom domain 안 따라옴.
# - next-on-pages 단계 빼면 .vercel/output/static 옛 빌드 그대로 deploy.
# - NEXT_PUBLIC_ alias 없으면 client 번들에 NCP 키 빠짐 → 지도 안 뜸.

set -euo pipefail

cd "$(dirname "$0")"

# 1. env 로드
if [[ ! -f "$HOME/.aircon-env" ]]; then
  echo "❌ ~/.aircon-env 못 찾음" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$HOME/.aircon-env"

# 2. NEXT_PUBLIC alias (Next.js는 NEXT_PUBLIC_ prefix만 client inline)
export NEXT_PUBLIC_NCP_MAPS_CLIENT_ID="${NEXT_PUBLIC_NCP_MAPS_CLIENT_ID:-${NCP_MAPS_CLIENT_ID:-}}"
if [[ -z "$NEXT_PUBLIC_NCP_MAPS_CLIENT_ID" ]]; then
  echo "⚠️  NCP_MAPS_CLIENT_ID 없음 — 지도 안 뜰 수 있음" >&2
fi

# 3. 빌드 (rebuild 강제 — stale .vercel 주의)
rm -rf .vercel .next
echo "→ next build"
npx next build
echo "→ next-on-pages"
npx @cloudflare/next-on-pages

# 4. deploy. 프로젝트 이름 hardcode — 잘못된 프로젝트 deploy 회귀 방지.
PROJECT="aircon-democracy-next"
BRANCH="${1:-main}"
MSG="${2:-prod-deploy}"

echo "→ wrangler pages deploy ($PROJECT, branch=$BRANCH)"
npx wrangler pages deploy .vercel/output/static \
  --project-name="$PROJECT" \
  --branch="$BRANCH" \
  --commit-message="$MSG"

echo "✅ deploy complete — https://aircondemocracy.com"
