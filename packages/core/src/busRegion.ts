// 버스 region (cityCode) data — TAGO BusLcInfoInqireService/getCtyCodeList 2026-05-27 응답 기준.
// 138개 시·도. 서울(11)은 TAGO에 없음 — 별도 ws.bus.go.kr 시스템 사용.
//
// 광역시(2자리 코드) 8개 + 시·군(5자리 코드) 130개.
// 일부 도시는 합쳐서 코드 1개 ("대전광역시/계룡시", "원주시/횡성군").

export interface CityCode { code: number; name: string }

export const CITY_CODES: CityCode[] = [
  // 광역시 (2자리)
  { code: 12, name: '세종특별시' },
  { code: 21, name: '부산광역시' },
  { code: 22, name: '대구광역시' },
  { code: 23, name: '인천광역시' },
  { code: 24, name: '광주광역시' },
  { code: 25, name: '대전광역시/계룡시' },
  { code: 26, name: '울산광역시' },
  { code: 39, name: '제주도' },
  // 경기도 (31xxx)
  { code: 31010, name: '수원시' }, { code: 31020, name: '성남시' }, { code: 31030, name: '의정부시' },
  { code: 31040, name: '안양시' }, { code: 31050, name: '부천시' }, { code: 31060, name: '광명시' },
  { code: 31070, name: '평택시' }, { code: 31080, name: '동두천시' }, { code: 31090, name: '안산시' },
  { code: 31100, name: '고양시' }, { code: 31110, name: '과천시' }, { code: 31120, name: '구리시' },
  { code: 31130, name: '남양주시' }, { code: 31140, name: '오산시' }, { code: 31150, name: '시흥시' },
  { code: 31160, name: '군포시' }, { code: 31170, name: '의왕시' }, { code: 31180, name: '하남시' },
  { code: 31190, name: '용인시' }, { code: 31200, name: '파주시' }, { code: 31210, name: '이천시' },
  { code: 31220, name: '안성시' }, { code: 31230, name: '김포시' }, { code: 31240, name: '화성시' },
  { code: 31250, name: '광주시' }, { code: 31260, name: '양주시' }, { code: 31270, name: '포천시' },
  { code: 31320, name: '여주시' }, { code: 31350, name: '연천군' }, { code: 31370, name: '가평군' },
  { code: 31380, name: '양평군' },
  // 강원도 (32xxx)
  { code: 32010, name: '춘천시' }, { code: 32020, name: '원주시/횡성군' }, { code: 32050, name: '태백시' },
  { code: 32310, name: '홍천군' }, { code: 32360, name: '철원군' }, { code: 32410, name: '양양군' },
  // 충북 (33xxx)
  { code: 33010, name: '청주시' }, { code: 33020, name: '충주시' }, { code: 33030, name: '제천시' },
  { code: 33320, name: '보은군' }, { code: 33330, name: '옥천군' }, { code: 33340, name: '영동군' },
  { code: 33350, name: '진천군' }, { code: 33360, name: '괴산군' }, { code: 33370, name: '음성군' },
  { code: 33380, name: '단양군' },
  // 충남 (34xxx)
  { code: 34010, name: '천안시' }, { code: 34020, name: '공주시' }, { code: 34030, name: '보령시' },
  { code: 34040, name: '아산시' }, { code: 34050, name: '서산시' }, { code: 34060, name: '논산시' },
  { code: 34070, name: '계룡시' }, { code: 34310, name: '금산군' }, { code: 34330, name: '부여군' },
  { code: 34340, name: '서천군' }, { code: 34350, name: '청양군' }, { code: 34380, name: '태안군' },
  { code: 34390, name: '당진시' },
  // 전북 (35xxx)
  { code: 35010, name: '전주시' }, { code: 35020, name: '군산시' }, { code: 35030, name: '익산시' },
  { code: 35040, name: '정읍시' }, { code: 35050, name: '남원시' }, { code: 35060, name: '김제시' },
  { code: 35320, name: '진안군' }, { code: 35330, name: '무주군' }, { code: 35340, name: '장수군' },
  { code: 35350, name: '임실군' }, { code: 35360, name: '순창군' }, { code: 35370, name: '고창군' },
  { code: 35380, name: '부안군' },
  // 전남 (36xxx)
  { code: 36010, name: '목포시' }, { code: 36020, name: '여수시' }, { code: 36030, name: '순천시' },
  { code: 36040, name: '나주시' }, { code: 36060, name: '광양시' }, { code: 36320, name: '곡성군' },
  { code: 36330, name: '구례군' }, { code: 36350, name: '고흥군' }, { code: 36380, name: '장흥군' },
  { code: 36400, name: '해남군' }, { code: 36410, name: '영암군' }, { code: 36420, name: '무안군' },
  { code: 36430, name: '함평군' }, { code: 36450, name: '장성군' }, { code: 36460, name: '완도군' },
  { code: 36470, name: '진도군' }, { code: 36480, name: '신안군' },
  // 경북 (37xxx)
  { code: 37010, name: '포항시' }, { code: 37020, name: '경주시' }, { code: 37030, name: '김천시' },
  { code: 37040, name: '안동시' }, { code: 37050, name: '구미시' }, { code: 37060, name: '영주시' },
  { code: 37070, name: '영천시' }, { code: 37080, name: '상주시' }, { code: 37090, name: '문경시' },
  { code: 37100, name: '경산시' }, { code: 37320, name: '의성군' }, { code: 37330, name: '청송군' },
  { code: 37340, name: '영양군' }, { code: 37350, name: '영덕군' }, { code: 37360, name: '청도군' },
  { code: 37370, name: '고령군' }, { code: 37380, name: '성주군' }, { code: 37390, name: '칠곡군' },
  { code: 37400, name: '예천군' }, { code: 37410, name: '봉화군' }, { code: 37420, name: '울진군' },
  { code: 37430, name: '울릉군' },
  // 경남 (38xxx)
  { code: 38010, name: '창원시' }, { code: 38030, name: '진주시' }, { code: 38050, name: '통영시' },
  { code: 38060, name: '사천시' }, { code: 38070, name: '김해시' }, { code: 38080, name: '밀양시' },
  { code: 38090, name: '거제시' }, { code: 38100, name: '양산시' }, { code: 38310, name: '의령군' },
  { code: 38320, name: '함안군' }, { code: 38330, name: '창녕군' }, { code: 38340, name: '고성군' },
  { code: 38350, name: '남해군' }, { code: 38360, name: '하동군' }, { code: 38370, name: '산청군' },
  { code: 38380, name: '함양군' }, { code: 38390, name: '거창군' }, { code: 38400, name: '합천군' },
];

