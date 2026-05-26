#!/usr/bin/env node
// Generate og-image.png from current icon.png + brand text.
// Run: node scripts/gen-og-image.mjs

import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICON = resolve(__dirname, '..', 'apps', 'web', 'public', 'icon.png');
const OUT = resolve(__dirname, '..', 'apps', 'web', 'public', 'og-image.png');

const iconDataUrl = `data:image/png;base64,${readFileSync(ICON).toString('base64')}`;

const HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px;
    background: linear-gradient(160deg, #ECE9E2 0%, #E4E0D8 100%);
    font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center; gap: 60px;
    padding: 0 80px;
  }
  .icon {
    width: 260px; height: 260px;
    background: white;
    border-radius: 56px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 24px 60px rgba(27, 83, 229, 0.18);
    flex-shrink: 0;
  }
  .icon img { width: 220px; height: 220px; }
  .text { display: flex; flex-direction: column; gap: 14px; }
  h1 {
    font-size: 72px; font-weight: 900; color: #1A1A1F; letter-spacing: -2px;
    line-height: 1.05;
  }
  .sub {
    font-size: 24px; font-weight: 600; color: #475569; letter-spacing: -0.3px;
    line-height: 1.5; margin-top: 8px;
  }
  .url {
    font-size: 22px; font-weight: 700; color: #1B53E5; letter-spacing: 0.5px;
    margin-top: 18px;
  }
</style></head>
<body>
  <div class="icon"><img src="${iconDataUrl}" /></div>
  <div class="text">
    <h1>에어컨도<br/>민주적으로 켜자</h1>
    <div class="sub">지하철·버스·카페·강의실 — 30초 익명 한 표.</div>
    <div class="url">aircondemocracy.com</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.screenshot({ path: OUT, type: 'png', omitBackground: false });
await browser.close();

console.log(`✅ Wrote ${OUT}`);
