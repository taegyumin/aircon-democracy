// Registry of universities (excluding SNU/Yonsei which have bespoke wizards).
//
// Generic university data is split into Seoul and national JSON files because:
//  - 100+ schools, ~5-30 buildings each is still small enough to bundle
//  - keeping Seoul separate made the original curation easier to review
//  - JSON keeps the type checker out of curated data
//
// Each entry carries a `sources` array of citation URLs (research transparency).

import type { University } from './types';
import seoulRaw from './data/seoul.json';
import koreaRaw from './data/korea.json';

const SEOUL: University[] = (seoulRaw as { schools: University[] }).schools;
const KOREA: University[] = (koreaRaw as { schools: University[] }).schools;

export const UNIVERSITIES: University[] = [...SEOUL, ...KOREA];

export * from './types';
export * from './search';
