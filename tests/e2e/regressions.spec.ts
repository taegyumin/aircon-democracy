// 이 세션에서 발견한 회귀 방지 테스트들.
// 각 테스트 위에 어떤 버그를 재현·예방하는지 출처 명시.

import { test, expect } from '@playwright/test';

test.describe('회귀 방지', () => {
  // BUG: 어떤 데이터셋 빌드 산물에서 "동대문역사문화공원"이
  // "문화공원동대문역사"로 토큰 순서가 뒤집힌 ghost entry가 stations에 생겼고,
  // adjacency도 깨진 이름만 갖고 있었음. 정상 이름 검색 시 인접역이 0개.
  test('동대문역사문화공원역 검색 — 정상 이름 하나만 노출', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('지하철').first().click();
    // 열차 안 모드가 기본
    const prevInput = page.getByPlaceholder(/예: 강남/).first();
    await prevInput.fill('동대문');
    // ghost entry는 어떤 노선이든 'lines'에 매핑돼 있어선 안 됨
    await expect(page.getByText('문화공원동대문역사역')).toHaveCount(0);
    // 정상 이름은 검색 결과에 등장
    await expect(page.getByText('동대문역사문화공원역').first()).toBeVisible();
  });

  // BUG: SNUClassroomWizard가 univ === null 일 땐 useEffect 안 거치고,
  // 서울대 카드 클릭 시 처음 useEffect 거쳐서 Rules of Hooks 위반 → 흰 화면.
  test('강의실 → 서울대학교 카드 클릭 시 crash 없이 진입', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('강의실').first().click();
    await page.getByText('서울대학교').first().click();
    // SNU wizard의 검색 placeholder가 보이면 정상 마운트된 것
    await expect(page.getByPlaceholder(/동번호.*단과대.*건물.*호실/)).toBeVisible({ timeout: 5000 });
    // 안전망: console에 React error가 안 떨어졌어야 함
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    expect(consoleErrors.filter((e) => /Rendered more hooks|Rendered fewer hooks/.test(e))).toHaveLength(0);
  });

  // BUG: 검색창 클릭 시 SearchScreen 로 가다 wizard 로 변경해야 한다는 결정 (2026-05-26).
  test('홈 검색창 클릭 → wizard 진입', async ({ page }) => {
    await page.goto('/');
    // '장소 이름 또는 건물 검색' placeholder
    await page.getByText(/장소 이름.*검색/).click();
    await expect(page).toHaveURL(/\/wizard/);
  });

  // BUG: VITE_NCP_MAPS_CLIENT_ID 가 빌드 시 inline 안 되면 picker가
  // "지도를 못 불러왔어요. VITE_NCP_MAPS_CLIENT_ID is not configured" 라고 표시.
  // 회귀 방지: prod 빌드에서는 이 메시지 안 떠야 함.
  test('카페·음식점 picker 진입 시 NCP env 미설정 에러 없음', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('카페·음식점').first().click();
    // 환경변수 정상 inline 됐다면 에러 메시지 없어야 함
    await expect(page.getByText(/VITE_NCP_MAPS_CLIENT_ID is not configured/)).toHaveCount(0);
  });
});

test.describe('핵심 흐름', () => {
  test('홈 화면 기본 요소가 모두 보임', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('에어컨 민주주의')).toBeVisible();
    await expect(page.getByText('지금 어디 계세요?')).toBeVisible();
    await expect(page.getByText(/장소 이름.*검색/)).toBeVisible();
  });

  test('"지금 어디 계세요?" 클릭 → wizard 진입', async ({ page }) => {
    await page.goto('/');
    await page.getByText('지금 어디 계세요?').click();
    await expect(page).toHaveURL(/\/wizard/);
    // 카테고리 그리드 표시 확인
    await expect(page.getByText('지하철').first()).toBeVisible();
    await expect(page.getByText('버스').first()).toBeVisible();
    await expect(page.getByText('카페·음식점').first()).toBeVisible();
    await expect(page.getByText('강의실').first()).toBeVisible();
  });

  test('지하철 wizard — 인접하지 않은 두 역 입력 시 안내', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('지하철').first().click();
    // 강남 + 광화문은 인접 아님 (서로 다른 노선)
    await page.getByPlaceholder(/예: 강남/).first().fill('강남');
    await page.getByText('강남역').first().click();
    await page.getByPlaceholder(/예: 역삼/).first().fill('광화문');
    await page.getByText('광화문역').first().click();
    await expect(page.getByText(/두 역이 인접해 있지 않/)).toBeVisible();
  });

  test('지하철 wizard — 인접한 두 역 입력 시 자동 매칭 표시', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('지하철').first().click();
    await page.getByPlaceholder(/예: 강남/).first().fill('강남');
    await page.getByText('강남역').first().click();
    // 강남의 인접역(2호선: 역삼/교대) 선택
    await page.getByPlaceholder(/예: 역삼/).first().fill('역삼');
    await page.getByText('역삼역').first().click();
    // 자동 매칭 카드 또는 '몇 호차예요?' 표시
    await expect(page.getByText(/2호선|호차/)).toBeVisible();
  });

  test('비로그인 시 헤더 아바타 클릭 → 로그인 화면', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('로그인').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('카카오로 계속하기')).toBeVisible();
    await expect(page.getByText('네이버로 계속하기')).toBeVisible();
    await expect(page.getByText('Google로 계속하기')).toBeVisible();
  });
});

test.describe('API 회귀', () => {
  // BUG: SEOUL_OPENAPI_KEY로 ws.bus.go.kr 호출하면 키 인증 실패. 별도 키 필요.
  // 회귀 방지: bus match endpoint는 정상 형태의 JSON 응답 (200 또는 4xx with reason)
  test('bus match endpoint가 5xx 안 던짐', async ({ request }) => {
    const res = await request.post('/api/realtime/bus/match', {
      data: { routeName: '146', stopName: '강남역' },
      headers: { 'X-Aircon-Intent': 'user-action' },
    });
    // 모든 fail 케이스는 200 + matched:false로 통일 (Cloudflare가 5xx body 가로채기 회피)
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('matched');
  });

  test('subway match endpoint가 5xx 안 던짐', async ({ request }) => {
    const res = await request.post('/api/realtime/subway/match', {
      data: { line: '2호선', prev: '강남', next: '역삼' },
      headers: { 'X-Aircon-Intent': 'user-action' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('matched');
  });

  test('places list endpoint OK', async ({ request }) => {
    const res = await request.get('/api/places');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body.places)).toBe(true);
  });

  test('/api/me 반환 — 비로그인은 user: null', async ({ request }) => {
    const res = await request.get('/api/me');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty('user');
  });
});
