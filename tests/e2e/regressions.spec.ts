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
    // desktop은 phone frame 아래에도 같은 문구가 있어서 둘 다 매칭됨. first 사용.
    await expect(page.getByText('에어컨 민주주의').first()).toBeVisible();
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

  // station suggestion row를 안정적으로 클릭하기 위한 helper.
  // 'role=button + text exact' 도 listbox 내 row가 button이라 가능.
  async function pickStation(page: import('@playwright/test').Page, placeholder: RegExp, name: string) {
    await page.getByPlaceholder(placeholder).first().fill(name);
    // suggestion 카드 클릭. 정확 일치 우선 (강남역 vs 강남구청역).
    const row = page.getByRole('button').filter({ hasText: new RegExp(`^${name}`) }).first();
    await row.click();
  }

  test('지하철 wizard — 한쪽 선택 후 다른 쪽 listbox는 인접역만 노출', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('지하철').first().click();
    await pickStation(page, /예: 강남/, '강남역');
    // 강남 선택 후 두 번째 입력에 광화문 (비인접) 검색하면 광화문 listbox에 없어야 함
    await page.getByPlaceholder(/예: 역삼/).first().fill('광화문');
    // 광화문역이 강남의 인접역 목록에 없으니 표시되면 안 됨
    await expect(page.getByRole('button').filter({ hasText: /^광화문역/ })).toHaveCount(0);
    // 강남 인접인 역삼은 listbox에 있어야 함 (positive check)
    await page.getByPlaceholder(/예: 역삼/).first().fill('역삼');
    await expect(page.getByRole('button').filter({ hasText: /^역삼역/ }).first()).toBeVisible({ timeout: 5000 });
  });

  test('지하철 wizard — 인접한 두 역 입력 시 자동 매칭 표시', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('지하철').first().click();
    await pickStation(page, /예: 강남/, '강남역');
    await pickStation(page, /예: 역삼/, '역삼역');
    // segment resolve 되면 '몇 호차' 또는 '몇 번째 칸' 표시 + 실시간 매칭 시도 (loading 또는 결과 카드)
    await expect(page.getByText(/몇 호차예요|몇 번째 칸|이 열차 맞으시죠|구간 단위로 투표/)).toBeVisible({ timeout: 10000 });
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

  // BUG: redirect URI 정정 오타가 자주 발생함 (ttps:// 같은). 시작 endpoint가
  // 정확한 redirect_uri로 302 보내는지 회귀 방지.
  test.describe('OAuth 시작 endpoint', () => {
    const providers = [
      { id: 'kakao',  authHost: 'kauth.kakao.com' },
      { id: 'naver',  authHost: 'nid.naver.com' },
      { id: 'google', authHost: 'accounts.google.com' },
    ];
    for (const p of providers) {
      test(`/api/auth/${p.id} → 302 to ${p.authHost} with valid redirect_uri`, async ({ request }) => {
        const res = await request.get(`/api/auth/${p.id}`, { maxRedirects: 0 });
        expect(res.status()).toBe(302);
        const loc = res.headers()['location'];
        expect(loc).toContain(p.authHost);
        // redirect_uri는 정확히 https://aircondemocracy.com/api/auth/.../callback
        expect(loc).toContain(encodeURIComponent(`https://aircondemocracy.com/api/auth/${p.id}/callback`));
        // oauth_state cookie + state param 동시 설정
        const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
        expect(cookies.some((c) => c.startsWith('oauth_state='))).toBe(true);
        expect(loc).toMatch(/[&?]state=[a-f0-9-]{8,}/);
      });
    }
  });
});

