# 지방 도시철도 실시간 차량 데이터 — 결론 보고서

**조사일**: 2026-05-28 (KST)
**목표**: 부산/대구/광주/대전/인천2호선 차량 단위(trainNo) 실시간 위치 API 식별

---

## TL;DR — 사용자 가정 수정 필요

어디GO는 **부산 1~4호선만 실시간**이고, 나머지 지방 도시는 **자기 입으로 "시간표 기반 위치"**라고 명시함. 즉 "어디GO가 어딘가의 비밀 실시간 API를 쓴다"는 가정 자체가 틀림.

**결정적 증거 1** — Google Play 앱 설명 ([com.bykwon.bytrain](https://play.google.com/store/apps/details?id=com.bykwon.bytrain&hl=ko)):

> [수도권 — 실시간 위치] 1~9호선, … 인천1·2호선, 김포골드라인
> [부산·대구·대전·광주 — **시간표 기반 위치**] 부산 1~4호선, 동해선, 부산김해선, 대구 1~3호선, 대전 1호선, 광주 1호선

**결정적 증거 2** — DarkTornado/subway 백엔드 ([github](https://github.com/DarkTornado/subway), [main.py](https://raw.githubusercontent.com/DarkTornado/subway/main/main.py), [naver_map.py](https://raw.githubusercontent.com/DarkTornado/subway/main/naver_map.py)) — `metromap` 앱의 운행정보 백엔드를 공개해 둠. 동일 PaaS 데이터 풀:
- 부산 1~4호선 → **네이버 지도 비공식 API** (2025-05-08~)
- 동해선, 부산김해선, 대전 1호선, 대구 1~3호선, 광주 1호선, 인천 1·2호선 → 모두 `TrainLocation.calc_location()` = **시간표 JSON에서 현재 시각 기반 보간 계산**

---

## 운영사별 결과

### 부산 1~4호선 — 네이버 지도 비공식 API (⚠️ grey-zone)

```
GET https://pts.map.naver.com/end-subway/api/realtime/location/subway/integrated
    ?direction={0=하행|1=상행}
    &routeId={70001|70002|70003|70004}
    &caller=pc_web
    &lang=ko
```

- **인증**: 무인증 (User-Agent 헤더 권장, Referer/Origin 검사 없음 — 검증 완료)
- **routeId**: 70001=1호선, 70002=2호선, 70003=3호선, 70004=4호선 (1~4 외 ID는 BAD_REQUEST)
- **응답 schema**: `trainNo[0].trainNo` (차량번호), `stationSeq`, `statusCd` (0접근/1도착/2출발), `movingStatus`, `heading` (행선지), `operatingStatus` ('END'=운행종료)
- **갱신주기**: 미명시 (DarkTornado는 ~15초로 폴링)
- **검증 응답** (KST 02:39, 운행종료 시각):
  ```json
  {"status":"DATA_NOT_FOUND","message":"데이터를 찾을 수 없습니다."}
  ```
  엔드포인트는 정상, 영업시간 외라 빈 응답.
- **공식 docs**: 없음. 네이버 지도 웹 클라이언트가 내부 호출.
- **라이선스 / ToS**: 비공식. NAVER 약관상 API 직접 호출 금지 가능성 높음.
- **production 사용**: ⚠️ **위험**. 차단/소송 리스크. 단기 테스트 OK, 장기 운영 부적합.
- **부산김해경전철·동해선**: 네이버 지도가 커버 안 함 (routeId 70005~ BAD_REQUEST). 시간표 기반만 가능.

### 대구 1~3호선·대경선 — 실시간 차량 API 없음

- 대구도시철도공사 [사이버스테이션](https://www.dtro.or.kr/front/dtro/cyberstation/station/cyberstation.do) → SafeBot WAF(sabFingerPrint) 봇 보호. 우리 도구로 진입 불가지만, **결정적인 것은 DarkTornado가 시간표 기반으로 처리하는 점**. dtro.or.kr가 공개 ajax endpoint를 가졌다면 그가 안 썼을 리 없음.
- KRIC 카탈로그: 대구 관련은 유실물·구간거리·시각표(정적)·환경정보뿐.
- 네이버 지도: 대구 1~3호선 routeId 후보 모두 BAD_REQUEST.
- **production 사용**: ❌ 차량 단위 실시간 불가.

### 광주 1호선 — 실시간 차량 API 없음

- [grtc.co.kr/cyber](https://www.grtc.co.kr/cyber) "사이버스테이션" 페이지 HTML 분석 완료. 실제 ajax는 `/cyber/subway/layerC/3` (역사 편의시설 팝업)뿐. "**N대 운행중**" 카운터는 SSR 정적 값이며 별도 폴링 endpoint 없음.
- KRIC: 광주는 [구간별 운행 정보(15053586)](https://www.data.go.kr/data/15053586/openapi.do) 정적 데이터만.
- **production 사용**: ❌

### 대전 1호선 — 실시간 차량 API 없음

- DarkTornado: 시간표 기반.
- KRIC, data.go.kr: 차량 단위 실시간 데이터 없음.
- **production 사용**: ❌

### 인천 2호선 — 실시간 차량 API 없음

- DarkTornado: [별도 시간표 기반 구현체](https://darktornado.github.io/ictr/) 사용. `https://api.darktornado.net/subway/ictr/info?line=2&key=sample` (제3자 비공식 API, 의존 불가)
- 인천교통공사가 자체 공개 실시간 API를 두고 있지 않음.
- **production 사용**: ❌
- 참고: 인천1호선은 서울 swopenAPI에 포함됨 (이미 OK).

---

## KRIC 레일포털 전수조사 (60건)

미국 IP에서도 정상 접근 가능 (기존 가정 수정). 전체 카탈로그 6페이지 60개 API 확인 결과 **실시간 차량 위치 API 존재하지 않음**.

가장 차량에 가까운 것은 [도시철도 열차별 환경정보 (id=167)](https://data.kric.go.kr/rips/M_01_02/detail.do?id=167&service=trainUseInfo&operation=subwayEnvironmental):
- `subwayEnvironmental?trnNo=...&envrMsmtDvCd=10` (PM2.5 등)
- 응답에 `trnNo`, `carOrdr`, `msmtDttm` 있음. 차량 단위는 맞음.
- **다만 "위치"가 아니라 "공기질"이고, 갱신주기 미공개**. 실시간 위치 매칭에는 부적합.

---

## 부산/대구 BMS 자체 (보너스)

- 부산 BIS (`bus.busan.go.kr`), 대구 BIS (`businfo.daegu.go.kr`) 모두 자체 사이트 운영. 응답 200 OK.
- 단 우리 스택은 이미 **TAGO 1613000으로 138개 cityCode 커버** — 부산(21), 대구(22) 포함. **별도 자체 API로 갈아탈 인센티브 없음**.
- 깊이 파지 않았음. 필요시 별도 task.

---

## 결정/액션 제안

### 우리 PWA(에어컨 민주주의)의 차량 단위 투표 모델에 미치는 영향

차량 단위 trainNo가 안정적으로 잡히는 지방 노선은 **부산 1~4호선뿐**, 그것도 네이버 비공식 경로 통해서임. 다른 지방 노선은 차량 단위 매칭 자체가 불가.

### 옵션 (사용자 결정 필요)

**A. 지방 지하철은 "역 단위" 또는 "노선 단위"로 모델 축소** (추천)
- 부산/대구/대전/광주/인천2: "X역에 도착한 열차"에 대한 투표. trainNo 매칭 포기.
- 데이터 출처: KRIC `subwayTimetable` + KRIC `stationCongestion`(서울만) + 시간표 보간.
- 장점: 합법, 안정, 회귀 위험 낮음.
- 단점: 서울/수도권과 UX 비대칭.

**B. 부산만 네이버 지도 비공식 API로 차량 단위 지원**
- 1~4호선 한정. routeId 70001~70004.
- 장점: 부산은 수도권과 동일 UX.
- 단점: ToS 회색지대. 네이버가 막거나 변경 시 즉시 깨짐. 법적 리스크.

**C. 자체 시간표 기반 차량 ID 부여** (DarkTornado 방식)
- KRIC `subwayTimetable`에서 시간표 받아 trainNo를 부여, 현재 시각으로 위치 보간.
- 장점: 합법, 모든 노선 적용 가능.
- 단점: trainNo가 "스케줄된 차량"이라 실제 운행 지연/결행 반영 안 됨. **잘못된 매칭으로 ghost entry 발생 가능**(CLAUDE.md 코어 원칙 3 위반 위험).

**추천: A**. 지방은 역 단위로 축소하고, 부산만 별도 옵션으로 추후 B 검토.

---

## 참고 자료

- 어디GO Google Play: https://play.google.com/store/apps/details?id=com.bykwon.bytrain&hl=ko
- 어디GO 웹: https://www.wheretrain.com (응답 없음 - 추정 미운영)
- DarkTornado/subway 리포: https://github.com/DarkTornado/subway
- KRIC 레일포털 OpenAPI 카탈로그: https://data.kric.go.kr/rips/M_01_02/intro.do
- 광주 사이버스테이션: https://www.grtc.co.kr/cyber
- 대구 사이버스테이션: https://www.dtro.or.kr/front/dtro/cyberstation/station/cyberstation.do
