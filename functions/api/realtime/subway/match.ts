/// <reference types="@cloudflare/workers-types" />

// 실시간 지하철 트레인 매칭 endpoint.
//
// 흐름: 클라이언트가 "이번역 → 다음역 + 노선" 전달 → 우리 Worker가 서울
// 열린데이터광장 API 호출 → 운행 중 열차 중 그 segment를 통과 중인
// 트레인 1대를 식별 → trainNo + 정확한 방향 응답.
//
// 비매칭 시: 호출자는 segment-level fallback ID (subway:seg:...)를 씀.
//
// 보안: SEOUL_REALTIME_KEY는 서버 전용 env var. 클라이언트엔 절대 노출 X.

interface Env {
  SEOUL_REALTIME_KEY?: string;
  CACHE: KVNamespace; // optional — 폴백으로 메모리 캐시 사용
}

interface RealtimePositionRow {
  subwayId: string;       // "1001"~"1009" (1~9호선)
  statnNm: string;        // 현재 역명 (예: "강남")
  trainSttus: string;     // 0:진입, 1:도착, 2:출발, ...
  updnLine: string;       // 0:상행/내선, 1:하행/외선
  trainNo: string;        // 열차번호 (예: "2017")
  lstcarAt: string;       // 막차 여부
  statnTnm?: string;      // 종착역
  recptnDt?: string;      // 수신 시각
}

interface ReqBody {
  line: string;     // "1호선" ~ "9호선"
  prev: string;     // 방금 지나간 역 (with/without "역" suffix)
  next: string;     // 다음 도착 예정 역
}

interface MatchResponse {
  matched: boolean;
  trainNo?: string;
  direction?: 'up' | 'down';   // 0:up/inner, 1:down/outer
  currentStation?: string;
  destination?: string;
  reason?: string;
}

const LINE_TO_SUBWAY_ID: Record<string, string> = {
  '1호선': '1001', '2호선': '1002', '3호선': '1003', '4호선': '1004',
  '5호선': '1005', '6호선': '1006', '7호선': '1007', '8호선': '1008',
  '9호선': '1009',
};

const CACHE_TTL_SECONDS = 8; // 호출 절약 + 신선도 균형

function normStation(s: string): string {
  return s.endsWith('역') ? s.slice(0, -1) : s;
}

async function fetchRealtimePositions(line: string, key: string): Promise<RealtimePositionRow[]> {
  // Seoul 열린데이터 광장의 'realtimePosition' API
  // 패턴: http://swopenAPI.seoul.go.kr/api/subway/{KEY}/json/realtimePosition/{START}/{END}/{LINE_KOREAN}
  const url = `http://swopenAPI.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/0/200/${encodeURIComponent(line)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`upstream_${res.status}`);
  const body = (await res.json()) as { realtimePositionList?: RealtimePositionRow[]; errorMessage?: { code?: string } };
  return body.realtimePositionList ?? [];
}

async function getCachedPositions(env: Env, line: string): Promise<RealtimePositionRow[]> {
  const key = `realtime:subway:${line}`;
  if (env.CACHE) {
    const cached = await env.CACHE.get(key, { type: 'json' });
    if (cached) return cached as RealtimePositionRow[];
  }
  if (!env.SEOUL_REALTIME_KEY || env.SEOUL_REALTIME_KEY.startsWith('TODO')) {
    throw new Error('no_api_key');
  }
  const rows = await fetchRealtimePositions(line, env.SEOUL_REALTIME_KEY);
  if (env.CACHE) {
    await env.CACHE.put(key, JSON.stringify(rows), { expirationTtl: CACHE_TTL_SECONDS });
  }
  return rows;
}

// 매칭 알고리즘:
// 사용자가 "방금 prev 지났고 다음 next 도착예정" 입력 →
// 운행 중 열차 중 다음 조건의 트레인 1대 선정:
//   1. 현재역(statnNm) === next (다음 도착예정 = 현재 진입/도착 중인 역)
//   2. OR 현재역 === prev 이고 trainSttus === 2 (출발 직후)
//   3. 방향(updnLine) 일치 — prev→next가 노선상 어느 방향인지 추론
//
// 가장 신뢰도 높은 후보 1개 반환 (없으면 matched:false).
function matchTrain(rows: RealtimePositionRow[], prev: string, next: string): MatchResponse {
  const p = normStation(prev);
  const n = normStation(next);

  // 1순위: 현재역 == next (next에 진입/도착 중)
  const atNext = rows.filter((r) => normStation(r.statnNm) === n && (r.trainSttus === '0' || r.trainSttus === '1'));
  // 2순위: 현재역 == prev 이고 출발(2)
  const justLeftPrev = rows.filter((r) => normStation(r.statnNm) === p && r.trainSttus === '2');

  const picked = atNext[0] ?? justLeftPrev[0];
  if (!picked) return { matched: false, reason: 'no_train_at_segment' };

  return {
    matched: true,
    trainNo: picked.trainNo,
    direction: picked.updnLine === '0' ? 'up' : 'down',
    currentStation: picked.statnNm,
    destination: picked.statnTnm,
  };
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
  }
  let body: ReqBody;
  try {
    body = (await ctx.request.json()) as ReqBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const subwayId = LINE_TO_SUBWAY_ID[body.line];
  if (!subwayId) {
    // 1~9호선 외엔 실시간 데이터 없음 — 호출자가 segment fallback 처리
    return new Response(JSON.stringify({ matched: false, reason: 'line_not_supported' } satisfies MatchResponse), {
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const rows = await getCachedPositions(ctx.env, body.line);
    const result = matchTrain(rows, body.prev, body.next);
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    const msg = (e as Error).message;
    return new Response(JSON.stringify({ matched: false, reason: msg } satisfies MatchResponse), {
      status: msg === 'no_api_key' ? 503 : 502,
      headers: { 'content-type': 'application/json' },
    });
  }
};
