-- Drop places.type CHECK constraint.
-- Reason: 0001_init.sql defined CHECK (type IN ('classroom','subway','cafe','bus','library','office','other'))
-- 이후 코드는 'train'도 사용 (PlaceType + VALID_PLACE_TYPES). prod schema는 이미 수동으로
-- CHECK 제거 상태 (places 테이블 SQL 검사로 확인). migration 파일과 일치시킴.
--
-- 검증: code-level validation (VALID_PLACE_TYPES in apps/web/src/server/_abuse.ts) 으로 충분.
-- 새 type 추가 시 별도 schema migration 불필요.
--
-- SQLite는 ALTER TABLE ... DROP CONSTRAINT 미지원 → table recreate 패턴.

PRAGMA foreign_keys=OFF;

CREATE TABLE places_new (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,  -- code-level VALID_PLACE_TYPES 로 검증
  district        TEXT,
  detail          TEXT,
  created_at      INTEGER NOT NULL,
  created_by      TEXT,
  normalized_name TEXT
);

INSERT INTO places_new SELECT id, name, type, district, detail, created_at, created_by, normalized_name FROM places;

DROP TABLE places;
ALTER TABLE places_new RENAME TO places;

CREATE INDEX idx_places_type        ON places(type);
CREATE INDEX idx_places_created_at  ON places(created_at DESC);
CREATE INDEX idx_places_normalized_name ON places(normalized_name);

PRAGMA foreign_keys=ON;
