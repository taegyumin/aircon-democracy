-- Users table for OAuth (kakao/naver/google).
--
-- prod D1에는 손으로 만들어 이미 존재 — IF NOT EXISTS로 idempotent하게 처리해
-- prod 재실행해도 안전, fresh deploy/preview D1에서는 새로 생성된다.
-- (LLM 리뷰 P1: 이 파일 없으면 fresh deploy에서 /api/me, OAuth callback 깨짐.)

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  provider            TEXT NOT NULL,           -- 'kakao' | 'naver' | 'google'
  provider_user_id    TEXT NOT NULL,
  display_name        TEXT,
  profile_image_url   TEXT,
  email               TEXT,
  created_at          INTEGER NOT NULL,
  last_login_at       INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_provider_uid ON users(provider, provider_user_id);
