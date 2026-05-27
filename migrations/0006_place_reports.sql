-- 장소 정보 신고. 사용자가 잘못된 장소 정보 / 중복 / 삭제 요청 보낼 때 저장.
-- admin이 wrangler d1로 직접 검토 (별도 dashboard 후속).

CREATE TABLE IF NOT EXISTS place_reports (
  id          TEXT PRIMARY KEY,
  place_id    TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('not-here', 'wrong-name', 'duplicate', 'delete', 'other')),
  -- 사용자가 자유 입력한 상세 (선택). 길이 제한 코드에서.
  note        TEXT,
  -- voter_id (anonymous hash) — abuse 추적용. 같은 사람이 같은 place 신고 spam 방지.
  voter_hash  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  -- 'pending' | 'reviewed' | 'dismissed' — admin 처리 상태.
  status      TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_place_reports_place    ON place_reports(place_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_place_reports_pending  ON place_reports(status, created_at DESC) WHERE status = 'pending';
-- 같은 voter가 같은 place 같은 reason으로 1회만.
CREATE UNIQUE INDEX IF NOT EXISTS idx_place_reports_uniq ON place_reports(place_id, voter_hash, reason);
