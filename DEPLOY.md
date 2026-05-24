# 배포 가이드 — 에어컨 민주주의

전부 Cloudflare 위에서 돌아갑니다. AWS 안 씁니다.

## 스택

- **호스팅**: Cloudflare Pages (정적 PWA, 무제한 대역폭, 무료)
- **DNS / 레지스트라**: Cloudflare
- **CDN / SSL**: Cloudflare (자동)
- **CI/CD**: GitHub push → Cloudflare Pages 자동 빌드 + 배포
- **백엔드 (추후)**: Cloudflare Workers + D1 + Turnstile

## 한 번만 하면 되는 셋업 (3단계)

### 1. Cloudflare 계정 + 도메인

1. https://dash.cloudflare.com/sign-up — 계정 생성 (이메일 + 비번)
2. 좌측 메뉴 → **Domain Registration → Register Domains**
3. `aircondemocracy.com` 검색 → 구매 ($10.44/yr, 신용카드)
4. 자동으로 Cloudflare DNS에 연결됨 (Nameserver 변경 불필요)

### 2. GitHub 레포 연결

```bash
# 제가 셋업해드릴게요. 님이 따로 안 해도 됨.
# (gh CLI 로그인이 안 되어 있으면 한 번만: gh auth login)
```

### 3. Cloudflare Pages 프로젝트 생성

1. Cloudflare 대시보드 → **Workers & Pages → Create application → Pages → Connect to Git**
2. GitHub 인증 → `aircon-democracy` 레포 선택
3. 빌드 설정:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (그대로)
   - **Environment variables**: 없음 (지금은)
4. **Save and Deploy** 클릭 → 1~2분 후 `<project>.pages.dev` 임시 URL로 배포 완료
5. 같은 화면에서 **Custom domains → Set up a custom domain** → `aircondemocracy.com` 입력
6. `www.aircondemocracy.com`도 추가 (선택)

끝. 이후 `git push origin main` 할 때마다 자동 배포됩니다. PR 만들면 preview URL도 자동 생성.

## 보안 설정 (이미 코드에 다 들어있음)

- `public/_headers` — HSTS, CSP, X-Frame-Options, Permissions-Policy 등
- `public/_redirects` — SPA 라우팅 fallback
- HTTPS 강제 — Cloudflare가 자동
- DDoS 방어 — Cloudflare 기본 제공

## 로컬 개발

```bash
npm install         # 처음 한 번만
npm run dev         # http://localhost:5173
npm run build       # 프로덕션 빌드 → dist/
npm run preview     # 빌드 결과 로컬 확인
```

## 다음 단계 (백엔드)

지금은 mock 데이터로 동작. 실 투표 데이터를 저장하려면:

1. **Cloudflare Workers** — `/api/vote`, `/api/places/:id` 엔드포인트
2. **Cloudflare D1** — SQLite (votes, places 테이블)
3. **Cloudflare Turnstile** — 봇 투표 방지 (무료)
4. **카카오/네이버 OAuth** — 각 개발자 콘솔에서 앱 등록 후 클라이언트 ID 발급 필요 (이건 님이 해주셔야 함)

요청하시면 진행합니다.
