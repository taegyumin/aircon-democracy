# 에어컨 민주주의 남용 방지 정책

기준일: 2026-05-25 KST. Cloudflare 한도와 개인정보 법령은 변동 가능하므로, 아래 수치는 공식 문서 확인 기준이다. Cloudflare Workers Free는 일 100,000 요청, D1 Free는 일 5M rows read / 100k rows written, Turnstile Free는 무제한 검증을 제공한다는 문서 기준으로 설계한다. 법률 해석은 실무 설계 참고이며 최종 법률 자문은 조사 필요.

---

## 1. Threat Model

서비스의 핵심 자산은 "장소별 현재 체감 온도 신호의 무결성", "무료 tier 지속 가능성", "익명성에 대한 신뢰", "장소 데이터 품질"이다. 비밀번호나 결제정보는 없지만, 투표 기록과 시간, 장소, 쿠키 식별자 조합은 충분히 민감하다.

| 공격자 타입 | 동기 | 역량/자원 | 현실적 위험 |
|---|---|---|---|
| 호기심 많은 개인 | 자기 의견을 크게 보이게 하기 | 쿠키 삭제, 시크릿 모드, 간단한 반복 클릭 | 특정 장소 단기 왜곡 |
| 스크립트 사용자 | 장난, 실험, 커뮤니티 밈 | fetch/curl, 임의 쿠키 생성, User-Agent 변경 | vote/place write quota 소진 |
| 조직적 어뷰저 | 특정 장소/노선 여론 조작 | 여러 기기, VPN, 프록시, 시간 분산 | 인기 장소 결과 왜곡 |
| 스팸 발행자 | 광고/욕설/정치 문구 노출 | 장소 생성 자동화, 유사 이름 생성 | 검색/지도/SEO 품질 저하 |
| 비용 공격자 | 무료 서비스 중단 유도 | GET/POST flood, D1 row scan 유도 | D1/Workers quota 소진 |
| 계정 군집 | 신뢰도 우회 | 다수 카카오 계정, 자동 로그인 | "로그인 유저 가중치" 도입 시 위험 |
| 내부자/운영 실수 | 편의상 로그 확인, 과수집 | D1 접근, Cloudflare Analytics 접근 | 익명성 훼손, PIPA 리스크 |
| 고도 공격자/국가 행위자 | 특정 개인 추적 | 네트워크/플랫폼 로그 접근 가능성 | 현재 서비스 범위 밖. 과도한 방어는 비권장 |

STRIDE로 보면 Spoofing은 쿠키 재발급과 OAuth 계정 군집, Tampering은 투표/장소 조작, Repudiation은 감사 로그 부재, Information Disclosure는 voter_id와 장소 기록 결합, DoS는 D1/Workers quota burn, Elevation of Privilege는 관리자 계정·Cloudflare 계정 탈취가 핵심이다.

**권장: "완전 차단"보다 "속도 제한 + 신뢰도 낮은 신호의 감산 + 비용 회로차단"을 기본 전략으로 둔다.** 익명 서비스에서 Sybil을 완전히 막으려 하면 결국 로그인·실명·fingerprint로 가게 되고, 이는 서비스 가치와 충돌한다.

---

## 2. Mitigation Matrix

