#!/usr/bin/env node
// SOT(apps/web/src/lib/securityHeaders.ts)에서 public/_headers를 생성.
// next.config.ts는 SOT를 직접 import하지만 _headers는 CF Pages static 파일이라 사전 생성 필요.
//
// 실행 시점: prebuild hook (npm run build 전). 만약 SOT가 변경됐는데 _headers가
// 그대로면 빌드 시점에 자동으로 동기화. 수동 git status로 diff 확인 권장.
//
// 정적 자산 캐시 정책(_next/static immutable, icon/manifest)은 generator 영역 밖 — 그대로 유지.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HEADERS_FILE = resolve('apps/web/public/_headers');
const SOT_FILE = resolve('apps/web/src/lib/securityHeaders.ts');

// SOT 파일에서 CSP_DIRECTIVES + SECURITY_HEADERS 추출. eval은 위험하니
// 간단한 regex로 파싱. 형식 안 맞으면 fail → 사용자 직접 SOT 확인.
function extractCspValue(sotSrc) {
  // CSP_HEADER_VALUE 직접 만들기 — directives object → 'k v1 v2; k2 v1' string
  const directives = {};
  const blockMatch = sotSrc.match(/CSP_DIRECTIVES:\s*Record<string,\s*string\[\]>\s*=\s*\{([\s\S]*?)\n\};/);
  if (!blockMatch) throw new Error('CSP_DIRECTIVES 블록을 못 찾았어요. SOT 파일 구조가 바뀐 듯.');
  const block = blockMatch[1];
  const rowRegex = /'([^']+)':\s*\[([^\]]+)\]/g;
  let m;
  while ((m = rowRegex.exec(block)) !== null) {
    const key = m[1];
    const items = m[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^['"]|['"]$/g, ''));
    directives[key] = items;
  }
  if (!Object.keys(directives).length) throw new Error('CSP_DIRECTIVES 비어있음. 파싱 실패.');
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

function extractSecurityHeaders(sotSrc, cspValue) {
  const blockMatch = sotSrc.match(/SECURITY_HEADERS:\s*SecurityHeader\[\]\s*=\s*\[([\s\S]*?)\n\];/);
  if (!blockMatch) throw new Error('SECURITY_HEADERS 블록을 못 찾았어요.');
  const block = blockMatch[1];
  const rowRegex = /\{\s*key:\s*'([^']+)',\s*value:\s*'([^']*)'/g;
  const headers = [];
  let m;
  while ((m = rowRegex.exec(block)) !== null) {
    headers.push({ key: m[1], value: m[2] });
  }
  // CSP는 CSP_HEADER_VALUE 변수로 대입 — 별도 처리.
  const cspRowRegex = /\{\s*key:\s*'Content-Security-Policy',\s*value:\s*CSP_HEADER_VALUE\s*\}/;
  if (cspRowRegex.test(block)) {
    headers.push({ key: 'Content-Security-Policy', value: cspValue });
  }
  if (!headers.length) throw new Error('SECURITY_HEADERS 비어있음. 파싱 실패.');
  return headers;
}

function buildHeadersFile(securityHeaders) {
  const headerLines = securityHeaders
    .map((h) => `  ${h.key}: ${h.value}`)
    .join('\n');
  // Static asset cache는 generator 영역 밖 — 직접 작성한 영역 유지.
  return `/*
${headerLines}

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/icon.png
  Cache-Control: public, max-age=86400

/manifest.webmanifest
  Cache-Control: public, max-age=3600
  Content-Type: application/manifest+json
`;
}

const sotSrc = readFileSync(SOT_FILE, 'utf-8');
const cspValue = extractCspValue(sotSrc);
const securityHeaders = extractSecurityHeaders(sotSrc, cspValue);
const newContent = buildHeadersFile(securityHeaders);
const oldContent = readFileSync(HEADERS_FILE, 'utf-8');

if (newContent === oldContent) {
  console.log('✅ _headers already in sync with SOT (securityHeaders.ts).');
} else {
  writeFileSync(HEADERS_FILE, newContent);
  console.log('🔄 _headers re-generated from SOT (securityHeaders.ts).');
  console.log('   git diff apps/web/public/_headers 로 변경 확인 후 commit.');
}
