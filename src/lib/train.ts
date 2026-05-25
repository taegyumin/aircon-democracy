import rawTrainStations from '../data/train-stations.json';

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