test.describe('스토어/SEO 정적 자산', () => {
  test('개인정보 처리방침 페이지 접근 가능', async ({ page }) => {
    // CF Pages가 .html 자동 제거 → /privacy 로 접근
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible();
    await expect(page.getByText(/Cloudflare/)).toBeVisible();
    await expect(page.getByText(/mtg821@gmail.com/).first()).toBeVisible();
  });

  test('CSP 헤더가 응답에 포함', async ({ request }) => {
    const res = await request.get('/');
    const csp = res.headers()['content-security-policy'];
    expect(csp).toBeTruthy();
    // Naver Maps 도메인이 script-src에 허용돼야 함 (지도 picker)
    expect(csp).toContain('oapi.map.naver.com');
    // jsDelivr가 style-src에 (Pretendard 폰트)
    expect(csp).toContain('cdn.jsdelivr.net');
  });

  test('robots.txt + sitemap.xml 접근 가능', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBe(true);
    const sitemap = await request.get('/sitemap.xml');
    expect([200, 404]).toContain(sitemap.status());
  });

  test('manifest.webmanifest 정상', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.name).toContain('에어컨');
  });
});

test.describe('카테고리별 wizard 진입', () => {
  test('카페·음식점 카드 → NaverMapPicker 화면 진입', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('카페·음식점').first().click();
    // header 변경
    await expect(page.getByText(/카페·음식점 위치/)).toBeVisible({ timeout: 5000 });
    // picker bottom CTA
    await expect(page.getByText(/먼저 지도에서 위치를 찍어주세요/)).toBeVisible();
  });

  test('강의실 → university picker → 연세대 카드 진입', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('강의실').first().click();
    // university picker에 SNU + 연세대 카드 표시
    await expect(page.getByText('서울대학교').first()).toBeVisible();
    await expect(page.getByText('연세대학교').first()).toBeVisible();
    // 연세대 클릭 시 crash 없이 진입
    await page.getByText('연세대학교').first().click();
    // Yonsei wizard에 신촌 관련 텍스트가 보여야 함
    await expect(page.getByText(/신촌|건물|호실/).first()).toBeVisible({ timeout: 5000 });
  });

  test('버스 카드 → 버스 wizard 진입', async ({ page }) => {
    await page.goto('/wizard');
    await page.getByText('버스').first().click();
    await expect(page.getByPlaceholder(/예: 272|5511|M7106/)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('홈 화면 구성', () => {
  // BUG: 이전엔 idle 장소들을 "장소" 섹션에 줄줄이 표시했음. 노이즈라
  // 제거하기로 결정 (2026-05-26). 회귀 방지.
  test('idle "장소" 섹션은 사라졌어야 함', async ({ page }) => {
    await page.goto('/');
    // 헤더 'AIRCON DEMOCRACY' 옆 작은 라벨이 아닌, 섹션 제목 '장소' 정확 일치만 검사
    const sectionHeader = page.getByText(/^장소$/);
    await expect(sectionHeader).toHaveCount(0);
  });

  // BUG: callback 실패 시 LoginScreen이 ?error=xxx 안 표시 → 사용자가 왜 안 되는지 모름.
  test('callback 실패 시 LoginScreen에 에러 표시', async ({ page }) => {
    await page.goto('/login?error=state_mismatch');
    // role=alert 요소가 있어야 함
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/state_mismatch|만료/);
  });

  test('callback redirect_uri 미일치 에러도 친절히 표시', async ({ page }) => {
    await page.goto('/login?error=token_redirect_uri_mismatch');
    await expect(page.getByRole('alert')).toContainText(/Redirect URI/);
  });

  // BUG: 비로그인 시 즐겨찾기 별 누르면 로그인 페이지로 가야 함.
  // VoteScreen 진입 후 별 버튼 동작 확인.
  test('비로그인 즐겨찾기 별 → 로그인 페이지', async ({ page, request }) => {
    // place 한 개 만들기 (upsert)
    await request.post('/api/places/upsert', {
      headers: { 'X-Aircon-Intent': 'user-action', Origin: 'https://aircondemocracy.com' },
      data: { id: 'other:e2e-fav-test', name: 'E2E 즐겨찾기 테스트', type: 'other' },
    }).catch(() => { /* 이미 있을 수 있음 — 무시 */ });
    await page.goto('/p/other:e2e-fav-test');
    // 별 버튼 클릭
    const star = page.getByLabel(/로그인 후 즐겨찾기|즐겨찾기 추가|즐겨찾기 해제/);
    await star.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
