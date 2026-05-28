// 용인에버라인 (용인경전철㈜) 비공식 실시간 차량 위치 wrap.
// 운영사(everlinecu.com) 자체 site client용 endpoint를 server-to-server 호출.
// 무인증, Referer 검사 X, 1초 응답 가능. 30s 간격 폴링 실측 검증 (2026-05-28):
//   - time 필드가 정확히 +30s 카운트 (실시간 timer)
//   - StCode 차량별 이동 + Status 3↔2 (운행↔정차) 변화 + 차량 fleet 동적
//   → 시간표 보간 아닌 진짜 실시간 데이터.
//
// schema (szkotgh/everline_api MIT OSS 참고 + 응답 실측):
//   data[]: { TrainNo, StCode (Y110~Y124), DestCode, updownCode (1=기흥/2=에버랜드), StatusCode (1회차/2정차/3운행), time (현 상태 후 초) }
//
// ⚠️ 비공식 endpoint. 운영사가 일방 차단/변경 가능. ToS 명시 없음.
// production 채택 결정은 사용자가 함 (NAVER 부산과 동급 grey-zone).

import type { EverlineStation, EverlineVehicle } from '@aircon/core';

const EVERLINE_URL = 'https://everlinecu.com/api/api009.json';
const UPSTREAM_TIMEOUT_MS = 5000;

// 역 코드 Y110~Y124 → 역명 정적 매핑 (15개 역).
// 응답에 역명 없으므로 backend가 추가 enrich.
export const EVERLINE_STATIONS: EverlineStation[] = [
  { stCode: 'Y110', name: '기흥' },
  { stCode: 'Y111', name: '강남대' },
  { stCode: 'Y112', name: '지석' },
  { stCode: 'Y113', name: '어정' },
  { stCode: 'Y114', name: '동백' },
  { stCode: 'Y115', name: '초당' },
  { stCode: 'Y116', name: '삼가' },
  { stCode: 'Y117', name: '시청·용인대' },
  { stCode: 'Y118', name: '명지대' },
  { stCode: 'Y119', name: '김량장' },
  { stCode: 'Y120', name: '용인중앙시장' },
  { stCode: 'Y121', name: '고진' },
  { stCode: 'Y122', name: '보평' },
  { stCode: 'Y123', name: '둔전' },
  { stCode: 'Y124', name: '전대·에버랜드' },
];

const ST_NAME = new Map(EVERLINE_STATIONS.map((s) => [s.stCode, s.name]));

interface EverlineRawRow {
  TrainNo: string;
  StCode: string;
  DestCode: string;
  updownCode: string;     // "1" 기흥행 / "2" 에버랜드행
  StatusCode: string;     // "1" 회차 / "2" 정차 / "3" 운행
  time: string;           // 현 상태 후 경과 초
  LineNo?: string;        // "E1"
}

interface EverlineEnvelope {
  msg: string;
  code: number;            // 200 OK
  data: EverlineRawRow[];
}

function timedFetch(url: string): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: {
      // 운영사 site client처럼 보이게 — 운영사가 추후 봇 차단 시 대비.
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  });
}

export const everlineProvider = {
  async listVehicles(): Promise<EverlineVehicle[]> {
    const res = await timedFetch(EVERLINE_URL);
    if (!res.ok) throw new Error(`upstream_${res.status}`);
    const body = (await res.json()) as EverlineEnvelope;
    if (body.code !== 200) throw new Error(`upstream_code_${body.code}`);
    const rows = body.data ?? [];
    return rows.map((r) => ({
      trainNo: r.TrainNo,
      stCode: r.StCode,
      stationName: ST_NAME.get(r.StCode) ?? r.StCode,
      destCode: r.DestCode,
      destName: ST_NAME.get(r.DestCode) ?? r.DestCode,
      direction: r.updownCode === '1' ? 'giheung' : 'everland',
      status: r.StatusCode === '1' ? 'returning' : r.StatusCode === '2' ? 'stopped' : 'running',
      elapsedSec: parseInt(r.time, 10) || 0,
    }));
  },
};
