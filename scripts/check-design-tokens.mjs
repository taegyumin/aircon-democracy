#!/usr/bin/env node
// 디자인 색 토큰 가드 — 하드코딩 색(hex / 컬러 함수)을 ratchet으로 차단.
//
// 왜: TOKEN(@aircon/core) SSOT가 있어도 강제하지 않으면 "급해서 하드코딩 한 번"이 스며들어
// 무력화된다. 색은 TOKEN.x를 쓰고, 알파 틴트는 `${TOKEN.x}15`(8자리 hex suffix)로. 흑백 그림자
// 오버레이(rgba(0,0,0,x))만 예외.
//
// 범위: 색만 본다 (fontSize·spacing·radius는 추후 별도 가드 — DESIGN.md "점진적").
//
// ── ratchet baseline ──
// 파일별 "색 등장 횟수(occurrence count)"를 baseline에 스냅샷한다. 어떤 파일도 횟수가 baseline보다
// **늘면 실패**(distinct가 아니라 count라서 같은 색 복제·새 파일·새 색 전부 잡힘). 줄이는 건 자유.
// `--update`는 ratchet — 횟수가 느는 파일이 있으면 `--force` 없이 거부(면죄부 방지). 정식으로 팔레트
// 색을 추가했을 때만 `--update --force`.
//
// 사용:
//   node scripts/check-design-tokens.mjs            # baseline보다 늘면 exit 1 (CI 게이트)
//   node scripts/check-design-tokens.mjs --update    # 줄어든 만큼만 baseline 갱신 (ratchet)
//   node scripts/check-design-tokens.mjs --update --force  # 의도적 증가 허용 (팔레트 정식 추가 후)
//
// 예외: 줄에 `DESIGN-EXEMPT(사유)` 주석이 있으면 그 줄은 건너뜀 (사유 괄호 필수).
// 팔레트 정의 파일(tokens.ts, brands.ts)은 색의 출처라 스캔 제외.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASELINE = resolve(ROOT, 'scripts/design-tokens-baseline.json');
const UPDATE = process.argv.includes('--update');
const FORCE = process.argv.includes('--force');

const SCAN_DIRS = ['apps/web/src', 'apps/mobile/app', 'apps/mobile/src', 'packages/core/src'];
// 색의 정본 — 여기는 하드코딩이 정상(팔레트 정의).
const ALLOWLIST = new Set([
  'packages/core/src/tokens.ts',
  'packages/core/src/brands.ts',
]);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
// 컬러 함수: rgb/rgba/hsl/hsla/oklch/oklab/color-mix/color(...). 흑백 rgb/rgba(그림자)만 예외.
const COLOR_FN_RE = /\b(?:rgba?|hsla?|oklch|oklab|color-mix|color)\([^)]*\)/gi;
const BW_RGB = /\b(?:rgba?)\(\s*(?:0\s*[,\s]\s*0\s*[,\s]\s*0|255\s*[,\s]\s*255\s*[,\s]\s*255)/i;

function listFiles() {
  const out = execFileSync('git', ['-C', ROOT, 'ls-files', ...SCAN_DIRS], { encoding: 'utf8' });
  return out.split('\n')
    .filter(Boolean)
    .filter((f) => /\.(ts|tsx|css)$/.test(f))
    .filter((f) => !/(__tests__|\.test\.|\.spec\.|\.d\.ts$)/.test(f))
    .filter((f) => !ALLOWLIST.has(f));
}

// 파일의 색 등장 횟수.
function countColors(file) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  let n = 0;
  for (let line of text.split('\n')) {
    if (line.includes('DESIGN-EXEMPT(')) continue;   // 사유 괄호 필수
    line = line.replace(/\/\/.*$/, '');               // 줄 주석 제거 (URL·이슈번호 오탐 방지)
    for (const m of line.matchAll(HEX_RE)) n++;
    for (const m of line.matchAll(COLOR_FN_RE)) { if (!BW_RGB.test(m[0])) n++; }
  }
  return n;
}

// 현재 스냅샷 { file: count>0 }
const current = {};
for (const f of listFiles()) {
  const n = countColors(f);
  if (n > 0) current[f] = n;
}

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;

if (UPDATE) {
  // ratchet: baseline이 이미 있고 --force 아니면, 느는 파일은 거부.
  if (baseline && !FORCE) {
    const increased = [];
    for (const [f, n] of Object.entries(current)) {
      const b = baseline[f] || 0;
      if (n > b) increased.push(`${f}  ${b} → ${n}`);
    }
    if (increased.length) {
      console.error('✗ baseline ratchet 위반 — 색 등장 횟수가 늘었습니다:');
      for (const i of increased) console.error('  ' + i);
      console.error('\n→ TOKEN을 쓰세요. 팔레트에 색을 정식 추가한 의도적 증가면 `--update --force`.');
      process.exit(1);
    }
  }
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(`✓ baseline 갱신: ${Object.keys(current).length}개 파일, 색 ${total}회 스냅샷${FORCE ? ' (--force)' : ''}.`);
  process.exit(0);
}

// check 모드: baseline보다 늘었으면 실패.
const base = baseline || {};
const grown = [];
for (const [f, n] of Object.entries(current)) {
  const b = base[f] || 0;
  if (n > b) grown.push(`${f}  ${b} → ${n}`);
}
if (grown.length) {
  console.error('✗ 신규 하드코딩 색 (TOKEN.x 사용, 그림자 rgba(0,0,0,x)만 예외):');
  for (const g of grown) console.error('  ' + g);
  console.error('\n→ packages/core의 TOKEN을 쓰거나, 정당하면 `// DESIGN-EXEMPT(사유)`.');
  console.error('  팔레트에 정식 추가했으면 `npm run design:baseline -- --force`로 ratchet 갱신.');
  process.exit(1);
}
console.log('✓ 신규 하드코딩 색 없음 (baseline 대비).');
