# 남용 대응 Runbook

운영자 1인이 즉시 실행 가능한 순서대로 정리한다. 모든 조치는 D1 콘솔(`wrangler d1 execute aircon-democracy --command "..."` 또는 Cloudflare Dashboard)에서 실행한다.

전체 정책 배경: [ABUSE_PREVENTION_POLICY.md](ABUSE_PREVENTION_POLICY.md)

## 0. 사전 준비 (배포 직후 1회)

```bash
# Secrets
wrangler pages secret put ABUSE_SECRET   # 32바이트 이상 랜덤 문자열
wrangler pages secret put COOKIE_SECRET  # 이미 있다면 스킵
wrangler pages secret put SESSION_SECRET # 이미 있다면 스킵

# Migration
wrangler d1 migrations apply aircon-democracy
```

Cloudflare Dashboard:

- **Security → WAF → Rate limiting rules** 에 다음 규칙 1개를 추가한다(Free plan은 1개 한도).
  - Expression: `(http.host eq "aircondemocracy.com" and http.request.method eq "POST" and http.request.uri.path starts_with "/api/")`
  - Characteristics: IP
  - Threshold: `60 requests / 10 seconds`
  - Action: `Block`, mitigation timeout 10초
- **Notifications**: Workers Usage Notifications, Budget Alerts(`$1`/`$3`/`$5`/`$10`) 등록.

## 1. 평시 모니터링

매일 한 번씩 확인:

- Cloudflare Dashboard → Workers & Pages → aircon-democracy → Metrics
  - 일 100,000 요청에 근접하면 경고. 캐시 hit ratio, 4xx/5xx 비율, CPU exceeded 발생 횟수 확인.
- Cloudflare Dashboard → D1 → aircon-democracy
  - Rows read / Rows written 일일 추이. 5M / 100k 한도 근접 여부.
- 최근 24시간 감사 로그 요약:
  ```sql
  SELECT event_type, status, COUNT(*) AS n
  FROM audit_events
  WHERE ts > strftime('%s','now') * 1000 - 86400000
  GROUP BY event_type, status
  ORDER BY n DESC;
  ```

## 2. 이상 신호별 1차 대응

### 2-1. 특정 IP 대역 폭주 의심

```sql
-- 최근 1시간 ip_prefix_hash 별 요청 수
SELECT ip_prefix_hash, COUNT(*) AS n
FROM audit_events
WHERE ts > strftime('%s','now') * 1000 - 3600000
GROUP BY ip_prefix_hash
ORDER BY n DESC
LIMIT 20;
```

상위 해시가 평소의 10배 이상이면:

```sql
INSERT INTO blocked_subjects (subject_hash, subject_type, reason, created_at, expires_at)
VALUES ('<ip_prefix_hash>', 'ip_prefix', 'flood_2026-XX-XX', strftime('%s','now')*1000, strftime('%s','now')*1000 + 86400000);
```

(24시간 차단. 사유는 자유 형식.)

### 2-2. 특정 voter_id 어뷰즈

```sql
SELECT voter_hash, COUNT(*) AS n, GROUP_CONCAT(DISTINCT place_id)
FROM audit_events
WHERE ts > strftime('%s','now') * 1000 - 3600000
GROUP BY voter_hash
HAVING n > 50
ORDER BY n DESC;
```

해당 voter를 차단:

```sql
INSERT INTO blocked_subjects (subject_hash, subject_type, reason, created_at, expires_at)
VALUES ('<voter_hash>', 'voter', 'spam_2026-XX-XX', strftime('%s','now')*1000, strftime('%s','now')*1000 + 7*86400000);
```

### 2-3. 특정 장소에 의심스러운 표 집중

```sql
-- 최근 1시간 vote 이벤트가 한 장소에 집중되는지
SELECT place_id, COUNT(*) AS votes, COUNT(DISTINCT voter_hash) AS voters,
       COUNT(DISTINCT ip_prefix_hash) AS ips
FROM audit_events
WHERE event_type = 'vote' AND ts > strftime('%s','now') * 1000 - 3600000
GROUP BY place_id
ORDER BY votes DESC
LIMIT 20;
```

`voters > 30 AND ips < 5` 패턴이면 군집 의심. 1차로는 그 IP prefix들을 1~6시간 일시 차단하고, 필요 시 장소 자체를 비공개로 돌린다(아래 4-1).

### 2-4. D1 쿼리 오류 / Workers 1027/1102 발생

장애 상황. 다음을 순서대로 실행한다.

1. **place 생성 즉시 닫기** — D1 row writes를 가장 빠르게 줄임.
   ```sql
   INSERT INTO app_config(key, value, updated_at)
   VALUES ('place_creation_closed', 'true', strftime('%s','now') * 1000)
   ON CONFLICT(key) DO UPDATE SET value='true', updated_at=strftime('%s','now') * 1000;
   ```
2. 5분 뒤에도 quota 회복 안 되면 **vote도 닫기**.
   ```sql
   INSERT INTO app_config(key, value, updated_at)
   VALUES ('votes_closed', 'true', strftime('%s','now') * 1000)
   ON CONFLICT(key) DO UPDATE SET value='true', updated_at=strftime('%s','now') * 1000;
   ```
3. Cloudflare Dashboard에서 일일 quota 리셋 시각(UTC 00:00) 확인.

## 3. 정기 청소 (주 1회 권장)

```sql
-- 만료 vote / rate bucket / 오래된 audit 정리
DELETE FROM votes WHERE expires_at < strftime('%s','now') * 1000 - 3600000;
DELETE FROM rate_limit_buckets WHERE expires_at < strftime('%s','now');
DELETE FROM audit_events WHERE ts < strftime('%s','now') * 1000 - 30 * 86400000;
DELETE FROM blocked_subjects WHERE expires_at < strftime('%s','now') * 1000;
```

위 4개 쿼리는 Cron Worker로 자동화 가능(추후 P1).

## 4. 콘텐츠 운영

### 4-1. 신고된 장소 비공개/삭제

```sql
-- 비공개 대신 즉시 삭제(투표/감사 로그는 ON DELETE CASCADE로 따라 정리됨)
DELETE FROM places WHERE id = '<place_id>';
```

장소 신고 신고 채널: TODO: report@aircondemocracy.com

### 4-2. 차단 해제

```sql
DELETE FROM blocked_subjects WHERE subject_hash = '<hash>';
```

### 4-3. Kill switch 해제

```sql
UPDATE app_config SET value='false', updated_at=strftime('%s','now')*1000
 WHERE key IN ('votes_closed','place_creation_closed');
```

## 5. 복구 순서 (장애 후)

1. quota 회복 확인.
2. `place_creation_closed` 해제, 10분 모니터.
3. 이상 없으면 `votes_closed` 해제.
4. 1시간 뒤 audit 요약 재확인.
5. 사고 노트 추가: 무엇이, 왜, 다음에는 어떤 임계치를 조정할지.

## 6. 절대 하지 말 것

- voter_id 또는 IP 주소의 raw 값을 다시 수집/저장하지 않는다.
- 차단 사유를 운영자 외부에 공개하지 않는다(우회 학습 방지).
- 운영 편의를 위해 ABUSE_SECRET을 회전 없이 평문으로 다른 곳에 복사하지 않는다.
- Cloudflare 계정 결제수단을 새로 연결할 때는 반드시 Budget Alert와 kill switch가 켜져 있는지 먼저 확인한다.
