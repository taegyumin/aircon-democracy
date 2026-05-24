export type PlaceType = 'classroom' | 'subway' | 'cafe' | 'bus' | 'library' | 'office' | 'other';

export interface Place {
  id: number;
  name: string;
  type: PlaceType;
  district: string;
  distance: string;
  votes: { cold: number; ok: number; hot: number };
}

export const PLACES: Place[] = [
  { id: 1, name: '서울대학교 301동 401호', type: 'classroom', district: '관악구', distance: '15m', votes: { cold: 8, ok: 3, hot: 2 } },
  { id: 2, name: '2호선 강남→삼성 열차', type: 'subway', district: '강남구', distance: '탑승 중', votes: { cold: 5, ok: 12, hot: 30 } },
  { id: 3, name: '스타벅스 강남대로점', type: 'cafe', district: '강남구', distance: '230m', votes: { cold: 4, ok: 8, hot: 0 } },
  { id: 4, name: '한양대학교 HIT관 204호', type: 'classroom', district: '성동구', distance: '2.1km', votes: { cold: 18, ok: 2, hot: 1 } },
  { id: 5, name: '경복궁역 272번 버스', type: 'bus', district: '종로구', distance: '500m', votes: { cold: 0, ok: 1, hot: 4 } },
  { id: 6, name: '중앙도서관 열람실 B', type: 'library', district: '관악구', distance: '310m', votes: { cold: 14, ok: 5, hot: 0 } },
];
