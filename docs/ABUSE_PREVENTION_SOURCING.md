# 에어컨 민주주의 — 남용 방지 정책 설계 (LLM 위임용)

다른 LLM(GPT-5 / Claude Opus / Gemini 2.5 등)에 통째로 던지세요. 자기완결형 프롬프트입니다.

---

## ROLE

당신은 **저트래픽 시민 참여 서비스의 보안·남용방지 정책을 설계하는 시니어 SRE + 보안 컨설턴트**입니다.
완전 무료 서비스이고, 익명 참여를 핵심 UX로 합니다.
운영자는 한 명, 인프라는 Cloudflare 무료 tier 위주.
당신의 목표: **사용자 마찰을 최소화하면서도 의견 조작·DoS·비용 폭탄·개인정보 사고를 막는 합리적 정책**을 단계별로 설계.

---

## SERVICE CONTEXT

### 무엇을 하는 서비스인가
"에어컨 민주주의" (https://aircondemocracy.com) — 한국 공공장소(지하철, 버스, 카페, 강의실 등)에서 **에어컨 분위기를 익명 투표**로 모으는 서비스.

- 3택: `추워요` / `적당해요` / `더워요`
- 한 (장소, 사용자) 조합당 1표
- 의견 변경 시 30초 쿨다운
- 1시간 후 자동 만료
- 익명 voter 쿠키 (HttpOnly + HMAC 서명 UUID) 만으로 1인 1표
- 로그인 선택 (현재 카카오 OAuth만, JWT 세션 쿠키)

### 핵심 가치
- **마찰 최소화** — 5초 안에 투표 가능해야 함. 사용 막는 게 아니라 신호 모으는 게 목적.
- **익명 보장** — 로그인 없이도 동작. 개인 식별 불가능해야 함.
- **공공성** — 영리 목적 아님, 광고 없음.

---

## CURRENT ARCHITECTURE

### 스택
- **Frontend**: Vite + React PWA. Cloudflare Pages 정적 호스팅. URL: aircondemocracy.com
- **API**: Cloudflare Pages Functions (Hono 프레임워크). `/api/*`
- **DB**: Cloudflare D1 (SQLite, APAC region). 무료 tier 5M reads/day, 100k writes/day
- **Edge**: Cloudflare CDN + WAF (무료 tier)
- **Auth**: 카카오 OAuth (백엔드는 JWT 세션 쿠키, hono/jwt HS256)
- **Cost**: 현재 월 $0 (도메인만 $10.46/yr)

### 노출된 엔드포인트
```
GET  /                        — 홈 (정적 PWA)
GET  /p/:id                   — 장소 페이지 (SSR meta inject)
GET  /search /register /login /wizard /qr — SPA 라우트

GET  /api/health
GET  /api/places              — 장소 목록 + 현재 vote counts (모든 places 반환)
GET  /api/places/:id          — 장소 상세 + 내 vote 상태
POST /api/places              — 새 장소 등록 (free-form)
POST /api/places/upsert       — 멱등 장소 생성 (지하철 lazy materialization)
POST /api/places/:id/vote     — 투표/변경

GET  /api/me                  — 현재 로그인 유저 정보
POST /api/auth/logout
GET  /api/auth/kakao          — OAuth 시작 (state CSRF 보호)
GET  /api/auth/kakao/callback — OAuth 콜백

GET  /sitemap.xml             — 동적 sitemap (places 전체 포함)
```

### 데이터 스키마
```sql
-- places (사용자 입력 가능)
CREATE TABLE places (
  id TEXT PRIMARY KEY,         -- 'subway:2호선:강남역:8', 'train:KTX:부산:3', 'bus:272:...', UUID 등
  name TEXT NOT NULL,          -- 자유 텍스트 (XSS 방어는 React가 함)
  type TEXT NOT NULL,          -- classroom/subway/train/cafe/bus/library/office/other
  district TEXT,
  detail TEXT,
  created_at INTEGER,
  created_by TEXT              -- voter_id (익명 쿠키 UUID)
);

-- votes (자동 만료)
CREATE TABLE votes (
  place_id TEXT,
  voter_id TEXT,              -- 익명 쿠키 UUID
  vote TEXT,                  -- 'cold' | 'ok' | 'hot'
  voted_at INTEGER,
  changed_at INTEGER,         -- 마지막 의견 변경 시각 (cooldown 기준)
  expires_at INTEGER,         -- voted_at + 1시간
  PRIMARY KEY (place_id, voter_id)
);

-- users (OAuth 로그인 시)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  provider TEXT,              -- 'kakao'
  provider_user_id TEXT,
  display_name TEXT,
  profile_image_url TEXT,
  email TEXT,
  created_at INTEGER,
  last_login_at INTEGER,
  UNIQUE(provider, provider_user_id)
);
```

### 현재 방어 수준 (거의 없음)
| 방어 | 현재 상태 |
|---|---|
| Rate limiting | ❌ 없음 |
| CAPTCHA | ❌ 없음 |
| IP 차단 | ❌ Cloudflare 기본 DDoS만 |
| Sybil 방지 | ❌ 쿠키 지우면 새 voter_id 발급 |
| 작성 검증 (place name) | ❌ 길이 제한만 |
| 감사 로그 | ❌ 없음 |
| OAuth scope | ✅ 최소 (닉네임 필수, 프사 선택, 이메일 선택) |
| Cookie 서명 | ✅ HMAC-SHA256 |
| OAuth state CSRF | ✅ |
| SQL injection | ✅ 모든 쿼리 parameterized |
| XSS | ✅ React 자동 escape |
| 비용 알림 | ❌ Cloudflare billing alert 미설정 |

---

## 위협 시나리오 (LLM이 추가 발굴 환영)

### 1. 의견 조작
- **Sybil**: 한 사람이 쿠키 지우거나 시크릿 모드로 같은 장소에 여러 표
- **봇 군집**: 스크립트로 100개 voter_id 생성 → 특정 장소에 일제히 "추워요"
- **IP 로테이션**: VPN/프록시로 IP 바꿔가며 투표
- **계정 군집**: 카카오 OAuth 계정 여러 개로 가짜 신뢰도 부여
- **시간 분산**: 한 사람이 일주일 동안 매시간 다른 voter_id로 투표

### 2. 스팸
- **장소 폭탄**: 한 사람이 100개 가짜 장소 (예: "테스트1", "테스트2") 등록
- **부적절 이름**: 욕설, 광고, 정치 슬로건, 개인정보(타인 이름) 가 들어간 장소 이름
- **유사 중복**: "스타벅스 강남" vs "스타벅스 강남점" vs "강남 스타벅스" — 같은 곳을 분산

### 3. DoS / 비용 공격
- **API flood**: 초당 수만 요청으로 D1 writes (100k/day) 한 시간에 소진
- **D1 reads burn**: GET /api/places 반복 호출로 5M reads/day 소진
- **Place 생성 flood**: POST /api/places 무한 호출로 DB 채우기
- **Cloudflare 비용**: Workers 무료 tier (100k req/일) 넘기면 Paid plan ($5/mo)으로 자동 안 넘어감 (Cloudflare 정책상). 하지만 R2/Images 등 추가 사용하게 되면 청구 가능
- **대역폭 공격**: PWA가 무거우면 모바일 데이터 burn 유도 가능 (현재 ~300KB 정도라 미미)

### 4. 개인정보 / 컴플라이언스
- **익명성 침해**: voter_id 쿠키는 익명이지만, 같은 voter가 어디서 투표했는지 서버는 다 알 수 있음 → 관리자가 악용 가능
- **Cloudflare IP 로그**: edge 로그에 IP 기록 (Cloudflare가 보관)
- **카카오 이메일 수집**: 선택동의지만 수집 후 보관함
- **개인정보처리방침 미게시**: 한국 PIPA(개인정보보호법) 위반 소지
- **삭제 요청권**: 사용자가 자기 데이터 삭제 요청 시 처리 절차 없음
- **데이터 유출**: D1이 노출되면 (voter_id, place_id, vote, IP 로그) 조합으로 특정 가능
- **신상 노출**: 장소 이름에 본인이나 타인의 실명·전화·주소 등 입력 가능

### 5. 기타
- **OAuth 토큰 탈취**: 세션 JWT 30일 유효, 서버측 무효화 불가 (stateless)
- **장소 ID 추측**: subway:2호선:강남역:8 같은 형식이라 외부에서 ID 추측 + GET 폭탄 가능
- **CSRF on POST /api/places**: SameSite=Lax 쿠키라 대부분 막히지만 명시적 검토 필요
- **CORS**: 현재 same-origin only인데 향후 네이티브 앱 추가 시 capacitor://localhost 허용 → 부주의하면 wildcard로 갈 위험

---

## 제약 조건

### 절대 조건
1. **익명 투표 유지** — 로그인 강제 안 됨. 첫 vote가 5초 안에 가능해야 함.
2. **무료 Cloudflare tier 안에서 해결** — Workers Paid는 OK, Enterprise WAF/Bot Management는 NO.
3. **개인정보 최소화** — 필요 이상 수집 금지. 익명성 침해성 fingerprint 사용은 신중.
4. **운영자 1인** — 24시간 모니터링 불가. 자동화된 대응 위주.

### 선호
- Cloudflare 네이티브 도구 (Rate Limiting Rules, Turnstile, WAF Custom Rules) 우선
- 한국 사용자 기준 (네이버/카카오/T1/SKT/KT/U+/공공 WiFi IP 다양함, IP 차단은 조심)
- 코드는 Hono / TypeScript / D1 호환

### 비선호
- 강제 로그인
- 기기 fingerprint (FingerprintJS 같은)
- 한국 신용카드/실명 인증
- 유료 보안 SaaS

---

## 요청 출력물

다음 7개 섹션을 마크다운으로 작성하세요. 각 섹션은 자기완결적이고 즉시 실행 가능해야 합니다.

### 1. Threat Model
- 공격자 타입 (예: 호기심 많은 개인, 조직적 어뷰저, 자동화 봇, 경쟁자, 국가 행위자)
- 각 타입의 동기·역량·자원
- STRIDE 또는 MITRE ATT&CK 매핑 (선택)

### 2. Mitigation Matrix
표 형식. 컬럼: `위협` | `방어` | `Cloudflare/D1/코드 어디서` | `UX 마찰 (0-3)` | `구현 난이도 (0-3)` | `우선순위 (P0/P1/P2)`
최소 15개 항목.

### 3. Detection Signals (조기 경보)
- 어떤 메트릭/패턴을 보면 어뷰징 의심?
- D1에 어떤 audit log 테이블이 필요?
- Cloudflare Analytics에서 어떤 지표를 알람으로 걸어야?
- 실시간 vs 배치

### 4. Specific Code/Config Changes (P0)
즉시 적용해야 할 변경. 코드 스니펫 포함. 예시:
- Cloudflare Rate Limiting Rule (대시보드 UI 단계 또는 API JSON)
- Hono 미들웨어 (rate limit, validation, audit log)
- D1 schema additions (audit_log, rate_limit_buckets, blocked_voters)
- Cloudflare Turnstile 위치 선정 (어디에만 걸어야 마찰 최소화)
- Workers Analytics Engine 활용

### 5. Cost Cap Strategy
- D1 quota 모니터링 방법
- Workers/Functions invocation budget alert 설정
- Cloudflare billing alert 임계값 추천
- 비용 폭탄 발생 시 자동 회로차단 (kill switch) 패턴
- R2/Images/AI 등 종량제 서비스 사전 차단 추천

### 6. Privacy & Compliance (PIPA 대응)
- 한국 개인정보보호법(PIPA) 적용 사항
- 익명 voter_id가 "개인정보"인지 (참고: 단독으로 특정 불가능하지만, IP+timestamp 결합 시 추정 가능)
- 데이터 보관 기간 정책
- 삭제 요청권 처리 절차
- Cloudflare Analytics에 들어가는 데이터의 익명화 옵션
- OAuth 카카오 수집정보 필요성 재검토
- 게시해야 할 정책 문서 목록 (개인정보처리방침, 이용약관, 분쟁해결)

### 7. Phased Rollout
- P0 (이번 주 안에): 비용 폭탄 + Sybil 기초 방어. 코드 변경 최소.
- P1 (이번 달 안에): Turnstile, 감사 로그, 자동 알람
- P2 (분기 단위): 행동 기반 신뢰도, 신고 기능, 평판 시스템
각 단계에 "절대 안 함" 항목도 명시 (예: 실명 인증, 기기 fingerprint는 안 함)

---

## 추가 컨텍스트 (선택 참고)

### Cloudflare 무료 tier 한도
- Pages: 무제한 대역폭, 무제한 요청
- Workers Free: 100k req/일, CPU 10ms/req
- Workers Paid ($5/mo): 10M req 포함, 50ms CPU
- D1 Free: 5M reads + 100k writes / 일, 5GB storage
- Turnstile Free: 무제한
- Rate Limiting Free plan: 10k req/10min 까지 룰 1개

### 한국 사용자 특수성
- 모바일 LTE/5G에서 IP가 자주 바뀜 (캐리어급 NAT) → IP 차단 위험
- 공공 WiFi 한 AP 뒤에 수십~수백명 → IP 기반 rate limit 조심
- 학교/회사 WiFi 한 IP 뒤에 수천명 가능
- VPN 사용률 낮음 (한국 사용자 기준 ~5%)
- 카카오톡 인앱 브라우저 사용 비율 높음 (쿠키/스토리지 정책 다름)

### 정상 사용 패턴 (악의 없는 경우)
- 한 사람이 하루에 평균 2~3개 장소에 투표 (출퇴근 지하철, 회사, 카페)
- 같은 장소 재방문 시 의견 갱신 (만료 후)
- 한 장소에 동시 투표자: 평균 1~5명, 피크 50~200명 (인기 카페/지하철)
- 새 장소 등록: 한 사람이 일주일에 0~3개 정도

이걸 정상 baseline으로 잡고 이탈치 정의를 권장.

---

## 출력 형식

마크다운 문서 한 개. 위 7개 섹션 모두 채우기.
- 코드 블록은 TypeScript / SQL / Bash 명시
- 표는 마크다운 표 사용
- 의견이 갈리는 결정은 "**권장: A** (이유)" 형식으로 명확히
- 모호한 부분은 "이건 운영자가 결정해야 함" 으로 표시
- 추측 금지. 잘 모르는 건 "조사 필요" 명시.

분량: 2000~4000단어. 실행 가능성 > 완전성.

---

## 한 줄 요약 미션

> "정상 사용자는 못 느끼지만, 어뷰저는 못 견디는 정책을 무료 tier로 설계하라."
