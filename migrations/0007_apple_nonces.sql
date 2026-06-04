-- 2026-06-05: Apple Sign In nonce 1회 소비 — replay attack 방어.
--
-- 흐름:
--   1. mobile: GET /api/auth/apple/nonce → server INSERT (5분 만료) + raw nonce 반환
--   2. mobile: SHA256(raw_nonce) → AppleAuthentication.signInAsync({ nonce: hash })
--   3. mobile: POST /api/auth/apple/native { identityToken, nonce: raw_nonce }
--   4. server: identityToken verify + payload.nonce === SHA256(nonce) 비교 + DB row 삭제
--
-- 만료 cleanup은 cron worker (별도) 또는 다음 INSERT 직전 lazy delete.

CREATE TABLE IF NOT EXISTS apple_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL  -- ms timestamp
);
CREATE INDEX IF NOT EXISTS idx_apple_nonces_expires ON apple_nonces(expires_at);