| 위협 | 방어 | Cloudflare/D1/코드 어디서 | UX 마찰 (0-3) | 구현 난이도 (0-3) | 우선순위 |
|---|---|---:|---:|---:|---|
| API write flood | POST `/api/*` WAF Rate Limiting | Cloudflare WAF | 0 | 1 | P0 |
| D1 read burn | `/api/places` 15-30초 public cache, pagination | 코드 + Cloudflare Cache | 0 | 1 | P0 |
| 쿠키 삭제 Sybil | voter_id별 일/분 단위 quota | D1 rate_limit_buckets | 0 | 2 | P0 |
| 시크릿 모드 Sybil | raw IP 대신 일 단위 IP prefix HMAC quota | 코드 + D1 | 0 | 2 | P0 |
| 장소별 봇 군집 | place+ipPrefix+hour 신규 voter cap, 초과 시 shadow-deweight | 코드 + D1 | 0 | 3 | P1 |
| 장소 폭탄 | free-form 장소 생성에 Turnstile | Turnstile + 코드 | 1 | 2 | P1 |
| 지하철 lazy upsert 남용 | allowlist 기반 id/type 검증 | 코드 | 0 | 1 | P0 |
| 부적절 장소명 | 길이, URL/전화번호/욕설/반복문자 검증 | 코드 | 0-1 | 2 | P0 |
| 유사 중복 | normalized_name_key unique/검색 병합 | D1 + 코드 | 0 | 2 | P1 |
| CSRF | Origin/Referer 검증 + custom header 요구 | 코드 | 0 | 1 | P0 |
| CORS 오설정 | same-origin 기본, 앱 추가 시 정확한 allowlist | 코드/config | 0 | 1 | P0 |
| OAuth 세션 탈취 | JWT 만료 7-14일, token_version revocation | 코드 + D1 | 0 | 2 | P1 |
| 관리자/내부자 프라이버시 | raw IP 미저장, HMAC hash, 짧은 retention | 코드 + 운영정책 | 0 | 2 | P0 |
| D1 quota 소진 | readonly/closed kill switch | 코드 + D1 config | 0-2 | 2 | P0 |
| Workers quota 소진 | Cloudflare usage/budget alerts | Cloudflare Notifications | 0 | 1 | P0 |
| sitemap spam | verified/active places만 포함, 캐시 | 코드 | 0 | 1 | P1 |
| GET endpoint scraping | ETag, cache, response size 제한 | 코드 | 0 | 1 | P0 |
| 악성 UA/curl flood | 너무 이른 차단 대신 edge rate + audit | WAF + audit | 0 | 1 | P0 |
| 개인정보 입력 장소명 | 신고/삭제, 자동 탐지 | 코드 + 운영 | 0 | 2 | P1 |
| 계정 군집 | 로그인 가중치 미도입 또는 약한 보조 신호만 사용 | 정책 | 0 | 0 | P0 |

---

## 3. Detection Signals

조기 경보는 "정상 사용자는 하루 2-3개 장소 투표, 새 장소 주 0-3개"라는 baseline에서 벗어나는지를 본다.

**실시간으로 봐야 할 신호**

| 신호 | 의심 기준 |
|---|---|
| POST `/vote` 급증 | 5분 이동평균이 평소의 5배 이상 |
| `new voter_id issued` 급증 | 쿠키 없는 요청 비율 30% 이상 또는 10분 300건 이상 |
| 같은 place에 신규 voter 집중 | 한 장소에 10분 내 신규 voter 50명 이상, 특히 vote 한쪽 90% 이상 |
| same ipPrefixHash 다중 voter | 10분 내 30개 이상 voter_id 생성 |
| place 생성 급증 | 1시간 20개 이상 또는 한 voter 1일 5개 이상 |
| 장소명 reject 비율 | 10분 reject 20건 이상 |
| D1 write burn rate | 1시간 예상치가 일 100k 초과 속도 |
| D1 read burn rate | 1시간 예상치가 일 5M row read 초과 속도 |
| 429/403 비율 | 전체 API의 5% 이상 |
| D1 limit/Workers 1027/1102 | 즉시 장애 신호 |
| Turnstile fail ratio | place 생성 시 실패율 30% 이상 |
| vote entropy 저하 | 한 장소 vote가 갑자기 단일 선택지 95% 이상 |

**D1 audit log 테이블**

raw IP를 저장하지 않는다. IP는 IPv4 `/24`, IPv6 `/64` prefix로 줄인 뒤 `HMAC(secret, YYYY-MM-DD + prefix)`만 저장한다. voter_id도 raw UUID 대신 HMAC hash를 남긴다. 스키마는 [migrations/0002_abuse_prevention.sql](../migrations/0002_abuse_prevention.sql) 참고.

**실시간 vs 배치**

실시간은 rate limit, kill switch, 입력 검증, blocked_subjects 확인만 한다. 배치는 1시간마다 만료 vote 삭제, 오래된 rate bucket/audit 삭제, 이상 장소 리포트 생성, normalized duplicate 후보 추출을 수행한다. 운영자 1인 구조에서는 "실시간 차단은 보수적으로, 배치 탐지는 자세히"가 맞다.

