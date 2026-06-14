#!/usr/bin/env node
// 스토어 스크린샷 캡처 — iOS 시뮬레이터(실제 출시 앱)에서 Maestro로 화면을 찍어 raw/로 가져온다.
// 왜 시뮬레이터: 스토어는 모바일 앱 리스팅이므로 원판은 실제 앱이어야 한다 (웹 PWA는 모바일에 없는
// UI를 노출 → 심사 리젝). read-only: 탐색만, 투표·등록 안 함.
//
// 전제: iOS 시뮬레이터에 앱 설치 + Metro 실행 + Maestro 설치. (로컬 전용 — CI 불요.)
// 사용: node scripts/store-screenshots/capture.mjs
//   출력: scripts/store-screenshots/raw/{name}.png  (이후 compose.mjs가 프레이밍)

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readdirSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { SHOTS } from './shots.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(__dirname, 'raw');
const FLOW = resolve(__dirname, 'sim-shots.yaml');
const MAESTRO_TESTS = resolve(homedir(), '.maestro/tests');

mkdirSync(RAW, { recursive: true });

// 1) 부팅된 시뮬레이터 확인.
let booted;
try {
  booted = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted'], { encoding: 'utf8' });
} catch {
  console.error('✗ xcrun simctl 실행 실패 — macOS + Xcode 필요.');
  process.exit(1);
}
if (!/Booted/.test(booted)) {
  console.error('✗ 부팅된 iOS 시뮬레이터 없음. 앱 실행 후 다시: (예) npm run -w @aircon/mobile ios');
  process.exit(1);
}

// 2) Maestro flow 실행 (실패해도 일부 스크린샷은 남을 수 있음).
console.log('→ Maestro flow 실행 (시뮬레이터 탐색 + 캡처)…');
try {
  execFileSync('maestro', ['test', FLOW], { stdio: 'inherit' });
} catch {
  console.error('⚠️  Maestro flow 일부 실패 — 캡처된 것만 사용. (홈 카테고리 라벨 변경 시 sim-shots.yaml 보정)');
}

// 3) 최신 Maestro test run 디렉터리에서 {name}.png를 raw/로 복사.
function latestRunDir() {
  if (!existsSync(MAESTRO_TESTS)) return null;
  const dirs = readdirSync(MAESTRO_TESTS)
    .map((d) => resolve(MAESTRO_TESTS, d))
    .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return dirs[0] ?? null;
}
const runDir = latestRunDir();
if (!runDir) { console.error('✗ Maestro 결과 디렉터리 없음.'); process.exit(1); }

let ok = 0;
const missing = [];
for (const { name } of SHOTS) {
  const src = resolve(runDir, `${name}.png`);
  if (existsSync(src)) { copyFileSync(src, resolve(RAW, `${name}.png`)); console.log(`✓ ${name}`); ok++; }
  else { missing.push(name); }
}

console.log(`\n${ok}/${SHOTS.length} → scripts/store-screenshots/raw/`);
if (missing.length) {
  console.error('실패(시뮬레이터에서 수동 캡처 가능): ' + missing.join(', '));
  console.error('  예: xcrun simctl io booted screenshot scripts/store-screenshots/raw/<name>.png');
  process.exit(1);
}
