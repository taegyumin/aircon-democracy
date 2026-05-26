// Registry of universities (excluding SNU/Yonsei which have bespoke wizards).
//
// All data lives in ./data/seoul.json — one file because:
//  - 40 schools, ~5-30 buildings each = single 50-80KB JSON, trivially bundled
//  - editing one file is less friction than juggling 40
//  - JSON keeps the type checker out of curated data
//
// Each entry carries a `sources` array of citation URLs (research transparency).

import type { University } from './types';
import seoulRaw from './data/seoul.json';

export const UNIVERSITIES: University[] = (seoulRaw as { schools: University[] }).schools;

export * from './types';
export * from './search';
