#!/usr/bin/env node
// 스토어 카피 SSOT → 제출 파일 생성 + 드리프트 가드.
//
// 왜: 부제·설명·키워드·릴리스노트를 ASC(store.config.json)·Play(.txt)·문서에 손으로
// 복사하다 어긋나면 "이미 제거한 기능을 스토어가 계속 광고"하는 심사 리젝 사고가 난다.
// (snuboard 'AI 한 줄 요약 허위표기' 사고 이식.) SSOT 하나에서 전 파일을 생성하고,
// --check를 CI에 박아 push마다 드리프트를 차단한다.
//
// 사용:
//   node scripts/store-sync.mjs          # 제출 파일 생성/갱신 (docs/store/store-copy.json 기준)
//   node scripts/store-sync.mjs --check   # 드리프트/길이초과 시 exit 1 (쓰기 없음, CI 게이트)
//
// 산출물:
//   apps/mobile/store.config.json   — EAS metadata (`eas metadata:push`)용. apple.info.<locale>.
//   docs/store/play/*.txt            — Play Console 수동 입력용 (title/short/full description).
//
// 주: App Store 키워드 실제 제한은 콤마결합 문자열 100자(코드포인트). EAS 스키마는 배열이라
//     배열로 내보내되 결합 길이로 검증. 길이는 자모 아닌 코드포인트 기준.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SSOT = resolve(ROOT, 'docs/store/store-copy.json');
const STORE_CONFIG = resolve(ROOT, 'apps/mobile/store.config.json');
const PLAY_DIR = resolve(ROOT, 'docs/store/play');

const CHECK = process.argv.includes('--check');

const cp = (s) => [...String(s)].length;                 // 코드포인트 길이
const joinLines = (v) => (Array.isArray(v) ? v.join('\n') : String(v));

const ssot = JSON.parse(readFileSync(SSOT, 'utf8'));
const loc = ssot.appStoreLocale || 'ko';
const c = ssot[loc];
if (!c) {
  console.error(`✗ SSOT에 '${loc}' 로케일 블록이 없습니다.`);
  process.exit(1);
}

// ── 1) 길이 검증 (생성·검사 양 모드 공통, 초과 시 항상 실패) ──
const description = joinLines(c.description);
const releaseNotes = joinLines(c.releaseNotes);
const keywordsJoined = (c.keywords || []).join(',');
const L = ssot.limits || {};
const lenChecks = [
  ['title', cp(c.title), L.title],
  ['subtitle', cp(c.subtitle), L.subtitle],
  ['shortDescription', cp(c.shortDescription), L.shortDescription],
  ['keywords(콤마결합)', cp(keywordsJoined), L.keywordsJoined],
  ['promoText', cp(c.promoText), L.promoText],
  ['description', cp(description), L.description],
  ['releaseNotes', cp(releaseNotes), L.releaseNotes],
];
const tooLong = lenChecks.filter(([, n, max]) => max && n > max);
if (tooLong.length) {
  console.error('✗ 길이 초과 (코드포인트 기준):');
  for (const [f, n, max] of tooLong) console.error(`  ${f}: ${n} > ${max}`);
  process.exit(1);
}

// ── 2) 산출물 구성 ──
const storeConfig = {
  configVersion: 0,
  apple: {
    // 주: EAS metadata 스키마상 copyright/version은 apple 아래 (root 아님).
    // 검증: expo/eas-cli schema/metadata-0.json → properties.apple.properties.copyright.
    ...(ssot.copyright ? { copyright: ssot.copyright } : {}),
    info: {
      [loc]: {
        title: c.title,
        subtitle: c.subtitle,
        description,
        keywords: c.keywords,
        releaseNotes,
        promoText: c.promoText,
        marketingUrl: ssot.urls.marketing,
        supportUrl: ssot.urls.support,
        privacyPolicyUrl: ssot.urls.privacy,
      },
    },
  },
};
const playFiles = {
  'title.txt': c.title + '\n',
  'short_description.txt': c.shortDescription + '\n',
  'full_description.txt': description + '\n',
};

// ── 3) 드리프트 비교 (--check) 또는 쓰기 ──
const drift = [];

// store.config.json: 의미(JSON) 비교 — 포맷 차이는 무시, 내용만.
function jsonDrift(path, obj) {
  if (!existsSync(path)) return true;
  try {
    return JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))) !== JSON.stringify(obj);
  } catch {
    return true;
  }
}
if (jsonDrift(STORE_CONFIG, storeConfig)) {
  drift.push('apps/mobile/store.config.json');
  if (!CHECK) writeFileSync(STORE_CONFIG, JSON.stringify(storeConfig, null, 2) + '\n');
}

// Play .txt: 내용(정확) 비교.
for (const [name, content] of Object.entries(playFiles)) {
  const p = resolve(PLAY_DIR, name);
  const cur = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (cur !== content) {
    drift.push(`docs/store/play/${name}`);
    if (!CHECK) {
      mkdirSync(PLAY_DIR, { recursive: true });
      writeFileSync(p, content);
    }
  }
}

// ── 4) 결과 ──
if (CHECK) {
  if (drift.length) {
    console.error('✗ 스토어 카피 드리프트 — SSOT와 어긋난 제출 파일:');
    for (const f of drift) console.error('  ' + f);
    console.error('\n→ docs/store/store-copy.json 수정 후 `npm run store:sync` 실행하고 커밋하세요.');
    process.exit(1);
  }
  console.log('✓ 스토어 카피 SSOT 동기화 상태 (드리프트 없음)');
} else if (drift.length) {
  console.log('갱신된 파일:');
  for (const f of drift) console.log('  ' + f);
  console.log('\n커밋하세요. (iOS는 `eas metadata:push`, Play는 docs/store/play/*.txt 콘솔 붙여넣기)');
} else {
  console.log('✓ 변경 없음 — 이미 SSOT와 일치.');
}