// 서울은 TAGO 미포함 — Seoul 전용 sentinel. ws.bus.go.kr 분기에 사용.
export const SEOUL_REGION = 'seoul' as const;
export type BusRegion = number | typeof SEOUL_REGION;

// 유효한 region (server-side schema refine + frontend dropdown options 공유).
export const VALID_REGION_VALUES: ReadonlySet<string> = new Set<string>([
  SEOUL_REGION,
  ...CITY_CODES.map((c) => String(c.code)),
]);

// 합쳐진 이름 split alias — '대전광역시/계룡시' → ['대전광역시', '계룡시'].
// NCP reverseGeocode가 '계룡시'만 줄 때도 매칭되도록.
const ALIASES: Array<{ alias: string; code: number }> = CITY_CODES
  .filter((c) => c.name.includes('/'))
  .flatMap((c) => c.name.split('/').map((alias) => ({ alias: alias.trim(), code: c.code })));

// '서울' / '서울특별시' / Seoul → SEOUL_REGION. 외에는 CITY_CODES에서 prefix 매칭.
// 합쳐진 이름의 두 번째 alias도 매칭 (LLM P2: '계룡시', '횡성군' 미매칭 문제).
export function regionByName(name: string): BusRegion | null {
  const n = name.trim();
  if (!n) return null;
  if (/^서울/.test(n) || /seoul/i.test(n)) return SEOUL_REGION;
  const exact = CITY_CODES.find((c) => c.name === n);
  if (exact) return exact.code;
  // alias 정확 일치 ('계룡시' 등).
  const alias = ALIASES.find((a) => a.alias === n);
  if (alias) return alias.code;
  // prefix 매칭 (예: "부산" → "부산광역시", "수원" → "수원시").
  const pref = CITY_CODES.find((c) => c.name.startsWith(n));
  if (pref) return pref.code;
  // alias prefix ('계룡' → '계룡시').
  const aliasPref = ALIASES.find((a) => a.alias.startsWith(n));
  if (aliasPref) return aliasPref.code;
  return null;
}

export function regionLabel(r: BusRegion): string {
  if (r === SEOUL_REGION) return '서울특별시';
  return CITY_CODES.find((c) => c.code === r)?.name ?? `cityCode:${r}`;
}
