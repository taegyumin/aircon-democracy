import { defineConfig, devices } from '@playwright/test';

// E2E tests target either local dev (npm run dev) or prod by setting
// BASE_URL=https://aircondemocracy.com. Local default keeps CI fast.
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },
  // Mobile-first: our PWA primary surface is the iOS-frame mobile view.
  // Desktop viewport flips to full-page mode; we cover both.
  // We only install Chromium to keep CI light. iPhone profile uses webkit;
  // we use Pixel 7 (chromium) as our mobile surrogate. Real iOS QA is manual.
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
      },
});
