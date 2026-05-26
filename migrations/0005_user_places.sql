-- 사용자 직접 등록 공간 지원.
-- - is_public: 검색 결과/홈 list 노출 여부. 0=비공개 (link로만 접근). 1=공개.
-- - 기존 places (system-seeded subway/bus 등) 자동으로 created_by IS NULL이라 backfill로 모두 공개.
-- - 사용자 등록 시 코드에서 is_public=0 명시.

ALTER TABLE places ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;

-- system-generated places는 이미 NULL created_by — public으로 유지.
-- 사용자 등록은 backend에서 명시적 is_public=0 + created_by=user.id 박음.

CREATE INDEX IF NOT EXISTS idx_places_owner ON places(created_by) WHERE created_by IS NOT NULL;
