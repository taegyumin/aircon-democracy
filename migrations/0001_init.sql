-- Places
CREATE TABLE places (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('classroom','subway','cafe','bus','library','office','other')),
  district    TEXT,
  detail      TEXT,
  created_at  INTEGER NOT NULL,
  created_by  TEXT
);

CREATE INDEX idx_places_type        ON places(type);
CREATE INDEX idx_places_created_at  ON places(created_at DESC);

-- Votes (current live opinions)
CREATE TABLE votes (
  place_id    TEXT NOT NULL,
  voter_id    TEXT NOT NULL,
  vote        TEXT NOT NULL CHECK (vote IN ('cold','ok','hot')),
  voted_at    INTEGER NOT NULL,
  changed_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  PRIMARY KEY (place_id, voter_id),
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE INDEX idx_votes_place_expires  ON votes(place_id, expires_at);
CREATE INDEX idx_votes_expires        ON votes(expires_at);

-- Seed places (matching current frontend mock so existing UI works seamlessly)
INSERT INTO places (id, name, type, district, created_at) VALUES
  ('seed-1', '서울대학교 301동 401호',   'classroom', '관악구', 0),
  ('seed-2', '2호선 강남→삼성 열차',     'subway',    '강남구', 0),
  ('seed-3', '스타벅스 강남대로점',       'cafe',      '강남구', 0),
  ('seed-4', '한양대학교 HIT관 204호',   'classroom', '성동구', 0),
  ('seed-5', '경복궁역 272번 버스',       'bus',       '종로구', 0),
  ('seed-6', '중앙도서관 열람실 B',       'library',   '관악구', 0);
