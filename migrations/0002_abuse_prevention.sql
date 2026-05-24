-- 남용 방지/감사/회로차단 인프라.
-- 자세한 설계 근거: docs/ABUSE_PREVENTION_POLICY.md

-- 감사 로그. raw IP / raw voter_id / raw UA는 절대 저장하지 않는다.
-- 모든 식별자는 ABUSE_SECRET으로 HMAC-SHA256 해시된 16진 문자열.
CREATE TABLE IF NOT EXISTS audit_events (
  id            TEXT PRIMARY KEY,
  ts            INTEGER NOT NULL,
  event_type    TEXT NOT NULL,     -- vote, place_create, place_upsert, rate_limited, rejected, kill_switch
  route         TEXT NOT NULL,
  method        TEXT NOT NULL,
  status        INTEGER NOT NULL,
  place_id      TEXT,
  voter_hash    TEXT,
  ip_prefix_hash TEXT,
  ua_hash       TEXT,
  country       TEXT,
  cf_ray        TEXT,
  reason        TEXT,
  meta_json     TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_ts        ON audit_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_place_ts  ON audit_events(place_id, ts);
CREATE INDEX IF NOT EXISTS idx_audit_ip_ts     ON audit_events(ip_prefix_hash, ts);
CREATE INDEX IF NOT EXISTS idx_audit_voter_ts  ON audit_events(voter_hash, ts);

-- Token bucket을 D1에 보관. window_start는 epoch seconds, count는 해당 window 누적.
-- expires_at은 cron cleanup 기준.
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key           TEXT NOT NULL,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_expires ON rate_limit_buckets(expires_at);

-- 차단 대상. subject_hash는 voter_hash 또는 ip_prefix_hash 또는 place_id.
CREATE TABLE IF NOT EXISTS blocked_subjects (
  subject_hash  TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL,     -- voter, ip_prefix, place
  reason        TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocked_expires ON blocked_subjects(expires_at);

-- 운영자가 D1 콘솔에서 즉시 토글하는 kill switch / 설정 값.
-- value='true' 또는 epoch ms 값(미래)이면 닫힘으로 본다.
CREATE TABLE IF NOT EXISTS app_config (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- 유사 장소 병합 후보 추출용. 신규/기존 places 모두 채움.
ALTER TABLE places ADD COLUMN normalized_name TEXT;
CREATE INDEX IF NOT EXISTS idx_places_normalized_name ON places(normalized_name);
