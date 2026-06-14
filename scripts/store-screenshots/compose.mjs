#!/usr/bin/env node
// 스토어 스크린샷 합성 — raw/{name}.png(원판) + 헤드라인 + 기기프레임 → iOS/Play 캔버스.
// 왜: 단순 스크린캡쳐 말고 토스류 헤드라인 + 기기 mockup으로. 한 SHOTS 목록에서 iOS(1290×2796)
// + Play(1080×2160)를 같이 생성해 안 어긋난다 (snuboard 교훈).
//
// 합성은 Playwright HTML 렌더 — PIL 픽셀 푸시 대신 CSS로 라운드/그림자/폰트 처리(gen-og-image 패턴).
// raw/는 source-agnostic: 웹 자동 캡처든 iOS 시뮬레이터 수동 캡처든 {name}.png만 있으면 된다.
//
// 사용: node scripts/store-screenshots/compose.mjs
//   입력: scripts/store-screenshots/raw/{name}.png
//   출력: scripts/store-screenshots/out/ios/{name}.png, out/play/{name}.png

import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { SHOTS, TARGETS } from './shots.mjs';

const SS = 2; // 슈퍼샘플 배율 — 2배로 렌더 후 sharp로 정확한 스토어 규격으로 다운스케일.

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(__dirname, 'raw');
const OUT = resolve(__dirname, 'out');

// 디자인 토큰과 맞춤 (DESIGN.md: 하드코딩 색은 정본에서). 합성 캔버스 전용이라 여기 리터럴 OK.
const BG = '#EFF4FF';        // TOKEN.coldBg 계열 — 부드러운 배경
const HEADLINE = '#1A1A1F';  // TOKEN.text1
const FRAME = '#1A1A1F';     // 기기 베젤

function pageHtml({ imgDataUrl, headline, W, H }) {
  // 동심원 규칙: 스크린 라운드 = 베젤 라운드 − 베젤 두께. 슈퍼샘플은 deviceScaleFactor=2로.
  const bezel = Math.round(W * 0.012);
  const frameRadius = Math.round(W * 0.085);
  const screenRadius = frameRadius - bezel;
  const headFont = Math.round(W * 0.062);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
    * { margin:0; padding:0; box-sizing:border-box; }
    html,body { width:${W}px; height:${H}px; }
    body {
      background:${BG};
      font-family:'Pretendard Variable',Pretendard,-apple-system,sans-serif;
      display:flex; flex-direction:column; align-items:center;
      padding:${Math.round(H * 0.055)}px ${Math.round(W * 0.07)}px;
    }
    .headline {
      color:${HEADLINE}; font-weight:800; text-align:center;
      font-size:${headFont}px; line-height:1.32; letter-spacing:-0.02em;
      white-space:pre-line; margin-bottom:${Math.round(H * 0.04)}px;
    }
    .device {
      flex:1; min-height:0;
      background:${FRAME}; padding:${bezel}px; border-radius:${frameRadius}px;
      box-shadow:0 ${Math.round(W*0.02)}px ${Math.round(W*0.06)}px rgba(0,0,0,0.22);
      display:flex;
    }
    .device img {
      height:100%; width:auto; display:block;
      border-radius:${screenRadius}px;
    }
  </style></head><body>
    <div class="headline">${headline}</div>
    <div class="device"><img src="${imgDataUrl}"/></div>
  </body></html>`;
}

const browser = await chromium.launch();
let made = 0;
const missing = [];

for (const [platform, { w: W, h: H }] of Object.entries(TARGETS)) {
  mkdirSync(resolve(OUT, platform), { recursive: true });
  for (const shot of SHOTS) {
    const rawPath = resolve(RAW, `${shot.name}.png`);
    if (!existsSync(rawPath)) { missing.push(`${shot.name} (${platform})`); continue; }
    const imgDataUrl = `data:image/png;base64,${readFileSync(rawPath).toString('base64')}`;
    // SS배 논리 캔버스로 렌더 → 물리픽셀도 SS배 → sharp로 정확히 W×H로 다운스케일(고품질 안티앨리어싱).
    const page = await browser.newPage({ viewport: { width: W * SS, height: H * SS } });
    await page.setContent(pageHtml({ imgDataUrl, headline: shot.headline, W: W * SS, H: H * SS }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(300); // 폰트 로드
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: W * SS, height: H * SS } });
    await page.close();
    const out = resolve(OUT, platform, `${shot.name}.png`);
    await sharp(buf).resize(W, H, { fit: 'fill' }).png().toFile(out);
    made++;
  }
}

await browser.close();
console.log(`✓ 합성 ${made}장 → scripts/store-screenshots/out/{ios,play}/`);
if (missing.length) {
  console.error('\n✗ 원판 없음 — 일부만 생성됨 (iOS 시뮬레이터에서 캡처 후 raw/에 넣으세요):');
  for (const m of missing) console.error('  ' + m);
  // 일부만 만들고 성공으로 오인하면 안 됨 (이중검수 지적). 의도적이면 --allow-missing.
  if (!process.argv.includes('--allow-missing')) process.exit(1);
}
