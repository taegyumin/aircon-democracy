// 서울 swopenAPI subway realtime provider.
// HTTP 호출 + envelope parsing + reason 정규화까지 책임.
// 매칭 로직(tier picking, candidate selection, progress)은 호출 측에 남김.
//
// envelope 특이점: swopenAPI는 응답 code를 errorMessage.code (일반) 또는 root code
// (status=500 + INFO-200 같은 special) 둘 다로 줌. 양쪽 다 체크 필요.
//
// reason 매핑:
//   INFO-200 → 'unsupported' (이 노선 데이터 자체를 안 가짐 — 김포골드/의정부/용인경전철 등)
//   INFO-000 + 0 rows → 'service_closed' (운행 종료)
//   timeout/HTTP non-OK → 'upstream_error'
//   기타 정상 → 'ok' + rows

export interface SwopenApiRow {
  subwayId: string;
  statnNm: string;
  trainSttus: string;
  updnLine: string;
  trainNo: string;
  statnTnm?: string;
}

export type SwopenApiResult =
  | { kind: 'ok'; rows: SwopenApiRow[] }
  | { kind: 'unsupported' }
  | { kind: 'service_closed' }
  | { kind: 'upstream_error'; message: string };

interface SwopenApiEnvelope {
  errorMessage?: { code?: string };
  code?: string;
  realtimePositionList?: SwopenApiRow[];
}

const UPSTREAM_TIMEOUT_MS = 2000;

export async function fetchSwopenApiPositions(line: string, key: string): Promise<SwopenApiResult> {
  try {
    const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(line)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!res.ok) return { kind: 'upstream_error', message: `upstream_${res.status}` };
    const data = (await res.json()) as SwopenApiEnvelope;
    const apiCode = data.errorMessage?.code ?? data.code;
    const rows = data.realtimePositionList ?? [];
    if (apiCode === 'INFO-200') return { kind: 'unsupported' };
    if (apiCode === 'INFO-000' && rows.length === 0) return { kind: 'service_closed' };
    return { kind: 'ok', rows };
  } catch (e) {
    return { kind: 'upstream_error', message: (e as Error).message };
  }
}