Cloudflare Analytics에서는 요청 수, path별 4xx/5xx, WAF/rate limiting events, Workers invocation errors, CPU exceeded, D1 read/write 사용량을 본다. Workers Free는 일 요청 초과 시 1027, D1 Free는 한도 초과 시 D1 쿼리 오류가 발생할 수 있으므로 장애 신호로 취급한다.

---

## 4. Specific Code/Config Changes (P0)

### 4.1 Cloudflare Rate Limiting Rule

Free plan은 rate limiting rule 수와 counting period가 제한된다. 공식 문서 기준 Free는 rule 1개, 10초 counting period가 핵심 제약이다. 따라서 GET이 아니라 **write endpoint 보호**에 쓴다.

Dashboard:

1. Cloudflare Dashboard → `Security` → `WAF` → `Rate limiting rules`
2. Create rule: `AD write flood guard`
3. Expression:

```text
(http.host eq "aircondemocracy.com"
 and http.request.method eq "POST"
 and http.request.uri.path starts_with "/api/")
```

4. Characteristics: IP
5. Threshold: `60 requests / 10 seconds`
6. Action: `Block` 또는 `Managed Challenge`
7. Mitigation timeout: `10-60 seconds`

**권장: Block 10초.** XHR API에서 Managed Challenge는 프론트가 처리하기 어렵다. 60 POST/10초는 공공 Wi-Fi 집단 투표에는 약간 여유가 있고, 자동화 flood에는 바로 걸린다. 학교 강의실에서 100명이 동시에 투표하는 UX가 중요하면 100/10초로 올리고 코드 quota를 낮춘다. 이건 운영자가 결정해야 함.

### 4.2 Cache GET `/api/places`

`GET /api/places`가 모든 places와 counts를 반환하면 row read burn의 중심이 된다. P0에서는 `Cache-Control: public, max-age=15, s-maxage=30, stale-while-revalidate=120` 응답 헤더와 LIMIT 100을 적용한다. 키셋 페이지네이션은 popularity 정렬과 충돌하므로 P1에서 별도 정렬 모드를 만들면서 다룬다.

`내 vote 상태`는 캐시 불가능하므로 `/api/places/:id`에서만 반환한다.

### 4.3 Origin/CSRF Guard

```ts
const ALLOWED_ORIGINS = new Set([
  'https://aircondemocracy.com',
  'https://www.aircondemocracy.com'
]);

function csrfGuard() {
  return async (c, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) return next();
    const origin = c.req.header('Origin');
    const intent = c.req.header('X-Aircon-Intent');
    if (!origin || !ALLOWED_ORIGINS.has(origin) || intent !== 'user-action') {
      return c.json({ error: 'forbidden' }, 403);
    }
    return next();
  };
}
```

OAuth 콜백(`/api/auth/kakao/callback`)은 브라우저 top-level redirect이므로 Origin 헤더가 없을 수 있다 → guard 면제 경로로 둔다. 또한 native 앱(Capacitor)에서는 Origin이 `capacitor://localhost` 또는 `https://localhost` 같이 다르게 들어오므로 allowlist에 추가한다.

프론트 fetch는 다음처럼 보낸다.

```ts
await fetch(`/api/places/${placeId}/vote`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Aircon-Intent': 'user-action'
  },
  body: JSON.stringify({ vote })
});
```

### 4.4 Privacy-Preserving Rate Limit

`ABUSE_SECRET` 환경변수를 별도로 두고, voter_id·IP prefix·UA를 모두 `HMAC-SHA256(ABUSE_SECRET, …)`로 해시한 키로만 rate bucket을 누적한다. raw IP/voter_id는 어디에도 저장하지 않는다. 일 단위 IP prefix 해시이므로 같은 IP라도 어제와 오늘 버킷이 달라져 장기 추적은 어렵다.

기본 limit (`functions/api/[[route]].ts`):

