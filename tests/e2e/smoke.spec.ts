// 배포 후 라이브 스모크 — read-only. prod DB를 오염시키지 않는다 (upsert/vote/delete 금지).
// `npm run smoke`(BASE_URL=prod)로 배포 직후 실행. regressions.spec.ts(mutating)와 분리한 이유:
// 매 배포마다 도는 스모크가 prod에 데이터를 남기면 안 되기 때문 (Codex 이중검수 지적 2026-06-07).

import { test, expect } from '@playwright/test';

test.describe('smoke (read-only)', () => {
  test('홈 200 + 렌더', async ({ page }) => {
    const res = await page.goto('/');
    expect(res, '홈 응답 없음').toBeTruthy();
    expect(res!.status(), `홈 HTTP ${res!.status()}`).toBeLessThan(400);
    // 백지 배포(#310류 렌더 크래시) 감지 — body에 실제 콘텐츠가 있어야.
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('wizard 카테고리 노출', async ({ page }) => {
    const res = await page.goto('/wizard');
    expect(res!.status(), `/wizard HTTP ${res!.status()}`).toBeLessThan(400);
    // 핵심 진입점이 살아있는지 (이동/머무르는 곳 카테고리).
    await expect(page.getByText('지하철').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('강의실').first()).toBeVisible();
  });

  test('개인정보 처리방침 200 (스토어 심사 링크)', async ({ page }) => {
    const res = await page.goto('/privacy');
    expect(res!.status(), `/privacy HTTP ${res!.status()}`).toBeLessThan(400);
    await expect(page.getByText('개인정보 처리방침').first()).toBeVisible();
  });
});
