import rawTrainStations from './data/train-stations.json';

/**
 * Train-only stations (KTX/SRT/ITX/무궁화호 정차역) that are NOT in the
 * subway dataset. Coordinates are deliberately omitted — public Wikipedia
 * lookups for 141 station coords weren't fully verified, and the project
 * forbids guessed coordinates.
 *
 * For autocomplete / segment selection, name + city + routes is sufficient.
 */
export interface TrainStation {
  name: string;
  city: string;
  /** Each entry is "{operator}·{line}" — e.g. "KORAIL·KTX 경부선". */
  routes: string[];
}

export const TRAIN_STATIONS: TrainStation[] = rawTrainStations as TrainStation[];

/**
 * YYYYMMDD + HH + MM 형식 합치기. TAGO TrainInfo / ExpBusInfo / SuburbsBusInfo
 * verify endpoint가 `depPlandTime` (또는 `depPlandTimeHHMI`)을 12자리 string으로 받음.
 * web/mobile train wizard + intercity-bus wizard 3곳에서 중복되던 패턴 — core로 통일.
 */
export function joinYmdHm(runDt: string, hh: string, mm: string): string {
  if (!runDt || !hh || !mm) return '';
  return `${runDt}${hh.padStart(2, '0')}${mm.padStart(2, '0')}`;
}

/**
 * 간선철도 verify endpoint reason → 한국어 사용자 copy.
 * 매핑 안 된 reason은 그대로 표시 (개발자 진단용).
 */
export const TRAIN_VERIFY_ERROR_COPY: Record<string, string> = {
  not_found: '해당 열차를 찾지 못했어요. 좌석권 다시 확인해주세요.',
  service_closed: '해당 일자에 운행 정보가 없어요.',
};

/**
 * 고속·시외버스 verify endpoint reason → 한국어 사용자 copy.
 */
export const INTERCITY_BUS_VERIFY_ERROR_COPY: Record<string, string> = {
  not_found: '해당 시각 출발 버스를 찾지 못했어요. 승차권 다시 확인해주세요.',
  service_closed: '해당 노선·날짜에 운행 정보가 없어요.',
};

/** Lightweight name search across train-only stations. */
export function searchTrainStations(query: string, limit = 12): TrainStation[] {
  const q = query.trim();
  if (!q) return TRAIN_STATIONS.slice(0, limit);
  const out: { s: TrainStation; rank: number }[] = [];
  for (const s of TRAIN_STATIONS) {
    let rank = 99;
    if (s.name === q) rank = 0;
    else if (s.name.startsWith(q)) rank = 1;
    else if (s.name.includes(q)) rank = 2;
    else if (s.city.includes(q)) rank = 6;
    if (rank < 99) out.push({ s, rank });
  }
  out.sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name));
  return out.slice(0, limit).map((x) => x.s);
}