- `vote:voter:<voterHash>` — 10 / 60s
- `vote:ip:<ipPrefixHash>` — 120 / 60s
- `vote:place_ip:<placeId>:<ipPrefixHash>` — 80 / 3600s
- `place:voter:<voterHash>` — 5 / 86400s (하루 5개 장소)
- `place:ip:<ipPrefixHash>` — 30 / 86400s
- `upsert:voter:<voterHash>` — 60 / 60s (지하철 lazy upsert는 사용자 한 명이 짧은 시간에 여러 역을 옮기는 패턴이 정상)

### 4.5 Place Validation

```ts
const VALID_TYPES = new Set([
  'classroom', 'subway', 'train', 'cafe', 'bus', 'library', 'office', 'other'
]);

const BAD_NAME = /(https?:\/\/|www\.|010-?\d{4}-?\d{4}|\d{2,3}-\d{3,4}-\d{4}|카톡|오픈채팅|텔레그램|무료상담)/i;

function normalizePlaceName(name: string) {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

이름 길이 2–40, detail 최대 80, 연속 동일 문자 7회 이상 거절. D1에는 `places.normalized_name`을 함께 저장해서 P1에서 유사중복 병합에 사용한다.

### 4.6 Kill Switch

`app_config(key, value)`에 `votes_closed`, `place_creation_closed` 두 키를 둔다. `'true'`이거나 epoch ms 값이 현재시각보다 크면 닫혀 있다. 운영자는 D1 콘솔에서 다음 SQL로 즉시 토글할 수 있다.

```sql
INSERT INTO app_config(key, value, updated_at)
VALUES ('votes_closed', 'true', strftime('%s','now') * 1000)
ON CONFLICT(key) DO UPDATE SET value='true', updated_at=strftime('%s','now') * 1000;
```

해제는 같은 쿼리에 `'false'` 또는 행 삭제. 시간 제한이 필요하면 `'1716700000000'`처럼 epoch ms를 넣으면 그 시각까지 닫힌다.

### 4.7 Turnstile 위치

P0에서는 코드 hook만 넣고, P1에서 기본 활성화한다.

**권장: 첫 익명 투표에는 Turnstile을 걸지 않는다.** 대신 free-form 장소 등록, rate limit에 걸린 voter의 재시도, 의심스러운 place 생성에만 사용한다.

---

## 5. Cost Cap Strategy

Cloudflare Free는 "과금 폭탄"보다 "quota 초과로 장애"가 먼저 올 가능성이 크다. 단, Workers Paid, R2, Images, Workers AI, Logpush 등을 켜면 usage-based 과금 영역이 생긴다.

**D1 quota 모니터링**

- D1 Dashboard에서 rows read/written 일일 추이를 매일 확인한다.
- `/api/places`는 반드시 cache/pagination한다.
- D1 row scan을 줄이기 위해 `votes(place_id, expires_at)`, `votes(expires_at)` index를 둔다.
- `SELECT * FROM places` 전량 반환은 중단하고 limit/cursor를 사용한다.
- 만료 votes는 cron 또는 요청 opportunistic cleanup으로 삭제한다.

```sql
DELETE FROM votes WHERE expires_at < strftime('%s','now') * 1000 - 3600000;
DELETE FROM rate_limit_buckets WHERE expires_at < strftime('%s','now');
DELETE FROM audit_events WHERE ts < strftime('%s','now') * 1000 - 30 * 86400000;
```

**Workers/Functions invocation budget**

Pages Functions 요청은 Workers 요청으로 과금/할당량에 반영된다. Free에서는 100k/day 초과 시 1027 오류가 날 수 있으므로 Cloudflare Dashboard의 Workers & Pages metrics를 알람 대상으로 둔다.

**Cloudflare billing alert**

- Free 유지 시: 결제수단 연결과 paid 제품 활성화를 최소화한다.
- Paid 전환 시: Budget Alert `$1`, `$3`, `$5`, `$10` 네 단계 설정.
- Workers Usage Notifications와 Budget Alerts를 켠다.
- Budget alert는 "알림"이지 hard cap이 아니다. 자동 차단은 앱 kill switch로 구현해야 한다.

**자동 회로차단 패턴**

1. 5분 단위 요청/오류율이 threshold 초과
2. `place_creation_closed=true`
3. 계속 증가하면 `votes_closed=true`
4. GET은 캐시된 stale response만 제공
5. 운영자에게 이메일/메신저 알림
6. 1시간 뒤 자동 해제 또는 수동 해제

무료 tier만으로 완전 자동 알림을 하려면 Cron Worker + Cloudflare GraphQL API 사용이 필요하다. API token 권한 설계와 GraphQL 쿼리는 조사 필요. P0에서는 Dashboard 알림과 수동 kill switch로 충분하다.

**종량제 서비스 사전 차단**

**권장: R2, Images, Stream, Workers AI, Vectorize, Queues, Logpush는 지금 사용하지 않는다.** wrangler/config에 binding을 추가하지 않고, Cloudflare 계정 메모에 "paid metered products require explicit review"를 남긴다. 이미지 업로드 기능이 필요해지면 별도 비용 설계 후 도입한다.

---

## 6. Privacy & Compliance (PIPA 대응)

PIPA 관점에서 이 서비스는 작아도 개인정보처리자가 될 가능성이 있다. 익명 voter_id UUID는 단독으로 실명을 말하지 않지만, 서버가 같은 voter의 장소·시간 투표 이력을 연결할 수 있고 Cloudflare/IP/timestamp와 결합하면 개인 추정 가능성이 있다. **권장: voter_id, 로그인 user_id, IP prefix hash, audit log를 모두 개인정보 또는 개인정보에 준하는 데이터로 취급한다.**

개인정보 보호법 제30조는 개인정보 처리방침 수립·공개를 요구하고, 시행령은 처리 항목, 국외 이전, 안전성 확보 조치 등을 공개 항목으로 둔다. 시행령 제30조는 접근권한 제한, 접근통제, 암호화, 접속기록 보관 등을 안전성 확보 조치로 제시한다.

**수집 최소화**

- 익명 투표: voter_id 쿠키만 사용. raw IP는 앱 DB에 저장하지 않는다.
- IP abuse 방어: 일 단위 HMAC prefix만 저장한다.
- User-Agent: raw 저장 금지, HMAC hash만 저장한다.
- 카카오 OAuth: 이메일은 선택이라도 기본 수집하지 않는 것을 권장한다. display_name도 서비스에 노출하지 않으면 저장 필요성을 재검토한다.
- profile_image_url은 개인정보성이 있고 서비스 핵심에 불필요하므로 저장하지 않거나 즉시 null 처리한다.

**보관 기간 정책**

| 데이터 | 보관 |
|---|---|
| votes | 만료 후 1-2시간 내 삭제 |
| voter_id cookie | 180일 또는 사용자가 "익명 ID 초기화" 시 삭제 |
| audit_events | 30일 |
| rate_limit_buckets | window 종료 후 최대 24시간 |
| blocked_subjects | 1시간-30일, 사유별 차등 |
| places | 운영 목적상 유지하되, 부적절/개인정보 포함 시 삭제 |
| places.created_by | raw voter_id 금지. HMAC으로 대체하고 30-90일 후 null 권장 |
| OAuth users | 탈퇴 시 즉시 삭제. 장기 미사용 1년 후 삭제 또는 비활성화 권장 |

**삭제 요청권 처리**

- 로그인 사용자: `/api/me/delete` 또는 이메일 요청으로 users 삭제, 세션 무효화.
- 익명 사용자: 현재 서명된 voter cookie를 소유한 경우 해당 voter_id의 남은 votes 삭제 및 cookie rotate.
- 과거 익명 vote는 1시간 후 삭제되므로 별도 식별 없이 복구/삭제가 어렵다는 점을 처리방침에 명시.
- 장소명에 개인정보가 포함된 경우 누구나 신고 가능하게 하고, 운영자는 즉시 비공개/삭제할 수 있게 한다.
- 응답 목표는 10일 이내. 정확한 법정 절차·기한은 최신 PIPA 가이드로 조사 필요.

**Cloudflare Analytics**

Cloudflare는 edge에서 IP 등 요청 메타데이터를 처리한다. Free plan에서 데이터 지역 고정은 제한적일 수 있으므로 개인정보처리방침에 Cloudflare 사용, 국외 처리/이전 가능성, 처리 목적, 보관/보호 조치를 공개한다. Query string에 개인정보가 들어가지 않도록 URL 설계를 유지한다.

**게시해야 할 문서**

1. 개인정보처리방침: 수집항목, 목적, 보유기간, 파기, 제3자 제공, 처리위탁/국외이전, 정보주체 권리, 안전조치, 문의처. → [PRIVACY_POLICY.md](PRIVACY_POLICY.md)
2. 이용약관: 서비스 성격, 익명 투표 한계, 조작 금지, 장소 등록 책임. → [TERMS.md](TERMS.md)
3. 커뮤니티/장소명 정책: 개인정보, 광고, 욕설, 혐오, 정치 선동, 허위 장소 삭제 기준. → [COMMUNITY_GUIDELINES.md](COMMUNITY_GUIDELINES.md)
4. 신고/삭제 요청 안내: 이메일 또는 폼. (도메인 운영자 결정 필요)
5. 장애/남용 대응 정책: emergency rate limit, readonly mode 가능성. → [ABUSE_RUNBOOK.md](ABUSE_RUNBOOK.md)

---

## 7. Phased Rollout

### P0: 이번 주 안에

목표는 비용 폭탄과 가장 쉬운 Sybil을 막는 것이다.

- Cloudflare POST `/api/*` rate limiting rule 1개 적용. (Dashboard 작업, 코드 외)
- `/api/places` cache + LIMIT 적용.
- POST Origin/CSRF guard 적용.
- vote/place 생성에 voter_id, ipPrefixHash 기반 rate limit 적용.
- place name/type validation 적용.
- D1 index 추가: `votes(place_id, expires_at)`, `votes(expires_at)`, `places(normalized_name)`.
- kill switch `votes_closed`, `place_creation_closed` 구현.
- audit_events 최소 버전 추가. raw IP 저장 금지.
- 개인정보처리방침 초안 게시. 카카오 이메일 저장 중단 검토.

절대 안 함: 로그인 강제, 실명 인증, device fingerprint, raw IP 장기 저장, 장소 생성 전면 개방 유지.

### P1: 이번 달 안에

목표는 운영자 1인이 감당 가능한 탐지와 품질 관리다.

- Turnstile을 free-form 장소 생성에 적용.
- rate limit 초과 후 재시도에도 Turnstile 적용.
- normalized_name 기반 유사 장소 병합 후보 만들기.
- 신고 기능 추가: 장소명 개인정보/광고/욕설 신고.
- audit batch job: 시간별 abuse report 생성.
- Cloudflare Notifications: Workers usage, budget alert 설정.
- sitemap은 verified/active places만 포함하고 캐시.
- OAuth JWT token_version 도입으로 logout/revoke 가능하게 변경.

절대 안 함: 모든 투표 CAPTCHA, 광범위한 IP ban, VPN 일괄 차단, 로그인 유저에게 큰 투표 가중치 부여.

### P2: 분기 단위

목표는 "막기"보다 "조작 신호의 영향력을 낮추기"다.

- 행동 기반 trust score 도입: 쿠키 age, 정상 투표 간격, 다양한 장소의 자연스러운 패턴.
- 신규 voter/동일 ipPrefix 군집은 count에는 반영하되 confidence를 낮게 표시.
- 장소별 anomaly badge: "최근 비정상 트래픽 감지, 결과 신뢰도 낮음".
- 운영자 moderation dashboard.
- abuse runbook: WAF 상향, place creation close, vote close, 복구 순서 문서화.
- 필요 시 Workers Paid $5/mo 전환 검토. 단, budget alert와 kill switch 선행.

절대 안 함: 실명 인증, 한국 신용카드 인증, FingerprintJS류 영구 기기식별, 개인별 이동경로 분석, raw 로그 외부 SaaS 전송.

---

참고한 공식 문서:
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)
- [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Billing budget alerts](https://developers.cloudflare.com/billing/understand/how-billing-works/)
- [개인정보 보호법 제30조](https://www.law.go.kr/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1020398435)
- [개인정보 보호법 시행령 제30조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027191557)
- [개인정보 보호법 시행령 제31조](https://www.law.go.kr/LSW/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900079801)
