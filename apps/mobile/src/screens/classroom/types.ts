// 강의실 wizard 학교 목록 정의 — SNU/Yonsei(bespoke) + UNIVERSITIES(generic).
// web SNUClassroomWizard.tsx 의 KnownUniv 와 동등 구조.

import { snu, yonsei } from '@aircon/core';
import { UNIVERSITIES, type University } from '@aircon/core/universities';

export interface KnownUniv {
  id: string;
  name: string;
  aliases: string[];
  badge: string;
  buildingCount: number;
  roomCount?: number;
  note?: string;
  kind: 'snu' | 'yonsei' | 'generic';
  university?: University;
}

const BESPOKE: KnownUniv[] = [
  {
    id: 'snu', kind: 'snu',
    name: '서울대학교',
    aliases: ['서울대', 'SNU', '관악', '관악캠퍼스', '연건', '서울대학'],
    badge: '관악·연건',
    buildingCount: snu.BUILDINGS.length,
    roomCount: 1976,
  },
  {
    id: 'yonsei', kind: 'yonsei',
    name: '연세대학교',
    aliases: ['연세대', '연대', 'Yonsei', '신촌', '신촌캠퍼스', '연세대학'],
    badge: '신촌',
    buildingCount: yonsei.BUILDINGS.length,
    note: '호실은 직접 입력',
  },
];

const GENERIC: KnownUniv[] = UNIVERSITIES.map((u): KnownUniv => ({
  id: u.id,
  kind: 'generic',
  university: u,
  name: u.name,
  aliases: u.aliases,
  badge: u.badge,
  buildingCount: u.campuses.reduce((sum, c) => sum + c.buildings.length, 0),
  note: u.notes ?? '호실은 직접 입력',
}));

export const KNOWN_UNIVS: KnownUniv[] = [...BESPOKE, ...GENERIC];
