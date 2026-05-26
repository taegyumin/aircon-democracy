#!/usr/bin/env node
// 데이터 무결성 검증 — packages/core/src/data/*.json
// CI에서 매 PR마다 실행. ghost/orphan/dup은 WARN (별도 sprint로 정리),
// "known bad pattern"만 FAIL (회귀 방지).

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(here, '..', 'packages', 'core', 'src', 'data');

function load(name) { return JSON.parse(readFileSync(resolve(DATA, name), 'utf8')); }

const stations = load('subway-stations.json');
const adjacency = load('subway-adjacency.json');

const warns = [];
const fails = [];

// ── WARNINGS (정보용, exit 0) ────────────────────────────────────

const ghost = stations.filter((s) => typeof s.lat !== 'number' || typeof s.lng !== 'number');
if (ghost.length > 0) {
  warns.push(`Ghost stations (lat/lng 누락) ${ghost.length}개`);
}

const knownNames = new Set(stations.flatMap((s) => [s.name, s.name.replace(/역$/, '')]));
const orphans = new Set();
for (const e of adjacency) {
  if (!knownNames.has(e.from) && !knownNames.has(e.from + '역')) orphans.add(e.from);
  if (!knownNames.has(e.to) && !knownNames.has(e.to + '역')) orphans.add(e.to);
}
if (orphans.size > 0) {
  warns.push(`Orphan adjacency ${orphans.size}개: ${Array.from(orphans).slice(0, 3).join(', ')}...`);
}

const byNameLine = new Map();
for (const s of stations) {
  for (const line of s.lines) {
    const k = `${s.name}::${line}`;
    if (!byNameLine.has(k)) byNameLine.set(k, []);
    byNameLine.get(k).push(s);
  }
}
const dupes = [];
for (const [k, list] of byNameLine.entries()) {
  if (list.length > 1) dupes.push(`${k} × ${list.length}`);
}
if (dupes.length > 0) {
  warns.push(`Duplicate station × line ${dupes.length}개: ${dupes.slice(0, 3).join(', ')}`);
}

// ── HARD FAILS (회귀 방지) ───────────────────────────────────────

const KNOWN_BAD_NAMES = [
  '문화공원동대문역사', // 동대문역사문화공원 ghost (2026-05-26 사용자 발견)
];
for (const bad of KNOWN_BAD_NAMES) {
  if (stations.some((s) => s.name.includes(bad))) fails.push(`Known bad station name "${bad}" 재출현`);
  if (adjacency.some((e) => e.from === bad || e.to === bad)) fails.push(`Known bad adjacency "${bad}" 재출현`);
}

// ── Report ───────────────────────────────────────────────────────

console.log(`📊 stations=${stations.length}, adjacency=${adjacency.length}`);
if (warns.length > 0) {
  console.log('⚠️  Warnings (별도 sprint로 정리):');
  for (const w of warns) console.log(`  - ${w}`);
}
if (fails.length > 0) {
  console.error('❌ FAILS (회귀):');
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
} else {
  console.log('✅ 알려진 bad pattern 없음');
}
