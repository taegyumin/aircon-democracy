// Generic university dataset shape.
//
// SNU and Yonsei have bespoke types/wizards (snu.ts, yonsei.ts) because they
// were the prototypes. Everything else funnels through this generic shape so
// that adding a school = adding one JSON + one registry entry.

export interface UnivBuilding {
  code: string;            // "301", "B145", "N1", "공A"
  name: string;            // Human-facing canonical name
  aliases?: string[];      // English abbr, old names, romanizations
  college?: string;        // Best-effort 단과대/소속 (omitted when unknown)
}

export interface UnivCampus {
  id: string;              // url-safe: "main", "anam", "sinchon", "seokwan"
  name: string;            // "안암캠퍼스", "신촌캠퍼스"
  district: string;        // 행정구역 prefix used in place metadata
  buildings: UnivBuilding[];
}

export interface University {
  id: string;              // unique school id, also URL-safe
  name: string;            // "고려대학교"
  shortName: string;       // "고려대"
  aliases: string[];       // search aliases (English, romanization, area)
  badge: string;           // small chip text shown on the picker card
  placeIdPrefix: string;   // place id namespace: "korea" → "korea:안암:103:407"
  campuses: UnivCampus[];  // ≥1. Multi → wizard inserts a campus-picker step
  notes?: string;          // shown as small text in picker (e.g. "데이터 한정")
  sources: string[];       // citation URLs (research transparency)
}
